import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GradesController } from "@backend/controllers/GradesController";
import { PersonController } from "@backend/controllers/PersonController";
import { RepositoryController } from "@backend/controllers/RepositoryController";
import { TeamController } from "@backend/controllers/TeamController";
import { Factory } from "@backend/Factory";
import { Auth, Course, Deliverable, Grade, Person, PersonKind, Repository, Result, Team } from "@backend/Types";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import Util from "@common/Util";
import { ContainerInput, ContainerOutput, ContainerState } from "@common/types/ContainerTypes";
import { GradePayload } from "@common/types/SDMMTypes";
import { AutoTestConfigTransport } from "@common/types/PortalTypes";

export class TestHarness {
	public static readonly TIMEOUT = 1000 * 10;
	public static readonly TIMEOUTLONG = 1000 * 300; // 5 minutes

	public static async suiteBefore(suiteName: string) {
		Log.test("Test::suiteBefore( ... ) - suite: " + suiteName);

		const dc = DatabaseController.getInstance();
		await dc.clearData();
	}

	public static suiteAfter(suiteName: string) {
		Log.test("Test::suiteAfter( ... ) - suite: " + suiteName);
	}

	public static testBefore(context: any) {
		Log.test("*****");
		let testName = "UNKNOWN TEST";
		let suiteName = "UNKNOWN SUITE";

		if (typeof context.currentTest !== "undefined" && typeof context.currentTest.title !== "undefined") {
			testName = context.currentTest.title;
		}

		if (
			typeof context.currentTest !== "undefined" &&
			typeof context.currentTest.parent !== "undefined" &&
			context.currentTest.parent.title !== "undefined"
		) {
			suiteName = context.currentTest.parent.title;
		}

		Log.test("* START: " + suiteName + " ( " + testName + " )");
		Log.test("*****");
	}

	public static testAfter(context: any) {
		Log.test("*****");

		let testName = "UNKNOWN TEST";
		let suiteName = "UNKNOWN SUITE";
		let testStatus = "UNKNOWN STATUS";

		if (typeof context.currentTest !== "undefined" && typeof context.currentTest.title !== "undefined") {
			testName = context.currentTest.title;
		}

		if (
			typeof context.currentTest !== "undefined" &&
			typeof context.currentTest.parent !== "undefined" &&
			context.currentTest.parent.title !== "undefined"
		) {
			suiteName = context.currentTest.parent.title;
		}

		if (typeof context.currentTest !== "undefined" && typeof context.currentTest.state !== "undefined") {
			testStatus = context.currentTest.state;
		}

		if (testStatus === "failed") {
			Log.test("* END: _TEST FAILED_ " + suiteName + " ( " + testName + " )");
		} else if (testStatus === "passed") {
			Log.test("* END: _TEST PASSED_ " + suiteName + " ( " + testName + " )");
		} else {
			Log.test("* END: _TEST UNKNOWN_ " + suiteName + " ( " + testName + " ) - state: " + testStatus);
		}
		Log.test("*****");
	}

	public static async prepareAll() {
		await TestHarness.preparePeople();
		await TestHarness.prepareAuth();
		await TestHarness.prepareDeliverables();
		await TestHarness.prepareTeams();
		await TestHarness.prepareRepositories();
		await TestHarness.prepareGrades();
		await TestHarness.prepareResults();
	}

	public static async prepareAllReal() {
		const dbc = DatabaseController.getInstance();

		await TestHarness.prepareDeliverables();

		let person = await TestHarness.createPerson(
			TestHarness.GITHUB1.id,
			TestHarness.GITHUB1.csId,
			TestHarness.GITHUB1.github,
			PersonKind.STUDENT
		);
		await dbc.writePerson(person);
		person = await TestHarness.createPerson(
			TestHarness.GITHUB2.id,
			TestHarness.GITHUB2.csId,
			TestHarness.GITHUB2.github,
			PersonKind.STUDENT
		);
		await dbc.writePerson(person);
		person = await TestHarness.createPerson(
			TestHarness.ADMIN1.id,
			TestHarness.ADMIN1.csId,
			TestHarness.ADMIN1.github,
			PersonKind.ADMIN
		);
		await dbc.writePerson(person);
		person = await TestHarness.createPerson(
			TestHarness.ADMINSTAFF1.id,
			TestHarness.ADMINSTAFF1.csId,
			TestHarness.ADMINSTAFF1.github,
			PersonKind.ADMINSTAFF
		);
		await dbc.writePerson(person);
		await TestHarness.prepareAuth();
		// create a team
		const team = await TestHarness.createTeam(TestHarness.TEAMNAMEREAL, TestHarness.DELIVID0, [
			TestHarness.GITHUB1.id,
			TestHarness.GITHUB2.id,
		]);
		await dbc.writeTeam(team);
	}

