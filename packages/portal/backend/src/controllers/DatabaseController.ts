import {Collection, Db, MongoClient} from "mongodb";
import Config, {ConfigCourses, ConfigKey} from "../../../../common/Config";

import Log from "../../../../common/Log";
import Util from "../../../../common/Util";

import {AuditEvent, AuditLabel, Auth, Course, Deliverable, Grade, Person, Repository, Result, Team} from "../Types";

export class DatabaseController {
    /**
     * Returns the current controller; shares Mongo connections.
     *
     * @returns {DatabaseController}
     */
    public static getInstance() {
        if (DatabaseController.instance === null) {
            DatabaseController.instance = new DatabaseController();

            // verify that any mandatory objects that are in the db
            // not great to do this on
        }
        return DatabaseController.instance;
    }

    private static instance: DatabaseController = null;

    private db: Db = null;
    private writeDb: Db = null;
    private slowDb: Db = null;

    private readonly COURSECOLL = 'course';
    private readonly PERSONCOLL = 'people';
    private readonly GRADECOLL = 'grades';
    private readonly RESULTCOLL = 'results';
    private readonly TEAMCOLL = 'teams';
    private readonly DELIVCOLL = 'deliverables';
    private readonly REPOCOLL = 'repositories';
    private readonly AUTHCOLL = 'auth';
    private readonly AUDITCOLL = 'audit';
    private readonly TICKERCOLL = 'ids';

    /**
     * use getInstance() instead.
     */
    private constructor() {
        Log.info("DatabaseController::<init> - creating new controller");
    }

    public async getPerson(recordId: string): Promise<Person | null> {
        const person = await this.readSingleRecord(this.PERSONCOLL, {id: recordId}) as Person;
        Log.trace("DatabaseController::getPerson( " + recordId + " ) - found: " + (person !== null));
        return person;
    }

    public async getGitHubPerson(recordId: string): Promise<Person | null> {
        const person = await this.readSingleRecord(this.PERSONCOLL, {githubId: recordId}) as Person;
        Log.trace("DatabaseController::getGitHubPerson( " + recordId + " ) - found: " + (person !== null));
        return person;
    }

    public async getRepository(recordId: string): Promise<Repository | null> {
        const repo = await this.readSingleRecord(this.REPOCOLL, {id: recordId}) as Repository;
        Log.trace("DatabaseController::getRepository( " + recordId + " ) - found: " + (repo !== null));
        return repo;
    }

    public async getTeam(recordId: string): Promise<Team | null> {
        const team = await this.readSingleRecord(this.TEAMCOLL, {id: recordId}) as Team;
        Log.trace("DatabaseController::getTeam( " + recordId + " ) - found: " + (team !== null));
        return team;
    }

    public async getAuth(personId: string): Promise<Auth | null> {
        const auth = await this.readSingleRecord(this.AUTHCOLL, {personId: personId}) as Auth;
        Log.trace("DatabaseController::getAuthToken( " + personId + " ) - found: " + (auth !== null));
        return auth;
    }

    public async getRepositories(): Promise<Repository[]> {
        const repos = await this.readRecords(this.REPOCOLL, 'fast', false, {}) as Repository[];
        Log.trace("DatabaseController::getRepositories() - #: " + repos.length);
        return repos;
    }

    public async getCourseRecord(): Promise<Course | null> {
        const record = await this.readSingleRecord(this.COURSECOLL, {id: Config.getInstance().getProp(ConfigKey.name)}) as Course;
        Log.trace("DatabaseController::getCourseRecord() - found: " + (record !== null));
        return record;
    }

    public async getTeams(): Promise<Team[]> {
        const teams = await this.readRecords(this.TEAMCOLL, 'fast', false, {}) as Team[];
        Log.trace("DatabaseController::getTeams() - #: " + teams.length);
        return teams;
    }

