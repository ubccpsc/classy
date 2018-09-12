import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

import {CommitTarget, IAutoTestResult, IContainerInput, IFeedbackGiven} from "../../../common/types/AutoTestTypes";
import {AutoTestAuthTransport, AutoTestConfigTransport, AutoTestResultTransport} from "../../../common/types/PortalTypes";
import Util from "../../../common/Util";
import {AutoTest} from "../autotest/AutoTest";

import {IClassPortal} from "../autotest/ClassPortal";
import {IDataStore} from "../autotest/DataStore";
import {GitHubService, IGitHubMessage} from "./GitHubService";

export interface IGitHubTestManager {

    /**
     * Handles a push event from GitHub. Will place job on queue.
     *
     * @param {IPushEvent} push
     */
    handlePushEvent(push: CommitTarget): void;

    /**
     * Handle a comment event from GitHub. Will promote job to
     * express queue if appropriate. When job is complete, it will
     * comment back automatically for the user.
     *
     * @param {ICommentEvent} comment
     */
    handleCommentEvent(comment: CommitTarget): void;
}

export class GitHubAutoTest extends AutoTest implements IGitHubTestManager {

    // private github: IGitHubService = null;

    constructor(dataStore: IDataStore, portal: IClassPortal) {
        super(dataStore, portal);
        // this.github = github;
    }

    /**
     * Handles push events from Github.
     *
     * Persists the event so it can be restarted later if needed.
     * Schedules the build on the standard queue.
     *
     * @param info
     * @param delivId
     */
    public async handlePushEvent(info: CommitTarget, delivId?: string): Promise<boolean> {
        try {
            if (typeof info === "undefined" || info === null) {
                Log.info("GitHubAutoTest::handlePushEvent(..) - info not provided; skipping.");
                return false;
            }

            Log.info("GitHubAutoTest::handlePushEvent(..) - start; commit: " + info.commitSHA);
            const start = Date.now();
            await this.savePushInfo(info);

            if (typeof delivId === "undefined" || delivId === null) {
                delivId = await this.getDelivId(); // current default deliverable
            }

            if (delivId !== null) {
                const containerConfig = await this.getContainerConfig(delivId);
                const input: IContainerInput = {delivId, pushInfo: info, containerConfig: containerConfig};
                this.addToStandardQueue(input);
                this.tick();
            } else {
                // no active deliverable, ignore this push event (don't push an error either)
                Log.warn("GitHubAutoTest::handlePushEvent(..) - commit: " + info.commitSHA + " - No active deliverable; push ignored.");
            }
            Log.info("GitHubAutoTest::handlePushEvent(..) - done; commit: " + info.commitSHA + "; took: " + Util.took(start));
            return true;
        } catch (err) {
            Log.error("GitHubAutoTest::handlePushEvent(..) - ERROR: " + err.message);
            throw err;
        }
    }

    /**
     *
     * @param {ICommentEvent} info
     * @returns {boolean} true if the preconditions are met; false otherwise
     */
    private async checkCommentPreconditions(info: CommitTarget): Promise<boolean> {
        if (typeof info === "undefined" || info === null) {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - info not provided; skipping.");
            return false;
        }

        Log.info("GitHubAutoTest::handleCommentEvent(..) - start; commit: " + info.commitSHA + "; user: " + info.personId);

        if (info.personId === Config.getInstance().getProp(ConfigKey.botName)) {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - ignored, comment made by AutoBot");
            return false;
        }

        if (info.botMentioned === false) {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - ignored, bot not mentioned");
            return false;
        }

        // update info record
        const delivId = info.delivId;

        if (delivId === null) {
            // no deliverable, give warning and abort
            const msg = "Please specify a deliverable so AutoTest knows what to run against (e.g., #d0).";
            await this.postToGitHub({url: info.postbackURL, message: msg});
            return false;
        }

        // TODO: invalid delivId

        // TODO: invalid personId

        // TODO: invalid repoId

        return true;
    }