	public static async prepareDeliverables(): Promise<void> {
		const dc = DatabaseController.getInstance();

		let d = TestHarness.createDeliverable(TestHarness.DELIVID0);
		d.teamMinSize = 1;
		d.teamMaxSize = 1;
		await dc.writeDeliverable(d);

		d = TestHarness.createDeliverable(TestHarness.DELIVID1);
		d.shouldProvision = false;
		await dc.writeDeliverable(d);

		d = TestHarness.createDeliverable(TestHarness.DELIVID2);
		await dc.writeDeliverable(d);

		d = TestHarness.createDeliverable(TestHarness.DELIVID3);
		d.teamStudentsForm = false;
		await dc.writeDeliverable(d);

		d = TestHarness.createDeliverable(TestHarness.DELIVIDPROJ);
		d.teamMinSize = 2;
		d.teamMaxSize = 2;
		d.shouldProvision = true;
		await dc.writeDeliverable(d);
	}

	public static async preparePeople(): Promise<void> {
		Log.test("Test::preparePeople() - start");
		const dc = DatabaseController.getInstance();

		// FAKE USERS ON GITHUB, BUT STILL IN DB FOR INTERNAL CLASSY BUSINESS LOGIC:
		let p = TestHarness.createPerson(TestHarness.USER1.id, TestHarness.USER1.csId, TestHarness.USER1.github, PersonKind.STUDENT);
		p.labId = "l1a";
		await dc.writePerson(p);

		p = TestHarness.createPerson(TestHarness.USER2.id, TestHarness.USER2.csId, TestHarness.USER2.github, PersonKind.STUDENT);
		p.labId = "l1a";
		await dc.writePerson(p);

		p = TestHarness.createPerson(TestHarness.USER3.id, TestHarness.USER3.csId, TestHarness.USER3.github, PersonKind.STUDENT);
		p.labId = "l1a";
		await dc.writePerson(p);

		p = TestHarness.createPerson(TestHarness.USER4.id, TestHarness.USER4.csId, TestHarness.USER4.github, PersonKind.STUDENT);
		p.labId = "l2c";
		await dc.writePerson(p);

		p = TestHarness.createPerson(TestHarness.USER5.id, TestHarness.USER5.csId, TestHarness.USER5.github, PersonKind.STUDENT);
		p.labId = "l2d";
		await dc.writePerson(p);

		p = TestHarness.createPerson(TestHarness.USER6.id, TestHarness.USER6.csId, TestHarness.USER6.github, PersonKind.STUDENT);
		p.labId = "l2d";
		await dc.writePerson(p);

		p = TestHarness.createPerson(
			TestHarness.ADMINSTAFF1.id,
			TestHarness.ADMINSTAFF1.csId,
			TestHarness.ADMINSTAFF1.github,
			PersonKind.ADMINSTAFF
		);
		await dc.writePerson(p);

		// REAL USERS CAPABLE FOR GITHUB EXTERNAL BUSINESS LOGIC TESTS. CAN ALWAYS ADD MORE REAL ATEST-xx USERS
		p = TestHarness.createPerson(
			TestHarness.REALUSER1.id,
			TestHarness.REALUSER1.csId,
			TestHarness.REALUSER1.github,
			PersonKind.STUDENT
		);
		await dc.writePerson(p);

		p = TestHarness.createPerson(
			TestHarness.REALUSER2.id,
			TestHarness.REALUSER2.csId,
			TestHarness.REALUSER2.github,
			PersonKind.STUDENT
		);
		await dc.writePerson(p);

		p = TestHarness.createPerson(
			TestHarness.REALUSER3.id,
			TestHarness.REALUSER3.csId,
			TestHarness.REALUSER3.github,
			PersonKind.STUDENT
		);
		await dc.writePerson(p);

		// admin person (this username should be on the admin but not the staff team in the github org)
		p = TestHarness.createPerson(
			TestHarness.ADMINSTAFF1.id,
			TestHarness.ADMINSTAFF1.csId,
			TestHarness.ADMINSTAFF1.github,
			PersonKind.ADMINSTAFF
		);
		await dc.writePerson(p);

		// staff person (this username should be on the "staff" team, but not the "admin" team in the github org)
		p = TestHarness.createPerson(TestHarness.STAFF1.id, TestHarness.STAFF1.csId, TestHarness.STAFF1.github, PersonKind.STAFF);
		await dc.writePerson(p);

		// admin person (this username should be on the "admin" team in the github org)
		p = TestHarness.createPerson(TestHarness.ADMIN1.id, TestHarness.ADMIN1.csId, TestHarness.ADMIN1.github, PersonKind.ADMIN);
		await dc.writePerson(p);

		Log.test("Test::preparePeople() - end");
	}

