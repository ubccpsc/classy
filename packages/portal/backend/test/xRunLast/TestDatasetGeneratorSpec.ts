import "mocha";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { PersonController } from "@backend/controllers/PersonController";
import { RepositoryController } from "@backend/controllers/RepositoryController";
import { TeamController } from "@backend/controllers/TeamController";
import { Auth, Course, Deliverable, Person, PersonKind } from "@backend/Types";

describe("TestDatasetGenerator", function () {
	before(async function () {
		// await Test.suiteBefore("TestDatasetGenerator");
	});

	it("Can generate the course object", async function () {
		const dc: DatabaseController = DatabaseController.getInstance();

		const course: Course = {
			id: Config.getInstance().getProp(ConfigKey.testname),
			defaultDeliverableId: "d0",
			custom: {},
		};

		await dc.writeCourseRecord(course);
	});

	it("Can generate some students", async function () {
		const pc: PersonController = new PersonController();

		// create an admin
		let p: Person = {
			id: TestHarness.ADMIN1.id,
			csId: TestHarness.ADMIN1.csId,
			githubId: TestHarness.ADMIN1.github,
			studentNumber: -1,

			fName: "adminFirst",
			lName: "adminLast",
			kind: null,
			URL: null,

			labId: null,

			custom: {},
		};

		try {
			await pc.createPerson(p);
		} catch (e) {
			// Person already exists, should fine fine
		}

		// create a student
		p = {
			id: TestHarness.USER1.id,
			csId: TestHarness.USER1.csId,
			githubId: TestHarness.USER1.github,
			studentNumber: -1,

			fName: "adminFirst",
			lName: "adminLast",
			kind: PersonKind.STUDENT,
			URL: null,

			labId: null,

			custom: {},
		};

		try {
			await pc.createPerson(p);
		} catch (e) {
			// Person already exists, should fine fine
		}

		for (let i = 0; i < 40; i++) {
			const pid = "p" + i;

			p = {
				id: pid,
				csId: pid,
				githubId: pid,
				studentNumber: i,

				fName: pid + "first",
				lName: pid + "last",
				kind: PersonKind.STUDENT,
				URL: null,

				labId: "l1a",

				custom: {},
			};

			try {
				await pc.createPerson(p);
			} catch (e) {
				// Person already exists, should fine fine
			}
		}
	});

	it("Can generate some auth tokens", async function () {
		const dc: DatabaseController = DatabaseController.getInstance();

		// create for an admin
		let a: Auth = { personId: TestHarness.ADMIN1.id, token: "TEST_TOKENADMIN" };
		await dc.writeAuth(a);

		// create for a student
		a = { personId: TestHarness.USER1.id, token: "TEST_TOKENSTUDENT" };
		await dc.writeAuth(a);
	});

	it("Can generate some deliverables", async function () {
		const dc: DeliverablesController = new DeliverablesController();

		const d: Deliverable = {
			id: "",

			URL: "http://NOTSET",
			openTimestamp: -1,
			closeTimestamp: -1,
			gradesReleased: false,
			visibleToStudents: true,

			shouldProvision: true,
			repoPrefix: "",
			teamPrefix: "t",
			importURL: null,
			teamMinSize: 1,
			teamMaxSize: 2,
			teamSameLab: true,
			teamStudentsForm: true,
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

			rubric: {},
			custom: {},
		};

		for (let i = 0; i < 5; i++) {
			const deliv = JSON.parse(JSON.stringify(d));
			deliv.id = "d" + i;
			deliv.repoPrefix = ""; // "d" + i + "_";
			deliv.openTimestamp = new Date().getTime();
			deliv.closeTimestamp = new Date().getTime();
			try {
				await dc.saveDeliverable(deliv);
			} catch (err) {
				// Fail silently, it"s fine, the deliverable already exists
			}
		}
	});

	it("Can generate some teams", async function () {
		const tc: TeamController = new TeamController();
		const pc: PersonController = new PersonController();
		const dc = DatabaseController.getInstance();

		let pA = await pc.getPerson("p1");
		let pB = await pc.getPerson("p2");
		const deliv = await dc.getDeliverable("d0");
		try {
			await tc.createTeam(TestHarness.TEAMNAME3, deliv, [pA, pB], {});
		} catch (err) {
			// Fail silently, it"s fine, the team already exists
		}

		pA = await pc.getPerson("p3");
		pB = await pc.getPerson("p4");
		const pC = await pc.getPerson("p5");
		try {
			await tc.createTeam(TestHarness.TEAMNAME4, deliv, [pA, pB, pC], {});
		} catch (err) {
			// Fail silently, it"s fine, the team already exists
		}
	});

	it("Can generate some repos", async function () {
		const tc: TeamController = new TeamController();

		const teams = await tc.getAllTeams();
		const rc: RepositoryController = new RepositoryController();
		const dc = new DeliverablesController();
		const deliv = await dc.getDeliverable(TestHarness.DELIVID1);
		try {
			await rc.createRepository(TestHarness.REPONAME1, deliv, [teams[0]], {});
		} catch (err) {
			// Fail silently, it"s fine, the team already exists
		}

		try {
			await rc.createRepository(TestHarness.REPONAME2, deliv, [teams[1]], {});
		} catch (err) {
			// Fail silently, it"s fine, the team already exists
		}
	});

	it("Run prepareAll at the end", async function () {
		Log.test("Finishing by preparing all");
		await TestHarness.prepareAll();
		Log.test("Finishing by preparing all - done");
	});
});
