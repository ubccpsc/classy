import { expect } from "chai";
import "mocha";

import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import { GradesController } from "@backend/controllers/GradesController";
import { CSVParser } from "@backend/server/common/CSVParser";

import "@common/GlobalSpec";
import { Grade } from "@backend/Types";

describe("CSVParser", function () {
	before(async () => {
		await TestHarness.suiteBefore("CSVParser");
		await TestHarness.prepareAll();
	});

	it("Should be able to process an empty grade sheet", async function () {
		const path = __dirname + "/data/gradesEmpty.csv";
		const csv = new CSVParser();
		const rows = await csv.processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID0, path);
		Log.test("# rows processed: " + rows.length);
		expect(rows).to.have.lengthOf(0);
	});

	it("Should be able to process a valid grade sheet", async function () {
		// check pre
		const gc = new GradesController();
		let grade = await gc.getGrade(TestHarness.USER1.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(100);
		grade = await gc.getGrade(TestHarness.USER2.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(100);
		grade = await gc.getGrade(TestHarness.USER3.id, TestHarness.DELIVID1);
		expect(grade).to.be.null;

		// do upload
		const path = __dirname + "/data/gradesValid.csv";
		const csv = new CSVParser();
		const rows = await csv.processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID1, path);
		Log.test("# rows processed: " + rows.length);
		expect(rows).to.have.lengthOf(3);

		// validate outcome
		grade = await gc.getGrade(TestHarness.USER1.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(92);
		grade = await gc.getGrade(TestHarness.USER2.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(29);
		grade = await gc.getGrade(TestHarness.USER3.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(19);
	});

	it("Should be able to process a valid grade sheet where the grades are strings", async function () {
		// check pre
		const gc = new GradesController();
		let grade = await gc.getGrade(TestHarness.USER1.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(92);
		grade = await gc.getGrade(TestHarness.USER2.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(29);
		grade = await gc.getGrade(TestHarness.USER3.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(19);

		// do upload
		const path = __dirname + "/data/gradesValidBucket.csv";
		const csv = new CSVParser();
		const rows = await csv.processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID1, path);
		Log.test("# rows processed: " + rows.length);
		expect(rows).to.have.lengthOf(3);

		// validate outcome
		grade = await gc.getGrade(TestHarness.USER1.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(100);
		expect(grade.custom.displayScore).to.equal("EXTENDING");
		grade = await gc.getGrade(TestHarness.USER2.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(80);
		expect(grade.custom.displayScore).to.equal("PROFICIENT");
		grade = await gc.getGrade(TestHarness.USER3.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(0);
		expect(grade.custom.displayScore).to.equal("N/A");
	});

	it("Should be able to process a valid grade sheet where the grades are strings w/ github header", async function () {
		// check pre
		const gc = new GradesController();
		let grade: Grade;
		// do upload
		const path = __dirname + "/data/gradesValidBucketGithub.csv";
		const csv = new CSVParser();
		const rows = await csv.processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID1, path);
		Log.test("# rows processed: " + rows.length);
		expect(rows).to.have.lengthOf(3);

		// validate outcome
		grade = await gc.getGrade(TestHarness.USER1.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(99);
		expect(grade.custom.displayScore).to.equal("EXTENDING1");
		grade = await gc.getGrade(TestHarness.USER2.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(79);
		expect(grade.custom.displayScore).to.equal("PROFICIENT1");
		grade = await gc.getGrade(TestHarness.USER3.id, TestHarness.DELIVID1);
		expect(grade.score).to.equal(1);
		expect(grade.custom.displayScore).to.equal("N/A1");
	});

	it("Should not be able to process grades for an invalid deliverable", async function () {
		let rows = null;
		let ex = null;
		try {
			const path = __dirname + "/data/gradesValid.csv";
			const csv = new CSVParser();
			rows = await csv.processGrades(TestHarness.ADMIN1.id, "invalidDeliverableId", path);
		} catch (err) {
			ex = err;
		}
		expect(rows).to.be.null;
		expect(ex).to.not.be.null;
	});

	it("Should not be able to process an invalid grade sheet", async function () {
		let rows = null;
		let ex = null;
		try {
			const path = __dirname + "/data/gradesInvalid.csv";
			const csv = new CSVParser();
			rows = await csv.processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID1, path);
		} catch (err) {
			ex = err;
		}
		expect(rows).to.be.null;
		expect(ex).to.not.be.null;
	});

	it("Handle CSVs with inconsistent person IDs (GitHub)", async function () {
		let rows = null;
		let ex = null;
		try {
			const path = __dirname + "/data/gradesInconsistent.csv";
			const csv = new CSVParser();
			rows = await csv.processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID1, path);
		} catch (err) {
			ex = err;
		}
		expect(rows).to.be.null;
		expect(ex).to.not.be.null;
	});

	it("Handle CSVs with inconsistent person IDs (CWL)", async function () {
		let rows = null;
		let ex = null;
		try {
			const path = __dirname + "/data/gradesInconsistent2.csv";
			const csv = new CSVParser();
			rows = await csv.processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID1, path);
		} catch (err) {
			ex = err;
		}
		expect(rows).to.be.null;
		expect(ex).to.not.be.null;
	});
});
