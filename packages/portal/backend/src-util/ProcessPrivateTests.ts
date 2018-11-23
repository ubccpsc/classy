import Log, {LogLevel} from "../../../common/Log";
import Util from "../../../common/Util";

import {DatabaseController} from "../src/controllers/DatabaseController";
import {GitHubActions} from "../src/controllers/GitHubActions";
import {GradesController} from "../src/controllers/GradesController";
import {ResultsController} from "../src/controllers/ResultsController";

import {Grade} from "../src/Types";

export class ProcessPrivateTests {

    private dc: DatabaseController;
    private DRY_RUN = true;

    constructor() {
        Log.info("ProcessPrivateTests::<init> - start");
        this.dc = DatabaseController.getInstance();
    }

    public async process(): Promise<void> {
        Log.info("ProcessPrivateTests::process() - start");

        const gha = GitHubActions.getInstance(true);
        const gradesC = new GradesController();
        const resultsC = new ResultsController();

        const allGrades = await gradesC.getAllGrades();
        const grades = [];
        for (const grade of allGrades as Grade[]) {
            if (grade.delivId === 'd2') {
                grades.push(grade);
            }
        }

        // tslint:disable-next-line
        // console.log('csid, pubScore, coverScore, privScore, finalScore');
        for (const grade of grades) {
            const url = grade.URL;

            const result = await resultsC.getResultFromURL(url);
            const scorePub = Number(result.output.report.scoreTest);
            const scoreCover = Number(result.output.report.scoreCover);
            const scorePriv = Number((result.output.report.custom as any).private.scoreTest);

            let finalScore = (((scorePub * .75) + (scorePriv * .25)) * .8) + (scoreCover * .2);
            finalScore = Number(finalScore.toFixed(2));

            // tslint:disable-next-line
            // console.log(id + ", " + scorePub + ', ' + scoreCover + ', ' + scorePriv + ', ' + finalScore);

            const msg = "### D2 Results \n\n* ***Final Score:*** " + finalScore + "\n * Public test score: " + scorePub +
                "\n * Private test score: " + scorePriv + "\n * Coverage score: " + scoreCover +
                "\n\n Private test details available by calling the bot on `d2` for a _new_ commit once it is re-enabled.\n";

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

            if (this.DRY_RUN === false) {
                await gha.makeComment(u, msg);
            } else {
                Log.info("Dry run comment to: " + u);
            }

            const newGrade: Grade = JSON.parse(JSON.stringify(grade)); // Object.assign is a shallow copy which doesn't work here
            (newGrade.custom as any).publicGrade = grade;
            newGrade.timestamp = Date.now();
            // (newGrade as any).personId = 'r5t0b'; // REMOVE
            // change grade
            newGrade.score = finalScore;

            // publish grade
            if (this.DRY_RUN === false) {
                await gradesC.saveGrade(newGrade);
            } else {
                Log.info("Dry run grade update for: " + newGrade.personId);
            }
        }
        Log.info("ProcessPrivateTests::process() - done");
    }
}

// going to need to do this first:
// ssh rtholmes@cs310.ugrad.cs.ubc.ca -L 27017:127.0.0.1:27017
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
