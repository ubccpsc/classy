import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";

import { GradeReport } from "@common/types/ContainerTypes";
import {
	AutoTestDashboardTransport,
	AutoTestGradeTransport,
	AutoTestResultSummaryTransport,
	CourseTransport,
	DeliverableTransport,
	GradeTransport,
	ProvisionTransport,
	RepositoryTransport,
	StudentTransport,
	TeamTransport,
} from "@common/types/PortalTypes";
import Util from "@common/Util";
import { Factory } from "../Factory";
import { AuditLabel, Course, Deliverable, Grade, Person, PersonKind, RepoStatus, Repository, Result, Team, TeamStatus } from "../Types";
import { DatabaseController } from "./DatabaseController";
import { DeliverablesController } from "./DeliverablesController";
import { GitHubActions } from "./GitHubActions";
import { GitHubController, IGitHubController } from "./GitHubController";
import { GradesController } from "./GradesController";
import { JobContext } from "./JobController";
import { PersonController } from "./PersonController";
import { ProvisionFailurePolicy } from "./ProvisionFailurePolicy";
import { ProvisionState } from "./ProvisionState";
import { RepositoryController } from "./RepositoryController";
import { ResultsController, ResultsKind } from "./ResultsController";
import { TeamController } from "./TeamController";

export class AdminController {
	/**
	 * How many repos to provision at once.
	 *
	 * Provisioning is dominated by waiting on GitHub. 1 is serialized, but
	 * GitHub rate limits bound how high it can be in practice.
	 * If provisioning starts to throw 403 errros, it's too high.
	 */
	public static readonly PROVISION_CONCURRENCY = 4;

	protected dbc = DatabaseController.getInstance();
	protected pc = new PersonController();
	protected rc = new RepositoryController();
	protected tc = new TeamController();
	protected gc = new GradesController();
	protected resC = new ResultsController();
	// protected cc: ICourseController;
	protected gh: IGitHubController = null;

	public constructor(ghController: IGitHubController) {
		Log.trace("AdminController::<init>");
		this.gh = ghController;
	}

	/**
	 * Returns the name for this instance. Not defensive: If name is null or something goes wrong there will be errors all over.
	 *
	 * @returns {string | null}
	 */
	public static getName(): string | null {
		return Config.getInstance().getProp(ConfigKey.name);
	}

	/**
	 * Validates the CourseTransport object.
	 *
	 * @param {CourseTransport} courseTrans
	 * @returns {string | null} null if object is valid; string description of error if not.
	 */
	public static validateCourseTransport(courseTrans: CourseTransport): string | null {
		if (typeof courseTrans === "undefined" || courseTrans === null) {
			const msg = "Course not populated.";
			Log.error("AdminController::validateCourseTransport(..) - ERROR: " + msg);
			throw new Error(msg);
		}

		// noinspection SuspiciousTypeOfGuard
		if (typeof courseTrans.id !== "string") {
			const msg = "Course.id not specified";
			Log.error("AdminController::validateCourseTransport(..) - ERROR: " + msg);
			throw new Error(msg);
		}

		// noinspection SuspiciousTypeOfGuard
		if (typeof courseTrans.defaultDeliverableId !== "string") {
			const msg = "defaultDeliverableId not specified";
			Log.error("AdminController::validateCourseTransport(..) - ERROR: " + msg);
			return msg;
		}

		// noinspection SuspiciousTypeOfGuard
		if (typeof courseTrans.custom !== "object") {
			const msg = "custom not specified";
			Log.error("AdminController::validateCourseTransport(..) - ERROR: " + msg);
			return msg;
		}

		return null;
	}

	/**
	 * Returns null if the object is valid. This API is terrible.
	 *
	 * @param {ProvisionTransport} obj
	 * @returns {ProvisionTransport | null}
	 */
	public static validateProvisionTransport(obj: ProvisionTransport): ProvisionTransport | null {
		if (typeof obj === "undefined" || obj === null) {
			const msg = "Transport not populated.";
			Log.error("AdminController::validateProvisionTransport(..) - ERROR: " + msg);
			throw new Error(msg);
		}

		// noinspection SuspiciousTypeOfGuard
		if (typeof obj.delivId !== "string") {
			const msg = "Provision.id not specified";
			Log.error("AdminController::validateProvisionTransport(..) - ERROR: " + msg);
			throw new Error(msg);
		}

		// noinspection SuspiciousTypeOfGuard
		if (typeof obj.formSingle !== "boolean") {
			const msg = "formSingle not specified";
			Log.error("AdminController::validateProvisionTransport(..) - ERROR: " + msg);
			throw new Error(msg);
		}

		return null;
	}

	/**
	 * Processes the new autotest grade. Only returns true if the grade was accepted and saved.
	 *
	 * @param {AutoTestGradeTransport} grade
	 * @returns {Promise<boolean>} Whether the new grade was saved
	 */
	public async processNewAutoTestGrade(grade: AutoTestGradeTransport): Promise<boolean> {
		Log.trace("AdminController::processNewAutoTestGrade(..) - start");

		const cc = await Factory.getCourseController(this.gh);

		try {
			Log.trace("AdminController::processNewAutoTestGrade(..) - payload: " + JSON.stringify(grade));
			const repo = await this.rc.getRepository(grade.repoId);
			if (repo === null) {
				// sanity check
				Log.error("AdminController::processNewAutoTestGrade(..) - invalid repo name: " + grade.repoId);
				return false;
			}

			const peopleIds = await this.rc.getPeopleForRepo(grade.repoId);
			if (peopleIds.length < 1) {
				// sanity check
				Log.error("AdminController::processNewAutoTestGrade(..) - no people to associate grade record with.");
				return false;
			}

			Log.trace("AdminController::processNewAutoTestGrade(..) - getting deliv"); // NOTE: for hangup debugging

			const delivController = new DeliverablesController();
			const deliv = await delivController.getDeliverable(grade.delivId);

			let saved = false;

			for (const personId of peopleIds) {
				const newGrade: Grade = {
					personId: personId,
					delivId: grade.delivId,
					score: grade.score,
					comment: grade.comment,
					urlName: grade.urlName,
					URL: grade.URL,
					timestamp: grade.timestamp,
					custom: grade.custom,
				};

				Log.trace("AdminController::processNewAutoTestGrade(..) - getting grade for " + personId);
				const existingGrade = await this.gc.getGrade(personId, grade.delivId);
				const existingGradeScore = existingGrade?.score ? existingGrade.score : "N/A";
				Log.trace(
					"AdminController::processNewAutoTestGrade(..) - handling grade for " +
						personId +
						"; repo: " +
						grade.repoId +
						"; existingGrade: " +
						existingGradeScore +
						"; newGrade: " +
						newGrade.score
				);
				const shouldSave = await cc.handleNewAutoTestGrade(deliv, newGrade, existingGrade);
				// Log.trace("AdminController::processNewAutoTestGrade(..) - handled grade for " + personId +
				//     "; shouldSave: " + shouldSave); // NOTE: for hangup debugging

				Log.trace(
					"AdminController::processNewAutoTestGrade(..) - grade: " +
						JSON.stringify(newGrade) +
						"; repoId: " +
						grade.repoId +
						"; shouldSave: " +
						shouldSave
				);

				if (shouldSave === true) {
					Log.info(
						"AdminController::processNewAutoTestGrade(..) - saving grade for deliv: " + newGrade.delivId + "; repo: " + grade.repoId
					);
					await this.dbc.writeAudit(AuditLabel.GRADE_AUTOTEST, "AutoTest", existingGrade, newGrade, { repoId: grade.repoId });
					await this.gc.saveGrade(newGrade);
					saved = true;
				}
			}
			return saved;
		} catch (err) {
			Log.error("AdminController::processNewAutoTestGrade(..) - ERROR: " + err);
			return false;
		}
	}

