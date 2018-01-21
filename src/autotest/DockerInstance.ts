import {Config} from "../Config";
import {IAttachment, ICommitRecord, IContainerInput, IContainerOutput, IGradeReport} from "../Types";
import Log from "../util/Log";

export class DockerInstance {
    private input: IContainerInput;

    /**
     * I have no idea what this class should look like
     */
    constructor(input: IContainerInput) {
        this.input = input;
    }

    public async execute(): Promise<ICommitRecord> {
        try {
            Log.info("DockerInstance::execute() - start; commitSHA: " + this.input.pushInfo.commitSHA);
            const oracleToken = Config.getInstance().getProp("githubOracleToken");
            const dockerId = Config.getInstance().getProp("dockerId");
            const workspace = Config.getInstance().getProp("workspace");
            // all disk stuff should be handled before this too
            //      fulfill(null); // should be the ICommitRecord!
            // Log.info("about to timeout");

            const timeout = function (ms: number) {
                return new Promise((resolve) => setTimeout(resolve, ms));
            };
            await timeout(10000);

            Log.info("DockerInstance::execute() - done; commitSHA: " + this.input.pushInfo.commitSHA);

            const gradeReport: IGradeReport = {
                scoreOverall: 50,
                scoreTest:    50,
                scoreCover:   50,
                passNames:    [],
                failNames:    [],
                errorNames:   [],
                skipNames:    [],
                custom:       []
            };

            const out: IContainerOutput = {
                commitUrl:          this.input.pushInfo.commitURL,
                timestamp:          Date.now(),
                report:             gradeReport,
                feedback:           "Test Feedback", // markdown
                postbackOnComplete: false,
                custom:             {},
                attachments:        [],
                state:              "SUCCESS" // enum: SUCCESS, FAIL, TIMEOUT, INVALID_REPORT
            };

            const ret: ICommitRecord = {
                commitURL: this.input.pushInfo.commitURL,
                commitSHA: this.input.pushInfo.commitSHA,
                input:     this.input,
                output:    out
            };

            return ret;

        } catch (err) {
            Log.error("DockerInstance::execute() - ERROR: " + err);
            throw err;
        }
    }
}
