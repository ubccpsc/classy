import {IPushInfo, ICommentInfo, ICommitInfo, IContainerInput, IRequestInfo} from "../Types";
import {Queue} from "./Queue";

import {DummyDataStore} from "./DataStore";
import {DummyClassPortal} from "./ClassPortal";

export class AutoTestHandler {

    private courseId: string;
    private standardQueue = new Queue();
    private expressQueue = new Queue();
    private standardExecution: IContainerInput|null = null;
    private expresssExecution: IContainerInput|null = null;

    private dataStore = new DummyDataStore();
    private classPortal = new DummyClassPortal();
    private testDelay: number;

    constructor(courseId: string) {
        this.courseId = courseId;
        this.testDelay = this.classPortal.getTestDelay(this.courseId);
    }

    /**
     * Handles push events from Github
     *
     * @param info
     */
    public handlePushEvent(info: IPushInfo) {
        const delivId: string = this.getDelivId(info.projectUrl); // current default deliverable
        const input: IContainerInput = {courseId: this.courseId, delivId: delivId, pushInfo: info};
        this.savePushInfo(input);
        this.standardQueue.push(input);
    }

    /**
     * Handles comment events from Github
     *
     * @param info
     */
    public handleCommentEvent(info: ICommentInfo) {
        // update info record
        info.courseId = this.courseId;
        let delivId = info.delivId;
        if (delivId === null) {
            delivId = this.getDelivId(info.commitUrl); // need to get the default deliverable for that repo
            info.delivId = delivId;
        }
        this.saveCommentInfo(info);

        let res: ICommitInfo = this.getOutputRecord(info.commitUrl); // for any user
        if (res !== null) {
            // execution complete
            const hasBeenRequestedBefore = this.dataStore.getFeedbackGivenRecordForCommit(info.commitUrl, info.userName); // students often request grades they have previously 'paid' for
            if (hasBeenRequestedBefore !== null) {
                // just give it to them again, don't charge for event
                // NOTE: can prepend feedback with warning?
                this.postResultToGithub(info.commitUrl, res.output.feedback);
            } else {
                if (this.classPortal.isStaff(this.courseId, info.userName) === true) {
                    this.postResultToGithub(info.commitUrl, res.output.feedback); // can always request
                } else {
                    const requestFeedbackDelay = this.requestFeedbackDelay(delivId, info.userName, info.timestamp);
                    if (canRequest === null) {
                        this.postResultToGithub(info.commitUrl, res.output.feedback);
                        this.saveFeedbackGiven(this.courseId, delivId, info.userName, res.input.pushInfo.timestamp, info.commitUrl);
                    } else {
                        const msg = 'You must wait ' + requestFeedbackDelay + ' before requesting feedback';
                        this.postResultToGithub(info.commitUrl, msg);
                    }
                }
            }
        } else {
            // execution not yet complete
            const isCurrentlyRunning: boolean = this.isCommitExecuting(info.commitUrl, delivId);
            if (isCurrentlyRunning === true) {
                // do nothing, will be handled later when the commit finishes processing
            } else {
                if (this.expressQueue.length() < this.standardQueue.indexOf(info.commitUrl)) {
                    // promote to the express queue
                    const input = this.standardQueue.remove(info.commitUrl);
                    this.expressQueue.push(input);
                } else {
                    // faster to just leave it on the standard queue
                }
            }
        }
    }

    /**
     * Handles the completion of an execution
     *
     * XXX: not sure how this will get called
     *
     * @param data
     */
    public handleExecutionComplete(data: ICommitInfo): void {
        this.dataStore.saveOutputRecord(data);

        const requestorUsername = this.getRequestor(data.commitUrl);
        if (data.output.postbackOnComplete === true) {
            // do this first, doesn't count against quota
            this.postResultToGithub(data.commitUrl, data.output.feedback);
        } else if (requestorUsername !== null) {
            this.saveFeedbackGiven(data.input.courseId, data.input.delivId, requestorUsername, data.input.pushInfo.timestamp, data.commitUrl);
            this.postResultToGithub(data.commitUrl, data.output.feedback);
        } else {
            // do nothing
        }
    }

