import * as Docker from "dockerode";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {AutoTestResult} from "@common/types/AutoTestTypes";
import {ContainerInput} from "@common/types/ContainerTypes";
import {AutoTestGradeTransport} from "@common/types/PortalTypes";
import Util from "@common/Util";

import {IClassPortal} from "./ClassPortal";
import {IDataStore} from "./DataStore";
import {GradingJob} from "./GradingJob";
import {MockGradingJob} from "./mocks/MockGradingJob";
import {Queue} from "./Queue";

export interface IAutoTest {

    /**
     * Adds a new job to be processed by the express queue.
     *
     * @param {ContainerInput} element
     */
    addToExpressQueue(element: ContainerInput): void;

    /**
     * Adds a new job to be processed by the standard queue.
     *
     * @param {ContainerInput} element
     */
    addToStandardQueue(element: ContainerInput): void;

    /**
     * Adds a new job to be processed by the regression queue.
     *
     * @param {ContainerInput} element
     */
    addToRegressionQueue(element: ContainerInput): void;

    /**
     * Updates the internal clock of the handler. This might or might not do anything.
     *
     * But if there are execution slots on any queue available, and any queue has jobs waiting,
     * a waiting job should start processing on the available slot.
     */
    tick(): void;
}

/**
 * Handles the scheduling and prioritization of AutoTest jobs.
 *
 * In general, queueing looks like this:
 *
 * 1) Express jobs are always handled if there is a job waiting
 * and an execution slot available on any other queue.
 *
 * 2) Standard jobs run when no express jobs are waiting. If too
 * many jobs are added to this queue from a single user the
 * jobs are demoted to the regression queue.
 *
 * 3) Regression jobs are run when no express or standard jobs
 * are waiting.
 *
 * NOTE: the schedule queue is its own thing and does not interact
 * with any of these other queues except that it puts jobs into
 * the express queue when they are ready.
 *
 */
export abstract class AutoTest implements IAutoTest {
    protected readonly dataStore: IDataStore;
    protected readonly classPortal: IClassPortal = null;
    protected readonly docker: Docker;

    /**
     * Express queue. If this queue has jobs in it, no matter what is
     * going on in the other queues, these should be handled first.
     *
     * @private {Queue}
     */
    private expressQueue = new Queue("exp", 2);

    /**
     * Standard jobs. Always execute after Express jobs, but also always
     * before any regression jobs.
     *
     * @private {Queue}
     */
    private standardQueue = new Queue("std", 2);

    /**
     * Regression jobs. These will happen whenever they can. Repos
     * that push too rapidly will have their jobs demoted to the
     * regression queue.
     *
     * @private {Queue}
     */
    private regressionQueue = new Queue("reg", 1);

    /**
     * The maximum number of jobs a single user can have on the standard queue
     * before it will schedule on the regression queue instead. This is to
     * prevent DOS attacks because a single user could submit an unbounded number
     * of requests preventing others from being graded.
     *
     * @private
     */
    private readonly MAX_STANDARD_JOBS: number = 3;

    /**
     * The maximum number of jobs a single user can have on the regression queue
     * before we refrain from scheduling them at all.
     *
     * NOTE: not currently used.
     *
     * @private
     */
    // noinspection JSUnusedLocalSymbols
    // private readonly MAX_JOBS: number = 100;

    constructor(dataStore: IDataStore, classPortal: IClassPortal, docker: Docker) {
        Log.info("AutoTest::<init> - starting AutoTest");
        this.dataStore = dataStore;
        this.classPortal = classPortal;
        this.docker = docker;
        this.loadQueues();

        // TODO: this is a temporary solution to make sure the schedule queue is checked
        setInterval(() => {
            Log.trace("AutoTest::<init>::$1 - Calling Tick");
            this.tick();
        }, 1000 * 60 * 5);
    }