	public static async prepareTeams(): Promise<void> {
		Log.test("Test::prepareTeams() - start");
		try {
			const db = DatabaseController.getInstance();

			let team = await TestHarness.createTeam(TestHarness.TEAMNAME1, TestHarness.DELIVID0, [
				TestHarness.USER1.id,
				TestHarness.USER2.id,
			]);
			await db.writeTeam(team);

			// user 1 has a different partner for d1
			team = await TestHarness.createTeam(TestHarness.TEAMNAME2, TestHarness.DELIVID1, [TestHarness.USER1.id, TestHarness.USER3.id]);
			await db.writeTeam(team);
		} catch (err) {
			Log.error("Test::prepareTeams() - ERROR: " + err);
		}
		Log.test("Test::prepareTeams() - end");
	}

	public static async createTeam(teamId: string, delivId: string, personIds: string[]): Promise<Team> {
		const pc = new PersonController();
		const people: Person[] = [];

		for (const pid of personIds) {
			const p = await pc.getPerson(pid);
			people.push(p);
		}
		const dc = new DeliverablesController();
		const deliv = await dc.getDeliverable(delivId);
		const tc = new TeamController();
		return await tc.createTeam(teamId, deliv, people, {});
	}

	public static async createRepository(repoName: string, delivName: string, teamName: string): Promise<Repository> {
		const tc = new TeamController();
		const rc = new RepositoryController();
		const dc = new DeliverablesController();

		const deliv = await dc.getDeliverable(delivName);
		const team = await tc.getTeam(teamName);
		return await rc.createRepository(repoName, deliv, [team], {});
	}

	public static async prepareRepositories(): Promise<void> {
		Log.test("Test::prepareRepositories() - start");
		try {
			const db = DatabaseController.getInstance();
			// const tc = new TeamController();
			// const rc = new RepositoryController();
			//
			// let team = await tc.getTeam(Test.TEAMNAME1);
			// let repo = await rc.createRepository(Test.REPONAME1, [team], {});

			let repo = await TestHarness.createRepository(TestHarness.REPONAME1, TestHarness.DELIVID1, TestHarness.TEAMNAME1);
			await db.writeRepository(repo);

			// team = await tc.getTeam(Test.TEAMNAME2);
			// repo = await rc.createRepository(Test.REPONAME2, [team], {});
			repo = await TestHarness.createRepository(TestHarness.REPONAME2, TestHarness.DELIVID1, TestHarness.TEAMNAME2);
			await db.writeRepository(repo);
		} catch (err) {
			Log.error("Test::prepareRepositories() - ERROR: " + err);
		}
		Log.test("Test::prepareRepositories() - end");
	}

