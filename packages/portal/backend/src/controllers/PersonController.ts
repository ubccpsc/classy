import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import { CSVParser } from "../server/common/CSVParser";

import {StudentTransport} from "../../../../common/types/PortalTypes";
import Util from "../../../../common/Util";
import {AuditLabel, Person, PersonKind, Repository} from "../Types";

import {DatabaseController} from "./DatabaseController";
import {GitHubActions} from "./GitHubActions";

export class PersonController {

    private db: DatabaseController = DatabaseController.getInstance();

    /**
     * Creates a person. If that person exists, returns the existing person.
     *
     * @param {Person} personPrototype
     * @returns {Promise<Person | null>}
     */
    public async createPerson(personPrototype: Person): Promise<Person | null> {
        Log.info("PersonController::createPerson( " + personPrototype.id + " ) - start");
        const existingPerson = await this.db.getPerson(personPrototype.id);

        if (existingPerson === null) {
            await this.db.writePerson(personPrototype);

            Log.trace("PersonController::createPerson( " + personPrototype.id + " ) - created");
            const person = await this.db.getPerson(personPrototype.id);
            return person;

        } else {
            // merge people
            existingPerson.labId = personPrototype.labId; // can update
            existingPerson.githubId = personPrototype.githubId; // can update
            existingPerson.URL = personPrototype.URL; // can update (along with githubId)
            // NOTE: existingPerson.custom is _not_ deleted ; unsure if this is the right thing
            // existingPerson.custom = {};

            await this.db.writePerson(existingPerson);

            Log.trace("PersonController::createPerson( " + existingPerson.id + " ) - updated");
            const person = await this.db.getPerson(personPrototype.id);
            return person;
        }

    }

    /**
     * Writes a person record. If the person exists, they will be updated.
     *
     * Person.id is invariant so that is the field that will be used for matching.
     *
     * @param {Person} person
     * @returns {Promise<boolean>}
     */
    public async writePerson(person: Person): Promise<boolean> {
        Log.trace("PersonController::writePerson( " + person.id + " ) - start");

        const successful = await this.db.writePerson(person);
        return successful;
    }

    public async processClasslist(personId: string = null, path: string = null,  data: any): Promise<Person[]> {
        Log.trace("PersonController::processClasslist(...) - start");

        if (path !== null) {
            data = await new CSVParser().parsePath(path);
        }

        this.duplicateDataCheck(data, ['ACCT', 'CWL']);
        this.missingDataCheck(data, ['ACCT', 'CWL']);
        const peoplePromises: Array<Promise<Person>> = [];

        for (const row of data) {
            // Log.trace(JSON.stringify(row));
            if (typeof row.ACCT !== 'undefined' && typeof row.CWL !== 'undefined' &&
                typeof row.SNUM !== 'undefined' && typeof row.FIRST !== 'undefined' &&
                typeof row.LAST !== 'undefined' && typeof row.LAB !== 'undefined') {
                const p: Person = {
                    id:            row.ACCT.toLowerCase(), // id is CSID since this cannot be changed
                    csId:          row.ACCT.toLowerCase(),
                    // github.ugrad.cs wanted row.ACCT; github.students.cs and github.ubc want row.CWL
                    githubId:      row.CWL.toLowerCase(),
                    studentNumber: row.SNUM,
                    fName:         row.FIRST,
                    lName:         row.LAST,

                    kind:   PersonKind.STUDENT,
                    URL:    null,
                    labId:  row.LAB,
                    custom: {}
                };
                peoplePromises.push(this.createPerson(p));
            } else {
                Log.error('PersonController::processClasslist(..) - column missing from: ' + JSON.stringify(row));
                peoplePromises.push(Promise.reject('Required column missing (required: ACCT, CWL, SNUM, FIRST, LAST, LAB).'));
        }
    }
        const people = await Promise.all(peoplePromises);

        // audit
        await this.db.writeAudit(AuditLabel.CLASSLIST_UPLOAD, personId || Config.getInstance().getProp(ConfigKey.classlist_hostname),
            {}, {}, {numPoeple: people.length});

        return people;
    }

