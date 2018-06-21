import {Collection, Db, MongoClient} from "mongodb";

import Log from "../../../common/Log";
import Util from "../../../common/Util";
import Config from "../../../common/Config";

import {IContainerOutput} from "../../../autotest/src/Types";

import {Auth, Deliverable, Grade, Person, Repository, Team} from "../Types";

export class DatabaseController {

    private static instance: DatabaseController = null;
    private db: Db = null;

    private readonly PERSONCOLL = 'people';
    private readonly GRADECOLL = 'grades';
    private readonly RESULTCOLL = 'results';
    private readonly TEAMCOLL = 'teams';
    private readonly DELIVCOLL = 'deliverables';
    private readonly REPOCOLL = 'repositories';
    private readonly AUTHCOLL = 'auth';

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

    public async getPerson(recordId: string): Promise<Person | null> {
        Log.info("DatabaseController::getPerson( " + recordId + " ) - start");
        return <Person> await this.readSingleRecord(this.PERSONCOLL, {"id": recordId});
    }

    public async getRepository(recordId: string): Promise<Repository | null> {
        Log.info("DatabaseController::getRepository( " + recordId + " ) - start");
        return <Repository> await this.readSingleRecord(this.REPOCOLL, {"id": recordId});
    }

    public async getTeam(recordId: string): Promise<Team | null> {
        Log.info("DatabaseController::getTeam( " + recordId + " ) - start");
        return <Team> await this.readSingleRecord(this.TEAMCOLL, {"id": recordId});
    }

    public async getRepositories(): Promise<Repository[]> {
        Log.info("DatabaseController::getRepositories() - start");
        return <Repository[]> await this.readRecords(this.REPOCOLL, {});
    }

    public async getTeams(): Promise<Team[]> {
        Log.info("DatabaseController::getTeams() - start");
        return <Team[]> await this.readRecords(this.TEAMCOLL, {});
    }

    public async getTeamsForPerson(personId: string): Promise<Team[]> {
        Log.info("DatabaseController::getTeams() - start");
        let teams = await this.readRecords(this.TEAMCOLL, {});
        let myTeams = [];
        for (const t of teams as Team[]) {
            if (t.personIds.indexOf(personId) >= 0) {
                myTeams.push(t);
            }
        }
        return myTeams;
    }

    public async getResults(): Promise<IContainerOutput[]> {
        Log.info("DatabaseController::getResult() - start");
        return <IContainerOutput[]> await this.readRecords(this.RESULTCOLL, {});
    }

    public async getRepositoriesForPerson(personId: string): Promise<Repository[]> {
        Log.info("DatabaseController::getRepositoriesForPerson() - start");

        // NOTE: UNTESTED (except in mongo console)

        let query = [{
            "$lookup": {
                "from":         "teams",
                "localField":   "teamIds",
                "foreignField": "id",
                "as":           "teams"
            }
        },
            {
                "$lookup": {
                    "from":         "people",
                    "localField":   "teams.personIds",
                    "foreignField": "id",
                    "as":           "teammembers"
                }
            },
            {
                "$match": {"teammembers.id": personId}
            }
        ];

        const records: any[] = await (<any>this.getCollection(this.REPOCOLL)).aggregate(query).toArray();

        return records;
    }

    public async getPeople(): Promise<Person[]> {
        Log.info("DatabaseController::getPeople() - start");
        return <Person[]> await this.readRecords(this.PERSONCOLL, {});
    }

    public async getDeliverables(): Promise<Deliverable[]> {
        Log.info("DatabaseController::getDeliverables() - start");
        return <Deliverable[]> await this.readRecords(this.DELIVCOLL, {});
    }

    public async getDeliverable(id: string): Promise<Deliverable> {
        Log.info("DatabaseController::getDeliverable() - start");
        return <Deliverable> await this.readSingleRecord(this.DELIVCOLL, {"id": id});
    }

    public async getGrades(): Promise<Grade[]> {
        Log.info("DatabaseController::getGrades() - start");
        return <Grade[]> await this.readRecords(this.GRADECOLL, {});
    }

    public async getGrade(personId: string, delivId: string): Promise<Grade | null> {
        Log.info("DatabaseController::getGrade( " + personId + ", " + delivId + " ) - start");
        return <Grade> await this.readSingleRecord(this.GRADECOLL, {"personId": personId, "delivId": delivId});
    }

    public async writePerson(record: Person): Promise<boolean> {
        Log.info("DatabaseController::writePerson(..) - start");
        const existingPerson = await this.getPerson(record.id);
        if (existingPerson === null) {
            return await this.writeRecord(this.PERSONCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.PERSONCOLL, query, record);
        }
    }

    public async writeTeam(record: Team): Promise<boolean> {
        Log.info("DatabaseController::writeTeam(..) - start");
        const existingTeam = await this.getTeam(record.id);
        if (existingTeam === null) {
            return await this.writeRecord(this.TEAMCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.TEAMCOLL, query, record);
        }
    }

    /**
     * These are write-only; they should never need to be updated.
     *
     * @param {IContainerOutput} record
     * @returns {Promise<boolean>}
     */
    public async writeResult(record: IContainerOutput): Promise<boolean> {
        Log.info("DatabaseController::writeResult(..) - start");
        return await this.writeRecord(this.RESULTCOLL, record);
    }

