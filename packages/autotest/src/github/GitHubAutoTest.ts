import * as Docker from "dockerode";
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
import {GitHubUtil, IGitHubMessage} from "./GitHubUtil";

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

    constructor(dataStore: IDataStore, portal: IClassPortal, docker: Docker) {
        super(dataStore, portal, docker);
        // this.github = github;
    }

    /**
     * Handles push events from Github.
     *
     * Persists the event so it can be restarted later if needed.
     *
     * Schedules the build on the standard queue if there is a default deliverable and it is open.
     *
     *
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
                Log.info("GitHubAutoTest::handlePushEvent(..) - delivId not specified; requesting");
                delivId = await this.getDelivId(); // current default deliverable
                Log.info("GitHubAutoTest::handlePushEvent(..) - delivId not specified; retrieved: " +
                    delivId + "; type: " + typeof delivId);

                if (delivId === "null") {
                    // delivId should be null if null, not 'null'; force this flag if this is the case
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

                    if (Array.isArray(deliv.regressionDelivIds) && deliv.regressionDelivIds.length > 0) {
                        for (const regressionId of deliv.regressionDelivIds) {
                            const regressionDetails = await this.classPortal.getContainerDetails(regressionId);
                            if (regressionDetails !== null) {
                                const regressionInfo: CommitTarget = JSON.parse(JSON.stringify(info)); // ensure we have a copy
                                regressionInfo.delivId = regressionId;

                                if (typeof regressionInfo.flags === 'undefined' || Array.isArray(regressionInfo.flags) === false) {
                                    regressionInfo.flags = [];
                                }
                                // This was problematic because timeouts wouldn't postback
                                // regressionInfo.flags.push("#silent"); // avoid posting back regression feedback

                                const regressionInput: ContainerInput = {
                                    delivId:         regressionId,
                                    target:          regressionInfo,
                                    containerConfig: regressionDetails
                                };

                                Log.info("GitHubAutoTest::handlePushEvent(..) - scheduling regressionId: " + regressionId);
                                Log.trace("GitHubAutoTest::handlePushEvent(..) - scheduling regressionId: " + regressionId +
                                    "; input: " + JSON.stringify(regressionInput));

                                this.addToRegressionQueue(regressionInput);
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
                // no active deliverable, ignore this push event (don't push an error either)
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
     * @param {ICommentEvent} info
     * @returns {boolean} true if the preconditions are met; false otherwise
     */
    private async checkCommentPreconditions(info: CommitTarget): Promise<boolean> {

        // ignore commits that do not exist
        if (typeof info === "undefined" || info === null) {
            Log.info("GitHubAutoTest::checkCommentPreconditions(..) - info not provided; skipping");
            return false;
        }

        Log.info("GitHubAutoTest::checkCommentPreconditions(..) - for: " + info.personId + "; commit: " + info.commitSHA);

        // ignore messges made by the bot, unless they are #force
        if (info.personId === Config.getInstance().getProp(ConfigKey.botName)) {

            if (typeof info.flags !== 'undefined' && info.flags.indexOf("#force") >= 0) {
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
            const msg = "Please specify a deliverable so AutoTest knows what to run against (e.g., #d0).";
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
            return false;
        }

        // ignore messages that do not request grading on a deliverable that is configured for autotest
        const deliv = await this.classPortal.getContainerDetails(delivId);
        if (deliv === null) {
            Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, unknown delivId: " + delivId);
            // no deliverable, give warning and abort
            const msg = "Please specify a deliverable so AutoTest knows what to run against (e.g., #d0).";
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

            if (typeof info.flags !== 'undefined') {
                // reject #force requests by requetors who are not admins or staff
                if (info.flags.indexOf("#force") >= 0) {
                    Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, student use of #force");
                    const msg = "Only admins can use the #force flag.";
                    delete info.flags;
                    await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                    return false;
                }

                // reject #silent requests by requestors that are not admins or staff
                if (info.flags.indexOf("#silent") >= 0) {
                    Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - ignored, student use of #silent");
                    const msg = "Only admins can use the #silent flag.";
                    delete info.flags;
                    await this.postToGitHub(info, {url: info.postbackURL, message: msg});
                    return false;
                }

                // reject requests that include schedule AND unschedule (as this doesn't make sense as a request)
                if (info.flags.indexOf("#schedule") >= 0 && info.flags.indexOf("#unschedule") >= 0) {
                    Log.warn("GitHubAutoTest::checkCommentPreconditions(..) - " +
                        "ignored, undefined behaviour: both #schedule AND #unschedule.");
                    const msg = "Please choose either #schedule or #unschedule. Both commands cannot be used in the same request.";
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
            Log.trace("GitHubAutoTest::postToGitHub(..) - info: " + JSON.stringify(info));
            Log.trace("GitHubAutoTest::postToGitHub(..) - message: " + JSON.stringify(message));
            return await GitHubUtil.postMarkdownToGithub(message);
        }
    }

    protected async schedule(info: CommitTarget): Promise<void> {
        Log.info("GitHubAutoTest::schedule(..) - scheduling for: " + info.personId +
            "; delivId: " + info.delivId + "; SHA: " + info.commitURL);

        const containerConfig = await this.classPortal.getContainerDetails(info.delivId);
        if (containerConfig !== null) {
            const input: ContainerInput = {delivId: info.delivId, target: info, containerConfig};
            this.addToStandardQueue(input);
            this.tick();
            Log.info("GitHubAutoTest::schedule(..) - scheduling completed for: " + info.commitURL);
        } else {
            Log.info("GitHubAutoTest::schedule(..) - scheduling skipped for: " + info.commitURL +
                "; no container configuration for: " + info.delivId);
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

        const containerDetails = await this.classPortal.getContainerDetails(res.delivId);
        let feedbackMode;
        if (containerDetails !== null &&
            typeof containerDetails.custom !== 'undefined' &&
            typeof (containerDetails.custom as any).feedbackMode !== 'undefined') {
            feedbackMode = (containerDetails.custom as any).feedbackMode;
        }

        const msg = await this.classPortal.formatFeedback(res, feedbackMode);
        await this.postToGitHub(info, {url: info.postbackURL, message: msg});
        await this.saveCommentInfo(info);
        if (res.output.postbackOnComplete === false) {
            const previousFeedback = await this.dataStore.getFeedbackGivenRecordForCommit(info);
            if (previousFeedback === null) {
                // new request, charge for feedback given
                await this.saveFeedbackGiven(info.delivId, info.personId, info.timestamp, info.commitURL, 'standard');

                if (res.input.target.personId !== info.personId) {
                    // NOTE: at this point we will have a result that finished computing before it was requested
                    // so the result.target field will be from the push and not the comment.
                    res.input.target.botMentioned = info.botMentioned;
                    res.input.target.personId = info.personId;
                    res.input.target.kind = 'standard'; // was push from the original request
                    Log.info("GitHubAutoTest::processCommentExists(..) - updating target for: " +
                        res.commitURL + " to: " + JSON.stringify(res.input.target));
                    await this.classPortal.sendResult(res);
                } else {
                    Log.info("GitHubAutoTest::processCommentExists(..) - updating target not needed for: " + res.commitURL);
                }
            } else {
                // previously paid, don't charge
                Log.info("GitHubAutoTest::processCommentExists(..) - result already exists and paid for for: " +
                    info.personId + "; SHA: " + info.commitSHA);
            }
        } else {
            // postbackOnComplete should only be true for lint / compile errors; don't saveFeedback (charge) for these
            Log.info("GitHubAutoTest::processCommentExists(..) - result already exists; feedback request skipped for: " +
                info.personId + "; SHA: " + info.commitSHA);
        }
        return;
    }

    protected async processCommentNew(info: CommitTarget): Promise<void> {
        Log.info("GitHubAutoTest::processCommentNew(..) - handling request for user: " +
            info.personId + " for commit: " + info.commitURL);

        Log.info("GitHubAutoTest::processCommentNew(..) - result not yet done; handling for: " +
            info.personId + "; SHA: " + info.commitSHA);
        // not yet processed
        const onQueue = this.isOnQueue(info.commitURL, info.delivId);
        let msg = '';
        if (onQueue === true) {
            msg = "This commit is still queued for processing against " + info.delivId + ".";
            msg += " Your results will be posted here as soon as they are ready.";
        } else {
            const pe = await this.dataStore.getPushRecord(info.commitURL);
            if (pe === null) {
                Log.warn("GitHubAutoTest::processCommentNew(..) - push event was not present; adding now. URL: " +
                    info.commitURL + "; for: " + info.personId + "; SHA: " + info.commitSHA);
                // store this pushevent for consistency in case we need it for anything else later
                await this.dataStore.savePush(info); // NEXT: add cloneURL to commentEvent (should be in github payload)
            }
            msg = "This commit has been queued for processing against " + info.delivId + ".";
            msg += " Your results will be posted here as soon as they are ready.";
            // STUDENT: need to guard this
            await this.schedule(info);
        }
        await this.saveCommentInfo(info);
        await this.postToGitHub(info, {url: info.postbackURL, message: msg});

        // jump to head of express queue
        this.promoteIfNeeded(info);

        return;
    }

    protected async processCommentScheduleRequest(info: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        Log.info("GitHubAutoTest::processCommentScheduleRequest(..) - handling queue request for user: " +
            info.personId + " for commit: " + info.commitURL);

        // Remove any preexisting queued commits
        const removedPrevious: ContainerInput | null = this.removeFromScheduleQueue([
            {key: "delivId", value: info.delivId},
            {key: "personId", value: info.personId}
        ]);

        let nextTimeslot: number | null = await this.requestNextTimeslot(info.delivId, info.personId);
        if (nextTimeslot) {
            nextTimeslot += 1;
            Log.trace("GitHubAutoTest::processCommentScheduleRequest(..) - Time requested: " +
                new Date(info.timestamp).toLocaleTimeString() + "; Time eligible: " + new Date(nextTimeslot).toLocaleTimeString());
            const newTarget: CommitTarget = {...info, timestamp: nextTimeslot};
            const containerConfig = await this.classPortal.getContainerDetails(info.delivId);
            let msg: string = '';
            if (containerConfig !== null) {
                const input: ContainerInput = {delivId: info.delivId, target: newTarget, containerConfig};
                this.addToScheduleQueue(input);
                msg = "Commit scheduled for grading.";
                if (removedPrevious) {
                    msg += `\n\nThis replaces the previously scheduled commit: \`${removedPrevious.target.commitSHA.slice(0, 7)}\`.\n\n`;
                }
                msg += " Commit will be appended to the grading queue in approximately " +
                    Util.tookHuman(info.timestamp, nextTimeslot) + ".\n" +
                    "To replace this commit, call autobot and use `#schedule` again, and to remove it, use `#unschedule`.";
            } else {
                Log.warn("GitHubAutoTest::processCommentScheduleRequest(..) - commit: " + info.commitSHA +
                    " - No container info for delivId: " + info.delivId + "; queue ignored.");
                msg = "There was an error in queuing this commit. Please contact staff for help.";
            }
            await this.saveCommentInfo(newTarget);
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
        } else {
            Log.warn("GitHubActions::processCommentScheduleRequest(..) - nextTimeslot was unexpectedly null." +
                " Queuing is now redundant.");
            // This is almost certainly unnecessary, but left here to be safe.
            await this.processComment(info, res);
        }
    }

    protected async handleCommentUnschedule(info: CommitTarget): Promise<void> {
        Log.info("GitHubAutoTest::handleCommentUnschedule(..) - handling student UNschedule request for: " +
            info.personId + "; deliv: " + info.delivId + "; for commit: " + info.commitURL);
        const res: ContainerInput | null = this.removeFromScheduleQueue([{key: "commitURL", value: info.commitURL}]);
        let msg;
        if (res) {
            Log.info("GitHubAutoTest::handleCommentUnschedule(..) - Unschedule successful for: " +
                info.personId + "; deliv: " + info.delivId + "; for commit: " + info.commitURL);
            msg = `This commit has successfully been removed from your grading queue.`;
        } else {
            const onQueue = this.isOnQueue(info.commitURL, info.delivId);
            if (onQueue) {
                Log.info("GitHubAutoTest::handleCommentUnschedule(..) - Unschedule NOT successful for: " +
                    info.personId + "; deliv: " + info.delivId + "; for commit: " + info.commitURL + ". Reason: Grading in progess");
                msg = `This commit is already being graded. Your results will be posted here as soon as they are ready.`;
            } else {
                Log.info("GitHubAutoTest::handleCommentUnschedule(..) - Unschedule NOT successful for: " +
                    info.personId + "; deliv: " + info.delivId + "; for commit: " + info.commitURL + ". Reason: Not scheduled");
                msg = "This commit is not scheduled to be graded; `#unschedule` is redundant.";
            }
        }
        await this.postToGitHub(info, {url: info.postbackURL, message: msg});
    }

    protected async handleCommentStudent(info: CommitTarget, res: AutoTestResultTransport): Promise<void> {
        Log.info("GitHubAutoTest::handleCommentStudent(..) - handling student request for: " +
            info.personId + "; deliv: " + info.delivId + "; for commit: " + info.commitURL);

        const shouldCharge = await this.shouldCharge(info, null, res);
        const feedbackDelay: string | null = await this.requestFeedbackDelay(info.delivId, info.personId, info.timestamp);
        const previousRequest: IFeedbackGiven = await this.dataStore.getFeedbackGivenRecordForCommit(info);

        Log.info("GitHubAutoTest::handleCommentStudent(..) - handling student request for: " +
            info.personId + " for commit: " + info.commitURL + "; null previous: " + (previousRequest === null) +
            "; null delay: " + (feedbackDelay === null));

        if (shouldCharge === true && previousRequest === null && feedbackDelay !== null && !info.flags.includes('#schedule')) {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - too early for: " + info.personId + "; must wait: " +
                feedbackDelay + "; SHA: " + info.commitURL);
            // NOPE, not yet (this is the most common case; feedback requested without time constraints)
            const msg = "You must wait " + feedbackDelay + " before requesting feedback.";
            await this.postToGitHub(info, {url: info.postbackURL, message: msg});
        } else if (shouldCharge === true && previousRequest === null && feedbackDelay !== null && info.flags.includes('#schedule')) {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - too early for: " + info.personId + "; Scheduling for: " +
                feedbackDelay + "; SHA: " + info.commitURL);
            // Not yet, but student has requested that autotest be called at the first possible moment.
            await this.processCommentScheduleRequest(info, res);
        } else if (previousRequest !== null) {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - feedback previously given for: " +
                info.personId + "; deliv: " + info.delivId + "; SHA: " + info.commitURL);
            // feedback given before; same as next case but logging is different
            // processComment will take of whether this is already in progress, etc.
            await this.processComment(info, res);
        } else {
            Log.info("GitHubAutoTest::handleCommentStudent(..) - not too early; for: " + info.personId + "; SHA: " + info.commitURL);
            // no time limitations. Because of this, queueing is the same as submitting now.
            // processComment will take of whether this is already in progress, etc.
            await this.processComment(info, res);
        }
    }

    private async shouldCharge(info: CommitTarget, isStaff: AutoTestAuthTransport, res: AutoTestResultTransport): Promise<boolean> {

        // always false for staff and admins
        if (isStaff !== null && (isStaff.isAdmin === true || isStaff.isStaff === true)) {
            Log.info("GitHubAutoTest::shouldCharge(..) - false (staff || admin): " + info.personId);
            return false;
        }

        // always false for #check
        if (typeof info.flags !== 'undefined' && info.flags !== null && info.flags.indexOf("#check") >= 0) {
            Log.info("GitHubAutoTest::shouldCharge(..) - false (#check)");
            return false;
        }

        // false if res exists and has been previously paid for
        if (res !== null) {
            const feedbackRequested: CommitTarget = await this.getRequestor(info.commitURL, info.delivId, 'standard');
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

        Log.info("GitHubAutoTest::handleCommentEvent(..) - start; commenter: " +
            info.personId + "; SHA: " + info.commitSHA);

        // sanity check; this keeps the rest of the code much simpler
        const preconditionsMet = await this.checkCommentPreconditions(info);
        if (preconditionsMet === false) {
            Log.info("GitHubAutoTest::handleCommentEvent(..) - preconditions not met; not processing comment further.");
            return false;
        }

        const pushEvent = await this.dataStore.getPushRecord(info.commitURL);
        Log.info("GitHubAutoTest::handleCommentEvent(..) - start; for: " +
            info.personId + "; deliv: " + info.delivId + "; SHA: " + info.commitSHA + "; hasPush: " + (pushEvent !== null));

        if (pushEvent !== null && typeof pushEvent.ref === 'string') {
            // If we have a push event for this commit, add the ref from the push to the record (for branch tracking).
            info.ref = pushEvent.ref;
        } else {
            // We don't have a push event so just explicitly set ref to '' (so string operations don't fail).
            //
            // NOTE: this happens when a comment is made on a commit that is not the one that was pushed
            // e.g., when 3 commits are pushed and the comment is on any commit that isn't the most recent
            // in the push. This typically happens on < 5% of student comments. The GitHub API does not provide
            // a way to recover this information.
            //
            // One hack might be to look at the ref of the preceeding push for this repo, but that is not
            // going to be reliable enough to use as a grading criteria for most courses.
            //
            // Another approach would be to just comment here and ask for only grading on the pushed commit
            // but that might feel overly restrictive.
            info.ref = '';
        }

        const res: AutoTestResultTransport = await this.classPortal.getResult(info.delivId, info.repoId, info.commitSHA);
        const isStaff: AutoTestAuthTransport = await this.classPortal.isStaff(info.personId);
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
            if (typeof info.flags !== 'undefined' && info.flags.indexOf("#unschedule") >= 0) {
                await this.handleCommentUnschedule(info);
            } else {
                await this.handleCommentStudent(info, res);
            }
        }
        Log.trace("GitHubAutoTest::handleCommentEvent(..) - done; took: " + Util.took(start));
    }

    /**
     * Returns true if handleCheck runs. False means standard processing should continue.
     *
     * @param {CommitTarget} info
     * @param {AutoTestResultTransport} res
     * @returns {Promise<boolean>}
     */
    // private async handleCheck(info: CommitTarget, res: AutoTestResultTransport): Promise<boolean> {
    //     if (info !== null && typeof info.flags !== 'undefined' && info.flags.indexOf("#check") >= 0) {
    //
    //         if (info.flags.indexOf("#force") >= 0) {
    //             const msg = '#force cannot be used in conjunction with #check.';
    //             await this.postToGitHub(info, {url: info.postbackURL, message: msg});
    //             return true;
    //         }
    //
    //         Log.info("GitHubAutoTest::handleCheck(..) - ignored, #check requested.");
    //         delete info.flags;
    //         if (res !== null) {
    //             let state = '';
    //             if (res.output.state === 'SUCCESS' && typeof res.output.report.result !== 'undefined') {
    //                 state = res.output.report.result;
    //             } else {
    //                 state = res.output.state;
    //             }
    //             const msg = "Check status for commit: " + state;
    //             await this.postToGitHub(info, {url: info.postbackURL, message: msg});
    //         } else {
    //             // not processed yet
    //             const msg = "Commit not yet processed. If you want to #check again, you will have to request later.";
    //             await this.postToGitHub(info, {url: info.postbackURL, message: msg});
    //         }
    //         return true;
    //     }
    //     return false;
    // }

    protected async processExecution(data: AutoTestResult): Promise<void> {
        try {
            const that = this;
            const delivId = data.input.delivId;

            const standardFeedbackRequested: CommitTarget = await this.getRequestor(data.commitURL, delivId, 'standard');
            const checkFeedbackRequested: CommitTarget = await this.getRequestor(data.commitURL, delivId, 'check');
            const containerConfig = await this.classPortal.getContainerDetails(delivId);

            let feedbackMode: string | undefined;
            if (containerConfig !== null &&
                typeof containerConfig.custom !== 'undefined' &&
                typeof (containerConfig.custom as any).feedbackMode !== 'undefined') {
                feedbackMode = (containerConfig.custom as any).feedbackMode;
            }

            const personId = data.input.target.personId;
            const feedbackDelay: string | null = await this.requestFeedbackDelay(delivId, personId, data.input.target.timestamp);
            const futureTarget: boolean = standardFeedbackRequested !== null && (standardFeedbackRequested.timestamp > Date.now());

            Log.info(`GitHubAutoTest::processExecution() - Target is from the future: ${futureTarget}`);

            if (data.output.postbackOnComplete === true) {
                // handle 'free' feedback as specified by the grading container
                // feedbackDelay should not matter here; this is for auto-postback results

                // intentionally skips calling saveFeedback (because the request should be free)
                if (futureTarget === true) {
                    // if #schedule has been requested, remove for this commit because this feedback is being returned for free
                    Log.info(`GitHubAutoTest::processExecution() - postbackOnComplete true;` +
                        `removing ${data.input.target.personId} from scheduleQueue.`);
                    this.removeFromScheduleQueue([{key: "commitURL", value: data.input.target.commitURL}]);
                }
                // do this first, doesn't count against quota
                Log.info("GitHubAutoTest::processExecution(..) - postback: true; deliv: " +
                    delivId + "; repo: " + data.repoId + "; SHA: " + data.commitSHA + "; feedbackMode: " + feedbackMode);
                const msg = await this.classPortal.formatFeedback(data, feedbackMode);
                await this.postToGitHub(data.input.target, {url: data.input.target.postbackURL, message: msg});
            } else if ((checkFeedbackRequested !== null || standardFeedbackRequested !== null) &&
                feedbackDelay === null && futureTarget === false) {
                // handle user-requested feedback

                const giveFeedback = async function(target: CommitTarget, kind: string): Promise<void> {
                    Log.info("GitHubAutoTest::processExecution(..) - " + kind + " feedback requested; deliv: " +
                        delivId + "; repo: " + data.repoId + "; SHA: " + data.commitSHA + '; for: ' + target.personId);
                    const msg = await that.classPortal.formatFeedback(data, feedbackMode);
                    await that.postToGitHub(data.input.target, {url: data.input.target.postbackURL, message: msg});
                    await that.saveFeedbackGiven(delivId, target.personId,
                        target.timestamp, data.commitURL, kind);
                    return;
                };
                if (checkFeedbackRequested !== null) {
                    await giveFeedback(checkFeedbackRequested, 'check');
                }
                if (standardFeedbackRequested !== null) {
                    await giveFeedback(standardFeedbackRequested, 'standard');
                }
            } else {
                // no feedback should be returned

                if (feedbackDelay !== null) {
                    Log.info("GitHubAutoTest::processExecution(..) - commit no longer eligible for receiving feedback: " +
                        data.delivId + "; repo: " + data.repoId + "; SHA: " + data.commitSHA +
                        ". This was probably caused by a race condition.");
                } else {
                    Log.info("GitHubAutoTest::processExecution(..) - commit not requested - no feedback given;  deliv: " +
                        data.delivId + "; repo: " + data.repoId + "; SHA: " + data.commitSHA);
                }
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
        const record: IFeedbackGiven = await this.dataStore.getLatestFeedbackGivenRecord(delivId, userName, 'standard');
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
            Log.trace("GitHubAutoTest::saveCommentInfo(..) - for: " + info.personId +
                "; SHA: " + info.commitSHA + "; kind: " + info.kind);
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
     * Return the username that requested the result for the given commitURL (or null)
     *
     * @param commitURL
     * @param delivId
     */
    private async getRequestor(commitURL: string, delivId: string, kind: string): Promise<CommitTarget | null> {
        try {
            const record: CommitTarget = await this.dataStore.getCommentRecord(commitURL, delivId, kind);
            if (record !== null) {
                return record;
            }
            return null;
        } catch (err) {
            Log.error("GitHubAutoTest::getRequestor() - ERROR: " + err);
        }
    }
}
