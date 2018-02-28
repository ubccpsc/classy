import {Collection, Db, MongoClient} from "mongodb";

import {Deliverable, Grade, Person, Repository, Team} from "../Types";
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

    /**
     * use getInstance() instead.
     */
    private constructor() {
        Log.info("DatabaseController::<init> - creating new controller");
    }

    /**
     * Returns the current controller; shares Mongo connections.
     *
     * @returns {DatabaseController}
     */
    public static getInstance() {
        if (DatabaseController.instance === null) {
            DatabaseController.instance = new DatabaseController();
        }
        return DatabaseController.instance;
    }

    public async getPerson(orgName: string, recordId: string): Promise<Person | null> {
        Log.info("DatabaseController::getPerson( " + orgName + ", " + recordId + " ) - start");
        return <Person> await this.readSingleRecord(this.PERSONCOLL, {"org": orgName, "id": recordId});
    }

    public async getRepository(orgName: string, recordId: string): Promise<Repository | null> {
        Log.info("DatabaseController::getRepository( " + orgName + ", " + recordId + " ) - start");
        return <Repository> await this.readSingleRecord(this.REPOCOLL, {"org": orgName, "id": recordId});
    }

    public async getTeam(orgName: string, recordId: string): Promise<Team | null> {
        Log.info("DatabaseController::getTeam( " + orgName + ", " + recordId + " ) - start");
        return <Team> await this.readSingleRecord(this.TEAMCOLL, {"org": orgName, "id": recordId});
    }

    public async getRepositories(orgName: string): Promise<Repository[]> {
        Log.info("DatabaseController::getRepositories( " + orgName + " ) - start");
        return <Repository[]> await this.readRecords(this.REPOCOLL, {"org": orgName});
    }

    public async getTeams(orgName: string): Promise<Team[]> {
        Log.info("DatabaseController::getTeams( " + orgName + " ) - start");
        return <Team[]> await this.readRecords(this.TEAMCOLL, {"org": orgName});
    }

    public async getPeople(orgName: string): Promise<Person[]> {
        Log.info("DatabaseController::getPeople( " + orgName + " ) - start");
        return <Person[]> await this.readRecords(this.PERSONCOLL, {"org": orgName});
    }

    public async getDeliverables(orgName: string): Promise<Deliverable[]> {
        Log.info("DatabaseController::getDeliverables( " + orgName + " ) - start");
        return <Deliverable[]> await this.readRecords(this.DELIVCOLL, {"org": orgName});
    }

    public async getDeliverable(orgName: string, id: string): Promise<Deliverable> {
        Log.info("DatabaseController::getDeliverable( " + orgName + " ) - start");
        return <Deliverable> await this.readSingleRecord(this.DELIVCOLL, {"org": orgName, "id": id});
    }

    public async getGrades(orgName: string): Promise<Grade[]> {
        Log.info("DatabaseController::getGrades( " + orgName + " ) - start");
        return <Grade[]> await this.readRecords(this.GRADECOLL, {"org": orgName});
    }

    public async getGrade(orgName: string, personId: string, delivId: string): Promise<Grade | null> {
        Log.info("DatabaseController::getGrade( " + orgName + ", " + personId + ", " + delivId + " ) - start");
        return <Grade> await this.readSingleRecord(this.GRADECOLL, {"org": orgName, "personId": personId, "delivId": delivId});
    }

    public async writePerson(record: Person): Promise<boolean> {
        Log.info("DatabaseController::writePerson(..) - start");
        const existingPerson = await this.getPerson(record.org, record.id);
        if (existingPerson === null) {
            return await this.writeRecord(this.PERSONCOLL, record);
        } else {
            Log.info("DatabaseController::writePerson(..) - ERROR; person already exists; person: " + JSON.stringify(record));
            return false;
        }
    }

    public async writeTeam(record: Team): Promise<boolean> {
        Log.info("DatabaseController::writeTeam(..) - start");
        const existingTeam = await this.getTeam(record.org, record.id);
        if (existingTeam === null) {
            return await this.writeRecord(this.TEAMCOLL, record);
        } else {
            Log.info("DatabaseController::writeTeam(..) - ERROR; team already exists; team: " + JSON.stringify(record));
            return false;
        }
    }

    public async writeDeliverable(record: Deliverable): Promise<boolean> {
        Log.info("DatabaseController::writeDeliverable(..) - start");
        const existingDeiverable = await this.getDeliverable(record.org, record.id);
        if (existingDeiverable === null) {
            return await this.writeRecord(this.DELIVCOLL, record);
        } else {
            const query = {org: record.org, id: record.id};
            return await this.updateRecord(this.DELIVCOLL, query, record);
        }
    }

    public async writeGrade(record: Grade): Promise<boolean> {
        Log.info("DatabaseController::writeGrade(..) - start");
        let gradeExists = await this.getGrade(record.org, record.personId, record.delivId);
        if (gradeExists === null) {
            return await this.writeRecord(this.GRADECOLL, record);
        } else {
            const query = {org: record.org, personId: record.personId, delivId: record.delivId};
            return await this.updateRecord(this.GRADECOLL, query, record);
        }
    }

    public async writeRepository(record: Repository): Promise<boolean> {
        Log.info("DatabaseController::writeRepository(..) - start");
        const existingRepo = await this.getRepository(record.org, record.id);
        if (existingRepo === null) {
            return await this.writeRecord(this.REPOCOLL, record);
        } else {
            Log.info("DatabaseController::writeRepository(..) - ERROR; repo already exists; repo: " + JSON.stringify(record));
            return false;
        }
    }

    public async writeRecord(colName: string, record: {}): Promise<boolean> {
        Log.info("DatabaseController::writeRecord( " + colName + ", ...) - start");
        Log.trace("DatabaseController::writeRecord(..) - col: " + colName + "; record: " + JSON.stringify(record));
        try {
            const collection = await this.getCollection(colName);
            const copy = Object.assign({}, record);
            await collection.insertOne(copy);
            Log.trace("DatabaseController::writeRecord(..) - write complete");
            return true;
        } catch (err) {
            Log.error("DatabaseController::writeRecord(..) - ERROR: " + err);
            return false;
        }
    }

    public async updateRecord(colName: string, query: {}, record: {}): Promise<boolean> {
        Log.info("DatabaseController::updateRecord( " + colName + ", ...) - start");
        Log.trace("DatabaseController::updateRecord(..) - colName: " + colName + "; record: " + JSON.stringify(record));
        try {
            const collection = await this.getCollection(colName);
            const copy = Object.assign({}, record);
            let res = await collection.replaceOne(
                query,
                record
            );
            Log.trace("DatabaseController::updateRecord(..) - write complete; res: " + JSON.stringify(res));
            return true;
        } catch (err) {
            Log.error("DatabaseController::updateRecord(..) - ERROR: " + err);
            return false;
        }
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

    public async clearData(): Promise<void> {
        Log.warn("DatabaseController::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
        const configName = Config.getInstance().getProp("name");
        if (configName === "test" || configName === "secapstonetest") {
            let cols = [this.PERSONCOLL, this.GRADECOLL, this.TEAMCOLL, this.DELIVCOLL, this.REPOCOLL];
            for (const col of cols) {
                Log.info("DatabaseController::clearData() - removing data for collection: " + col);
                const collection = await this.getCollection(col);
                await collection.deleteMany({});
            }
            Log.info("DatabaseController::clearData() - files removed");
        } else {
            throw new Error("DatabaseController::clearData() - can only be called on test configurations");
        }
        return;
    }

    private async readSingleRecord(column: string, query: {} | null): Promise<{} | null> {
        try {
            Log.trace("DatabaseController::readSingleRecord( " + column + ", " + JSON.stringify(query) + " ) - start");
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
                Log.trace("DatabaseController::readSingleRecord(..) - done; no records found; took: " + Util.took(start));
                return null;
            } else {
                Log.trace("DatabaseController::readSingleRecord(..) - done; # records: " + records.length + "; took: " + Util.took(start));
                let record = records[0];
                delete record._id; // remove the record id, just so we can't use it
                return record;
            }
        } catch (err) {
            Log.error("DatabaseController::readSingleRecord(..) - ERROR: " + err);
        }
        return null;
    }

    private async readRecords(column: string, query: {} | null): Promise<{}[]> {
        try {
            Log.trace("DatabaseController::readRecords( " + column + ", " + JSON.stringify(query) + " ) - start");
            const start = Date.now();
            let col = await this.getCollection(column);
            if (query === null) {
                query = {};
            }
            const records: any[] = await <any>col.find(query).toArray();
            if (records === null || records.length === 0) {
                Log.trace("DatabaseController::readRecords(..) - done; no records found for: " + JSON.stringify(query) + " in: " + column + "; took: " + Util.took(start));
                return [];
            } else {
                Log.trace("DatabaseController::readRecords(..) - done; # records: " + records.length + ". took: " + Util.took(start));
                for (const r of records) {
                    delete r._id;// remove the record id, just so we can't use it
                }
                return records;
            }
        } catch (err) {
            Log.error("DatabaseController::readRecords(..) - ERROR: " + err);
        }
        return [];
    }

    /**
     * Internal use only, do not use this method; use getCollection(..) instead.
     *
     * @returns {Promise<Db>}
     */
    private async open(): Promise<Db> {
        // Log.trace("DatabaseController::open() - start");
        if (this.db === null) {
            const dbName = Config.getInstance().getProp('dbName');
            Log.info("DatabaseController::open() - db null; making new connection to: " + dbName);

            const client = await MongoClient.connect('mongodb://localhost:27017');
            this.db = await client.db(dbName);

            Log.info("DatabaseController::open() - db null; new connection made");
        }
        // Log.trace("DatabaseController::open() - returning db");
        return this.db;
    }

}

