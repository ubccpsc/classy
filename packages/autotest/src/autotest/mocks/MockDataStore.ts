import * as fs from "fs-extra";

import Config from "../../../../common/Config";
import Util from "../../../../common/Util";
import Log from "../../../../common/Log";

import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven, IPushEvent} from "../../Types";
import {IDataStore} from "../DataStore";

/**
 * Simple example for testing.
 */
export class MockDataStore implements IDataStore {

    private readonly dir = Config.getInstance().getProp("persistDir");
    private readonly RECORD_PATH = this.dir + "/outputRecords.json";
    private readonly COMMENT_PATH = this.dir + "/commentRecords.json";
    private readonly PUSH_PATH = this.dir + "/pushRecords.json";
    private readonly FEEDBACK_PATH = this.dir + "/feedbackRecords.json";

    constructor() {
        Log.info("MockDataStore::<init> - start; dir: " + this.dir);

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
            Log.info("MockDataStore::<init> - ERROR: " + err);
        }
    }

    /**
     * Gets the push event record for a given commitURL
     */
    public async getPushRecord(commitURL: string): Promise<IPushEvent | null> {
        // Log.info("MockDataStore::getPushRecord(..) - start");
        try {
            const start = Date.now();
            // read
            const outRecords: IPushEvent[] = await fs.readJSON(this.PUSH_PATH);

            // find and return
            for (const record of outRecords) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL) {
                    Log.info("MockDataStore::getPushRecord(..) - found; took: " + Util.took(start));
                    return record;
                }
            }

            // not found
            Log.info("MockDataStore::getPushRecord(..) - not found; took: " + Util.took(start));
        } catch (err) {
            Log.error("MockDataStore::getPushRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async savePush(info: IContainerInput): Promise<void> {
        // Log.info("MockDataStore::savePush(..) - start");
        try {
            const start = Date.now();
            // read
            const records = await fs.readJSON(this.PUSH_PATH);
            // append
            records.push(info);
            // write
            await fs.writeJSON(this.PUSH_PATH, records);

            Log.info("MockDataStore::savePush(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MockDataStore::savePush(..) - ERROR: " + err);
        }
    }

    public async saveComment(info: ICommentEvent): Promise<void> {
        // Log.info("MockDataStore::saveComment(..) - start");
        try {
            const start = Date.now();

            // read
            const records = await fs.readJSON(this.COMMENT_PATH);
            // append
            records.push(info);
            // write
            await fs.writeJSON(this.COMMENT_PATH, records);

            Log.info("MockDataStore::saveComment(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MockDataStore::saveComment(..) - ERROR: " + err);
        }
    }

    public async getCommentRecord(commitURL: string, delivId: string): Promise<ICommentEvent | null> {
        // Log.info("MockDataStore::getCommentRecord(..) - start");
        try {
            const start = Date.now();
            // read
            const outRecords: ICommentEvent[] = await fs.readJSON(this.COMMENT_PATH);

            // find and return
            for (const record of outRecords) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL && record.delivId === delivId) {
                    Log.info("MockDataStore::getCommentRecord(..) - found; took: " + Util.took(start));
                    return record;
                }
            }

            // not found
            Log.info("MockDataStore::getCommentRecord(..) - not found; took: " + Util.took(start));
        } catch (err) {
            Log.error("MockDataStore::getCommentRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async saveOutputRecord(outputInfo: ICommitRecord): Promise<void> {
        // Log.info("MockDataStore::saveOutputRecord(..) - start");
        try {
            const start = Date.now();
            // read
            const outRecords = await fs.readJSON(this.RECORD_PATH);
            // append
            outRecords.push(outputInfo);
            // write
            await fs.writeJSON(this.RECORD_PATH, outRecords);

            Log.info("MockDataStore::saveOutputRecord(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MockDataStore::saveOutputRecord(..) - ERROR: " + err);
        }
    }

    public async getOutputRecord(commitURL: string, delivId: string): Promise<ICommitRecord | null> {
        // Log.info("MockDataStore::getOutputRecord(..) - start");
        try {
            const start = Date.now();

            // read
            const outRecords: ICommitRecord[] = await fs.readJSON(this.RECORD_PATH);
            Log.info("MockDataStore::getOutputRecord(..) - # records: " + outRecords.length);
            // find and return
            for (const record of outRecords) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL && record.input.delivId === delivId) {
                    Log.info("MockDataStore::getOutputRecord(..) - found; took: " + Util.took(start));
                    return record;
                }
            }
            // not found
            Log.info("MockDataStore::getOutputRecord(..) - not found; took: " + Util.took(start));
        } catch (err) {
            Log.error("MockDataStore::getOutputRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async saveFeedbackGivenRecord(info: IFeedbackGiven): Promise<void> {
        // Log.info("MockDataStore::saveFeedbackGivenRecord(..) - start");
        try {
            const start = Date.now();
            // read
            const records = await fs.readJSON(this.FEEDBACK_PATH);
            // append
            records.push(info);
            // write
            await fs.writeJSON(this.FEEDBACK_PATH, records);

            Log.info("MockDataStore::saveFeedbackGivenRecord(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MockDataStore::saveFeedbackGivenRecord(..) - ERROR: " + err);
        }
    }

    public async getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): Promise<IFeedbackGiven | null> {
        // Log.trace("MockDataStore::getLatestFeedbackGivenRecord(..) - start");
        let ret: IFeedbackGiven | null = null;
        try {
            const start = Date.now();
            const records: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);
            const shortList: IFeedbackGiven[] = [];
            for (const req of records) {
                if (req !== null && req.org === courseId && req.delivId === delivId && req.personId === userName) {
                    shortList.push(req);
                }
            }

            if (shortList.length === 0) {
                Log.info("MockDataStore::getLatestFeedbackGivenRecord(..) - not found; took: " + Util.took(start));
                ret = null;
            } else {
                Math.max.apply(Math, shortList.map(function (o: IFeedbackGiven) {
                    Log.info("MockDataStore::getLatestFeedbackGivenRecord(..) - found; took: " + Util.took(start));
                    ret = o;
                }));
            }
        } catch (err) {
            Log.error("MockDataStore::getLatestFeedbackGivenRecord(..) - ERROR: " + err);
            ret = null;
        }
        return ret;

    }

    public async getFeedbackGivenRecordForCommit(commitURL: string, userName: string): Promise<IFeedbackGiven | null> {
        // Log.trace("MockDataStore::getFeedbackGivenRecordForCommit(..) - start");
        let ret: IFeedbackGiven | null = null;
        try {
            const start = Date.now();
            const records: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);
            for (const feedback of records) {
                if (feedback !== null && feedback.commitURL === commitURL && feedback.personId === userName) {
                    Log.info("MockDataStore::getFeedbackGivenRecordForCommit(..) - found; took: " + Util.took(start));
                    ret = feedback;
                    break;
                }
            }
            if (ret === null) {
                Log.info("MockDataStore::getFeedbackGivenRecordForCommit(..) - not found; took: " + Util.took(start));
            }
        } catch (err) {
            Log.error("MockDataStore::getFeedbackGivenRecordForCommit(..) - ERROR: " + err);
            ret = null;
        }
        return ret;
    }

    public async getAllData(): Promise<{ records: ICommitRecord[], comments: ICommentEvent[], pushes: IPushEvent[], feedback: IFeedbackGiven[] }> {
        Log.info("MockDataStore::getAllData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");

        const records: ICommitRecord[] = await fs.readJSON(this.RECORD_PATH);
        const comments: ICommentEvent[] = await fs.readJSON(this.COMMENT_PATH);
        const pushes: IPushEvent[] = await fs.readJSON(this.PUSH_PATH);
        const feedback: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);

        return {records, comments, pushes, feedback};
    }

    public clearData(): Promise<void> {
        Log.warn("MockDataStore::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
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

            Log.info("MockDataStore::clearData() - files removed");
        } else {
            throw new Error("MockDataStore::clearData() - can only be called on test configurations");
        }
        return Promise.resolve();
    }
}
