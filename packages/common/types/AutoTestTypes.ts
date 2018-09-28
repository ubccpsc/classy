import {ContainerInput, GradeReport} from "./ContainerTypes";

/**
 * Pertinent properties from GitHub push webhook events.
 */
// export interface IPushEvent extends CommitTarget {
//     // cloneURL: string; // used by the Grader service
// }
//
// /**
//  * Pertinent properties from GitHub comment webhook events.
//  */
// export interface ICommentEvent extends CommitTarget {
//     // personId: string; // NOTE: this is received as a github id!
//     // botMentioned: boolean; // was the bot mentioned (e.g., can ignore comments that don't mention the bot)
// }

export interface IFeedbackGiven {
    personId: string;
    delivId: string;
    timestamp: number;
    commitURL: string; // for information only
}

/**
 * Description of attachments that are saved in files on disk. This
 * helps minimize database size making it easier to backup and much
 * quicker to search and traverse (especially over the network).
 */
export interface IAttachment {
    name: string; // file identifier attachment (e.g., stdio.txt)
    path: string; // path to file (including name)
    content_type: string;
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

/**
 * Primary data structure that is returned by a Grader.
 */
export interface ContainerOutput {
    timestamp: number; // time when complete
    report: GradeReport;
    postbackOnComplete: boolean;
    attachments: IAttachment[];
    state: string; // SUCCESS, FAIL, TIMEOUT, INVALID_REPORT, LINT, COMPILE // TODO: move to GradeReport
    custom: {};
}
