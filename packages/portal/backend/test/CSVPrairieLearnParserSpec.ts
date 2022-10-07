import {expect} from "chai";
import "mocha";

import Log from "@common/Log";
import {TestHarness} from "@common/TestHarness";
import "@common/GlobalSpec";

import {GradesController} from "@backend/controllers/GradesController";
import {CSVPrairieLearnParser} from "@backend/server/common/CSVPrairieLearnParser";

describe("CSVPrairieLearnParser", function () {

    before(async () => {
        await TestHarness.suiteBefore("CSVPrairieLearnParser");
        await TestHarness.prepareAll();
    });

    it("Should be able to process an empty grade sheet", async function () {
        const path = __dirname + "/data/prairieEmpty.csv";
        let rows = null;
        let ex = null;
        try {
            const csv = new CSVPrairieLearnParser();
            rows = await csv.processGrades(TestHarness.ADMIN1.id, path);
            Log.test("# rows processed: " + rows.length);
        } catch (err) {
            ex = err;
        }
        expect(rows).to.be.null;
        expect(ex).to.not.be.null;
    });

    it("Should be able to process a valid grade sheet", async function () {
        // check pre
        Log.test("check grades before");
        const gc = new GradesController();
        let grade = await gc.getGrade(TestHarness.USER1.id, TestHarness.DELIVID1);
        expect(grade.score).to.equal(100);
        grade = await gc.getGrade(TestHarness.USER2.id, TestHarness.DELIVID1);
        expect(grade.score).to.equal(100);
        grade = await gc.getGrade(TestHarness.USER3.id, TestHarness.DELIVID1);
        expect(grade).to.be.null;

        // do upload
        const path = __dirname + "/data/prairieValid.csv";
        const csv = new CSVPrairieLearnParser();
        Log.test("process sheet");
        const rows = await csv.processGrades(TestHarness.ADMIN1.id, path);
        Log.test("# rows processed: " + rows.length);
        expect(rows).to.have.lengthOf(3);

        // validate outcome
        Log.test("check grades after");
        grade = await gc.getGrade(TestHarness.USER1.id, TestHarness.DELIVID1);
        expect(grade.score).to.equal(79.375);
        grade = await gc.getGrade(TestHarness.USER2.id, TestHarness.DELIVID1);
        expect(grade.score).to.equal(65);
        grade = await gc.getGrade(TestHarness.USER3.id, TestHarness.DELIVID1);
        expect(grade.score).to.equal(13.75);
    });

    it("Should not be able to process an invalid grade sheet", async function () {
        let rows = null;
        let ex = null;
        try {
            const path = __dirname + "/data/gradesInvalid.csv";
            const csv = new CSVPrairieLearnParser();
            rows = await csv.processGrades(TestHarness.ADMIN1.id, path);
        } catch (err) {
            ex = err;
        }
        expect(rows).to.be.null;
        expect(ex).to.not.be.null;
    });
});
