import {ICommitRecord} from "../Types";
import {IAutoTest} from "./AutoTest";

export class DockerInstance {
    private input: ICommitRecord;
    private at: IAutoTest;

    /**
     * I have no idea what this class should look like
     */

    constructor(input: ICommitRecord, at: IAutoTest) {
        this.input = input;
        this.at = at;
    }

    public execute() {
        // NOTE: container should handle cases where a delivId (e.g, d1717) does not exist
        const result: ICommitRecord = null; // TODO: do the thing
        this.at.handleExecutionComplete(result);
    }
}