    /**
     * Adds a job to the express queue. A user can only ask for a single job to go on
     * the express queue at a time. If the job is already executing on any other queue
     * it will not be added.
     *
     * @param input
     */
    public addToExpressQueue(input: ContainerInput): void {
        Log.info("AutoTest::addToExpressQueue(..) - start; commit: " + input.target.commitSHA);
        try {

            if (this.isCommitExecuting(input)) {
                Log.info("AutoTest::addToExpressQueue(..) - not added; commit already executing");
                return;
            }

            if (this.expressQueue.numberJobsForPerson(input) < 1) {
                // add to express queue since they are not already on it
                this.expressQueue.push(input);

                // if job is on any other queue, remove it
                this.standardQueue.remove(input);
                this.regressionQueue.remove(input);
            } else {
                Log.info("AutoTest::addToExpressQueue(..) - user: " + input.target.personId +
                    " already has job on express queue; adding: " +
                    input.target.commitSHA + " to standard queue");

                // express queue already has a job for this user, move to standard
                this.addToStandardQueue(input);
            }
        } catch (err) {
            Log.error("AutoTest::addToExpressQueue(..) - ERROR: " + err);
        }
    }

    public addToStandardQueue(input: ContainerInput): void {
        Log.info("AutoTest::addToStandardQueue(..) - start; commit: " + input.target.commitSHA);
        try {

            if (this.isCommitExecuting(input)) {
                Log.info("AutoTest::addToStandardQueue(..) - not added; commit already executing");
                return;
            }

            // only add job if it is not already on express
            if (this.expressQueue.indexOf(input) < 0) {

                const standardJobCount = this.standardQueue.numberJobsForPerson(input);
                const regressionJobCount = this.regressionQueue.numberJobsForPerson(input);

                // this is fairly permissive; only queued jobs (not executing jobs) are counted
                if (standardJobCount < this.MAX_STANDARD_JOBS) {
                    this.standardQueue.push(input);

                    // if job is on any other queue, remove it
                    this.regressionQueue.remove(input);
                } else {
                    Log.warn("AutoTest::addToStandardQueue(..) - repo: " +
                        input.target.repoId + "; has #" + standardJobCount +
                        " standard jobs queued and #" + regressionJobCount +
                        " regression jobs queued");

                    // NOTE: this _could_ post a warning back to the user
                    // that their priority is lowered due to excess jobs

                    this.addToRegressionQueue(input);
                }

            } else {
                Log.info("AutoTest::addToStandardQueue(..) - skipped; " +
                    "job already on express queue; SHA: " + input.target.commitSHA);
            }
        } catch (err) {
            Log.error("AutoTest::addToStandardQueue(..) - ERROR: " + err);
        }
    }

    public addToRegressionQueue(input: ContainerInput): void {
        Log.info("AutoTest::addToRegressionQueue(..) - start; commit: " + input.target.commitSHA);
        try {

            if (this.isCommitExecuting(input)) {
                Log.info("AutoTest::addToRegressionQueue(..) - not added; commit already executing");
                return;
            }

            // add to the regression queue if it is not already on express or standard
            if (this.expressQueue.indexOf(input) < 0 && this.standardQueue.indexOf(input) < 0) {
                this.regressionQueue.push(input);
            } else {
                Log.info("AutoTest::addToRegressionQueue(..) - skipped; " +
                    "job already on standard or express queue; SHA: " + input.target.commitSHA);
            }
        } catch (err) {
            Log.error("AutoTest::addToRegressionQueue(..) - ERROR: " + err);
        }
    }

