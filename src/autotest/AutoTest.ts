import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven, IPushEvent} from "../Types";
import {Queue} from "./Queue";

import Log from "../Log";
import {IClassPortal} from "./ClassPortal";
import {IDataStore} from "./DataStore";
import {IGithubService} from "./GithubService";

export interface IAutoTest {
    /**
     * Handles a push event from GitHub. Will place job on queue.
     *
     * @param {IPushEvent} push
     */
    handlePushEvent(push: IPushEvent): void;

    /**
     * Handle a comment event from GitHub. Will promote job to
     * express queue if appropriate. When job is complete, it will
     * comment back automatically for the user.
     *
     * @param {ICommentEvent} comment
     */
    handleCommentEvent(comment: ICommentEvent): void;

    /**
     * Handles the end of an execution job.
     *
     * @param {ICommitRecord} data
     */
    handleExecutionComplete(data: ICommitRecord): void;

    /**
     * Updates the internal clock of the handler. This might or might not do anything.
     *
     * But if there are execution slots available and the queue has elements it should
     * start jobs processing.
     */
    tick(): void;
}

export class AutoTest implements IAutoTest {

    private readonly courseId: string;
    private readonly testDelay: number;

    private standardQueue = new Queue();
    private expressQueue = new Queue();
    // these could be arrays if we wanted a thread pool model
    private standardExecution: IContainerInput | null = null;
    private expresssExecution: IContainerInput | null = null;

    private readonly dataStore: IDataStore;
    private readonly classPortal: IClassPortal;
    private github: IGithubService;

    constructor(courseId: string, dataStore: IDataStore, portal: IClassPortal, github: IGithubService) {
        this.courseId = courseId;
        this.dataStore = dataStore;
        this.classPortal = portal;
        this.github = github;
        this.testDelay = this.classPortal.getTestDelay(this.courseId);

    }

    /**
     * Handles push events from Github.
     *
     * Persists the event so it can be restarted later if needed.
     * Schedules the build on the standard queue.
     *
     * @param info
     */
    public handlePushEvent(info: IPushEvent) {
        try {
            Log.info("AutoTest::handlePushEvent(..) - course: " + this.courseId + "; commit: " + info.commitUrl);
            const delivId: string = this.getDelivId(info.projectUrl); // current default deliverable // async
            if (delivId !== null) {
                const input: IContainerInput = {courseId: this.courseId, delivId, pushInfo: info};
                this.savePushInfo(input);
                this.standardQueue.push(input);
            } else {
                // no active deliverable, ignore this push event (don't push an error either)
                Log.warn("AutoTest::handlePushEvent(..) - course: " + this.courseId + "; commit: " + info.commitUrl + " - No active deliverable; push ignored.");
            }
        } catch (err) {
            Log.error("AutoTest::handlePushEvent(..) - course: " + this.courseId + "; ERROR: " + err.message);
        }
    }

