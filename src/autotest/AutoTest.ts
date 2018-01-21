import {Config} from "../Config";
import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven, IPushEvent} from "../Types";
import Log from "../util/Log";
import {IClassPortal} from "./ClassPortal";
import {IDataStore} from "./DataStore";
import {DockerInstance} from "./DockerInstance";
import {IGithubService} from "./GithubService";
import {Queue} from "./Queue";

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
    // private readonly testDelay: number;

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
    }

    /**
     * Handles push events from Github.
     *
     * Persists the event so it can be restarted later if needed.
     * Schedules the build on the standard queue.
     *
     * @param info
     */
    public async handlePushEvent(info: IPushEvent): Promise<boolean> {
        try {
            Log.info("AutoTest::handlePushEvent(..) - course: " + this.courseId + "; commit: " + info.commitURL);
            const delivId: string = await this.getDelivId(info.projectURL); // current default deliverable
            if (delivId !== null) {
                const input: IContainerInput = {courseId: this.courseId, delivId, pushInfo: info};
                await this.savePushInfo(input);
                this.standardQueue.push(input);
                this.tick(); // tick!
            } else {
                // no active deliverable, ignore this push event (don't push an error either)
                Log.warn("AutoTest::handlePushEvent(..) - course: " + this.courseId + "; commit: " + info.commitURL + " - No active deliverable; push ignored.");
            }
            return true;
        } catch (err) {
            Log.error("AutoTest::handlePushEvent(..) - course: " + this.courseId + "; ERROR: " + err.message);
            throw err;
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
    public async handleCommentEvent(info: ICommentEvent): Promise<boolean> {
        const that = this;
        try {
            Log.info("AutoTest::handleCommentEvent(..) - course: " + this.courseId + " - start"); // commit: " + info.commitURL + "; user: " + info.userName);
            Log.info("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; commit: " + info.commitURL + "; user: " + info.userName);

            // NOTE: need to think a bit harder about which comment events should be saved and which should be dropped

            if (info.userName === Config.getInstance().getProp("botName")) {
                Log.info("AutoTest::handleCommentEvent(..) - ignored, comment made by AutoBot");
                return true;
            }

            if (info.botMentioned === false) {
                Log.info("AutoTest::handleCommentEvent(..) - ignored, bot not mentioned");
                return true;
            }

            // update info record
            info.courseId = that.courseId;
            let delivId = info.delivId;
            if (delivId === null) {
                delivId = await this.getDelivId(info.commitURL); // need to get the default deliverable for that repo
                info.delivId = delivId;
            }

            if (delivId === null) {
                // no deliverable, give warning and abort
                const msg = "There is no current default deliverable; results will not be posted.";
                await this.github.postMarkdownToGithub({url: info.postbackURL, message: msg});
                return true;
            }

            // front load the async operations, even if it means we do some operations unnecessairly
            // could do these all in parallel
            const isStaff = await this.classPortal.isStaff(this.courseId, info.userName); // async
            const requestFeedbackDelay = await this.requestFeedbackDelay(delivId, info.userName, info.timestamp); // ts of comment, not push
            const res: ICommitRecord = await this.getOutputRecord(info.commitURL); // for any user
            const isCurrentlyRunning: boolean = this.isCommitExecuting(info.commitURL, delivId);

            Log.trace("AutoTest::handleCommentEvent(..) - isStaff: " + isStaff + "; delay: " + requestFeedbackDelay + "; res: " + res + "; running?: " + isCurrentlyRunning);

            let shouldPost = false; // should the result be given
            if (isStaff === true) {
                shouldPost = true;
            } else {
                if (requestFeedbackDelay === null) {
                    shouldPost = true;
                } else {
                    shouldPost = false;
                    const msg = "You must wait " + requestFeedbackDelay + " before requesting feedback.";
                    await this.github.postMarkdownToGithub({url: info.postbackURL, message: msg});
                }
            }

            if (res !== null) {
                // execution complete
                Log.trace("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; commit: " + info.commitURL + "; execution complete");
                const hasBeenRequestedBefore = await this.dataStore.getFeedbackGivenRecordForCommit(info.commitURL, info.userName); // students often request grades they have previously 'paid' for
                if (hasBeenRequestedBefore !== null) {
                    // just give it to them again, don't charge for event
                    shouldPost = true;
                }

                if (shouldPost === true) {
                    await this.github.postMarkdownToGithub({url: info.postbackURL, message: res.output.feedback});
                    await this.saveFeedbackGiven(this.courseId, delivId, info.userName, res.input.pushInfo.timestamp, info.commitURL);
                    await this.saveCommentInfo(info); // user or TA; only for analytics since feedback has been given
                }

            } else {
                // execution not yet complete
                Log.info("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; commit: " + info.commitURL + "; execution not yet complete");
                if (shouldPost === true) {
                    // user has request quota available
                    let msg = "This commit is still queued for processing against " + delivId + ".";
                    msg += " Your results will be posted here as soon as they are ready.";
                    await this.github.postMarkdownToGithub({url: info.postbackURL, message: msg});
                    await this.saveCommentInfo(info); // whether TA or staff
                }

                if (isCurrentlyRunning === true) {
                    // do nothing, will be handled later when the commit finishes processing
                } else {
                    if (this.expressQueue.length() > this.standardQueue.indexOf(info.commitURL)) {
                        // faster to just leave it on the standard queue
                    } else {
                        // promote to the express queue
                        const input = this.standardQueue.remove(info.commitURL);
                        this.expressQueue.push(input);
                    }
                }
            }

            // everything is ready; run the clock
            this.tick();
        } catch (err) {
            Log.error("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; ERROR: " + err.message);
            throw err;
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
    public async handleExecutionComplete(data: ICommitRecord): Promise<void> {
        try {
            Log.info("AutoTest::handleExecutionComplete(..) - start");

            if (data === null) {
                Log.warn("AutoTest::handleExecutionComplete(..) - null data; skipping");
                return;
            }

            await this.dataStore.saveOutputRecord(data);

            const requestorUsername = await this.getRequestor(data.commitURL);
            if (data.output.postbackOnComplete === true) {
                // do this first, doesn't count against quota
                Log.info("AutoTest::handleExecutionComplete(..) - postback: true");
                await this.github.postMarkdownToGithub({url: data.input.pushInfo.postbackURL, message: data.output.feedback});
                // NOTE: if the feedback was requested for this build it shouldn't count
                // since we're not calling saveFeedabck this is right
                // but if we replay the commit comments, we would see it there, so be careful
            } else if (requestorUsername !== null) {
                // feedback has been previously requested
                Log.info("AutoTest::handleExecutionComplete(..) - feedback requested");
                await this.github.postMarkdownToGithub({url: data.input.pushInfo.postbackURL, message: data.output.feedback});
                await this.saveFeedbackGiven(data.input.courseId, data.input.delivId, requestorUsername, data.input.pushInfo.timestamp, data.commitURL);
            } else {
                // do nothing
                Log.info("AutoTest::handleExecutionComplete(..) - course: " + this.courseId + "; commit not requested - no feedback given. url: " + data.commitURL);
            }

            // when done clear the execution slot and schedule the next
            if (data.commitURL === this.expresssExecution.pushInfo.commitURL) {
                Log.trace("AutoTest::handleExecutionComplete(..) - clear express slot");
                this.expresssExecution = null;
            }
            if (data.commitURL === this.standardExecution.pushInfo.commitURL) {
                Log.trace("AutoTest::handleExecutionComplete(..) - clear standard slot");
                this.standardExecution = null;
            }

            // execution done, advance the clock
            this.tick();
        } catch (err) {
            Log.error("AutoTest::handleExecutionComplete(..) - course: " + this.courseId + "; ERROR: " + err.message);
        }
    }

    public tick() {
        Log.info("AutoTest::tick(..) - start");
        try {
            if (this.standardExecution === null) {
                const info = this.standardQueue.pop();
                if (info !== null) {
                    this.invokeContainer(info); // NOTE: not awaiting on purpose (let it finish in the background)!
                }
            }

            if (this.expresssExecution === null) {
                const info = this.expressQueue.pop();
                if (info !== null) {
                    this.invokeContainer(info); // NOTE: not awaiting on purpose (let it finish in the background)!
                }
            }
            Log.info("AutoTest::tick(..) - done");
        } catch (err) {
            Log.error("AutoTest::tick() - course: " + this.courseId + "; ERROR: " + err.message);
        }
    }

    /**
     * Saves pushInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {IContainerInput} info
     */
    private async savePushInfo(info: IContainerInput) {
        Log.trace("AutoTest::savePushInfo(..) - commit: " + info.pushInfo.commitURL);
        await this.dataStore.savePush(info);
    }

    /**
     * Saves commentInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {ICommentEvent} info
     */
    private async saveCommentInfo(info: ICommentEvent) {
        Log.trace("AutoTest::saveCommentInfo(..) - commit: " + info.commitURL);
        await this.dataStore.saveComment(info);
    }

    /**
     * Starts the container for the commit.
     *
     *
     * @param input
     */
    private async invokeContainer(input: IContainerInput) {
        try {
            Log.info("AutoTest::invokeContainer(..) - commit: " + input.pushInfo.commitURL);

            const docker = new DockerInstance(input);
            const record: ICommitRecord = await docker.execute();

            Log.info("AutoTest::invokeContainer(..) - complete for commit: " + input.pushInfo.commitURL + "; record: " + JSON.stringify(record));
            this.handleExecutionComplete(record);

        } catch (err) {
            Log.error("AutoTest::invokeContainer(..) - ERROR for commit: " + input.pushInfo.commitURL + "; ERROR: " + err);
            // Log.error("AutoTest::invokeContainer(..) - ERROR: " + err.message);
        }
    }

    /**
     * Gets the current deliverable id
     *
     * @param commitURL
     */
    private async getDelivId(commitURL: string): Promise<string | null> {
        let str = await this.classPortal.getDefaultDeliverableId(commitURL);
        if (typeof str === "undefined") {
            str = null;
        }
        return str;
    }

    private async getOutputRecord(commitURL: string): Promise<ICommitRecord | null> {
        return await this.dataStore.getOutputRecord(commitURL);
    }

    /**
     * Tracks that feedback was given for the specified user at the specified time.
     *
     * @param courseId
     * @param delivId
     * @param userName
     * @param timestamp
     * @param commitURL
     */
    private async saveFeedbackGiven(courseId: string, delivId: string, userName: string, timestamp: number, commitURL: string): Promise<void> {
        const record: IFeedbackGiven = {
            commitURL,
            courseId,
            delivId,
            timestamp,
            userName,
        };
        await this.dataStore.saveFeedbackGivenRecord(record);
    }

    /**
     * Return the username that requested the result for the given commitURL (or null)
     *
     * @param commitURL
     */
    private async getRequestor(commitURL: string): Promise<string | null> {
        const record: ICommentEvent = await this.dataStore.getCommentRecord(commitURL);
        if (record !== null) {
            return record.userName;
        }
        return null;
    }

    /**
     * Returns whether the commitURL is currently executing the given deliverable.
     *
     * @param commitURL
     * @param delivId
     */
    private isCommitExecuting(commitURL: string, delivId: string): boolean {
        if (this.standardExecution !== null) {
            if (this.standardExecution.pushInfo.commitURL === commitURL && this.standardExecution.delivId === delivId) {
                return true;
            }
        }
        if (this.expresssExecution !== null) {
            if (this.expresssExecution.pushInfo.commitURL === commitURL && this.expresssExecution.delivId === delivId) {
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
    private async requestFeedbackDelay(delivId: string, userName: string, reqTimestamp: number): Promise<string | null> {
        Log.info("AutoTest::requestFeedbackDelay( " + delivId + ", " + userName + ", " + reqTimestamp + ". - start");
        // async operations up front
        const isStaff = await this.classPortal.isStaff(this.courseId, userName);
        const record: IFeedbackGiven = await this.dataStore.getLatestFeedbackGivenRecord(this.courseId, delivId, userName);
        const testDelay = await this.classPortal.getTestDelay(this.courseId); // should cache this

        if (isStaff === true) {
            return null; // staff can always request
        } else {
            if (record === null) {
                return null; // no prior requests
            } else {
                const delta = (reqTimestamp - record.timestamp) / 1000;
                if (delta > testDelay) {
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
