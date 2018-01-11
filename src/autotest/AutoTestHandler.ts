import {IPushInfo, ICommentInfo, ICommitInfo, IContainerInput, IRequestInfo} from "../Types";
import {Queue} from "./Queue";

import {DummyDataStore, IDataStore} from "./DataStore";
import {DummyClassPortal, IClassPortal} from "./ClassPortal";

export class AutoTestHandler {

    private readonly courseId: string;
    private readonly testDelay: number;

    private standardQueue = new Queue();
    private expressQueue = new Queue();
    // these could be arrays if we wanted a thread pool model
    private standardExecution: IContainerInput|null = null;
    private expresssExecution: IContainerInput|null = null;

    // TODO: update to real implementations of these interfaces
    private dataStore: IDataStore = new DummyDataStore();
    private classPortal: IClassPortal = new DummyClassPortal();

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
        try {
            const delivId: string = this.getDelivId(info.projectUrl); // current default deliverable
            const input: IContainerInput = {courseId: this.courseId, delivId: delivId, pushInfo: info};
            this.savePushInfo(input);
            this.standardQueue.push(input);
        } catch (err) {
            console.error('AutoTestHandler::handlePushEvent(..) - course: ' + this.courseId + '; ERROR: ' + err.message);
        }
    }

    /**
     * Handles comment events from Github
     *
     * @param info
     */
    public handleCommentEvent(info: ICommentInfo) {
        try {
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
                let shouldPost = false; // should the result be given
                let shouldCount = false; // should it count against their quota

                const hasBeenRequestedBefore = this.dataStore.getFeedbackGivenRecordForCommit(info.commitUrl, info.userName); // students often request grades they have previously 'paid' for
                if (hasBeenRequestedBefore !== null) {
                    // just give it to them again, don't charge for event
                    shouldPost = true;
                    shouldCount = false;
                }

                if (this.classPortal.isStaff(this.courseId, info.userName) === true) {
                    shouldPost = true;
                    shouldCount = false;
                } else {
                    const requestFeedbackDelay = this.requestFeedbackDelay(delivId, info.userName, info.timestamp);
                    if (requestFeedbackDelay === null) {
                        shouldPost = true;
                        shouldCount = true;
                    } else {
                        shouldPost = false;
                        shouldCount = false;
                        const msg = 'You must wait ' + requestFeedbackDelay + ' before requesting feedback';
                        this.postResultToGithub(info.commitUrl, msg);
                    }
                }

                if (shouldPost === true) {
                    this.postResultToGithub(info.commitUrl, res.output.feedback);
                }
                if (shouldCount === true) {
                    this.saveFeedbackGiven(this.courseId, delivId, info.userName, res.input.pushInfo.timestamp, info.commitUrl);
                }
            } else {
                // execution not yet complete
                const isCurrentlyRunning: boolean = this.isCommitExecuting(info.commitUrl, delivId);
                if (isCurrentlyRunning === true) {
                    // do nothing, will be handled later when the commit finishes processing
                } else {
                    if (this.expressQueue.length() > this.standardQueue.indexOf(info.commitUrl)) {
                        // faster to just leave it on the standard queue
                    } else {
                        // promote to the express queue
                        const input = this.standardQueue.remove(info.commitUrl);
                        this.expressQueue.push(input);
                    }
                }
            }
        } catch (err) {
            console.error('AutoTestHandler::handleCommentEvent(..) - course: ' + this.courseId + '; ERROR: ' + err.message);
        }
    }

    /**
     * Called when a container completes.
     *
     * @param data
     */
    public handleExecutionComplete(data: ICommitInfo): void {
        try {
            this.dataStore.saveOutputRecord(data);

            const requestorUsername = this.getRequestor(data.commitUrl);
            if (data.output.postbackOnComplete === true) {
                // do this first, doesn't count against quota
                this.postResultToGithub(data.commitUrl, data.output.feedback);
            } else if (requestorUsername !== null) {
                // feedback has een requested
                this.postResultToGithub(data.commitUrl, data.output.feedback);
                this.saveFeedbackGiven(data.input.courseId, data.input.delivId, requestorUsername, data.input.pushInfo.timestamp, data.commitUrl);
            } else {
                // do nothing
            }

            // when done clear the execution slot and schedule the next
            if (data.commitUrl === this.expresssExecution.pushInfo.commitUrl) {
                this.expresssExecution = null;
            }
            if (data.commitUrl === this.standardExecution.pushInfo.commitUrl) {
                this.standardExecution = null;
            }
            this.tick();
        } catch (err) {
            console.error('AutoTestHandler::handleExecutionComplete(..) - course: ' + this.courseId + '; ERROR: ' + err.message);
        }
    }

    public tick() {
        try {
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
        } catch (err) {
            console.error('AutoTestHandler::tick() - course: ' + this.courseId + '; ERROR: ' + err.message);
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
     * Starts the container for the commit.
     *
     *
     * @param input
     */
    private invokeContainer(input: IContainerInput) {
        // execute with docker

        let finalInfo: ICommitInfo; // TODO: call docker etc.
        // TODO: must handle container timeout
        // TODO: must do something with stdio
        // TODO: must handle all attachments / other files
        this.handleExecutionComplete(finalInfo);
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
     * Returns whether the commitUrl is currently executing the given deliverable.
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