    public async getAllResults(): Promise<Result[]> {
        const query = {};
        const start = Date.now();
        Log.trace("DatabaseController::getAllResults() - start");
        // const latestFirst = {"input.pushInfo.timestamp": -1}; // most recent first
        const latestFirst = {"input.target.timestamp": -1}; // most recent first
        const results = await this.readRecords(this.RESULTCOLL, 'slow', false, query, latestFirst) as Result[];

        for (const result of results) {
            if (typeof (result.input as any).pushInfo !== 'undefined' && typeof result.input.target === 'undefined') {
                // this is a backwards compatibility step that can disappear in 2019 (except for sdmm which will need further changes)
                result.input.target = (result.input as any).pushInfo;
            }
        }
        Log.trace("DatabaseController::getAllResults() - done; #: " + results.length + "; took: " + Util.took(start));
        return results;
    }

    public async getTeamsForPerson(personId: string): Promise<Team[]> {
        Log.info("DatabaseController::getTeamsForPerson() - start");
        const teams = await this.readRecords(this.TEAMCOLL, 'fast', false, {});
        const myTeams = [];
        for (const t of teams as Team[]) {
            if (t.personIds.indexOf(personId) >= 0) {
                myTeams.push(t);
            }
        }
        return myTeams;
    }

    public async getRepositoriesForPerson(personId: string): Promise<Repository[]> {
        Log.info("DatabaseController::getRepositoriesForPerson() - start");

        // tslint:disable
        const query = [{
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
        // tslint:enable

        const collection = await this.getCollection(this.REPOCOLL, 'fast');
        const records: any[] = await collection.aggregate(query).toArray();

        return records;
    }

    // case issues will be harder to fix than this
    // private fixPersonCase(person: Person): Person {
    //     if (person !== null) {
    //         (person as any).id = person.id.toLowerCase(); // always force id to be lowercase
    //         person.githubId = person.githubId.toLowerCase(); // always force id to be lowercase
    //     }
    //     return person;
    // }

    public async getPeople(): Promise<Person[]> {
        const people = await this.readRecords(this.PERSONCOLL, 'fast', false, {}) as Person[];
        Log.trace("DatabaseController::getPeople() - #: " + people.length);
        return people;
    }

    public async getDeliverables(): Promise<Deliverable[]> {
        const delivs = await this.readRecords(this.DELIVCOLL, 'fast', false, {}) as Deliverable[];
        Log.trace("DatabaseController::getDeliverables() - #: " + delivs.length);
        return delivs;
    }

    public async getDeliverable(id: string): Promise<Deliverable> {
        const deliv = await this.readSingleRecord(this.DELIVCOLL, {id}) as Deliverable;
        Log.trace("DatabaseController::getDeliverable() - found: " + (deliv !== null));
        return deliv;
    }

    public async getGrades(): Promise<Grade[]> {
        const start = Date.now();
        Log.trace("DatabaseController::getGrades() - start");
        const grades = await this.readRecords(this.GRADECOLL, 'slow', false, {}) as Grade[];
        Log.trace("DatabaseController::getGrades() - done; #: " + grades.length + "; took: " + Util.took(start));
        return grades;
    }

    public async getGrade(personId: string, delivId: string): Promise<Grade | null> {
        const grade = await this.readSingleRecord(this.GRADECOLL, {personId: personId, delivId: delivId}) as Grade;
        if (grade !== null) {
            Log.trace("DatabaseController::getGrade( " + personId + ", " + delivId + " ) - grade: " + grade.score);
        } else {
            Log.trace("DatabaseController::getGrade( " + personId + ", " + delivId + " ) - not found");
        }
        return grade;
    }

    /**
     * Gets and increments a per-deliverable counter. Numbers start at 000 and increment.
     *
     * Pre-padding with 0s for easier searching, but will be problematic for deliverables with > 1000 teams.
     *
     * @param {string} delivId
     * @returns {Promise<string>}
     */
    public async getUniqueTeamNumber(delivId: string): Promise<string> {
        const ticker = await this.readAndUpdateSingleRecord(this.TICKERCOLL, {tickerId: delivId}, {$inc: {ticker: 1}});
        let res: number = 0;
        if (ticker !== null) {
            Log.trace("DatabaseController::getUniqueTeamNumber() - " + delivId + " ticker found: " + ticker.ticker);
            res = ticker.ticker;
        } else {
            Log.trace("DatabaseController::getUniqueTeamNumber() - " + delivId + " ticker NOT found. Setting ticker");
            await this.writeRecord(this.TICKERCOLL, {tickerId: delivId, ticker: 1});
        }
        return ("00" + res).slice(-3);
    }

    public async writePerson(record: Person): Promise<boolean> {
        // Log.info("DatabaseController::writePerson(..) - start");
        const existingPerson = await this.getPerson(record.id);
        if (existingPerson === null) {
            return await this.writeRecord(this.PERSONCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.PERSONCOLL, query, record);
        }
    }

    public async writeTeam(record: Team): Promise<boolean> {
        // Log.info("DatabaseController::writeTeam(..) - start");
        const existingTeam = await this.getTeam(record.id);
        if (existingTeam === null) {
            return await this.writeRecord(this.TEAMCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.TEAMCOLL, query, record);
        }
    }

    public async writeCourseRecord(record: Course): Promise<boolean> {
        // Log.info("DatabaseController::writeCourseRecord(..) - start");
        const existingRecord = await this.getCourseRecord();
        if (existingRecord === null) {
            return await this.writeRecord(this.COURSECOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.COURSECOLL, query, record);
        }
    }

    /**
     * Result records are associated with repos, SHAs, and delivIds. Really the repo could be removed
     * as the SHA (or commitURL) would be enough to work with the delivId.
     *
     * @param {Result} record
     * @returns {Promise<boolean>}
     */
    public async writeResult(record: Result): Promise<boolean> {
        Log.info("DatabaseController::writeResult(..) - start");

        const resultExists = await this.getResult(record.delivId, record.repoId, record.commitSHA);
        if (resultExists === null) {
            Log.trace("DatabaseController::writeResult(..) - new");
            return await this.writeRecord(this.RESULTCOLL, record);
        } else {
            Log.trace("DatabaseController::writeResult(..) - update");
            const query = {commitSHA: record.commitSHA, repoId: record.repoId, delivId: record.delivId};
            return await this.updateRecord(this.RESULTCOLL, query, record);
        }
    }

    /*
    public async deletePerson(record: Person): Promise<boolean> {
        Log.info("DatabaseController::deletePerson(..) - start");
        return await this.deleteRecord(this.PERSONCOLL, {id: record.id});
    }
    */

    public async deleteAuth(record: Auth): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deleteAuth( " + record.personId + " ) - start");
            return await this.deleteRecord(this.AUTHCOLL, {personId: record.personId});
        }
        return false;
    }

