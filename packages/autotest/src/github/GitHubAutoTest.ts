import * as Docker from "dockerode";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {AutoTestResult, IFeedbackGiven} from "@common/types/AutoTestTypes";
import {CommitTarget, ContainerInput} from "@common/types/ContainerTypes";
import {
    AutoTestAuthTransport,
    AutoTestConfigTransport,
    AutoTestResultTransport,
    ClassyConfigurationTransport
} from "@common/types/PortalTypes";
import Util from "@common/Util";

import {AutoTest} from "@autotest/autotest/AutoTest";
import {IClassPortal} from "@autotest/autotest/ClassPortal";
import {IDataStore} from "@autotest/autotest/DataStore";
import {GitHubUtil, IGitHubMessage} from "./GitHubUtil";

export interface IGitHubTestManager {

    /**
     * Handles a push event from GitHub. Will place job on queue.
     *
     * @param {CommitTarget} push
     */
    handlePushEvent(push: CommitTarget): void;

    /**
     * Handle a comment event from GitHub. Will promote job to
     * express queue if appropriate. When job is complete, it will
     * comment back automatically for the user.
     *
     * @param {CommitTarget} comment
     */
    handleCommentEvent(comment: CommitTarget): void;
}

export class GitHubAutoTest extends AutoTest implements IGitHubTestManager {

    constructor(dataStore: IDataStore, portal: IClassPortal, docker: Docker) {
        super(dataStore, portal, docker);
    }

    /**
     * Handles push events from GitHub.
     *
     * Persists the event, so it can be restarted later if needed.
     *
     * Schedules the build on the standard queue if there is a default deliverable, and it is open.
     *
     * @param {CommitTarget} info
     * @param {string} delivId
     */
    public async handlePushEvent(info: CommitTarget, delivId?: string): Promise<boolean> {
        try {
            if (typeof info === "undefined" || info === null) {
                Log.info("GitHubAutoTest::handlePushEvent(..) - info not provided; skipping.");
                return false;
            }

            const org = Config.getInstance().getProp(ConfigKey.org);
            Log.info("GitHubAutoTest::handlePushEvent(..) - org: " + org + "; push org: " + info.orgId);
            if (typeof org !== "undefined" && typeof info.orgId !== "undefined" && org !== info.orgId) {
                Log.warn("GitHubAutoTest::handlePushEvent(..) - ignored, org: " + info.orgId +
                    " does not match current course: " + org);
                return false;
            }

            Log.info("GitHubAutoTest::handlePushEvent(..) - start; commit: " + info.commitSHA);
            const start = Date.now();
            await this.savePushInfo(info);

            if (typeof delivId === "undefined" || delivId === null) {
                Log.info("GitHubAutoTest::handlePushEvent(..) - delivId not specified; requesting");
                delivId = await this.getDelivId(); // current default deliverable
                Log.info("GitHubAutoTest::handlePushEvent(..) - delivId not specified; retrieved: " +
                    delivId + "; type: " + typeof delivId);

                if (delivId === "null") {
                    // delivId should be null if null, not "null"; force this flag if this is the case
                    delivId = null;
                }
            }

            if (delivId !== null) {
                const deliv = await this.classPortal.getContainerDetails(delivId);
                if (deliv === null) {
                    Log.info("GitHubAutoTest::handlePushEvent(..) - not scheduled; no default deliverable");
                    return false;
                }

                if (deliv.closeTimestamp < info.timestamp && deliv.lateAutoTest === false) {
                    Log.info("GitHubAutoTest::handlePushEvent(..) - not scheduled; deliv is closed to grading");
                    return false;
                }

                const containerConfig = await this.classPortal.getContainerDetails(delivId);
                if (containerConfig !== null) {
                    const input: ContainerInput = {delivId, target: info, containerConfig};
                    this.addToStandardQueue(input);

                    const shouldPromotePush = await this.classPortal.shouldPromotePush(info);
                    if (shouldPromotePush === true) {
                        Log.info(`GitHubAutoTest::handlePushEvent(${info.commitSHA}) - Promoting to express queue`);
                        this.addToExpressQueue(input);
                    } else {
                        this.addToStandardQueue(input);
                    }

                    if (Array.isArray(deliv.regressionDelivIds) && deliv.regressionDelivIds.length > 0) {
                        for (const regressionId of deliv.regressionDelivIds) {
                            const regressionDetails = await this.classPortal.getContainerDetails(regressionId);
                            if (regressionDetails !== null) {
                                const regressionInfo: CommitTarget = JSON.parse(JSON.stringify(info)); // ensure we have a copy
                                regressionInfo.delivId = regressionId;

                                if (typeof regressionInfo.flags === "undefined" || Array.isArray(regressionInfo.flags) === false) {
                                    regressionInfo.flags = [];
                                }
                                // This was problematic because timeouts would not postback
                                // regressionInfo.flags.push("#silent"); // avoid posting back regression feedback

                                const regressionInput: ContainerInput = {
                                    delivId: regressionId,
                                    target: regressionInfo,
                                    containerConfig: regressionDetails
                                };

                                Log.info("GitHubAutoTest::handlePushEvent(..) - scheduling regressionId: " + regressionId);
                                Log.trace("GitHubAutoTest::handlePushEvent(..) - scheduling regressionId: " + regressionId +
                                    "; input: " + JSON.stringify(regressionInput));

                                this.addToLowQueue(regressionInput);
                            }
                        }
                    }

                    this.tick();
                    Log.info("GitHubAutoTest::handlePushEvent(..) - done; commit: " + info.commitSHA + "; took: " + Util.took(start));
                    return true;
                } else {
                    Log.warn("GitHubAutoTest::handlePushEvent(..) - commit: " + info.commitSHA +
                        " - No container info for delivId: " + delivId + "; push ignored");
                    return false;
                }
            } else {
                // no active deliverable, ignore this push event (do not push an error either)
                Log.warn("GitHubAutoTest::handlePushEvent(..) - commit: " + info.commitSHA + " - No active deliverable; push ignored.");
                return false;
            }
        } catch (err) {
            Log.error("GitHubAutoTest::handlePushEvent(..) - ERROR: " + err.message);
            throw err;
        }
    }