    /**
     * Advance the queues. Does nothing if all execution slots are full.
     */
    public tick(): void {
        try {
            Log.trace("AutoTest::tick(..) - start; " +
                "express - #wait: " + this.expressQueue.length() + ", #run: " + this.expressQueue.numRunning() + "; " +
                "standard - #wait: " + this.standardQueue.length() + ", #run: " + this.standardQueue.numRunning() + "; " +
                "regression - #wait: " + this.regressionQueue.length() + ", #run: " + this.regressionQueue.numRunning() + ".");

            // let updated = false;
            const that = this;

            const tickQueue = function (queue: Queue): void {
                if (queue.length() > 0 && queue.hasCapacity() === true) {
                    const info: ContainerInput = queue.scheduleNext();
                    Log.info("AutoTest::tick::tickQueue(..)         [JOB] - job start: " + queue.getName() + "; deliv: " +
                        info.delivId + "; repo: " + info.target.repoId + "; SHA: " + info.target.commitSHA);

                    let gradingJob: GradingJob;
                    // Use mocked GradingJob if testing; EMPTY and POSTBACK used by test environment
                    if (info.target.postbackURL === "EMPTY" || info.target.postbackURL === "POSTBACK") {
                        Log.warn("AutoTest::tick::tickQueue(..) - Running grading job in test mode.");
                        gradingJob = new MockGradingJob(info);
                    } else {
                        gradingJob = new GradingJob(info);
                    }

                    // noinspection ES6MissingAwait
                    // noinspection JSIgnoredPromiseFromCall
                    // tslint:disable-next-line
                    that.handleTick(gradingJob); // NOTE: not awaiting on purpose (let it finish in the background)!
                } else {
                    // no cap to tick (should not happen)
                    Log.trace("AutoTest::tick::tickQueue(..) - no capacity to tick");
                }
            };

            /**
             * Moves a job from one queue to another.
             *
             * @param input
             * @param sourceQueue
             * @param destQueue
             * @param onFront whether the job should be put at the front (true) or back (false) of the queue.
             */
            const switchQueues = function (input: ContainerInput, sourceQueue: Queue, destQueue: Queue, onFront: boolean) {
                Log.info("AutoTest::tick::switchQueues(..) - start; source: " + sourceQueue.getName() +
                    "->dest: " + destQueue.getName() + "; for SHA: " + input.target.commitSHA);

                if (that.isCommitExecuting(input)) {
                    Log.info("AutoTest::tick::switchQueues(..) - skipped; commit already executing");
                    return;
                }

                const onSourceQueue = sourceQueue.indexOf(input) >= 0;
                const onDestQueue = destQueue.indexOf(input) >= 0;

                if (onDestQueue === true) {
                    // already on dest queue
                    Log.warn("AutoTest::tick::switchQueues(..) - already on dest queue: " + input.target.commitSHA);
                    return;
                }

                if (onSourceQueue === false) {
                    // not on source to switch
                    Log.warn("AutoTest::tick::switchQueues(..) - not on source queue: " + input.target.commitSHA);
                    return;
                }

                // swap queues
                Log.trace("AutoTest::tick::switchQueues(..) - switching: " + input.target.commitSHA);
                sourceQueue.remove(input);
                if (onFront === true) {
                    destQueue.pushFirst(input); // put on the front of the next queue
                } else {
                    destQueue.push(input); // put on the front of the next queue
                }
                Log.trace("AutoTest::tick::switchQueues(..) - switched: " + input.target.commitSHA);
            };

            //
            // handle the queues in order: express -> standard -> regression
            //

            // fill all express execution slots with express jobs
            while (this.expressQueue.hasCapacity() && this.expressQueue.hasWaitingJobs()) {
                tickQueue(this.expressQueue);
            }

            // fill all standard execution slots with express jobs
            while (this.standardQueue.hasCapacity() && this.expressQueue.hasWaitingJobs()) {
                // move express job to standard slot
                switchQueues(this.expressQueue.peek(), this.expressQueue, this.standardQueue, true);
                tickQueue(this.standardQueue);
            }

            // fill all regression slots with express jobs
            while (this.regressionQueue.hasCapacity() && this.expressQueue.hasWaitingJobs()) {
                switchQueues(this.expressQueue.peek(), this.expressQueue, this.regressionQueue, true);
                tickQueue(this.regressionQueue);
            }

            // fill standard slots with standard jobs
            while (this.standardQueue.hasCapacity() && this.standardQueue.hasWaitingJobs()) {
                tickQueue(this.standardQueue);
            }

            // fill regression slots with standard jobs
            while (this.regressionQueue.hasCapacity() && this.standardQueue.hasWaitingJobs()) {
                switchQueues(this.standardQueue.peek(), this.standardQueue, this.regressionQueue, true);
                tickQueue(this.regressionQueue);
            }

            // backfill standard jobs to the express queue, if there is pace
            while (this.expressQueue.hasCapacity() && this.standardQueue.hasWaitingJobs()) {
                switchQueues(this.standardQueue.peek(), this.standardQueue, this.expressQueue, true);
                tickQueue(this.expressQueue);
            }

            // finally, run the regression queue with any of its jobs that are waiting
            while (this.regressionQueue.hasCapacity() && this.regressionQueue.hasWaitingJobs()) {
                tickQueue(this.regressionQueue);
            }

            if (this.standardQueue.length() === 0 && this.standardQueue.numRunning() === 0 &&
                this.expressQueue.length() === 0 && this.expressQueue.numRunning() === 0 &&
                this.regressionQueue.length() === 0 && this.regressionQueue.numRunning() === 0) {
                Log.info("AutoTest::tick(..) - done: queues empty and idle; no new jobs started.");
            } else {
                // Log.info("AutoTest::tick(..) - done - execution slots busy; no new jobs started");
                Log.info("AutoTest::tick(..) - done: " +
                    "express - #wait: " + this.expressQueue.length() + ", #run: " + this.expressQueue.numRunning() + "; " +
                    "standard - #wait: " + this.standardQueue.length() + ", #run: " + this.standardQueue.numRunning() + "; " +
                    "regression - #wait: " + this.regressionQueue.length() + ", #run: " + this.regressionQueue.numRunning() + ".");
            }

            this.persistQueues().then(function (success: boolean) {
                Log.trace("AutoTest::tick() - persist complete: " + success);
            }).catch(function (err) {
                Log.error("AutoTest::tick() - persist queue ERROR: " + err.message);
            });
        } catch (err) {
            Log.error("AutoTest::tick() - ERROR: " + err.message);
        }
    }

