//
// Types needed from the Container's POV
//
export interface IPushEvent {
    repoId: string; // was repo

    branch: string; // really refs
    cloneURL: string;
    commitSHA: string; // SHA
    commitURL: string; // full url to commit

    projectURL: string; // full url to project
    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of push event
}

export interface ICommentEvent {
    personId: string; // was username
    delivId: string | null; // string if specified
    repoId: string;

    commitSHA: string;
    commitURL: string;

    botMentioned: boolean; // was the bot mentioned (e.g., can ignore comments that don't mention the bot)
    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of the latest comment update (safer than comment creation)
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

export interface IContainerInput {
    delivId: string; // Specifies what delivId the Grader should execute against.
    pushInfo: IPushEvent; // Details about the push event that led to this request.
    containerConfig: AutoTestConfig; // Container configuration details.
}

/**
 * This is the main type that is returned by the Grader.
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
 * This is the data structure that is returned by the course container.
 */
export interface IGradeReport {
    scoreOverall: number; // must be set
    scoreTest: number | null; // null means not valid for this report
    scoreCover: number | null; // null means not valid for this report

    // The semantics of these four categories are up to the container
    // we only differentiate them so the report UI can render them uniquely.
    // Insert [] if a category is not being used.
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
    // Use attachements instead for large bits of data you wish
    // to persist.
    custom: {};
}

export interface IAttachment {
    name: string; // file identifier attachment (e.g., stdio.txt)
    path: string; // path to file (including name)
    content_type: string;
}

export interface AutoTestConfig {
    dockerImage: string;
    studentDelay: number;
    maxExecTime: number;
    regressionDelivIds: string[];
    custom: object;
}