    /**
     *
     * @param {CommitTarget} info
     * @returns {boolean} true if the preconditions are met; false otherwise
     */
    private async checkCommentPreconditions(info: CommitTarget): Promise<boolean> {

        // ignore commits that do not exist
        if (typeof info === "undefined" || info === null) {
            Log.info("GitHubAutoTest::checkCommentPreconditions(..) - info not provided; skipping");
            return false;
        }

        Log.info("GitHubAutoTest::checkCommentPreconditions(..) - for: " + info.personId + "; commit: " + info.commitSHA);

        // ignore messages made by the bot, unless they are #force
        if (info.personId === Config.getInstance().getProp(ConfigKey.botName)) {

            if (typeof info.flags !== "undefined" && info.flags.indexOf("#force") >= 0) {
                Log.info("GitHubAutoTest::checkCommentPreconditions(..) - AutoBot post, but with #force");
            } else {
                Log.info("GitHubAutoTest::checkCommentPreconditions(..) - ignored, comment made by AutoBot");
                return false;
            }
        }

        // ignore messages that do not @mention the bot
        if (info.botMentioned === false) {
            Log.info("GitHubAutoTest::checkCommentPreconditions(..) - ignored, bot not mentioned");
            return false;
        }

        // ignore messages that do not request grading on a specific deliverable
        const delivId = info.delivId;
        if (delivId === null) {
            Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, null delivId");
            // no deliverable, give warning and abort
            const msg = "Please specify a deliverable so AutoTest knows what to run against (e.g., #c0).";
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
            return false;
        }

        // ignore messages that do not request grading on a deliverable that is configured for autotest
        const deliv = await this.classPortal.getContainerDetails(delivId);
        if (deliv === null) {
            Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, unknown delivId: " + delivId);
            // no deliverable, give warning and abort
            const msg = "Please specify a deliverable so AutoTest knows what to run against (e.g., #c0).";
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
            return false;
        }

        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("GitHubAutoTest::checkCommentPreconditions(..) - org: " + org + "; comment org: " + info.orgId);
        if (typeof org !== "undefined" && typeof info.orgId !== "undefined" && org !== info.orgId) {
            Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, org: " + info.orgId +
                " does not match current course: " + org);

            // no deliverable, give warning and abort
            const msg = "This commit appears to be from a prior version of the course; AutoTest request cancelled.";
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
            return false;
        }

