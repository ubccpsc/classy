import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {AutoTestResult} from "../../../common/types/AutoTestTypes";
import {CommitTarget, ContainerInput, ContainerOutput, ContainerState} from "../../../common/types/ContainerTypes";
import {AutoTestGradeTransport} from "../../../common/types/PortalTypes";
import Util from "../../../common/Util";
import {GradeTask} from "../container/GradeTask";
import {Workspace} from "../container/Workspace";
import {IClassPortal} from "./ClassPortal";
import {IDataStore} from "./DataStore";
import {MockGrader} from "./mocks/MockGrader";
import {Queue} from "./Queue";

export interface IAutoTest {
    /**
     * Adds a new job to be processed by the standard queue.
     *
     * @param {IContainerInput} element
     */
    addToStandardQueue(element: ContainerInput): void;

    // NOTE: add this when we support regression queues
    // addToRegressionQueue(element: IContainerInput): void;

    /**
     * Updates the internal clock of the handler. This might or might not do anything.
     *
     * But if there are execution slots available and the queue has elements it should
     * start jobs processing.
     */
    tick(): void;
}

export abstract class AutoTest implements IAutoTest {
    protected readonly dataStore: IDataStore;
    protected readonly classPortal: IClassPortal = null;

    private regressionQueue = new Queue('regression', 1);
    private standardQueue = new Queue('standard', 2);
    private expressQueue = new Queue('express', 1);

    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
    constructor(dataStore: IDataStore, classPortal: IClassPortal) {
        this.dataStore = dataStore;
        this.classPortal = classPortal;
    }

    public addToStandardQueue(input: ContainerInput): void {
        Log.info("AutoTest::addToStandardQueue(..) - start; commit: " + input.target.commitSHA);
        try {
            this.standardQueue.push(input);
        } catch (err) {
            Log.error("AutoTest::addToStandardQueue(..) - ERROR: " + err);
        }
    }

    public tick() {
        try {
            Log.info("AutoTest::tick(..) - start; " +
                "standard - #wait: " + this.standardQueue.length() + ", #run: " + this.standardQueue.numRunning() + "; " +
                "express - #wait: " + this.expressQueue.length() + ", #run: " + this.expressQueue.numRunning() + "; " +
                "regression - #wait: " + this.regressionQueue.length() + ", #run: " + this.regressionQueue.numRunning() + ".");

            let updated = false;
            const that = this;

            const schedule = function(queue: Queue): boolean {
                const info: ContainerInput = queue.scheduleNext();
                Log.info("AutoTest::tick(..) - starting job on: " + queue.getName() + "; deliv: " +
                    info.delivId + '; repo: ' + info.target.repoId + '; SHA: ' + info.target.commitSHA);
                // noinspection JSIgnoredPromiseFromCall
                // tslint:disable-next-line
                that.invokeContainer(info); // NOTE: not awaiting on purpose (let it finish in the background)!
                updated = true;
                return true;
            };

            const tickQueue = function(queue: Queue): boolean {
                if (queue.length() > 0 && queue.hasCapacity() === true) {
                    return schedule(queue);
                }
                return false;
            };

            const promoteQueue = function(fromQueue: Queue, toQueue: Queue): boolean {
                if (fromQueue.length() > 0 && toQueue.hasCapacity()) {
                    Log.info("AutoTest::tick(..) - promoting: " + fromQueue.getName() + " -> " + toQueue.getName());
                    const info: ContainerInput = fromQueue.pop();
                    toQueue.pushFirst(info);
                    return schedule(toQueue);
                }
                return false;
            };

            // express
            // Log.trace("Queue::tick(..) - handle express");
            tickQueue(this.expressQueue);
            // express -> standard
            promoteQueue(this.expressQueue, this.standardQueue);
            // express -> regression
            promoteQueue(this.expressQueue, this.regressionQueue);

            // standard
            // Log.trace("Queue::tick(..) - handle standard");
            tickQueue(this.standardQueue);
            // standard -> regression
            promoteQueue(this.standardQueue, this.regressionQueue);

            // regression
            // Log.trace("Queue::tick(..) - handle regression");
            tickQueue(this.regressionQueue);

            // if (updated === false) {
            if (this.standardQueue.length() === 0 && this.standardQueue.numRunning() === 0 &&
                this.expressQueue.length() === 0 && this.expressQueue.numRunning() === 0 &&
                this.regressionQueue.length() === 0 && this.regressionQueue.numRunning() === 0) {
                Log.info("AutoTest::tick(..) - done: queues empty and idle; no new jobs started.");
            } else {
                // Log.info("AutoTest::tick(..) - done - execution slots busy; no new jobs started");
                Log.info("AutoTest::tick(..) - done: " +
                    "standard - #wait: " + this.standardQueue.length() + ", #run: " + this.standardQueue.numRunning() + "; " +
                    "express - #wait: " + this.expressQueue.length() + ", #run: " + this.expressQueue.numRunning() + "; " +
                    "regression - #wait: " + this.regressionQueue.length() + ", #run: " + this.regressionQueue.numRunning() + ".");
            }
            // }
        } catch (err) {
            Log.error("AutoTest::tick() - ERROR: " + err.message);
        }
    }

