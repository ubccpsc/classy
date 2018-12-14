import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {AutoTestResult} from "../../../../common/types/AutoTestTypes";
import {ContainerInput, ContainerOutput, ContainerState, GradeReport} from "../../../../common/types/ContainerTypes";
import Util from "../../../../common/Util";
import {GradingJob} from "../GradingJob";

export class MockGradingJob extends GradingJob {

    constructor(input: ContainerInput) {
        super(input);
    }

    public async prepare(): Promise<void> {
        return;
    }

    public async run(): Promise<AutoTestResult> {
        try {
            Log.info("MockGrader::execute() - start; commitSHA: " + this.input.target.commitSHA);
            // const oracleToken = Config.getInstance().getProp(ConfigKey.githubOracleToken);
            // const dockerId = Config.getInstance().getProp(ConfigKey.dockerId);
            // const workspace = Config.getInstance().getProp(ConfigKey.workspace);

            // TODO: This should really become TestDocker.ts or something that can be instantiated
            let timeout = 10000;
            if (Config.getInstance().getProp(ConfigKey.name) === Config.getInstance().getProp(ConfigKey.testname)) {
                timeout = 20; // don't slow down tests; don't need a lot to get out of order here
            }
            await Util.timeout(timeout); // simulate the container taking longer than the rest of the process

            const gradeReport: GradeReport = {
                scoreOverall: 50,
                scoreTest:    50,
                scoreCover:   50,
                passNames:    [],
                failNames:    [],
                errorNames:   [],
                skipNames:    [],
                custom:       {},
                feedback:     "Test execution complete.",
                result:        "SUCCESS",
                attachments:  []
            };

            const out: ContainerOutput = {
                // commitURL:          this.input.pushInfo.commitURL,
                timestamp:          Date.now(),
                report:             gradeReport,
                // feedback:           "Test execution complete.",
                postbackOnComplete: false,
                custom:             {},
                state:              ContainerState.SUCCESS,
                graderTaskId:        ""
            };

            // just a hack to test postback events
            if (this.input.target.postbackURL === "POSTBACK") {
                out.postbackOnComplete = true;
                out.report.feedback = "Build Problem Encountered.";
            }

            const ret: AutoTestResult = {
                delivId:   this.input.delivId,
                repoId:    this.input.target.repoId,
                // timestamp: this.input.pushInfo.timestamp,
                commitURL: this.input.target.commitURL,
                commitSHA: this.input.target.commitSHA,
                input:     this.input,
                output:    out
            };

            Log.info("MockGrader::execute() - execution complete; commit: " + this.input.target.commitSHA);
            return ret;

        } catch (err) {
            Log.error("MockGrader::execute() - ERROR: " + err);
            throw err;
        }
    }
}