	public async getCourse(): Promise<Course> {
		let record: Course = await this.dbc.getCourseRecord();
		if (record === null) {
			// create default and write it
			record = {
				id: Config.getInstance().getProp(ConfigKey.name),
				defaultDeliverableId: null,
				custom: {},
			};
			await this.dbc.writeCourseRecord(record);
		}
		return record;
	}

	public async saveCourse(course: Course): Promise<boolean> {
		const record: Course = await this.dbc.getCourseRecord();
		if (record !== null) {
			// merge the new with the old
			record.defaultDeliverableId = course.defaultDeliverableId;
			record.custom = Object.assign({}, record.custom, course.custom); // merge custom properties
		}
		return await this.dbc.writeCourseRecord(record);
	}

	/**
	 * Gets the students associated with the course. Admins, staff, and withdrawn students are not included.
	 *
	 * @returns {Promise<StudentTransport[]>}
	 */
	public async getStudents(): Promise<StudentTransport[]> {
		const people = await this.pc.getAllPeople();

		const students: StudentTransport[] = [];
		for (const person of people) {
			if (person.kind === PersonKind.STUDENT || person.kind === null) {
				// null should be set on first login
				const studentTransport = {
					id: person.id,
					firstName: person.fName,
					lastName: person.lName,
					githubId: person.githubId,
					userUrl: Config.getInstance().getProp(ConfigKey.githubHost) + "/" + person.githubId,
					studentNum: person.studentNumber,
					labId: person.labId,
				};
				students.push(studentTransport);
			}
		}
		return students;
	}

	/**
	 * Gets the staff associated with the course.
	 *
	 * @returns {Promise<StudentTransport[]>}
	 */
	public async getStaff(): Promise<StudentTransport[]> {
		const people = await this.pc.getAllPeople();

		const adminStaff: StudentTransport[] = [];
		for (const person of people) {
			if (person.kind === PersonKind.ADMIN || person.kind === PersonKind.STAFF || person.kind === PersonKind.ADMINSTAFF) {
				const isAdmin = person.kind === PersonKind.ADMIN || person.kind === PersonKind.ADMINSTAFF;
				const isStaff = person.kind === PersonKind.STAFF || person.kind === PersonKind.ADMINSTAFF;

				const studentTransport = {
					id: person.id,
					firstName: person.fName,
					lastName: person.lName,
					githubId: person.githubId,
					userUrl: Config.getInstance().getProp(ConfigKey.githubHost) + "/" + person.githubId,
					studentNum: person.studentNumber,
					labId: person.labId,
					kind: person.kind,
					isAdmin,
					isStaff,
				};
				adminStaff.push(studentTransport);
			}
		}
		return adminStaff;
	}

	/**
	 * Gets the teams associated with the course.
	 *
	 * @returns {Promise<TeamTransport[]>}
	 */
	public async getTeams(): Promise<TeamTransport[]> {
		const allTeams = await this.tc.getAllTeams();
		const teams: TeamTransport[] = [];
		for (const team of allTeams) {
			const teamTransport: TeamTransport = {
				id: team.id,
				delivId: team.delivId,
				people: team.personIds,
				URL: team.URL,
			};
			teams.push(teamTransport);
		}
		return teams;
	}

	/**
	 * Gets the repos associated with the course.
	 *
	 * @returns {Promise<RepositoryTransport[]>}
	 */
	public async getRepositories(): Promise<RepositoryTransport[]> {
		const allRepos = await this.rc.getAllRepos();
		const repos: RepositoryTransport[] = [];
		for (const repo of allRepos) {
			const repoTransport: RepositoryTransport = {
				id: repo.id,
				URL: repo.URL,
				delivId: repo.delivId,
				gitHubStatus: repo.gitHubStatus.toString(),
			};
			repos.push(repoTransport);
		}
		return repos;
	}

	/**
	 * Gets the grades associated with the course.
	 *
	 * @returns {Promise<GradeTransport[]>}
	 */
	public async getGrades(): Promise<GradeTransport[]> {
		Log.info("AdminController::getGrades() - start");
		const start = Date.now();
		const allGrades = await this.gc.getAllGrades();
		Log.trace("AdminController::getGrades() - getting grades took: " + Util.took(start));

		let part = Date.now();
		const grades: GradeTransport[] = [];
		const pc = new PersonController();
		const allPeople = await pc.getAllPeople(); // just make this query once
		Log.trace("AdminController::getGrades() - getting people took: " + Util.took(part));

		part = Date.now();
		for (const grade of allGrades) {
			const p = allPeople.find((person) => person.id === grade.personId);
			const gradeTrans: GradeTransport = {
				personId: grade.personId,
				personURL: Config.getInstance().getProp(ConfigKey.githubHost) + "/" + p.githubId,
				delivId: grade.delivId,
				score: grade.score,
				comment: grade.comment,
				urlName: grade.urlName,
				URL: grade.URL,
				timestamp: grade.timestamp,
				custom: grade.custom,
			};
			grades.push(gradeTrans);
		}

		Log.trace("AdminController::getGrades() - post-processing took: " + Util.took(part));

		Log.info("AdminController::getGrades() - done; took: " + Util.took(start));
		return grades;
	}

