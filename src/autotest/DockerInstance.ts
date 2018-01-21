import {Config} from "../Config";
import {IAttachment, ICommitRecord, IContainerInput, IContainerOutput, IGradeReport} from "../Types";
import Log from "../util/Log";
import Util from "../util/Util";

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

            let timeout = 10000;
            if (Config.getInstance().getProp("name") === "test") {
                timeout = 20; // don't slow down tests; don't need a lot to get out of order here
            }
            await Util.timeout(timeout); // simulate the container taking longer than the rest of the process

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
                feedback:           "Test execution complete.",
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
