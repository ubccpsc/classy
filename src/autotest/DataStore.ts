import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven, IPushEvent} from "../Types";
import Log from "../util/Log";
import Util from "../util/Util";

import * as fs from "fs-extra";
import {Config} from "../Config";
import {Collection, Db, MongoClient} from "mongodb";
import {TestData} from "../../test/TestData";

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

    getOutputRecord(commitUrl: string, delivId: string): Promise<ICommitRecord | null>;

    saveFeedbackGivenRecord(request: IFeedbackGiven): Promise<void>;

    getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): Promise<IFeedbackGiven | null>;

    getFeedbackGivenRecordForCommit(commitUrl: string, userName: string): Promise<IFeedbackGiven | null>; // TODO: should this have delivId?

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
    clearData(): Promise<void>;
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

    public async getOutputRecord(commitURL: string, delivId: string): Promise<ICommitRecord | null> {
        // Log.info("DummyDataStore::getOutputRecord(..) - start");
        try {
            const start = Date.now();

            // read
            const outRecords: ICommitRecord[] = await fs.readJSON(this.RECORD_PATH);
            Log.info("DummyDataStore::getOutputRecord(..) - # records: " + outRecords.length);
            // find and return
            for (const record of outRecords) {
                if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL && record.input.delivId === delivId) {
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

    public clearData(): Promise<void> {
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
        return Promise.resolve();
    }
}

/**
 * Simple example for testing.
 */
export class MongoDataStore implements IDataStore {

    private db: Db = null;
    readonly PUSHCOLL = 'pushes';
    readonly COMMENTCOLL = 'comments';
    readonly OUTPUTCOLL = 'output';
    readonly FEEDBACKCOLL = 'output';

    constructor() {
        Log.info("MongoDataStore::<init> - start");

        try {
            // impl missing
        } catch (err) {
            Log.info("MongoDataStore::<init> - ERROR: " + err);
        }
    }

    public async saveRecord(column: string, record: any): Promise<void> {
        try {
            Log.info("MongoDataStore::saveRecord( " + column + ", ...) - start");
            let collection = await this.getCollection(column);
            // be extra safe not to mutate existing record (we were seeing _id being added by mongo)
            const copy = Object.assign({}, record);
            await collection.insertOne(copy);
        } catch (err) {
            Log.error("MongoDataStore::saveRecord(..) - ERROR: " + err);
        }
        return;
    }

    public async getSingleRecord(column: string, query: {} | null): Promise<{} | null> {
        try {
            Log.info("MongoDataStore::getSingleRecord(..) - start");
            let col = await this.getCollection(column);
            if (query === null) {
                query = {};
            }
            //if (typeof key !== 'undefined' && key !== null && typeof value !== 'undefined' && value !== null) {
            //    query[key] = value;
            // }
            const records: any[] = await <any>col.find(query).toArray();
            if (records === null || records.length === 0) {
                Log.info("MongoDataStore::getSingleRecord(..) - done; no records found");
                return null;
            } else {
                Log.info("MongoDataStore::getSingleRecord(..) - done; # records: " + records.length);
                let record = records[0];
                delete record._id; // remove the record id, just so we can't use it
                return record;
            }
        } catch (err) {
            Log.error("MongoDataStore::getSingleRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async getRecords(column: string, query: {} | null): Promise<{}[] | null> {
        try {
            Log.info("MongoDataStore::getRecords(..) - start");
            let col = await this.getCollection(column);
            if (query === null) {
                query = {};
            }
            //if (typeof key !== 'undefined' && key !== null && typeof value !== 'undefined' && value !== null) {
            //    query[key] = value;
            // }
            const records: any[] = await <any>col.find(query).toArray();
            if (records === null || records.length === 0) {
                Log.info("MongoDataStore::getRecords(..) - done; no records found");
                return null;
            } else {
                Log.info("MongoDataStore::getRecords(..) - done; # records: " + records.length);
                for (const r of records) {
                    delete r._id;// remove the record id, just so we can't use it
                }
                return records;
            }
        } catch (err) {
            Log.error("MongoDataStore::getRecords(..) - ERROR: " + err);
        }
        return null;
    }

    /**
     * Gets the push event record for a given commitURL
     */
    public async getPushRecord(commitURL: string): Promise<IPushEvent | null> {
        Log.info("MongoDataStore::getPushRecord(..) - start");
        try {
            const start = Date.now();
            const res = await this.getSingleRecord(this.PUSHCOLL, {"pushInfo.commitURL": commitURL});
            if (res === null) {
                Log.info("MongoDataStore::getPushRecord(..) - record not found for: " + commitURL);
            } else {
                Log.info("MongoDataStore::getPushRecord(..) - found; took: " + Util.took(start));
            }
            return <any>res;
        } catch (err) {
            Log.error("MongoDataStore::getPushRecord(..) - ERROR: " + err);
        }
        return null;
    }


    public async savePush(info: IContainerInput): Promise<void> {
        Log.info("MongoDataStore::savePush(..) - start; push: " + JSON.stringify(info));
        const start = Date.now();
        try {
            await this.saveRecord(this.PUSHCOLL, info);
            Log.info("MongoDataStore::savePush(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::savePush(..) - ERROR: " + err);
        }
        return;
    }

    public async saveComment(info: ICommentEvent): Promise<void> {
        Log.info("MongoDataStore::saveComment(..) - start");

        try {
            const start = Date.now();
            await this.saveRecord(this.COMMENTCOLL, info);
            Log.info("MongoDataStore::saveComment(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveComment(..) - ERROR: " + err);
        }
        return;
    }

    public async getCommentRecord(commitURL: string, delivId: string): Promise<ICommentEvent | null> {
        Log.info("MongoDataStore::getCommentRecord(..) - start");
        try {
            const start = Date.now();
            const res = await this.getSingleRecord(this.COMMENTCOLL, {"commitURL": commitURL});
            if (res === null) {
                Log.info("MongoDataStore::getCommentRecord(..) - record not found for: " + commitURL);
            } else {
                Log.info("MongoDataStore::getCommentRecord(..) - found; took: " + Util.took(start));
            }
            return <any>res;
        } catch (err) {
            Log.error("MongoDataStore::getCommentRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async saveOutputRecord(outputInfo: ICommitRecord): Promise<void> {
        Log.info("MongoDataStore::saveOutputRecord(..) - start");

        try {
            const start = Date.now();
            await this.saveRecord(this.OUTPUTCOLL, outputInfo);
            Log.info("MongoDataStore::saveOutputRecord(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveOutputRecord(..) - ERROR: " + err);
        }
        return;
    }

    public async getOutputRecord(commitURL: string, delivId: string): Promise<ICommitRecord | null> {
        Log.info("MongoDataStore::getOutputRecord(..) - start");
        try {
            const start = Date.now();

            const res = await this.getSingleRecord(this.OUTPUTCOLL, {"commitURL": commitURL, "input.delivId": delivId});
            if (res === null) {
                Log.info("MongoDataStore::getOutputRecord(..) - record not found for: " + commitURL);
            } else {
                Log.info("MongoDataStore::getOutputRecord(..) - found; took: " + Util.took(start));
            }
            return <any>res;
        } catch (err) {
            Log.error("MongoDataStore::getOutputRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async saveFeedbackGivenRecord(info: IFeedbackGiven): Promise<void> {
        Log.info("MongoDataStore::saveFeedbackGivenRecord(..) - start");
        try {
            const start = Date.now();
            await this.saveRecord(this.FEEDBACKCOLL, info);
            Log.info("MongoDataStore::saveFeedbackGivenRecord(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveFeedbackGivenRecord(..) - ERROR: " + err);
        }
        return;
    }

    public async getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): Promise<IFeedbackGiven | null> {
        Log.trace("MongoDataStore::getLatestFeedbackGivenRecord(..) - start");
        try {
            const start = Date.now();
            const res = await this.getRecords(this.FEEDBACKCOLL, {"courseId": courseId, "delivId": delivId, "userName": userName});
            if (res === null) {
                Log.info("MongoDataStore::getFeedbackGivenRecordForCommit(..) - record not found");
                return null;
            } else {
                Log.info("MongoDataStore::getFeedbackGivenRecordForCommit(..) - found; took: " + Util.took(start));
                // pick the most recent
                let ret: IFeedbackGiven | null = null;
                Math.max.apply(Math, res.map(function (o: IFeedbackGiven) {
                    Log.info("MongoDataStore::getLatestFeedbackGivenRecord(..) - found; took: " + Util.took(start));
                    ret = o;
                }));
                return ret;
            }
        } catch (err) {
            Log.error("MongoDataStore::getLatestFeedbackGivenRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async getFeedbackGivenRecordForCommit(commitURL: string, userName: string): Promise<IFeedbackGiven | null> {
        Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit(..) - start");
        try {
            const start = Date.now();
            const res = await this.getSingleRecord(this.FEEDBACKCOLL, {"commitURL": commitURL});
            if (res === null) {
                Log.info("MongoDataStore::getFeedbackGivenRecordForCommit(..) - record not found for: " + commitURL);
            } else {
                Log.info("MongoDataStore::getFeedbackGivenRecordForCommit(..) - found; took: " + Util.took(start));
            }
            return <any>res;
        } catch (err) {
            Log.error("MongoDataStore::getFeedbackGivenRecordForCommit(..) - ERROR: " + err);
        }
        return null;
    }

    public async getAllData(): Promise<{ records: ICommitRecord[], comments: ICommentEvent[], pushes: IPushEvent[], feedback: IFeedbackGiven[] }> {
        Log.info("MongoDataStore::getAllData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
        let col: any = null;

        col = await this.getCollection(this.PUSHCOLL);
        const pushes: IPushEvent[] = await <any>col.find({}).toArray();
        for (const p of pushes as any) {
            delete p._id;
        }

        col = await this.getCollection(this.COMMENTCOLL);
        const comments: ICommentEvent[] = await <any>col.find({}).toArray();
        for (const c of comments as any) {
            delete c._id;
        }

        col = await this.getCollection(this.OUTPUTCOLL);
        const records: ICommitRecord[] = await <any>col.find({}).toArray();
        for (const r of records as any) {
            delete r._id;
        }

        col = await this.getCollection(this.FEEDBACKCOLL);
        const feedback: IFeedbackGiven[] = await <any>col.find({}).toArray();
        for (const f of feedback as any) {
            delete f._id;
        }

        return {records, comments, pushes, feedback};
    }


    public async clearData(): Promise<void> {
        Log.warn("MongoDataStore::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
        if (Config.getInstance().getProp("name") === "test") {

            let col: any = null;
            col = await this.getCollection(this.PUSHCOLL);
            await col.deleteMany({});

            col = await this.getCollection(this.COMMENTCOLL);
            await col.deleteMany({});

            col = await this.getCollection(this.FEEDBACKCOLL);
            await col.deleteMany({});

            col = await this.getCollection(this.OUTPUTCOLL);
            await col.deleteMany({});

            Log.info("MongoDataStore::clearData() - files removed");
        } else {
            throw new Error("MongoDataStore::clearData() - can only be called on test configurations");
        }
        return;
    }

    /**
     * Internal use only, do not use this method; use getCollection(..) instead.
     *
     * @returns {Promise<Db>}
     */
    private async open(): Promise<Db> {
        Log.trace("MongoDataStore::open() - start");
        if (this.db === null) {
            const dbName = Config.getInstance().getProp("name");
            Log.trace("MongoDataStore::open() - db null; making new connection to: " + dbName);

            const client = await MongoClient.connect('mongodb://localhost:27017');
            this.db = await client.db(dbName);

            Log.trace("MongoDataStore::open() - db null; new connection made");
        }
        Log.trace("MongoDataStore::open() - returning db");
        return this.db;
    }

    /**
     * Returns a ready-to-use `collection` object from MongoDB.
     *
     * Usage:
     *
     *   (await getCollection('users')).find().toArray().then( ... )
     */
    private async getCollection(collectionName: string): Promise<Collection> {
        const db = await this.open();
        return db.collection(collectionName);
    }
}
