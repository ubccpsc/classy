import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import Util from "../../../common/Util";

import {IAutoTestResult, ICommentEvent, IContainerInput, IFeedbackGiven, IPushEvent} from "../Types";

import {IClassPortal} from "../autotest/ClassPortal";
import {IDataStore} from "../autotest/DataStore";
import {IGitHubService} from "./GitHubService";
import {AutoTest} from "../autotest/AutoTest";
import {AutoTestAuthTransport, AutoTestConfigTransport} from "../../../common/types/PortalTypes";

export interface IGitHubTestManager {

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
}


export class GitHubAutoTest extends AutoTest implements IGitHubTestManager {

    private github: IGitHubService = null;

    constructor(dataStore: IDataStore, portal: IClassPortal, github: IGitHubService) {
        super(dataStore, portal);
        this.github = github;
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
    public async handlePushEvent(info: IPushEvent, delivId?: string): Promise<boolean> {
        try {
            if (typeof info === "undefined" || info === null) {
                Log.info("GitHubAutoTest::handlePushEvent(..) - info not provided; skipping.");
                return false;
            }

            Log.info("GitHubAutoTest::handlePushEvent(..) - start; commit: " + info.commitSHA);
            const start = Date.now();

            if (typeof delivId === "undefined" || delivId === null) {
                delivId = await this.getDelivId(); // current default deliverable
            }

            if (delivId !== null) {
                const input: IContainerInput = {delivId, pushInfo: info};
                await this.savePushInfo(input);
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
    public async handleCommentEvent(info: ICommentEvent): Promise<boolean> {
        const that = this;
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
            let delivId = info.delivId;

            if (delivId === null) {
                // no deliverable, give warning and abort
                const msg = "Please specify a deliverable so AutoTest knows what to run against (e.g., #d0).";
                await this.github.postMarkdownToGithub({url: info.postbackURL, message: msg});
                return true;
            }

            // front load the async operations, even if it means we do some operations unnecessarily; thse could be done in parallel
            const isStaff: AutoTestAuthTransport = await this.classPortal.isStaff(info.personId); // async
            const requestFeedbackDelay: string | null = await this.requestFeedbackDelay(delivId, info.personId, info.timestamp); // ts of comment, not push
            const hasBeenRequestedBefore: IFeedbackGiven = await this.dataStore.getFeedbackGivenRecordForCommit(info.commitURL, info.personId); // students often request grades they have previously 'paid' for
            const res: IAutoTestResult = await this.getOutputRecord(info.commitURL, delivId); // for any user
            const isCurrentlyRunning: boolean = this.isCommitExecuting(info.commitURL, delivId);
            Log.trace("GitHubAutoTest::handleCommentEvent(..) - isStaff: " + isStaff + "; delay: " + requestFeedbackDelay + "; res: " + res + "; running?: " + isCurrentlyRunning);

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
                Log.trace("GitHubAutoTest::handleCommentEvent(..) - commit: " + info.commitSHA + "; execution complete");
                // true if staff, requested before, or over feedback delay interval
                if (shouldPost === true) {
                    await this.github.postMarkdownToGithub({url: info.postbackURL, message: res.output.feedback});
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
                            Log.info("GitHubAutoTest::handleCommentEvent(..) - commit: " + info.commitSHA + "; - element not on queue; adding.");
                            await this.handlePushEvent(pe, info.delivId);
                        } else {
                            Log.warn("GitHubAutoTest::handleCommentEvent(..) - commit: " + info.commitSHA + "; - element not on queue; cannot find push event.");
                            msg = "This commit is has not been queued; please make and push a new commit.";
                        }
                    }
                    await this.saveCommentInfo(info); // whether TA or staff
                    await this.github.postMarkdownToGithub({url: info.postbackURL, message: msg});
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
            const pushRequested: ICommentEvent = await this.getRequestor(data.commitURL, data.input.delivId);
            if (data.output.postbackOnComplete === true) {
                // do this first, doesn't count against quota
                Log.info("GitHubAutoTest::processExecution(..) - postback: true");
                await this.github.postMarkdownToGithub({url: data.input.pushInfo.postbackURL, message: data.output.feedback});
                // NOTE: if the feedback was requested for this build it shouldn't count
                // since we're not calling saveFeedback this is right
                // but if we replay the commit comments, we would see it there, so be careful
            } else if (pushRequested !== null) {
                // feedback has been previously requested
                Log.info("GitHubAutoTest::processExecution(..) - feedback requested");
                await this.github.postMarkdownToGithub({url: data.input.pushInfo.postbackURL, message: data.output.feedback});
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
            Log.info("GitHubAutoTest::requestFeedbackDelay( " + delivId + ", " + userName + ", " + reqTimestamp + ". - start");
            // async operations up front
            const isStaff: AutoTestAuthTransport = await this.classPortal.isStaff(userName);
            const record: IFeedbackGiven = await this.dataStore.getLatestFeedbackGivenRecord(delivId, userName);
            const details: AutoTestConfigTransport = await this.classPortal.getContainerDetails(delivId); // should cache this
            let testDelay = 0;
            if (details !== null) {
                testDelay = details.studentDelay;
            }

            if (isStaff !== null && (isStaff.isAdmin === true || isStaff.isStaff === true)) {
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
            Log.error("GitHubAutoTest::requestFeedbackDelay() - ERROR: " + err);
        }
    }


    /**
     * Saves pushInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {IContainerInput} info
     */
    private async savePushInfo(info: IContainerInput) {
        try {
            Log.trace("GitHubAutoTest::savePushInfo(..) - commit: " + info.pushInfo.commitSHA);
            await this.dataStore.savePush(info);
        } catch (err) {
            Log.error("GitHubAutoTest::savePushInfo(..) - ERROR: " + err);
        }
    }

    /**
     * Saves commentInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {ICommentEvent} info
     */
    private async saveCommentInfo(info: ICommentEvent) {
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
            let str = await this.classPortal.getDefaultDeliverableId();
            Log.trace("GitHubAutoTest::getDelivId() - RESPONSE: " + str);
            if (typeof str.defaultDeliverable !== "undefined") {
                return str.defaultDeliverable;
            }
            return null;
        } catch (err) {
            Log.error("GitHubAutoTest::getDelivId() - ERROR: " + err);
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
    private async saveFeedbackGiven(delivId: string, userName: string, timestamp: number, commitURL: string): Promise<void> {
        try {
            const record: IFeedbackGiven = {
                commitURL,
                delivId,
                timestamp,
                personId: userName,
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
    private async getRequestor(commitURL: string, delivId: string): Promise<ICommentEvent | null> {
        try {
            const record: ICommentEvent = await this.dataStore.getCommentRecord(commitURL, delivId);
            if (record !== null) {
                return record;
            }
            return null;
        } catch (err) {
            Log.error("GitHubAutoTest::getRequestor() - ERROR: " + err);
        }
    }
}
