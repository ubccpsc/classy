import { AutoTestResult } from "../../../common/src/types/AutoTestTypes";
import { AutoTestConfig } from "../../../common/src/types/ContainerTypes";

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
 *     Harder. Problem is we do not have a 1:1 mapping between repo and deliverable.
 *     Or maybe we just need to roll with this:
 *          Join person with Teams (on Person.id -> Teams.members) as t and to Repositories
 *          (t.id ->  Repository.teams) as r
 *          Iterate through each person record.
 *              Find all results for the desired delivId for any r above. Return for each person.
 *              This does not combine teams, but makes it so people will not be missed.
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
	URL: string | null; // usually the GitHub profile URL for the person; null when not yet validated

	labId: string | null; // null for non-students

	custom: {
		myProp?: any; // PersonControllerSpec
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
	STAFF = "staff",
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
	custom: any; // useful for extension

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

/**
 * How far a repository has been provisioned **on GitHub**.
 *
 * This describes GitHub's side of the world, not Classy's: NOT_CREATED means GitHub does not have
 * the repo, not that Classy is unaware of it -- the record you are reading exists either way.
 * Creating a Repository record does not create anything on GitHub.
 *
 * Each value is strictly further along than the one before it. Teams have their own vocabulary
 * (TeamStatus), because "linked" used to mean two different things depending on which object you
 * were holding.
 */
export enum RepoStatus {
	/**
	 * A Repository record exists; nothing exists on GitHub.
	 */
	NOT_CREATED = "NOT_CREATED",

	/**
	 * The repo exists on GitHub but is NOT usable yet: no webhook, no staff/admin teams. This is
	 * what a failed import or a failed finalization leaves behind, and provisioning such a repo
	 * again resumes at finalization rather than creating it a second time.
	 */
	CREATED = "CREATED",

	/**
	 * Finalized: the webhook and the staff/admin teams are attached. Students still cannot see it.
	 */
	READY = "READY",

	/**
	 * The student team is attached, so the students can see it.
	 */
	RELEASED = "RELEASED",
}

/**
 * How far a team has been provisioned **on GitHub**; see RepoStatus for what "on GitHub" means.
 */
export enum TeamStatus {
	/**
	 * A Team record exists; nothing exists on GitHub.
	 */
	NOT_CREATED = "NOT_CREATED",

	/**
	 * The GitHub team exists, but has not been added to a repository.
	 */
	CREATED = "CREATED",

	/**
	 * The team has been added to its repository.
	 */
	ATTACHED = "ATTACHED",
}

export interface Team {
	readonly id: string; // invariant; the name of the team. must be unique locally and on GitHub

	/**
	 * The deliverable the team was provisioned for. Does _NOT_ influence what AutoTest can be
	 * run against, but specifies the constraints placed upon the team (e.g., from the Deliverable).
	 */
	readonly delivId: string; // invariant

	/**
	 * The people associated with a team.
	 */
	personIds: string[]; // Person.id[] - foreign key

	/**
	 * The GitHub URL for the team.
	 *
	 * This should only be used to keep track of the team, not to compute its status
	 * (e.g., that the team has been provisioned on GitHub).
	 */
	URL: string | null;

	/**
	 * How far this team has been provisioned on GitHub.
	 *
	 * The single source of truth for that question: do not infer it from URL or githubId.
	 */
	gitHubStatus: TeamStatus;

	/**
	 * GitHub assigns a numeric value to team objects. Looking this up can be slow,
	 * especially for tasks where all team numbers are needed.
	 *
	 * DANGER: do not use as replacement for gitHubStatus!
	 */
	githubId: number | null;

	custom: {};
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

	/**
	 * Teams associated with the repo.
	 */
	teamIds: string[]; // Team.id[] - foreign key

	/**
	 * URL for project in version control system; null if not yet known.
	 *
	 * DANGER: do not use as replacement for gitHubStatus!
	 */
	URL: string | null;

	/**
	 * git clone URL for project; null if not yet known.
	 *
	 * DANGER: do not use as replacement for gitHubStatus!
	 */
	cloneURL: string | null; // git clone URL for project; null if not yet created

	/**
	 * How far this repository has been provisioned on GitHub.
	 *
	 * The single source of truth for that question: do not infer it from URL, cloneURL, or teamIds.
	 * URL is set when the repo is created on GitHub and cleared when it is deleted again, but it is
	 * informational -- nothing branches on it.
	 */
	gitHubStatus: RepoStatus;

	custom: {};
}

/**
 * This is just a placeholder type to hold course-level data that can change.
 * (in contrast to course-level static data in the .env file)
 */
export interface Course {
	readonly id: string; // invariant; this is the name of the course
	defaultDeliverableId: string | null; // Deliverable.id foreign key
	custom: {
		status?: string;
	};
}

/**
 * The lifecycle of a background Job.
 *
 * NOTE: INTERRUPTED is deliberately distinct from FAILED. FAILED means the handler threw and the work
 * is suspect; INTERRUPTED means the process died underneath a running job (a deploy, a crash) and the
 * work is simply unfinished. With `restart: always` in docker-compose, that happens routinely, and the
 * two need different responses: investigate a FAILED job, just re-run an INTERRUPTED one.
 */
export enum JobState {
	RUNNING = "RUNNING",
	SUCCEEDED = "SUCCEEDED",
	FAILED = "FAILED",
	CANCELLED = "CANCELLED",
	INTERRUPTED = "INTERRUPTED",
}

/**
 * A unit of long-running background work.
 *
 * Jobs exist because the proxy enforces `proxy_read_timeout 90`: any operation that cannot finish
 * inside 90s is cut off by nginx while the backend keeps working. Rather than have the browser drive
 * batches to stay under that ceiling, a Job runs in the backend and records its progress here, so the
 * request that starts it returns immediately and the tab can be closed.
 */
export interface Job {
	readonly id: string; // primary key
	readonly kind: string; // which handler runs this (e.g. "prairielearn-sync")

	state: JobState;
	readonly requestedBy: string; // Person.id of whoever started it; for audit
	readonly createdAt: number;

	startedAt: number | null;
	heartbeatAt: number | null; // advanced while running; used to detect a job whose process died
	completedAt: number | null;

	cancelRequested: boolean; // cooperative; the handler decides where it is safe to stop

	progress: {
		done: number;
		total: number;
		message: string;
	};

	summary: any; // kind-specific report, rendered in the admin UI
	errors: string[]; // BOUNDED; see JobController.MAX_ERRORS
	params: any; // kind-specific input
}

/**
 * How much of a job has completed got with one unit of work, so an interrupted or incremental run can resume.
 */
export interface JobWatermark {
	readonly kind: string; // which job wrote this row (e.g. "prairielearn-sync")
	readonly key: string; // identifies the unit of work, unique within the kind
	syncedAt: number;
}

export enum AuditLabel {
	COURSE = "Course",
	DELIVERABLE = "Deliverable",
	REPOSITORY = "Repository",
	TEAM = "TEAM",
	TEAM_ADMIN = "TeamAdmin", // Created / updated by admin
	TEAM_STUDENT = "TeamStudent", // Created / updated by student
	GRADE_ADMIN = "GradeAdmin", // Created / updated by admin
	GRADE_CHANGE = "Grade_Change",
	GRADE_AUTOTEST = "GradeAutotest",
	REPO_PROVISION = "RepositoryProvision",
	REPO_RELEASE = "RepositoryRelease",
	CLASSLIST_UPLOAD = "Classlist_Upload",
	STUDENT_WITHDRAW = "Student_Withdraw",
	CLASSLIST_PRUNE = "Classlist_Prune",
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

	// bucket grading can use this to store the bucket name
	custom: any; // {}; not used by the default implementation, but useful for extension (e.g., custom grade values)
}

export interface Result extends AutoTestResult {
	// TODO: define this without this extends. This import is no good!
	people: string[];
}

// same as IFeedbackGiven from AutoTestTypes
export interface FeedbackRecord {
	personId: string;
	delivId: string;
	timestamp: number;
	commitURL: string; // for information only
	kind: string; // "standard" | "check"
}