    /**
     * Finds the person based on their githubId.
     *
     * @param {string} githubId
     * @returns {Promise<Person | null>}
     */
    public async getGitHubPerson(githubId: string): Promise<Person | null> {
        let person = await this.db.getGitHubPerson(githubId);
        if (person === null) {
            Log.trace("PersonController::getgetGitHubPersonPerson( " + githubId + " ) - githubId not yet registered.");

            // user not registered but might be admin or staff
            const gh = GitHubActions.getInstance();
            const isAdmin = await gh.isOnAdminTeam(githubId);
            const isStaff = await gh.isOnStaffTeam(githubId);

            if (isAdmin === true || isStaff === true) {
                Log.trace("PersonController::getgetGitHubPersonPerson( " + githubId + " ) - githubId is admin or staff.");
                person = {
                    id:            githubId,
                    githubId:      githubId,
                    csId:          githubId,
                    URL:           null,
                    studentNumber: null,
                    fName:         githubId,
                    lName:         githubId,
                    labId:         null,
                    kind:          null, // will be filled in later
                    custom:        {}
                };
                person = await this.createPerson(person);
                return person;
            } else {
                Log.trace("PersonController::getgetGitHubPersonPerson( " + githubId + " ) - githubId is unknown and not admin/staff.");
                return null;
            }

        }
        return person;
    }

    /**
     * Finds the person based on their id.
     *
     * @param {string} personId
     * @returns {boolean}
     */
    public async getPerson(personId: string): Promise<Person | null> {
        Log.trace("PersonController::getPerson( ... ) - start");
        Log.trace("PersonController::getPerson( " + personId + " ) - start");

        const person = await this.db.getPerson(personId);
        if (person === null) {
            Log.trace("PersonController::getPerson( " + personId + " ) - unknown person for this org check githubId");
            // Log.trace("PersonController::getPerson( " + personId + " ) - unknown person for this org: " +
            //     Config.getInstance().getProp(ConfigKey.org));
            return null;
        }
        return person;
    }

    /**
     * This returns _all_ people (including admins, staff, withrdawn students, etc.).
     *
     * @returns {Promise<Person[]>}
     */
    public async getAllPeople(): Promise<Person[]> {
        Log.trace("PersonController::getAllPeople() - start");
        return await this.db.getPeople();
    }

    public async getRepos(personId: string): Promise<Repository[] | null> {
        Log.trace('PersonController::getRepos( ' + personId + ' ) - start');
        const start = Date.now();
        const repos = await this.db.getRepositoriesForPerson(personId);
        Log.trace('PersonController::getRepos( ' + personId + ' ) - # repos: ' + repos.length + '; took: ' + Util.took(start));
        return repos;
    }

    /**
     * Marks students as withdrawn if their gitHubId is not listed in the list of registered student githubIds.
     * @param {string[]} registeredGithubIds
     * @returns {Promise<string>}
     */
    public async markStudentsWithdrawn(registeredGithubIds: string[]): Promise<string> {
        const people = await this.getAllPeople();
        Log.info("PersonController::markStudentsWithdrawn( .. ) - # people: " +
            people.length + "; # registered: " + registeredGithubIds.length);
        let numStudents = 0;
        let numWithdrawn = 0;
        for (const person of people) {
            if (person.kind === PersonKind.STUDENT || person.kind === PersonKind.WITHDRAWN) {
                numStudents++;
                if (registeredGithubIds.indexOf(person.githubId) >= 0) {
                    // student is registered
                    if (person.kind === PersonKind.WITHDRAWN) {
                        // this will happen if they have withdrawn and then re-enrolled
                        person.kind = PersonKind.STUDENT;
                        await this.writePerson(person);
                    }
                } else {
                    // student is not registered; mark as withdrawn
                    if (person.kind !== PersonKind.WITHDRAWN) {
                        numWithdrawn++;
                        person.kind = PersonKind.WITHDRAWN;
                        Log.info("PersonController::markStudentsWithdrawn( .. ) - marking " + person.id + " as withdrawn");
                        await this.writePerson(person);
                    }
                }
            }
        }
        const msg = "# students: " + numStudents + "; # withdrawn: " + numWithdrawn;
        Log.info("PersonController::markStudentsWithdrawn( .. ) - done; " + msg);
        return msg;
    }

    public static personToTransport(person: Person): StudentTransport {
        if (typeof person === 'undefined' || person === null) {
            throw new Error("PersonController::personToTransport( ... ) - ERROR: person not provided.");
        }

        const student: StudentTransport = {
            id:         person.id,
            firstName:  person.fName,
            lastName:   person.lName,
            githubId:   person.githubId,
            userUrl:    person.URL,
            studentNum: person.studentNumber,
            labId:      person.labId
        };
        return student;
    }

