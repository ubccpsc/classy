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
import { AuditLabel, Course, Deliverable, GitHubStatus, Grade, Person, PersonKind, Repository, Result, Team } from "../Types";
import { DatabaseController } from "./DatabaseController";
import { DeliverablesController } from "./DeliverablesController";
import { GitHubActions } from "./GitHubActions";
import { GitHubController, IGitHubController } from "./GitHubController";
import { GradesController } from "./GradesController";
import { PersonController } from "./PersonController";
import { RepositoryController } from "./RepositoryController";
import { ResultsController, ResultsKind } from "./ResultsController";
import { TeamController } from "./TeamController";

export class AdminController {
	protected dbc = DatabaseController.getInstance();
	protected pc = new PersonController();
	protected rc = new RepositoryController();
	protected tc = new TeamController();
	protected gc = new GradesController();
	protected resC = new ResultsController();
	// protected cc: ICourseController;
	protected gh: IGitHubController = null;

	constructor(ghController: IGitHubController) {
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
						"AdminController::processNewAutoTestGrade(..) - saving grade for deliv: " +
							newGrade.delivId +
							"; repo: " +
							grade.repoId
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
	 * @returns {Promise<string>} A message summarizing the outcome of the operation.
	 */
	public async performStudentWithdraw(): Promise<string> {
		Log.info("AdminController::performStudentWithdraw() - start");
		const gha = GitHubActions.getInstance(true);
		// const tc = new TeamController();
		// const teamNum = await tc.getTeamNumber("students"); // await gha.getTeamNumber("students");
		// const registeredGithubIds = await gha.getTeamMembers(teamNum);
		const registeredGithubIds = await gha.getTeamMembers("students");

		if (registeredGithubIds.length > 0) {
			const pc = new PersonController();
			const msg = await pc.markStudentsWithdrawn(registeredGithubIds);
			Log.info("AdminController::performStudentWithdraw() - done; msg: " + msg);
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
	public async planProvision(deliv: Deliverable, formSingleTeams: boolean): Promise<RepositoryTransport[]> {
		Log.info("AdminController::planProvision( " + deliv.id + ", " + formSingleTeams + " ) - start");
		const cc = await Factory.getCourseController(this.gh);

		let allPeople: Person[] = await this.pc.getAllPeople();
		Log.info("AdminController::planProvision( .. ) - # people (all): " + allPeople.length);

		// remove all withdrawn people, we do not need to provision these
		allPeople = allPeople.filter((person) => person.kind !== PersonKind.WITHDRAWN);
		Log.info("AdminController::planProvision( .. ) - # people (not withdrawn): " + allPeople.length);

		// teams were either formed by students (or the admin in the UI)
		// _or_ the deliv is for single students and we will form them below
		let allTeams: Team[] = await this.tc.getAllTeams();
		Log.info("AdminController::planProvision( .. ) - # teams: " + allTeams.length);

		// just for logging, will remove with filter below
		for (const team of allTeams) {
			if (team.personIds.length < 1) {
				Log.warn("AdminController::planProvision(..) - team has no people: " + team.id);
			}
		}

		// remove teams that have no people
		allTeams = allTeams.filter((team) => team.personIds.length > 0);
		Log.info("AdminController::planProvision(..) - # teams after removing teams without people: " + allTeams.length);

		if (deliv.teamMaxSize === 1) {
			formSingleTeams = true;
			Log.info("AdminController::planProvision(..) - team maxSize 1: formSingleTeams forced to true");
		} else {
			Log.info("AdminController::planProvision(..) - team maxSize > 1: formSingleTeams not forced");
		}

		const delivTeams: Team[] = [];
		for (const team of allTeams) {
			if (team === null || deliv === null || team.id === null || deliv.id === null) {
				// seeing this during 310 provisioning, need to figure this out
				Log.error(
					"AdminController::planProvision(..) - ERROR! null team: " + JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv)
				);
			} else {
				if (team.delivId === deliv.id) {
					Log.info("AdminController::planProvision(..) - adding team: " + team.id + " to delivTeams");
					delivTeams.push(team);
				}
			}
		}
		Log.info("AdminController::planProvision(..) - # deliv teams: " + delivTeams.length);

		// remove any people who are already on teams
		for (const team of delivTeams) {
			for (const personId of team.personIds) {
				const index = allPeople
					.map(function (p: Person) {
						return p.id;
					})
					.indexOf(personId);
				if (index >= 0) {
					Log.info("AdminController::planProvision(..) - person already on team: " + personId + " ( team: " + team.id + " )");
					allPeople.splice(index, 1);
				} else {
					Log.warn("AdminController::planProvision(..) - allPeople does not contain: " + personId);
					const person = await this.pc.getPerson(personId);
					if (person !== null) {
						Log.warn("AdminController::planProvision(..) - person details: " + JSON.stringify(person));
					} else {
						Log.warn("AdminController::planProvision(..) - person is not in database");
					}
				}
			}
		}
		Log.trace("AdminController::planProvision(..) - # people not on teams: " + allPeople.length);

		if (formSingleTeams === true) {
			// now create teams for individuals
			Log.info("AdminController::planProvision(..) - handling single teams");
			for (const individual of allPeople) {
				try {
					const name = await cc.computeNames(deliv, [individual]);
					const team = await this.tc.formTeam(name.teamName, deliv, [individual], false);
					delivTeams.push(team);
				} catch (err) {
					Log.error("AdminController::planProvision(..) - single team creation ERROR: " + err.message);
				}
			}
			Log.info("AdminController::planProvision(..) - single teams done");
		}

		Log.info("AdminController::planProvision(..) - # delivTeams after individual teams added: " + delivTeams.length);

		const reposToProvision: Repository[] = [];
		// now process the teams to create their repos
		for (const delivTeam of delivTeams) {
			Log.info("AdminController::planProvision(..) - preparing to provision team: " + delivTeam.id);

			const people: Person[] = [];
			for (const pId of delivTeam.personIds) {
				people.push(await this.pc.getPerson(pId));
			}
			Log.trace("AdminController::planProvision(..) - preparing to provision pIds: " + JSON.stringify(delivTeam.personIds));
			if (delivTeam.personIds.length !== people.length) {
				Log.warn("AdminController::planProvision(..) - preparing to provision missing people; people: " + JSON.stringify(people));
			}

			const names = await cc.computeNames(deliv, people);

			Log.info(
				"AdminController::planProvision(..) - delivTeam: " +
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
				throw new Error("AdminController::planProvision(..) - team unexpectedly null: " + name); // s.teamName);
			}

			if (repo === null) {
				repo = await this.rc.createRepository(names.repoName, deliv, [team], {});
			}

			if (repo === null) {
				// sanity checking repo must not be null given what we have done above (should never happen)
				throw new Error("AdminController::planProvision(..) - repo unexpectedly null: " + names.repoName); // names.repoName);
			}

			// /* istanbul ignore if */
			// if (typeof repo.custom.githubCreated !== "undefined" && repo.custom.githubCreated === true && repo.URL === null) {
			//     // HACK: this is just for dealing with inconsistent databases
			//     // This whole block should be removed in the future
			//     Log.warn("AdminController::planProvision(..) - repo URL should not be null: " + repo.id);
			//     const config = Config.getInstance();
			//     repo.URL = config.getProp(ConfigKey.githubHost) + "/" + config.getProp(ConfigKey.org) + "/" + repo.id;
			//     await this.dbc.writeRepository(repo);
			// }

			reposToProvision.push(repo);
			Log.info("AdminController::planProvision(..) - team planning done for team: " + delivTeam.id);
		}

		Log.info("AdminController::planProvision(..) - # repos to provision: " + reposToProvision.length);

		const repoTrans: RepositoryTransport[] = [];
		for (const repo of reposToProvision) {
			const newRepo = { delivId: deliv.id, id: repo.id, URL: repo.URL };
			repoTrans.push(newRepo);
		}

		return repoTrans;
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
	public async performProvision(repos: Repository[], importURL: string): Promise<RepositoryTransport[]> {
		const gha = GitHubActions.getInstance(true);
		const ghc = new GitHubController(gha);
		const cc = await Factory.getCourseController(this.gh);

		const config = Config.getInstance();
		const dbc = DatabaseController.getInstance();

		Log.info("AdminController::performProvision(..) - start; # repos: " + repos.length + "; importURL: " + importURL);
		const provisionedRepos: Repository[] = [];

		for (const repo of repos) {
			try {
				const start = Date.now();
				Log.info("AdminController::performProvision(..) ***** START *****; repo: " + repo.id);
				if (repo.gitHubStatus === GitHubStatus.NOT_PROVISIONED) {
					const futureTeams: Array<Promise<Team>> = repo.teamIds.map((teamId) => this.dbc.getTeam(teamId));
					const teams: Team[] = await Promise.all(futureTeams);
					Log.trace("AdminController::performProvision(..) - about to provision: " + repo.id);
					let success = await ghc.provisionRepository(repo.id, teams, importURL);
					success = success && (await cc.finalizeProvisionedRepo(repo, teams));
					Log.trace("AdminController::performProvision(..) - provisioned: " + repo.id + "; success: " + success);

					if (success === true) {
						Log.trace("AdminController::performProvision(..) - success: " + repo.id + "; URL: " + repo.URL);
						provisionedRepos.push(repo);
					} else {
						Log.warn("AdminController::performProvision(..) - provision FAILED: " + repo.id + "; URL: " + repo.URL);
					}

					// forced wait unnecessary with the transition to creating repo from template
					// Log.trace("AdminController::performProvision(..) - done provisioning: " + repo.id + "; forced wait");
					// await Util.delay(2 * 1000); // after any provisioning wait a bit
					// Log.info("AdminController::performProvision(..) - done for repo: " + repo.id + "; wait complete");
					Log.info("AdminController::performProvision(..) ***** DONE *****; repo: " + repo.id + "; took: " + Util.took(start));
				} else {
					Log.info("AdminController::performProvision(..) - skipped; already provisioned: " + repo.id + "; URL: " + repo.URL);
				}
			} catch (err) {
				Log.error("AdminController::performProvision(..) - FAILED: " + repo.id + "; URL: " + repo.URL + "; ERROR: " + err.message);
				// would prefer not to rethrow, but the extra logging can be helpful
				throw err;
			}
		}

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
				Log.error(
					"AdminController::planRelease(..) - ERROR! null team: " + JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv)
				);
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
				if (team.gitHubStatus === GitHubStatus.PROVISIONED_UNLINKED) {
					/* istanbul ignore else */
					// if (repo !== null && typeof repo.custom.githubCreated !== "undefined" && repo.custom.githubCreated === true) {
					if (repo !== null && repo.gitHubStatus !== GitHubStatus.NOT_PROVISIONED) {
						// repo exists and has been provisioned: this is important as teams may have formed that have not been provisioned
						// aka only release provisioned repos
						reposToRelease.push(repo);
					} else {
						Log.info(
							"AdminController::planRelease( " + deliv.id + " ) - repo not provisioned yet: " + JSON.stringify(team.personIds)
						);
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

		// we want to know all repos whether they are released or not
		const allRepos: Repository[] = reposAlreadyReleased;
		for (const toReleaseRepo of reposToRelease) {
			// toReleaseRepo.URL = null; // HACK, but denotes that it has not been released yet
			toReleaseRepo.gitHubStatus = GitHubStatus.PROVISIONED_UNLINKED; // denotes that repo has not been released yet
			allRepos.push(toReleaseRepo);
		}
		return allRepos;
	}

	public async performRelease(repos: Repository[]): Promise<RepositoryTransport[]> {
		const gha = GitHubActions.getInstance(true);
		const ghc = new GitHubController(gha);

		Log.info("AdminController::performRelease(..) - start; # repos: " + repos.length);
		const start = Date.now();

		const releasedRepos = [];
		for (const repo of repos) {
			try {
				const startRepo = Date.now();
				// if (repo.URL !== null) {
				// can only release repos that are provisioned
				if (repo.gitHubStatus !== GitHubStatus.NOT_PROVISIONED) {
					const teams: Team[] = [];
					for (const teamId of repo.teamIds) {
						teams.push(await this.dbc.getTeam(teamId));
					}

					// actually release the repo
					const success = await ghc.releaseRepository(repo, teams, false);

					if (success === true) {
						Log.info("AdminController::performRelease(..) - success: " + repo.id + "; took: " + Util.took(startRepo));
						releasedRepos.push(repo);
					} else {
						Log.warn("AdminController::performRelease(..) - FAILED: " + repo.id);
					}

					await Util.delay(200); // after any releasing wait a short bit
				} else {
					Log.info("AdminController::performRelease(..) - skipped; repo not yet provisioned: " + repo.id); // + "; URL: " + repo.URL);
				}
			} catch (err) {
				Log.error("AdminController::performRelease(..) - FAILED: " + repo.id + "; URL: " + repo.URL + "; ERROR: " + err.message);
			}
		}

		const releasedRepositoryTransport: RepositoryTransport[] = [];
		for (const repo of releasedRepos) {
			releasedRepositoryTransport.push(RepositoryController.repositoryToTransport(repo));
		}
		Log.info(
			"AdminController::performRelease(..) - complete; # released: " +
				releasedRepositoryTransport.length +
				"; took: " +
				Util.took(start)
		);

		return releasedRepositoryTransport;
	}

	public async makeReposReadOnly(deliv: Deliverable): Promise<RepositoryTransport[]> {
		Log.info("AdminController::makeReposReadOnly( " + deliv.id + " ) - start");
		return [];
	}

	public async makeReposWriteable(deliv: Deliverable): Promise<RepositoryTransport[]> {
		Log.info("AdminController::makeReposReadOnly( " + deliv.id + " ) - start");
		return [];
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
				// if (repo.custom.githubCreated !== true) {
				// 	Log.warn("AdminController::dbSanityCheck() - repo.custom.githubCreated should not be false for created: " + repo.id);
				// 	repo.custom.githubCreated = true;
				// }
				if (repo.gitHubStatus === GitHubStatus.NOT_PROVISIONED) {
					Log.warn("AdminController::dbSanityCheck() - gitHubStatus should be PROVISIONED for created: " + repo.id);
					repo.gitHubStatus = GitHubStatus.PROVISIONED_UNLINKED; // linking does not matter for repos
				}
			} else {
				// if (repo.custom.githubCreated !== false) {
				// 	Log.warn("AdminController::dbSanityCheck() - repo.custom.githubCreated should not be true for !created: " + repo.id);
				// 	repo.custom.githubCreated = false; // does not exist, must not be created
				// }
				//
				// if (repo.custom.githubReleased !== false) {
				// 	Log.warn("AdminController::dbSanityCheck() - repo.custom.githubReleased should not be true for !created: " + repo.id);
				// 	repo.custom.githubReleased = false; // does not exist, must not be released
				// }

				// repo does not exist
				if (repo.gitHubStatus !== GitHubStatus.NOT_PROVISIONED) {
					Log.warn("AdminController::dbSanityCheck() - gitHubStatus can only be NOT_PROVISIONED for !created: " + repo.id);
					repo.gitHubStatus = GitHubStatus.NOT_PROVISIONED;
				}

				if (repo.URL !== null) {
					Log.warn("AdminController::dbSanityCheck() - repo.URL should be null for: " + repo.id);
					repo.URL = null;
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

				// if (team.custom.githubAttached !== false) {
				// 	Log.warn("AdminController::dbSanityCheck() - team.custom.githubAttached should be false: " + team.id);
				// 	team.custom.githubAttached = false; // does not exist, must not be attached
				// }

				if (team.gitHubStatus !== GitHubStatus.NOT_PROVISIONED) {
					Log.warn("AdminController::dbSanityCheck() - team should not exist: " + team.id);
					team.gitHubStatus = GitHubStatus.NOT_PROVISIONED; // does not exist, must not be attached
				}
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
					// if (repo.custom.githubReleased !== true) {
					// 	repo.custom.githubReleased = true;
					// 	Log.warn("AdminController::dbSanityCheck() - repo2.custom.githubReleased should be true: " + repo.id);
					// }

					// if a team is on a repo, it must be provisioned and linked
					if (repo.gitHubStatus !== GitHubStatus.PROVISIONED_LINKED) {
						// repo.custom.githubReleased = true;
						repo.gitHubStatus = GitHubStatus.PROVISIONED_LINKED;
						Log.warn("AdminController::dbSanityCheck() - repo2.custom.githubReleased should be true: " + repo.id);
					}

					// if (team.custom.githubAttached !== true) {
					// 	team.custom.githubAttached = true;
					// 	Log.warn("AdminController::dbSanityCheck() - team2.custom.githubAttached should be true: " + team.id);
					// }

					if (team.gitHubStatus !== GitHubStatus.PROVISIONED_LINKED) {
						team.gitHubStatus = GitHubStatus.PROVISIONED_LINKED;
						Log.warn("AdminController::dbSanityCheck() - team.gitHubStatus should be PROVISIONED_LINKED: " + team.id);
					}

					if (dryRun === false) {
						await this.dbc.writeRepository(repo);
						await this.dbc.writeTeam(team);
					}
				}
			}

			if (repoHasBeenChecked === false) {
				// repos that were not found to have teams must not be released
				// if (repo.custom.githubReleased !== false) {
				// 	repo.custom.githubReleased = false; // was not found above, must be unreleased
				if (repo.gitHubStatus !== GitHubStatus.PROVISIONED_UNLINKED) {
					repo.gitHubStatus = GitHubStatus.PROVISIONED_UNLINKED;
					Log.warn("AdminController::dbSanityCheck() - repo.gitHubStatus should be PROVISIONED_UNLINKED: " + repo.gitHubStatus);

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
				// if (team.custom.githubAttached !== false) {
				// 	team.custom.githubAttached = false;
				if (team.gitHubStatus !== GitHubStatus.PROVISIONED_UNLINKED) {
					team.gitHubStatus = GitHubStatus.PROVISIONED_UNLINKED;
					Log.warn("AdminController::dbSanityCheck() - team.gitHubStatus should be PROVISIONED_UNLINKED: " + team.id);

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
		const repoURL =
			Config.getInstance().getProp(ConfigKey.githubHost) + "/" + Config.getInstance().getProp(ConfigKey.org) + "/" + repoId;

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