    /**
     * Handles comment events from Github.
     *
     * Persists the event only if the feedback cannot be given right away and should be given when ready.
     *
     * Be careful though: if we give the warning we don't want to post back later!
     *
     * If build has not finished; let it finish, comments will appear in handleExecutionComplete:
     *  0) leave it alone if it is currently executing
     *  1) move it to the express que if faster
     *  2) leave it on the standard queue if faster
     *  3) comment will be remembered so results are automatically posted (if within quota or from TA)
     *
     * If build is finished:
     *  * post back results if previously requested
     *  * post back results if requested by TA
     *  * post back results if rate limiting check passes (and record fedback given)
     *  * post back warning if rate limiting check fails
     *
     * @param info
     */
    public handleCommentEvent(info: ICommentEvent) {
        try {
            Log.info("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; commit: " + info.commitUrl + "; user: " + info.userName);

            // NOTE: need to think a bit harder about which comment events should be saved and which should be dropped

            if (info.userName === "autobot") {
                Log.info("AutoTest::handleCommentEvent(..) - ignored, comment made by AutoBot");
                return;
            }

            // update info record
            info.courseId = this.courseId;
            let delivId = info.delivId;
            if (delivId === null) {
                delivId = this.getDelivId(info.commitUrl); // need to get the default deliverable for that repo
                info.delivId = delivId;
            }

            if (delivId === null) {
                // no deliverable, give warning and abort
                const msg = "There is no current default deliverable; results will not be posted.";
                this.github.postMarkdownToGithub({url: info.commitUrl, message: msg});
                return;
            }

            // front load the async operations, even if it means we do some operations unnecessairly
            // could do these all in parallel
            const isStaff = this.classPortal.isStaff(this.courseId, info.userName); // async
            const requestFeedbackDelay = this.requestFeedbackDelay(delivId, info.userName, info.timestamp); // ts of comment, not push // async
            const res: ICommitRecord = this.getOutputRecord(info.commitUrl); // for any user, async
            const isCurrentlyRunning: boolean = this.isCommitExecuting(info.commitUrl, delivId);

            let shouldPost = false; // should the result be given
            if (isStaff === true) {
                shouldPost = true;
            } else {
                if (requestFeedbackDelay === null) {
                    shouldPost = true;
                } else {
                    shouldPost = false;
                    const msg = "You must wait " + requestFeedbackDelay + " before requesting feedback.";
                    this.github.postMarkdownToGithub({url: info.commitUrl, message: msg});
                }
            }

            if (res !== null) {
                // execution complete
                const hasBeenRequestedBefore = this.dataStore.getFeedbackGivenRecordForCommit(info.commitUrl, info.userName); // students often request grades they have previously 'paid' for
                if (hasBeenRequestedBefore !== null) {
                    // just give it to them again, don't charge for event
                    shouldPost = true;
                }

                if (shouldPost === true) {
                    this.github.postMarkdownToGithub({url: info.commitUrl, message: res.output.feedback});
                    this.saveFeedbackGiven(this.courseId, delivId, info.userName, res.input.pushInfo.timestamp, info.commitUrl);
                    this.saveCommentInfo(info); // user or TA; only for analytics since feedback has been given
                }

            } else {
                // execution not yet complete
                if (shouldPost === true) {
                    // user has request quota available
                    let msg = "This commit is still queued for processing against " + delivId + ".";
                    msg += " Your results will be posted here as soon as they are ready.";
                    this.github.postMarkdownToGithub({url: info.commitUrl, message: msg});
                    this.saveCommentInfo(info); // whether TA or staff
                }

                if (isCurrentlyRunning === true) {
                    // do nothing, will be handled later when the commit finishes processing
                } else {
                    if (this.expressQueue.length() > this.standardQueue.indexOf(info.commitUrl)) {
                        // faster to just leave it on the standard queue
                    } else {
                        // promote to the express queue
                        const input = this.standardQueue.remove(info.commitUrl);
                        this.expressQueue.push(input);
                    }
                }
            }
        } catch (err) {
            Log.error("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; ERROR: " + err.message);
        }
    }

    /**
     * Called when a container completes.
     *
     * Persist record.
     * Post back if specified by container output.
     * Post back if requested by TA
     * Post back if requested by user and quota allows (and record feedback given)
     *
     * @param data
     */
    public handleExecutionComplete(data: ICommitRecord): void {
        try {
            this.dataStore.saveOutputRecord(data);

            const requestorUsername = this.getRequestor(data.commitUrl);
            if (data.output.postbackOnComplete === true) {
                // do this first, doesn't count against quota
                this.github.postMarkdownToGithub({url: data.commitUrl, message: data.output.feedback});
                // NOTE: if the feedback was requested for this build it shouldn't count
                // since we're not calling saveFeedabck this is right
                // but if we replay the commit comments, we would see it there, so be careful
            } else if (requestorUsername !== null) {
                // feedback has been previously requested
                this.github.postMarkdownToGithub({url: data.commitUrl, message: data.output.feedback});
                this.saveFeedbackGiven(data.input.courseId, data.input.delivId, requestorUsername, data.input.pushInfo.timestamp, data.commitUrl);
            } else {
                // do nothing
                Log.info("AutoTest::handleExecutionComplete(..) - course: " + this.courseId + "; commit not requested - no feedback given. url: " + data.commitUrl);
            }

            // when done clear the execution slot and schedule the next
            if (data.commitUrl === this.expresssExecution.pushInfo.commitUrl) {
                this.expresssExecution = null;
            }
            if (data.commitUrl === this.standardExecution.pushInfo.commitUrl) {
                this.standardExecution = null;
            }
            this.tick();
        } catch (err) {
            Log.error("AutoTest::handleExecutionComplete(..) - course: " + this.courseId + "; ERROR: " + err.message);
        }
    }

    public tick() {
        try {
            if (this.standardExecution === null) {
                const info = this.standardQueue.pop();
                if (info !== null) {
                    this.invokeContainer(info);
                }
            }

            if (this.expresssExecution === null) {
                const info = this.expressQueue.pop();
                if (info !== null) {
                    this.invokeContainer(info);
                }
            }
        } catch (err) {
            Log.error("AutoTest::tick() - course: " + this.courseId + "; ERROR: " + err.message);
        }
    }