	public static async prepareGrades(): Promise<void> {
		// NOTE: see FrontendDatasetGenerator for ideas
		const grade: GradePayload = {
			score: 100,
			comment: "comment",
			urlName: "urlName",
			URL: "URL",
			timestamp: new Date(Date.UTC(2018, 1, 1, 1, 1)).getTime(),
			custom: {},
		};

		const gc = new GradesController();
		// const valid =
		await gc.createGrade(TestHarness.REPONAME1, TestHarness.DELIVID1, grade);
	}

	public static async prepareResults(): Promise<void> {
		Log.test("Test::prepareResults() - start");
		// NOTE: see FrontendDatasetGenerator for ideas
		const dc = DatabaseController.getInstance();

		const tuples = [];
		tuples.push({
			team: await dc.getTeam(TestHarness.TEAMNAME1),
			repo: await dc.getRepository(TestHarness.REPONAME1),
		});
		tuples.push({
			team: await dc.getTeam(TestHarness.TEAMNAME2),
			repo: await dc.getRepository(TestHarness.REPONAME2),
		});

		// create the first one (used in autotest tests)
		let result = TestHarness.createResult(
			tuples[0].team.delivId,
			tuples[0].repo.id,
			tuples[0].team.personIds,
			TestHarness.getRandomInt(100),
			"sha"
		);
		await dc.writeResult(result);

		for (const tuple of tuples) {
			for (let i = 1; i < 10; i++) {
				const score = TestHarness.getRandomInt(100);

				result = TestHarness.createResult(tuple.team.delivId, tuple.repo.id, tuple.team.personIds, score);
				await dc.writeResult(result);
			}
		}
	}

	private static getRandomInt(max: number) {
		return Math.floor(Math.random() * Math.floor(max));
	}

	public static async prepareAuth(): Promise<void> {
		const dc = DatabaseController.getInstance();

		let auth: Auth = {
			personId: TestHarness.USER1.id,
			token: TestHarness.REALTOKEN,
		};
		await dc.writeAuth(auth);

		auth = {
			personId: TestHarness.GITHUB1.id,
			token: TestHarness.REALTOKEN,
		};
		await dc.writeAuth(auth);

		auth = {
			personId: TestHarness.ADMIN1.id,
			token: TestHarness.REALTOKEN,
		};
		await dc.writeAuth(auth);

		auth = {
			personId: TestHarness.ADMINSTAFF1.id,
			token: TestHarness.REALTOKEN,
		};
		await dc.writeAuth(auth);
	}

	public static createDeliverable(delivId: string): Deliverable {
		return {
			id: delivId,

			URL: "http://NOTSET",
			openTimestamp: new Date(1400000000000).getTime(),
			closeTimestamp: new Date(1500000000000).getTime(),
			gradesReleased: false,

			shouldProvision: true,
			importURL: Config.getInstance().getProp(ConfigKey.githubHost) + "/classytest/PostTestDoNotDelete.git#master",
			teamMinSize: 2,
			teamMaxSize: 2,
			teamSameLab: true,
			teamStudentsForm: true,
			teamPrefix: "t",
			repoPrefix: "",

			visibleToStudents: true,
			lateAutoTest: false,
			shouldAutoTest: true,
			autotest: {
				dockerImage: "testImage",
				studentDelay: 60 * 60 * 12, // 12h
				maxExecTime: 300,
				regressionDelivIds: [],
				custom: {},
			},

			rubric: {},
			custom: {},
		} as Deliverable;
	}

	public static createGrade(personId: string, delivId: string, score: number): Grade {
		return {
			personId,
			delivId,
			score,
			comment: "comment",
			timestamp: Date.now(),
			urlName: "name",
			URL: "URL",
			custom: {},
		} as Grade;
	}

	public static createPerson(id: string, csId: string, githubId: string, kind: PersonKind | null): Person {
		return {
			id: id,
			csId: csId,
			githubId: githubId,
			studentNumber: null,

			fName: "first_" + id,
			lName: "last_" + id,
			kind: kind,
			URL: Config.getInstance().getProp(ConfigKey.githubHost) + "/" + githubId,

			labId: null,

			custom: {},
		} as Person;
	}

