import * as parse from 'csv-parse';
import * as fs from 'fs';
import Log from '../../../../../common/Log';

import {DatabaseController} from "../../controllers/DatabaseController";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {AuditLabel, Grade, Person, PersonKind} from "../../Types";

export class CSVParser {

    constructor() {
        // empty
    }

    /**
     * Use CSV-Parse to turn a file path into an array of rows. Since we don't know anything
     * about each row, we're just returning it as an array of any. Clients should check to
     * make sure the right properties exist on each row (e.g., that all the columns are there).
     *
     * @param {string} path
     * @returns {Promise<any[]>}
     */
    private parsePath(path: string): Promise<any[]> {
        return new Promise(function(fulfill, reject) {

            const rs = fs.createReadStream(path);
            const options = {
                columns:          true,
                skip_empty_lines: true,
                trim:             true
            };

            const parser = parse(options, (err, data: any[]) => {
                if (err) {
                    const msg = 'CSV parse error: ' + err;
                    Log.error("CSVParser::parsePath(..) - ERROR: " + msg);
                    reject(new Error(msg));
                } else {
                    Log.info("CSVParser::parsePath(..) - parsing successful; # rows: " + data.length);
                    fulfill(data);
                }
            });

            rs.pipe(parser);
        });
    }

    public async processClasslist(personId: string, path: string): Promise<Person[]> {
        try {
            Log.info('CSVParser::processClasslist(..) - start');

            const data = await this.parsePath(path);
            const pc = new PersonController();

            const peoplePromises: Array<Promise<Person>> = [];
            for (const row of data) {
                // Log.trace(JSON.stringify(row));
                if (typeof row.ACCT !== 'undefined' && typeof row.CWL !== 'undefined' &&
                    typeof row.SNUM !== 'undefined' && typeof row.FIRST !== 'undefined' &&
                    typeof row.LAST !== 'undefined' && typeof row.LAB !== 'undefined') {
                    const p: Person = {
                        id:            row.ACCT.toLowerCase(), // id is CSID since this cannot be changed
                        csId:          row.ACCT.toLowerCase(),
                        // github.ugrad wants row.ACCT; github.ubc wants row.CWL
                        githubId:      row.ACCT.toLowerCase(),  // TODO: will depend on instance (see above)
                        studentNumber: row.SNUM,
                        fName:         row.FIRST,
                        lName:         row.LAST,

                        kind:   PersonKind.STUDENT,
                        URL:    null,
                        labId:  row.LAB,
                        custom: {}
                    };
                    peoplePromises.push(pc.createPerson(p));
                } else {
                    Log.info('CSVParser::processClasslist(..) - column missing from: ' + JSON.stringify(row));
                    peoplePromises.push(Promise.reject('Required column missing'));
                }
            }

            const people = await Promise.all(peoplePromises);

            // audit
            const dbc = DatabaseController.getInstance();
            await dbc.writeAudit(AuditLabel.CLASSLIST_UPLOAD, personId, {}, {}, {numPoeple: people.length});

            return people;
        } catch (err) {
            Log.error('CSVParser::processClasslist(..) - ERROR: ' + err.message);
            throw new Error('Classlist upload error: ' + err.message);
        }
    }

    public async processGrades(personId: string, delivId: string, path: string): Promise<boolean[]> {
        try {
            Log.info('CSVParser::processGrades(..) - start');

            const data = await this.parsePath(path);

            const dc = new DeliverablesController();
            const pc = new PersonController();
            const deliv = await dc.getDeliverable(delivId);
            if (deliv === null) {
                throw new Error("Unknown deliverable: " + delivId);
            }

            const gc = new GradesController();
            const gradePromises: Array<Promise<boolean>> = [];
            for (const row of data) {
                // Log.trace('grade row: ' + JSON.stringify(row));
                if (typeof row.CSID !== 'undefined' &&
                    typeof row.GRADE !== 'undefined' &&
                    typeof row.COMMENT !== 'undefined') {

                    const personGrade = row.CSID; // TODO: will depend on instance (see above)
                    const g: Grade = {
                        personId:  personGrade,
                        delivId:   delivId,
                        score:     Number(row.GRADE),
                        comment:   row.COMMENT,
                        timestamp: Date.now(),
                        urlName:   'CSV Upload',
                        URL:       null,
                        custom:    {}
                    };

                    const person = pc.getPerson(personGrade);
                    if (person !== null) {
                        gradePromises.push(gc.saveGrade(g));
                    } else {
                        Log.warn('CSVParser::processGrades(..) - record ignored for: ' + personGrade + '; unknown personId');
                    }

                } else {
                    const msg = 'Required column missing';
                    Log.error('CSVParser::processGrades(..) - column missing from: ' + JSON.stringify(row));
                    throw new Error(msg);
                }
            }

            const grades = await Promise.all(gradePromises);

            // audit
            const dbc = DatabaseController.getInstance();
            await dbc.writeAudit(AuditLabel.GRADE_UPLOAD, personId, {}, {}, {numGrades: grades.length});

            return grades;
        } catch (err) {
            Log.error('CSVParser::processGrades(..) - ERROR: ' + err.message);
            throw new Error('Grade upload error: ' + err.message);
        }
    }

}
