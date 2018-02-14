import {Config} from "../Config";
import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven, IPushEvent} from "../Types";
import Log from "../util/Log";
import Util from "../util/Util";
import {IClassPortal} from "./ClassPortal";
import {IDataStore} from "./DataStore";
// import {MockGrader} from "./MockGrader";
import {IGithubService} from "./GithubService";
import Grader from "./Grader";
import {Queue} from "./Queue";
import {MockGrader} from "./MockGrader";

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

    private regressionQueue = new Queue();
    private standardQueue = new Queue();
    private expressQueue = new Queue();
    // these could be arrays if we wanted a thread pool model
    private regressionExecution: IContainerInput | null = null;
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
     * TODO: Not sure why it returns a boolean instead of void.
     *
     * @param info
     */
    public async handlePushEvent(info: IPushEvent, delivId?: string): Promise<boolean> {
        try {
            if (typeof info === "undefined" || info === null) {
                Log.info("AutoTest::handlePushEvent(..) - info not provided; skipping.");
                return false;
            }

            Log.info("AutoTest::handlePushEvent(..) - start; course: " + this.courseId + "; commit: " + info.commitSHA);
            const start = Date.now();

            if (typeof delivId === "undefined" || delivId === null) {
                delivId = await this.getDelivId(); // current default deliverable
            }

            if (delivId !== null) {
                const input: IContainerInput = {courseId: this.courseId, delivId, pushInfo: info};
                await this.savePushInfo(input);
                this.standardQueue.push(input);
                this.tick(); // tick!
            } else {
                // no active deliverable, ignore this push event (don't push an error either)
                Log.warn("AutoTest::handlePushEvent(..) - course: " + this.courseId + "; commit: " + info.commitSHA + " - No active deliverable; push ignored.");
            }
            Log.info("AutoTest::handlePushEvent(..) - done; course: " + this.courseId + "; commit: " + info.commitSHA + "; took: " + Util.took(start));
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
     * TODO: Not sure why this returns a boolean instead of void.
     * TODO: need to think a bit harder about which comment events should be saved and which should be dropped
     *
     * @param info
     */
    public async handleCommentEvent(info: ICommentEvent): Promise<boolean> {
        const that = this;
        try {
            const start = Date.now();

            if (typeof info === "undefined" || info === null) {
                Log.info("AutoTest::handleCommentEvent(..) - info not provided; skipping.");
                return false;
            }

            Log.info("AutoTest::handleCommentEvent(..) - start; course: " + this.courseId + "; commit: " + info.commitSHA + "; user: " + info.userName);

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
                // need to get the default deliverable for that repo
                delivId = await this.getDelivId();
                info.delivId = delivId;
            }

            if (delivId === null) {
                // no deliverable, give warning and abort
                const msg = "There is no current default deliverable; results will not be posted.";
                await this.github.postMarkdownToGithub({url: info.postbackURL, message: msg});
                return true;
            }

            // front load the async operations, even if it means we do some operations unnecessarily; thse could be done in parallel
            const isStaff: boolean = await this.classPortal.isStaff(this.courseId, info.userName); // async
            const requestFeedbackDelay: string | null = await this.requestFeedbackDelay(delivId, info.userName, info.timestamp); // ts of comment, not push
            const hasBeenRequestedBefore: IFeedbackGiven = await this.dataStore.getFeedbackGivenRecordForCommit(info.commitURL, info.userName); // students often request grades they have previously 'paid' for
            const res: ICommitRecord = await this.getOutputRecord(info.commitURL); // for any user
            const isCurrentlyRunning: boolean = this.isCommitExecuting(info.commitURL, delivId);
            Log.trace("AutoTest::handleCommentEvent(..) - isStaff: " + isStaff + "; delay: " + requestFeedbackDelay + "; res: " + res + "; running?: " + isCurrentlyRunning);

            let shouldPost = false; // should the result be given
            if (isStaff === true) {
                // always respond for staff
                shouldPost = true;
            } else {
                if (requestFeedbackDelay === null) {
                    // respond if they have not been given feedback before
                    shouldPost = true;
                } else {
                    // students have been given feedback within the time window
                    if (hasBeenRequestedBefore === null) {
                        // but the feedback was on another commit
                        shouldPost = false;
                        const msg = "You must wait " + requestFeedbackDelay + " before requesting feedback.";
                        await this.github.postMarkdownToGithub({url: info.postbackURL, message: msg});
                    } else {
                        // they have been given feedback within the window, but on this commit.
                        // so we might as well give it to them. asking for this doesn't make sense,
                        // but happens with remarkable frequency, so just give them their results back again
                        shouldPost = true;
                    }
                }
            }

            if (res !== null) {
                // execution has been completed so there is feedback ready to give
                Log.trace("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; commit: " + info.commitSHA + "; execution complete");
                // true if staff, requested before, or over feedback delay interval
                if (shouldPost === true) {
                    await this.github.postMarkdownToGithub({url: info.postbackURL, message: res.output.feedback});
                    await this.saveFeedbackGiven(this.courseId, delivId, info.userName, info.timestamp, info.commitURL);
                    await this.saveCommentInfo(info); // user or TA; only for analytics since feedback has been given
                }
            } else {
                // execution not yet complete
                Log.info("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; commit: " + info.commitSHA + "; execution not yet complete");
                if (shouldPost === true) {
                    // NOTE: it _should_ be on the standard queue here, but if it isn't, could we add it, just to be safe?
                    const onQueue = this.isOnQueue(info.commitURL, info.delivId);
                    let msg = "This commit is still queued for processing against " + delivId + ".";
                    msg += " Your results will be posted here as soon as they are ready.";
                    if (onQueue === false) {
                        const pe = await this.dataStore.getPushRecord(info.commitURL);
                        if (pe !== null) {
                            Log.info("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; commit: " + info.commitSHA + "; - element not on queue; adding.");
                            await this.handlePushEvent(pe, info.delivId);
                        } else {
                            Log.warn("AutoTest::handleCommentEvent(..) - course: " + this.courseId + "; commit: " + info.commitSHA + "; - element not on queue; cannot find push event.");
                            msg = "This commit is has not been queued; please make and push a new commit.";
                        }
                    }
                    await this.saveCommentInfo(info); // whether TA or staff
                    await this.github.postMarkdownToGithub({url: info.postbackURL, message: msg});
                } else {
                    // should we do something if shouldPost is false?
                }

                if (isCurrentlyRunning === true) {
                    // do nothing, will be handled later when the commit finishes processing
                } else {
                    this.promoteIfNeeded(info);
                }
            }

            // everything is ready; run the clock
            this.tick();

            Log.info("AutoTest::handleCommentEvent(..) - done; course: " + this.courseId + "; commit: " + info.commitSHA + "; took: " + Util.took(start));
            return true;
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
            const start = Date.now();

            if (typeof data === "undefined" || data === null) {
                Log.warn("AutoTest::handleExecutionComplete(..) - null data; skipping");
                return;
            }

            if (typeof data.commitSHA === "undefined" ||
                typeof data.commitURL === "undefined" ||
                typeof data.input === "undefined" ||
                typeof data.output === "undefined") {
                Log.warn("AutoTest::handleExecutionComplete(..) - missing required field; skipping; data: " + JSON.stringify(data));
                return;
            }

            await this.dataStore.saveOutputRecord(data);

            const pushRequested: ICommentEvent = await this.getRequestor(data.commitURL, data.input.delivId);
            if (data.output.postbackOnComplete === true) {
                // do this first, doesn't count against quota
                Log.info("AutoTest::handleExecutionComplete(..) - postback: true");
                await this.github.postMarkdownToGithub({url: data.input.pushInfo.postbackURL, message: data.output.feedback});
                // NOTE: if the feedback was requested for this build it shouldn't count
                // since we're not calling saveFeedabck this is right
                // but if we replay the commit comments, we would see it there, so be careful
            } else if (pushRequested !== null) {
                // feedback has been previously requested
                Log.info("AutoTest::handleExecutionComplete(..) - feedback requested");
                await this.github.postMarkdownToGithub({url: data.input.pushInfo.postbackURL, message: data.output.feedback});
                await this.saveFeedbackGiven(data.input.courseId, data.input.delivId, pushRequested.userName, pushRequested.timestamp, data.commitURL);
            } else {
                // do nothing
                Log.info("AutoTest::handleExecutionComplete(..) - course: " + this.courseId + "; commit not requested - no feedback given; commit: " + data.commitSHA);
            }

            // when done clear the execution slot and schedule the next
            if (this.expresssExecution !== null && this.expresssExecution.pushInfo.commitURL === data.commitURL) {
                Log.trace("AutoTest::handleExecutionComplete(..) - clear express slot");
                this.expresssExecution = null;
            }
            if (this.standardExecution !== null && this.standardExecution.pushInfo.commitURL === data.commitURL) {
                Log.trace("AutoTest::handleExecutionComplete(..) - clear standard slot");
                this.standardExecution = null;
            }

            if (this.regressionExecution !== null && this.regressionExecution.pushInfo.commitURL === data.commitURL) {
                Log.trace("AutoTest::handleExecutionComplete(..) - clear regression slot");
                this.regressionExecution = null;
            }

            // execution done, advance the clock
            this.tick();
            Log.info("AutoTest::handleExecutionComplete(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("AutoTest::handleExecutionComplete(..) - course: " + this.courseId + "; ERROR: " + err.message);
        }

    }

    public tick() {
        try {
            Log.info("AutoTest::tick(..) - start");
            if (this.standardExecution === null && this.standardQueue.length() > 0) {
                Log.info("AutoTest::tick(..) - standard queue clear; launching new job");
                const info = this.standardQueue.pop();
                if (info !== null) {
                    this.standardExecution = info;
                    this.invokeContainer(info); // NOTE: not awaiting on purpose (let it finish in the background)!
                }
            }

            if (this.expresssExecution === null && this.expressQueue.length() > 0) {
                Log.info("AutoTest::tick(..) - express queue clear; launching new job");
                const info = this.expressQueue.pop();
                if (info !== null) {
                    this.expresssExecution = info;
                    this.invokeContainer(info); // NOTE: not awaiting on purpose (let it finish in the background)!
                }
            }

            if (this.regressionExecution === null && this.regressionQueue.length() > 0) {
                Log.info("AutoTest::tick(..) - regression queue clear; launching new job");
                const info = this.regressionQueue.pop();
                if (info !== null) {
                    this.regressionExecution = info;
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
        try {
            Log.trace("AutoTest::savePushInfo(..) - commit: " + info.pushInfo.commitSHA);
            await this.dataStore.savePush(info);
        } catch (err) {
            Log.error("AutoTest::savePushInfo(..) - ERROR: " + err);
        }
    }

    /**
     * Saves commentInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {ICommentEvent} info
     */
    private async saveCommentInfo(info: ICommentEvent) {
        try {
            Log.trace("AutoTest::saveCommentInfo(..) - commit: " + info.commitSHA);
            await this.dataStore.saveComment(info);
        } catch (err) {
            Log.error("AutoTest::saveCommentInfo(..) - ERROR: " + err);
        }
    }

    /**
     * Starts the container for the commit.
     *
     *
     * @param input
     */
    private async invokeContainer(input: IContainerInput) {
        try {
            Log.info("AutoTest::invokeContainer(..) - start; commit: " + input.pushInfo.commitSHA);
            const start = Date.now();

            // TODO: make sure we are using the right container
            // const containerId = await this.classPortal.getContainerId(input.courseId,input.delivId);
            // const docker = new MockGrader(input);
            // const record: ICommitRecord = await docker.execute();

            let record: ICommitRecord = null;
            let isProd = true;
            if (input.pushInfo.postbackURL === "EMPTY" || input.pushInfo.postbackURL === "POSTBACK") {
                isProd = false; // EMPTY and POSTBACK used by test environment
            }
            if (isProd === true) {
                const grader = new Grader();
                record = await grader.execute(input);
            } else {
                Log.info("AutoTest::invokeContainer(..) - TEST CONFIG: Running MockGrader");
                const grader = new MockGrader(input);
                record = await grader.execute();
            }

            Log.info("AutoTest::invokeContainer(..) - complete; commit: " + input.pushInfo.commitSHA + "; took: " + Util.took(start));
            await this.handleExecutionComplete(record);
            Log.info("AutoTest::invokeContainer(..) - done; commit: " + input.pushInfo.commitSHA + "; took: " + Util.took(start));
        } catch (err) {
            Log.error("AutoTest::invokeContainer(..) - ERROR for commit: " + input.pushInfo.commitSHA + "; ERROR: " + err);
        }
    }

    /**
     * Gets the current deliverable id
     *
     * @param commitURL
     */
    private async getDelivId(): Promise<string | null> {
        try {
            let str = await this.classPortal.getDefaultDeliverableId(this.courseId);
            if (typeof str === "undefined") {
                str = null;
            }
            return str;
        } catch (err) {
            Log.error("AutoTest::getDelivId() - ERROR: " + err);
        }
    }

    private async getOutputRecord(commitURL: string): Promise<ICommitRecord | null> {
        try {
            const ret = await this.dataStore.getOutputRecord(commitURL);
            return ret;
        } catch (err) {
            Log.error("AutoTest::getOutputRecord() - ERROR: " + err);
        }
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
        try {
            const record: IFeedbackGiven = {
                commitURL,
                courseId,
                delivId,
                timestamp,
                userName,
            };
            await this.dataStore.saveFeedbackGivenRecord(record);
        } catch (err) {
            Log.error("AutoTest::saveFeedbackGiven() - ERROR: " + err);
        }
    }

    /**
     * Return the username that requested the result for the given commitURL (or null)
     *
     * @param commitURL
     */
    private async getRequestor(commitURL: string, delivId: string): Promise<ICommentEvent | null> {
        try {
            const record: ICommentEvent = await this.dataStore.getCommentRecord(commitURL, delivId);
            if (record !== null) {
                return record;
            }
            return null;
        } catch (err) {
            Log.error("AutoTest::getRequestor() - ERROR: " + err);
        }
    }

    /**
     * Returns whether the commitURL is currently executing the given deliverable.
     *
     * @param commitURL
     * @param delivId
     */
    private isCommitExecuting(commitURL: string, delivId: string): boolean {
        try {
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
        } catch (err) {
            Log.error("AutoTest::isCommitExecuting() - ERROR: " + err);
        }
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
        try {
            Log.info("AutoTest::requestFeedbackDelay( " + delivId + ", " + userName + ", " + reqTimestamp + ". - start");
            // async operations up front
            const isStaff = await this.classPortal.isStaff(this.courseId, userName);
            const record: IFeedbackGiven = await this.dataStore.getLatestFeedbackGivenRecord(this.courseId, delivId, userName);
            const details = await this.classPortal.getContainerDetails(this.courseId, delivId); // should cache this
            const testDelay = details.testDelay;

            if (isStaff === true) {
                return null; // staff can always request
            } else {
                if (record === null) {
                    return null; // no prior requests
                } else {
                    const delta = (reqTimestamp - record.timestamp) / 1000;
                    if (delta >= testDelay) {
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
        } catch (err) {
            Log.error("AutoTest::requestFeedbackDelay() - ERROR: " + err);
        }
    }

    /**
     * Checks to see of a commitURL is queued or is currently being executed
     *
     * @param {string} commitURL
     * @returns {boolean}
     */
    private isOnQueue(commitURL: string, delivId: string): boolean {
        let onQueue = false;
        try {
            if (this.standardExecution !== null && this.standardExecution.pushInfo.commitURL === commitURL) {
                onQueue = true;
            } else if (this.expresssExecution !== null && this.expresssExecution.pushInfo.commitURL === commitURL) {
                onQueue = true;
            } else if (this.standardQueue.indexOf(commitURL) >= 0) {
                onQueue = true;
            } else if (this.expressQueue.indexOf(commitURL) >= 0) {
                onQueue = true;
            }
        } catch (err) {
            Log.error("AutoTest::isOnQueue() - ERROR: " + err);
        }
        return onQueue;
    }

    /**
     * Promotes a job to the express queue if it will help it to complete faster.
     *
     * This seems more complicated than it should because we want to recognize being
     * next in line on an non-express queue may be faster than last in line after being
     * promoted to the express queue.
     *
     * @param {ICommentEvent} info
     */
    private promoteIfNeeded(info: ICommentEvent) {
        try {
            if (this.standardQueue.indexOf(info.commitURL) >= 0) {
                // is on the standard queue
                if (this.expressQueue.length() > this.standardQueue.indexOf(info.commitURL)) {
                    // faster to just leave it on the standard queue
                } else {
                    // promote to the express queue
                    const input = this.standardQueue.remove(info.commitURL);
                    if (input !== null) {
                        Log.trace("AutoTest::promoteIfNeeded() - job moved from standard to express queue: " + info.commitSHA);
                        this.expressQueue.push(input);
                    }
                }
            } else if (this.regressionQueue.indexOf(info.commitURL) >= 0) {
                // is on the regression queue
                if (this.expressQueue.length() > this.regressionQueue.indexOf(info.commitURL)) {
                    // faster to just leave it on the regression queue
                } else {
                    // promote to the express queue
                    const input = this.regressionQueue.remove(info.commitURL);
                    if (input !== null) {
                        Log.trace("AutoTest::promoteIfNeeded() - job moved from regression to express queue: " + info.commitSHA);
                        this.expressQueue.push(input);
                    }
                }
            } else {
                // not an error:
                // this happens if we try to promote after a job is done but before the queue is cleared
            }
        } catch (err) {
            Log.error("AutoTest::promoteIfNeeded() - ERROR: " + err);
        }
    }
}