    private async persistQueues(): Promise<boolean> {
        Log.trace("AutoTest::persistQueues() - start");
        try {
            const start = Date.now();
            // noinspection ES6MissingAwait
            const writing = [
                this.standardQueue.persist(), // await in Promise.all
                this.regressionQueue.persist(), // await in Promise.all
                this.expressQueue.persist()
            ];
            await Promise.all(writing);
            Log.trace("AutoTest::persistQueues() - done; took: " + Util.took(start));
            return true;
        } catch (err) {
            Log.error("AutoTest::persistQueues() - ERROR: " + err.message);
        }
        return false;
    }

    private loadQueues() {
        try {
            Log.info("AutoTest::loadQueues() - start"); // just warn for now; this is really just for testing
            this.standardQueue.load();
            this.regressionQueue.load();
            this.expressQueue.load();
            Log.info("AutoTest::loadQueues() - done; queues loaded");
        } catch (err) {
            Log.error("AutoTest::loadQueues() - ERROR: " + err.message);
        }
        this.tick();
    }

    /**
     * This is the main extension point for a subclass to respond to an execution completing.
     * The record will be persisted by AutoTest, but any kind of reporting back to users will
     * have to be handled by subclasses.
     *
     * If subclasses do not want to do anything, they can just `return Promise.resolve();`
     * in their implementation.
     *
     * @param {AutoTestResult} data
     * @returns {Promise<void>}
     */
    protected abstract processExecution(data: AutoTestResult): Promise<void>;