	/**
	 * Gets the results associated with the course.
	 * @param reqDelivId ("any" for *)
	 * @param reqRepoId ("any" for *)
	 * @param maxNumResults (optional, default 500)
	 * @param kind
	 * @returns {Promise<AutoTestGradeTransport[]>}
	 */
	public async getDashboard(
		reqDelivId: string,
		reqRepoId: string,
		maxNumResults?: number,
		kind: ResultsKind = ResultsKind.ALL
	): Promise<AutoTestDashboardTransport[]> {
		Log.info("AdminController::getDashboard( " + reqDelivId + ", " + reqRepoId + ", " + maxNumResults + " ) - start");
		const start = Date.now();
		const NUM_RESULTS = maxNumResults ? maxNumResults : 500; // max # of records

		const repoIds: string[] = [];
		const results: AutoTestDashboardTransport[] = [];
		const allResults = await this.matchResults(reqDelivId, reqRepoId, kind);
		for (const result of allResults) {
			const repoId = result.input.target.repoId;
			if (results.length < NUM_RESULTS) {
				const resultTrans = await this.createDashboardTransport(result);
				// just return the first result for a repo, unless they are specified
				if (reqRepoId !== "any" || repoIds.indexOf(repoId) < 0) {
					results.push(resultTrans);
					repoIds.push(repoId);
				}
			} else {
				// result does not match filter
			}
		}
		Log.info("AdminController::getDashboard(..) - # results: " + results.length + "; took: " + Util.took(start));
		return results;
	}

	public async matchResults(reqDelivId: string, reqRepoId: string, kind: ResultsKind): Promise<Result[]> {
		Log.trace("AdminController::matchResults(..) - start");
		const start = Date.now();
		const WILDCARD = "any";

		let allResults: Result[];
		if (reqRepoId !== WILDCARD) {
			// if both are not "any" just use this one too
			// ResultsKind not supported for getAllResults(..)
			allResults = await this.resC.getResultsForRepo(reqRepoId);
		} else if (reqDelivId !== WILDCARD) {
			allResults = await this.resC.getResultsForDeliverable(reqDelivId, kind);
		} else {
			// ResultsKind not supported for getAllResults(..)
			allResults = await this.resC.getAllResults();
		}
		Log.trace("AdminController::matchResults(..) - search done; # results: " + allResults.length + "; took: " + Util.took(start));

		const NUM_RESULTS = 1000;

		const results: Result[] = [];
		for (const result of allResults) {
			// const repo = await rc.getRepository(result.repoId); // this happens a lot and ends up being too slow
			const delivId = result.delivId;
			const repoId = result.input.target.repoId;

			if (
				(reqDelivId === WILDCARD || delivId === reqDelivId) &&
				(reqRepoId === WILDCARD || repoId === reqRepoId) &&
				results.length <= NUM_RESULTS
			) {
				results.push(result);
			} else {
				// result does not match filter
			}
		}

		Log.trace("AdminController::matchResults(..) - done; # results: " + results.length + "; took: " + Util.took(start));
		return results;
	}

	/**
	 * Gets the list of GitHub ids associated with the "students" team on GitHub
	 * and marks them as PersonKind.WITHDRAWN. Does nothing if the students team
	 * does not exist or is empty.
	 *
	 * @param requesterId Person.id of whoever asked; audited. Null skips the audit record.
	 * @param ctx when this runs as a job: for progress
	 * @returns {Promise<string>} a human-readable summary
	 */
	public async performStudentWithdraw(requesterId: string = null, ctx: JobContext = null): Promise<string> {
		Log.info("AdminController::performStudentWithdraw() - start");
		await ctx?.progress(0, 0, "reading the students team from GitHub");
		const gha = GitHubActions.getInstance(true);
		// const tc = new TeamController();
		// const teamNum = await tc.getTeamNumber("students"); // await gha.getTeamNumber("students");
		// const registeredGithubIds = await gha.getTeamMembers(teamNum);
		const registeredGithubIds = await gha.getTeamMembers("students");

		if (registeredGithubIds.length > 0) {
			await ctx?.progress(0, registeredGithubIds.length, "marking withdrawn students");
			const pc = new PersonController();
			const msg = await pc.markStudentsWithdrawn(registeredGithubIds);
			Log.info("AdminController::performStudentWithdraw() - done; msg: " + msg);
			await ctx?.progress(registeredGithubIds.length, registeredGithubIds.length, msg);

			if (requesterId !== null) {
				await this.dbc.writeAudit(AuditLabel.STUDENT_WITHDRAW, requesterId, {}, {}, { message: msg });
			}
			return msg;
		} else {
			throw new Error("No students specified in the students team on GitHub; operation aborted.");
		}
	}

	/**
	 * Gets the results associated with the course.
	 * @param reqDelivId ("any" for *)
	 * @param reqRepoId ("any" for *)
	 * @param kind
	 * @returns {Promise<AutoTestGradeTransport[]>}
	 */
	public async getResults(
		reqDelivId: string,
		reqRepoId: string,
		kind: ResultsKind = ResultsKind.ALL
	): Promise<AutoTestResultSummaryTransport[]> {
		Log.info("AdminController::getResults( " + reqDelivId + ", " + reqRepoId + ", " + kind + " ) - start");
		const start = Date.now();
		const NUM_RESULTS = 1000; // max # of records

		const results: AutoTestResultSummaryTransport[] = [];
		const allResults = await this.matchResults(reqDelivId, reqRepoId, kind);
		for (const result of allResults) {
			// const repo = await rc.getRepository(result.repoId); // this happens a lot and ends up being too slow
			// const repoId = result.input.target.repoId;
			if (results.length <= NUM_RESULTS) {
				const resultTrans = await this.clipAutoTestResult(result);
				results.push(resultTrans);
			} else {
				// result does not match filter
			}
		}
		Log.info(
			"AdminController::getResults( " +
				reqDelivId +
				", " +
				reqRepoId +
				", " +
				kind +
				") - done; # results: " +
				results.length +
				"; took: " +
				Util.took(start)
		);
		return results;
	}

	/**
	 * Gets the deliverables associated with the course.
	 *
	 * @returns {Promise<DeliverableTransport[]>}
	 */
	public async getDeliverables(): Promise<DeliverableTransport[]> {
		const deliverables = await this.dbc.getDeliverables();
		const start = Date.now();
		Log.trace("AdminController::getDeliverables() - start");

		let delivs: DeliverableTransport[] = [];
		for (const deliv of deliverables) {
			const delivTransport = DeliverablesController.deliverableToTransport(deliv);

			delivs.push(delivTransport);
		}

		delivs = delivs.sort(function (d1: DeliverableTransport, d2: DeliverableTransport) {
			return d1.id.localeCompare(d2.id);
		});

		Log.trace("AdminController::getDeliverables() - done; # delivs: " + delivs.length + "; took: " + Util.took(start));
		return delivs;
	}

