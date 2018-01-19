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
    savePush(info: IContainerInput): void; // Promise<void>

    /**
     * Saves comment event (to its own table).
     *
     * Should only be called _IF_ a response is requested.
     *
     * If a user is over quota, their request should not be added here.
     *
     * @param info
     */
    saveComment(info: ICommentEvent): void; // Promise<void>

    getCommentRecord(commitUrl: string): ICommentEvent | null; // Promise<ICommentEvent | null>

    saveOutputRecord(outputInfo: ICommitRecord): void; // Promise<void>

    getOutputRecord(commitUrl: string): ICommitRecord | null;  // Promise<ICommitRecord | null>

    saveFeedbackGivenRecord(request: IFeedbackGiven): void;  // Promise<void>

    getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): IFeedbackGiven | null;  // Promise<IFeedbackGiven | null>

    getFeedbackGivenRecordForCommit(commitUrl: string, userName: string): IFeedbackGiven | null;  // Promise<IFeedbackGiven | null>
}

/**
 * Simple example for testing.
 */
export class DummyDataStore implements IDataStore {

    public pushes: IContainerInput[] = [];
    public comments: ICommentEvent[] = [];
    public outputRecords: ICommitRecord[] = [];
    public requests: IFeedbackGiven[] = [];

    public savePush(info: IContainerInput) {
        Log.info("DummyDataStore::savePush(..) - start");
        this.pushes.push(info);
    }

    public saveComment(info: ICommentEvent) {
        Log.info("DummyDataStore::saveComment(..) - start");
        this.comments.push(info);
    }

    public getCommentRecord(commitUrl: string) {
        for (const record of this.comments) {
            if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitUrl) {
                return record;
            }
        }
        return null;
    }

    public saveOutputRecord(outputInfo: ICommitRecord) {
        Log.info("DummyDataStore::saveOutputRecord(..) - start");
        this.outputRecords.push(outputInfo);
    }

    public getOutputRecord(commitUrl: string) {
        for (const record of this.outputRecords) {
            if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitUrl) {
                return record;
            }
        }
        return null;
    }

    public saveFeedbackGivenRecord(request: IFeedbackGiven): void {
        this.requests.push(request);
    }

    public getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): IFeedbackGiven | null {
        const shortList: IFeedbackGiven[] = [];
        for (const req of this.requests) {
            if (req !== null && req.courseId === courseId && req.delivId === delivId && req.userName === userName) {
                shortList.push(req);
            }
        }
        if (shortList.length === 0) {
            return null;
        } else {
            return Math.max.apply(Math, shortList.map(function (o: IFeedbackGiven) {
                return o.timestamp;
            }));
        }
    }

    public getFeedbackGivenRecordForCommit(commitUrl: string, userName: string): IFeedbackGiven | null {
        for (const feedback of this.requests) {
            if (feedback !== null && feedback.commitURL === commitUrl && feedback.userName === userName) {
                return feedback;
            }
        }
        return null;
    }
}
