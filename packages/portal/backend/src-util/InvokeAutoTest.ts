import Config, {ConfigKey} from "@common/Config";
import Log, {LogLevel} from "@common/Log";
import Util from "@common/Util";

import {DatabaseController} from "../src/controllers/DatabaseController";
import {GitHubActions} from "../src/controllers/GitHubActions";
import {GradesController} from "../src/controllers/GradesController";

import {Grade} from "../src/Types";

/**
 * Sometimes you want to programmatically invoke AutoTest many repositories.
 * This file shows how you can accomplish this.
 *
 * NOTE: the queue needs to drain from all of a deliverable before scheduling another.
 * AKA do not run this multiple times in a row until the previous run has finished (e.g., c1, c2, and c3)
 *
 * To run this locally you need to have a .env configured with the production values
 * and an ssh tunnel configured to the server you want the database to come from.
 *
 * 1) Get on the UBC VPN.
 * 2) Make sure you do not have a local mongo instance running.
 * 3) Ensure your .env corresponds to the production values.
 * 4) ssh user@host -L 27017:127.0.0.1:27017
 * 5) Run this script.
 *
 * Alternatively, this can be run on the production host, which saves you from
 * having to configuring a .env.
 *
 * Regardless of how you are using this, running with DRY_RUN true
 * is always recommended, so you can ensure the script is behaving
 * as you expect.
 *
 */
export class InvokeAutoTest {

    /**
     * Only actually performs the action if DRY_RUN is false.
     * Otherwise, just show what _would_ happen.
     * NOTE: this is ignored for the TEST_USER user.
     */
    private DRY_RUN = true;

    /**
     * Usernames to ignore DRY_RUN for (aka usually a TA or course repo for testing)
     */
    private readonly TEST_USERS: string[] = []; // ["r5t0b"]; // ["w8j0b", "l7m1b"]; // ["w8j0b", "r5t0b"];

    /**
     * Invoke Autotest invisibly (aka by faking a webhook) or visibly (by making a public comment).
     *
     */
    private INVISIBLE = true;

    /**
     * Specify the delivId we are running against.
     */
    private readonly DELIVID = "c1";

    /**
     * To make this request we are actually transforming a commit URL into an API request URL.
     * Having to hard-code this is not pretty, but it makes the code much simpler. The format
     * you need should be pretty easy to infer from what is present here.
     */
    private readonly PREFIXOLD = "https://github.students.cs.ubc.ca/orgs/CPSC310-2022W-T2/";
    private readonly PREFIXNEW = "https://github.students.cs.ubc.ca/api/v3/repos/CPSC310-2022W-T2/";

    // private readonly MSG  = "@310-bot #d1 #force #silent.";
    // private readonly MSG  = "@310-bot #d2 #force #silent.";
    private readonly MSG = "@310-bot #c1 #force #silent.";
    // private readonly MSG = "@310-bot #c4 #force #silent.";
    // private readonly MSG  = "@310-bot #c3 #force #silent. C3 results will be posted to the Classy grades view once they are released. " +
    //     "\n\n Note: if you do not think this is the right commit, please fill out the project late grade request form " +
    //     "by December 14 @ 0800; we will finalize all project grades that day.";

    private dc: DatabaseController;

    constructor() {
        Log.info("InvokeAutoTest::<init> - start");
        this.dc = DatabaseController.getInstance();
    }

    public async process(): Promise<void> {
        Log.info("InvokeAutoTest::process() - start");

        const c = Config.getInstance();
        const gha = GitHubActions.getInstance(true);

        // Find the commit you want to invoke the bot against.
        // e.g., usually you want to run against the commit associated
        // with the grade record, as that is the 'max' commit
        // but it is conceivable you might want to instead get all
        // result rows and run against the latest before the deadline
        // or some other approach.
        //
        // You might use some other approach here; any commit URL
        // will work with the code below.
        const gradesC = new GradesController();
        Log.info("InvokeAutoTest::process() - requesting grades");
        const allGrades = await gradesC.getAllGrades(false);
        Log.info("InvokeAutoTest::process() - # grades retrieved: " + allGrades.length);

        const grades = [];
        for (const grade of allGrades as Grade[]) {
            if (grade.delivId === this.DELIVID) {
                grades.push(grade);
            }
        }

        // Keep track of the URLs we have already processed.
        // This is needed for multi-student repos as the URL may be identical
        // for multiple students and we only need to invoke the bot once-per-repo.
        const alreadyProcessed: string[] = [];
        for (const grade of grades) {
            const url = grade.URL;

            if (alreadyProcessed.indexOf(url) >= 0) {
                // Log.info("InvokeAutoTest::process() - skipping result; already handled: " + url);
                continue;
            }

            // useful if you just want to run on a subset of grades (e.g., the ones that might have timed out)
            // if (grade.score > 25) {
            //     Log.info("InvokeAutoTest::process() - skipping result; grade > 25: " + grade.score + "; URL: " + url);
            //     continue;
            // }

            Log.info("InvokeAutoTest::process() - processing result: " + url);
            alreadyProcessed.push(url);

            if (this.DRY_RUN === false || this.TEST_USERS.indexOf(grade.personId) >= 0) {
                if (this.MSG !== null) {
                    if (this.INVISIBLE === true) {
                        const org = c.getProp(ConfigKey.org) + "/";
                        // this is brittle; should probably have a better way to extract this from a grade record
                        const projectId = url.substring(url.lastIndexOf(org) + org.length, url.lastIndexOf("/commit/"));
                        const sha = url.substring(url.lastIndexOf("/commit/") + 8);
                        Log.info("Making invisible request for project: " + projectId + "; sha: " + sha + "; URL: " + url);
                        await gha.simulateWebhookComment(projectId, sha, this.MSG);
                    } else {
                        let u = url;
                        // update prefix from: https://HOST/CPSC310-2018W-T1/ --> https://HOST/api/v3/repos/CPSC310-2018W-T1/
                        u = u.replace(this.PREFIXOLD, this.PREFIXNEW);
                        // change path from /commit/ -> /commits/
                        u = u.replace("/commit/", "/commits/");
                        // specify endpoint; append /comments
                        u = u + "/comments";

                        Log.info("Making comment request for url: " + u);
                        await gha.makeComment(u, this.MSG);
                    }
                } else {
                    Log.info("Null MSG; nothing done for: " + url);
                }
            } else {
                // Log.info("Dry run for: " + url + "; msg: " + this.MSG);
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
