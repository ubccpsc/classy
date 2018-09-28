/**
 * Primary data structure that the course container is invoked with.
 */
export interface ContainerInput {
    delivId: string; // Specifies what delivId the Grader should execute against.
    target: CommitTarget; // Details about the push event that led to this request.
    containerConfig: AutoTestConfig; // Container configuration details.
}

export interface CommitTarget {
    /**
     * The delivId the commit should be executed against. If the course does not
     * have a default id and one is not specified (e.g., in a commit comment)
     * we cannot create a CommitTarget.
     */
    delivId: string; // TODO: remove this from here? it's already in IContainerInput
    repoId: string;

    botMentioned: boolean; // true if explicitly mentioned
    personId: string | null; // string is Person.id if explicily invoked, null otherwise

    cloneURL: string;

    commitSHA: string;
    commitURL: string;

    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of push event

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
