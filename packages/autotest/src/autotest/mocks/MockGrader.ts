import {Config} from "../../../../common/Config";
import {ICommitRecord, IContainerInput, IContainerOutput, IGradeReport} from "../../Types";
import Log from "../../../../common/Log";
import Util from "../../../../common/Util";

interface IGrader {
    execute(): Promise<ICommitRecord>;
}

export class MockGrader implements IGrader {
    private input: IContainerInput;

    /**
     * I have no idea what this class should look like
     */
    constructor(input: IContainerInput) {
        this.input = input;
    }

    public async execute(): Promise<ICommitRecord> {
        try {
            Log.info("MockGrader::execute() - start; commitSHA: " + this.input.pushInfo.commitSHA);
            const oracleToken = Config.getInstance().getProp("githubOracleToken");
            const dockerId = Config.getInstance().getProp("dockerId");
            const workspace = Config.getInstance().getProp("workspace");

            // TODO: This should really become TestDocker.ts or something that can be instantiated
            let timeout = 10000;
            if (Config.getInstance().getProp("name") === "test") {
                timeout = 20; // don't slow down tests; don't need a lot to get out of order here
            }
            await Util.timeout(timeout); // simulate the container taking longer than the rest of the process

            const gradeReport: IGradeReport = {
                scoreOverall: 50,
                scoreTest:    50,
                scoreCover:   50,
                passNames:    [],
                failNames:    [],
                errorNames:   [],
                skipNames:    [],
                custom:       [],
                feedback:     ""
            };

            const out: IContainerOutput = {
                commitURL:          this.input.pushInfo.commitURL,
                timestamp:          Date.now(),
                report:             gradeReport,
                feedback:           "Test execution complete.",
                postbackOnComplete: false,
                custom:             {},
                attachments:        [],
                state:              "SUCCESS" // enum: SUCCESS, FAIL, TIMEOUT, INVALID_REPORT
            };

            // just a hack to test postback events
            if (this.input.pushInfo.postbackURL === "POSTBACK") {
                out.postbackOnComplete = true;
                out.feedback = "Build Problem Encountered.";
            }

            const ret: ICommitRecord = {
                commitURL: this.input.pushInfo.commitURL,
                commitSHA: this.input.pushInfo.commitSHA,
                input:     this.input,
                output:    out
            };

            Log.info("MockGrader::execute() - execution complete; commit: " + this.input.pushInfo.commitSHA);
            return ret;

        } catch (err) {
            Log.error("MockGrader::execute() - ERROR: " + err);
            throw err;
        }
    }
}