        // TODO: invalid personId

        // TODO: invalid repoId

        // verify constraints, but ignore them for staff and admins
        const auth = await this.classPortal.isStaff(info.personId);
        if (auth !== null && (auth.isAdmin === true || auth.isStaff === true)) {
            Log.info("GitHubAutoTest::checkCommentPreconditions(..) - admin request; ignoring openTimestamp and closeTimestamp");
        } else {

            if (typeof info.flags !== "undefined") {
                // reject #force requests by requesters who are not admins or staff
                if (info.flags.indexOf("#force") >= 0) {
                    Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, student use of #force");
                    const msg = "Only admins can use the #force flag.";
                    delete info.flags;
                    await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                    return false;
                }

                // reject #silent requests by requesters that are not admins or staff
                if (info.flags.indexOf("#silent") >= 0) {
                    Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, student use of #silent");
                    const msg = "Only admins can use the #silent flag.";
                    delete info.flags;
                    await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                    return false;
                }
            }

            // reject requests for executing deliverables that are not yet open
            if (deliv.openTimestamp > info.timestamp) {
                Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, deliverable not yet open to AutoTest");
                // not open yet
                const msg = "This deliverable is not yet open for grading.";
                await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                return false;
            }

            // reject requests for executing deliverables that are closed, unless the deliverable is configured for late autotest
            if (deliv.closeTimestamp < info.timestamp && deliv.lateAutoTest === false) {
                Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, deliverable has been closed to AutoTest");
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
     * Function exists as stub for custom course modification of feedback before returning.
     *
     * @param {CommitTarget} target
     * @param {IGitHubMessage} message
     * @returns {Promise<boolean>}
     */
    protected async postToGitHub(target: CommitTarget, message: IGitHubMessage): Promise<boolean> {
        if (typeof target.flags !== "undefined" && target.flags.indexOf("#silent") >= 0) {
            Log.info("GitHubAutoTest::postToGitHub(..) - #silent specified; NOT posting message; repo: " + target.repoId);
        } else {
            Log.info("GitHubAutoTest::postToGitHub(..) - posting; repo: " + target.repoId +
                "; deliv: " + target.delivId + "; SHA: " + Util.shaHuman(target.commitSHA));
            Log.trace("GitHubAutoTest::postToGitHub(..) - target: " + JSON.stringify(target));
            Log.trace("GitHubAutoTest::postToGitHub(..) - message: " + JSON.stringify(message));
            return await GitHubUtil.postMarkdownToGithub(message);
        }
    }

    protected async processComment(info: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        if (res === null) {
            return this.processCommentNew(info);
        } else {
            return this.processCommentExists(info, res);
        }
    }

    protected async processCommentExists(info: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        // previously processed
        Log.info("GitHubAutoTest::processCommentExists(..) - handling request for: " +
            info.personId + "; delivId: " + info.delivId + "; commit: " + info.commitURL);

        // const containerDetails = await this.classPortal.getContainerDetails(res.delivId);

        const msg = await this.classPortal.formatFeedback(res);
        await this.postToGitHub(info, {url: info.postbackURL, message: msg});
        await this.saveCommentInfo(info);
        if (res.output.postbackOnComplete === false) {
            const previousFeedback = await this.dataStore.getFeedbackGivenRecordForCommit(info);
            if (previousFeedback === null) {
                // new request, charge for feedback given
                await this.saveFeedbackGiven(info.delivId, info.personId, info.timestamp, info.commitURL, "standard");

                if (res.input.target.personId !== info.personId) {
                    // NOTE: at this point we will have a result that finished computing before it was requested
                    // so the result.target field will be from the push and not the comment.
                    res.input.target.botMentioned = info.botMentioned;
                    res.input.target.personId = info.personId;
                    res.input.target.kind = "standard"; // was push from the original request
                    Log.info("GitHubAutoTest::processCommentExists(..) - updating target for: " +
                        res.commitURL + " to: " + JSON.stringify(res.input.target));
                    await this.classPortal.sendResult(res);
                } else {
                    Log.info("GitHubAutoTest::processCommentExists(..) - updating target not needed for: " + res.commitURL);
                }
            } else {
                // previously paid, do not charge
                Log.info("GitHubAutoTest::processCommentExists(..) - result already exists and paid for for: " +
                    info.personId + "; SHA: " + Util.shaHuman(info.commitSHA));
            }
        } else {
            // postbackOnComplete should only be true for lint / compile errors; do not saveFeedback (charge) for these
            Log.info("GitHubAutoTest::processCommentExists(..) - result already exists; feedback request skipped for: " +
                info.personId + "; SHA: " + Util.shaHuman(info.commitSHA));
        }
        return;
    }

    protected async processCommentNew(info: CommitTarget): Promise<void> {
        Log.info("GitHubAutoTest::processCommentNew(..) - handling request for user: " +
            info.personId + " for commit: " + info.commitURL);

        Log.info("GitHubAutoTest::processCommentNew(..) - result not yet done; handling for: " +
            info.personId + "; SHA: " + Util.shaHuman(info.commitSHA));

        const containerConfig = await this.classPortal.getContainerDetails(info.delivId);
        if (containerConfig !== null) {
            const input: ContainerInput = {delivId: info.delivId, target: info, containerConfig};

            // not yet processed
            const onQueue = this.isOnQueue(input);
            let msg = "";
            if (onQueue === true) {
                msg = "This commit is still queued for processing against " + info.delivId + ".";
                msg += " Your results will be posted here as soon as they are ready.";
            } else {
                const pe = await this.dataStore.getPushRecord(info.commitURL);
                if (pe === null) {
                    Log.warn("GitHubAutoTest::processCommentNew(..) - push event was not present; adding now. URL: " +
                        info.commitURL + "; for: " + info.personId + "; SHA: " + info.commitSHA);
                    // store this push event for consistency in case we need it for anything else later
                    await this.dataStore.savePush(info); // NEXT: add cloneURL to commentEvent (should be in github payload)
                }
                msg = "This commit has been queued for processing against " + info.delivId + ".";
                msg += " Your results will be posted here as soon as they are ready.";
            }
            await this.saveCommentInfo(info);
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});

            // student request events always go on the express queue
            this.addToExpressQueue(input);
        } else {
            Log.warn("GitHubAutoTest::processCommentNew(..) - null container config deliv: " + info.delivId);
        }
        return;
    }

