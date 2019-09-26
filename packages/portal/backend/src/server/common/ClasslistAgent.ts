import * as parse from 'csv-parse';
import * as fs from 'fs';
import * as rp from "request-promise-native";
import Config, {ConfigKey} from "../../../../../common/Config";
import Log from '../../../../../common/Log';

import {ClasslistChangesTransport, ClasslistTransport, StudentTransport} from "../../../../../common/types/PortalTypes";
import {DatabaseController} from "../../controllers/DatabaseController";
import {PersonController} from "../../controllers/PersonController";
import {AuditLabel, Grade, Person, PersonKind} from "../../Types";
import {CSVParser} from "./CSVParser";

export class ClasslistAgent {

    constructor() {
        //
    }

    private pc = new PersonController();
    private db = DatabaseController.getInstance();

    public async fetchClasslist(): Promise<ClasslistTransport[]> {
        Log.info("ClasslistAgent::fetchClasslist - start");
        try {
            const uri = this.getClasslistUri();
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0' // for testing
                },
                uri,
                rejectUnauthorized: false
            };
            return JSON.parse(await rp(options));
        } catch (err) {
            Log.error("ClasslistAgent::fetchClasslist - ERROR: " + err);
            throw new Error("Could not fetch Classlist " + err.message);
        }
    }

    private getClasslistUri() {
        const config = Config.getInstance();
        const auth = config.getProp(ConfigKey.classlist_username) + ':' + config.getProp(ConfigKey.classlist_password);
        const uri = config.getProp(ConfigKey.classlist_uri);

        if (uri.indexOf('https://') === 0) {
            return 'https://' + auth + '@' + uri.slice(8);
        } else {
            throw new Error('https:// protocol is required for API integration');
        }
    }

    /**
     * Produces a report of student updates:
     * - new students added, old students removed, student data updated
     * @param beforePoeple A list of students before the Classlist update
     * @param afterPeople A list of students after the Classlist update
     */
    private getClasslistChanges(beforePeople: Person[], afterPeople: Person[]): ClasslistChangesTransport {
        Log.info("ClasslistAgent::getClasslistChanges(..) - start");
        const that = this;
        const beforeCSIDs = beforePeople.map(function(person) { return person.csId; });
        const afterCSIDs = afterPeople.map(function(person) { return person.csId; });
        const classlist: StudentTransport[] = afterPeople.map(function(person) { return PersonController.personToTransport(person);
        });

        const changeReport: ClasslistChangesTransport = {
            created: [], // new registrations
            updated: [], // only students whose CWL or lab has changed
            removed: [], // precludes withdrawn students; next step should be to withdraw students who end up appearing here
            classlist // created from list of people in the classlist upload returned from data layer
        };

        afterPeople.forEach(function(afterPerson) {
            if (beforeCSIDs.indexOf(afterPerson.csId) === -1) {
                const student = PersonController.personToTransport(afterPerson);
                changeReport.created.push(student);
            } else {
                const beforePerson = beforePeople.find(function(befPerson) {
                    if (befPerson.csId === afterPerson.csId) {
                        return true;
                    }
                });
                if (JSON.stringify(afterPerson) !== JSON.stringify(beforePerson)) {
                    const student = PersonController.personToTransport(afterPerson);
                    changeReport.updated.push(student);
                }
            }
        });

        beforePeople.forEach(function(person) {
            if (afterCSIDs.indexOf(person.csId) === -1 && person.kind === PersonKind.STUDENT) {
                const student = PersonController.personToTransport(person);
                changeReport.removed.push(student);
            }
        });

        Log.trace("ClasslistAgent::getClasslistChanges(..) - results: " + JSON.stringify(changeReport));
        return changeReport;
    }

    public async processClasslist(personId: string = null, path: string = null,  data: any): Promise<ClasslistChangesTransport> {
        Log.trace("ClasslistAgent::processClasslist(...) - start");
        const peopleBefore: Person[] = await this.pc.getAllPeople();

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
                peoplePromises.push(this.pc.createPerson(p));
            } else {
                Log.error('ClasslistAgent::processClasslist(..) - column missing from: ' + JSON.stringify(row));
                peoplePromises.push(Promise.reject('Required column missing (required: ACCT, CWL, SNUM, FIRST, LAST, LAB).'));
        }
    }
        const peopleAfter = await Promise.all(peoplePromises);
        const classlistChanges = this.getClasslistChanges(peopleBefore, peopleAfter);

        // audit
        await this.db.writeAudit(AuditLabel.CLASSLIST_UPLOAD, personId,
            {}, {}, {numPoeple: classlistChanges.classlist.length});

        return classlistChanges;
    }

    private duplicateDataCheck(data: any[], columnNames: string[]) {
        Log.trace('ClasslistAgent::duplicateDataCheck -- start');
        const that = this;
        const dupColumnData: any = {};
        columnNames.forEach(function(column) {
            Object.assign(dupColumnData, {[column]: that.getDuplicateRowsByColumn(data, column)});
        });
        columnNames.forEach(function(column) {
            if (dupColumnData[column].length) {
                Log.error('ClasslistAgent::duplicateDataCheck(..) - ERROR: Duplicate Data Check Error'
                    + JSON.stringify(dupColumnData));
                throw new Error('Duplicate Data Check Error: ' + JSON.stringify(dupColumnData));
            }
        });
    }

    private getDuplicateRowsByColumn(data: any[], column: string): any[] {
        Log.trace('ClasslistAgent::getDuplicateRowsByColumn -- start');
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
        Log.trace('ClasslistAgent::getMissingDataRowsByColumn -- start');
        return data.filter((row) => {
            if (row[column] === '' || typeof row[column] === 'undefined') {
                return true;
            }
            return false;
        });
    }

    private missingDataCheck(data: any[], columns: string[]) {
        Log.trace('ClasslistAgent::missingDataCheck -- start');
        const that = this;
        const missingData: any = {};
        columns.forEach((column) => {
            Object.assign(missingData, {[column]: that.getMissingDataRowsByColumn(data, column)});
        });
        columns.forEach((column) => {
            if (missingData[column].length) {
                Log.error('ClasslistAgent::missingDataCheck(..) - ERROR: Certain fields cannot be empty: '
                    + JSON.stringify(missingData));
                throw new Error('Certain fields cannot be empty: ' + JSON.stringify(missingData));
            }
        });
    }
}
