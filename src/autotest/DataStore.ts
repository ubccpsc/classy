import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven, IPushEvent} from "../Types";
import Log from "../util/Log";
import Util from "../util/Util";

import * as fs from "fs-extra";
import {Config} from "../Config";

export interface IDataStore {

    /**
     * Gets the push event record for a given commitURL
     */
    getPushRecord(commitURL: string): Promise<IPushEvent | null>;

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

    getCommentRecord(commitUrl: string, delivId: string): Promise<ICommentEvent | null>;

    saveOutputRecord(outputInfo: ICommitRecord): Promise<void>;

    getOutputRecord(commitUrl: string): Promise<ICommitRecord | null>;

    saveFeedbackGivenRecord(request: IFeedbackGiven): Promise<void>;

    getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): Promise<IFeedbackGiven | null>;

    getFeedbackGivenRecordForCommit(commitUrl: string, userName: string): Promise<IFeedbackGiven | null>;

    /**
     * Debugging / testing only, should not be commonly used.
     *
     * @returns {Promise<{records: ICommitRecord[]; comments: ICommentEvent[]; pushes: IPushEvent[]; feedback: IFeedbackGiven[]}>}
     */
    getAllData(): Promise<{ records: ICommitRecord[], comments: ICommentEvent[], pushes: IPushEvent[], feedback: IFeedbackGiven[] }>;

    /**
     * Debugging only:
     *
     * Should only succeed if Config.getInstance().getProp("name") === test
     */
    clearData(): void;
}

/**
 * Simple example for testing.
 */
export class DummyDataStore implements IDataStore {

    private readonly dir = Config.getInstance().getProp("persistDir");
    private readonly RECORD_PATH = this.dir + "/outputRecords.json";
    private readonly COMMENT_PATH = this.dir + "/commentRecords.json";
    private readonly PUSH_PATH = this.dir + "/pushRecords.json";
    private readonly FEEDBACK_PATH = this.dir + "/feedbackRecords.json";

    constructor() {
        Log.info("DummyDataStore::<init> - start; dir: " + this.dir);

        try {
            if (this.dir === null) {
                throw new Error("DataStore::<init> - persistDir must be specified in Config");
            }

            fs.ensureDirSync(this.dir);

            // these are terrible, but .ensureFileSync doesn't tell us if we just created a new file
            // write an empty array to each file if it was just created above
            if (!fs.existsSync(this.RECORD_PATH)) {
                fs.writeJSONSync(this.RECORD_PATH, []);
            }
            if (!fs.existsSync(this.COMMENT_PATH)) {
                fs.writeJSONSync(this.COMMENT_PATH, []);
            }
            if (!fs.existsSync(this.PUSH_PATH)) {
                fs.writeJSONSync(this.PUSH_PATH, []);
            }
            if (!fs.existsSync(this.FEEDBACK_PATH)) {
                fs.writeJSONSync(this.FEEDBACK_PATH, []);
            }
        } catch (err) {
            Log.info("DummyDataStore::<init> - ERROR: " + err);
        }
    }

    /**
     * Gets the push event record for a given commitURL
     */
    public async getPushRecord(commitURL: string): Promise<IPushEvent | null> {
        // Log.info("DummyDataStore::getPushRecord(..) - start");
        try {
            const start = Date.now();
            // read
            const outRecords: IPushEvent[] = await fs.readJSON(this.PUSH_PATH);

            // find and return
            for (const record of outRecords) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL) {
                    Log.info("DummyDataStore::getPushRecord(..) - found; took: " + Util.took(start));
                    return record;
                }
            }

