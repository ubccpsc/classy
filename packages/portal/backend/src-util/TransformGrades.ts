import Log, {LogLevel} from "../../../common/Log";
import Util from "../../../common/Util";

import {DatabaseController} from "../src/controllers/DatabaseController";
import {GradesController} from "../src/controllers/GradesController";
import {ResultsController} from "../src/controllers/ResultsController";

import {AuditLabel, Grade} from "../src/Types";

/**
 * To run this locally you need to have a .env configured with the production values
 * and a ssh tunnel configured to the server you want the database to come from.
 *
 * 1) Get on the VPN
 * 2) Make sure you don't have a local mongo instance running
 * 3) Ensure your .env corresponds to the production values; change DB_URL connection string to use 127.0.0.1
 *      * specifically, make sure DB_URL contains the mongo username and password
 * 4) ssh user@host -L 27017:127.0.0.1:27017
 * 5) Run this script: node packages/portal/backend/src-util/TransformGrades.js
 */
export class TransformGrades {

    private dc: DatabaseController;

    /**
     * Whether the execution is for testing (true) or should actually change the database (false).
     *
     * @type {boolean}
     */
    private DRY_RUN = true;

    /**
     * A test user that can be used for checking DB writing (ignores DRY_RUN above, but only for this user).
     *
     * @type {string}
     */
    private readonly TEST_USER = 'XXXXX';

    /**
     * The delivId we are updating grades for.
     *
     * @type {string}
     */
    private readonly DELIVID: string = 'd2';

    /**
     * To make this request we are actually transforming a commit URL into an API request URL.
     * Having to hard-code these is not pretty, but it makes the code much simpler. The format
     * you need should be pretty easy to infer from what is present here.
     *
     * @type {string}
     */
    // private readonly PREFIXOLD = 'https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T2/';
    // private readonly PREFIXNEW = 'https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2018W-T2/';

    constructor() {
        Log.info("TransformGrades::<init> - start");
        this.dc = DatabaseController.getInstance();
    }

