import Log, {LogLevel} from "../../../common/Log";
import Util from "../../../common/Util";

import {DatabaseController} from "../src/controllers/DatabaseController";
import {GitHubActions} from "../src/controllers/GitHubActions";
import {GradesController} from "../src/controllers/GradesController";

import {Grade} from "../src/Types";

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
export class InvokeAutoTest {

    private dc: DatabaseController;
    private DRY_RUN = true;

    constructor() {
        Log.info("InvokeAutoTest::<init> - start");
        this.dc = DatabaseController.getInstance();
    }

    public async process(): Promise<void> {
        Log.info("InvokeAutoTest::process() - start");

        const gha = GitHubActions.getInstance(true);
        const gradesC = new GradesController();

        const allGrades = await gradesC.getAllGrades(false);
        const grades = [];
        for (const grade of allGrades as Grade[]) {
            if (grade.delivId === 'd3') {
                grades.push(grade);
            }
        }

        const alreadyProcessed: string[] = [];
        for (const grade of grades) {
            const url = grade.URL;
            let msg = null;

            if (alreadyProcessed.indexOf(url) >= 0) {
                Log.info("InvokeAutoTest::process() - skipping result; already handled: " + url);
            } else {
                Log.info("InvokeAutoTest::process() - processing result: " + url);
                alreadyProcessed.push(url);

                msg = "@autobot #d4 #force #silent. D4 results will be posted to the Classy grades view once they are released. " +
                    "\n\n Note: if you do not think this is the right commit, please fill out the project late grade request form " +
                    "by December 14 @ 0800; we will finalize all project grades that day.";
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

            const TEST_USER = 'w8j0b'; // 'r5t0b';
            if (this.DRY_RUN === false || grade.personId === TEST_USER) {
                if (msg !== null) {
                    await gha.makeComment(u, msg);
                }
            } else {
                Log.info("Dry run comment to: " + u + "; msg: " + msg);
            }

        }
        Log.info("InvokeAutoTest::process() - done");
    }
}

const ppt = new InvokeAutoTest();
const start = Date.now();
Log.Level = LogLevel.INFO;
ppt.process().then(function() {
    Log.info("InvokeAutoTest::process() - complete; took: " + Util.took(start));
    process.exit();
}).catch(function(err) {
    Log.error("InvokeAutoTest::process() - ERROR: " + err.message);
    process.exit();
});
