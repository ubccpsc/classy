import {Collection, Db, MongoClient} from "mongodb";

import {Person} from "../Types";
import Log from "../util/Log";
import Util from "../util/Util";
import {Config} from "../Config";


export class DatabaseController {

    private static instance: DatabaseController = null;
    private db: Db = null;

    private readonly PERSONCOLL = 'people';
    private readonly GRADECOLL = 'grades';
    private readonly TEAMCOLL = 'teams';
    private readonly DELIVCOLL = 'deliverables';
    private readonly REPOCOLL = 'repositories';

    constructor() {
        // don't call this; use getInstance
        Log.info("DatabaseController::<init> - creating new controller");
    }

    public static getInstance() {
        if (DatabaseController.instance === null) {
            DatabaseController.instance = new DatabaseController();
        }
        return DatabaseController.instance;
    }

    public async getPerson(orgName: string, personId: string): Promise<Person | null> {
        Log.info("DatabaseController::getPerson( " + orgName + ", " + personId + " ) - start");
        try {
            const start = Date.now();
            const collection = await this.getCollection(this.PERSONCOLL);

            const res = await this.getSingleRecord(this.PERSONCOLL, {"org": orgName, "id": personId});
            if (res === null) {
                Log.trace("DatabaseController::getPerson(..) - record not found for: " + personId);
                return null;
            } else {
                Log.trace("DatabaseController::getPerson(..)  - found; took: " + Util.took(start));
                return <Person>res;
            }
        } catch (err) {
            Log.error("DatabaseController::getPerson(..) - ERROR: " + err);
        }
        return null;
    }

    public async getPeople(orgName: string): Promise<Person[]> {
        Log.info("DatabaseController::getPeople( " + orgName + " ) - start");
        try {
            const start = Date.now();
            const collection = await this.getCollection(this.PERSONCOLL);

            const res = await this.getRecords(this.PERSONCOLL, {"org": orgName});
            if (res === null) {
                Log.trace("DatabaseController::getPeople(..) - none found for: " + orgName);
                return [];
            } else {
                Log.trace("DatabaseController::getPeople(..)  - found; took: " + Util.took(start));
                return <Person[]>res;
            }
        } catch (err) {
            Log.error("DatabaseController::getPeople(..) - ERROR: " + err);
            return [];
        }
    }

    public async writePerson(person: Person): Promise<boolean> {
        Log.info("DatabaseController::writePerson( " + person + " ) - start");
        try {
            const collection = await this.getCollection(this.PERSONCOLL);
            const copy = Object.assign({}, person);
            await collection.insertOne(copy);
            return true;
        } catch (err) {
            Log.error("DatabaseController::writePerson(..) - ERROR: " + err);
            return false;
        }
    }

    private async getSingleRecord(column: string, query: {} | null): Promise<{} | null> {
        try {
            Log.trace("DatabaseController::getSingleRecord(..) - start");
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
                Log.trace("DatabaseController::getSingleRecord(..) - done; no records found; took: " + Util.took(start));
                return null;
            } else {
                Log.trace("DatabaseController::getSingleRecord(..) - done; # records: " + records.length + "; took: " + Util.took(start));
                let record = records[0];
                delete record._id; // remove the record id, just so we can't use it
                return record;
            }
        } catch (err) {
            Log.error("DatabaseController::getSingleRecord(..) - ERROR: " + err);
        }
        return null;
    }

    private async getRecords(column: string, query: {} | null): Promise<{}[] | null> {
        try {
            Log.trace("DatabaseController::getRecords(..) - start");
            let col = await this.getCollection(column);
            if (query === null) {
                query = {};
            }
            const records: any[] = await <any>col.find(query).toArray();
            if (records === null || records.length === 0) {
                Log.trace("DatabaseController::getRecords(..) - done; no records found");
                return null;
            } else {
                Log.trace("DatabaseController::getRecords(..) - done; # records: " + records.length);
                for (const r of records) {
                    delete r._id;// remove the record id, just so we can't use it
                }
                return records;
            }
        } catch (err) {
            Log.error("DatabaseController::getRecords(..) - ERROR: " + err);
        }
        return null;
    }

    /**
     * Returns a ready-to-use `collection` object from MongoDB.
     *
     * Usage:
     *
     *   (await getCollection('users')).find().toArray().then( ... )
     */
    public async getCollection(collectionName: string): Promise<Collection> {
        const db = await this.open();
        return db.collection(collectionName);
    }

    /**
     * Internal use only, do not use this method; use getCollection(..) instead.
     *
     * @returns {Promise<Db>}
     */
    private async open(): Promise<Db> {
        Log.trace("DatabaseController::open() - start");
        if (this.db === null) {

            const dbName = Config.getInstance().getProp('dbName');
            Log.info("DatabaseController::open() - db null; making new connection to: " + dbName);

            const client = await MongoClient.connect('mongodb://localhost:27017');
            this.db = await client.db(dbName);

            Log.info("DatabaseController::open() - db null; new connection made");
        }
        Log.trace("DatabaseController::open() - returning db");
        return this.db;
    }

    public async clearData(): Promise<void> {
        Log.warn("DatabaseController::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
        if (Config.getInstance().getProp("name") === "test") {
            let cols = [this.GRADECOLL, this.TEAMCOLL, this.DELIVCOLL, this.REPOCOLL];
            for (const col of cols) {
                const collection = await this.getCollection(this.PERSONCOLL);
                await collection.deleteMany({});
            }
            Log.info("DatabaseController::clearData() - files removed");
        } else {
            throw new Error("DatabaseController::clearData() - can only be called on test configurations");
        }
        return;
    }

}