    public async deleteRepository(record: Repository): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deleteRepository( " + record.id + " ) - start");
            return await this.deleteRecord(this.REPOCOLL, {id: record.id});
        }
        return false;
    }

    public async deleteDeliverable(record: Deliverable): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deleteDeliverable( " + record.id + " ) - start");
            return await this.deleteRecord(this.DELIVCOLL, {id: record.id});
        }
        return false;
    }

    public async deletePerson(record: Person): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deletePerson( " + record.id + " ) - start");
            return await this.deleteRecord(this.PERSONCOLL, {id: record.id});
        }
        return false;
    }

    public async deleteTeam(record: Team): Promise<boolean> {
        if (record !== null) {
            Log.info("DatabaseController::deleteTeam( " + record.id + " ) - start");
            return await this.deleteRecord(this.TEAMCOLL, {id: record.id});
        }
        return false;
    }

    private async deleteRecord(colName: string, query: {}): Promise<boolean> {
        Log.trace("DatabaseController::deleteRecord( " + colName + ", " + JSON.stringify(query) + " ) - start");
        try {
            const collection = await this.getCollection(colName);
            const res = await collection.deleteOne(query);
            Log.trace("DatabaseController::deleteRecord(..) - delete complete; result: " + JSON.stringify(res));
            return true;
        } catch (err) {
            Log.error("DatabaseController::deleteRecord(..) - ERROR: " + err);
            return false;
        }
    }

    public async writeDeliverable(record: Deliverable): Promise<boolean> {
        // Log.info("DatabaseController::writeDeliverable(..) - start");
        // Log.trace("DatabaseController::writeDeliverable(..) - deliv: " + JSON.stringify(record));
        const existingDeiverable = await this.getDeliverable(record.id);
        if (existingDeiverable === null) {
            return await this.writeRecord(this.DELIVCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.DELIVCOLL, query, record);
        }
    }

    public async writeGrade(record: Grade): Promise<boolean> {
        // Log.info("DatabaseController::writeGrade(..) - start");
        // Log.trace("DatabaseController::writeGrade(..) - grade: " + JSON.stringify(record));
        const gradeExists = await this.getGrade(record.personId, record.delivId);
        if (gradeExists === null) {
            return await this.writeRecord(this.GRADECOLL, record);
        } else {
            const query = {personId: record.personId, delivId: record.delivId};
            return await this.updateRecord(this.GRADECOLL, query, record);
        }
    }

    public async writeAudit(label: AuditLabel, personId: string, before: any, after: any, custom: any): Promise<boolean> {
        try {
            // Log.info("DatabaseController::writeAudit(..) - start");
            Log.info("DatabaseController::writeAudit( " + label + ", " + personId + ", hasBefore: " +
                !Util.isEmpty(before) + ", hasAfter: " + !Util.isEmpty(after) + " ) - start");

            let finalLabel = label + '_';
            if (Util.isEmpty(before) === true && Util.isEmpty(after) === true) {
                // is an action, no postfix
                finalLabel = label;
            } else if (Util.isEmpty(before) === true) {
                finalLabel = finalLabel + 'CREATE';
            } else if (Util.isEmpty(after) === true) {
                finalLabel = finalLabel + 'DELETE';
            } else {
                finalLabel = finalLabel + 'UPDATE';
            }
            const auditRecord: AuditEvent = {
                label:     finalLabel,
                timestamp: Date.now(),
                personId:  personId,
                before:    before,
                after:     after,
                custom:    custom
            };
            return await this.writeRecord(this.AUDITCOLL, auditRecord);
        } catch (err) {
            // never want this to mess with whatever called it; eat all errors
            Log.error("DatabaseController::writeAudit(..) - ERROR: " + err.message);
            return false;
        }
    }

    public async writeRepository(record: Repository): Promise<boolean> {
        // Log.info("DatabaseController::writeRepository(..) - start");
        if (record.custom === null) {
            record.custom = {}; // make sure this always exists
        }
        // Log.trace("DatabaseController::writeRepository(..) - repo: " + JSON.stringify(record));
        const existingRepo = await this.getRepository(record.id);
        if (existingRepo === null) {
            return await this.writeRecord(this.REPOCOLL, record);
        } else {
            const query = {id: record.id};
            return await this.updateRecord(this.REPOCOLL, query, record);
        }
    }

    public async writeRecord(colName: string, record: {}): Promise<boolean> {
        Log.trace("DatabaseController::writeRecord( " + colName + ", ...) - writing");
        // Log.trace("DatabaseController::writeRecord(..) - col: " + colName + "; record: " + JSON.stringify(record));
        try {
            const collection = await this.getCollection(colName, 'write');
            const copy = Object.assign({}, record);
            await collection.insertOne(copy);
            // Log.trace("DatabaseController::writeRecord(..) - write complete");
            return true;
        } catch (err) {
            Log.error("DatabaseController::writeRecord(..) - ERROR: " + err);
            return false;
        }
    }

    public async updateRecord(colName: string, query: {}, record: {}): Promise<boolean> {
        Log.trace("DatabaseController::updateRecord( " + colName + ", ...) - start");
        Log.trace("DatabaseController::updateRecord(..) - colName: " + colName + "; record: " + JSON.stringify(record));
        try {
            const collection = await this.getCollection(colName, 'write');
            const copy = Object.assign({}, record);
            const res = await collection.replaceOne(query, copy); // copy was record
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
    public async getCollection(collectionName: string, queryKind?: string): Promise<Collection> {
        try {
            let db;
            if (typeof queryKind === 'undefined' || queryKind === null) {
                db = await this.open('fast');
            } else if (queryKind === 'slow') {
                db = await this.open('slow');
            } else {
                db = await this.open('fast');
            }

            return db.collection(collectionName);
        } catch (err) {
            Log.error("DatabaseController::getCollection( " + collectionName +
                " ) - Mongo is probably not running; ERROR: " + err.message);
            process.exit(-1); // this is a fatal failure
        }
    }

    public async clearData(): Promise<void> {
        Log.warn("DatabaseController::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");

        const configName = Config.getInstance().getProp(ConfigKey.name);
        Log.warn("DatabaseController::clearData() - name: " + configName);

        if (configName === ConfigCourses.classytest) {
            // NOTE: can only delete data if the current instance is the main test instance
            // This prevents us from running the tests in production by accident and wiping the database

            const cols = [this.PERSONCOLL, this.GRADECOLL, this.RESULTCOLL, this.TEAMCOLL,
                this.DELIVCOLL, this.REPOCOLL, this.AUTHCOLL, this.COURSECOLL, this.AUDITCOLL, this.TICKERCOLL];

            for (const col of cols) {
                Log.info("DatabaseController::clearData() - removing data for collection: " + col);
                const collection = await this.getCollection(col);
                await collection.deleteMany({});
            }
            Log.info("DatabaseController::clearData() - data removed");

            await this.initDatabase();
            Log.info("DatabaseController::clearData() - database reset with initial objects");
        } else {
            throw new Error("DatabaseController::clearData() - can only be called on test configurations");
        }
        return;
    }

    /**
     *
     * @param {string} column
     * @param {{}} query
     * @returns {Promise<{} | null>}
     */
    private async readSingleRecord(column: string, query: {}): Promise<{} | null> {
        try {
            // Log.trace("DatabaseController::readSingleRecord( " + column + ", " + JSON.stringify(query) + " ) - start");
            const start = Date.now();
            const col = await this.getCollection(column, 'fast');

            const records: any[] = await (col as any).find(query).toArray();
            if (records === null || records.length === 0) {
                // Log.trace("DatabaseController::readSingleRecord(..) - done; no records found; took: " + Util.took(start));
                return null;
            } else {
                // Log.trace("DatabaseController::readSingleRecord(..) - done; # records: " +
                // records.length + "; took: " + Util.took(start));
                const record = records[0];
                delete record._id; // remove the record id, just so we can't use it
                return record;
            }
        } catch (err) {
            Log.error("DatabaseController::readSingleRecord(..) - ERROR: " + err);
            return null;
        }
    }

    /**
     *
     * @param {string} column
     * @param {string} kind this is the kind of query ('slow', 'write', or null)
     * * @param {boolean} limitResults whether the full result list should be returned or just a subset
     * @param {{}} query send {} if all results for that column are wanted
     * * @param {{}} sort? send only if a specific ordering is required
     * @returns {Promise<any[]>} An array of objects
     */
    public async readRecords(column: string, kind: string, limitResults: boolean, query: {}, sort?: {}): Promise<any[]> {
        try {
            if (typeof sort === 'undefined') {
                Log.trace("DatabaseController::readRecords( " + column + ", " + JSON.stringify(query) + " ) - start");
            } else {
                Log.trace("DatabaseController::readRecords( " + column + ", " +
                    JSON.stringify(query) + ", " + JSON.stringify(sort) + " ) - start");
            }

            let LIMITS = 999999999;
            if (limitResults === true) {
                LIMITS = 400;
                Log.trace("DatabaseController::readRecords( " + column + ", ... ) - limited results query");
            }

            const start = Date.now();
            const col = await this.getCollection(column, kind);

            let records: any[];
            if (typeof sort === 'undefined') {
                records = await (col as any).find(query).limit(LIMITS).toArray();
            } else {
                records = await (col as any).find(query).limit(LIMITS).sort(sort).toArray();
            }

            if (records === null || records.length === 0) {
                Log.trace("DatabaseController::readRecords(..) - done; no records found for: " +
                    JSON.stringify(query) + " in: " + column + "; took: " + Util.took(start));
                return [];
            } else {
                for (const r of records) {
                    delete r._id; // remove the record id, just so we can't use it
                }
                Log.trace("DatabaseController::readRecords(..) - done; query: " + JSON.stringify(query) + "; # records: " +
                    records.length + ". took: " + Util.took(start));
                return records;
            }
        } catch (err) {
            Log.error("DatabaseController::readRecords(..) - ERROR: " + err);
        }
        return [];
    }

    private async readAndUpdateSingleRecord(column: string, query: {}, update: {}): Promise<any> {
        try {
            const start = Date.now();
            const col = await this.getCollection(column, 'write');

            const record: any = (await (col as any).findOneAndUpdate(query, update)).value;

            if (record === null || record === undefined) {
                return null;
            } else {
                delete record._id;
                return record;
            }
        } catch (err) {
            Log.error("DatabaseController::readAndUpdateSingleRecord(..) - ERROR: " + err);
            return null;
        }
    }

    /**
     * Internal use only, do not use this method; use getCollection(..) instead.
     *
     * @returns {Promise<Db>}
     */
    private async open(kind: string): Promise<Db> {
        try {
            // Log.trace("DatabaseController::open() - start");
            let db = null;
            if (kind === 'slow') {
                db = this.slowDb;
            } else if (kind === 'write') {
                db = this.writeDb;
            } else {
                db = this.db;
            }

            if (db === null) {
                // just use Config.name for the db (use a test org name if you want to avoid tests wiping data!!)
                let dbName = Config.getInstance().getProp(ConfigKey.name).trim(); // make sure there are no extra spaces in config
                const dbHost = Config.getInstance().getProp(ConfigKey.mongoUrl).trim(); // make sure there are no extra spaces in config

                /* istanbul ignore if */
                if (dbName === 'sdmm') {
                    dbName = 'secapstone'; // NOTE: this is just an unfortunate historical artifact
                }

                // _ are to help diagnose whitespace in dbname/mongoUrl
                Log.info("DatabaseController::open() - db null; making new connection to: _" + dbName + "_ on: _" + dbHost + "_");

                const client = await MongoClient.connect(dbHost);
                if (kind === 'slow') {
                    Log.info("DatabaseController::open() - creating slowDb");
                    this.slowDb = await client.db(dbName);
                    db = this.slowDb;
                } else if (kind === 'write') {
                    Log.info("DatabaseController::open() - creating writeDb");
                    this.writeDb = await client.db(dbName);
                    db = this.writeDb;
                } else {
                    Log.info("DatabaseController::open() - creating standard db");
                    this.db = await client.db(dbName);
                    db = this.db;

                    // ensure required records / indexes exist
                    await this.initDatabase();
                }

                Log.info("DatabaseController::open() - db null; new connection made");
            }
            // Log.trace("DatabaseController::open() - returning db");
            return db;
        } catch (err) {
            Log.error("DatabaseController::open() - ERROR: " + err);
            Log.error("DatabaseController::open() - ERROR: Host probably does not have a database configured " +
                "and running (see README.md if this is a test instance).");
        }
    }

    /**
     * Collect any actions that need to happen when a database is first opened.
     *
     * This can include objects or indexes that must be created.
     */
    private async initDatabase() {
        try {
            if (this.db === null) {
                throw new Error("DatabaseController::initDatabase() cannot be called before db is set");
            }

            // create indexes if they don't exist (idempotent operation; even if index exists this is ok)
            // https://stackoverflow.com/a/35020346

            // results needs a timestamp index because it gets to be too long to iterate through all records (32MB result limit)
            const coll = await this.getCollection(this.RESULTCOLL);
            await coll.createIndex({
                "input.target.timestamp": -1
            }, {name: "ts"});

            // Make sure required Team objects exist.
            // Cannot use TeamController because this would cause an infinite loop since
            // TeamController uses this code to get the database instance.
            let teamName = 'admin';
            let team = await this.getTeam(teamName);
            if (team === null) {
                const newTeam: Team = {
                    id:        teamName,
                    delivId:   null, // null for special teams
                    githubId:  null, // to be filled in later
                    URL:       null, // to be filled in later
                    personIds: [], // empty for special teams
                    // repoName:  null, // null for special teams
                    // repoUrl:   null,
                    custom:    {}
                };
                await this.writeTeam(newTeam);
            }
            teamName = 'staff';
            team = await this.getTeam(teamName);
            if (team === null) {
                const newTeam: Team = {
                    id:        teamName,
                    delivId:   null, // null for special teams
                    githubId:  null, // to be filled in later
                    URL:       null, // to be filled in later
                    personIds: [], // empty for special teams
                    // repoName:  null, // null for special teams
                    // repoUrl:   null,
                    custom:    {}
                };
                await this.writeTeam(newTeam);
            }
            teamName = 'students';
            team = await this.getTeam(teamName);
            if (team === null) {
                const newTeam: Team = {
                    id:        teamName,
                    delivId:   null, // null for special teams
                    githubId:  null, // to be filled in later
                    URL:       null, // to be filled in later
                    personIds: [], // empty for special teams
                    // repoName:  null, // null for special teams
                    // repoUrl:   null,
                    custom:    {}
                };
                await this.writeTeam(newTeam);
            }
        } catch (err) {
            Log.error("DatabaseController::initDatabase() - ERROR: " + err.message);
        }
    }

    public async writeAuth(record: Auth): Promise<boolean> {
        Log.trace("DatabaseController::writeAuth( " + record.personId + ", ... ) - start");
        const auth = await this.readSingleRecord(this.AUTHCOLL, {personId: record.personId}) as Auth;
        if (auth === null) {
            return await this.writeRecord(this.AUTHCOLL, record);
        } else {
            const query = {personId: record.personId};
            return await this.updateRecord(this.AUTHCOLL, query, record);
        }
    }

    /**
     * For a given deliverable and repo, find all the results.
     *
     * NOTE: These are _all_ results, the deliverable's deadlines are not considered.
     *
     * @param delivId
     * @param repoId
     */
    public async getResults(delivId: string, repoId: string): Promise<Result[]> {
        const start = Date.now();
        Log.trace("DatabaseController::getResults( " + delivId + ", " + repoId + " ) - start");
        const latestFirst = {"input.target.timestamp": -1}; // most recent first
        const results = await this.readRecords(this.RESULTCOLL, 'slow', false,
            {delivId: delivId, repoId: repoId}, latestFirst) as Result[];
        for (const result of results) {
            if (typeof (result.input as any).pushInfo !== 'undefined' && typeof result.input.target === 'undefined') {
                // this is a backwards compatibility step that can disappear in 2019 (except for sdmm which will need further changes)
                result.input.target = (result.input as any).pushInfo;
            }
        }

        Log.trace("DatabaseController::getResults( " + delivId + ", " + repoId + " ) - done; #: " +
            results.length + "; took: " + Util.took(start));

        return results;
    }

    /**
     * For a given deliverable, find all the results.
     *
     * NOTE: These are _all_ results, the deliverable's deadlines are not considered.
     *
     * @param delivId
     */
    public async getResultsForRepo(repoId: string): Promise<Result[]> {
        const start = Date.now();
        Log.trace("DatabaseController::getResultsForRepo( " + repoId + " ) - start");

        const latestFirst = {"input.target.timestamp": -1}; // most recent first
        const results = await this.readRecords(this.RESULTCOLL, 'slow', false, {repoId: repoId}, latestFirst) as Result[];
        for (const result of results) {
            if (typeof (result.input as any).pushInfo !== 'undefined' && typeof result.input.target === 'undefined') {
                // this is a backwards compatibility step that can disappear in 2019 (except for sdmm which will need further changes)
                result.input.target = (result.input as any).pushInfo;
            }
        }

        Log.trace("DatabaseController::getResultsForRepo( " + repoId + " ) - done; #: " +
            results.length + "; took: " + Util.took(start));

        return results;
    }

    /**
     * For a given deliverable, find all the results.
     *
     * NOTE: These are _all_ results, the deliverable's deadlines are not considered.
     *
     * @param delivId
     */
    public async getResultsForDeliverable(delivId: string): Promise<Result[]> {
        const start = Date.now();
        Log.trace("DatabaseController::getResultsForDeliverable( " + delivId + " ) - start");

        const latestFirst = {"input.target.timestamp": -1}; // most recent first
        const results = await this.readRecords(this.RESULTCOLL, 'slow', true, {delivId: delivId}, latestFirst) as Result[];
        for (const result of results) {
            if (typeof (result.input as any).pushInfo !== 'undefined' && typeof result.input.target === 'undefined') {
                // this is a backwards compatibility step that can disappear in 2019 (except for sdmm which will need further changes)
                result.input.target = (result.input as any).pushInfo;
            }
        }

        Log.trace("DatabaseController::getResultsForDeliverable( " + delivId + " ) - done; #: " +
            results.length + "; took: " + Util.took(start));

        return results;
    }

    /**
     * Find the result for a given deliverable, repo, SHA tuple or null if such a result does not exist.
     *
     * @param delivId
     * @param repoId
     * @param sha
     */
    public async getResult(delivId: string, repoId: string, sha: string): Promise<Result | null> {
        const results = await this.getResults(delivId, repoId) as Result[];
        let result = null;
        for (const res of results) {
            if (res.commitSHA === sha) {
                // there should only be one of these <delivId, SHA> tuples, but if there are more than one this will return the last one
                result = res;
            }
        }

        if (result === null) {
            Log.info("DatabaseController::getResult( " + delivId + ", " + repoId + ", " + sha + " ) - result not found");
        }
        return result;
    }

    /**
     * Gets the result for a commit and a deliverable. Only returns one record because multiple executions on the same <SHA, delivId>
     * tuple cause the db record to be updated.
     *
     * @param {string} commitURL
     * @param {string} delivId
     * @returns {Promise<Result>}
     */
    public async getResultFromURL(commitURL: string, delivId: string): Promise<Result | null> {
        const result = await this.readSingleRecord(this.RESULTCOLL, {commitURL: commitURL, delivId: delivId}) as Result;
        return result;
    }

    public async getResultsForPerson(personId: string, delivId: string): Promise<Result | null> {
        const result = await this.readSingleRecord(this.RESULTCOLL, {people: personId, delivId: delivId}) as Result;
        return result;
    }

    public async getRecentPassingResultsForDeliv(delivId: string): Promise<Result[]> {
        const minScore = 50;
        const start = Date.now();
        const minDate = Date.now() - (24 * 60 * 60 * 1000); // The last 24 hours
        const query = {delivId, "output.timestamp": {$gt: minDate}, "output.report.scoreTest": {$gt: minScore}};
        const results = await this.readRecords(this.RESULTCOLL, 'fast', true, query);
        const took = Util.took(start);
        Log.trace(`DatabaseController::getRecentPassingResultsForDeliv(..) - # results: ${results.length}; took: ${took}`);
        return results;
    }
}
