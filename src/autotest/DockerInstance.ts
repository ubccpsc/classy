import {ICommitInfo} from "../Types";
import {IAutoTest} from "./AutoTestHandler";

export class DockerInstance {
    private input: ICommitInfo;
    private at: IAutoTest;

    /**
     * I have no idea what this class should look like
     */

    constructor(input: ICommitInfo, at: IAutoTest) {
        this.input = input;
        this.at = at;
    }

    public execute() {
        const result: ICommitInfo = null; // TODO: do the thing
        this.at.handleExecutionComplete(result);
    }
}