	/**
	 * Expose CI check. Some tests require infrastructure that will not
	 * be accessible from individual dev machines.
	 */
	public static isCI(): boolean {
		const ci = process.env.CI;
		if (typeof ci !== "undefined" && Util.toBoolean(ci) === true) {
			Log.test("Test::isCI() - running in CI");
			return true;
		} else {
			Log.test("Test::isCI() - not running CI");
			return false;
		}
	}

	/**
	 * Determines whether slow tests should be executed. They will _always_ run on CI, but
	 * you can also set override = true to execute them locally. This is important if you
	 * are editing code that touches the stuff that might be slow (e.g., specifically
	 * GitHub-related functions).
	 *
	 * @returns {boolean}
	 */
	public static runSlowTest() {
		if (Factory.OVERRIDE || TestHarness.isCI() === true) {
			Log.test("Test::runSlowTest() - running in CI or overridden; not skipping");
			return true;
		} else {
			Log.test("Test::runSlowTest() - skipping (not CI)");
			return false;
		}
	}

	public static readonly TEAMNAME1 = "t1_d0_user1CSID_user2CSID";
	public static readonly TEAMNAME2 = "TESTteam2";
	public static readonly TEAMNAME3 = "TESTteam3";
	public static readonly TEAMNAME4 = "TESTteam4";
	public static readonly TEAMNAMEREAL = "t_d0_atest-04CSID_atest-05CSID";
	public static readonly INVALIDTEAMNAME = "InvalidTeamNameShouldNotExist";

	/**
	 * Creates user testing templates for real GitHub accounts configured in .env
	 * @param userKey ConfigKey property for user i.e., ConfigKey.githubAdmin
	 * @param num account number (atest-06 would be the number 6)
	 */
	public static getConfigUser(userKey: ConfigKey, num: number = null): any {
		const username = num ? Config.getInstance().getProp(userKey).split(",")[num - 1].trim() : Config.getInstance().getProp(userKey);
		return {
			id: username + "ID",
			csId: username + "CSID",
			github: username,
		};
	}

	// FAKE USERS -- NOT USED TO INTERACT WITH GITHUB AND WORK
	public static readonly USER1 = { id: "user1ID", csId: "user1CSID", github: "user1gh" };
	public static readonly USER2 = { id: "user2ID", csId: "user2CSID", github: "user2gh" };
	public static readonly USER3 = { id: "user3ID", csId: "user3CSID", github: "user3gh" };
	public static readonly USER4 = { id: "user4ID", csId: "user4CSID", github: "user4gh" };
	public static readonly USER5 = { id: "user5ID", csId: "user5CSID", github: "user5gh" };
	public static readonly USER6 = { id: "user6ID", csId: "user6CSID", github: "user6gh" };
	public static readonly INVALIDUSER1 = { id: "invalidUser1id", csId: "invalidUser1CSID", github: "invalidUser1gh" };

	// REAL USERS -- CURRENTLY USED TO TEST ON GITHUB -- ENVSURE .ENV FILE CONTAINS REAL GITHUB USERS
	public static readonly ADMIN1 = TestHarness.getConfigUser(ConfigKey.githubAdmin);
	public static readonly ADMINSTAFF1 = TestHarness.getConfigUser(ConfigKey.githubAdminStaff);
	public static readonly STAFF1 = TestHarness.getConfigUser(ConfigKey.githubStaff);
	public static readonly REALUSER1 = TestHarness.getConfigUser(ConfigKey.githubTestUsers, 1);
	public static readonly REALUSER2 = TestHarness.getConfigUser(ConfigKey.githubTestUsers, 2);
	public static readonly REALUSER3 = TestHarness.getConfigUser(ConfigKey.githubTestUsers, 3);

	public static readonly GITHUB1 = TestHarness.getConfigUser(ConfigKey.githubTestUsers, 4);
	public static readonly GITHUB2 = TestHarness.getConfigUser(ConfigKey.githubTestUsers, 5);
	public static readonly GITHUB3 = TestHarness.getConfigUser(ConfigKey.githubTestUsers, 6);

