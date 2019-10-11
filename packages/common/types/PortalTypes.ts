/**
 * Default portal types should be declared here.
 *
 * These are transport types to send data between the backend and the frontend.
 *
 * All fields should be primitives.
 */
import {AutoTestResult} from "./AutoTestTypes";
import {ClusteredResult} from "./ContainerTypes";

export interface FailurePayload {
    message: string;
    shouldLogout: boolean; // almost always false
}

export interface SuccessPayload {
    worked: boolean; // almost always true
    message?: string;
}

export interface Payload {
    success?: SuccessPayload | any; // only set if defined
    failure?: FailurePayload; // only set if defined
}

// Introduced to produce Classlist Change data - helps with understanding future
// manual/automatic repo provisioning after Classlist update
export interface ClasslistChangesTransport {
    updated: StudentTransport[];
    created: StudentTransport[];
    removed: StudentTransport[];
    classlist: StudentTransport[];
}

export interface ClasslistChangesTransportPayload {
    success?: ClasslistChangesTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface ConfigTransportPayload {
    success?: ConfigTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface ConfigTransport {
    org: string;
    name: string;
    githubAPI: string;
}

export interface CourseTransportPayload {
    success?: CourseTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface CourseTransport {
    id: string;
    defaultDeliverableId: string;
    custom: object;
}

export interface ProvisionTransport {
    delivId: string;
    // action: string; // PROVISION | RELEASE // should be embedded in the route
    formSingle: boolean;
}

export interface AuthTransportPayload {
    success?: AuthTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface AuthTransport {
    personId: string;
    token: string;
    isAdmin: boolean;
    isStaff: boolean;
}

export interface StudentTransportPayload {
    success?: StudentTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface StudentTransport {
    id: string;
    firstName: string;
    lastName: string;
    githubId: string;
    userUrl: string;
    studentNum: number;
    labId: string;
}

export interface DeliverableTransportPayload {
    success?: DeliverableTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface DeliverableTransport {
    id: string;
    openTimestamp: number;
    closeTimestamp: number;

    onOpenAction: string; // will change to something else
    onCloseAction: string; // will change to something else
    URL: string; // student-facing description
    gradesReleased: boolean;
    lateAutoTest: boolean;

    shouldAutoTest: boolean;
    autoTest: AutoTestConfigTransport; // autoTest options

    shouldProvision: boolean;
    repoPrefix: string | null;
    teamPrefix: string | null;
    minTeamSize: number; // must be > 0
    maxTeamSize: number; // leave at 1 for individual assignments
    teamsSameLab: boolean;
    studentsFormTeams: boolean;
    importURL: string | null;

    visibleToStudents: boolean;
    rubric: object;
    custom: object; // for schemas, etc.
}

export interface TeamTransportPayload {
    success?: TeamTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface TeamTransport {
    id: string;
    delivId: string;
    people: string[];
    URL: string | null;
    // repoName: string | null;
    // repoUrl: string | null;
}

export interface TeamFormationTransport {
    delivId: string;
    githubIds: string[];
}

export interface GradeTransportPayload {
    success?: GradeTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

/**
 * Do not use these directly; use subtypes instead.
 */
export interface BaseGradeTransport {
    delivId: string; // invariant: deliv grade is associated with

    score: number; // grade: < 0 will mean 'N/A' in the UI
    comment: string; // simple grades will just have a comment

    urlName: string | null; // description to go with the URL (repo if exists)
    URL: string | null; // commit URL if known, otherwise repo URL (commit / repo if exists)

    timestamp: number; // even if grade < 0 might as well return when the entry was made
    custom: any;
}

export interface GradeTransport extends BaseGradeTransport {
    personId: string; // invariant: person grade is for
    personURL: string;
}

export interface AutoTestGradeTransport extends BaseGradeTransport {
    repoId: string;
    repoURL: string;
}

export interface AutoTestConfigPayload {
    success?: AutoTestConfigTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

/**
 * AutoTest configuration details.
 * Requested per-deliverable.
 */
export interface AutoTestConfigTransport {

    /**
     * Name of docker image that should be invoked.
     */
    dockerImage: string;

    /**
     * Interval in seconds between student requests.
     * e.g., 43,200 (12 hours)
     */
    studentDelay: number;

    /**
     * Max time in seconds before the container should timeout.
     * e.g., 300 (5 mins)
     */
    maxExecTime: number;

    /**
     * Other deliverables that should be invoked against the container (can be empty array).
     * e.g., ['d1', 'd2'] for d3 of a project.
     */
    regressionDelivIds: string[];

    /**
     * This field is a convenient place to add parameters to the UI that will be passed to
     * AutoTest grading containers. This property is set in the AutoTest portion of the
     * Deliverable UI.
     *
     * A custom JSON object that will be passed to the container. Can be {}.
     *
     */
    custom: object;

    openTimestamp: number;

    closeTimestamp: number;

    /**
     * Whether AutoTest can be invoked after the closeTimestamp has passed
     */
    lateAutoTest: boolean;
}

export interface AutoTestAuthPayload {
    success?: AutoTestAuthTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

/**
 * AutoTest configuration details.
 * Requested per-deliverable.
 */
export interface AutoTestAuthTransport {
    personId: string;
    isStaff: boolean;
    isAdmin: boolean;
}

// export interface AutoTestDefaultDeliverablePayload {
//     success?: AutoTestDefaultDeliverableTransport; // only set if defined
//     failure?: FailurePayload; // only set if defined
// }

export interface ClassyConfigurationPayload {
    success?: ClassyConfigurationTransport; // only set if defined
    failure?: FailurePayload; // only set if defined
}

// /**
//  * AutoTest configuration details.
//  * Requested per-deliverable.
//  */
// export interface AutoTestDefaultDeliverableTransport {
//     defaultDeliverable: string;
// }

export interface ClassyConfigurationTransport {
    defaultDeliverable: string;
    deliverableIds: string[];
}

export interface AutoTestPersonIdTransport {
    personId: string | null;
}

export interface RepositoryPayload {
    success?: RepositoryTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface RepositoryTransport {
    id: string;
    URL: string;
    delivId: string;
}

export interface AutoTestResultPayload {
    success?: AutoTestResultTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

/* tslint:disable-next-line */ // This will get properties eventually
export interface AutoTestResultTransport extends AutoTestResult {
    // NOTE: this extends should go away, but is easiest right now
}

export interface AutoTestResultSummaryPayload {
    success?: AutoTestResultSummaryTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface AutoTestDashboardPayload {
    success?: AutoTestDashboardTransport[]; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface AutoTestResultSummaryTransport {
    repoId: string;
    repoURL: string;
    delivId: string;
    state: string;
    timestamp: number;
    commitSHA: string;
    commitURL: string;
    scoreOverall: number | null; // null if result !== 'SUCCESS'
    scoreCover: number | null; // null if result !== 'SUCCESS'
    scoreTests: number | null; // null if result !== 'SUCCESS'
}

// extends the result summary data
export interface AutoTestDashboardTransport extends AutoTestResultSummaryTransport {
    testPass: string[];
    testFail: string[];
    testSkip: string[];
    testError: string[];
    cluster?: ClusteredResult;
}

export interface ClasslistTransport {
    SNUM: string;
    FIRST: string;
    LAST: string;
    PREF: string;
    ACCT: string;
    CRS: string;
    CWL: string;
    SEC: string;
    LAB: string;
}
