import * as parse from "csv-parse";
// import {parse} from "csv-parse";
import * as fs from "fs";

import Log from "@common/Log";

import {DatabaseController} from "@backend/controllers/DatabaseController";
import {DeliverablesController} from "@backend/controllers/DeliverablesController";
import {GradesController} from "@backend/controllers/GradesController";
import {PersonController} from "@backend/controllers/PersonController";
import {AuditLabel, Deliverable, Grade} from "@backend/Types";

export class CSVPrairieLearnParser {

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
                    Log.error("CSVPrairieLearnParser::parsePath(..) - ERROR: " + msg);
                    reject(new Error(msg));
                } else {
                    Log.info("CSVPrairieLearnParser::parsePath(..) - parsing successful; # rows: " + data.length);
                    fulfill(data);
                }
            });

            rs.pipe(parser);
        });
    }

    /**
     * Process grades from a PrarieLearn Gradebook CSV.
     *
     * The PrairieLearn format has the following headers:
     *   * UID (this is a CWL with @ubc.ca appended to the end)
     *   * UIN (random identifier)
     *   * Role (Student | Staff)
     *   * Some number of columns named after assessment ids (e.g., q0, q2, etc)
     *
     * The deliverable the CSV is applied to depends on the assessment headers;
     * if an assessment matches a deliverable in Classy, that grade will be set.
     *
     * @param requesterId
     * @param path
     */
    public async processGrades(requesterId: string, path: string): Promise<boolean[]> {
        try {
            Log.info("CSVPrairieLearnParser::processGrades(..) - start");

            const data = await this.parsePath(path);

            if (data.length === 0) {
                throw new Error("Not a valid PrairieLearn Gradebook; no rows in CSV.");
            }
            // validate required columns are present
            for (const row of data) {
                if (typeof row.UID === "undefined" &&
                    typeof row.UIN === "undefined" &&
                    typeof row.Role === "undefined") {
                    throw new Error("Not a valid PrairieLearn Gradebook; required columns (UID, UIN, Role) missing.");
                }
            }

            const dc = new DeliverablesController();
            const allDelivs = await dc.getAllDeliverables();
            Log.info("CSVPrairieLearnParser::processGrades(..) - # delivs: " + allDelivs.length);

            const potentialDelivs: Deliverable[] = [];
            for (const deliv of allDelivs) {
                const row = data[0];
                if (deliv.id !== "UID" && deliv.id !== "UIN" && deliv.id !== "Role" &&
                    typeof row[deliv.id] !== "undefined") {
                    // aka not a metadata row, and sheet column exists for deliv id
                    potentialDelivs.push(deliv);
                }
            }
            Log.info("CSVPrairieLearnParser::processGrades(..) - # potential delivs: " + potentialDelivs.length);

            const pc = new PersonController();
            const gc = new GradesController();
            const gradePromises: Array<Promise<boolean>> = [];

            for (const row of data) {

                const uid = row.UID;
                const cwl = uid.substring(0, uid.indexOf("@ubc.ca"));
                Log.trace("uid: " + uid + " -> cwl: " + cwl);
                const person = await pc.getGitHubPerson(cwl);

                if (person !== null) {
                    for (const deliv of potentialDelivs) {
                        if (typeof row[deliv.id] !== "undefined") {
                            const score = row[deliv.id];
                            if (score !== "") {
                                const g: Grade = {
                                    personId: person.id,
                                    delivId: deliv.id,
                                    score: Number(score),
                                    comment: "PrairieLearn Upload",
                                    timestamp: Date.now(),
                                    urlName: "CSV Upload",
                                    URL: null, // set to null so GradesController can restore URL if needed
                                    custom: {}
                                };
                                gradePromises.push(gc.saveGrade(g));
                            } else {
                                // blank cell
                            }
                        }
                    }
                } else {
                    Log.warn("CSVPrairieLearnParser::processGrades(..) - unknown person: " + cwl);
                }
            }

            const grades = await Promise.all(gradePromises);

            // audit grade update
            const dbc = DatabaseController.getInstance();
            await dbc.writeAudit(AuditLabel.GRADE_ADMIN, requesterId, {}, {}, {numGrades: grades.length});
            Log.info("CSVPrairieLearnParser::processGrades(..) - done; # grades: " + grades.length);

            return grades;
        } catch (err) {
            Log.error("CSVPrairieLearnParser::processGrades(..) - ERROR: " + err.message);
            throw new Error("Grade upload error: " + err.message);
        }
    }
}
