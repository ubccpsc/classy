import Log from "../util/Log";
import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven} from "../Types";

export interface IDataStore {

    /**
     * Saves push event (to its own table).
     *
     * Store IContainerInput instead of IPushEvent because this will be
     * easier to resume since it contains course and deliverable info.
     *
     * @param info
     */
    savePush(info: IContainerInput): Promise<void>;

    /**
     * Saves comment event (to its own table).
     *
     * Should only be called _IF_ a response is requested.
     *
     * If a user is over quota, their request should not be added here.
     *
     * @param info
     */
    saveComment(info: ICommentEvent): Promise<void>;

    getCommentRecord(commitUrl: string): Promise<ICommentEvent | null>;

    saveOutputRecord(outputInfo: ICommitRecord): Promise<void>;

    getOutputRecord(commitUrl: string): Promise<ICommitRecord | null>;

    saveFeedbackGivenRecord(request: IFeedbackGiven): Promise<void>;

    getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): Promise<IFeedbackGiven | null>;

    getFeedbackGivenRecordForCommit(commitUrl: string, userName: string): Promise<IFeedbackGiven | null>;
}

/**
 * Simple example for testing.
 */
export class DummyDataStore implements IDataStore {

    public pushes: IContainerInput[] = [];
    public comments: ICommentEvent[] = [];
    public outputRecords: ICommitRecord[] = [];
    public requests: IFeedbackGiven[] = [];

    public savePush(info: IContainerInput): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Log.info("DummyDataStore::savePush(..) - start");
            this.pushes.push(info);
            resolve();
        });
    }

    public saveComment(info: ICommentEvent): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Log.info("DummyDataStore::saveComment(..) - start");
            this.comments.push(info);
            resolve();
        });
    }

    public getCommentRecord(commitUrl: string): Promise<ICommentEvent | null> {
        return new Promise<ICommentEvent | null>((resolve, reject) => {
            for (const record of this.comments) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitUrl) {
                    resolve(record);
                }
            }
            resolve(null);
        });
    }

    public saveOutputRecord(outputInfo: ICommitRecord): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Log.info("DummyDataStore::saveOutputRecord(..) - start");
            this.outputRecords.push(outputInfo);
            resolve();
        });
    }

    public getOutputRecord(commitUrl: string): Promise<ICommitRecord | null> {
        return new Promise<ICommitRecord | null>((resolve, reject) => {
            for (const record of this.outputRecords) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitUrl) {
                    return record;
                }
            }
            return null;
        });
    }

    public saveFeedbackGivenRecord(request: IFeedbackGiven): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.requests.push(request);
            resolve();
        });
    }

    public getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): Promise<IFeedbackGiven | null> {
        return new Promise<IFeedbackGiven | null>((resolve, reject) => {
            const shortList: IFeedbackGiven[] = [];
            for (const req of this.requests) {
                if (req !== null && req.courseId === courseId && req.delivId === delivId && req.userName === userName) {
                    shortList.push(req);
                }
            }
            if (shortList.length === 0) {
                resolve(null);
            } else {
                return Math.max.apply(Math, shortList.map(function (o: IFeedbackGiven) {
                    resolve(o); // return o.timestamp; // NOTE: this does not seem right
                }));
            }
        });
    }

    public getFeedbackGivenRecordForCommit(commitUrl: string, userName: string): Promise<IFeedbackGiven | null> {
        return new Promise<IFeedbackGiven | null>((resolve, reject) => {
            for (const feedback of this.requests) {
                if (feedback !== null && feedback.commitURL === commitUrl && feedback.userName === userName) {
                    return resolve(feedback);
                }
            }
            return resolve(null);
        });
    }
}