    /**
     * Function exists so it can be replaced by tests as needed.
     *
     * @param {IGitHubMessage} message
     * @returns {Promise<boolean>}
     */
    protected async postToGitHub(message: IGitHubMessage): Promise<boolean> {
        Log.info("GitHubAutoTest::postToGitHub(..) - posting message to: " + message.url);
        const gh = new GitHubService();
        return await gh.postMarkdownToGithub(message);
    }

    protected async schedule(info: CommitTarget): Promise<void> {
        Log.info("GitHubAutoTest::schedule(..) - scheduling for: " + info.commitURL);
        const containerConfig = await this.getContainerConfig(info.delivId);
        const input: IContainerInput = {delivId: info.delivId, pushInfo: info, containerConfig: containerConfig};
        this.addToStandardQueue(input);
        this.tick();
        Log.info("GitHubAutoTest::schedule(..) - scheduling completed for: " + info.commitURL);
    }

    protected async processComment(info: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        Log.info("GitHubAutoTest::processComment(..) - handling request for user: " +
            info.personId + " for commit: " + info.commitURL);

        if (res !== null) {
            // previously processed
            // STUDENT: need to guard this if they shouldn't be getting feeback yet
            Log.info("GitHubAutoTest::processComment(..) - result already exists; handling");
            await this.postToGitHub({url: info.postbackURL, message: res.output.report.feedback});
            await this.saveFeedbackGiven(info.delivId, info.personId, info.timestamp, info.commitURL);
            await this.saveCommentInfo(info);
        } else {
            // not yet processed
            const onQueue = this.isOnQueue(info.commitURL, info.delivId);
            let msg = '';
            if (onQueue === true) {
                msg = "This commit is still queued for processing against " + info.delivId + ".";
                msg += " Your results will be posted here as soon as they are ready.";
                // TODO: promote to head of express queue
            } else {
                const pe = await this.dataStore.getPushRecord(info.commitURL);
                if (pe === null) {
                    Log.warn("GitHubAutoTest::processComment(..) - push event was not present; adding now. URL: " + info.commitURL);
                    // store this pushevent for consistency in case we need it for anything else later
                    await this.dataStore.savePush(info); // NEXT: add cloneURL to commentEvent (should be in github payload)
                }
                // NOTE: we aren't considering the pushEvent anymore?
                msg = "This commit has been queued for processing against " + info.delivId + ".";
                msg += " Your results will be posted here as soon as they are ready.";
                // STUDENT: need to guard this
                await this.schedule(info);
            }
            await this.saveCommentInfo(info); // whether TA or staff
            await this.postToGitHub({url: info.postbackURL, message: msg});

            // jump to head of express queue
            this.promoteIfNeeded(info);
        }
        return;
    }

