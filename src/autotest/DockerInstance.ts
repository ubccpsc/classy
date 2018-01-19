import {ICommitRecord, IContainerInput} from "../Types";
import {IAutoTest} from "./AutoTest";
import {Config} from "../Config";

export class DockerInstance {
    private input: IContainerInput;

    /**
     * I have no idea what this class should look like
     */
    constructor(input: IContainerInput) {
        this.input = input;
    }

    public execute(): Promise<ICommitRecord> {
        return new Promise<ICommitRecord>((fulfill, reject) => {
            try {
                const oracleToken = Config.getInstance().getProp("githubOracleToken");
                const dockerId = Config.getInstance().getProp("dockerId");
                const workspace = Config.getInstance().getProp("workspace");
                // all disk stuff should be handled before this too
                fulfill(null); // should be the ICommitRecord!
            } catch (err) {
                reject(err);
            }
        });
    }
}