    /**
     * Saves pushInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {IContainerInput} info
     */
    private savePushInfo(info: IContainerInput) {
        Log.trace("AutoTest::savePushInfo(..) - commit: " + info.pushInfo.commitUrl);
        this.dataStore.savePush(info);
    }

    /**
     * Saves commentInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {ICommentEvent} info
     */
    private saveCommentInfo(info: ICommentEvent) {
        Log.trace("AutoTest::saveCommentInfo(..) - commit: " + info.commitUrl);
        this.dataStore.saveComment(info);
    }

    /**
     * Starts the container for the commit.
     *
     *
     * @param input
     */
    private invokeContainer(input: IContainerInput) {
        try {
            Log.info("AutoTest::invokeContainer(..) - commit: " + input.pushInfo.commitUrl);

            // execute with docker
            const finalInfo: ICommitRecord = null; // TODO: call docker etc.
            // TODO: must handle container timeout
            // TODO: must do something with stdio
            // TODO: must handle all attachments / other files
            if (finalInfo !== null) {
                this.handleExecutionComplete(finalInfo);
            } else {
                Log.info("AutoTest::invokeContainer(..) - commit: " + input.pushInfo.commitUrl + "; null final info");
            }

        } catch (err) {
            Log.error("AutoTest::invokeContainer(..) - ERROR: " + err.message);
        }
    }

    /**
     * Gets the current deliverable id
     *
     * @param commitUrl
     */
    private getDelivId(commitUrl: string): string | null {
        let str = this.classPortal.getDefaultDeliverableId(commitUrl);
        if (typeof str === "undefined") {
            str = null;
        }
        return str;
    }

    private getOutputRecord(commitUrl: string): ICommitRecord | null {
        return this.dataStore.getOutputRecord(commitUrl);
    }

    /**
     * Tracks that feedback was given for the specified user at the specified time.
     *
     * @param courseId
     * @param delivId
     * @param userName
     * @param timestamp
     * @param commitUrl
     */
    private saveFeedbackGiven(courseId: string, delivId: string, userName: string, timestamp: number, commitUrl: string): void {
        const record: IFeedbackGiven = {
            commitUrl,
            courseId,
            delivId,
            timestamp,
            userName,
        };
        this.dataStore.saveFeedbackGivenRecord(record);
    }

    /**
     * Return the username that requested the result for the given commitUrl (or null)
     *
     * @param commitUrl
     */
    private getRequestor(commitUrl: string): string | null {
        const record: ICommentEvent = this.dataStore.getCommentRecord(commitUrl);
        if (record !== null) {
            return record.userName;
        }
        return null;
    }

    /**
     * Returns whether the commitUrl is currently executing the given deliverable.
     *
     * @param commitUrl
     * @param delivId
     */
    private isCommitExecuting(commitUrl: string, delivId: string): boolean {
        if (this.standardExecution !== null) {
            if (this.standardExecution.pushInfo.commitUrl === commitUrl && this.standardExecution.delivId === delivId) {
                return true;
            }
        }
        if (this.expresssExecution !== null) {
            if (this.expresssExecution.pushInfo.commitUrl === commitUrl && this.expresssExecution.delivId === delivId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check to see if the current user is allowed to make a result request
     *
     * Null means yes, string will contain how long (in a human readable format).
     *
     * @param delivId
     * @param userName
     * @param reqTimestamp
     *
     */
    private requestFeedbackDelay(delivId: string, userName: string, reqTimestamp: number): string | null {

        // async operations up front
        const isStaff = this.classPortal.isStaff(this.courseId, userName);
        const record: IFeedbackGiven = this.dataStore.getLatestFeedbackGivenRecord(this.courseId, delivId, userName);

        if (isStaff === true) {
            return null; // staff can always request
        } else {
            if (record === null) {
                return null; // no prior requests
            } else {
                const delta = (reqTimestamp - record.timestamp) / 1000;
                if (delta > this.testDelay) {
                    return null; // enough time has passed
                } else {
                    const hours = Math.floor(delta / 3600);
                    const minutes = Math.floor((delta - (hours * 3600)) / 60);
                    let msg = "";
                    if (hours > 0) {
                        msg = hours + " hours and " + minutes + " minutes";
                    } else if (minutes > 0) {
                        msg = minutes + " minutes";
                    } else {
                        msg = delta + " seconds";
                    }
                    return msg;
                }
            }
        }
    }
}