    protected async handleCommentStudent(info: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        Log.info("GitHubAutoTest::handleCommentStudent(..) - handling student request for user: " +
            info.personId + " for commit: " + info.commitURL);

        const requestFeedbackDelay: string | null = await this.requestFeedbackDelay(info.delivId, info.personId, info.timestamp);
        const hasBeenRequestedBefore: IFeedbackGiven =
            await this.dataStore.getFeedbackGivenRecordForCommit(info.commitURL, info.personId);

        if (hasBeenRequestedBefore === null && requestFeedbackDelay !== null) {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - too early; wait: " +
                requestFeedbackDelay + " for: " + info.commitURL);
            // this is the most common case
            // NOPE, not yet
            const msg = "You must wait " + requestFeedbackDelay + " before requesting feedback.";
            await this.postToGitHub({url: info.postbackURL, message: msg});
            return;
        } else {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - process request for: " + info.commitURL);
            await this.processComment(info, res);
        }
    }

    public async handleCommentEvent(info: CommitTarget): Promise<boolean> {
        const start = Date.now();

        const preconditionsMet = await this.checkCommentPreconditions(info);
        if (preconditionsMet === false) {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - preconditions not met; not processing comment further.");
            return false;
        }

        const delivId = info.delivId; // TODO: i

        const isCurrentlyRunning: boolean = this.isCommitExecuting(info.commitURL, delivId);
        if (isCurrentlyRunning === true) {
            // already being processed; POST and return (cannot speed this up)
            let msg = "This commit is still queued for processing against " + delivId + ".";
            msg += " Your results will be posted here as soon as they are ready.";

            await this.saveCommentInfo(info); // whether TA or staff
            await this.postToGitHub({url: info.postbackURL, message: msg});
            return;
        }

        const isStaff: AutoTestAuthTransport = await this.classPortal.isStaff(info.personId); // async
        const res: AutoTestResultTransport = await this.classPortal.getResult(delivId, info.repoId, info.commitSHA);
        if (isStaff !== null && (isStaff.isStaff === true || isStaff.isAdmin === true)) {
            await this.processComment(info, res);
        } else {
            await this.handleCommentStudent(info, res);
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
     * TODO: need to think a bit harder about which comment events should be saved and which should be dropped
     *
     * @param info
     */
    public async handleCommentEventOLD(info: CommitTarget): Promise<boolean> {
        try {
            const start = Date.now();

            if (typeof info === "undefined" || info === null) {
                Log.info("GitHubAutoTest::handleCommentEvent(..) - info not provided; skipping.");
                return false;
            }

            Log.info("GitHubAutoTest::handleCommentEvent(..) - start; commit: " + info.commitSHA + "; user: " + info.personId);

            if (info.personId === Config.getInstance().getProp(ConfigKey.botName)) {
                Log.info("GitHubAutoTest::handleCommentEvent(..) - ignored, comment made by AutoBot");
                return true;
            }

            if (info.botMentioned === false) {
                Log.info("GitHubAutoTest::handleCommentEvent(..) - ignored, bot not mentioned");
                return true;
            }

            // update info record
            const delivId = info.delivId;

            if (delivId === null) {
                // no deliverable, give warning and abort
                const msg = "Please specify a deliverable so AutoTest knows what to run against (e.g., #d0).";
                await this.postToGitHub({url: info.postbackURL, message: msg});
                return true;
            }

            // front load the async operations, even if it means we do some operations unnecessarily; thse could be done in parallel
            const isStaff: AutoTestAuthTransport = await this.classPortal.isStaff(info.personId); // async
            const requestFeedbackDelay: string | null = await this.requestFeedbackDelay(delivId, info.personId, info.timestamp);
            // students often request grades they have previously 'paid' for
            const hasBeenRequestedBefore: IFeedbackGiven =
                await this.dataStore.getFeedbackGivenRecordForCommit(info.commitURL, info.personId);
            const res: AutoTestResultTransport = await this.classPortal.getResult(delivId, info.repoId, info.commitSHA);
            const isCurrentlyRunning: boolean = this.isCommitExecuting(info.commitURL, delivId);
            Log.trace("GitHubAutoTest::handleCommentEvent(..) - isStaff: " + isStaff + "; delay: " +
                requestFeedbackDelay + "; res: " + res + "; running?: " + isCurrentlyRunning);

            let shouldPost = false; // should the result be given
            if (isStaff !== null && (isStaff.isAdmin === true || isStaff.isStaff === true)) {
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
                        await this.postToGitHub({url: info.postbackURL, message: msg});
                    } else {
                        // they have been given feedback within the window, but on this commit.
                        // so we might as well give it to them. asking for this doesn't make sense,
                        // but happens with remarkable frequency, so just give them their results back again
                        shouldPost = true;
                    }
                }
            }

            if (res !== null && res.commitSHA === info.commitSHA) {
                // execution has been completed so there is feedback ready to give
                Log.trace("GitHubAutoTest::handleCommentEvent(..) - commit: " + info.commitSHA + "; execution complete");
                // true if staff, requested before, or over feedback delay interval
                if (shouldPost === true) {
                    await this.postToGitHub({url: info.postbackURL, message: res.output.report.feedback});
                    await this.saveFeedbackGiven(delivId, info.personId, info.timestamp, info.commitURL);
                    await this.saveCommentInfo(info); // user or TA; only for analytics since feedback has been given
                }
            } else {
                // execution not yet complete
                Log.info("GitHubAutoTest::handleCommentEvent(..) - commit: " + info.commitSHA + "; execution not yet complete");
                if (shouldPost === true) {
                    // NOTE: it _should_ be on the standard queue here, but if it isn't, could we add it, just to be safe?
                    const onQueue = this.isOnQueue(info.commitURL, info.delivId);
                    let msg = "This commit is still queued for processing against " + delivId + ".";
                    msg += " Your results will be posted here as soon as they are ready.";
                    if (onQueue === false) {
                        const pe = await this.dataStore.getPushRecord(info.commitURL);
                        if (pe !== null) {
                            Log.info("GitHubAutoTest::handleCommentEvent(..) - commit: " + info.commitSHA +
                                "; - element not on queue; adding.");
                            await this.handlePushEvent(pe, info.delivId);
                        } else {
                            Log.warn("GitHubAutoTest::handleCommentEvent(..) - commit: " + info.commitSHA +
                                "; - element not on queue; cannot find push event.");
                            msg = "This commit is has not been queued; please make and push a new commit.";
                        }
                    }
                    await this.saveCommentInfo(info); // whether TA or staff
                    await this.postToGitHub({url: info.postbackURL, message: msg});
                } else {
                    // should we do something if shouldPost is false?
                }

                this.promoteIfNeeded(info);
            }

            // everything is ready; run the clock
            this.tick();

            Log.info("GitHubAutoTest::handleCommentEvent(..) - done; commit: " + info.commitSHA + "; took: " + Util.took(start));
            return true;
        } catch (err) {
            Log.error("GitHubAutoTestTest::handleCommentEvent(..) - ERROR: " + err.message);
            throw err;
        }
    }

    protected async processExecution(data: IAutoTestResult): Promise<void> {
        try {
            const pushRequested: CommitTarget = await this.getRequestor(data.commitURL, data.input.delivId);
            if (data.output.postbackOnComplete === true) {
                // do this first, doesn't count against quota
                Log.info("GitHubAutoTest::processExecution(..) - postback: true");
                await this.postToGitHub({url: data.input.pushInfo.postbackURL, message: data.output.report.feedback});
                // NOTE: if the feedback was requested for this build it shouldn't count
                // since we're not calling saveFeedback this is right
                // but if we replay the commit comments, we would see it there, so be careful
            } else if (pushRequested !== null) {
                // feedback has been previously requested
                Log.info("GitHubAutoTest::processExecution(..) - feedback requested");
                await this.postToGitHub({url: data.input.pushInfo.postbackURL, message: data.output.report.feedback});
                await this.saveFeedbackGiven(data.input.delivId, pushRequested.personId, pushRequested.timestamp, data.commitURL);
            } else {
                // do nothing
                Log.info("GitHubAutoTest::processExecution(..) - commit not requested - no feedback given; commit: " + data.commitSHA);
            }
        } catch (err) {
            Log.info("GitHubAutoTest::processExecution(..) - ERROR: " + err);
            return; // do not let errors escape
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
            Log.info("GitHubAutoTest::requestFeedbackDelay( " + delivId + ", " + userName + ", " + reqTimestamp + " ) - start");
            // async operations up front
            const isStaff: AutoTestAuthTransport = await this.classPortal.isStaff(userName);
            const record: IFeedbackGiven = await this.dataStore.getLatestFeedbackGivenRecord(delivId, userName);
            const details: AutoTestConfigTransport = await this.classPortal.getContainerDetails(delivId); // should cache this
            let testDelay = 0;
            if (details !== null) {
                testDelay = details.studentDelay;
            }

            Log.trace("GitHubAutoTest::requestFeedbackDelay(..) - testDelay: " + testDelay);

            if (isStaff !== null && (isStaff.isAdmin === true || isStaff.isStaff === true)) {
                Log.info("GitHubAutoTest::requestFeedbackDelay(..) - staff; no delay");
                return null; // staff can always request
            } else {
                if (record === null) {
                    Log.info("GitHubAutoTest::requestFeedbackDelay(..) - no prior request; no delay");
                    return null; // no prior requests
                } else {
                    const nextTimeslot = record.timestamp + (testDelay * 1000);
                    Log.info("GitHubAutoTest::requestFeedbackDelay(..) - delay: " + testDelay + "; last: " +
                        new Date(record.timestamp).toLocaleTimeString() + "; next: " + new Date(nextTimeslot).toLocaleTimeString());
                    if (reqTimestamp > nextTimeslot) {
                        Log.info("GitHubAutoTest::requestFeedbackDelay(..) - enough time passed; no delay");
                        return null; // enough time has passed
                    } else {
                        const msg = Util.tookHuman(reqTimestamp, nextTimeslot);
                        Log.info("GitHubAutoTest::requestFeedbackDelay(..) - NOT enough time passed; delay: " + msg);
                        return msg;
                    }
                }
            }
        } catch (err) {
            Log.error("GitHubAutoTest::requestFeedbackDelay() - ERROR: " + err);
        }
    }

    /**
     * Saves pushInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {IContainerInput} info
     */
    private async savePushInfo(info: CommitTarget) {
        try {
            Log.trace("GitHubAutoTest::savePushInfo(..) - commit: " + info.commitSHA);
            await this.dataStore.savePush(info);
        } catch (err) {
            Log.error("GitHubAutoTest::savePushInfo(..) - ERROR: " + err);
        }
    }

    /**
     * Saves commentInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {CommitTarget} info
     */
    private async saveCommentInfo(info: CommitTarget) {
        try {
            Log.trace("GitHubAutoTest::saveCommentInfo(..) - commit: " + info.commitSHA);
            await this.dataStore.saveComment(info);
        } catch (err) {
            Log.error("GitHubAutoTest::saveCommentInfo(..) - ERROR: " + err);
        }
    }

    /**
     * Gets the current deliverable id
     */
    private async getDelivId(): Promise<string | null> {
        Log.trace("GitHubAutoTest::getDelivId() - start");
        try {
            const str = await this.classPortal.getDefaultDeliverableId();
            Log.trace("GitHubAutoTest::getDelivId() - RESPONSE: " + str);
            if (str !== null && typeof str.defaultDeliverable !== "undefined") {
                return str.defaultDeliverable;
            }
        } catch (err) {
            Log.error("GitHubAutoTest::getDelivId() - ERROR: " + err);
        }
        return null;
    }

    /**
     * Gets the container details for this deliverable
     */
    private async getContainerConfig(delivId: string): Promise<AutoTestConfigTransport | null> {
        Log.trace("GitHubAutoTest::getContainerConfig() - start");
        try {
            const details = await this.classPortal.getContainerDetails(delivId);
            Log.trace("GitHubAutoTest::getContainerConfig() - RESPONSE: " + JSON.stringify(details));
            return details;
        } catch (err) {
            Log.error("GitHubAutoTest::getContainerConfig() - ERROR: " + err);
        }
    }

    /**
     * Tracks that feedback was given for the specified user at the specified time.
     *
     * @param delivId
     * @param userName
     * @param timestamp
     * @param commitURL
     */
    private async saveFeedbackGiven(delivId: string, userName: string, timestamp: number, commitURL: string): Promise<void> {
        try {
            const record: IFeedbackGiven = {
                commitURL,
                delivId,
                timestamp,
                personId: userName
            };
            await this.dataStore.saveFeedbackGivenRecord(record);
        } catch (err) {
            Log.error("GitHubAutoTest::saveFeedbackGiven() - ERROR: " + err);
        }
    }

    /**
     * Return the username that requested the result for the given commitURL (or null)
     *
     * @param commitURL
     * @param delivId
     */
    private async getRequestor(commitURL: string, delivId: string): Promise<CommitTarget | null> {
        try {
            const record: CommitTarget = await this.dataStore.getCommentRecord(commitURL, delivId);
            if (record !== null) {
                return record;
            }
            return null;
        } catch (err) {
            Log.error("GitHubAutoTest::getRequestor() - ERROR: " + err);
        }
    }
}
