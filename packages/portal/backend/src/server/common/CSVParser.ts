import * as parse from "csv-parse";
// import {parse} from "csv-parse";
import * as fs from "fs";

import Log from "@common/Log";

import {DatabaseController} from "@backend/controllers/DatabaseController";
import {DeliverablesController} from "@backend/controllers/DeliverablesController";
import {GradesController} from "@backend/controllers/GradesController";
import {PersonController} from "@backend/controllers/PersonController";
import {AuditLabel, Grade} from "@backend/Types";

export class CSVParser {

    constructor() {
        // empty
    }

    /**
     * Use CSV-Parse to turn a file path into an array of rows. Since we do not know anything
     * about each row, we"re just returning it as an array of any. Clients should check to
     * make sure the right properties exist on each row (e.g., that all the columns are there).
     *
     * @param {string} path
     * @returns {Promise<any[]>}
     */
    public parsePath(path: string): Promise<any[]> {
        return new Promise(function (fulfill, reject) {

            const rs = fs.createReadStream(path);
            const options = {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true // fixes CSV compatibility issue
            };

            const parser = parse(options, (err: Error, data: any[]) => {
                if (err) {
                    const msg = "CSV parse error: " + err;
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
     * Classy grade upload CSVs require two
     * columns (each with a case-sensitive header):
     *   * CSID
     *   * GRADE
     *
     * One optional column is also considered, if present:
     * * COMMENT
     *
     * If CSID is absent but CWL or GITHUB is present, we map them to the CSID and proceed as needed.
     * The deliverable the CSV is applied to is specified by the upload page.
     *
     * @param requesterId
     * @param delivId
     * @param path
     */
    public async processGrades(requesterId: string, delivId: string, path: string): Promise<boolean[]> {
        try {
            Log.info("CSVParser::processGrades(..) - start");

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

                if (typeof row.CSID === "undefined" && typeof row.GITHUB !== "undefined") {
                    Log.trace("CSVParser::processGrades(..) - CSID absent but GITHUB present; GITHUB: " + row.GITHUB);
                    const person = await pc.getGitHubPerson(row.GITHUB);
                    if (person !== null) {
                        row.CSID = person.csId;
                        Log.info("CSVParser::processGrades(..) - GITHUB -> CSID: " + row.GITHUB + " -> " + row.CSID);
                    }
                }

                if (typeof row.CSID === "undefined" && typeof row.CWL !== "undefined") {
                    Log.trace("CSVParser::processGrades(..) - CSID absent but CWL present; CWL: " + row.CWL);
                    const person = await pc.getGitHubPerson(row.CWL); // GITHUB && CWL are the same at UBC
                    if (person !== null) {
                        row.CSID = person.csId;
                        Log.info("CSVParser::processGrades(..) - CWL -> CSID: " + row.CWL + " -> " + row.CSID);
                    }
                }

                // Log.trace("grade row: " + JSON.stringify(row));
                if (typeof row.CSID !== "undefined" &&
                    typeof row.GRADE !== "undefined") {

                    let comment = "CSV Upload";
                    if (typeof row.COMMENT !== "undefined" &&
                        typeof row.COMMENT === "string" &&
                        row.COMMENT.length > 1) {
                        comment = row.COMMENT;
                    }

                    const personId = row.CSID;
                    const g: Grade = {
                        personId: personId,
                        delivId: delivId,
                        score: Number(row.GRADE),
                        comment: comment,
                        timestamp: Date.now(),
                        urlName: "CSV Upload",
                        URL: null, // set to null so GradesController can restore URL if needed
                        custom: {}
                    };

                    const person = pc.getPerson(personId);
                    if (person !== null) {
                        gradePromises.push(gc.saveGrade(g));
                    } else {
                        Log.warn("CSVParser::processGrades(..) - record ignored for: " + personId + "; unknown personId");
                    }

                } else {
                    const msg = "Required column missing (required: CSID, GRADE).";
                    Log.error("CSVParser::processGrades(..) - column missing from: " + JSON.stringify(row));
                    throw new Error(msg);
                }
            }

            const grades = await Promise.all(gradePromises);

            // audit grade update
            const dbc = DatabaseController.getInstance();
            await dbc.writeAudit(AuditLabel.GRADE_ADMIN, requesterId, {}, {}, {numGrades: grades.length});
            Log.info("CSVParser::processGrades(..) - done; # grades: " + grades.length);

            return grades;
        } catch (err) {
            Log.error("CSVParser::processGrades(..) - ERROR: " + err.message);
            throw new Error("Grade upload error: " + err.message);
        }
    }
}
