import Log, {LogLevel} from "../../../common/Log";
import Util from "../../../common/Util";

import {DatabaseController} from "../src/controllers/DatabaseController";
import {GitHubActions} from "../src/controllers/GitHubActions";
import {GradesController} from "../src/controllers/GradesController";
import {ResultsController} from "../src/controllers/ResultsController";

import {AuditLabel, Grade} from "../src/Types";

/**
 * To run this locally you need to have a .env configured with the production values
 * and a ssh tunnel configured to the server you want the database to come from.
 *
 * 1) Get on the VPN
 * 2) Make sure you don't have a local mongo instance running
 * 3) Ensure your .env corresponds to the production values
 * 4) ssh user@host -L 27017:127.0.0.1:27017
 * 5) Run this script
 */
export class ProcessPrivateTests {

    private dc: DatabaseController;
    private DRY_RUN = true;

    private readonly DELIVID: string = 'd3';

    constructor() {
        Log.info("ProcessPrivateTests::<init> - start");
        this.dc = DatabaseController.getInstance();
    }

    public async process(): Promise<void> {
        Log.info("ProcessPrivateTests::process() - start");

        const gha = GitHubActions.getInstance(true);
        const gradesC = new GradesController();
        const resultsC = new ResultsController();
        const dbc = DatabaseController.getInstance();

        const allGrades = await gradesC.getAllGrades();
        const grades = [];
        for (const grade of allGrades as Grade[]) {
            if (grade.delivId === this.DELIVID) {
                grades.push(grade);
            }
        }

        const alreadyProcessed: string[] = [];
        const values: Array<{pub: number, priv: number}> = [];
        // tslint:disable-next-line
        // console.log('csid, pubScore, coverScore, privScore, finalScore');
        for (const grade of grades) {
            const url = grade.URL;

            const result = await resultsC.getResultFromURL(url);
            const scorePub = Number(result.output.report.scoreTest);
            const scoreCover = Number(result.output.report.scoreCover);
            const scorePriv = Number((result.output.report.custom as any).private.scoreTest);

            values.push({pub: scorePub, priv: scorePriv});

            let finalScore = 0;
            let msg = '';
            if (this.DELIVID === 'd2') {
                // 25% private tests
                finalScore = (((scorePub * .75) + (scorePriv * .25)) * .8) + (scoreCover * .2);
                finalScore = Number(finalScore.toFixed(2));
                msg = "### D2 Results \n\n* ***Final Score:*** " + finalScore + "\n * Public test score: " + scorePub +
                    "\n * Private test score: " + scorePriv + "\n * Coverage score: " + scoreCover +
                    "\n\n Private test details available by calling the bot on `d2` for a _new_ commit once it is re-enabled." +
                    "\n\n Note: if this is an earlier commit than you expected, " +
                    "it is because it has a higer (or equivalent) score to the later commit.";
            } else if (this.DELIVID === 'd3') {
                // 50% private tests
                finalScore = (((scorePub * .5) + (scorePriv * .5)) * .8) + (scoreCover * .2);
                Log.info("pub: " + scorePub.toFixed(0) + "; priv: " + scorePriv.toFixed(0));
                if ((scorePub - scorePriv) > 20) {
                    Log.warn("pub: " + scorePub.toFixed(0) + "; priv: " + scorePriv.toFixed(0) + "; url: " + url);
                }
                finalScore = Number(finalScore.toFixed(2));
                msg = "### D3 Results \n\n Final D3 results will be visible in the Classy grades view once they are released. " +
                    "\n\n Note: if you do not think this is the right commit, please fill out the project late grade request form " +
                    "by November 14 @ 0800; we will finalize all project grades that day.";
            } else {
                // instead of an error, put your one-off code here if you have some
                Log.error("ProcessPrivateTests::process() - unknown delivId: " + this.DELIVID);
            }

            // test URL
            // let u = 'https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/d0_r5t0b/commit/6cfd47be38b320c741b0613f2d0f7d958e35f2c6';
            let u = url;

            // update prefix
            // https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/ --> https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2018W-T1/
            const prefixOld = 'https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/';
            const prefixNew = 'https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2018W-T1/';
            u = u.replace(prefixOld, prefixNew);

            // change path
            // /commit/ -> /commits/
            u = u.replace('/commit/', '/commits/');

            // specify endpoint
            // append /comments
            u = u + '/comments';

            const newGrade: Grade = JSON.parse(JSON.stringify(grade)); // Object.assign is a shallow copy which doesn't work here
            (newGrade.custom as any).publicGrade = grade;
            newGrade.timestamp = Date.now();
            // (newGrade as any).personId = 'r5t0b'; // REMOVE
            // change grade
            newGrade.score = finalScore;

            // publish grade

            if (alreadyProcessed.indexOf(url) >= 0) {
                Log.info("ProcessPrivateTests::process() - skipping result; already handled: " + url);
            } else {
                Log.info("ProcessPrivateTests::process() - processing result: " + url);
                alreadyProcessed.push(url);

                const TEST_USER = 'XXXXX';
                if (this.DRY_RUN === false || grade.personId === TEST_USER) {
                    await gha.makeComment(u, msg);
                    await gradesC.saveGrade(newGrade);
                    await dbc.writeAudit(AuditLabel.GRADE_CHANGE, 'ProcessPrivateTest', grade, newGrade, {});
                } else {
                    Log.info("Dry run comment to: " + u + "; msg: " + msg);
                    Log.info("Dry run grade update for: " + newGrade.personId);
                }
            }
        }
        Log.info("ProcessPrivateTests::process() - values:");
        for (const value of values) {
            // tslint:disable-next-line
            console.log(value.pub + ", " + value.priv);
        }
        Log.info("ProcessPrivateTests::process() - done");
    }
}

const ppt = new ProcessPrivateTests();
const start = Date.now();
Log.Level = LogLevel.INFO;
ppt.process().then(function() {
    Log.info("ProcessPrivateTests::process() - complete; took: " + Util.took(start));
    process.exit();
}).catch(function(err) {
    Log.error("ProcessPrivateTests::process() - ERROR: " + err.message);
    process.exit();
});
