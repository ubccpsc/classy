import * as parse from 'csv-parse';
import * as fs from 'fs';
import Log from '../../../../../common/Log';

import {DatabaseController} from "../../controllers/DatabaseController";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {AuditLabel, Grade} from "../../Types";

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
    public parsePath(path: string): Promise<any[]> {
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

    /**
     * Process grades for a given deliverable.
     *
     * The CSV should have three columns (each with a case-sensitive header):
     *   * CSID
     *   * GRADE
     *   * COMMENT
     *
     * If CSID is absent but CWL or GITHUB is present, we map them to the CSID and proceed as needed.
     *
     * @param requestorId
     * @param delivId
     * @param path
     */
    public async processGrades(requestorId: string, delivId: string, path: string): Promise<boolean[]> {
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

                if (typeof row.CSID === 'undefined' && typeof row.GITHUB !== 'undefined') {
                    Log.trace('CSVParser::processGrades(..) - CSID absent but GITHUB present; GITHUB: ' + row.GITHUB);
                    const person = await pc.getGitHubPerson(row.GITHUB);
                    if (person !== null) {
                        row.CSID = person.csId;
                        Log.info('CSVParser::processGrades(..) - GITHUB -> CSID: ' + row.GITHUB + " -> " + row.CSID);
                    }
                }

                if (typeof row.CSID === 'undefined' && typeof row.CWL !== 'undefined') {
                    Log.trace('CSVParser::processGrades(..) - CSID absent but CWL present; CWL: ' + row.CWL);
                    const person = await pc.getGitHubPerson(row.CWL); // GITHUB && CWL are the same at UBC
                    if (person !== null) {
                        row.CSID = person.csId;
                        Log.info('CSVParser::processGrades(..) - CWL -> CSID: ' + row.CWL + " -> " + row.CSID);
                    }
                }

                // Log.trace('grade row: ' + JSON.stringify(row));
                if (typeof row.CSID !== 'undefined' &&
                    typeof row.GRADE !== 'undefined' &&
                    typeof row.COMMENT !== 'undefined') {

                    const personId = row.CSID;
                    const g: Grade = {
                        personId:  personId,
                        delivId:   delivId,
                        score:     Number(row.GRADE),
                        comment:   row.COMMENT,
                        timestamp: Date.now(),
                        urlName:   'CSV Upload',
                        URL:       null, // set to null so GradesController can restore URL if needed
                        custom:    {}
                    };

                    const person = pc.getPerson(personId);
                    if (person !== null) {
                        gradePromises.push(gc.saveGrade(g));
                    } else {
                        Log.warn('CSVParser::processGrades(..) - record ignored for: ' + personId + '; unknown personId');
                    }

                } else {
                    const msg = 'Required column missing (required: CSID, GRADE, COMMENT).';
                    Log.error('CSVParser::processGrades(..) - column missing from: ' + JSON.stringify(row));
                    throw new Error(msg);
                }
            }

            const grades = await Promise.all(gradePromises);

            // audit grade update
            const dbc = DatabaseController.getInstance();
            await dbc.writeAudit(AuditLabel.GRADE_ADMIN, requestorId, {}, {}, {numGrades: grades.length});
            Log.info('CSVParser::processGrades(..) - done; # grades: ' + grades.length);

            return grades;
        } catch (err) {
            Log.error('CSVParser::processGrades(..) - ERROR: ' + err.message);
            throw new Error('Grade upload error: ' + err.message);
        }
    }
}