    public tick() {
        if (typeof this.standardExecution === null) {
            let info = this.standardQueue.pop();
            if (info !== null) {
                this.invokeContainer(info);
            }
        }

        if (typeof this.expresssExecution === null) {
            let info = this.expressQueue.pop();
            if (info !== null) {
                this.invokeContainer(info);
            }
        }
    }


    /**
     * Saves pushInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {IContainerInput} info
     */
    private savePushInfo(info: IContainerInput) {
        this.dataStore.savePush(info);
    }

    /**
     * Saves commentInfo in its own table in the database, in case we need to refer to it later
     *
     * @param {ICommentInfo} info
     */
    private saveCommentInfo(info: ICommentInfo) {
        this.dataStore.saveComment(info);
    }

    /**
     * Saves the commit info
     *
     * @param finalInfo
     */
    private saveInfo(outputInfo: ICommitInfo) {
        this.dataStore.saveOutputRecord(outputInfo);
    }

    /**
     * Starts the container for the commit.
     * Will
     * @param input
     */
    private invokeContainer(input: IContainerInput) {
        // execute with docker

        // generate an ICommitInfo
        let finalInfo: ICommitInfo; // TODO: call docker etc.
        this.saveInfo(finalInfo);

        // when done clear this.expresssExecution or this.standardExecution
        this.tick();
    }

    /**
     * Gets the current deliverable id
     *
     * @param commitUrl
     */
    private getDelivId(commitUrl: string): string {
        // known: this.courseId
        // TODO
    }


    private getOutputRecord(commitUrl: string): ICommitInfo | null {
        return this.dataStore.getOutputRecord(commitUrl);
    }

    /**
     * Tracks that feedback was given for the specified user at the specified time.
     *
     * @param userName
     * @param timestamp
     */
    private saveFeedbackGiven(courseId: string, delivId: string, userName: string, timestamp: number, commitUrl: string): void {
        const record: IRequestInfo = {courseId: courseId, delivId: delivId, userName: userName, timestamp: timestamp, commitUrl: commitUrl};
        this.dataStore.saveFeedbackGivenRecord(record);
    }

    /**
     * Posts the feedback (in markdown) back to the github url.
     *
     * @param commitUrl
     * @param feedback
     */
    private postResultToGithub(commitUrl: string, feedback: string): void {
        // TODO
    }


    /**
     * Return the username that requested the result for the given commitUrl (or null)
     *
     * @param commitUrl
     */
    private getRequestor(commitUrl: string): string | null {
        const record: ICommentInfo = this.dataStore.getCommentRecord(commitUrl);
        if (record !== null) {
            return record.userName;
        }
        return null;
    }

    /**
     * Returns whether the commitUrl is currently executing the given deliverable
     *
     * @param commitUrl
     * @param delivId
     */
    private isCommitExecuting(commitUrl: string, delivId: string): boolean {
        if (this.standardExecution !== null) {
            if (this.standardExecution.pushInfo.commitUrl === commitUrl && this.standardExecution.delivId === delivId) {
                return true;
            }
        }
        if (this.expresssExecution !== null) {
            if (this.expresssExecution.pushInfo.commitUrl === commitUrl && this.expresssExecution.delivId === delivId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check to see if the current user is allowed to make a result request
     *
     * @param commitUrl
     * @param delivId
     * @param userName
     *
     * Empty string means yes.
     */
    private requestFeedbackDelay(delivId: string, userName: string, reqTimestamp: number): string|null {
        if (this.classPortal.isStaff(this.courseId, userName) === true) {
            return null; // staff can always request
        } else {
            const record: IRequestInfo = this.dataStore.getLatestFeedbackGivenRecord(this.courseId, delivId, userName);
            if (record === null) {
                return true; // no prior requests
            } else {
                const delta = (reqTimestamp - record.timestamp) / 1000;
                if (delta > this.testDelay) {
                    return null; // enough time has passed
                } else {
                    return delta + ' seconds'; // too soon
                }
            }
        }
    }
}