    // /**
    //  * Updates people records from a CSV.
    //  *
    //  * If the CSV has someone new, they are added.
    //  * If the CSV has an existin person, they are upated using their id with the details from the CSV.
    //  * If a person exists who isn't in the CSV, nothing happens (e.g., no deletions).
    //  *
    //  * @returns {Promise<Person[]>}
    //  */
    //
    // public async populatePeople(): Promise<{ newPeople: Person[], updatedPeople: Person[] }> {
    //     Log.info("PersonController::populatePeople() - start");
    //
    //     let errorMessage = this.validateCSV();
    //     if (errorMessage.length > 0) {
    //         Log.info("PersonController::populatePeople() - ERROR: " + errorMessage);
    //         return;
    //     }
    //
    //     let newPeople: Person[] = [];
    //     let updatedPeople: Person[] = [];
    //
    //     let csv: {}[] = [];
    //     let people = await this.db.getPeople();
    //     for (const row of csv as any) {
    //         let csvPerson: Person = {
    //             id:            row.csId, // IDs are CSIDs
    //             csId:          row.csId,
    //             githubId:      row.cwl,
    //             studentNumber: row.sNum,
    //             fName:         row.fName,
    //             lName:         row.lName,
    //             labId:         row.labId,
    //
    //             kind:   'student', // only students are added via CSV
    //             URL:    null,
    //             custom: {}
    //         };
    //
    //         let found = false;
    //         for (const p of people) {
    //
    //             if (p.id === csvPerson.id) {
    //                 found = true;
    //
    //                 // don't overwrite fields that can't change
    //                 csvPerson.custom = p.custom;
    //                 csvPerson.URL = p.URL;
    //                 await this.db.writePerson(csvPerson);
    //
    //                 updatedPeople.push(csvPerson);
    //             }
    //         }
    //
    //         if (found === false) {
    //             await this.db.writePerson(csvPerson);
    //             newPeople.push(csvPerson);
    //         }
    //     }
    //
    //     // NOT HANDLED (intentionally): removing people who are in the database but not the CSV
    //
    //     return {newPeople: newPeople, updatedPeople: updatedPeople};
    // }

    private duplicateDataCheck(data: any[], columnNames: string[]) {
        Log.trace('CSVParser::duplicateDataCheck -- start');
        const that = this;
        const dupColumnData: any = {};
        columnNames.forEach(function(column) {
            Object.assign(dupColumnData, {[column]: that.getDuplicateRowsByColumn(data, column)});
        });
        columnNames.forEach(function(column) {
            if (dupColumnData[column].length) {
                Log.error('CSVParser::duplicateDataCheck(..) - ERROR: Duplicate Data Check Error'
                    + JSON.stringify(dupColumnData));
                throw new Error('Duplicate Data Check Error: ' + JSON.stringify(dupColumnData));
            }
        });
    }

    private getDuplicateRowsByColumn(data: any[], column: string): any[] {
        Log.trace('CSVParser::getDuplicateRowsByColumn -- start');
        const set = new Set();
        return data.filter((row) => {
            if (set.has(row[column].toLowerCase())) {
                return true;
            }
            set.add(row[column].toLowerCase());
            return false;
        });
    }

    private getMissingDataRowsByColumn(data: any[], column: string): any[] {
        Log.trace('CSVParser::getMissingDataRowsByColumn -- start');
        return data.filter((row) => {
            if (row[column] === '') {
                return true;
            }
            return false;
        });
    }

    private missingDataCheck(data: any[], columns: string[]) {
        Log.trace('CSVParser::missingDataCheck -- start');
        const that = this;
        const missingData: any = {};
        columns.forEach((column) => {
            Object.assign(missingData, {[column]: that.getMissingDataRowsByColumn(data, column)});
        });
        columns.forEach((column) => {
            if (missingData[column].length) {
                Log.error('CSVParser::missingDataCheck(..) - ERROR: Certain fields cannot be empty: '
                    + JSON.stringify(missingData));
                throw new Error('Certain fields cannot be empty: ' + JSON.stringify(missingData));
            }
        });
    }

    //
    // /**
    //  * Returns an empty string if the csv is valid; a string error message otherwise.
    //  *
    //  * @returns {string }
    //  */
    // private validateCSV(): string {
    //     // TODO: check that reqiured rows exist
    //
    //     // CSID
    //     // CWL
    //     // SNUM
    //     // FNAME
    //     // LNAME
    //     // LABID
    //
    //     return '';
    // }
}
