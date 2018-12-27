import Config, {ConfigKey} from "../../../common/Config";
import Log, {LogLevel} from "../../../common/Log";
import {GradePayload} from "../../../common/types/SDMMTypes";
import Util from "../../../common/Util";
import {GradesController} from "../src/controllers/GradesController";
import {ResultsController} from "../src/controllers/ResultsController";

import {Grade} from "../src/Types";

/**
 * To run this locally you need to have a .env configured with the production values
 * and a ssh tunnel configured to the server you want the database to come from.
 *
 * 1) Get on the VPN.
 * 2) Make sure you don't have a local mongo instance running.
 * 3) Ensure your .env corresponds to the production values.
 * 4) ssh user@host -L 27017:127.0.0.1:27017
 * 5) Run this script.
 *
 */

/**
 *
 * First, run the code with DRY_RUN = false && WRITE_GRADE = false and make sure there are no errors (<E> messages).
 * Then actually do this with DRY_RUN = false && WRITE_GRADE = true to write all the grade records.
 */

export class ComputeD4 {
    /**
     * Only process TEST_USERS. (mainly for testing)
     *
     * @type {boolean}
     */
    private DRY_RUN = true;

    /**
     * Usernames to ignore DRY_RUN for (aka usually a TA or course repo for testing)
     *
     * @type {string}
     */
    private TEST_USERS: string[] = ['w8j0b']; // ['w8j0b', 'r5t0b'];

    /**
     * Actually write the grade record (always writes for TEST_USERS)
     *
     * @type {boolean}
     */
    private WRITE_GRADE = false;

    constructor() {
        Log.info("ComputeD4::<init> - start");
    }

    public async process(): Promise<void> {
        Log.info("ComputeD4::process() - start");
        const c = Config.getInstance();

        // Find the commit you want to invoke the bot against.
        // e.g., for cs310 d4, we run against the graded d3 commit.
        // You might use some other approach here; any commit URL
        // will work with the code below.
        const gradesC = new GradesController();
        const resultsC = new ResultsController();
        const allGrades = await gradesC.getAllGrades(false);
        const grades = [];
        for (const grade of allGrades as Grade[]) {
            if (grade.delivId === 'd3') {
                grades.push(grade);
            }
        }

        const org = c.getProp(ConfigKey.org) + '/';
        for (const grade of grades) {
            const url = grade.URL;

            if (this.DRY_RUN === false || this.TEST_USERS.indexOf(grade.personId) >= 0) {
                Log.info("ComputeD4::process() - processing url: " + url);

                // this is brittle; should probably have a better way to extract this from a grade record
                const repoId = url.substring(url.lastIndexOf(org) + org.length, url.lastIndexOf('/commit/'));
                const sha = url.substring(url.lastIndexOf('/commit/') + 8);
                Log.info("\t Repo: " + repoId + '; sha: ' + sha + '; URL: ' + url);

                // get d1 result for this commit
                // public async getResult(delivId: string, repoId: string, sha: string): Promise<AutoTestResult | null> {
                const d1result = await resultsC.getResult('d1', repoId, sha);
                const d2result = await resultsC.getResult('d2', repoId, sha);
                const d4result = await resultsC.getResult('d4', repoId, sha);

                Log.info("\t Result objects; D1:" + d1result + "; D2: " + d2result + "; D4: " + d4result);
                try {
                    // d1 score
                    let d1score = 0;
                    if (d1result !== null && typeof d1result.output.report.scoreTest === 'number') {
                        d1score = d1result.output.report.scoreTest;
                    } else {
                        Log.warn("\t Missing d1 score for: " + grade.URL);
                    }

                    // d2 score
                    let d2score = 0;
                    if (d2result !== null) {
                        if (typeof (d2result.output.report.custom as any).private === 'object' &&
                            typeof (d2result.output.report.custom as any).private.scoreTest === 'number') {
                            d2score = (d2result.output.report.custom as any).private.scoreTest * .25 +
                                d2result.output.report.scoreTest * .75;
                        } else if (typeof d2result.output.report.scoreTest === 'number') {
                            Log.warn("\t Scoreoverall missing; just using public test value.");
                            d2score = d2result.output.report.scoreTest;
                        } else {
                            Log.warn("\t Missing d2 public & private scores for: " + grade.URL);
                        }
                    } else {
                        Log.warn("\t Missing d2 score for: " + grade.URL);
                    }

                    // d4 score
                    let d4score = 0;
                    if (d4result !== null && typeof d4result.output.report.scoreTest === 'number') {
                        d4score = d4result.output.report.scoreTest;
                    } else {
                        Log.warn("\t Missing d4 score for: " + grade.URL);
                    }

                    const overallScore = d1score * .25 + d2score * .25 + d4score * .5;

                    Log.info("\t Score values; D1:" + d1score + "; D2: " + d2score +
                        "; D4: " + d4score + "; overall score: " + overallScore);

                    if (this.isNumeric(d1score) && this.isNumeric(d2score) && this.isNumeric(d4score) && this.isNumeric(overallScore)) {
                        // good record
                        const d4FinalScore = Number(overallScore.toFixed(2));

                        const payload: GradePayload = {
                            score:   d4FinalScore,
                            comment: '',

                            urlName: sha,
                            URL:     grade.URL, // commit URL if known, otherwise repo URL

                            timestamp: Date.now(), // even if grade < 0 might as well return when the entry was made
                            custom:    {d1: d1score, d2: d2score, d4: d4score, d4final: d4FinalScore}
                        };

                        if (this.WRITE_GRADE === true || this.TEST_USERS.indexOf(grade.personId) >= 0) {
                            await gradesC.createGrade(repoId, 'd4', payload);
                        }
                    } else {
                        Log.error("\t Invalid score value: " + grade.URL);
                    }
                } catch (err) {
                    Log.error("\t Something went really wrong for: " + grade.URL);
                }
            }
        }

        Log.info("ComputeD4::process() - done");
    }

    private isNumeric(n: any) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
}

const iat = new ComputeD4();
const start = Date.now();
Log.Level = LogLevel.INFO;
iat.process().then(function() {
    Log.info("ComputeD4::process() - complete; took: " + Util.took(start));
    process.exit();
}).catch(function(err) {
    Log.error("ComputeD4::process() - ERROR: " + err.message);
    process.exit();
});
