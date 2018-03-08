import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven, IPushEvent} from "../Types";
import Log from "../util/Log";
import Util from "../util/Util";
import {Config} from "../Config";
import {Collection, Db, MongoClient} from "mongodb";

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
export class MongoDataStore implements IDataStore {

    private db: Db = null;
    readonly PUSHCOLL = 'pushes';
    readonly COMMENTCOLL = 'comments';
    readonly OUTPUTCOLL = 'output';
    readonly FEEDBACKCOLL = 'feedback';

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
            Log.trace("MongoDataStore::saveRecord( " + column + ", ...) - start");
            const start = Date.now();
            let collection = await this.getCollection(column);
            // be extra safe not to mutate existing record (we were seeing _id being added by mongo)
            const copy = Object.assign({}, record);
            await collection.insertOne(copy);
            Log.trace("MongoDataStore::saveRecord( " + column + ", ...) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveRecord(..) - ERROR: " + err);
        }
        return;
    }

    public async getSingleRecord(column: string, query: {} | null): Promise<{} | null> {
        try {
            Log.trace("MongoDataStore::getSingleRecord(..) - start");
            const start = Date.now();
            let col = await this.getCollection(column);
            if (query === null) {
                query = {};
            }
            //if (typeof key !== 'undefined' && key !== null && typeof value !== 'undefined' && value !== null) {
            //    query[key] = value;
            // }
            const records: any[] = await <any>col.find(query).toArray();
            if (records === null || records.length === 0) {
                Log.trace("MongoDataStore::getSingleRecord(..) - done; no records found; took: " + Util.took(start));
                return null;
            } else {
                Log.trace("MongoDataStore::getSingleRecord(..) - done; # records: " + records.length + "; took: " + Util.took(start));
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
            Log.trace("MongoDataStore::getRecords(..) - start");
            let col = await this.getCollection(column);
            if (query === null) {
                query = {};
            }
            const records: any[] = await <any>col.find(query).toArray();
            if (records === null || records.length === 0) {
                Log.trace("MongoDataStore::getRecords(..) - done; no records found");
                return null;
            } else {
                Log.trace("MongoDataStore::getRecords(..) - done; # records: " + records.length);
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
        Log.trace("MongoDataStore::getPushRecord(..) - start");
        try {
            const start = Date.now();
            const res = await this.getSingleRecord(this.PUSHCOLL, {"pushInfo.commitURL": commitURL});
            if (res === null) {
                Log.trace("MongoDataStore::getPushRecord(..) - record not found for: " + commitURL);
            } else {
                Log.trace("MongoDataStore::getPushRecord(..) - found; took: " + Util.took(start));
            }
            return <any>res;
        } catch (err) {
            Log.error("MongoDataStore::getPushRecord(..) - ERROR: " + err);
        }
        return null;
    }


    public async savePush(info: IContainerInput): Promise<void> {
        Log.trace("MongoDataStore::savePush(..) - start; push: " + JSON.stringify(info));
        const start = Date.now();
        try {
            await this.saveRecord(this.PUSHCOLL, info);
            Log.trace("MongoDataStore::savePush(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::savePush(..) - ERROR: " + err);
        }
        return;
    }

    public async saveComment(info: ICommentEvent): Promise<void> {
        Log.trace("MongoDataStore::saveComment(..) - start");
        try {
            const start = Date.now();
            await this.saveRecord(this.COMMENTCOLL, info);
            Log.trace("MongoDataStore::saveComment(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveComment(..) - ERROR: " + err);
        }
        return;
    }

    public async getCommentRecord(commitURL: string, delivId: string): Promise<ICommentEvent | null> {
        Log.trace("MongoDataStore::getCommentRecord(..) - start");
        try {
            const start = Date.now();
            const res = await this.getSingleRecord(this.COMMENTCOLL, {"commitURL": commitURL});
            if (res === null) {
                Log.trace("MongoDataStore::getCommentRecord(..) - record not found for: " + commitURL);
            } else {
                Log.trace("MongoDataStore::getCommentRecord(..) - found; took: " + Util.took(start));
            }
            return <any>res;
        } catch (err) {
            Log.error("MongoDataStore::getCommentRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async saveOutputRecord(outputInfo: ICommitRecord): Promise<void> {
        Log.trace("MongoDataStore::saveOutputRecord(..) - start");
        try {
            const start = Date.now();
            await this.saveRecord(this.OUTPUTCOLL, outputInfo);
            Log.trace("MongoDataStore::saveOutputRecord(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveOutputRecord(..) - ERROR: " + err);
        }
        return;
    }

    public async getOutputRecord(commitURL: string, delivId: string): Promise<ICommitRecord | null> {
        Log.trace("MongoDataStore::getOutputRecord(..) - start");
        try {
            const start = Date.now();

            const res = await this.getSingleRecord(this.OUTPUTCOLL, {"commitURL": commitURL, "input.delivId": delivId});
            if (res === null) {
                Log.trace("MongoDataStore::getOutputRecord(..) - record not found for: " + commitURL);
            } else {
                Log.trace("MongoDataStore::getOutputRecord(..) - found; took: " + Util.took(start));
            }
            return <any>res;
        } catch (err) {
            Log.error("MongoDataStore::getOutputRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async saveFeedbackGivenRecord(info: IFeedbackGiven): Promise<void> {
        Log.trace("MongoDataStore::saveFeedbackGivenRecord(..) - start");
        try {
            const start = Date.now();
            await this.saveRecord(this.FEEDBACKCOLL, info);
            Log.trace("MongoDataStore::saveFeedbackGivenRecord(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveFeedbackGivenRecord(..) - ERROR: " + err);
        }
        return;
    }

    public async getLatestFeedbackGivenRecord(courseId: string, delivId: string, userName: string): Promise<IFeedbackGiven | null> {
        Log.trace("MongoDataStore::getLatestFeedbackGivenRecord(..) - start");
        try {
            const start = Date.now();
            const res = await this.getRecords(this.FEEDBACKCOLL, {"org": courseId, "delivId": delivId, "personId": userName});
            if (res === null) {
                Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit(..) - record not found");
                return null;
            } else {
                Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit(..) - found; took: " + Util.took(start));
                // pick the most recent
                let ret: IFeedbackGiven | null = null;
                Math.max.apply(Math, res.map(function (o: IFeedbackGiven) {
                    Log.trace("MongoDataStore::getLatestFeedbackGivenRecord(..) - found; took: " + Util.took(start));
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
                Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit(..) - record not found for: " + commitURL);
            } else {
                Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit(..) - found; took: " + Util.took(start));
            }
            return <any>res;
        } catch (err) {
            Log.error("MongoDataStore::getFeedbackGivenRecordForCommit(..) - ERROR: " + err);
        }
        return null;
    }

    public async getAllData(): Promise<{ records: ICommitRecord[], comments: ICommentEvent[], pushes: IPushEvent[], feedback: IFeedbackGiven[] }> {
        Log.trace("MongoDataStore::getAllData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
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
            Log.info("MongoDataStore::open() - db null; making new connection to: " + dbName);

            const client = await MongoClient.connect(Config.getInstance().getProp("mongoUrl")); // 'mongodb://localhost:27017'
            this.db = await client.db(dbName);

            Log.info("MongoDataStore::open() - db null; new connection made");
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
