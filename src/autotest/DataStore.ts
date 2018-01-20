import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven} from "../Types";
import Log from "../util/Log";
import Util from "../util/Util";

import * as fs from "fs-extra";
import {Config} from "../Config";

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

    private readonly dir = Config.getInstance().getProp("persistDir");
    private readonly RECORD_PATH = this.dir + "/outputRecords.json";
    private readonly COMMENT_PATH = this.dir + "/commentRecords.json";
    private readonly PUSH_PATH = this.dir + "/pushRecords.json";
    private readonly FEEDBACK_PATH = this.dir + "/feedbackRecords.json";

    constructor() {
        Log.info("DummyDataStore::<init> - start");

        fs.ensureDirSync(this.dir);
        fs.ensureFileSync(this.RECORD_PATH); // TODO: if they didn't exist it should be created with []
        fs.ensureFileSync(this.COMMENT_PATH); // TODO: if they didn't exist it should be created with []
        fs.ensureFileSync(this.PUSH_PATH); // TODO: if they didn't exist it should be created with []
        fs.ensureFileSync(this.FEEDBACK_PATH); // TODO: if they didn't exist it should be created with []
    }

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

    public async saveOutputRecord(outputInfo: ICommitRecord): Promise<void> {
        Log.info("DummyDataStore::saveOutputRecord(..) - start");
        const start = Date.now();
        const path = this.dir + "/outputRecords.json";

        // read
        const outRecords = await fs.readJSON(this.RECORD_PATH);
        // append
        outRecords.push(outputInfo);
        // write
        await fs.writeJSON(path, outRecords);

        Log.info("DummyDataStore::saveOutputRecord(..) - done; took: " + Util.took(start));
    }

    public async getOutputRecord(commitURL: string): Promise<ICommitRecord | null> {
        Log.info("DummyDataStore::getOutputRecord(..) - start");
        const start = Date.now();

        // read
        const outRecords: ICommitRecord[] = await fs.readJSON(this.RECORD_PATH);

        // find and return
        for (const record of outRecords) {
            if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL) {
                Log.info("DummyDataStore::getOutputRecord(..) - found; took: " + Util.took(start));
                return record;
            }
        }

        // not found
        Log.info("DummyDataStore::getOutputRecord(..) - not found; took: " + Util.took(start));
        return null;
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