    /*
    public async deletePerson(record: Person): Promise<boolean> {
        Log.info("DatabaseController::deletePerson(..) - start");
        return await this.deleteRecord(this.PERSONCOLL, {org: record.org, id: record.id});
    }
    */

    public async deleteRepository(record: Repository): Promise<boolean> {
        Log.info("DatabaseController::deleteRepository(..) - start");
        if (record !== null) {
            return await this.deleteRecord(this.REPOCOLL, {id: record.id});
        }
    }

    public async deleteTeam(record: Team): Promise<boolean> {
        Log.info("DatabaseController::deleteTeam(..) - start");
        if (record !== null) {
            return await this.deleteRecord(this.TEAMCOLL, {id: record.id});
        }
    }

    private async deleteRecord(colName: string, query: {}): Promise<boolean> {
        Log.trace("DatabaseController::deleteRecord( " + colName + ", " + JSON.stringify(query) + " ) - start");
        try {
            const collection = await this.getCollection(colName);
            let res = await collection.deleteOne(query);
            Log.trace("DatabaseController::deleteRecord(..) - delete complete; result: " + JSON.stringify(res));
            return true;
        } catch (err) {
            Log.error("DatabaseController::deleteRecord(..) - ERROR: " + err);
            return false;
        }
    }

    public async writeDeliverable(record: Deliverable): Promise<boolean> {
        Log.info("DatabaseController::writeDeliverable(..) - start");
        Log.trace("DatabaseController::writeDeliverable(..) - deliv: " + JSON.stringify(record));
        const existingDeiverable = await this.getDeliverable(record.id);
        if (existingDeiverable === null) {
            return await this.writeRecord(this.DELIVCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.DELIVCOLL, query, record);
        }
    }

    public async writeGrade(record: Grade): Promise<boolean> {
        Log.info("DatabaseController::writeGrade(..) - start");
        Log.trace("DatabaseController::writeGrade(..) - grade: " + JSON.stringify(record));
        let gradeExists = await this.getGrade(record.personId, record.delivId);
        if (gradeExists === null) {
            return await this.writeRecord(this.GRADECOLL, record);
        } else {
            const query = {personId: record.personId, delivId: record.delivId};
            return await this.updateRecord(this.GRADECOLL, query, record);
        }
    }

    public async writeRepository(record: Repository): Promise<boolean> {
        Log.info("DatabaseController::writeRepository(..) - start");
        Log.trace("DatabaseController::writeRepository(..) - repo: " + JSON.stringify(record));
        const existingRepo = await this.getRepository(record.id);
        if (existingRepo === null) {
            return await this.writeRecord(this.REPOCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.REPOCOLL, query, record);
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
        const configOrg = Config.getInstance().getProp("testorg");
        if (configOrg === "test" || configOrg === "secapstonetest" || configOrg === "CS310-2017Jan_TEST") {
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
        try {
            // Log.trace("DatabaseController::open() - start");
            if (this.db === null) {

                // just use the org name for the db (use a test org name if you want to avoid tests wiping data!!)
                const dbName = Config.getInstance().getProp('org').trim(); // make sure there are no extra spaces in config
                const dbHost = Config.getInstance().getProp('mongoUrl').trim(); // make sure there are no extra spaces in config

                // _ are to help diagnose whitespace in dbname/mongoUrl
                Log.info("DatabaseController::open() - db null; making new connection to: _" + dbName + "_ on: _" + dbHost + "_");

                // 'mongodb://localhost:27017'
                const client = await MongoClient.connect(dbHost);
                this.db = await client.db(dbName);

                Log.info("DatabaseController::open() - db null; new connection made");
            }
            // Log.trace("DatabaseController::open() - returning db");
            return this.db;
        } catch (err) {
            Log.error("DatabaseController::open() - ERROR: " + err);
        }
    }

    public async getAuth(personId: string): Promise<Auth | null> {
        Log.trace("DatabaseController::getAuthToken( " + personId + " ) - start");
        let auth = <Auth> await this.readSingleRecord(this.AUTHCOLL, {"personId": personId});
        return auth;
    }

    /*
    public async verifyAuthToken(org: string, personId: string, token: string): Promise<boolean> {
        Log.trace("DatabaseController::verifyToken( " + org + ", " + personId + " ) - start");
        let auth = <Auth> await this.readSingleRecord(this.AUTHCOLL, {"org": org, "personId": personId});
        if (auth !== null) {
            if (auth.token === token) {
                Log.info("DatabaseController::verifyToken( " + org + ", " + personId + " ) - token verified");
                return true;
            } else {
                Log.info("DatabaseController::verifyToken( " + org + ", " + personId + " ) - token !verified");
                return false;
            }
        }
        Log.info("DatabaseController::verifyToken( " + org + ", " + personId + " ) - no token stored");
        return false;
    }

*/
    public async writeAuth(record: Auth): Promise<boolean> {
        Log.info("DatabaseController::writeAuth(..) - start");
        let auth = <Auth> await this.readSingleRecord(this.AUTHCOLL, {"personId": record.personId});
        if (auth === null) {
            return await this.writeRecord(this.AUTHCOLL, record);
        } else {
            const query = {personId: record.personId};
            return await this.updateRecord(this.AUTHCOLL, query, record);
        }
    }
}

