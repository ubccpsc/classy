import Config, {ConfigKey} from "../../../common/Config";
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
 * 1) Get on the VPN.
 * 2) Make sure you don't have a local mongo instance running.
 * 3) Ensure your .env corresponds to the production values.
 * 4) ssh user@host -L 27017:127.0.0.1:27017
 * 5) Run this script.
 *
 */
export class InvokeAutoTest {

    private dc: DatabaseController;
    /**
     * Only actually performs the action if DRY_RUN is false.
     * Otherwise, just show what _would_ happen.
     * NOTE: this is ignored for the TEST_USER user.
     * @type {boolean}
     */
    private DRY_RUN = false;

    /**
     * Username to ignore DRY_RUN for (aka usually a TA or course repo for testing)
     * @type {string}
     */
    private TEST_USER = 'XXXX'; // 'w8j0b'; // 'r5t0b';

    /**
     * Invoke Autotest invisibly (aka by faking a webhook) or visibly (by making a public comment).
     *
     * @type {boolean}
     */
    private INVISIBLE = true;

    constructor() {
        Log.info("InvokeAutoTest::<init> - start");
        this.dc = DatabaseController.getInstance();
    }

    public async process(): Promise<void> {
        Log.info("InvokeAutoTest::process() - start");

        const c = Config.getInstance();
        const gha = GitHubActions.getInstance(true);

        // Find the commit you want to invoke the bot against.
        // e.g., for cs310 d4, we run against the graded d3 commit.
        // You might use some other approach here; any commit URL
        // will work with the code below.
        const gradesC = new GradesController();
        const allGrades = await gradesC.getAllGrades(false);
        const grades = [];
        for (const grade of allGrades as Grade[]) {
            if (grade.delivId === 'd3') {
                grades.push(grade);
            }
        }

        // Keep track of the URLs we have already processed.
        // This is needed for multi-student repos as the URL may be identical
        // for multiple students and we only need to invoke the bot once-per-repo.
        const alreadyProcessed: string[] = [];
        for (const grade of grades) {
            const url = grade.URL;
            let msg = null;

            if (alreadyProcessed.indexOf(url) >= 0) {
                Log.info("InvokeAutoTest::process() - skipping result; already handled: " + url);
            } else {
                Log.info("InvokeAutoTest::process() - processing result: " + url);
                alreadyProcessed.push(url);

                // NOTE: the queue needs to drain from all of a deliverable before scheduling another (I do not know why)
                // aka don't run this multiple times in a row until the previous run has finished (e.g., d1, d2, and d4)

                // msg = "@autobot #d4 #force #silent. D4 results will be posted to the Classy grades view once they are released. " +
                //     "\n\n Note: if you do not think this is the right commit, please fill out the project late grade request form " +
                //     "by December 14 @ 0800; we will finalize all project grades that day.";

                // msg = "@autobot #d1 #force #silent.";

                msg = "@autobot #d2 #force #silent.";
            }

            if (this.DRY_RUN === false || grade.personId === this.TEST_USER) {
                if (msg !== null) {
                    if (this.INVISIBLE === true) {
                        const org = c.getProp(ConfigKey.org) + '/';
                        // this is brittle; should probably have a better way to extract this from a grade record
                        const projectId = url.substring(url.lastIndexOf(org) + org.length, url.lastIndexOf('/commit/'));
                        const sha = url.substring(url.lastIndexOf('/commit/') + 8);
                        Log.info("project: " + projectId + '; sha: ' + sha + '; URL: ' + url);
                        await gha.simulateWebookComment(projectId, sha, msg);
                    } else {
                        let u = url;
                        // update prefix:
                        // https://HOST/CPSC310-2018W-T1/ --> https://HOST/api/v3/repos/CPSC310-2018W-T1/
                        const prefixOld = 'https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/';
                        const prefixNew = 'https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2018W-T1/';
                        u = u.replace(prefixOld, prefixNew);

                        // change path:
                        // /commit/ -> /commits/
                        u = u.replace('/commit/', '/commits/');

                        // specify endpoint:
                        // append /comments
                        u = u + '/comments';

                        await gha.makeComment(u, msg);
                    }
                }
            } else {
                Log.info("Dry run for: " + url + "; msg: " + msg);
            }

        }
        Log.info("InvokeAutoTest::process() - done");
    }
}

const iat = new InvokeAutoTest();
const start = Date.now();
Log.Level = LogLevel.INFO;
iat.process().then(function() {
    Log.info("InvokeAutoTest::process() - complete; took: " + Util.took(start));
    process.exit();
}).catch(function(err) {
    Log.error("InvokeAutoTest::process() - ERROR: " + err.message);
    process.exit();
});
