import {Collection, Db, MongoClient} from "mongodb";
import Config, {ConfigKey} from "../../../common/Config";

import Log from "../../../common/Log";
import {AutoTestResult, IFeedbackGiven} from "../../../common/types/AutoTestTypes";
import {CommitTarget} from "../../../common/types/ContainerTypes";

import Util from "../../../common/Util";

export interface IDataStore {

    /**
     * Gets the push event record for a given commitURL
     */
    getPushRecord(commitURL: string): Promise<CommitTarget | null>;

    /**
     * Saves push event (to its own table).
     *
     * Store IContainerInput instead of IPushEvent because this will be
     * easier to resume since it contains course and deliverable info.
     *
     * @param info
     */
    savePush(info: CommitTarget): Promise<void>;

    /**
     * Saves comment event (to its own table).
     *
     * Should only be called _IF_ a response is requested.
     *
     * If a user is over quota, their request should not be added here.
     *
     * @param info
     */
    saveComment(info: CommitTarget): Promise<void>;

    getCommentRecord(commitURL: string, delivId: string): Promise<CommitTarget | null>;

    // DO NOT DO THIS HERE: Classy should validate/save these records
    // saveOutputRecord(outputInfo: IAutoTestResult): Promise<void>;

    // getOutputRecord(commitURL: string, delivId: string): Promise<IAutoTestResult | null>;

    saveFeedbackGivenRecord(request: IFeedbackGiven): Promise<void>;

    getLatestFeedbackGivenRecord(delivId: string, userName: string): Promise<IFeedbackGiven | null>;

    getFeedbackGivenRecordForCommit(commitURL: string, delivId: string, userName: string): Promise<IFeedbackGiven | null>;

