import {AutoTestResult} from "../../../common/types/AutoTestTypes";
import {AutoTestConfig} from "../../../common/types/ContainerTypes";
import {AssignmentGrade, AssignmentInfo, AssignmentRepositoryInfo} from "../../../common/types/CS340Types";

/**
 * These types are the storage-specific types used by the backend.
 *
 * The types should never be exposed to portal-frontend; if you need to
 * transfer data between the backend and front end please use the
 * Transport types in portal-common.
 *
 * This strict separation is to allow us to more easily evolve
 * portal-backend without impacting portal-frontend.
 *
 */

/**
 * A goal of these types is to make it easier (and more efficient)
 * to perform the most common queries. These include:
 *
 * 1) List all students (easy, directly from people)
 * 2) List all teams and student members (easy, just join teams with people)
 * 3) List most recent results for a deliverable (easy, directly from results)
 * 3) List all results for a deliverable for each user
 *     Harder. Problem is we don't have a 1:1 mapping between repo and deliverable.
 *     Or maybe we just need to roll with this:
 *          Join person with Teams (on Person.id -> Teams.members) as t and to Repositories
 *          (t.id ->  Repository.teams) as r
 *          Iterate through each person record.
 *              Find all results for the desired delivId for any r above. Return for each person.
 *              This doesn't combine teams, but makes it so people won't be missed.
 *              Result: PersonRecord[]
 * 4) List most recent results for a team (3 above with date limit)
 * 5) List all people on a repo
 *      Join with Team with repo.teamIds then join with People using team.peopleIds
 *
 * G1) Store a new grade (easy, directly from Grade)
 *      * use grade.delivId & grade.personId to make sure there is only one of these records.
 *      * write or overwrite as needed
 *
 * R1) Store a new result (XXX THINKING IN PROGRESS)
 *      * result.delivId (needed to create a grade record)
 *      * result.repoId (needed to get a list of people to create grade records on (see #5 above,
 *      list all people on repo)
 */

export interface Person {
    readonly id: string; // primary key (this will duplicate csId or githubId (in CS it will always be csId))
    readonly csId: string;
    readonly studentNumber: number | null;
    githubId: string; // warning: this can change (e.g., if student updates their CWL)

    fName: string;
    lName: string;
    kind: PersonKind | null; // student, staff, admin (staff / admin taken from GitHub if kind is null)
    URL: string | null; // usually the person's GitHub profile URL; null when not yet validated

    labId: string | null; // null for non-students

    custom: {
        sdmmStatus?: string, // SDMM // TODO: make into sdmm.status
        myProp?: any // PersonControllerSpec
    };
}

/**
 * These are the kinds of Person. Using an enum for greater type checking flexibility.
 */
export enum PersonKind {
    NONE = "",
    STUDENT = "student",
    WITHDRAWN = "withdrawn", // typically a student who has left the class
    ADMINSTAFF = "adminstaff",
    ADMIN = "admin",
    STAFF = "staff"
}

export interface Auth {
    personId: string; // invariant
    token: string | null;
}

// NOTE: Intentionally not linked to Repository (see docs at top of file)
export interface Deliverable {
    readonly id: string; // primary key; invariant. this is the shortname of the deliverable (e.g., d1)
    URL: string; // links to the public deliverable description

    openTimestamp: number;
    closeTimestamp: number;
    gradesReleased: boolean; // whether students can see their grades

    visibleToStudents: boolean; // whether students even see the column

    rubric: any; // captures rubric-specific definitions
    // custom: any; // {}; not used by the default implementation, but useful for extension (e.g., schemas)
    custom: {
        rubric?: any, // CS340REST
        assignment?: AssignmentInfo // AssignmentController
        // courseWeight?: any, // AssignmentController // TODO: make into assignment.courseWeight
        // seedRepoURL?: any, // RubricController // TODO: make into rubric.seedRepoURL
        // seedRepoPath?: any, // RubricController // TODO: make into rubric.seedRepoPath
        // mainFilePath?: any // AssignmentController // TODO: make into assignment.mainFilePath
    };

    lateAutoTest: boolean; // whether the deliv can be executed after the deadline
    shouldAutoTest: boolean; // whether the deliv will use AutoTest
    autotest: AutoTestConfig;

    // these options are only set if shouldProvision is true
    shouldProvision: boolean; // whether the deliv is for provisioning at all; if not, the fields below are not needed
    repoPrefix: string | null; // prefix for repo names (e.g., project_ or d1_)
    teamPrefix: string | null; // prefix for team names (e.g., pTeam_ or d1Team_)
    importURL: string | null; // URL that should be cloned for the repos to be provisioned
    teamMinSize: number;
    teamMaxSize: number;
    teamSameLab: boolean;
    teamStudentsForm: boolean;
}