    /**
     * This is the main extension point for a subclass to respond to an execution completing.
     * The record will be persisted by AutoTest, but any kind of reporting back to users will
     * have to be handled by subclasses.
     *
     * If subclasses do not want to do anything, they can just `return Promise.resolve();`
     * in their implementation.
     *
     * @param {IAutoTestResult} data
     * @returns {Promise<void>}
     */
    protected abstract processExecution(data: AutoTestResult): Promise<void>;

    /**
     * Returns whether the commitURL is currently executing the given deliverable.
     *
     * @param commitURL
     * @param delivId
     */
    protected isCommitExecuting(commitURL: string, delivId: string): boolean {
        try {
            if (this.standardQueue.isCommitExecuting(commitURL, delivId) === true) {
                return true;
            }

            if (this.expressQueue.isCommitExecuting(commitURL, delivId) === true) {
                return true;
            }

            if (this.regressionQueue.isCommitExecuting(commitURL, delivId) === true) {
                return true;
            }

            return false;
        } catch (err) {
            Log.error("AutoTest::isCommitExecuting() - ERROR: " + err);
        }
    }

    /**
     * Checks to see of a commitURL is queued or is currently being executed
     *
     * @param {string} commitURL
     * @param {string} delivId
     * @returns {boolean}
     */
    protected isOnQueue(commitURL: string, delivId: string): boolean {
        let onQueue = false;
        try {
            if (this.isCommitExecuting(commitURL, delivId) === true) {
                onQueue = true;
            } else if (this.standardQueue.indexOf(commitURL) >= 0) {
                onQueue = true;
            } else if (this.expressQueue.indexOf(commitURL) >= 0) {
                onQueue = true;
            } else if (this.regressionQueue.indexOf(commitURL) >= 0) {
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
    protected promoteIfNeeded(info: CommitTarget): void {
        try {
            Log.trace("AutoTest::promoteIfNeeded() - start");

            if (this.isCommitExecuting(info.commitURL, info.delivId) === true) {
                Log.trace("AutoTest::promoteIfNeeded() - not needed; currently executing");
                return;
            }

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
                // or if it is already on the express queue
            }
        } catch (err) {
            Log.error("AutoTest::promoteIfNeeded() - ERROR: " + err);
        }
    }

    /**
     * Called when a container completes.
     *
     * Persist record. (could decide to move this persistence into ClassPortal::sendResult in future)
     * Post back if specified by container output.
     * Post back if requested by TA
     * Post back if requested by user and quota allows (and record feedback given)
     *
     * @param data
     */
    private async handleExecutionComplete(data: AutoTestResult): Promise<void> {
        try {
            const start = Date.now();

            if (typeof data === "undefined" || data === null) {
                Log.warn("AutoTest::handleExecutionComplete(..) - null data; skipping");
                return;
            }

            if (typeof data.commitSHA === "undefined" ||
                typeof data.commitURL === "undefined" ||
                typeof data.input === "undefined" ||
                typeof data.output === "undefined") {
                Log.error("AutoTest::handleExecutionComplete(..) - missing required field; skipping; data: " + JSON.stringify(data));
                return;
            }

            Log.info("AutoTest::handleExecutionComplete(..) - start" +
                ": delivId: " + data.delivId + "; repoId: " + data.repoId +
                "; took (waiting + execution): " + Util.tookHuman(data.input.target.timestamp) +
                "; SHA: " + data.commitSHA);

            try {
                const resultPayload = await this.classPortal.sendResult(data);
                if (typeof resultPayload.failure !== 'undefined') {
                    Log.error("AutoTest::handleExecutionComplete(..) - ERROR; Classy rejected result record: " +
                        JSON.stringify(resultPayload));
                } else {
                    await this.processExecution(data);
                }
            } catch (err) {
                // just eat this error so subtypes do not break our queue handling
                Log.error("AutoTest::handleExecutionComplete(..) - ERROR; sending/processing: " + err);
            }

            // when done clear the execution slot and schedule the next
            const commitURL = data.commitURL;
            const delivId = data.delivId;
            this.expressQueue.clearExecution(commitURL, delivId);
            this.standardQueue.clearExecution(commitURL, delivId);
            this.regressionQueue.clearExecution(commitURL, delivId);

            // execution done, advance the clock
            this.tick();
            Log.info("AutoTest::handleExecutionComplete(..) - done; SHA: " + data.commitSHA +
                "; final processing took: " + Util.took(start));
        } catch (err) {
            Log.error("AutoTest::handleExecutionComplete(..) - ERROR: " + err.message);
        }
    }

    /**
     * Starts the container for the commit.
     *
     *
     * @param input
     */
    private async invokeContainer(input: ContainerInput) {
        try {
            Log.info("AutoTest::invokeContainer(..) - start; delivId: " + input.delivId + "; SHA: " + input.target.commitSHA);
            Log.trace("AutoTest::invokeContainer(..) - input: " + JSON.stringify(input, null, 2));
            const start = Date.now();

            let record: AutoTestResult = null;
            let isProd = true;
            if (input.target.postbackURL === "EMPTY" || input.target.postbackURL === "POSTBACK") {
                Log.warn("AutoTest::invokeContainer(..) - execution skipped; !isProd");
                isProd = false; // EMPTY and POSTBACK used by test environment
            }
            if (isProd === true) {
                const commitSHA: string = input.target.commitSHA;
                const commitURL: string = input.target.commitURL;

                const timestamp: number = input.target.timestamp;
                const delivId: string = input.delivId;
                const repoId: string = input.target.repoId;
                const id: string = `${commitSHA}-${delivId}`;
                const repoURL = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
                    Config.getInstance().getProp(ConfigKey.org) + '/' + repoId;

                const uid: number = Config.getInstance().getProp(ConfigKey.dockerUid);
                const token: string = Config.getInstance().getProp(ConfigKey.githubBotToken).replace("token ", "");
                const assnDir: string = `${Config.getInstance().getProp(ConfigKey.hostDir)}/${id}/assn`;
                const outputDir: string = `${Config.getInstance().getProp(ConfigKey.hostDir)}/${id}/output`;
                const workspaceDir: string = Config.getInstance().getProp(ConfigKey.persistDir) + "/" + id;

                // Add parameters to create the grading container. We'll be lazy and use the custom field.
                input.containerConfig.custom = {
                    "--env": [
                        `ASSIGNMENT=${delivId}`,
                        `EXEC_ID=${id}`
                    ],
                    "--volume": [
                        `${assnDir}:/assn`,
                        `${outputDir}:/output`
                    ],
                    "--network": Config.getInstance().getProp(ConfigKey.dockerNet),
                    "--add-host": Config.getInstance().getProp(ConfigKey.hostsAllow),
                    "--user": uid
                };

                // Inject the GitHub token into the cloneURL so we can clone the repo.
                input.target.cloneURL = input.target.cloneURL.replace("://", `://${token}@`);

                try {
                    const workspace: Workspace = new Workspace(workspaceDir, uid);
                    const output = await new GradeTask(id, input, workspace).execute();

                    Log.trace("AutoTest::invokeContainer(..) - output: " + JSON.stringify(output, null, 2));

                    record = {
                        delivId,
                        repoId,
                        commitURL,
                        commitSHA,
                        input,
                        output
                    };

                    // POST the grade to Class Portal
                    // NOTE: it is ok for for this to be here, but the backend should consider
                    // whether or not to honour it (e.g., based on course config or deadlines)

                    let score = -1;
                    if (output.report !== null && typeof output.report.scoreOverall !== "undefined") {
                        score = output.report.scoreOverall;
                    }
                    const gradePayload: AutoTestGradeTransport = {
                        delivId,
                        repoId,
                        repoURL,
                        score,

                        urlName: repoId, // could be a short SHA, but this seems better
                        URL: commitURL,

                        comment: '', // output.report.feedback,   // this only makes sense if we can render markdown
                        timestamp,
                        custom: {}
                    };

                    if (output.postbackOnComplete === false) {
                        await this.classPortal.sendGrade(gradePayload); // this is just the Grade record, not the Report record
                    } else {
                        // grade not sent; if postback is true we must have compile / lint problem
                    }
                } catch (err) {
                    Log.warn("AutoTest::invokeContainer(..) - ERROR for SHA: " + input.target.commitSHA +
                        "; ERROR sending grade: " + err);
                }
            } else {
                Log.info("AutoTest::invokeContainer(..) - TEST CONFIG: Running MockGrader");
                const grader = new MockGrader(input);
                record = await grader.execute();
            }

            Log.info("AutoTest::invokeContainer(..) - complete; delivId: " + input.delivId +
                "; SHA: " + input.target.commitSHA + "; took: " + Util.tookHuman(start));
            await this.handleExecutionComplete(record);
        } catch (err) {
            Log.error("AutoTest::invokeContainer(..) - ERROR for SHA: " + input.target.commitSHA + "; ERROR: " + err);
        }
    }
}
