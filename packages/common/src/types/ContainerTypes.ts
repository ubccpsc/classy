import {AutoTestConfigTransport} from "./PortalTypes";

/**
 * These capture how a GraderJob completed. It is only a reflection
 * of the container state; SUCCESS can mean that the container
 * completed successfully but all the tests in the container failed.
 *
 * Use the 'result' field in the grade report to figure out how the
 * Grader actually interpreted the execution.
 */
export enum ContainerState {
    SUCCESS = "SUCCESS", // Container exited (possibly with a non-zero code)
    FAIL = "FAIL", // Container exited with -10
    TIMEOUT = "TIMEOUT", // Container was killed by Docker for taking too long
    NO_REPORT = "NO_REPORT" // Container did not write report.json file
}

/**
 * Primary data structure that the course container is invoked with.
 */
export interface ContainerInput {
    // delivId: string; // Specifies what delivId the Grader should execute against.
    target: CommitTarget; // Details about the push event that led to this request.
    containerConfig: AutoTestConfigTransport; // Container configuration details.
}

/**
 * Primary data structure that is returned by a Grader.
 */
export interface ContainerOutput {
    timestamp: number; // time when complete
    report: GradeReport;
    postbackOnComplete: boolean;
    state: ContainerState;
    custom: {};
    // Used to retrieve attachments for the particular grading run.
    graderTaskId: string;
}

export interface CommitTarget {
    /**
     * The delivId the commit should be executed against. If the course does not
     * have a default id and one is not specified (e.g., in a commit comment)
     * we cannot create a CommitTarget.
     */
    delivId: string;
    repoId: string;
    orgId?: string;

    adminRequest: boolean; // true if requested by admin or staff
    botMentioned: boolean; // true if explicitly mentioned
    personId: string | null; // string is Person.id if explicitly invoked, null otherwise
    kind: "push" | "standard"; // kind of request

    cloneURL: string;

    commitSHA: string;
    commitURL: string;

    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of push event
    tsJobStart?: number; // timestamp when target started executing

    ref?: string; // contains branch name for pushes
    flags?: string[]; // other flags for the commit (e.g., #slient, #force)
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

/**
 * Primary data structure that the course container returns.
 */
export interface GradeReport {
    // This is the text of the feedback (in markdown) that the container wants
    // to return to the user.
    feedback: string;

    // Report the grading status inside the container.
    // SUCCESS, FAIL_COMPILE, FAIL_LINT
    result: string;

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

    // The container can list files it generates here. Paths will be relative
    // to the mounted output directory for the container; use ContainerOutput::graderTaskId
    // to construct the URL path to retrieve the attachment from the Grader
    // service. Note: The Grader service may append additional attachments
    // after the container completes (e.g. stdio.txt).
    attachments: Attachment[];

    // Enables custom values to be returned to the UI layer.
    // PLEASE: do not store large objects in here or it will
    // significantly impact the performance of the dashboard.
    // Use attachments instead for large bits of data you wish
    // to persist.
    custom: any;

    studentTime?: number;
    publicTime?: number;
    privateTime?: number;
}

/**
 * Description of attachments that are saved in files on disk. This
 * helps minimize database size making it easier to back up and much
 * quicker to search and traverse (especially over the network).
 */
export interface Attachment {
    name: string; // file identifier attachment (e.g., stdio.txt)
    path: string; // path to file (including name)
    visibleToAdmin: boolean;
    visibleToStaff: boolean;
    visibleToStudent: boolean;
    visibleToPublic: boolean; // almost always false
    content_type: string;
}

export interface SingleClusterResult {
    allNames: string[];
    passNames: string[];
    failNames: string[];
    skipNames: string[];
    errorNames: string[];
}

export interface ClusteredResult {
    [cluster: string]: SingleClusterResult;
}
