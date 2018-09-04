export interface CommitTarget {
    /**
     * The delivId the commit should be executed against. If the course does not
     * have a default id and one is not specified (e.g., in a commit comment)
     * we cannot create a CommitTarget.
     */
    delivId: string; // TODO: remove this from here? it's already in IContainerInput
    repoId: string;

    // TODO: add cloneURL

    commitSHA: string;
    commitURL: string;

    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of push event
}

/**
 * Pertinent properties from GitHub push webhook events.
 */
export interface IPushEvent extends CommitTarget {
    cloneURL: string; // used by the Grader service
}

/**
 * Pertinent properties from GitHub comment webhook events.
 */
export interface ICommentEvent extends CommitTarget {
    personId: string; // NOTE: this is received as a github id!
    botMentioned: boolean; // was the bot mentioned (e.g., can ignore comments that don't mention the bot)
}

export interface IFeedbackGiven {
    personId: string;
    delivId: string;
    timestamp: number;
    commitURL: string; // for information only
}

/**
 * This is the result of an AutoTest run.
 *
 * There is some duplication in the record to enable easier querying.
 *
 */
export interface IAutoTestResult {

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

    input: IContainerInput; // Prepared by AutoTest service
    output: IContainerOutput; // Returned by the Grader service
}

/**
 * Primary data structure that the course container is invoked with.
 */
export interface IContainerInput {
    delivId: string; // Specifies what delivId the Grader should execute against.
    // TODO: rename to target: ICommitTarget
    pushInfo: IPushEvent; // Details about the push event that led to this request.
    containerConfig: AutoTestConfig; // Container configuration details.
}

/**
 * Primary data structure that the course container returns.
 */
export interface IGradeReport {
    scoreOverall: number; // must be set
    scoreTest: number | null; // null means not valid for this report
    scoreCover: number | null; // null means not valid for this report

    // The semantics of these four categories are up to the container
    // we only differentiate them so the report UI can render them uniquely.
    // Set to [] for any unused property.
    passNames: string[];
    failNames: string[];
    errorNames: string[];
    skipNames: string[];

    // This is the text of the feedback (in markdown) that the container wants
    // to return to the user.
    feedback: string;

    // Enables custom values to be returned to the UI layer.
    // PLEASE: do not store large objects in here or it will
    // significantly impact the performance of the dashboard.
    // Use attachments instead for large bits of data you wish
    // to persist.
    custom: {};
}

/**
 * Primary data structure that is returned by a Grader.
 */
export interface IContainerOutput {
    timestamp: number; // time when complete
    report: IGradeReport;
    postbackOnComplete: boolean;
    attachments: IAttachment[];
    state: string; // enum: SUCCESS, FAIL, TIMEOUT, INVALID_REPORT
    custom: {};
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
 * Description of the configuration parameters for the AutoTest container.
 * These can be specified per-deliverable in the Portal UI.
 */
export interface AutoTestConfig {
    dockerImage: string; // docker image that should be launchd
    studentDelay: number; // minimum interval between student requests in seconds
    maxExecTime: number; // maximum execution time for the container before it will be timed out in seconds
    regressionDelivIds: string[]; // other deliverables that should be run alongside any request
    custom: {}; // custom parameters
}