    public async process(): Promise<void> {
        Log.info("TransformGrades::process() - start for delivId: " + this.DELIVID);

        const gradesC = new GradesController();
        const resultsC = new ResultsController();
        const dbc = DatabaseController.getInstance();

        // get all the DELIVID grade records eligible for updating
        const allGrades = await gradesC.getAllGrades();
        const grades = [];
        for (const grade of allGrades as Grade[]) {
            if (grade.delivId === this.DELIVID) {
                grades.push(grade);
            }
        }

        // should be one per student
        Log.info("TransformGrades::process() - for: " + this.DELIVID + "; # grades: " + grades.length);

        const gradeDeltas: number[] = [];

        for (const grade of grades) {
            const url = grade.URL;

            const result = await resultsC.getResultFromURL(url, this.DELIVID);
            if (result !== null) {

                Log.info("Considering grade for " + this.DELIVID + " for url: " + url);

                // make sure row is valid
                if (typeof result.output === 'undefined' ||
                    typeof result.output.report === 'undefined' ||
                    typeof result.output.report.scoreTest === 'undefined' ||
                    typeof result.output.report.scoreOverall === 'undefined' ||
                    typeof result.output.report.custom === 'undefined'
                ) {
                    Log.error("FATAL: NO GRADE RECORD");
                    break;
                }
                if (typeof (result.output.report.custom as any).private === 'undefined' ||
                    typeof (result.output.report.custom as any).private.scoreTest === 'undefined'
                ) {
                    Log.warn("WARNING: NO PRIVATE RECORD; filling with 0s");

                    (result.output.report.custom as any).private = {};
                    (result.output.report.custom as any).private.scoreTest = 0;

                    continue; // just skip this row; this is a fatal error though that we need to figure out
                }

                const scorePub = Number(result.output.report.scoreTest);
                const scoreCover = Number(result.output.report.scoreCover);
                const scorePriv = Number((result.output.report.custom as any).private.scoreTest);
                const scorePubOverall = Number(result.output.report.scoreOverall);

                let finalScore = 0;
                if (this.DELIVID === 'd1') {
                    // 25% private tests
                    finalScore = (((scorePub * .75) + (scorePriv * .25)) * .8) + (scoreCover * .2);
                    finalScore = Number(finalScore.toFixed(2));
                    Log.info("Updating grade for " + this.DELIVID + "; original: " +
                        scorePubOverall.toFixed(0) + "; new: " + finalScore.toFixed(0));

                    // if there's a big difference, print a warning
                    if ((scorePub - scorePriv) > 20) {
                        Log.warn("Divergent score between public and private; original: " +
                            scorePubOverall.toFixed(0) + "; new: " + finalScore.toFixed(0));
                    }
                }
                if (this.DELIVID === 'd2') {
                    // 25% private tests
                    finalScore = (((scorePub * .75) + (scorePriv * .25)) * .8) + (scoreCover * .2);
                    finalScore = Number(finalScore.toFixed(2));
                    Log.info("Updating grade for " + this.DELIVID + "; original: " +
                        scorePubOverall + "; new: " + finalScore);

                    // if there's a big difference, print a warning
                    if ((scorePub - scorePriv) > 20) {
                        Log.warn("Divergent score between public and private; original: " +
                            scorePubOverall + "; new: " + finalScore);
                    }
                } else if (this.DELIVID === 'd3') {
                    // 50% private tests
                    finalScore = (((scorePub * .5) + (scorePriv * .5)) * .8) + (scoreCover * .2);
                    finalScore = Number(finalScore.toFixed(2));
                    Log.info("Updating grade for " + this.DELIVID + "; original: " +
                        scorePubOverall.toFixed(0) + "; new: " + finalScore.toFixed(0));

                    // if there's a big difference, print a warning
                    if ((scorePub - scorePriv) > 20) {
                        Log.warn("Divergent score between public and private; original: " +
                            scorePubOverall.toFixed(0) + "; new: " + finalScore.toFixed(0));
                    }
                }

                const newGrade: Grade = JSON.parse(JSON.stringify(grade)); // Object.assign is a shallow copy which doesn't work here
                (newGrade.custom as any).publicGrade = grade; // keep the old grad record around in the grade.custom field
                newGrade.timestamp = Date.now(); // TS for when we updated the grade record

                // change grade
                // could add comment here too if needed (e.g., to newGrade.comment)
                newGrade.urlName = "Transformed";
                newGrade.score = finalScore;

                gradeDeltas.push(Number((newGrade.score - grade.score).toFixed(2))); // track delta

                Log.info("TransformGrades::process() - processing result: " + url);
                if (this.DRY_RUN === false || grade.personId === this.TEST_USER) {
                    // publish grade
                    Log.info("Grade update for: " + newGrade.personId);
                    await gradesC.saveGrade(newGrade);
                    await dbc.writeAudit(AuditLabel.GRADE_CHANGE, 'ProcessPrivateTest', grade, newGrade, {});
                } else {
                    Log.info("Dry run grade update for: " + newGrade.personId);
                }
            } else {
                // should not really happen; if we have a grade already we must have a result
                Log.warn("TransformGrades::process - WARN; no grade found for: " + url);
            }
        }

        // Log.trace('gradeDeltas: ' + JSON.stringify(gradeDeltas));
        let gradeIncreased = 0;
        let gradeDecreased = 0;
        let gradeUnchanged = 0;
        let increasedAmount = 0;
        let decreasedAmount = 0;

        for (const delta of gradeDeltas) {
            if (delta > 0) {
                gradeIncreased++;
                increasedAmount += delta;
            } else if (delta < 0) {
                gradeDecreased++;
                decreasedAmount += delta;
            } else {
                // unchanged
                gradeUnchanged++;
            }
        }

        Log.info("*** Transformation Summary ***");
        Log.info("# increased: " + gradeIncreased + "; by avg: " + (increasedAmount / gradeIncreased).toFixed(2));
        Log.info("# decreased: " + gradeDecreased + "; by avg: " + (decreasedAmount / gradeDecreased).toFixed(2));
        Log.info("# unchanged: " + gradeUnchanged);
        Log.info("Average change: " +
            ((decreasedAmount + increasedAmount) / (gradeDecreased + gradeIncreased + gradeUnchanged)).toFixed(2));
        Log.info("*** /Transformation Summary ***");

        Log.info("TransformGrades::process() - done");
    }
}

const ppt = new TransformGrades();
const start = Date.now();
Log.Level = LogLevel.INFO;
ppt.process().then(function() {
    Log.info("TransformGrades::process() - complete; took: " + Util.took(start));
    process.exit();
}).catch(function(err) {
    Log.error("TransformGrades::process() - ERROR: " + err.message);
    process.exit();
});
