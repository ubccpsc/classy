import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GradesController } from "@backend/controllers/GradesController";
import { Grade, PersonKind } from "@backend/Types";
import { TestHarness } from "@common/TestHarness";
import { AutoTestGradeTransport } from "@common/types/PortalTypes";
import { GradePayload } from "@common/types/SDMMTypes";

import "@common/GlobalSpec"; // load first
import "./RepositoryControllerSpec";

describe("GradeController", () => {
	let gc: GradesController;

	before(async () => {
		await TestHarness.suiteBefore("GradeController");
		await TestHarness.preparePeople();
		await TestHarness.prepareAuth();
		await TestHarness.prepareDeliverables();
		await TestHarness.prepareTeams();
		await TestHarness.prepareRepositories();
	});

	beforeEach(() => {
		gc = new GradesController();
	});

	after(async () => {
		TestHarness.suiteAfter("GradeController");
	});

	it("Should be able to get all grades, even if there are none.", async () => {
		const grades = await gc.getAllGrades();
		expect(grades).to.have.lengthOf(0);
	});

	it("Should be able to create a grade.", async () => {
		let grades = await gc.getAllGrades();
		expect(grades).to.have.lengthOf(0);

		const grade: GradePayload = {
			score: 100,
			comment: "comment",
			urlName: "urlName",
			URL: "URL",
			timestamp: new Date(Date.UTC(2018, 1, 1, 1, 1)).getTime(),
			custom: {},
		};

		const valid = await gc.createGrade(TestHarness.REPONAME1, TestHarness.DELIVID1, grade);
		expect(valid).to.be.true;
		grades = await gc.getAllGrades();
		expect(grades).to.have.lengthOf(2);
		expect(grades[0].score).to.equal(100);
	});

	it("Should be able to update a grade.", async () => {
		let grades = await gc.getAllGrades();
		expect(grades).to.have.lengthOf(2); // from previous

		const grade: GradePayload = {
			score: 50,
			comment: "commentup",
			urlName: "urlName",
			URL: "URLup",
			timestamp: new Date(Date.UTC(2018, 1, 1, 1, 1)).getTime(),
			custom: {},
		};

		const valid = await gc.createGrade(TestHarness.REPONAME1, TestHarness.DELIVID1, grade);
		expect(valid).to.be.true;
		grades = await gc.getAllGrades();
		expect(grades).to.have.lengthOf(2); // still two (one for each team member)
		expect(grades[0].score).to.equal(50);
		expect(grades[0].comment).to.equal("commentup");
		expect(grades[0].URL).to.equal("URLup");
	});

	it("Should be able to get a grade for a user and deliverable.", async () => {
		const grades = await gc.getAllGrades();
		expect(grades).to.have.lengthOf(2); // from previous

		const grade = await gc.getGrade(TestHarness.USER1.id, TestHarness.DELIVID1);
		expect(grade).to.not.be.null;
		expect(grade.score).to.equal(50);
	});

	it("Should be able to get all released grades for a user.", async () => {
		let grades = await gc.getAllGrades();
		expect(grades).to.have.lengthOf(2); // from previous

		// close deliv
		const dc = new DeliverablesController();
		let deliv = await dc.getDeliverable(TestHarness.DELIVID1);
		deliv.gradesReleased = false;
		await dc.saveDeliverable(deliv);

		grades = await gc.getReleasedGradesForPerson(TestHarness.USER1.id);
		expect(grades.length).to.equal(0); // no deliverables have grades released

		deliv = await dc.getDeliverable(TestHarness.DELIVID1);
		deliv.gradesReleased = true;
		await dc.saveDeliverable(deliv);

		grades = await gc.getReleasedGradesForPerson(TestHarness.USER1.id);
		expect(grades.length).to.equal(1); // no deliverables have grades released
		expect(grades[0].score).to.equal(50);

		// check with a released deliverable that has no grade record
		deliv = TestHarness.getDeliverable(TestHarness.DELIVID2);
		deliv.gradesReleased = true;
		await dc.saveDeliverable(deliv);
		grades = await gc.getReleasedGradesForPerson(TestHarness.USER1.id);
		expect(grades.length).to.equal(2); // no deliverables have grades released
		expect(grades[0].delivId).to.equal(TestHarness.DELIVID1);
		expect(grades[0].score).to.equal(50);
		expect(grades[1].delivId).to.equal(TestHarness.DELIVID2);
		expect(grades[1].score).to.equal(null);
	});

	it("Should be able to invalidate bad grades.", async () => {
		let deliv = await gc.validateAutoTestGrade(undefined);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		deliv = await gc.validateAutoTestGrade(null);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		let data: AutoTestGradeTransport = {} as AutoTestGradeTransport;
		deliv = await gc.validateAutoTestGrade(data);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		data = { delivId: "d0" } as AutoTestGradeTransport;
		deliv = await gc.validateAutoTestGrade(data);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		data = { delivId: "d0", score: 100 } as AutoTestGradeTransport;
		deliv = await gc.validateAutoTestGrade(data);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		data = { delivId: "d0", score: 100, comment: "comment" } as AutoTestGradeTransport;
		deliv = await gc.validateAutoTestGrade(data);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		data = { delivId: "d0", score: 100, comment: "comment", urlName: "urlName" } as AutoTestGradeTransport;
		deliv = await gc.validateAutoTestGrade(data);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		data = {
			delivId: "d0",
			score: 100,
			comment: "comment",
			urlName: "urlName",
			URL: "http://url",
		} as AutoTestGradeTransport;
		deliv = await gc.validateAutoTestGrade(data);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		data = {
			delivId: "d0",
			score: 100,
			comment: "comment",
			urlName: "urlName",
			URL: "http://url",
			timestamp: new Date(Date.UTC(2018, 1, 1, 1, 1)).getTime(),
		} as AutoTestGradeTransport;
		deliv = await gc.validateAutoTestGrade(data);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		data = {
			delivId: "d0",
			score: 100,
			comment: "comment",
			urlName: "urlName",
			URL: "http://url",
			timestamp: new Date(Date.UTC(2018, 1, 1, 1, 1)).getTime(),
			custom: {},
		} as AutoTestGradeTransport;
		deliv = await gc.validateAutoTestGrade(data);
		expect(deliv).to.be.null;
	});

	describe("listing views", function () {
		// The grades page shows students only, which hides staff grades -- and staff repos are
		// provisioned so staff can see what students see, so those grades are real and are exactly
		// what you want when checking a grade sheet.
		const VIEW_DELIV = TestHarness.DELIVID1;

		async function personWithKind(id: string, kind: PersonKind): Promise<void> {
			const dbc = DatabaseController.getInstance();
			const p = TestHarness.createPerson(id, id + "CSID", id + "gh", kind);
			await dbc.writePerson(p);
			await dbc.writeGrade({
				personId: id,
				delivId: VIEW_DELIV,
				score: 50,
				comment: "",
				timestamp: Date.now(),
				urlName: null,
				URL: null,
				custom: {},
			});
		}

		before(async function () {
			await personWithKind("viewStudent", PersonKind.STUDENT);
			await personWithKind("viewWithdrawn", PersonKind.WITHDRAWN);
			await personWithKind("viewStaff", PersonKind.STAFF);
			await personWithKind("viewAdmin", PersonKind.ADMIN);
			await personWithKind("viewAdminStaff", PersonKind.ADMINSTAFF);
		});

		// other suites put grades on this deliverable too, so only this describe's own fixtures are
		// asserted on; what matters is which of THEM each view returns
		async function idsFor(view: any): Promise<string[]> {
			const grades = await gc.getAllGrades(view);
			return grades.filter((g) => g.delivId === VIEW_DELIV && g.personId.startsWith("view")).map((g) => g.personId);
		}

		it("Should default to students, as it always has.", async function () {
			const ids = await idsFor(undefined);
			expect(ids).to.contain("viewStudent");
			expect(ids, "withdrawn students stay hidden by default").to.not.contain("viewWithdrawn");
			expect(ids).to.not.contain("viewStaff");
		});

		it("Should return only students for the students view.", async function () {
			const ids = await idsFor("students");
			expect(ids).to.deep.equal(["viewStudent"]);
			expect(ids, "withdrawn students are not students here").to.not.contain("viewWithdrawn");
		});

		it("Should return staff, admins and adminstaff for the staff view.", async function () {
			const ids = await idsFor("staff");
			expect(ids).to.have.members(["viewStaff", "viewAdmin", "viewAdminStaff"]);
			expect(ids, "students are not staff").to.not.contain("viewStudent");
		});

		it("Should return everyone, withdrawn included, for the all view.", async function () {
			const ids = await idsFor("all");
			expect(ids).to.have.members(["viewStudent", "viewWithdrawn", "viewStaff", "viewAdmin", "viewAdminStaff"]);
		});
	});

	describe("bulk reads for the grades page", function () {
		// A deliverable of its own, so other suites' counts never see these grades; they are removed
		// again afterwards (there is no DatabaseController::deleteGrade, so this goes to the collection).
		const PERF_DELIV = "gradesPagePerfDeliv";
		const STUDENT = "perfStudent";

		function gradeFor(personId: string, score: number, displayScore: string): Grade {
			return {
				personId: personId,
				delivId: PERF_DELIV,
				score: score,
				comment: "",
				timestamp: Date.now(),
				urlName: null,
				URL: null,
				custom: { displayScore: displayScore },
			};
		}

		before(async function () {
			const dbc = DatabaseController.getInstance();
			await dbc.writePerson(TestHarness.createPerson(STUDENT, STUDENT + "CSID", STUDENT + "gh", PersonKind.STUDENT));
			await dbc.writeGrade(gradeFor(STUDENT, 50, "developing"));
			// a grade whose person does not exist, which every view must leave out
			await dbc.writeGrade(gradeFor("perfGhost", 60, "proficient"));
		});

		after(async function () {
			const dbc = DatabaseController.getInstance();
			await (await dbc.getCollection("grades")).deleteMany({ delivId: PERF_DELIV });
			await dbc.deletePerson(await dbc.getPerson(STUDENT));
		});

		it("Should return the same grades for every view as a lookup per grade did.", async function () {
			// getAllGrades now reads everyone once instead of looking each grade's person up in turn.
			// The expected list is built the old way, inline, from the same data.
			const dbc = DatabaseController.getInstance();
			for (const view of ["students", "staff", "all"] as const) {
				const expected: Grade[] = [];
				for (const grade of await dbc.getGrades()) {
					const person = await dbc.getPerson(grade.personId);
					if (person !== null && GradesController.matchesView(person, view)) {
						expected.push(grade);
					}
				}
				const actual = await gc.getAllGrades(view);
				expect(actual, view).to.deep.equal(expected);
				expect(
					actual.find((g) => g.personId === "perfGhost"),
					"a grade with no person is never returned"
				).to.be.undefined;
			}
		});

		it("Should keep regrade history out of bulk reads, but not out of the read that saves depend on.", async function () {
			// saveGrade nests the existing record under custom.previousGrade. The bulk reads exclude it
			// in the query now, where they used to delete it after it had crossed the wire; every other
			// field of custom must survive. getGrade still returns it, since saveGrade builds on it.
			const dbc = DatabaseController.getInstance();
			await gc.saveGrade(gradeFor(STUDENT, 70, "proficient"));

			const single = await dbc.getGrade(STUDENT, PERF_DELIV);
			expect(single.custom.previousGrade, "setup: the save must have stored the grade it replaced").to.not.be.undefined;
			expect(single.custom.previousGrade.score).to.equal(50);

			const reads: Array<[string, Grade[]]> = [
				["getGrades", await dbc.getGrades()],
				["getGradesForDeliverable", await dbc.getGradesForDeliverable(PERF_DELIV)],
			];
			for (const [name, grades] of reads) {
				const g = grades.find((each) => each.personId === STUDENT && each.delivId === PERF_DELIV);
				expect(g, name).to.not.be.undefined;
				expect(g.custom.previousGrade, name + " must not carry history").to.be.undefined;
				expect(g.custom.displayScore, name + " keeps the rest of custom").to.equal("proficient");
				expect(g.score, name).to.equal(70);
			}
		});
	});
});