    /**
     * Student scheduling requests.
     *
     * @param {CommitTarget} target
     * @param {AutoTestResultTransport} res
     * @protected
     */
    protected async handleCommentStudent(target: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        Log.info("GitHubAutoTest::handleCommentStudent(..) - handling student request for: " +
            target.personId + "; deliv: " + target.delivId + "; for commit: " + target.commitURL);

        const shouldCharge = await this.shouldCharge(target, null, res);
        const feedbackDelay: string | null = await this.requestFeedbackDelay(target.delivId, target.personId, target.timestamp);
        const previousRequest: IFeedbackGiven = await this.dataStore.getFeedbackGivenRecordForCommit(target);

        Log.info("GitHubAutoTest::handleCommentStudent(..) - handling student request for: " +
            target.personId + " for commit: " + target.commitURL + "; null previous: " + (previousRequest === null) +
            "; null delay: " + (feedbackDelay === null));

        if (shouldCharge === true && previousRequest === null && feedbackDelay !== null) {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - too early for: " + target.personId + "; must wait: " +
                feedbackDelay + "; SHA: " + Util.shaHuman(target.commitURL));
            // NOPE, not yet (this is the most common case; feedback requested without time constraints)
            const msg = "You must wait " + feedbackDelay + " before requesting feedback.";
            await this.postToGitHub(target, {url: target.postbackURL, message: msg});
        } else if (previousRequest !== null) {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - feedback previously given for: " +
                target.personId + "; deliv: " + target.delivId + "; SHA: " + Util.shaHuman(target.commitURL));
            // feedback given before; same as next case but logging is different
            // processComment will take of whether this is already in progress, etc.
            await this.processComment(target, res);
            // } else if (target.flags.includes("#check")) {
            // NOTE: this was not the real code, I was trying to figure out where this should be
            //     Log.target("GitHubAutoTest::handleCommentStudent(..) - handling #check");
            //     await this.handleCheck(target, res);
        } else {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - not too early; for: " +
                target.personId + "; SHA: " + Util.shaHuman(target.commitURL));
            // no time limitations. Because of this, queueing is the same as submitting now.
            // processComment will take of whether this is already in progress, etc.
            await this.processComment(target, res);
        }
    }

    private async shouldCharge(info: CommitTarget, isStaff: AutoTestAuthTransport, res: AutoTestResultTransport): Promise<boolean> {

        // always false for staff and admins
        if (typeof isStaff !== "undefined" && isStaff !== null &&
            (isStaff.isAdmin === true || isStaff.isStaff === true)) {
            Log.info("GitHubAutoTest::shouldCharge(..) - false (staff || admin): " + info.personId);
            return false;
        }

        // always false for #check
        if (typeof info.flags !== "undefined" && info.flags !== null && info.flags.indexOf("#check") >= 0) {
            Log.info("GitHubAutoTest::shouldCharge(..) - false (#check)");
            return false;
        }

        // false if res exists and has been previously paid for
        if (res !== null) {
            const feedbackRequested: CommitTarget = await this.getRequester(info.commitURL, info.delivId, "standard");
            if (feedbackRequested !== null && feedbackRequested.timestamp < Date.now()) {
                Log.info("GitHubAutoTest::shouldCharge(..) - false (already paid for)");
                return false;
            }
        }

        return true;
    }

    /**
     *
     * NOTE: This description is from an older version of this method.
     *
     * Handles comment events from GitHub.
     *
     * Persists the event only if the feedback cannot be given right away and should be given when ready.
     *
     * Be careful though: if we give the warning we do not want to post back later!
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
     *  * post back results if rate limiting check passes (and record feedback given)
     *  * post back warning if rate limiting check fails
     */
    public async handleCommentEvent(info: CommitTarget): Promise<boolean> {
        const start = Date.now();

        if (typeof info === "undefined" || info === null) {
            throw new Error("GitHubAutoTest::handleCommentEvent( .. ) - info is null");
        }

        Log.info("GitHubAutoTest::handleCommentEvent(..) - start; commenter: " +
            info.personId + "; SHA: " + Util.shaHuman(info.commitSHA));

        Log.trace("GitHubAutoTest::handleCommentEvent(..) - start; comment: " +
            JSON.stringify(info));

        // sanity check; this keeps the rest of the code much simpler
        const preconditionsMet = await this.checkCommentPreconditions(info);
        if (preconditionsMet === false) {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - preconditions not met; not processing comment further.");
            return false;
        }

        const pushEvent = await this.dataStore.getPushRecord(info.commitURL);
        Log.info("GitHubAutoTest::handleCommentEvent(..) - start; for: " +
            info.personId + "; deliv: " + info.delivId + "; SHA: " + Util.shaHuman(info.commitSHA) + "; hasPush: " + (pushEvent !== null));

        if (pushEvent !== null && typeof pushEvent.ref === "string") {
            // If we have a push event for this commit, add the ref from the push to the record (for branch tracking).
            info.ref = pushEvent.ref;
        } else {
            // We do not have a push event so just explicitly set ref to "" (so string operations do not fail).
            //
            // NOTE: this happens when a comment is made on a commit that is not the one that was pushed
            // e.g., when 3 commits are pushed and the comment is on any commit that is not the most recent
            // in the push. This typically happens on < 5% of student comments. The GitHub API does not provide
            // a way to recover this information.
            //
            // One hack might be to look at the ref of the preceding push for this repo, but that is not
            // going to be reliable enough to use as a grading criteria for most courses.
            //
            // Another approach would be to just comment here and ask for only grading on the pushed commit
            // but that might feel overly restrictive.
            info.ref = "";
        }

        const res: AutoTestResultTransport = await this.classPortal.getResult(info.delivId, info.repoId, info.commitSHA);
        const isStaff: AutoTestAuthTransport = await this.classPortal.isStaff(info.personId);
        if (isStaff !== null && (isStaff.isStaff === true || isStaff.isAdmin === true)) {
            // staff request
            Log.info("GitHubAutoTest::handleCommentEvent(..) - handleAdmin; for: " +
                info.personId + "; deliv: " + info.delivId + "; SHA: " + Util.shaHuman(info.commitSHA));
            info.adminRequest = true; // set admin request so queues can handle this appropriately
            if (typeof info.flags !== "undefined" && info.flags.indexOf("#force") >= 0) {
                Log.info("GitHubAutoTest::handleCommentEvent(..) - handleAdmin; processing with #force");
                await this.processComment(info, null); // do not pass the previous result so a new one will be generated
            } else {
                await this.processComment(info, res);
            }
        } else {
            // student request
            Log.info("GitHubAutoTest::handleCommentEvent(..) - handleStudent; for: " +
                info.personId + "; deliv: " + info.delivId + "; SHA: " + Util.shaHuman(info.commitSHA));
            info.adminRequest = false;
            await this.handleCommentStudent(info, res);
        }

        // make sure the queues have ticked after the comment has been processed
        this.tick();
        Log.trace("GitHubAutoTest::handleCommentEvent(..) - done; took: " + Util.took(start));
    }

    protected async processExecution(data: AutoTestResult): Promise<void> {
        try {
            const that = this;
            const delivId = data.input.delivId;

            const standardFeedbackRequested: CommitTarget = await this.getRequester(data.commitURL, delivId, "standard");
            const checkFeedbackRequested: CommitTarget = await this.getRequester(data.commitURL, delivId, "check");
            const feedbackRequested = (standardFeedbackRequested !== null || checkFeedbackRequested !== null);

            const personId = data.input.target.personId;
            const feedbackDelay: string | null = await this.requestFeedbackDelay(delivId, personId, data.input.target.timestamp);
            const futureTarget: boolean = standardFeedbackRequested !== null && (standardFeedbackRequested.timestamp > Date.now());
            // Log.trace(`GitHubAutoTest::processExecution() - Target is from the future: ${futureTarget}`);

            // emit for testing
            Log.info("GitHubAutoTest::processExecution() - " +
                "repo: " + data.repoId +
                "; deliv: " + data.delivId +
                "; SHA: " + Util.shaHuman(data.commitSHA) +
                "; postback: " + data.output.postbackOnComplete +
                "; requested: " + feedbackRequested +
                "; delay: " + feedbackDelay +
                "; futureTarget: " + futureTarget);

            if (data.output.postbackOnComplete === true) {
                // handle "free" feedback as specified by the grading container
                // feedbackDelay should not matter here; this is for auto-postback results

                // intentionally skips calling saveFeedback (because the request should be free)
                if (futureTarget === true) {
                    Log.info(`GitHubAutoTest::processExecution() - postbackOnComplete true;` +
                        `removing ${data.input.target.personId} from scheduleQueue.`);
                }
                // do this first, does not count against quota
                Log.info("GitHubAutoTest::processExecution(..) - postback: true; deliv: " +
                    delivId + "; repo: " + data.repoId + "; SHA: " + Util.shaHuman(data.commitSHA) + ";");
                const msg = await this.classPortal.formatFeedback(data);
                await this.postToGitHub(data.input.target, {url: data.input.target.postbackURL, message: msg});
            } else if (feedbackRequested === true && // person requested feedback
                feedbackDelay === null && // person has feedback 'credit'
                futureTarget === false) {
                // handle user-requested feedback

                const giveFeedback = async function (target: CommitTarget, kind: string): Promise<void> {
                    Log.info("GitHubAutoTest::processExecution(..) - " + kind + " feedback requested; deliv: " +
                        delivId + "; repo: " + data.repoId + "; SHA: " + Util.shaHuman(data.commitSHA) + "; for: " + target.personId);
                    const msg = await that.classPortal.formatFeedback(data);
                    await that.postToGitHub(data.input.target, {url: data.input.target.postbackURL, message: msg});
                    await that.saveFeedbackGiven(delivId, target.personId,
                        target.timestamp, data.commitURL, kind);
                    return;
                };
                if (checkFeedbackRequested !== null) {
                    await giveFeedback(checkFeedbackRequested, "check");
                }
                if (standardFeedbackRequested !== null) {
                    await giveFeedback(standardFeedbackRequested, "standard");
                }
            } else {
                // no feedback should be returned
                if (feedbackDelay !== null) {
                    Log.info("GitHubAutoTest::processExecution(..) - commit no longer eligible for receiving feedback: " +
                        data.delivId + "; repo: " + data.repoId + "; SHA: " + Util.shaHuman(data.commitSHA) +
                        ". This was probably caused by a race condition.");
                } else {
                    Log.info("GitHubAutoTest::processExecution(..) - commit not requested - no feedback given;  deliv: " +
                        data.delivId + "; repo: " + data.repoId + "; SHA: " + Util.shaHuman(data.commitSHA));
                }
            }
        } catch (err) {
            Log.error("GitHubAutoTest::processExecution(..) - ERROR: " + err);
            return; // do not let errors escape
        }
    }

    /**
     * Check to see if the current user is allowed to make a result request.
     *
     * Null means yes, string will contain how long (in a human-readable format).
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
            const nextTimeslot: number | null = await this.requestNextTimeslot(delivId, userName);

            if (isStaff !== null && (isStaff.isAdmin === true || isStaff.isStaff === true)) {
                Log.info("GitHubAutoTest::requestFeedbackDelay(..) - staff; no delay");
                return null; // staff can always request
            } else {
                if (nextTimeslot === null) {
                    Log.info("GitHubAutoTest::requestFeedbackDelay(..) - for: " + userName + "; no prior request - no delay");
                    return null; // no prior requests
                } else {
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

    protected async requestNextTimeslot(delivId: string, userName: string): Promise<number | null> {
        // can hard-code standard because #check requests will not reach here
        const record: IFeedbackGiven = await this.dataStore.getLatestFeedbackGivenRecord(delivId, userName, "standard");
        const details: AutoTestConfigTransport = await this.classPortal.getContainerDetails(delivId); // should cache this
        let testDelay = 0;
        if (details !== null) {
            testDelay = details.studentDelay;
        }
        Log.trace("GitHubAutoTest::requestNextTimeslot(..) - testDelay: " + testDelay);
        if (record) {
            const nextTimeslot: number = record.timestamp + (testDelay * 1000);
            Log.info("GitHubAutoTest::requestNextTimeslot(..) - for: " + userName + "; delay: " + testDelay + "; last: " +
                new Date(record.timestamp).toLocaleTimeString() + "; next: " + new Date(nextTimeslot).toLocaleTimeString());
            return nextTimeslot;
        } else {
            return null;
        }
    }

    /**
     * Saves pushInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {CommitTarget} info
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
            Log.trace("GitHubAutoTest::saveCommentInfo(..) - for: " + info.personId +
                "; SHA: " + Util.shaHuman(info.commitSHA) + "; kind: " + info.kind);
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
     * Tracks that feedback was given for the specified user at the specified time.
     *
     * @param delivId
     * @param userName
     * @param timestamp
     * @param commitURL
     * @param kind
     */
    private async saveFeedbackGiven(delivId: string, userName: string, timestamp: number, commitURL: string, kind: string): Promise<void> {
        try {
            Log.info("GitHubAutoTest::saveFeedbackGiven(..) - feedback request logged for: " +
                userName + "; delivId: " + delivId + "; commit: " + commitURL);
            const record: IFeedbackGiven = {
                commitURL,
                delivId,
                timestamp,
                personId: userName,
                kind
            };
            await this.dataStore.saveFeedbackGivenRecord(record);
        } catch (err) {
            Log.error("GitHubAutoTest::saveFeedbackGiven() - ERROR: " + err);
        }
    }

    /**
     * Return the CommitTarget if the <SHA, delivId, kind> has been requested.
     * Returns null if a request has not been made.
     *
     * @param commitURL
     * @param delivId
     * @param kind
     */
    private async getRequester(commitURL: string, delivId: string, kind: string): Promise<CommitTarget | null> {
        try {
            const record: CommitTarget = await this.dataStore.getCommentRecord(commitURL, delivId, kind);
            if (record !== null) {
                return record;
            }
        } catch (err) {
            Log.error("GitHubAutoTest::getRequester() - ERROR: " + err);
        }
        return null;
    }
}