    /**
     * Returns whether the commitURL is currently executing the given deliverable.
     *
     * @param {ContainerInput} input
     * @returns {boolean} true if a commit is executing on any of the queues
     */
    protected isCommitExecuting(input: ContainerInput): boolean {
        try {
            if (this.standardQueue.isCommitExecuting(input) === true) {
                return true;
            }

            if (this.expressQueue.isCommitExecuting(input) === true) {
                return true;
            }

            if (this.regressionQueue.isCommitExecuting(input) === true) {
                return true;
            }

            return false;
        } catch (err) {
            Log.error("AutoTest::isCommitExecuting() - ERROR: " + err);
        }
    }

    /**
     * Checks to see of a commit is queued or is currently being executed
     *
     * @param {ContainerInput} input
     * @returns {boolean} true if a commit is on any queue, or is currently executing on any queue.
     */
    protected isOnQueue(input: ContainerInput): boolean {
        let onQueue = false;
        try {
            if (this.isCommitExecuting(input) === true) {
                onQueue = true;
            } else if (this.standardQueue.indexOf(input) >= 0) {
                onQueue = true;
            } else if (this.expressQueue.indexOf(input) >= 0) {
                onQueue = true;
            } else if (this.regressionQueue.indexOf(input) >= 0) {
                onQueue = true;
            }
        } catch (err) {
            Log.error("AutoTest::isOnQueue() - ERROR: " + err);
        }
        return onQueue;
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
                Log.error("AutoTest::handleExecutionComplete(..) - null data; skipping");
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
                // Sends the result payload to Classy for saving in the database.
                // NOTE: If the result was requested after the job was started, the request will not
                // be reflected in the data.input.target fields.
                const resultPayload = await this.classPortal.sendResult(data);
                if (typeof resultPayload.failure !== "undefined") {
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
            Log.info("AutoTest::handleExecutionComplete(..) [JOB] - job complete;   deliv: " +
                data.delivId + "; repo: " + data.repoId + "; SHA: " + data.commitSHA +
                "; took (waiting + execution): " + Util.tookHuman(data.input.target.timestamp));
        } catch (err) {
            Log.error("AutoTest::handleExecutionComplete(..) - ERROR: " + err.message);
        }
    }

    private async handleTick(job: GradingJob) {
        const start = Date.now();
        const input = job.input;
        let record = job.record;
        let gradePayload: AutoTestGradeTransport;

        Log.info("AutoTest::handleTick(..) - start; delivId: " + input.delivId + "; SHA: " + input.target.commitSHA);
        Log.trace("AutoTest::handleTick(..) - input: " + JSON.stringify(input, null, 2));

        try {
            await job.prepare();
            record = await job.run(this.docker);

            let score = -1;
            if (record.output.report !== null && typeof record.output.report.scoreOverall !== "undefined") {
                score = record.output.report.scoreOverall;
            }
            const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
            const org = Config.getInstance().getProp(ConfigKey.org);
            const repoId = input.target.repoId;
            gradePayload = {
                delivId: input.delivId,
                repoId,
                repoURL: `${githubHost}/${org}/${repoId}`,
                score,
                urlName: repoId,
                URL: input.target.commitURL,
                comment: "",
                timestamp: input.target.timestamp,
                custom: {}
            };
        } catch (err) {
            Log.error("AutoTest::handleTick(..) - ERROR in execution for SHA: " + input.target.commitSHA + "; ERROR: " + err);
        } finally {
            await this.handleExecutionComplete(record);
            Log.info("AutoTest::handleTick(..) - complete; delivId: " + input.delivId +
                "; SHA: " + input.target.commitSHA + "; took: " + Util.tookHuman(start));
        }

        if (gradePayload) {
            try {
                await this.classPortal.sendGrade(gradePayload);
            } catch (err) {
                Log.error("AutoTest::handleTick(..) - ERROR sending grade for SHA: " + input.target.commitSHA + "; ERROR: " + err);
            }
        }
    }
}
