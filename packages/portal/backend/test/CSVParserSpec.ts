import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { GradesController } from "@backend/controllers/GradesController";
import { CSVParser } from "@backend/server/common/CSVParser";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec";
import { Grade, PersonKind } from "@backend/Types";

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

	describe("grade sheets that are not keyed by CSID", function () {
		// NOTE: an admin exports marks from wherever they keep them, so the key column is often a
		// student number or a CWL rather than a Classy id. All of that mapping -- and every message
		// the admin sees when it goes wrong -- was uncovered.
		const dbc = DatabaseController.getInstance();

		async function personWithNumber(id: string, studentNumber: any): Promise<void> {
			const person = TestHarness.createPerson(id, id + "CSID", id + "gh", PersonKind.STUDENT);
			(person as any).studentNumber = studentNumber;
			await dbc.writePerson(person);
		}

		it("Should map a grade to a person by student number.", async function () {
			await personWithNumber("csvSnumPerson", "55555");

			const path = __dirname + "/data/gradesStudentNumber.csv";
			const grades = await new CSVParser().processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID0, path);
			Log.test("# grades: " + grades.length);

			expect(grades).to.have.lengthOf(1);
			const stored = await new GradesController().getGrade("csvSnumPerson", TestHarness.DELIVID0);
			expect(stored.score).to.equal(72);
		});

		it("Should map a student number that was stored as a number, not a string.", async function () {
			// Person.studentNumber is declared `number` but the classlist writes a string, so the
			// lookup has to work either way; a strict comparison silently dropped one of them
			await dbc.deletePerson(await dbc.getPerson("csvSnumPerson"));
			await personWithNumber("csvSnumPerson", 55555);

			const path = __dirname + "/data/gradesStudentNumber.csv";
			const grades = await new CSVParser().processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID0, path);
			expect(grades).to.have.lengthOf(1);
		});

		it("Should name the student numbers it could not find.", async function () {
			const path = __dirname + "/data/gradesUnknownStudentNumber.csv";

			let message: string = null;
			try {
				await new CSVParser().processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID0, path);
			} catch (err) {
				message = err.message;
			}
			Log.test("message: " + message);

			// the admin has to be able to see *which* row was wrong
			expect(message).to.contain("Unknown Student Numbers");
			expect(message).to.contain("99999999");
		});

		it("Should name the ids it could not find.", async function () {
			const path = __dirname + "/data/gradesUnknownCSID.csv";

			let message: string = null;
			try {
				await new CSVParser().processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID0, path);
			} catch (err) {
				message = err.message;
			}
			Log.test("message: " + message);

			expect(message).to.contain("Unknown ids");
			expect(message).to.contain("noSuchPerson");
		});

		it("Should refuse a sheet with no GRADE column.", async function () {
			const path = __dirname + "/data/gradesNoGradeColumn.csv";

			let message: string = null;
			try {
				await new CSVParser().processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID0, path);
			} catch (err) {
				message = err.message;
			}
			Log.test("message: " + message);
			expect(message).to.contain("GRADE column must be present");
		});

		it("Should refuse a sheet whose key column is not first.", async function () {
			// the parser keys off the first column, so a sheet with COMMENT first would silently map
			// grades to the wrong thing
			const path = __dirname + "/data/gradesBadFirstColumn.csv";

			let message: string = null;
			try {
				await new CSVParser().processGrades(TestHarness.ADMIN1.id, TestHarness.DELIVID0, path);
			} catch (err) {
				message = err.message;
			}
			Log.test("message: " + message);
			expect(message).to.contain("must be the first column");
		});
	});
});
