export interface CommitTarget {
    /**
     * The delivId the commit should be executed against. If the course does not
     * have a default id and one is not specified (e.g., in a commit comment)
     * we cannot create a CommitTarget.
     */
    delivId: string;
    repoId: string;

    commitSHA: string;
    commitURL: string;

    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of push event
}

/**
 * Pertinent properties from GitHub push webhook events.
 */
export interface IPushEvent extends CommitTarget {
    // Nothing in PushEvent that CommitTarget does not already know about

    // branch: string; // really refs // TODO: needed?

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
    delivId: string; // foreign key into Deliverables (so we know what this run is scoring) (intentional duplication with input.delivId)
    repoId: string;  // foreign key into Repositories (so we know what repository (and people) this run is for) (intentional duplication with input.pushInfo.repoId)

    // input.pushInfo.timestamp // timestamp of push
    // output.timestamp // timestamp of grading completion

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
    dockerImage: string;
    studentDelay: number;
    maxExecTime: number;
    regressionDelivIds: string[];
    custom: {};
}