            // not found
            Log.info("DummyDataStore::getPushRecord(..) - not found; took: " + Util.took(start));
        } catch (err) {
            Log.error("DummyDataStore::getPushRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async savePush(info: IContainerInput): Promise<void> {
        // Log.info("DummyDataStore::savePush(..) - start");
        try {
            const start = Date.now();
            // read
            const records = await fs.readJSON(this.PUSH_PATH);
            // append
            records.push(info);
            // write
            await fs.writeJSON(this.PUSH_PATH, records);

            Log.info("DummyDataStore::savePush(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("DummyDataStore::savePush(..) - ERROR: " + err);
        }
    }

    public async saveComment(info: ICommentEvent): Promise<void> {
        // Log.info("DummyDataStore::saveComment(..) - start");
        try {
            const start = Date.now();

            // read
            const records = await fs.readJSON(this.COMMENT_PATH);
            // append
            records.push(info);
            // write
            await fs.writeJSON(this.COMMENT_PATH, records);

            Log.info("DummyDataStore::saveComment(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("DummyDataStore::saveComment(..) - ERROR: " + err);
        }
    }

    public async getCommentRecord(commitURL: string, delivId: string): Promise<ICommentEvent | null> {
        // Log.info("DummyDataStore::getCommentRecord(..) - start");
        try {
            const start = Date.now();
            // read
            const outRecords: ICommentEvent[] = await fs.readJSON(this.COMMENT_PATH);

            // find and return
            for (const record of outRecords) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL && record.delivId === delivId) {
                    Log.info("DummyDataStore::getCommentRecord(..) - found; took: " + Util.took(start));
                    return record;
                }
            }

            // not found
            Log.info("DummyDataStore::getCommentRecord(..) - not found; took: " + Util.took(start));
        } catch (err) {
            Log.error("DummyDataStore::getCommentRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async saveOutputRecord(outputInfo: ICommitRecord): Promise<void> {
        // Log.info("DummyDataStore::saveOutputRecord(..) - start");
        try {
            const start = Date.now();
            // read
            const outRecords = await fs.readJSON(this.RECORD_PATH);
            // append
            outRecords.push(outputInfo);
            // write
            await fs.writeJSON(this.RECORD_PATH, outRecords);

            Log.info("DummyDataStore::saveOutputRecord(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("DummyDataStore::saveOutputRecord(..) - ERROR: " + err);
        }
    }

    public async getOutputRecord(commitURL: string): Promise<ICommitRecord | null> {
        // Log.info("DummyDataStore::getOutputRecord(..) - start");
        try {
            const start = Date.now();

            // read
            const outRecords: ICommitRecord[] = await fs.readJSON(this.RECORD_PATH);
            Log.info("DummyDataStore::getOutputRecord(..) - # records: " + outRecords.length);
            // find and return
            for (const record of outRecords) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL) {
                    Log.info("DummyDataStore::getOutputRecord(..) - found; took: " + Util.took(start));
                    return record;
                }
            }
            // not found
            Log.info("DummyDataStore::getOutputRecord(..) - not found; took: " + Util.took(start));
        } catch (err) {
            Log.error("DummyDataStore::getOutputRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async saveFeedbackGivenRecord(info: IFeedbackGiven): Promise<void> {
        // Log.info("DummyDataStore::saveFeedbackGivenRecord(..) - start");
        try {
            const start = Date.now();
            // read
            const records = await fs.readJSON(this.FEEDBACK_PATH);
            // append
            records.push(info);
            // write
            await fs.writeJSON(this.FEEDBACK_PATH, records);

            Log.info("DummyDataStore::saveFeedbackGivenRecord(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("DummyDataStore::saveFeedbackGivenRecord(..) - ERROR: " + err);
        }
    }

    public async getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): Promise<IFeedbackGiven | null> {
        // Log.trace("DummyDataStore::getLatestFeedbackGivenRecord(..) - start");
        let ret: IFeedbackGiven | null = null;
        try {
            const start = Date.now();
            const records: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);
            const shortList: IFeedbackGiven[] = [];
            for (const req of records) {
                if (req !== null && req.courseId === courseId && req.delivId === delivId && req.userName === userName) {
                    shortList.push(req);
                }
            }

            if (shortList.length === 0) {
                Log.info("DummyDataStore::getLatestFeedbackGivenRecord(..) - not found; took: " + Util.took(start));
                ret = null;
            } else {
                Math.max.apply(Math, shortList.map(function (o: IFeedbackGiven) {
                    Log.info("DummyDataStore::getLatestFeedbackGivenRecord(..) - found; took: " + Util.took(start));
                    ret = o;
                }));
            }
        } catch (err) {
            Log.error("DummyDataStore::getLatestFeedbackGivenRecord(..) - ERROR: " + err);
            ret = null;
        }
        return ret;

    }

    public async getFeedbackGivenRecordForCommit(commitURL: string, userName: string): Promise<IFeedbackGiven | null> {
        // Log.trace("DummyDataStore::getFeedbackGivenRecordForCommit(..) - start");
        let ret: IFeedbackGiven | null = null;
        try {
            const start = Date.now();
            const records: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);
            for (const feedback of records) {
                if (feedback !== null && feedback.commitURL === commitURL && feedback.userName === userName) {
                    Log.info("DummyDataStore::getFeedbackGivenRecordForCommit(..) - found; took: " + Util.took(start));
                    ret = feedback;
                    break;
                }
            }
            if (ret === null) {
                Log.info("DummyDataStore::getFeedbackGivenRecordForCommit(..) - not found; took: " + Util.took(start));
            }
        } catch (err) {
            Log.error("DummyDataStore::getFeedbackGivenRecordForCommit(..) - ERROR: " + err);
            ret = null;
        }
        return ret;
    }

    public async getAllData(): Promise<{ records: ICommitRecord[], comments: ICommentEvent[], pushes: IPushEvent[], feedback: IFeedbackGiven[] }> {
        Log.info("DummyDataStore::getAllData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");

        const records: ICommitRecord[] = await fs.readJSON(this.RECORD_PATH);
        const comments: ICommentEvent[] = await fs.readJSON(this.COMMENT_PATH);
        const pushes: IPushEvent[] = await fs.readJSON(this.PUSH_PATH);
        const feedback: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);

        return {records, comments, pushes, feedback};
    }

    public clearData() {
        Log.warn("DummyDataStore::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
        if (Config.getInstance().getProp("name") === "test") {
            // do it
            fs.removeSync(this.RECORD_PATH);
            fs.removeSync(this.COMMENT_PATH);
            fs.removeSync(this.PUSH_PATH);
            fs.removeSync(this.FEEDBACK_PATH);

            if (!fs.existsSync(this.RECORD_PATH)) {
                fs.writeJSONSync(this.RECORD_PATH, []);
            }
            if (!fs.existsSync(this.COMMENT_PATH)) {
                fs.writeJSONSync(this.COMMENT_PATH, []);
            }
            if (!fs.existsSync(this.PUSH_PATH)) {
                fs.writeJSONSync(this.PUSH_PATH, []);
            }
            if (!fs.existsSync(this.FEEDBACK_PATH)) {
                fs.writeJSONSync(this.FEEDBACK_PATH, []);
            }

            Log.info("DummyDataStore::clearData() - files removed");
        } else {
            throw new Error("DummyDataStore::clearData() - can only be called on test configurations");
        }
    }
}