export interface Team {
    readonly id: string; // invariant; the name of the team. must be unique locally and on GitHub
    /**
     * The deliverable the team was provisioned for. Does _NOT_ influence what AutoTest can be
     * run against, but specifies the constraints placed upon the team (e.g., from the Deliverable).
     */
    readonly delivId: string; // invariant

    URL: string | null; // null when not yet created
    githubId: number | null; // null when not yet created
    personIds: string[]; // Person.id[] - foreign key
    // repoName: string | null;
    // repoUrl: string | null;

    // githubStatus: string; // NONE | CREATED | LINKED
    custom: {
        githubAttached?: boolean,

        sdmmd0?: boolean,
        sdmmd1?: boolean,
        sdmmd2?: boolean,
        sdmmd3?: boolean,
    };
}

// NOTE: Intentionally not linked to Deliverable (see docs at top of file)
export interface Repository {
    /**
     * The name of the repo; must be unique locally and on GitHub.
     */
    readonly id: string; // invariant
    /**
     * The deliverable the repository was provisioned for. This does not modify AutoTest
     * but is used to track provisioning.
     */
    readonly delivId: string; // invariant

    URL: string | null; // URL for project in version control system; null if not yet created
    cloneURL: string | null; // git clone URL for project; null if not yet created
    teamIds: string[]; // Team.id[] - foreign key

    // githubStatus: string; // NONE | CREATED

    custom: { // rather than having custom be .any, this allows courses to make sure they don't clash on their .custom parameters
        githubCreated?: boolean,
        githubReleased?: boolean,

        // status?: any, // AssignmentController // TODO: make into assignment.status
        // assignmentId?: any, // AssignmentController // TODO: make into assignment.id
        // assignedTeams?: any, // AssignmentController // TODO: make into assignment.assignedTeams

        assignmentInfo?: AssignmentRepositoryInfo,

        d0enabled?: boolean, // SDMM // TODO: make sdmm.d0enabled
        d1enabled?: boolean, // SDMM // TODO: make sdmm.d1enabled
        d2enabled?: boolean, // SDMM // TODO: make sdmm.d2enabled
        d3enabled?: boolean  // SDMM // TODO: make sdmm.d3enabled
        sddmD3pr?: boolean, // SDMM // TODO: make sdmm.d3pr
    };
}

/**
 * This is just a placeholder type to hold course-level data that can change.
 * (in contrast to course-level static data in the .env file)
 */
export interface Course {
    readonly id: string; // invariant; this is the name of the course
    defaultDeliverableId: string | null; // Deliverable.id foreign key
    custom: {
        status?: string
    };
}

export enum AuditLabel {
    COURSE = 'Course',
    DELIVERABLE = 'Deliverable',
    REPOSITORY = 'Repository',
    TEAM = 'TEAM',
    TEAM_ADMIN = 'TeamAdmin', // Created / updated by admin
    TEAM_STUDENT = 'TeamStudent', // Created / updated by student
    GRADE_ADMIN = 'GradeAdmin', // Created / updated by admin
    GRADE_CHANGE = 'Grade_Change',
    GRADE_AUTOTEST = 'GradeAutotest',
    REPO_PROVISION = 'RepositoryProvision',
    REPO_RELEASE = 'RepositoryRelease',
    CLASSLIST_UPLOAD = 'Classlist_Upload',
    CLASSLIST_PRUNE = 'Classlist_Prune'
}

export interface AuditEvent {
    label: string;
    timestamp: number;
    personId: string;
    before: object | null;
    after: object | null;
    custom: object; // enables easier querying
}

export interface Grade {
    // this should be the personId associated with the repo, not a staff who invoked it!
    readonly personId: string; // Person.id; grades are really on repos, but we only care about them by person
    readonly delivId: string; // Deliverable.id - foreign key // could be a Deliverable, but this is just easier

    score: number;
    comment: string;
    timestamp: number;

    urlName: string | null; // name associated with URL (e.g., project name)
    URL: string | null; // link to commit, if appropriate or repoUrl if not

    custom: any; // {}; not used by the default implementation, but useful for extension (e.g., custom grade values)
    /*
    custom: { // rather than having custom be .any, this allows courses to make sure they don't clash on their .custom parameters
        sdmmStatus?: boolean

        // questions?: any, // AssignmentController // TODO: make into assignment.questions
        // assignmentID?: any, // AssignmentController // TODO: make into assignment.id
        // studentID?: any, // AssignmentController // TODO: make into assignment.personId
        // released?: any, // AssignmentController // TODO: make into assignment.released
        assignmentGrade?: AssignmentGrade
    };
     */
}

export interface Result extends AutoTestResult { // TODO: define this without this extends. This import is no good!
    people: string[];
}