	public static readonly REALBOTNAME1 = TestHarness.getConfigUser(ConfigKey.githubBot01); // was "cpscbot";
	public static readonly REALBOTNAME2 = TestHarness.getConfigUser(ConfigKey.githubBot02); // was "ubcbot";
	public static readonly REALUSERNAME = TestHarness.getConfigUser(ConfigKey.githubTestUsers, 1); // was "rthse2";

	public static readonly DELIVIDPROJ = "project";
	public static readonly DELIVID0 = "d0";
	public static readonly DELIVID1 = "d1";
	public static readonly DELIVID2 = "d2";
	public static readonly DELIVID3 = "d3";
	public static readonly ASSIGNID0 = "a0";
	public static readonly ASSIGNID1 = "a1";

	public static readonly REPONAME1 = "TESTrepo1";
	public static readonly REPONAME2 = "TESTrepo2";
	public static readonly REPONAME3 = "TESTrepo3";
	public static readonly REPONAMEREAL = "d0_atest-04CSID_atest-05CSID";
	public static readonly INVALIDREPONAME = "InvalidRepoNameShouldNotExist";

	public static readonly REUSABLETEAMNAME = "testTeamName_" + Date.now();

	public static readonly REPONAMEREAL_POSTTEST = "PostTestDoNotDelete";
	public static readonly REPONAMEREAL_TESTINGSAMPLE = "TESTING_SAMPLE_REPO";
	public static readonly REPOBRANCHREAL_TESTINGSAMPLE = "test-branch";
	public static readonly REPOSUBDIRREAL_TESTINGSAMPLE = "subdirectory";
	public static readonly REPOSEEDFILEREAL_TESTINGSAMPLE = "README.md";
	public static readonly REPOSUBDIRSEEDFILEREAL_TESTINGSAMPLE = "NESTED.txt";

	public static readonly REALTOKEN = "realtoken";
	public static readonly FAKETOKEN = "faketoken";

	public static readonly ASSIGNTEAMNAME0 = TestHarness.ASSIGNID0 + "__" + TestHarness.REALUSER1.id;
	public static readonly ASSIGNTEAMNAME1 = TestHarness.ASSIGNID1 + "__" + TestHarness.REALUSER1.id;

	public static getDeliverable(delivId: string): Deliverable {
		const deliv: Deliverable = {
			id: delivId,

			URL: "https://NOTSET",
			openTimestamp: -1,
			closeTimestamp: -1,
			gradesReleased: false,
			// delay:            -1,
			shouldProvision: false,
			importURL: Config.getInstance().getProp(ConfigKey.githubHost) + "/classytest/" + TestHarness.REPONAMEREAL_POSTTEST + ".git",
			teamMinSize: 1,
			teamMaxSize: 1,
			teamSameLab: false,
			teamStudentsForm: false,
			teamPrefix: "team",
			repoPrefix: "",
			// bootstrapUrl:     "",
			lateAutoTest: false,
			shouldAutoTest: true,
			autotest: {
				dockerImage: "testImage",
				studentDelay: 60 * 60 * 12, // 12h
				maxExecTime: 300,
				regressionDelivIds: [],
				custom: {},
			},
			visibleToStudents: true,
			rubric: {},
			custom: {},
		};
		return Util.clone(deliv) as Deliverable;
	}

	public static getPerson(id: string): Person {
		const p: Person = {
			id: id,
			csId: id,
			githubId: id,
			studentNumber: Number((Math.random() * 100000).toFixed(0)),

			fName: "f" + id,
			lName: "l" + id,
			kind: null,
			URL: null,

			labId: null,

			custom: {},
		};
		return Util.clone(p) as Person;
	}

	public static getGrade(delivId: string, personId: string, score: number): Grade {
		const grade: Grade = {
			personId: personId,
			delivId: delivId,

			score: score,
			comment: "",
			timestamp: Date.now(),

			urlName: "urlName",
			URL: "url",

			custom: {},
		};
		return Util.clone(grade) as Grade;
	}