    /**
     * Debugging / testing only, should not be commonly used.
     *
     * @returns {Promise<{records: ICommitRecord[]; comments: ICommentEvent[]; pushes: IPushEvent[]; feedback: IFeedbackGiven[]}>}
     */
    getAllData(): Promise<{records: AutoTestResult[], comments: CommitTarget[], pushes: CommitTarget[], feedback: IFeedbackGiven[]}>;

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
    private readonly PUSHCOLL = 'pushes';
    private readonly COMMENTCOLL = 'comments';
    private readonly OUTPUTCOLL = 'output';
    private readonly FEEDBACKCOLL = 'feedback';

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
            // Log.trace("MongoDataStore::saveRecord( " + column + ", ...) - start");
            // const start = Date.now();
            const collection = await this.getCollection(column);
            // be extra safe not to mutate existing record (we were seeing _id being added by mongo)
            const copy = Object.assign({}, record);
            await collection.insertOne(copy);
            // Log.trace("MongoDataStore::saveRecord( " + column + ", ...) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveRecord(..) - ERROR: " + err);
        }
        return;
    }

    public async getSingleRecord(column: string, query: {} | null): Promise<{} | null> {
        try {
            // Log.trace("MongoDataStore::getSingleRecord(..) - start");
            const start = Date.now();
            const col = await this.getCollection(column);
            if (query === null) {
                query = {};
            }
            // if (typeof key !== 'undefined' && key !== null && typeof value !== 'undefined' && value !== null) {
            //    query[key] = value;
            // }
            const records: any[] = await col.find(query).toArray() as any;
            if (records === null || records.length === 0) {
                Log.trace("MongoDataStore::getSingleRecord( " + column + ", " + JSON.stringify(query) +
                    " ) - done; no records found; took: " + Util.took(start));
                return null;
            } else {
                Log.trace("MongoDataStore::getSingleRecord( " + column + ", " + JSON.stringify(query) +
                    " ) - done; # records: " + records.length + "; took: " + Util.took(start));
                const record = records[0];
                delete record._id; // remove the record id, just so we can't use it
                return record;
            }
        } catch (err) {
            Log.error("MongoDataStore::getSingleRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async getRecords(column: string, query: {} | null): Promise<Array<{}> | null> {
        try {
            Log.trace("MongoDataStore::getRecords(..) - start");
            const col = await this.getCollection(column);
            if (query === null) {
                query = {};
            }
            const records: any[] = await col.find(query).toArray() as any;
            if (records === null || records.length === 0) {
                Log.trace("MongoDataStore::getRecords(..) - done; no records found");
                return null;
            } else {
                Log.trace("MongoDataStore::getRecords(..) - done; # records: " + records.length);
                for (const r of records) {
                    delete r._id; // remove the record id, just so we can't use it
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
    public async getPushRecord(commitURL: string): Promise<CommitTarget | null> {
        Log.trace("MongoDataStore::getPushRecord(..) - start");
        try {
            const start = Date.now();
            const res = await this.getSingleRecord(this.PUSHCOLL, {commitURL: commitURL});
            if (res === null) {
                Log.trace("MongoDataStore::getPushRecord(..) - record not found for: " + commitURL);
            } else {
                Log.trace("MongoDataStore::getPushRecord(..) - found; took: " + Util.took(start));
            }
            return res as any;
        } catch (err) {
            Log.error("MongoDataStore::getPushRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async savePush(info: CommitTarget): Promise<void> {
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

    public async saveComment(info: CommitTarget): Promise<void> {
        Log.info("MongoDataStore::saveComment(..) - start; delivId: " +
            info.delivId + "; repo: " + info.repoId + "; url: " + info.commitURL);
        try {
            const start = Date.now();
            await this.saveRecord(this.COMMENTCOLL, info);
            Log.trace("MongoDataStore::saveComment(..) - done; took: " + Util.took(start));
        } catch (err) {
            Log.error("MongoDataStore::saveComment(..) - ERROR: " + err);
        }
        return;
    }

    public async getCommentRecord(commitURL: string, delivId: string): Promise<CommitTarget | null> {
        Log.trace("MongoDataStore::getCommentRecord(..) - start; delivId: " + delivId + "; url: " + commitURL);
        try {
            const start = Date.now();
            const res = await this.getSingleRecord(this.COMMENTCOLL, {delivId: delivId, commitURL: commitURL});
            if (res === null) {
                Log.trace("MongoDataStore::getCommentRecord(..) - record not found for: " + commitURL);
            } else {
                Log.trace("MongoDataStore::getCommentRecord(..) - found; took: " + Util.took(start));
            }
            return res as any;
        } catch (err) {
            Log.error("MongoDataStore::getCommentRecord(..) - ERROR: " + err);
        }
        return null;
    }

    // public async getOutputRecord(commitURL: string, delivId: string): Promise<IAutoTestResult | null> {
    //     Log.trace("MongoDataStore::getOutputRecord(..) - start");
    //     try {
    //         const start = Date.now();
    //
    //         const res = await this.getSingleRecord(this.OUTPUTCOLL, {"commitURL": commitURL, "input.delivId": delivId});
    //         if (res === null) {
    //             Log.trace("MongoDataStore::getOutputRecord(..) - record not found for: " + commitURL);
    //         } else {
    //             Log.trace("MongoDataStore::getOutputRecord(..) - found; took: " + Util.took(start));
    //         }
    //         return res as any;
    //     } catch (err) {
    //         Log.error("MongoDataStore::getOutputRecord(..) - ERROR: " + err);
    //     }
    //     return null;
    // }

    public async saveFeedbackGivenRecord(info: IFeedbackGiven): Promise<void> {
        try {
            await this.saveRecord(this.FEEDBACKCOLL, info);
            Log.trace("MongoDataStore::saveFeedbackGivenRecord(..) - done; delivId: " +
                info.delivId + "; user: " + info.personId + "; commit: " + info.commitURL);
        } catch (err) {
            Log.error("MongoDataStore::saveFeedbackGivenRecord(..) - ERROR: " + err);
        }
        return;
    }

    public async getLatestFeedbackGivenRecord(delivId: string, userName: string): Promise<IFeedbackGiven | null> {
        try {
            const res = await this.getRecords(this.FEEDBACKCOLL, {delivId: delivId, personId: userName});
            if (res === null) {
                Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit(..) - record not found for deliv: " +
                    delivId + "; user: " + userName);
                return null;
            } else {
                // pick the most recent
                let ret: IFeedbackGiven | null = null;
                Math.max.apply(Math, res.map(function(o: IFeedbackGiven) {
                    // Log.trace("MongoDataStore::getLatestFeedbackGivenRecord(..) - found; took: " + Util.took(start));
                    ret = o;
                }));
                Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit(..) - found for deliv: " +
                    delivId + "; user: " + userName + "; date: " + new Date(ret.timestamp));
                return ret;
            }
        } catch (err) {
            Log.error("MongoDataStore::getLatestFeedbackGivenRecord(..) - ERROR: " + err);
        }
        return null;
    }

    public async getFeedbackGivenRecordForCommit(commitURL: string, delivId: string, userName: string): Promise<IFeedbackGiven | null> {
        try {
            const res = await this.getSingleRecord(this.FEEDBACKCOLL, {delivId: delivId, commitURL: commitURL});
            if (res === null) {
                Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit( " + delivId + ", " + userName +
                    " ) - record not found for: " + commitURL);
            } else {
                Log.trace("MongoDataStore::getFeedbackGivenRecordForCommit( " + delivId + ", " + userName +
                    " ) - found for: " + commitURL);
            }
            return res as any;
        } catch (err) {
            Log.error("MongoDataStore::getFeedbackGivenRecordForCommit(..) - ERROR: " + err);
        }
        return null;
    }

    public async getAllData(): Promise<{
        records: AutoTestResult[],
        comments: CommitTarget[],
        pushes: CommitTarget[],
        feedback: IFeedbackGiven[]
    }> {
        Log.trace("MongoDataStore::getAllData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");

        let col = await this.getCollection(this.PUSHCOLL);
        const pushes: CommitTarget[] = await col.find({}).toArray() as any;
        for (const p of pushes as any) {
            delete p._id;
        }

        col = await this.getCollection(this.COMMENTCOLL);
        const comments: CommitTarget[] = await col.find({}).toArray() as any;
        for (const c of comments as any) {
            delete c._id;
        }

        col = await this.getCollection(this.OUTPUTCOLL);
        const records: AutoTestResult[] = await col.find({}).toArray() as any;
        for (const r of records as any) {
            delete r._id;
        }

        col = await this.getCollection(this.FEEDBACKCOLL);
        const feedback: IFeedbackGiven[] = await col.find({}).toArray() as any;
        for (const f of feedback as any) {
            delete f._id;
        }

        return {records, comments, pushes, feedback};
    }

    public async clearData(): Promise<void> {
        Log.warn("MongoDataStore::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
        if (Config.getInstance().getProp(ConfigKey.name) === Config.getInstance().getProp(ConfigKey.testname)) {

            let col = await this.getCollection(this.PUSHCOLL);
            await col.deleteMany({});

            col = await this.getCollection(this.COMMENTCOLL);
            await col.deleteMany({});

            col = await this.getCollection(this.FEEDBACKCOLL);
            await col.deleteMany({});

            col = await this.getCollection(this.OUTPUTCOLL);
            await col.deleteMany({});

            Log.info("MongoDataStore::clearData() - files removed");
        } else {
            const msg = "MongoDataStore::clearData() - can only be called on test configurations";
            Log.warn(msg);
            throw new Error(msg);
        }
        return;
    }

    /**
     * Internal use only, do not use this method; use getCollection(..) instead.
     *
     * @returns {Promise<Db>}
     */
    private async open(): Promise<Db> {
        // Log.trace("MongoDataStore::open() - start");
        if (this.db === null) {
            const dbName = Config.getInstance().getProp(ConfigKey.name).trim(); // make sure there are no extra spaces in config
            const dbHost = Config.getInstance().getProp(ConfigKey.mongoUrl).trim(); // make sure there are no extra spaces in config

            Log.info("MongoDataStore::open() - db null; making new connection to: " + dbName);

            const client = await MongoClient.connect(dbHost);
            this.db = await client.db(dbName);

            Log.info("MongoDataStore::open() - db null; new connection made");
        }
        // Log.trace("MongoDataStore::open() - returning db");
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
