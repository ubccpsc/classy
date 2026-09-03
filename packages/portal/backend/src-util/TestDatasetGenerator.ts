import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import Util from "@common/Util";

import { DatabaseController } from "../src/controllers/DatabaseController";
import { DeliverablesController } from "../src/controllers/DeliverablesController";
import { PersonController } from "../src/controllers/PersonController";
import { RepositoryController } from "../src/controllers/RepositoryController";
import { TeamController } from "../src/controllers/TeamController";
import { Auth, Course, Deliverable, Person, PersonKind } from "../src/Types";

/**
 * Seeds the test database with a small course dataset: a course record, an admin, a
 * student, 40 generated students, auth tokens, five deliverables, two teams, and two
 * repositories.
 *
 * This used to live in test/xRunLast/TestDatasetGeneratorSpec.ts, where it was written as
 * seven assertion-free it() blocks. The directory name was intentional: it had to sort
 * last so that the other suites' suiteBefore() -> clearData() did not wipe the data back
 * out. That made file ordering a silent correctness dependency, and it inflated the pass
 * count with seven tests that didn't actually check anything.
 *
 * It is a script now because that is what it always was. Nothing in the test suite depends
 * on this data; the point is to leave a populated database behind to poke at.
 *
 * WARNING: writes to the database named by ConfigKey.testname. Do not point it at a real
 * course database.
 */
export class TestDatasetGenerator {
	private dc: DatabaseController;

	public constructor() {
		Log.trace("TestDatasetGenerator::<init> - start");
		this.dc = DatabaseController.getInstance();
	}

	public async generate(): Promise<void> {
		await this.generateCourse();
		await this.generateStudents();
		await this.generateAuthTokens();
		await this.generateDeliverables();
		await this.generateTeams();
		await this.generateRepos();

		Log.info("TestDatasetGenerator::generate() - preparing all");
		await TestHarness.prepareAll();
	}

	private async generateCourse(): Promise<void> {
		const course: Course = {
			id: Config.getInstance().getProp(ConfigKey.testname),
			defaultDeliverableId: "d0",
			custom: {},
		};

		await this.dc.writeCourseRecord(course);
		Log.info("TestDatasetGenerator::generateCourse() - done; id: " + course.id);
	}

	private async generateStudents(): Promise<void> {
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

		await this.createPersonIfMissing(pc, p);

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

		await this.createPersonIfMissing(pc, p);

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

			await this.createPersonIfMissing(pc, p);
		}

		Log.info("TestDatasetGenerator::generateStudents() - done");
	}

	/**
	 * createPerson() throws when the person already exists, which is expected on a re-run;
	 * this is idempotent by design so the script can be run repeatedly.
	 */
	private async createPersonIfMissing(pc: PersonController, p: Person): Promise<void> {
		try {
			await pc.createPerson(p);
		} catch (_err) {
			Log.trace("TestDatasetGenerator::createPersonIfMissing() - exists: " + p.id);
		}
	}

	private async generateAuthTokens(): Promise<void> {
		// create for an admin
		let a: Auth = { personId: TestHarness.ADMIN1.id, token: "TEST_TOKENADMIN" };
		await this.dc.writeAuth(a);

		// create for a student
		a = { personId: TestHarness.USER1.id, token: "TEST_TOKENSTUDENT" };
		await this.dc.writeAuth(a);

		Log.info("TestDatasetGenerator::generateAuthTokens() - done");
	}

	private async generateDeliverables(): Promise<void> {
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
			deliv.repoPrefix = "";
			deliv.openTimestamp = new Date().getTime();
			deliv.closeTimestamp = new Date().getTime();
			try {
				await dc.saveDeliverable(deliv);
			} catch (_err) {
				Log.trace("TestDatasetGenerator::generateDeliverables() - exists: " + deliv.id);
			}
		}

		Log.info("TestDatasetGenerator::generateDeliverables() - done");
	}

	private async generateTeams(): Promise<void> {
		const tc: TeamController = new TeamController();
		const pc: PersonController = new PersonController();

		let pA = await pc.getPerson("p1");
		let pB = await pc.getPerson("p2");
		const deliv = await this.dc.getDeliverable("d0");
		try {
			await tc.createTeam(TestHarness.TEAMNAME3, deliv, [pA, pB], {});
		} catch (_err) {
			Log.trace("TestDatasetGenerator::generateTeams() - exists: " + TestHarness.TEAMNAME3);
		}

		pA = await pc.getPerson("p3");
		pB = await pc.getPerson("p4");
		const pC = await pc.getPerson("p5");
		try {
			await tc.createTeam(TestHarness.TEAMNAME4, deliv, [pA, pB, pC], {});
		} catch (_err) {
			Log.trace("TestDatasetGenerator::generateTeams() - exists: " + TestHarness.TEAMNAME4);
		}

		Log.info("TestDatasetGenerator::generateTeams() - done");
	}

	private async generateRepos(): Promise<void> {
		const tc: TeamController = new TeamController();
		const rc: RepositoryController = new RepositoryController();
		const dc = new DeliverablesController();

		const teams = await tc.getAllTeams();
		const deliv = await dc.getDeliverable(TestHarness.DELIVID1);

		try {
			await rc.createRepository(TestHarness.REPONAME1, deliv, [teams[0]], {});
		} catch (_err) {
			Log.trace("TestDatasetGenerator::generateRepos() - exists: " + TestHarness.REPONAME1);
		}

		try {
			await rc.createRepository(TestHarness.REPONAME2, deliv, [teams[1]], {});
		} catch (_err) {
			Log.trace("TestDatasetGenerator::generateRepos() - exists: " + TestHarness.REPONAME2);
		}

		Log.info("TestDatasetGenerator::generateRepos() - done");
	}
}

const generator = new TestDatasetGenerator();
const start = Date.now();
generator
	.generate()
	.then(function () {
		Log.info("TestDatasetGenerator::generate() - complete; took: " + Util.took(start));
		process.exit(0);
	})
	.catch(function (err) {
		Log.error("TestDatasetGenerator::generate() - ERROR: " + err.message);
		process.exit(1);
	});