	public static getTeam(teamId: string, delivId: string, people: string[]): Team {
		const team: Team = {
			id: teamId,
			delivId: delivId,
			githubId: null,
			// URL:       Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
			//            Config.getInstance().getProp(ConfigKey.org) + "/teams/" + teamId,
			// repoName:  null,
			// repoUrl:   null,
			URL: null,
			personIds: people,
			custom: {},
		};
		return Util.clone(team) as Team;
	}

	public static getRepository(id: string, delivId: string, teamId: string): Repository {
		const repo: Repository = {
			id: id,
			delivId: delivId,
			URL: Config.getInstance().getProp(ConfigKey.githubHost) + "/" + id,
			cloneURL: Config.getInstance().getProp(ConfigKey.githubHost) + "/" + id + ".git",
			teamIds: [teamId],
			custom: {},
		};
		return Util.clone(repo) as Repository;
	}

	public static createCourseRecord(): Course {
		const courseId = Config.getInstance().getProp(ConfigKey.name);
		return {
			id: courseId,
			defaultDeliverableId: null,
			custom: {},
		} as Course;
	}

	public static createResult(delivId: string, repoId: string, people: string[], score: number, sha?: string): Result {
		const ts = Date.now() - Math.random() * 1000 * 600;
		const projectURL =
			Config.getInstance().getProp(ConfigKey.githubHost) + "/" + Config.getInstance().getProp(ConfigKey.org) + "/" + repoId;
		const commitURL = projectURL + "/commits/FOOOSHA";

		const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
		const passNames = [];
		const failNames = [];
		const errorNames = [];
		const skipNames = [];
		for (const n of names) {
			const res = this.getRandomInt(3);
			if (res === 0) {
				passNames.push(n);
			} else if (res === 1) {
				failNames.push(n);
			} else if (res === 2) {
				skipNames.push(n);
			} else {
				errorNames.push(n);
			}
		}

		if (typeof sha === "undefined") {
			sha = "sha" + Date.now() + Math.random() * 1000 + Math.random() * 1000 + Math.random() * 1000;
		}

		const output: ContainerOutput = {
			// commitURL:          commitURL,
			timestamp: ts,
			report: {
				scoreOverall: score,
				scoreTest: Math.random() * 100,
				scoreCover: Math.random() * 100,
				passNames: passNames,
				failNames: failNames,
				errorNames: errorNames,
				skipNames: skipNames,
				custom: {},
				feedback: "feedback",
				result: "SUCCESS",
				attachments: [],
			},
			postbackOnComplete: true,
			custom: {},
			state: ContainerState.SUCCESS,
			graderTaskId: "",
		};

		const input: ContainerInput = {
			target: {
				delivId: delivId,
				repoId: repoId,

				ref: "refs/heads/main",
				cloneURL: "cloneURL",
				commitSHA: sha,
				commitURL: commitURL,

				botMentioned: false,
				adminRequest: false,
				shouldPromote: false,
				personId: null,
				kind: "push",

				// projectURL:  projectURL,
				postbackURL: "postbackURL",
				timestamp: ts,
			},
			containerConfig: {
				dockerImage: "imageName",
				studentDelay: 300,
				maxExecTime: 6000,
				regressionDelivIds: [],
				custom: {},
				openTimestamp: 0,
				closeTimestamp: 10000,
				lateAutoTest: true,
			},
			// delivId: delivId,
		};

		const result: Result = {
			delivId: delivId,
			repoId: repoId,
			// timestamp: ts,
			commitURL: commitURL,
			commitSHA: sha,
			input: input,
			output: output,
			people: people,
		};

		return Util.clone(result) as Result;
	}

	public static createContainerInput(): ContainerInput {
		const input: ContainerInput = {
			// delivId: "", // TBD
			containerConfig: {} as AutoTestConfigTransport,
			target: {
				delivId: "", // TBD
				repoId: "", // TBD

				cloneURL: "cloneURL",
				commitSHA: "", // TBD
				commitURL: "", // TBD

				botMentioned: false,
				adminRequest: false,
				shouldPromote: false,
				personId: null,
				kind: "push",

				ref: "", // TBD
				// projectURL:  projectURL,
				postbackURL: "postbackURL",
				timestamp: -1, // TBD
			},
		};
		return input;
	}

