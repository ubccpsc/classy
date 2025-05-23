import { expect } from "chai";
import "mocha";

import Config, { ConfigCourses, ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import { AutoTestGradeTransport, GradeTransport, StudentTransport, TeamTransport } from "@common/types/PortalTypes";

import { AdminController } from "@backend/controllers/AdminController";
import { ICourseController } from "@backend/controllers/CourseController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions, IGitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { GradesController } from "@backend/controllers/GradesController";
import { PersonController } from "@backend/controllers/PersonController";
import { RepositoryController } from "@backend/controllers/RepositoryController";
import { TeamController } from "@backend/controllers/TeamController";
import { Factory } from "@backend/Factory";
import { GitHubStatus, Person, PersonKind, Repository, Team } from "@backend/Types";

import "@common/GlobalSpec"; // load first
import "./GradeControllerSpec"; // load first

describe("AdminController", () => {
	let ac: AdminController;
	let cc: ICourseController;
	let gc: GradesController;
	let tc: TeamController;
	let rc: RepositoryController;
	let pc: PersonController;
	let dc: DeliverablesController;
	let gha: IGitHubActions;

	before(async function () {
		await TestHarness.suiteBefore("AdminController");
		await clearAndPrepareAll();
	});

	beforeEach(async function () {
		gha = GitHubActions.getInstance(true);
		const ghInstance = new GitHubController(gha);

		ac = new AdminController(ghInstance);
		cc = await Factory.getCourseController(ghInstance);

		rc = new RepositoryController();
		gc = new GradesController();
		tc = new TeamController();
		pc = new PersonController();
		dc = new DeliverablesController();
	});

	after(async function () {
		TestHarness.suiteAfter("AdminController");
	});

	async function clearAndPrepareAll(): Promise<void> {
		// clear objects
		const dbc = DatabaseController.getInstance();
		await dbc.clearData();

		// TODO: clear github teams and repositories we need

		await TestHarness.prepareAll();
	}

	async function clearAndPreparePartial(): Promise<void> {
		// clear objects
		const dbc = DatabaseController.getInstance();
		await dbc.clearData();

		// clear github teams and repositories we will end up provisioning
		await gha.deleteRepo(TestHarness.REPONAMEREAL);
		// await gha.deleteRepo("d0_" + Test.USERNAMEGITHUB1 + "_" + Test.USERNAMEGITHUB2);
		await gha.deleteRepo("d0_" + TestHarness.GITHUB1.csId);
		await gha.deleteRepo("d0_" + TestHarness.GITHUB2.csId);
		await gha.deleteRepo("d0_" + TestHarness.GITHUB3.csId);

		await gha.deleteRepo("project_" + TestHarness.GITHUB1.csId + "_" + TestHarness.GITHUB2.csId);
		await gha.deleteRepo("project_" + TestHarness.GITHUB3.csId);
		await gha.deleteRepo(TestHarness.REPONAME1);
		await gha.deleteRepo(TestHarness.REPONAME2);

		// let teamNum = await gha.getTeamNumber("t_d0_" + Test.USERNAMEGITHUB1 + "_" + Test.USERNAMEGITHUB2);
		// await gha.deleteTeam(teamNum);

		// NOTE: using GHA instead of TC because we really want to clear out GitHub
		// let teamNum = await gha.getTeamNumber("t_d0_" + Test.GITHUB1.csId);
		// await gha.deleteTeam(teamNum);
		await gha.deleteTeam("t_d0_" + TestHarness.GITHUB1.csId);
		// teamNum = await gha.getTeamNumber("t_d0_" + Test.GITHUB2.csId);
		// await gha.deleteTeam(teamNum);
		await gha.deleteTeam("t_d0_" + TestHarness.GITHUB2.csId);
		// teamNum = await gha.getTeamNumber("t_d0_" + Test.GITHUB3.csId);
		// await gha.deleteTeam(teamNum);
		await gha.deleteTeam("t_d0_" + TestHarness.GITHUB3.csId);
		// teamNum = await gha.getTeamNumber("t_project_" + Test.GITHUB1.csId + "_" + Test.GITHUB2.csId);
		// await gha.deleteTeam(teamNum);
		await gha.deleteTeam("t_project_" + TestHarness.GITHUB1.csId + "_" + TestHarness.GITHUB2.csId);
		// teamNum = await gha.getTeamNumber("t_project_" + Test.GITHUB3.csId);
		// await gha.deleteTeam(teamNum);
		await gha.deleteTeam("t_project_" + TestHarness.GITHUB3.csId);
		// teamNum = await gha.getTeamNumber(Test.TEAMNAMEREAL);
		// await gha.deleteTeam(teamNum);
		await gha.deleteTeam(TestHarness.TEAMNAMEREAL);

		await TestHarness.prepareDeliverables();

		const p1: Person = TestHarness.createPerson(
			TestHarness.GITHUB1.id,
			TestHarness.GITHUB1.csId,
			TestHarness.GITHUB1.github,
			PersonKind.STUDENT
		);
		await dbc.writePerson(p1);
		const p2 = TestHarness.createPerson(
			TestHarness.GITHUB2.id,
			TestHarness.GITHUB2.csId,
			TestHarness.GITHUB2.github,
			PersonKind.STUDENT
		);
		await dbc.writePerson(p2);
		const p3 = TestHarness.createPerson(
			TestHarness.GITHUB3.id,
			TestHarness.GITHUB3.csId,
			TestHarness.GITHUB3.github,
			PersonKind.STUDENT
		);
		await dbc.writePerson(p3);

		const deliv = await dbc.getDeliverable(TestHarness.DELIVIDPROJ);
		const names = await cc.computeNames(deliv, [p1, p2]);

		// const t = await Test.teamCreate(names.teamName, Test.DELIVIDPROJ, [p1.id, p2.id]);
		const t = await TestHarness.createTeam(names.teamName, TestHarness.DELIVIDPROJ, [p1.id, p2.id]);
		await dbc.writeTeam(t);
	}

	it("Should be able to get the config name.", async function () {
		const res = await AdminController.getName();
		expect(res).to.equal(ConfigCourses.classytest);
	});

	it("Should not be able to get a user that does not exist.", async function () {
		const USERNAME = "UNKNOWNUSER" + new Date().getTime();
		const res = await cc.handleUnknownUser(USERNAME);
		expect(res).to.equal(null); // nothing should be returned

		const person = await pc.getPerson(USERNAME); // get user
		expect(person).to.equal(null); // should not exist
	});

	it("Should be able to get a list of students.", async function () {
		const res = await ac.getStudents();
		expect(res).to.be.an("array");
		expect(res.length).to.be.greaterThan(0);

		const s: StudentTransport = {
			firstName: "first_" + TestHarness.USER1.id,
			lastName: "last_" + TestHarness.USER1.id,
			id: TestHarness.USER1.id,
			githubId: TestHarness.USER1.github,
			userUrl: Config.getInstance().getProp(ConfigKey.githubHost) + "/" + TestHarness.USER1.github,
			studentNum: null,
			labId: "l1a",
		};

		expect(res).to.deep.include(s); // make sure at least one student with the right format is in there
	});

	it("Should be able to get a list of teams.", async () => {
		const actual = await ac.getTeams();
		Log.test("Actual teams: " + JSON.stringify(actual));
		expect(actual).to.be.an("array");
		expect(actual.length).to.be.greaterThan(0);

		const t: TeamTransport = {
			id: TestHarness.TEAMNAME1,
			delivId: "d0",
			people: [TestHarness.USER1.id, TestHarness.USER2.id],
			URL: null,
			// repoName: null,
			// repoUrl:  null
		};
		Log.test("Expected team: " + JSON.stringify(t));
		expect(actual).to.deep.include(t); // make sure at least one student with the right format is in there
	});

	it("Should be able to get a list of grades.", async () => {
		const res = await ac.getGrades();
		expect(res).to.be.an("array");
		expect(res.length).to.be.greaterThan(0);

		// Log.test("grades: " + JSON.stringify(res));
		const url = Config.getInstance().getProp(ConfigKey.githubHost) + "/" + TestHarness.USER2.github;
		const id = TestHarness.USER2.id;
		const t: GradeTransport = {
			personId: id,
			personURL: url,
			delivId: "d1",
			score: 100,
			comment: "comment",
			urlName: "urlName",
			URL: "URL",
			timestamp: 1517446860000,
			custom: {},
		};
		expect(res).to.deep.include(t); // make sure at least one student with the right format is in there
	});

	it("Should be able to get a list of results with wildcards.", async () => {
		const res = await ac.getResults("any", "any");
		expect(res).to.be.an("array");
		expect(res.length).to.equal(19);
	});

	it("Should be able to get a list of results without wildcards.", async () => {
		const res = await ac.getResults(TestHarness.DELIVID0, TestHarness.REPONAME1);
		expect(res).to.be.an("array");
		expect(res.length).to.equal(10);
	});

	it("Should be able to get a list of dashboard results with partial wildcards.", async () => {
		// does not really work with the result tuples we have...
		const res = await ac.getDashboard("any", TestHarness.REPONAME1);
		expect(res).to.be.an("array");
		expect(res.length).to.equal(10);
	});

	it("Should be able to get a list of dashboard results  with wildcards.", async () => {
		const res = await ac.getDashboard("any", "any");
		expect(res).to.be.an("array");
		expect(res.length).to.be.lessThan(20);
	});

	it("Should be able to get a list of dashboard results  without wildcards.", async () => {
		const res = await ac.getDashboard(TestHarness.DELIVID0, TestHarness.REPONAME1);
		expect(res).to.be.an("array");
		expect(res.length).to.equal(10);
	});

	it("Should be able to get a list of dashboard results  without wildcards, with max result number set.", async () => {
		const res = await ac.getDashboard(TestHarness.DELIVID0, TestHarness.REPONAME1, 5);
		expect(res).to.be.an("array");
		expect(res.length).to.equal(5);
	});

	it("Should be able to get a list of results with partial wildcards.", async () => {
		// does not really work with the result tuples we have...
		const res = await ac.getResults("any", TestHarness.REPONAME1);
		expect(res).to.be.an("array");
		expect(res.length).to.equal(10);
	});

	it("Should be able to get a list of repositories.", async () => {
		const res = await ac.getRepositories();

		// Log.test(JSON.stringify(res));
		expect(res).to.be.an("array");
		expect(res).to.have.lengthOf(2);
		expect(res[0].id).to.be.an("string");
		expect(res[0].URL).to.not.be.undefined;
	});

	it("Should be able to get a list of deliverables.", async () => {
		const res = await ac.getDeliverables();
		expect(res).to.be.an("array");
		expect(res.length).to.be.greaterThan(0);

		// const e = { // : DeliverableTransport only partial so type skipped
		//     id: "d1",
		//
		//     url:            "http://NOTSET",
		//     gradesReleased: false,
		//
		//     minTeamSize:       1,
		//     maxTeamSize:       2,
		//     teamsSameLab:      true,
		//     studentsFormTeams: true
		//
		// };

		// Log.test(JSON.stringify(res));
		// expect(res).to.deep.include(d); // make sure at least one deliverable with the right format is in there
	});

	it("Should be able to handle a new AutoTest grade.", async () => {
		const grade: AutoTestGradeTransport = {
			delivId: "d0",

			score: 100, // grade: < 0 will mean "N/A" in the UI
			comment: "", // simple grades will just have a comment

			urlName: "commitName", // description to go with the URL (repo if exists)
			URL: "commitUrl", // commit URL if known, otherwise repo URL (commit / repo if exists)

			timestamp: new Date(1400000000000 + 1000).getTime(), // shouldSave should be true
			custom: {},

			repoId: TestHarness.REPONAME1,
			repoURL: "repoUrl",
		};

		const res = await ac.processNewAutoTestGrade(grade);
		expect(res).to.be.an("boolean");
		expect(res).to.be.true;
	});

	it("Should be able to reject a new AutoTest grade when it should not be saved.", async () => {
		const grade: AutoTestGradeTransport = {
			delivId: "d0",

			score: 100, // grade: < 0 will mean "N/A" in the UI
			comment: "", // simple grades will just have a comment

			urlName: "commitName", // description to go with the URL (repo if exists)
			URL: "commitUrl", // commit URL if known, otherwise repo URL (commit / repo if exists)

			timestamp: new Date(1500000000000 + 1000).getTime(), // too late: shouldSave should be false
			custom: {},

			repoId: TestHarness.REPONAME1,
			repoURL: "repoUrl",
		};

		const res = await ac.processNewAutoTestGrade(grade);
		expect(res).to.be.an("boolean");
		expect(res).to.be.false;
	});

	it("Should fail to handle a new AutoTest grade if the repoId is invalid.", async () => {
		const grade: AutoTestGradeTransport = {
			delivId: "d0",

			score: 100, // grade: < 0 will mean "N/A" in the UI
			comment: "", // simple grades will just have a comment

			urlName: "commitName", // description to go with the URL (repo if exists)
			URL: "commitUrl", // commit URL if known, otherwise repo URL (commit / repo if exists)

			timestamp: Date.now(), // even if grade < 0 might as well return when the entry was made
			custom: {},

			repoId: "INVALIDID",
			repoURL: "repoUrl",
		};

		const res = await ac.processNewAutoTestGrade(grade);
		expect(res).to.be.an("boolean");
		expect(res).to.be.false;
	});

	it("Should be able to get the course object.", async () => {
		const res = await ac.getCourse();

		expect(res).to.be.an("object");
		expect(res.id).to.be.an("string");
		expect(res.defaultDeliverableId).to.not.be.undefined;
		expect(res.custom).to.be.an("object");
	});

	it("Should be able to update the course object.", async () => {
		const NEWID = Date.now() + "id";
		const res = await ac.getCourse();
		expect(res.defaultDeliverableId).to.not.equal(NEWID);

		res.defaultDeliverableId = NEWID;
		(res.custom as any).fooProperty = "asdfasdf";
		await ac.saveCourse(res);

		const newRes = await ac.getCourse();
		expect(newRes.defaultDeliverableId).to.equal(NEWID);
		expect((newRes.custom as any).fooProperty).to.equal("asdfasdf");

		// reset course id
		res.defaultDeliverableId = null;
		delete (res.custom as any).fooProperty;
		await ac.saveCourse(res);

		(res as any).id = "newId" + Date.now();
		delete (res.custom as any).fooProperty;
		await ac.saveCourse(res);
	});

	it("Should not be able to validate an invalid course object.", function () {
		let res = null;
		try {
			AdminController.validateCourseTransport(null);
			res = "NOT THROWN";
		} catch (err) {
			res = "THROW CAUGHT";
		}
		expect(res).to.equal("THROW CAUGHT");

		let course: any = { id: "foo" };
		res = AdminController.validateCourseTransport(course);
		expect(res).to.not.be.null;
		expect(res).to.be.an("string");

		course = { id: "foo", defaultDeliverableId: "bar" };
		res = AdminController.validateCourseTransport(course);
		expect(res).to.not.be.null;
		expect(res).to.be.an("string");
	});

	it("Should not be able to validate an invalid provision object.", function () {
		let res = null;
		let ex = null;
		try {
			res = AdminController.validateProvisionTransport(null);
		} catch (err) {
			ex = err;
		}
		expect(res).to.be.null;
		expect(ex).to.not.be.null;

		res = null;
		ex = null;
		let course: any = { delivId: 42 }; // should be a string
		try {
			res = AdminController.validateProvisionTransport(course);
		} catch (err) {
			ex = err;
		}
		expect(res).to.be.null;
		expect(ex).to.not.be.null;

		res = null;
		ex = null;
		course = { delivId: TestHarness.DELIVID0, formSingle: "true" }; // formSingle should be a boolean
		try {
			res = AdminController.validateProvisionTransport(course);
		} catch (err) {
			ex = err;
		}
		expect(res).to.be.null;
		expect(ex).to.not.be.null;
	});

	it("Should be able to compute a team and repo name.", async () => {
		const db = DatabaseController.getInstance();

		const tExpected = "t_d0_" + TestHarness.USER1.csId + "_" + TestHarness.USER2.csId;
		const rExpected = "d0_" + TestHarness.USER1.csId + "_" + TestHarness.USER2.csId;

		// prepare
		const dbc = DatabaseController.getInstance();
		await dbc.deleteRepository({ id: rExpected } as Repository);
		await dbc.deleteTeam({ id: tExpected } as Team);

		const deliv = await db.getDeliverable(TestHarness.DELIVID0);
		const p1 = await db.getPerson(TestHarness.USER1.id);
		const p2 = await db.getPerson(TestHarness.USER2.id);

		let res = await cc.computeNames(deliv, [p1, p2]);

		expect(res.teamName).to.equal(tExpected);
		expect(res.repoName).to.equal(rExpected);

		// make those teams
		const t = await TestHarness.createTeam(res.teamName, deliv.id, []);
		await db.writeTeam(t);
		const r = await TestHarness.createRepository(res.repoName, deliv.id, res.teamName);
		await db.writeRepository(r);

		// make sure the bar has been raised
		res = await cc.computeNames(deliv, [p1, p2]);
		expect(res.teamName).to.equal(tExpected);
		expect(res.repoName).to.equal(rExpected);
	});

	describe("Slow AdminController Tests", () => {
		// before(async function() {
		//     await clearAndPreparePartial();
		// });

		beforeEach(function () {
			const exec = TestHarness.runSlowTest();
			if (exec) {
				Log.test("AdminControllerSpec::slowTests - running: " + this.currentTest.title);
			} else {
				Log.test("AdminControllerSpec::slowTests - skipping; will run on CI");
				this.skip();
			}
		});

		// This test must be run first -- before later tests modify the database to a state where students cannot be withdrawn.
		it("Should be able to mark students as withdrawn.", async () => {
			const studentsBefore = await ac.getStudents();
			let people = await pc.getAllPeople();

			let numWithrdrawnBefore = 0;
			for (const person of people) {
				if (person.kind === PersonKind.WITHDRAWN) {
					numWithrdrawnBefore++;
				}
			}
			expect(numWithrdrawnBefore).to.equal(0); // should not have any withdrawn students before

			const res = await ac.performStudentWithdraw();
			Log.test("Result: " + JSON.stringify(res));
			expect(res).to.be.an("string");

			people = await pc.getAllPeople();
			let numWithrdrawnAfter = 0;
			for (const person of people) {
				if (person.kind === PersonKind.WITHDRAWN) {
					numWithrdrawnAfter++;
				}
			}
			expect(numWithrdrawnAfter).to.be.greaterThan(numWithrdrawnBefore);

			const studentsAfter = await ac.getStudents();
			expect(studentsBefore.length).to.be.greaterThan(studentsAfter.length); // students should not include withdrawn students
		}).timeout(TestHarness.TIMEOUTLONG * 5);

		// // broken when we switched to plan/perform provisioning
		it("Should provision repos if there are some to do and singles are disabled.", async () => {
			await clearAndPreparePartial();

			const allRepos = await rc.getAllRepos();
			expect(allRepos.length).to.equal(0);

			const allTeams = await tc.getAllTeams();
			expect(allTeams.length).to.equal(1);
			expect(allTeams[0].URL).to.be.null;
			expect(allTeams[0].gitHubStatus).to.equal(GitHubStatus.NOT_PROVISIONED); // not provisioned yet

			const deliv = await dc.getDeliverable(TestHarness.DELIVIDPROJ);
			const plan = await ac.planProvision(deliv, false);

			const repos: Repository[] = [];
			for (const repo of plan) {
				repos.push(await rc.getRepository(repo.id));
			}

			const res = await ac.performProvision(repos, deliv.importURL);
			// const res = await ac.provision(deliv, false);
			Log.test("provisioned: " + JSON.stringify(res));
			expect(res).to.be.an("array");
			expect(res.length).to.equal(1);

			const allNewRepos = await rc.getAllRepos();
			expect(allNewRepos.length).to.equal(1);
			expect(allNewRepos[0].URL).to.not.be.null;
			expect(allNewRepos[0].gitHubStatus).to.equal(GitHubStatus.PROVISIONED_UNLINKED); // not attached yet

			const repoExists = await gha.repoExists(allNewRepos[0].id);
			expect(repoExists).to.be.true; // should be provisioned

			const allNewTeams = await tc.getAllTeams();
			expect(allNewTeams.length).to.equal(1);

			const teamNum = await tc.getTeamNumber(allNewTeams[0].id);
			expect(teamNum).to.be.greaterThan(0); // should be provisioned
			expect(allNewTeams[0].URL).to.not.be.null;
			expect(allNewTeams[0].gitHubStatus).to.equal(GitHubStatus.PROVISIONED_UNLINKED); // not attached yet
		}).timeout(TestHarness.TIMEOUTLONG);

		it("Should release repos.", async () => {
			// await clearAndPreparePartial();
			const allRepos = await rc.getAllRepos();
			expect(allRepos.length).to.equal(1);
			expect(allRepos[0].URL).to.not.be.null;
			expect(allRepos[0].gitHubStatus).to.equal(GitHubStatus.PROVISIONED_UNLINKED); // not attached yet

			const allTeams = await tc.getAllTeams();
			expect(allTeams.length).to.equal(1);
			expect(allTeams[0].URL).to.not.be.null;
			// expect(allTeams[0].custom.githubAttached).to.be.false; // not attached
			expect(allTeams[0].gitHubStatus).to.equal(GitHubStatus.PROVISIONED_UNLINKED);

			const deliv = await dc.getDeliverable(TestHarness.DELIVIDPROJ);
			const relPlan = await ac.planRelease(deliv);
			Log.test("Release plan: " + JSON.stringify(relPlan));
			expect(relPlan).to.be.an("array");
			expect(relPlan.length).to.equal(1);

			const res = await ac.performRelease(allRepos);
			Log.test("Released: " + JSON.stringify(res));
			expect(res).to.be.an("array");
			expect(res.length).to.equal(1);
			const provisionedRepos = await rc.getAllRepos();
			expect(provisionedRepos[0].URL).to.not.be.null;
			expect(provisionedRepos[0].gitHubStatus).to.equal(GitHubStatus.PROVISIONED_LINKED); // now attached

			const allNewTeams = await tc.getAllTeams();
			expect(allNewTeams.length).to.equal(1);
			const newTeam = allNewTeams[0];
			// expect(newTeam.custom.githubAttached).to.be.true; // attached
			expect(newTeam.gitHubStatus).to.equal(GitHubStatus.PROVISIONED_LINKED);

			// // try again: should not release any more repos
			// res = await ac.release(allRepos);
			// Log.test("Re-Released: " + JSON.stringify(res));
			// expect(res).to.be.an("array");
			// expect(res.length).to.equal(0);
		}).timeout(TestHarness.TIMEOUTLONG);

		it("Should provision repos if singles are enabled.", async () => {
			await clearAndPreparePartial();

			const allRepos = await rc.getAllRepos();
			const allTeams = await tc.getAllTeams();
			expect(allRepos.length).to.equal(0);
			expect(allTeams.length).to.equal(1); // 1x project

			// NOTE: this is one of those places teamNumber is being used to signal provisioning
			let teamNum = await gha.getTeamNumber(allTeams[0].id); // using GHA not TC because we want to check github
			expect(teamNum).to.be.lessThan(0); // should not be provisioned yet

			const deliv = await dc.getDeliverable(TestHarness.DELIVID0);
			const plan = await ac.planProvision(deliv, true);

			const repos: Repository[] = [];
			for (const repo of plan) {
				repos.push(await rc.getRepository(repo.id));
			}
			const res = await ac.performProvision(repos, deliv.importURL);

			Log.test("provisioned: " + JSON.stringify(res));
			expect(res).to.be.an("array");
			expect(res.length).to.equal(3);

			const allNewRepos = await rc.getAllRepos();
			const allNewTeams = await tc.getAllTeams();
			expect(allNewRepos.length).to.equal(3); // 3x d0
			expect(allNewTeams.length).to.equal(4); // 3x d0 & 1x project

			for (const team of allNewTeams) {
				if (team.delivId === deliv.id) {
					Log.test("Team: " + JSON.stringify(team));
					teamNum = await tc.getTeamNumber(team.id);
					expect(teamNum).to.be.greaterThan(0); // should be provisioned
					expect(team.URL).to.not.be.null;
				}
			}

			for (const repo of allNewRepos) {
				if (repo.delivId === deliv.id) {
					Log.test("Repo: " + JSON.stringify(repo));
					const repoExists = await gha.repoExists(repo.id);
					expect(repoExists).to.be.true;
					expect(repo.URL).to.not.be.null;
					expect(repo.gitHubStatus).to.equal(GitHubStatus.PROVISIONED_UNLINKED); // not attached yet
				}
			}
		}).timeout(TestHarness.TIMEOUTLONG * 5);

		it("Should not provision any new repos if nothing has changed.", async () => {
			// await clearAndPreparePartial();

			const allRepos = await rc.getAllRepos();
			const allTeams = await tc.getAllTeams();
			expect(allRepos.length).to.equal(3);
			expect(allTeams.length).to.equal(4);

			const deliv = await dc.getDeliverable(TestHarness.DELIVID0);
			const plan = await ac.planProvision(deliv, false);

			const repos: Repository[] = [];
			for (const repo of plan) {
				repos.push(await rc.getRepository(repo.id));
			}

			const res = await ac.performProvision(repos, deliv.importURL);
			Log.test("Provisioned: " + JSON.stringify(res));
			expect(res).to.be.an("array");
			expect(res.length).to.equal(0);

			const allNewRepos = await rc.getAllRepos();
			const allNewTeams = await tc.getAllTeams();

			expect(allNewRepos.length).to.equal(3);
			expect(allNewTeams.length).to.equal(4); // 3x d0 & 1x project
		}).timeout(TestHarness.TIMEOUTLONG * 5);
	});
});
