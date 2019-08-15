import * as parse from 'csv-parse';
import * as fs from 'fs';
import * as rp from "request-promise-native";
import Config, {ConfigKey} from "../../../../../common/Config";
import Log from '../../../../../common/Log';

import {ClasslistTransport} from "../../../../../common/types/PortalTypes";
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
        Log.info("IntegrationController::fetchClasslist - start");
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
            Log.error("IntegrationController::fetchClasslist - ERROR: " + err);
            throw new Error("Could not fetch Classlist " + err.message);
        }
    }

    private getClasslistUri() {
        const config = Config.getInstance();
        const auth = config.getProp(ConfigKey.classlist_username).trim() + ':' + config.getProp(ConfigKey.classlist_password).trim();
        const uri = config.getProp(ConfigKey.classlist_uri).trim();

        if (uri.indexOf('https://') === 0) {
            return 'https://' + auth + '@' + uri.slice(8);
        } else {
            throw new Error('https:// protocol is required for API integration');
        }
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
                peoplePromises.push(this.pc.createPerson(p));
            } else {
                Log.error('PersonController::processClasslist(..) - column missing from: ' + JSON.stringify(row));
                peoplePromises.push(Promise.reject('Required column missing (required: ACCT, CWL, SNUM, FIRST, LAST, LAB).'));
        }
    }
        const people = await Promise.all(peoplePromises);

        // audit
        await this.db.writeAudit(AuditLabel.CLASSLIST_UPLOAD, personId,
            {}, {}, {numPoeple: people.length});

        return people;
    }

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
            if (row[column] === '' || typeof row[column] === 'undefined') {
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
}