	public static async deleteStaleRepositories(): Promise<boolean> {
		Log.test("GlobalSpec::deleteStaleRepositories() - start");
		const start = Date.now();

		const TESTREPONAMES = [
			"testtest__repo1",
			"secap_cpscbot",
			"secap_rthse2",
			"secap_ubcbot",
			"secap_testtest__repo1",
			"TESTrepo1",
			"TESTrepo2",
			"TESTrepo3",
			"a0__rthse2",
			"a0_rthse2",
			this.REPONAME1,
			this.REPONAMEREAL,
		];

		const TESTTEAMNAMES = [
			"rtholmes",
			"ubcbot",
			"rthse2",
			"cpscbot",
			"TEST__X__t_TESTteam1",
			"TESTteam1",
			"TESTteam2",
			"TESTteam3",
			this.TEAMNAMEREAL,
		];

		const DELAY_SHORT = 200;
		const ASSIGNREPO1 = "TEST__X__secap_" + TestHarness.ASSIGNID0;
		const ASSIGNREPO2 = "TEST__X__secap_" + TestHarness.ASSIGNID1;
		const TEAMNAME = "TEST__X__t_" + TestHarness.TEAMNAME1;

		// loop through both kinds of GitHubAction (cached and live) to make sure they are consistent
		const ghactions = [GitHubActions.getInstance(true), GitHubActions.getInstance(false)];

		for (const gh of ghactions) {
			const repos = await gh.listRepos();

			// delete test repos if needed
			for (const repo of repos) {
				for (const r of TESTREPONAMES) {
					if (repo.repoName === r) {
						Log.info("Removing stale repo: " + repo.repoName);
						await gh.deleteRepo(r);
						await Util.delay(DELAY_SHORT);
						// expect(val).to.be.true;
					}
				}
			}

			// delete test repos if needed
			for (const repo of repos) {
				Log.info("Evaluating repo: " + repo.repoName);
				if (
					repo.repoName.indexOf("TEST__X__") === 0 ||
					repo.repoName.startsWith(ASSIGNREPO1) ||
					repo.repoName.startsWith(ASSIGNREPO2) ||
					repo.repoName.startsWith("test_") ||
					repo.repoName.startsWith(TestHarness.ASSIGNID0 + "_") ||
					repo.repoName.startsWith(TestHarness.ASSIGNID1 + "_") ||
					repo.repoName.endsWith("_grades")
				) {
					Log.info("Removing stale repo: " + repo.repoName);
					await gh.deleteRepo(repo.repoName);
					// expect(val).to.be.true;
					const teamName = repo.repoName.substr(15);
					Log.info("Adding stale team name: " + repo.repoName);
					TESTTEAMNAMES.push(teamName);
				}
			}

			// delete teams if needed
			const teams = await gh.listTeams();
			// expect(teams).to.be.an("array");
			// expect(teams.length > 0).to.be.true; // can have 0 teams
			Log.test("All Teams: " + JSON.stringify(teams));
			Log.test("Stale Teams: " + JSON.stringify(TESTTEAMNAMES));
			for (const team of teams) {
				// Log.info("Evaluating team: " + JSON.stringify(team));
				let done = false;
				// for (const t of TESTTEAMNAMES) {
				//     if (team.teamName === t ||
				if (team.teamName.startsWith(TestHarness.ASSIGNID0 + "_")) {
					Log.test("Removing stale team: " + team.teamName);
					// const val = await gh.deleteTeam(team.teamNumber);
					await gh.deleteTeam(team.teamName);
					await Util.delay(DELAY_SHORT);
					done = true;
				}
				// }
				if (done === false) {
					if (team.teamName.startsWith(TEAMNAME) === true) {
						Log.test("Removing stale team: " + team.teamName);
						// await gh.deleteTeam(team.teamNumber);
						await gh.deleteTeam(team.teamName);
						await Util.delay(DELAY_SHORT);
					}
				}
			}
		}
		Log.test("GitHubActionSpec::deleteStale() - done; took: " + Util.took(start));
		return true;
	}
}
