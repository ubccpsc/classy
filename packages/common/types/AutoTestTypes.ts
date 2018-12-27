import {ContainerInput, ContainerOutput} from "./ContainerTypes";

export interface IFeedbackGiven {
    personId: string;
    delivId: string;
    timestamp: number;
    commitURL: string; // for information only
}

/**
 * This is the result of an AutoTest run. It is constructed by the Grader
 * and sent back to Classy for querying on the backend as needed.
 *
 * There is some duplication in the record to enable easier querying.
 *
 */
export interface AutoTestResult {

    /**
     * Foreign key into Deliverables.
     * This lets us know what deliverable this run is scoring.
     *
     * (intentional duplication with input.delivId)
     */
    delivId: string;

    /**
     * Foreign key into Repositories.
     * This helps us know what repository (and people) this run is for.
     *
     * (intentional duplication with input.pushInfo.repoId)
     */
    repoId: string;

    commitURL: string;
    commitSHA: string; // can be used to index into the AutoTest collections (pushes, comments, & feedback)

    input: ContainerInput; // Prepared by AutoTest service
    output: ContainerOutput; // Returned by the Grader service
}
