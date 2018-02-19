import {ICommentEvent, ICommitRecord, IContainerInput} from "../Types";
import Log from "../util/Log";
import Util from "../util/Util";
import {IDataStore} from "./DataStore";
import Grader from "./Grader";
import {Queue} from "./Queue";
import {MockGrader} from "./mocks/MockGrader";

export interface IAutoTest {
    /**
     * Adds a new job to be processed by the standard queue.
     *
     * @param {IContainerInput} element
     */
    addToStandardQueue(element: IContainerInput): void;

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
    protected readonly courseId: string;
    protected readonly dataStore: IDataStore;

    private regressionQueue = new Queue();
    private standardQueue = new Queue();
    private expressQueue = new Queue();

    // these could be arrays if we wanted a thread pool model
    private regressionExecution: IContainerInput | null = null;
    private standardExecution: IContainerInput | null = null;
    private expresssExecution: IContainerInput | null = null;

    constructor(courseId: string, dataStore: IDataStore) {
        this.courseId = courseId;
        this.dataStore = dataStore;
    }

    public addToStandardQueue(input: IContainerInput): void {
        Log.info("AutoTest::addToStandardQueue(..) - start; commit: " + input.pushInfo.commitSHA);
        try {
            this.standardQueue.push(input);
        } catch (err) {
            Log.error("AutoTest::addToStandardQueue(..) - ERROR: " + err);
        }
    }

    public tick() {
        try {
            Log.info("AutoTest::tick(..) - start; queues - #std: " + this.standardQueue.length() + "; #exp: " + this.expressQueue.length() + "; #reg: " + this.regressionQueue.length());

            let updated = false;
            if (this.standardExecution === null && this.standardQueue.length() > 0) {
                Log.info("AutoTest::tick(..) - standard queue clear; launching new job");
                updated = true;
                const info = this.standardQueue.pop();
                if (info !== null) {
                    this.standardExecution = info;
                    this.invokeContainer(info); // NOTE: not awaiting on purpose (let it finish in the background)!
                }
            }

            if (this.expresssExecution === null && this.expressQueue.length() > 0) {
                Log.info("AutoTest::tick(..) - express queue clear; launching new job");
                updated = true;
                const info = this.expressQueue.pop();
                if (info !== null) {
                    this.expresssExecution = info;
                    this.invokeContainer(info); // NOTE: not awaiting on purpose (let it finish in the background)!
                }
            }

            if (this.regressionExecution === null && this.regressionQueue.length() > 0) {
                Log.info("AutoTest::tick(..) - regression queue clear; launching new job");
                updated = true;
                const info = this.regressionQueue.pop();
                if (info !== null) {
                    this.regressionExecution = info;
                    this.invokeContainer(info); // NOTE: not awaiting on purpose (let it finish in the background)!
                }
            }

            if (updated === false) {
                Log.info("AutoTest::tick(..) - execution slots busy; no new jobs started");
            }

            Log.info("AutoTest::tick(..) - done");
        } catch (err) {
            Log.error("AutoTest::tick() - course: " + this.courseId + "; ERROR: " + err.message);
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
     * @param {ICommitRecord} data
     * @returns {Promise<void>}
     */
    protected abstract processExecution(data: ICommitRecord): Promise<void>;

    protected async getOutputRecord(commitURL: string, delivId: string): Promise<ICommitRecord | null> {
        try {
            const ret = await this.dataStore.getOutputRecord(commitURL, delivId);
            return ret;
        } catch (err) {
            Log.error("AutoTest::getOutputRecord() - ERROR: " + err);
        }
    }

    /**
     * Returns whether the commitURL is currently executing the given deliverable.
     *
     * @param commitURL
     * @param delivId
     */
    protected isCommitExecuting(commitURL: string, delivId: string): boolean {
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

            if (this.regressionExecution !== null) {
                if (this.regressionExecution.pushInfo.commitURL === commitURL && this.regressionExecution.delivId === delivId) {
                    return true;
                }
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
    protected promoteIfNeeded(info: ICommentEvent): void {
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
     * Persist record.
     * Post back if specified by container output.
     * Post back if requested by TA
     * Post back if requested by user and quota allows (and record feedback given)
     *
     * @param data
     */
    private async handleExecutionComplete(data: ICommitRecord): Promise<void> {
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
                Log.error("AutoTest::handleExecutionComplete(..) - missing required field; skipping; data: " + JSON.stringify(data));
                return;
            }

            await this.dataStore.saveOutputRecord(data);

            try {
                await this.processExecution(data);
            } catch (err) {
                // just eat this error so subtypes do not break our queue handling
                Log.error("AutoTest::handleExecutionComplete(..) - ERROR; from processExecution: " + err);
            }

            // when done clear the execution slot and schedule the next
            if (this.expresssExecution !== null && this.expresssExecution.pushInfo.commitURL === data.commitURL) {
                Log.trace("AutoTest::handleExecutionComplete(..) - clearing express slot");
                this.expresssExecution = null;
            }
            if (this.standardExecution !== null && this.standardExecution.pushInfo.commitURL === data.commitURL) {
                Log.trace("AutoTest::handleExecutionComplete(..) - clearing standard slot");
                this.standardExecution = null;
            }

            if (this.regressionExecution !== null && this.regressionExecution.pushInfo.commitURL === data.commitURL) {
                Log.trace("AutoTest::handleExecutionComplete(..) - clearing regression slot");
                this.regressionExecution = null;
            }

            // execution done, advance the clock
            this.tick();
            Log.info("AutoTest::handleExecutionComplete(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("AutoTest::handleExecutionComplete(..) - course: " + this.courseId + "; ERROR: " + err.message);
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
}
