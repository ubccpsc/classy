import * as parse from "csv-parse";
// import {parse} from "csv-parse";
import * as fs from "fs";

import Log from "@common/Log";

import {DatabaseController} from "@backend/controllers/DatabaseController";
import {DeliverablesController} from "@backend/controllers/DeliverablesController";
import {GradesController} from "@backend/controllers/GradesController";
import {PersonController} from "@backend/controllers/PersonController";
import {AuditLabel, Grade} from "@backend/Types";
import Util from "@common/Util";

export class CSVParser {

    constructor() {
        // empty
    }

    /**
     * Use CSV-Parse to turn a file path into an array of rows. Since we do not know anything
     * about each row, we are just returning it as an array of any. Clients should check to
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
     * * CSID
     * * GRADE
     *
     * Two optional columns are also considered, if present:
     * * COMMENT
     * * DISPLAY
     *   * This is the value that will be shown to the students, if it is present.
     *   * The GRADE will still be visible in the network view though.
     *   * Set GRADE to -1 if you do not want the students to see it.
     *
     * If the CSID header is absent but CWL or GITHUB is present, we map them to
     * the CSID and proceed as needed.
     *
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
            let errorMessage = "";

            const allPeople = await pc.getAllPeople();

            for (const row of data) {

                // this check could probably be outside the loop, but since it throws
                // it only happens once anyways
                const firstKey = Object.keys(row)[0];
                if (firstKey === "CSID" || firstKey === "CWL" || firstKey === "GITHUB" || firstKey === "StudentNumber") {
                    // good record
                } else {
                    throw new Error("CSID/CWL/GITHUB/StudentNumber must be the first column in the CSV");
                }

                if (typeof row.StudentNumber !== "undefined") {
                    // student number is given, make sure person has the right id

                    // find the person with the student number
                    const person = allPeople.find((p) => p.studentNumber === row.StudentNumber);
                    if (person !== null) {
                        row.CSID = person.id;
                    } else {
                        Log.warn("CSVParser::processGrades(..) - Unknown StudentNumber: " + row.StudentNumber);
                    }
                }

                if (typeof row.CSID === "undefined" && typeof row.GITHUB !== "undefined") {
                    Log.trace("CSVParser::processGrades(..) - CSID absent but GITHUB present; GITHUB: " + row.GITHUB);
                    const person = await pc.getGitHubPerson(row.GITHUB);
                    if (person !== null) {
                        row.CSID = person.id;
                        Log.info("CSVParser::processGrades(..) - GITHUB -> CSID: " + row.GITHUB + " -> " + row.CSID);
                    } else {
                        Log.warn("CSVParser::processGrades(..) - Unknown GITHUB: " + row.GITHUB);
                        if (errorMessage === "") {
                            errorMessage = "Unknown ids: ";
                        }
                        errorMessage += row.GITHUB + ", ";
                    }
                }

                if (typeof row.CSID === "undefined" && typeof row.CWL !== "undefined") {
                    Log.trace("CSVParser::processGrades(..) - CSID absent but CWL present; CWL: " + row.CWL);
                    const person = await pc.getGitHubPerson(row.CWL); // GITHUB && CWL are the same at UBC
                    if (person !== null) {
                        row.CSID = person.id;
                        Log.info("CSVParser::processGrades(..) - CWL -> CSID: " + row.CWL + " -> " + row.CSID);
                    } else {
                        Log.warn("CSVParser::processGrades(..) - Unknown CWL: " + row.CWL);
                        if (errorMessage === "") {
                            errorMessage = "Unknown ids: ";
                        }
                        errorMessage += row.CWL + ", ";
                    }
                }

                // Log.trace("grade row: " + JSON.stringify(row));
                if (typeof row.CSID !== "undefined" &&
                    typeof row.GRADE !== "undefined") {

                    // let comment = "CSV Upload";
                    let comment = ""; // only include a comment if one is given
                    if (typeof row.COMMENT !== "undefined" &&
                        typeof row.COMMENT === "string" &&
                        row.COMMENT.length > 1) {
                        comment = row.COMMENT;
                        comment = comment.trim();
                    }

                    let gradeScore = row.GRADE;

                    if (typeof gradeScore === "string") {
                        gradeScore = gradeScore.trim();
                    }

                    const custom: any = {};
                    if (Util.isNumeric(gradeScore) === true) {
                        gradeScore = parseFloat(gradeScore);
                        Log.trace("CSVParser::processGrades(..) - grade is a number: " + gradeScore);
                    } else {
                        gradeScore = Number(gradeScore); // might as well try
                    }

                    if (typeof row.DISPLAY === "string") {
                        custom.displayScore = row.DISPLAY.trim();
                        Log.trace("CSVParser::processGrades(..) - grade includes DISPLAY: " + custom.displayScore);
                    }
                    const personId = row.CSID;
                    const g: Grade = {
                        personId: personId,
                        delivId: delivId,
                        score: gradeScore,
                        comment: comment,
                        timestamp: Date.now(),
                        urlName: "CSV Upload",
                        URL: null, // set to null so GradesController can restore URL if needed
                        custom: custom
                    };

                    const person = await pc.getPerson(personId);
                    if (person !== null) {
                        gradePromises.push(gc.saveGrade(g));
                    } else {
                        Log.warn("CSVParser::processGrades(..) - record ignored for: " + personId + "; unknown personId");
                        if (errorMessage === "") {
                            errorMessage = "Unknown ids: ";
                        }
                        errorMessage += personId + ", ";
                    }

                } else {
                    Log.warn("CSVParser::processGrades(..) - could not parse grade for record: " + JSON.stringify(row));
                    // errorMessage += "Bad record: " + JSON.stringify(row) + ", ";
                }
            }

            const grades = await Promise.all(gradePromises);

            // audit grade update
            const dbc = DatabaseController.getInstance();
            await dbc.writeAudit(AuditLabel.GRADE_ADMIN, requesterId, {}, {}, {numGrades: grades.length});
            Log.info("CSVParser::processGrades(..) - done; # grades: " + grades.length);

            if (errorMessage.endsWith(", ")) {
                errorMessage = errorMessage.slice(0, -2);
            }

            if (errorMessage.length > 0) {
                const msg = "CSVParser::processGrades(..) - ERROR: " + errorMessage;
                Log.error(msg);
                throw new Error(msg);
            }

            return grades;
        } catch (err) {
            Log.error("CSVParser::processGrades(..) - ERROR: " + err.message);
            throw new Error("Grade upload error: " + err.message);
        }
    }
}