	/**
	 * This plans the repo provisioning process. Planning is separated from doing so
	 * that course staff can look at the repos being proposed and have the opportunity
	 * to provision a subset of repos if they wish (e.g., for testing before creating
	 * all of them).
	 *
	 * @param {Deliverable} deliv
	 * @param {boolean} formSingleTeams specify whether singletons should be allocated into teams.
	 * Choose false if you want to wait for the students to specify, choose true if you want to
	 * let them work individually. (Note: if your teams are of max size 1, you still need to say
	 * yes to make this happen.)
	 *
	 * @returns {Promise<RepositoryTransport[]>}
	 */
	public async prepareProvision(deliv: Deliverable, formSingleTeams: boolean, ctx: JobContext = null): Promise<RepositoryTransport[]> {
		Log.info("AdminController::prepareProvision( " + deliv.id + ", " + formSingleTeams + " ) - start");
		await ctx?.progress(0, 0, deliv.id + ": reading people and teams");
		const cc = await Factory.getCourseController(this.gh);

		let allPeople: Person[] = await this.pc.getAllPeople();
		Log.info("AdminController::prepareProvision( .. ) - # people (all): " + allPeople.length);

		// remove all withdrawn people, we do not need to provision these
		allPeople = allPeople.filter((person) => person.kind !== PersonKind.WITHDRAWN);
		Log.info("AdminController::prepareProvision( .. ) - # people (not withdrawn): " + allPeople.length);

		// teams were either formed by students (or the admin in the UI)
		// _or_ the deliv is for single students and we will form them below
		let allTeams: Team[] = await this.tc.getAllTeams();
		Log.info("AdminController::prepareProvision( .. ) - # teams: " + allTeams.length);

		// just for logging, will remove with filter below
		for (const team of allTeams) {
			if (team.personIds.length < 1) {
				Log.warn("AdminController::prepareProvision(..) - team has no people: " + team.id);
			}
		}

		// remove teams that have no people
		allTeams = allTeams.filter((team) => team.personIds.length > 0);
		Log.info("AdminController::prepareProvision(..) - # teams after removing teams without people: " + allTeams.length);

		if (deliv.teamMaxSize === 1) {
			formSingleTeams = true;
			Log.info("AdminController::prepareProvision(..) - team maxSize 1: formSingleTeams forced to true");
		} else {
			Log.info("AdminController::prepareProvision(..) - team maxSize > 1: formSingleTeams not forced");
		}

		const delivTeams: Team[] = [];
		for (const team of allTeams) {
			if (team === null || deliv === null || team.id === null || deliv.id === null) {
				// seeing this during 310 provisioning, need to figure this out
				Log.error(
					"AdminController::prepareProvision(..) - ERROR! null team: " + JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv)
				);
			} else {
				if (team.delivId === deliv.id) {
					Log.info("AdminController::prepareProvision(..) - adding team: " + team.id + " to delivTeams");
					delivTeams.push(team);
				}
			}
		}
		Log.info("AdminController::prepareProvision(..) - # deliv teams: " + delivTeams.length);

		// remove any people who are already on teams
		for (const team of delivTeams) {
			for (const personId of team.personIds) {
				const index = allPeople
					.map(function (p: Person) {
						return p.id;
					})
					.indexOf(personId);
				if (index >= 0) {
					Log.info("AdminController::prepareProvision(..) - person already on team: " + personId + " ( team: " + team.id + " )");
					allPeople.splice(index, 1);
				} else {
					Log.warn("AdminController::prepareProvision(..) - allPeople does not contain: " + personId);
					const person = await this.pc.getPerson(personId);
					if (person !== null) {
						Log.warn("AdminController::prepareProvision(..) - person details: " + JSON.stringify(person));
					} else {
						Log.warn("AdminController::prepareProvision(..) - person is not in database");
					}
				}
			}
		}
		Log.trace("AdminController::prepareProvision(..) - # people not on teams: " + allPeople.length);

		if (formSingleTeams === true) {
			// now create teams for individuals
			Log.info("AdminController::prepareProvision(..) - handling single teams");
			for (const individual of allPeople) {
				try {
					const name = await cc.computeNames(deliv, [individual]);
					const team = await this.tc.formTeam(name.teamName, deliv, [individual], false);
					delivTeams.push(team);
				} catch (err) {
					Log.error("AdminController::prepareProvision(..) - single team creation ERROR: " + err.message);
				}
			}
			Log.info("AdminController::prepareProvision(..) - single teams done");
		}

		Log.info("AdminController::prepareProvision(..) - # delivTeams after individual teams added: " + delivTeams.length);

		const reposToProvision: Repository[] = [];
		// now process the teams to create their repos
		let prepared = 0;
		for (const delivTeam of delivTeams) {
			Log.info("AdminController::prepareProvision(..) - preparing to provision team: " + delivTeam.id);
			prepared++;
			if (prepared % 25 === 0) {
				await ctx?.progress(prepared, delivTeams.length, deliv.id + ": preparing teams and repositories");
			}

			const people: Person[] = [];
			for (const pId of delivTeam.personIds) {
				people.push(await this.pc.getPerson(pId));
			}
			Log.trace("AdminController::prepareProvision(..) - preparing to provision pIds: " + JSON.stringify(delivTeam.personIds));
			if (delivTeam.personIds.length !== people.length) {
				Log.warn("AdminController::prepareProvision(..) - preparing to provision missing people; people: " + JSON.stringify(people));
			}

			const names = await cc.computeNames(deliv, people);

			Log.info(
				"AdminController::prepareProvision(..) - delivTeam: " +
					delivTeam.id +
					"; computed team: " +
					names.teamName +
					"; computed repo: " +
					names.repoName
			);

			const team = await this.tc.getTeam(names.teamName);
			let repo = await this.rc.getRepository(names.repoName);

			if (team === null) {
				// sanity checking team must not be null given what we have done above (should never happen)
				throw new Error("AdminController::prepareProvision(..) - team unexpectedly null: " + name); // s.teamName);
			}

			if (repo === null) {
				repo = await this.rc.createRepository(names.repoName, deliv, [team], {});
			}

			if (repo === null) {
				// sanity checking repo must not be null given what we have done above (should never happen)
				throw new Error("AdminController::prepareProvision(..) - repo unexpectedly null: " + names.repoName); // names.repoName);
			}

			// /* istanbul ignore if */
			// if (typeof repo.custom.githubCreated !== "undefined" && repo.custom.githubCreated === true && repo.URL === null) {
			//     // HACK: this is just for dealing with inconsistent databases
			//     // This whole block should be removed in the future
			//     Log.warn("AdminController::prepareProvision(..) - repo URL should not be null: " + repo.id);
			//     const config = Config.getInstance();
			//     repo.URL = config.getProp(ConfigKey.githubHost) + "/" + config.getProp(ConfigKey.org) + "/" + repo.id;
			//     await this.dbc.writeRepository(repo);
			// }

			reposToProvision.push(repo);
			Log.info("AdminController::prepareProvision(..) - team planning done for team: " + delivTeam.id);
		}

		Log.info("AdminController::prepareProvision(..) - # repos to provision: " + reposToProvision.length);

