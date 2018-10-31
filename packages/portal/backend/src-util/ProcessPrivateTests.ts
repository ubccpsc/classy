import Log from "../../../common/Log";
import Util from "../../../common/Util";
import {DatabaseController} from "../src/controllers/DatabaseController";
import {GradesController} from "../src/controllers/GradesController";
import {ResultsController} from "../src/controllers/ResultsController";
import {Grade} from "../src/Types";

export class ProcessPrivateTests {

    private dc: DatabaseController;
    private DRY_RUN = true;

    constructor() {
        Log.trace("ProcessPrivateTests::<init> - start");
        this.dc = DatabaseController.getInstance();
    }

    public async process(): Promise<void> {

        const gradesC = new GradesController();
        const resultsC = new ResultsController();

        const allGrades = await gradesC.getAllGrades();
        const grades = [];
        for (const grade of allGrades as Grade[]) {
            if (grade.delivId === 'd2') {
                grades.push(grade);
            }
        }

        for (const grade of grades) {
            const url = grade.URL;
            // Log.info("Considering URL: " + url);
            // Log.info("\tFull Grade: " + JSON.stringify(grade));
            const result = await resultsC.getResultFromURL(url);
            // Log.info("\tFull Result: " + JSON.stringify(result));
            const score = result.output.report.scoreTest;
            const privScore = (result.output.report.custom as any).private.scoreTest;
            // Log.info("\tPub Test: " + score + "; Priv test: " + privScore);
            Log.info(", " + score + ', ' + privScore);
        }
    }

}

const ppt = new ProcessPrivateTests();
const start = Date.now();
ppt.process().then(function() {
    Log.info("ProcessPrivateTests::process() - complete; took: " + Util.took(start));
}).catch(function(err) {
    Log.error("ProcessPrivateTests::process() - ERROR: " + err.message);
    process.exit();
});
