import * as Docker from "dockerode";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {AutoTestResult} from "@common/types/AutoTestTypes";
import {ContainerInput} from "@common/types/ContainerTypes";
import {AutoTestGradeTransport, AutoTestStatus} from "@common/types/PortalTypes";
import Util from "@common/Util";

import {IClassPortal} from "./ClassPortal";
import {IDataStore} from "./DataStore";
import {GradingJob} from "./GradingJob";
import {MockGradingJob} from "./mocks/MockGradingJob";
import {Queue} from "./Queue";
import * as fs from "fs-extra";

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
     * @param {boolean} force whether the element should ignore queue limits
     */
    addToStandardQueue(element: ContainerInput, force: boolean): void;

    /**
     * Adds a new job to be processed by the low queue.
     *
     * @param {ContainerInput} element
     */
    addToLowQueue(element: ContainerInput): void;

    /**
     * Updates the internal clock of the handler. This might or might not do anything.
     *
     * But if there is space to start a new job, and any queue has jobs waiting,
     * a waiting job should be started.
     */
    tick(): void;
}

/**
 * Handles the scheduling and prioritization of AutoTest jobs.
 *
 * In general, queueing looks like this:
 *
 * 1) Express jobs are always handled if there is a job waiting
 * and space for one to start.
 *
 * 2) Standard jobs run when no express jobs are waiting. If too
 * many jobs are added to this queue from a single user the
 * jobs are demoted to the low queue.
 *
 * 3) Low jobs are run when no express or standard jobs
 * are waiting.
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
     * All explicit requests go on the express queue. No implicit requests
     * are added to this queue. Staff/Admin jobs are placed on the head
     * of the express queue.
     *
     * While there is no threshold on the number of jobs a student can put
     * on the express queue, the charging mechanism should ensure that only
     * jobs the student is allowed to request (e.g., enough time has passed)
     * are added to the queue.
     *
     * @private {Queue}
     */
    private expressQueue = new Queue("exp");

    /**
     * Standard jobs. Always execute after Express jobs, but also always
     * before any low jobs.
     *
     * These slots exist so that students who push at a reasonable cadence
     * have their jobs handled more quickly than those who push rapidly.
     *
     * To ensure feedback is timely, any scheduled standard job that exceeds
     * the job threshold will be replaced (without losing its queue position)
     * with the more recent job. Replaced jobs will be moved to the low queue.
     *
     * @private {Queue}
     */
    private standardQueue = new Queue("std");

    /**
     * Low priority jobs. These will happen whenever they can. Repos
     * that push too rapidly will have their jobs demoted to the
     * low queue.
     *
     * When the low queue threshold is passed the oldest jobs _will_ be
     * removed and will not be graded. This should rarely happen. But if
     * it does, any request on one of these old jobs will cause the job
     * to run as it will be added to the express queue. As the deadline nears,
     * the jobs will be newer than those previously requested so the jobs
     * closest to any deadline will always be run.
     *
     * @private {Queue}
     */
    private lowQueue = new Queue("low");

    /**
     * The maximum number of jobs a single user can have on the standard queue
     * before it will schedule on the low queue instead.
     *
     * This threshold will be overridden by comment events, which will all be
     * scheduled on the standard queue unless the user has space on the
     * express queue.
     *
     * @private
     */
    private readonly MAX_STANDARD_JOBS: number = 2;

    /**
     * The maximum number of jobs a single user can have on the low queue
     * before we overwrite older requests with the newer requests. The
     * intuition here is that if a student has more than MAX_LOW_JOBS
     * on the queue, they probably care about the results of the most
     * recent jobs more than the older jobs.
     *
     * @private
     */
    private readonly MAX_LOW_JOBS: number = 10;

    /**
     * Max number of execution jobs.
     */
    private readonly numJobs: number;

    private readonly DEFAULT_NUM_JOBS = 5;

    /**
     * List of executing jobs.
     *
     * @private
     */
    private jobs: ContainerInput[] = [];

    constructor(dataStore: IDataStore, classPortal: IClassPortal, docker: Docker) {
        Log.trace("AutoTest::<init> - starting AutoTest");
        this.dataStore = dataStore;
        this.classPortal = classPortal;
        this.docker = docker;

        const config = Config.getInstance();
        let numJobs = this.DEFAULT_NUM_JOBS;
        if (config.hasProp(ConfigKey.autotestJobs) === true) {
            numJobs = Util.toInteger(config.getProp(ConfigKey.autotestJobs), this.DEFAULT_NUM_JOBS);
        }
        this.numJobs = numJobs;
        Log.info("AutoTest::<init> - starting AutoTest; numJobs: " + this.numJobs);

        // load the queues after the number of jobs has been defined
        this.loadQueues();
    }

    /**
     * Adds a job to the express queue. A user can only ask for a single job to go on
     * the express queue at a time. If the job is already executing on any other queue
     * it will not be added.
     *
     * @param input
     */
    public addToExpressQueue(input: ContainerInput): void {
        Log.info("AutoTest::addToExpressQueue(..) - start" +
            "; deliv: " + input.target.delivId +
            "; repo: " + input.target.repoId +
            "; SHA: " + Util.shaHuman(input.target.commitSHA));
        try {
            if (this.isCommitExecuting(input)) {
                Log.info("AutoTest::addToExpressQueue(..) - not added; commit already executing");
                return;
            }

            // if (this.expressQueue.numberJobsForPerson(input) < 1) {
            // add to express queue since they are not already on it
            this.expressQueue.push(input);

            // if job is on any other queue, remove it
            this.standardQueue.remove(input);
            this.lowQueue.remove(input);
            // } else {
            //     Log.info("AutoTest::addToExpressQueue(..) - user: " +
            //         input.target.personId + " already has job on express queue" +
            //         "; adding SHA: " + Util.shaHuman(input.target.commitSHA) + " to standard queue");
            //
            //     // express queue already has a job for this user, move to standard
            //     this.addToStandardQueue(input);
            // }
        } catch (err) {
            Log.error("AutoTest::addToExpressQueue(..) - ERROR: " + err);
        }
    }

    public addToStandardQueue(input: ContainerInput, forceAdd: boolean): void {
        Log.info("AutoTest::addToStandardQueue(..) - start" +
            "; deliv: " + input.target.delivId +
            "; repo: " + input.target.repoId +
            "; SHA: " + Util.shaHuman(input.target.commitSHA));

        try {
            if (this.isCommitExecuting(input)) {
                Log.info("AutoTest::addToStandardQueue(..) - not added; commit already executing");
                return;
            }

            // only add job if it is not already on express
            if (this.expressQueue.indexOf(input) >= 0) {
                Log.info("AutoTest::addToStandardQueue(..) - skipped; " +
                    "job already on express queue; SHA: " + Util.shaHuman(input.target.commitSHA));
                return;
            }

            const stdJobCount = this.standardQueue.numberJobsForPerson(input);
            const lowJobCount = this.lowQueue.numberJobsForPerson(input);

            if (forceAdd === true) {
                Log.info("AutoTest::addToStandardQueue(..) - repo: " +
                    input.target.repoId + "; has # " + stdJobCount +
                    " std jobs queued and # " + lowJobCount +
                    " low jobs queued; forceAdd === true, added to std");
                this.standardQueue.push(input);
                this.lowQueue.remove(input); // if job is on any other queue, remove it
                return;
            }

            // this is fairly permissive; only queued jobs (not executing jobs) are counted
            if (stdJobCount <= this.MAX_STANDARD_JOBS) {
                Log.info("AutoTest::addToStandardQueue(..) - repo: " +
                    input.target.repoId + "; has # " + stdJobCount +
                    " std jobs queued and # " + lowJobCount +
                    " low jobs queued; added to std");
                this.standardQueue.push(input);
                this.lowQueue.remove(input); // if job is on any other queue, remove it
            } else {
                Log.info("AutoTest::addToStandardQueue(..) - repo: " +
                    input.target.repoId + "; has # " + stdJobCount +
                    " standard jobs queued and # " + lowJobCount +
                    " low jobs queued; old std job replaced and moved to low");

                // forceAdd is false in this case because force was handled above
                const replacedJob = this.standardQueue.replaceOldestForPerson(input, false);
                this.lowQueue.remove(input); // if job is on any other queue, remove it

                if (replacedJob !== null) {
                    this.addToLowQueue(replacedJob);
                }
            }
        } catch (err) {
            Log.error("AutoTest::addToStandardQueue(..) - ERROR: " + err);
        }
    }

    public addToLowQueue(input: ContainerInput): void {
        Log.info("AutoTest::addToLowQueue(..) - start" +
            "; deliv: " + input.target.delivId +
            "; repo: " + input.target.repoId +
            "; SHA: " + Util.shaHuman(input.target.commitSHA));

        try {
            if (this.isCommitExecuting(input)) {
                Log.info("AutoTest::addToLowQueue(..) - not added; commit already executing");
                return;
            }

            if (this.expressQueue.indexOf(input) >= 0 || this.standardQueue.indexOf(input) >= 0) {
                // already on faster queue
                Log.info("AutoTest::addToLowQueue(..) - skipped; " +
                    "job already on standard or express queue; SHA: " + Util.shaHuman(input.target.commitSHA));
                return;
            }

            const lowJobCount = this.lowQueue.numberJobsForPerson(input);
            if (lowJobCount > this.MAX_LOW_JOBS) {
                Log.warn("AutoTest::addToLowQueue(..) - user has _many_ queued jobs, " +
                    "will replace oldest job with this job; repo: " + input.target.repoId + "; person: " + input.target.personId);
                // Replace oldest job instead of adding.
                // This can reduce the impact of DOS attacks
                // or users that are pushing too rapidly.
                // Students can always request the results on any job,
                // even if has been replaced, so a replaced job can
                // still be graded.

                // failsafe: forceAdd should not matter because there _must_ be
                // an older job queued because requested jobs all go on express
                this.lowQueue.replaceOldestForPerson(input, true);
            } else {
                // add to the low queue
                this.lowQueue.push(input);
            }
        } catch (err) {
            Log.error("AutoTest::addToLowQueue(..) - ERROR: " + err);
        }
    }

    /**
     * Advance the queues. Does nothing if all execution jobs are full.
     */
    public tick(): void {
        try {
            Log.info("AutoTest::tick(..) - start: " +
                "# exp: " + this.expressQueue.length() + "; " +
                "# std: " + this.standardQueue.length() + "; " +
                "# low: " + this.lowQueue.length());

            // let updated = false;
            const that = this;

            const tickQueue = function (queue: Queue): void {
                if (queue.length() > 0 && that.hasCapacity() === true) {
                    const info: ContainerInput = queue.pop(); // get the job
                    that.jobs.push(info); // put it on the execution queue

                    const totalNumQueued = that.expressQueue.length() + that.standardQueue.length() + that.lowQueue.length();
                    const totalJobsRunning = that.jobs.length;
                    Log.info("AutoTest::tick::tickQueue(..)         [JOB] - job start: " + queue.getName() + "; deliv: " +
                        info.target.delivId + "; repo: " + info.target.repoId + "; SHA: " + Util.shaHuman(info.target.commitSHA) +
                        "; # running: " + totalJobsRunning + "; # queued: " + totalNumQueued + " ( e: " + that.expressQueue.length() + ", s: " +
                        that.standardQueue.length() + ", l: " + that.lowQueue.length() + " )");

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

            // handle the queues in order: express -> standard -> low
            while (that.hasCapacity() && this.expressQueue.hasWaitingJobs()) {
                tickQueue(this.expressQueue);
            }

            while (that.hasCapacity() && this.standardQueue.hasWaitingJobs()) {
                tickQueue(this.standardQueue);
            }

            while (that.hasCapacity() && this.lowQueue.hasWaitingJobs()) {
                tickQueue(this.lowQueue);
            }

            Log.info("AutoTest::tick(..) - done:  " +
                "# exp: " + this.expressQueue.length() + "; " +
                "# std: " + this.standardQueue.length() + "; " +
                "# low: " + this.lowQueue.length());

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
        Log.trace("AutoTest::persistQueues()");
        try {
            const start = Date.now();
            // noinspection ES6MissingAwait
            const writing = [
                this.standardQueue.persist(), // await in Promise.all
                this.lowQueue.persist(), // await in Promise.all
                this.expressQueue.persist() // await in Promise.all
            ];
            await Promise.all(writing);

            // we have persisted the queues, but not the executing jobs
            fs.mkdirpSync(Config.getInstance().getProp(ConfigKey.persistDir) + "/queues");
            const slotsFName = Config.getInstance().getProp(ConfigKey.persistDir) + "/queues/executing.json";
            const jobs = {data: this.jobs};
            await fs.writeJSON(slotsFName, jobs);

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
            this.lowQueue.load();
            this.expressQueue.load();
            const numQueued = this.expressQueue.length() + this.standardQueue.length() + this.lowQueue.length();
            Log.info("AutoTest::loadQueues() - queues loaded; # queued: " + numQueued);

            // read the executing jobs and push onto the head of the express queue so they will start right away
            const slotsFName = Config.getInstance().getProp(ConfigKey.persistDir) + "/queues/executing.json";
            const store = fs.readJSONSync(slotsFName, {throws: false});
            if (store?.data?.length === undefined) {
                // read failed; skip hydrating
                Log.info("AutoTest::loadQueues() - rehydrating jobs skipped");
            } else {

                // Log.info("Queue::load() - rehydrating: " + this.name + " from: " + this.persistDir);
                Log.info("AutoTest::loadQueues() - jobs loaded; # jobs: " + store.data.length);

                // put executions that were running but not done on the front of the queue
                for (const job of store.data) {
                    Log.info("AutoTest::loadQueues() - adding job to HEAD; repo: " +
                        job.target.repoId + "; SHA: " + Util.shaHuman(job.target.commitSHA));
                    this.expressQueue.pushFirst(job);
                }
            }
        } catch (err) {
            Log.error("AutoTest::loadQueues() - ERROR: " + err.message);
        }
        this.tick(); // start any jobs that were loaded
        Log.info("AutoTest::loadQueues() - done");
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
     * Returns whether the <commitURL, delivId, ref> is currently executing.
     *
     * Note: it is possible for the same commitSHA to come from two different
     * branches simultaneously (e.g., this often happens with merge commits).
     *
     * @param {ContainerInput} input
     * @returns {boolean} true if a commit is executing on any of the queues
     */
    protected isCommitExecuting(input: ContainerInput): boolean {
        try {
            for (const execution of this.jobs) {
                if (execution.target.commitURL === input.target.commitURL &&
                    execution.target.delivId === input.target.delivId &&
                    execution.target.ref === input.target.ref) {
                    return true;
                }
            }
            return false;
        } catch (err) {
            Log.error("AutoTest::isCommitExecuting() - ERROR: " + err);
            return false;
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
            } else if (this.lowQueue.indexOf(input) >= 0) {
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
     * Persist record (could decide to move this persistence into ClassPortal::sendResult in future).
     * Post back if specified by container output.
     * Post back if requested by TA.
     * Post back if requested by user and quota allows (and record feedback given).
     *
     * @param data
     */
    private async handleExecutionComplete(data: AutoTestResult): Promise<void> {
        try {
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
                ": deliv: " + data.delivId + "; repo: " + data.repoId +
                "; SHA: " + Util.shaHuman(data.commitSHA)
            );

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

            // when done clear the execution job and schedule the next
            const commitURL = data.commitURL;
            const delivId = data.delivId;
            const ref = data.input.target.ref;
            this.clearExecution(commitURL, delivId, ref);

            // execution done, advance the clock
            this.tick();

            if (typeof data.input.target.tsJobStart === "undefined") {
                data.input.target.tsJobStart = data.input.target.timestamp;
            }
            Log.info("AutoTest::handleExecutionComplete(..) [JOB] - job complete;   deliv: " +
                data.delivId + "; repo: " + data.repoId + "; SHA: " + Util.shaHuman(data.commitSHA) +
                "; wait: " + Util.tookHuman(data.input.target.timestamp, data.input.target.tsJobStart, true) +
                "; exec: " + Util.tookHuman(data.input.target.tsJobStart, data.output.timestamp, true));
        } catch (err) {
            Log.error("AutoTest::handleExecutionComplete(..) - ERROR: " + err.message);
        }
    }

    private async handleTick(job: GradingJob) {
        const start = Date.now();

        let gradePayload: AutoTestGradeTransport;
        let record = job.record;
        const input = job.input;

        // update the containerInfo so it is current
        // usually there will be no difference, but for long queues we would like
        // to ensure the grading container is current (e.g., if the grader is changed
        // while a job is on the queue, the current grader should be used, not the
        // grade that was specified when the request was made)
        try {
            const containerConfig = await this.classPortal.getContainerDetails(input.target.delivId);
            if (containerConfig !== null && input.containerConfig.dockerImage !== containerConfig.dockerImage) {
                Log.info("AutoTest::handleTick(..) - stale job; old container: " +
                    input.containerConfig.dockerImage + "; new container: " + containerConfig.dockerImage);
                input.containerConfig = containerConfig;
            }
        } catch (err) {
            Log.warn("AutoTest::handleTick(..) - problem updating container config: " + err.message);
            // proceed without updating container config
        }

        input.target.tsJobStart = start;
        Log.info("AutoTest::handleTick(..) - start; deliv: " + input.target.delivId +
            "; repo: " + input.target.repoId + "; SHA: " + Util.shaHuman(
                input.target.commitSHA) + "; container: " + input.containerConfig.dockerImage);

        try {
            await job.prepare();
            record = await job.run(this.docker);

            Log.info("AutoTest::handleTick(..) - executed; deliv: " + input.target.delivId +
                "; repo: " + input.target.repoId + "; SHA: " + Util.shaHuman(input.target.commitSHA));

            let score = -1;
            if (record.output.report !== null && typeof record.output.report.scoreOverall !== "undefined") {
                score = record.output.report.scoreOverall;
            }
            const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
            const org = Config.getInstance().getProp(ConfigKey.org);
            const repoId = input.target.repoId;
            gradePayload = {
                delivId: input.target.delivId,
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
        }

        if (gradePayload) {
            try {
                await this.classPortal.sendGrade(gradePayload);
            } catch (err) {
                Log.error("AutoTest::handleTick(..) - ERROR sending grade for SHA: " + input.target.commitSHA + "; ERROR: " + err);
            }
        }
        Log.info("AutoTest::handleTick(..) - done; deliv: " + input.target.delivId +
            "; repo: " + input.target.repoId +
            "; SHA: " + Util.shaHuman(input.target.commitSHA) + "; took: " + Util.tookHuman(start));
    }

    /**
     * Returns true if there is capacity for executing a new job.
     *
     * @private
     */
    private hasCapacity() {
        if (this.jobs.length < this.numJobs) {
            return true;
        }
        return false;
    }

    /**
     * Removes a job <commitURL:deliv:ref tuple> from the jobs list.
     *
     * @param commitURL
     * @param delivId
     * @param ref
     */
    private clearExecution(commitURL: string, delivId: string, ref: string | undefined): boolean {
        let removed = false;
        for (let i = this.jobs.length - 1; i >= 0; i--) {
            const execution = this.jobs[i];
            if (execution !== null) {
                if (execution.target.commitURL === commitURL &&
                    execution.target.delivId === delivId &&
                    execution.target.ref === ref) {
                    // remove this one
                    const lenBefore = this.jobs.length;
                    this.jobs.splice(i, 1);
                    const lenAfter = this.jobs.length;
                    Log.trace("Queue::clearExecution( .., " + delivId + " ) - # before: " + lenBefore +
                        "; # after: " + lenAfter + "; commitURL: " + commitURL);
                    removed = true;
                }
            }
        }
        return removed;
    }

    /**
     * Returns the AutoTest queue status.
     */
    public getStatus(): AutoTestStatus {
        return {
            executing: this.jobs.length,
            exp: this.expressQueue.length(),
            std: this.standardQueue.length(),
            low: this.lowQueue.length()
        };
    }
}