		const repoTrans: RepositoryTransport[] = [];
		for (const repo of reposToProvision) {
			const newRepo = { delivId: deliv.id, id: repo.id, URL: repo.URL, gitHubStatus: repo.gitHubStatus.toString() };
			repoTrans.push(newRepo);
		}

		return repoTrans;
	}

	/**
	 * The repositories that exist for a deliverable, and whether GitHub knows about them yet.
	 *
	 * This read-only action enables planning without building team/repo objects.
	 *
	 * @param {Deliverable} deliv
	 * @returns {Promise<RepositoryTransport[]>}
	 */
	public async listProvisionState(deliv: Deliverable): Promise<RepositoryTransport[]> {
		Log.info("AdminController::listProvisionState( " + deliv.id + " ) - start");
		const start = Date.now();

		const allRepos = await this.rc.getAllRepos();
		const repos = allRepos.filter((repo) => repo.delivId === deliv.id);

		Log.info("AdminController::listProvisionState( " + deliv.id + " ) - # repos: " + repos.length + "; took: " + Util.took(start));
		return repos.map((repo) => RepositoryController.repositoryToTransport(repo));
	}

	/**
	 * Creates the GitHub side of the provided repositories. Only provisions those that
	 * have not already been configured (e.g., their URL field is null).
	 *
	 * Does not release the repos to the students (e.g., the student team is not attached
	 * to the repository; this should be done with performRelease). Released repos will
	 * have their Team.URL fields set. e.g., creating the repo sets Repository.URL; releasing
	 * the repo sets Team.URL (for the student teams associated with the repo).
	 *
	 * @param {Repository[]} repos
	 * @param {string} importURL
	 * @returns {Promise<Repository[]>}
	 */
	public async performProvision(
		repos: Repository[],
		importURL: string,
		concurrency?: number,
		ctx: JobContext = null
	): Promise<RepositoryTransport[]> {
		const ghc = this.gh;
		const cc = await Factory.getCourseController(this.gh);

		if (typeof concurrency === "undefined") {
			concurrency = AdminController.PROVISION_CONCURRENCY;
		}

		const batchStart = Date.now();
		Log.info(
			"AdminController::performProvision(..) - start; # repos: " +
				repos.length +
				"; concurrency: " +
				concurrency +
				"; importURL: " +
				importURL
		);
		const provisionedRepos: Repository[] = [];

		// NOTE: provisioning each repo is independent, and each one is dominated by waiting on
		// GitHub, so they are run with bounded concurrency rather than strictly one at a time.
		// The cap matters: GitHub applies secondary rate limits to bursts of concurrent writes.
		let done = 0;
		const policy = new ProvisionFailurePolicy("provisioning");

		await Util.processConcurrently(repos, concurrency, async (repo: Repository) => {
			// one repository is the unit of work: a repo is never abandoned half-created, and
			// re-running provisions whatever is still NOT_PROVISIONED
			if (ctx?.isCancelled() === true) {
				return;
			}
			try {
				const start = Date.now();
				Log.info("AdminController::performProvision(..) ***** START *****; repo: " + repo.id);
				// CREATED repos exist on GitHub but were never finalized; provisioning resumes there
				if (repo.gitHubStatus === RepoStatus.NOT_CREATED || repo.gitHubStatus === RepoStatus.CREATED) {
					const futureTeams: Array<Promise<Team>> = repo.teamIds.map((teamId) => this.dbc.getTeam(teamId));
					const teams: Team[] = await Promise.all(futureTeams);
					Log.trace("AdminController::performProvision(..) - about to provision: " + repo.id);
					let success = await ghc.provisionRepository(repo.id, teams, importURL);
					success = success && (await cc.finalizeProvisionedRepo(repo, teams));
					Log.trace("AdminController::performProvision(..) - provisioned: " + repo.id + "; success: " + success);

					if (success === true) {
						Log.trace("AdminController::performProvision(..) - success: " + repo.id + "; URL: " + repo.URL);
						provisionedRepos.push(repo);
						policy.recordSuccess();
					} else {
						Log.warn("AdminController::performProvision(..) - provision FAILED: " + repo.id + "; URL: " + repo.URL);
						const stop = policy.recordFailure(null);
						if (stop !== null) {
							policy.abort(stop);
						}
					}

					Log.info("AdminController::performProvision(..) ***** DONE *****; repo: " + repo.id + "; took: " + Util.took(start));
				} else {
					Log.info("AdminController::performProvision(..) - skipped; already provisioned: " + repo.id + "; URL: " + repo.URL);
				}
			} catch (err) {
				// NOTE: deliberately not rethrown. This used to stop every remaining repo from being
				// scheduled, which was survivable when the browser drove one small batch at a time,
				// but as a single job one bad repo would abandon the whole class. The failure is
				// recorded and the run continues; re-running retries only what is still
				// NOT_PROVISIONED.
				Log.error("AdminController::performProvision(..) - FAILED: " + repo.id + "; URL: " + repo.URL + "; ERROR: " + err.message);
				await ctx?.error(repo.id + ": " + err.message);

				// ...unless continuing is pointless: a failure that is about GitHub rather than about
				// this repo, or a pattern that says the whole run is not going to work. Throwing here
				// is what stops processConcurrently from scheduling anything further.
				const stop = policy.recordFailure(err);
				if (stop !== null) {
					policy.abort(stop);
				}
			}
			done++;
			// the deliverable is in the message so the admin UI can say which one is running: only
			// one provisioning job runs at a time, whichever deliverable started it
			await ctx?.progress(done, repos.length, repo.delivId + ": " + repo.id);
		});

		Log.info(
			"AdminController::performProvision(..) - done; # provisioned: " +
				provisionedRepos.length +
				" of " +
				repos.length +
				"; concurrency: " +
				concurrency +
				"; took: " +
				Util.took(batchStart)
		);

		const provisionedRepositoryTransport: RepositoryTransport[] = [];
		for (const repo of provisionedRepos) {
			provisionedRepositoryTransport.push(RepositoryController.repositoryToTransport(repo));
		}
		return provisionedRepositoryTransport;
	}

	/**
	 * Plans the releasing activity for attaching teams to their respective provisioned repositories.
	 *
	 * NOTE: this does _not_ provision the repos, or release them. It just creates a plan.
	 *
	 * @param {Deliverable} deliv
	 * @returns {Promise<RepositoryTransport[]>}
	 */
	public async planRelease(deliv: Deliverable): Promise<Repository[]> {
		Log.info("AdminController::planRelease( " + deliv.id + " ) - start");
		const cc = await Factory.getCourseController(this.gh);

		let allTeams: Team[] = await this.tc.getAllTeams();
		Log.trace("AdminController::planRelease( " + deliv.id + " ) - # teams: " + allTeams.length);

		// remove teams that have no people as they don't need to be released
		// just for logging, will remove with filter below
		for (const team of allTeams) {
			if (team.personIds.length < 1) {
				Log.warn("AdminController::planRelease(..) - team has no people: " + team.id);
			}
		}

		// remove teams that have no people
		allTeams = allTeams.filter((team) => team.personIds.length > 0);
		Log.info("AdminController::planRelease(..) - # teams after removing teams without people: " + allTeams.length);

		const delivTeams: Team[] = [];
		for (const team of allTeams) {
			if (team === null || deliv === null || team.id === null || deliv.id === null) {
				// seeing this during 310 provisioning, need to figure this out
				Log.error("AdminController::planRelease(..) - ERROR! null team: " + JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv));
			} else {
				if (team.delivId === deliv.id) {
					Log.trace("AdminController::planRelease(..) - adding team: " + team.id + " to delivTeams");
					delivTeams.push(team);
				}
			}
		}

		Log.info("AdminController::planRelease( " + deliv.id + " ) - # deliv teams: " + delivTeams.length);
		const reposToRelease: Repository[] = [];
		const reposAlreadyReleased: Repository[] = [];
		for (const team of delivTeams) {
			try {
				Log.trace("AdminController::planRelease( " + deliv.id + " ) - processing team: " + team.id);

				// get repo for team
				const people: Person[] = [];
				for (const pId of team.personIds) {
					people.push(await this.dbc.getPerson(pId));
				}
				const names = await cc.computeNames(deliv, people);
				const repo = await this.dbc.getRepository(names.repoName);

				/* istanbul ignore else */
				// if (typeof team.custom.githubAttached === "undefined" || team.custom.githubAttached === false) {
				if (team.gitHubStatus === TeamStatus.CREATED) {
					/* istanbul ignore else */
					// if (repo !== null && typeof repo.custom.githubCreated !== "undefined" && repo.custom.githubCreated === true) {
					if (repo !== null && repo.gitHubStatus === RepoStatus.READY) {
						// repo exists and has been provisioned: this is important as teams may have formed that have not been provisioned
						// aka only release provisioned repos
						reposToRelease.push(repo);
					} else {
						Log.info("AdminController::planRelease( " + deliv.id + " ) - repo not provisioned yet: " + JSON.stringify(team.personIds));
					}
				} else {
					Log.info("AdminController::planRelease( " + deliv.id + " ) - skipping team: " + team.id + "; already attached");
					reposAlreadyReleased.push(repo);
				}
			} catch (err) {
				/* istanbul ignore next: curlies needed for ignore */
				{
					Log.error("AdminController::planRelease(..) - ERROR: " + err.message);
					Log.exception(err);
				}
			}
			Log.trace("AdminController::planRelease( " + deliv.id + " ) - done team processing: " + team.id);
		}

		Log.info("AdminController::planRelease( " + deliv.id + " ) - # repos in release plan: " + reposToRelease.length);

		// This used to overwrite gitHubStatus on the way out, to "denote that repo has not been
		// released yet" -- a read path assigning status, so what the admin UI displayed was not always
		// what the database held. The repos below already carry the right status (READY when they can
		// be released, RELEASED when they already have been), so they are returned as they are.
		return reposAlreadyReleased.concat(reposToRelease);
	}

	public async performRelease(repos: Repository[], ctx: JobContext = null): Promise<RepositoryTransport[]> {
		const ghc = this.gh; // see performProvision

		Log.info("AdminController::performRelease(..) - start; # repos: " + repos.length);
		const start = Date.now();

		const releasedRepos = [];
		let done = 0;
		const policy = new ProvisionFailurePolicy("releasing");

		for (const repo of repos) {
			// one repository is the unit of work; see performProvision
			if (ctx?.isCancelled() === true) {
				Log.info("AdminController::performRelease(..) - cancelled; released " + releasedRepos.length + " of " + repos.length);
				break;
			}
			try {
				const startRepo = Date.now();
				// can only release repos that are finalized; a CREATED repo has no webhook yet
				if (repo.gitHubStatus === RepoStatus.READY) {
					const teams: Team[] = [];
					for (const teamId of repo.teamIds) {
						teams.push(await this.dbc.getTeam(teamId));
					}

					// actually release the repo
					const success = await ghc.releaseRepository(repo, teams, false);

					if (success === true) {
						Log.info("AdminController::performRelease(..) - success: " + repo.id + "; took: " + Util.took(startRepo));
						releasedRepos.push(repo);
						policy.recordSuccess();
					} else {
						Log.warn("AdminController::performRelease(..) - FAILED: " + repo.id);
						const stop = policy.recordFailure(null);
						if (stop !== null) {
							policy.abort(stop);
						}
					}

					await Util.delay(200); // after any releasing wait a short bit
				} else {
					Log.info("AdminController::performRelease(..) - skipped; repo not yet provisioned: " + repo.id); // + "; URL: " + repo.URL);
				}
			} catch (err) {
				Log.error("AdminController::performRelease(..) - FAILED: " + repo.id + "; URL: " + repo.URL + "; ERROR: " + err.message);
				await ctx?.error(repo.id + ": " + err.message);

				const stop = policy.recordFailure(err);
				if (stop !== null) {
					policy.abort(stop);
				}
			}
			done++;
			await ctx?.progress(done, repos.length, repo.delivId + ": " + repo.id);
		}

		const releasedRepositoryTransport: RepositoryTransport[] = [];
		for (const repo of releasedRepos) {
			releasedRepositoryTransport.push(RepositoryController.repositoryToTransport(repo));
		}
		Log.info(
			"AdminController::performRelease(..) - complete; # released: " + releasedRepositoryTransport.length + "; took: " + Util.took(start)
		);

		return releasedRepositoryTransport;
	}

	/**
	 * Detaches the student teams from repositories that have been released.
	 *
	 * The mirror of performRelease, including its failure policy: a repo that cannot be un-released
	 * keeps RELEASED, so running this again retries only what is still outstanding.
	 *
	 * @param {Repository[]} repos
	 * @param {JobContext} ctx
	 * @returns {Promise<RepositoryTransport[]>}
	 */
	public async performUnrelease(repos: Repository[], ctx: JobContext = null): Promise<RepositoryTransport[]> {
		const ghc = this.gh; // see performProvision

		Log.info("AdminController::performUnrelease(..) - start; # repos: " + repos.length);
		const start = Date.now();

		const unreleasedRepos = [];
		let done = 0;
		const policy = new ProvisionFailurePolicy("un-releasing");

		for (const repo of repos) {
			if (ctx?.isCancelled() === true) {
				Log.info("AdminController::performUnrelease(..) - cancelled; un-released " + unreleasedRepos.length + " of " + repos.length);
				break;
			}
			try {
				const startRepo = Date.now();
				// only a released repo has student teams to detach
				if (repo.gitHubStatus === RepoStatus.RELEASED) {
					const teams: Team[] = [];
					for (const teamId of repo.teamIds) {
						teams.push(await this.dbc.getTeam(teamId));
					}

					const success = await ghc.unreleaseRepository(repo, teams);

					if (success === true) {
						Log.info("AdminController::performUnrelease(..) - success: " + repo.id + "; took: " + Util.took(startRepo));
						unreleasedRepos.push(repo);
						policy.recordSuccess();
					} else {
						Log.warn("AdminController::performUnrelease(..) - FAILED: " + repo.id);
						const stop = policy.recordFailure(null);
						if (stop !== null) {
							policy.abort(stop);
						}
					}

					await Util.delay(200); // as with releasing, do not hammer the API
				} else {
					Log.info("AdminController::performUnrelease(..) - skipped; repo not released: " + repo.id);
				}
			} catch (err) {
				Log.error("AdminController::performUnrelease(..) - FAILED: " + repo.id + "; ERROR: " + err.message);
				await ctx?.error(repo.id + ": " + err.message);

				const stop = policy.recordFailure(err);
				if (stop !== null) {
					policy.abort(stop);
				}
			}
			done++;
			await ctx?.progress(done, repos.length, repo.delivId + ": " + repo.id);
		}

		const unreleasedRepositoryTransport: RepositoryTransport[] = [];
		for (const repo of unreleasedRepos) {
			unreleasedRepositoryTransport.push(RepositoryController.repositoryToTransport(repo));
		}
		Log.info(
			"AdminController::performUnrelease(..) - complete; # un-released: " +
				unreleasedRepositoryTransport.length +
				"; took: " +
				Util.took(start)
		);

		return unreleasedRepositoryTransport;
	}

	/* istanbul ignore next */
	/**
	 * Synchronizes the database objects with GitHub. Does _NOT_ remove any DB objects, just makes
	 * sure their properties match those in the GitHub org. This is useful if manual changes are made
	 * to the org that you want to have updated in the repo as well.
	 *
	 * NOTE: team membership is _NOT_ currently read from GitHub and will not be synced.
	 *
	 * @param {boolean} dryRun
	 * @returns {Promise<void>}
	 */
	public async dbSanityCheck(dryRun: boolean): Promise<void> {
		Log.info("AdminController::dbSanityCheck() - start");
		const start = Date.now();

		const gha = GitHubActions.getInstance(true);
		const tc = new TeamController();
		const config = Config.getInstance();

		let repos = await this.dbc.getRepositories();
		for (const repo of repos) {
			Log.info("AdminController::dbSanityCheck() - start; repo: " + repo.id);
			const repoExists = await gha.repoExists(repo.id);
			if (repoExists === true) {
				// make sure repo is consistent
				repo.URL = config.getProp(ConfigKey.githubHost) + "/" + config.getProp(ConfigKey.org) + "/" + repo.id;

				// The status is derived from what GitHub has rather than corrected from what the
				// record said. That is also what lets this repair records written by an older version
				// of Classy: their vocabulary does not have to be understood, only replaced.
				//
				// A repo that exists but has no webhook is CREATED, not READY: it was never
				// finalized, and calling it READY would hide it from the retry that would fix it. The
				// extra listWebhooks call is affordable in a check an admin presses by hand.
				//
				// Unless GitHub cannot reach this deployment at all (dev, CI), in GitHub cannot
				// create a localhost webook.
				if (repo.gitHubStatus !== RepoStatus.RELEASED) {
					const webhooksPossible = GitHubController.webhooksSupported(config.getProp(ConfigKey.publichostname) + "/portal/githubWebhook");
					const finalized = webhooksPossible === false || (await gha.listWebhooks(repo.id)).length > 0;
					await ProvisionState.repairRepoStatus(
						repo,
						finalized ? RepoStatus.READY : RepoStatus.CREATED,
						finalized ? "exists on GitHub and is finalized" : "exists on GitHub but has no webhook"
					);
				}
			} else {
				// repo does not exist
				await ProvisionState.repairRepoStatus(repo, RepoStatus.NOT_CREATED, "absent on GitHub");

				if (repo.URL !== null) {
					Log.warn("AdminController::dbSanityCheck() - repo.URL should be null for: " + repo.id);
					repo.URL = null;
				}

				if (repo.cloneURL !== null) {
					// written alongside URL by GitHubActions::createRepo, so it goes stale the same way
					Log.warn("AdminController::dbSanityCheck() - repo.cloneURL should be null for: " + repo.id);
					repo.cloneURL = null;
				}
			}

			if (dryRun === false) {
				await this.dbc.writeRepository(repo);
			}
			Log.trace("AdminController::dbSanityCheck() - done; repo: " + repo.id);
		}

		let teams = await tc.getAllTeams(); // not DBC because we want special teams filtered out
		for (const team of teams) {
			Log.info("AdminController::dbSanityCheck() - start; team: " + team.id);

			let teamNumber: number = -1;
			if (team.githubId !== null) {
				// use the cached team id if it exists and is correct (much faster)
				const tuple = await gha.getTeam(team.githubId);
				if (tuple !== null && tuple.githubTeamNumber === team.githubId && tuple.teamName === team.id) {
					Log.info("AdminController::dbSanityCheck() - using cached gitHubId for team: " + team.id);
					teamNumber = team.githubId;
				}
			}

			if (teamNumber <= 0) {
				Log.info("AdminController::dbSanityCheck() - not using cached gitHubId for team: " + team.id);
				teamNumber = await gha.getTeamNumber(team.id);
			}

			if (teamNumber >= 0) {
				if (team.githubId !== teamNumber) {
					Log.warn("AdminController::dbSanityCheck() - team.githubId should match the GitHub id for: " + team.id);
					team.githubId = teamNumber;
				}
			} else {
				if (team.githubId !== null) {
					Log.warn("AdminController::dbSanityCheck() - team.githubId should be null: " + team.id);
					team.githubId = null; // does not exist, must not have a number
				}

				await ProvisionState.repairTeamStatus(team, TeamStatus.NOT_CREATED, "absent on GitHub");
			}

			if (dryRun === false) {
				await this.dbc.writeTeam(team);
			}
			Log.trace("AdminController::dbSanityCheck() - done; team: " + team.id);
		}

		repos = await this.dbc.getRepositories();
		const checkedTeams: Team[] = [];
		for (const repo of repos) {
			Log.info("AdminController::dbSanityCheck() - start; repo second pass: " + repo.id);
			let repoHasBeenChecked = false;

			for (const teamId of repo.teamIds) {
				const team = await this.dbc.getTeam(teamId);

				const teamsOnRepo = await gha.getTeamsOnRepo(repo.id);
				let isTeamOnRepo = false;
				for (const teamOnRepo of teamsOnRepo) {
					if (teamOnRepo.teamName === teamId) {
						// team is on repo
						isTeamOnRepo = true;
						repoHasBeenChecked = true;
						checkedTeams.push(team);
					}
				}

				if (isTeamOnRepo === true) {
					// if a team is on a repo, it must be provisioned and linked
					await ProvisionState.repairRepoStatus(repo, RepoStatus.RELEASED, "a student team is attached on GitHub");
					await ProvisionState.repairTeamStatus(team, TeamStatus.ATTACHED, "attached to " + repo.id + " on GitHub");

					if (dryRun === false) {
						await this.dbc.writeRepository(repo);
						await this.dbc.writeTeam(team);
					}
				}
			}

			if (repoHasBeenChecked === false) {
				// repos that were not found to have teams must not be released

				// no team is attached on GitHub, so it cannot be released; it keeps CREATED or READY
				if (repo.gitHubStatus === RepoStatus.RELEASED) {
					await ProvisionState.repairRepoStatus(repo, RepoStatus.READY, "no team is attached on GitHub");
					if (dryRun === false) {
						await this.dbc.writeRepository(repo);
					}
				}
			}
		}

		teams = await tc.getAllTeams(); // not DBC because we want special teams filtered out
		for (const team of teams) {
			let checked = false;
			for (const checkedTeam of checkedTeams) {
				if (checkedTeam.id === team.id) {
					checked = true;
				}
			}
			if (checked === false) {
				// teams that were not found with repos must not be attached
				if (team.gitHubStatus === TeamStatus.ATTACHED) {
					await ProvisionState.repairTeamStatus(team, TeamStatus.CREATED, "not attached to any repo on GitHub");
					if (dryRun === false) {
						await this.dbc.writeTeam(team);
					}
				}
			}
		}

		Log.info("AdminController::dbSanityCheck() - done; took: " + Util.took(start));
	}

	private async createDashboardTransport(result: Result): Promise<AutoTestDashboardTransport> {
		const resultSummary = await this.clipAutoTestResult(result);

		let testPass: string[] = [];
		let testFail: string[] = [];
		let testSkip: string[] = [];
		let testError: string[] = [];

		if (typeof result.output !== "undefined" && typeof result.output.report !== "undefined") {
			const report: GradeReport = result.output.report;
			if (typeof report.passNames !== "undefined") {
				testPass = report.passNames;
			}
			if (typeof report.failNames !== "undefined") {
				testFail = report.failNames;
			}
			if (typeof report.skipNames !== "undefined") {
				testSkip = report.skipNames;
			}
			if (typeof report.errorNames !== "undefined") {
				testError = report.errorNames;
			}
		}

		return {
			...resultSummary,
			testPass: testPass,
			testFail: testFail,
			testError: testError,
			testSkip: testSkip,
			custom: {},
		};
	}

	/**
	 * Transforms a Result into an AutoTestResultSummaryTransport
	 */
	private async clipAutoTestResult(result: Result): Promise<AutoTestResultSummaryTransport> {
		const repoId = result.input.target.repoId;
		const repoURL = Config.getInstance().getProp(ConfigKey.githubHost) + "/" + Config.getInstance().getProp(ConfigKey.org) + "/" + repoId;

		let scoreOverall = null;
		let scoreCover = null;
		let scoreTest = null;

		if (typeof result.output !== "undefined" && typeof result.output.report !== "undefined") {
			const report = result.output.report;
			if (typeof report.scoreOverall !== "undefined") {
				scoreOverall = report.scoreOverall;
			}
			if (typeof report.scoreTest !== "undefined") {
				scoreTest = report.scoreTest;
			}
			if (typeof report.scoreCover !== "undefined") {
				scoreCover = report.scoreCover;
			}
		}

		const state = this.selectState(result);

		return {
			repoId: repoId,
			repoURL: repoURL,
			delivId: result.delivId,
			state: state,
			timestamp: result.output.timestamp,
			commitSHA: result.input.target.commitSHA,
			commitURL: result.input.target.commitURL,
			scoreOverall: scoreOverall,
			scoreCover: scoreCover,
			scoreTests: scoreTest,
			custom: {},
		};
	}

	// NOTE: the default implementation is currently broken; do not use it.
	/**
	 * This is a method that subtypes can call from computeNames if they do not want to implement it themselves.
	 *
	 * @param {Deliverable} deliv
	 * @param {Person[]} people
	 * @returns {Promise<{teamName: string | null; repoName: string | null}>}
	 */
	// public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}> {
	//     Log.info("AdminController::computeNames(..) - start; # people: " + people.length);
	//
	//     // TODO: this code has a fatal flaw; if the team/repo exists already for the specified people,
	//     // it is correct to return those.
	//
	//     let repoPrefix = "";
	//     if (deliv.repoPrefix.length > 0) {
	//         repoPrefix = deliv.repoPrefix;
	//     } else {
	//         repoPrefix = deliv.id;
	//     }
	//
	//     let teamPrefix = "";
	//     if (deliv.teamPrefix.length > 0) {
	//         teamPrefix = deliv.teamPrefix;
	//     } else {
	//         teamPrefix = deliv.id;
	//     }
	//     // the repo name and the team name should be the same, so just use the repo name
	//     const repos = await this.dbc.getRepositories();
	//     let repoCount = 0;
	//     for (const repo of repos) {
	//         if (repo.id.startsWith(repoPrefix)) {
	//             repoCount++;
	//         }
	//     }
	//     let repoName = "";
	//     let teamName = "";
	//
	//     let ready = false;
	//     while (!ready) {
	//         repoName = repoPrefix + "_" + repoCount;
	//         teamName = teamPrefix + "_" + repoCount;
	//         const r = await this.dbc.getRepository(repoName);
	//         const t = await this.dbc.getTeam(teamName);
	//         if (r === null && t === null) {
	//             ready = true;
	//         } else {
	//             Log.warn("AdminController::computeNames(..) - name not available; r: " + repoName + "; t: " + teamName);
	//             repoCount++; // try the next one
	//         }
	//     }
	//     Log.info("AdminController::computeNames(..) - done; r: " + repoName + "; t: " + teamName);
	//     return {teamName: teamName, repoName: repoName};
	// }

	/**
	 * Takes a result, and if the VM was successful picks the state of the report.
	 *     else returns the state of the VM
	 * @param result
	 */
	private selectState(result: Result): string {
		// if the VM state is SUCCESS, return the report state
		let state = "UNDEFINED";
		if (typeof result.output !== "undefined" && typeof result.output.state !== "undefined") {
			state = result.output.state.toString();
		}
		if (state === "SUCCESS" && typeof result.output.report.result !== "undefined") {
			state = result.output.report.result;
		}
		return state;
	}
}
