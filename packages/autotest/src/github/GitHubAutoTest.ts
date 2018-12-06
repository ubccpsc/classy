import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {AutoTestResult, IFeedbackGiven} from "../../../common/types/AutoTestTypes";
import {CommitTarget, ContainerInput} from "../../../common/types/ContainerTypes";

import {
    AutoTestAuthTransport,
    AutoTestConfigTransport,
    AutoTestResultTransport,
    ClassyConfigurationTransport
} from "../../../common/types/PortalTypes";
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
                if (containerConfig !== null) {
                    const input: ContainerInput = {delivId, target: info, containerConfig: containerConfig};
                    this.addToStandardQueue(input);
                    this.tick();
                } else {
                    Log.warn("GitHubAutoTest::handlePushEvent(..) - commit: " + info.commitSHA +
                        " - No container info for delivId: " + delivId + "; push ignored.");
                }
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
            Log.info("GitHubAutoTest::checkCommentPreconditions(..) - info not provided; skipping.");
            return false;
        }

        Log.info("GitHubAutoTest::checkCommentPreconditions(..) - for: " + info.personId + "; commit: " + info.commitSHA);

        if (info.personId === Config.getInstance().getProp(ConfigKey.botName)) {

            if (typeof info.flags !== 'undefined' && info.flags.indexOf("#force") >= 0) {
                Log.info("GitHubAutoTest::checkCommentPreconditions(..) - AutoBot post, but with #force");
            } else {
                Log.info("GitHubAutoTest::checkCommentPreconditions(..) - ignored, comment made by AutoBot");
                return false;
            }
        }

        if (info.botMentioned === false) {
            Log.info("GitHubAutoTest::checkCommentPreconditions(..) - ignored, bot not mentioned");
            return false;
        }

        // update info record
        const delivId = info.delivId;
        const deliv = await this.classPortal.getContainerDetails(delivId);
        if (delivId === null || deliv === null) {
            Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, unknown delivId: " + delivId);
            // no deliverable, give warning and abort
            const msg = "Please specify a deliverable so AutoTest knows what to run against (e.g., #d0).";
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
            return false;
        }

        // TODO: invalid personId

        // TODO: invalid repoId

        // staff can override open/close
        const auth = await this.classPortal.isStaff(info.personId);
        if (auth !== null && (auth.isAdmin === true || auth.isStaff === true)) {
            Log.info("GitHubAutoTest::checkCommentPreconditions(..) - admin request; ignoring openTimestamp and closeTimestamp");
        } else {

            // Log.trace("GitHubAutoTest::checkCommentPreconditions(..) - !admin; info: " + JSON.stringify(info, null, 2));

            // check special flags
            if (typeof info.flags !== 'undefined') {
                if (info.flags.indexOf("#force") >= 0) {
                    Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, student use of #force.");
                    const msg = "Only admins can use the #force flag.";
                    delete info.flags;
                    await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                    return false;
                }
                if (info.flags.indexOf("#silent") >= 0) {
                    Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, student use of #silent.");
                    const msg = "Only admins can use the #silent flag.";
                    delete info.flags;
                    await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                    return false;
                }
            }

            // check timestamps
            if (deliv.openTimestamp > info.timestamp) {
                Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, deliverable not yet open to AutoTest.");
                // not open yet
                const msg = "This deliverable is not yet open for grading.";
                await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                return false;
            }

            if (deliv.closeTimestamp < info.timestamp) {
                Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, deliverable closed to AutoTest.");
                // closed
                const msg = "This deliverable is closed to grading.";
                await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                return false;
            }
        }

        Log.info("GitHubAutoTest::checkCommentPreconditions(..) - valid comment; preconditions accepted");
        return true;
    }

    /**
     * Function exists so it can be replaced by tests as needed.
     *
     * @param {IGitHubMessage} message
     * @returns {Promise<boolean>}
     */
    protected async postToGitHub(info: CommitTarget, message: IGitHubMessage): Promise<boolean> {
        if (typeof info.flags !== 'undefined' && info.flags.indexOf("#silent") >= 0) {
            Log.info("GitHubAutoTest::postToGitHub(..) - #silent specified; NOT posting message to: " + message.url);
        } else {
            Log.info("GitHubAutoTest::postToGitHub(..) - posting message to: " + message.url);
            const gh = new GitHubService();
            return await gh.postMarkdownToGithub(message);
        }
    }

    protected async schedule(info: CommitTarget): Promise<void> {
        Log.info("GitHubAutoTest::schedule(..) - scheduling for: " + info.personId + "; SHA: " + info.commitURL);
        const containerConfig = await this.getContainerConfig(info.delivId);
        if (containerConfig !== null) {
            const input: ContainerInput = {delivId: info.delivId, target: info, containerConfig: containerConfig};
            this.addToStandardQueue(input);
            this.tick();
            Log.info("GitHubAutoTest::schedule(..) - scheduling completed for: " + info.commitURL);
        } else {
            Log.info("GitHubAutoTest::schedule(..) - scheduling skipped for: " + info.commitURL +
                "; no container configuration for: " + info.delivId);
        }
    }

    protected async processComment(info: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        Log.info("GitHubAutoTest::processComment(..) - handling request for user: " +
            info.personId + " for commit: " + info.commitURL);

        if (res !== null) {
            // previously processed
            Log.info("GitHubAutoTest::processComment(..) - result already exists; handling for: " +
                info.personId + "; SHA: " + info.commitSHA);
            const msg = await this.classPortal.formatFeedback(res.output.report);
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
            await this.saveCommentInfo(info);
            if (res.output.postbackOnComplete === false) {
                Log.info("GitHubAutoTest::processComment(..) - result already exists; feedback request logged for: " +
                    info.personId + "; SHA: " + info.commitSHA);
                await this.saveFeedbackGiven(info.delivId, info.personId, info.timestamp, info.commitURL);
            } else {
                // postbackOnComplete should only be true for lint / compile errors; don't saveFeedback (charge) for these
                Log.info("GitHubAutoTest::processComment(..) - result already exists; feedback request skipped for: " +
                    info.personId + "; SHA: " + info.commitSHA);
            }
        } else {
            Log.info("GitHubAutoTest::processComment(..) - result not yet done; handling for: " +
                info.personId + "; SHA: " + info.commitSHA);
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
                    Log.warn("GitHubAutoTest::processComment(..) - push event was not present; adding now. URL: " +
                        info.commitURL + "; for: " + info.personId + "; SHA: " + info.commitSHA);
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
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});

            // jump to head of express queue
            this.promoteIfNeeded(info);
        }
        return;
    }

    protected async handleCommentStudent(info: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        Log.info("GitHubAutoTest::handleCommentStudent(..) - handling student request for: " +
            info.personId + "; deliv: " + info.delivId + "; for commit: " + info.commitURL);

        const feedbackDelay: string | null = await this.requestFeedbackDelay(info.delivId, info.personId, info.timestamp);
        const previousRequest: IFeedbackGiven = await this.dataStore.getFeedbackGivenRecordForCommit(
            info.commitURL, info.delivId, info.personId);

        Log.info("GitHubAutoTest::handleCommentStudent(..) - handling student request for: " +
            info.personId + " for commit: " + info.commitURL + "; null previous: " + (previousRequest === null) +
            "; null delay: " + (feedbackDelay === null));

        if (previousRequest === null && feedbackDelay !== null) {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - too early for: " + info.personId + "; must wait: " +
                feedbackDelay + "; SHA: " + info.commitURL);
            // NOPE, not yet (this is the most common case; feedback requested without time constraints)
            const msg = "You must wait " + feedbackDelay + " before requesting feedback.";
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
        } else if (previousRequest !== null) {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - feedback previously given for: " +
                info.personId + "; deliv: " + info.delivId + "; SHA: " + info.commitURL);
            // feedback given before; same as next case but logging is different
            // processComment will take of whether this is already in progress, etc.
            await this.processComment(info, res);
        } else {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - not too early; for: " + info.personId + "; SHA: " + info.commitURL);
            // no time limitations
            // processComment will take of whether this is already in progress, etc.
            await this.processComment(info, res);
        }
    }

    /**
     *
     * NOTE: This description is from an older version of this method.
     *
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
     */
    public async handleCommentEvent(info: CommitTarget): Promise<boolean> {
        const start = Date.now();

        if (typeof info === 'undefined' || info === null) {
            throw new Error("GitHubAutoTest::handleCommentEvent( .. ) - info is null");
        }

        Log.info("GitHubAutoTest::handleCommentEvent(..) - start; for: " +
            info.personId + "; deliv: " + info.delivId + "; SHA: " + info.commitSHA);

        // sanity check; this keeps the rest of the code much simpler
        const preconditionsMet = await this.checkCommentPreconditions(info);
        if (preconditionsMet === false) {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - preconditions not met; not processing comment further.");
            return false;
        }

        const isStaff: AutoTestAuthTransport = await this.classPortal.isStaff(info.personId);
        const res: AutoTestResultTransport = await this.classPortal.getResult(info.delivId, info.repoId, info.commitSHA);
        if (isStaff !== null && (isStaff.isStaff === true || isStaff.isAdmin === true)) {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - handleAdmin; for: " +
                info.personId + "; deliv: " + info.delivId + "; SHA: " + info.commitSHA);
            if (typeof info.flags !== 'undefined' && info.flags.indexOf("#force") >= 0) {
                Log.info("GitHubAutoTest::handleCommentEvent(..) - handleAdmin; processing with #force");
                await this.processComment(info, null); // do not pass the previous result so a new one will be generated
            } else {
                await this.processComment(info, res);
            }

        } else {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - handleStudent; for: " +
                info.personId + "; deliv: " + info.delivId + "; SHA: " + info.commitSHA);
            await this.handleCommentStudent(info, res);
        }
    }

    protected async processExecution(data: AutoTestResult): Promise<void> {
        try {
            const feedbackRequested: CommitTarget = await this.getRequestor(data.commitURL, data.input.delivId);
            const containerConfig: any = await this.getContainerConfig(data.input.delivId);
            const feedbackMode: string = containerConfig.custom.feedbackMode;
            if (data.output.postbackOnComplete === true) {
                // do this first, doesn't count against quota
                Log.info("GitHubAutoTest::processExecution(..) - postback: true; deliv: " +
                    data.delivId + "; repo: " + data.repoId + "; SHA: " + data.commitSHA);
                const msg = await this.classPortal.formatFeedback(data.output.report, feedbackMode);
                await this.postToGitHub(data.input.target, {url: data.input.target.postbackURL, message: msg});
                // NOTE: if the feedback was requested for this build it shouldn't count
                // since we're not calling saveFeedback this is right
                // but if we replay the commit comments, we would see it there, so be careful
            } else if (feedbackRequested !== null) {
                // feedback has been previously requested
                Log.info("GitHubAutoTest::processExecution(..) - feedback requested; deliv: " +
                    data.delivId + "; repo: " + data.repoId + "; SHA: " + data.commitSHA + '; for: ' + feedbackRequested.personId);
                const msg = await this.classPortal.formatFeedback(data.output.report, feedbackMode);
                await this.postToGitHub(data.input.target, {url: data.input.target.postbackURL, message: msg});
                await this.saveFeedbackGiven(data.input.delivId, feedbackRequested.personId, feedbackRequested.timestamp, data.commitURL);
            } else {
                // do nothing
                Log.info("GitHubAutoTest::processExecution(..) - commit not requested - no feedback given;  deliv: " +
                    data.delivId + "; repo: " + data.repoId + "; SHA: " + data.commitSHA);
            }
        } catch (err) {
            Log.error("GitHubAutoTest::processExecution(..) - ERROR: " + err);
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
                    Log.info("GitHubAutoTest::requestFeedbackDelay(..) - for: " + userName + "; no prior request - no delay");
                    return null; // no prior requests
                } else {
                    const nextTimeslot = record.timestamp + (testDelay * 1000);
                    Log.info("GitHubAutoTest::requestFeedbackDelay(..) - for: " + userName + "; delay: " + testDelay + "; last: " +
                        new Date(record.timestamp).toLocaleTimeString() + "; next: " + new Date(nextTimeslot).toLocaleTimeString());
                    if (reqTimestamp > nextTimeslot) {
                        Log.info("GitHubAutoTest::requestFeedbackDelay(..) - for: " + userName + "; enough time passed; no delay");
                        return null; // enough time has passed
                    } else {
                        const msg = Util.tookHuman(reqTimestamp, nextTimeslot);
                        Log.info("GitHubAutoTest::requestFeedbackDelay(..) - for: " + userName + "; NOT enough time passed; delay: " + msg);
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
            Log.trace("GitHubAutoTest::saveCommentInfo(..) - for: " + info.personId + "; SHA: " + info.commitSHA);
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
            const config: ClassyConfigurationTransport = await this.classPortal.getConfiguration();
            Log.trace("GitHubAutoTest::getDelivId() - response: " + JSON.stringify(config));
            if (config !== null && typeof config.defaultDeliverable !== "undefined") {
                return config.defaultDeliverable;
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
