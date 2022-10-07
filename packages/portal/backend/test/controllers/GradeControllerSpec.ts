import {expect} from "chai";
import "mocha";

import {TestHarness} from "@common/TestHarness";
import {AutoTestGradeTransport} from "@common/types/PortalTypes";
import {GradePayload} from "@common/types/SDMMTypes";

import {DeliverablesController} from "@backend/controllers/DeliverablesController";
import {GradesController} from "@backend/controllers/GradesController";

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
            custom: {}
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
            custom: {}
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

        data = {delivId: "d0"} as AutoTestGradeTransport;
        deliv = await gc.validateAutoTestGrade(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an("string");

        data = {delivId: "d0", score: 100} as AutoTestGradeTransport;
        deliv = await gc.validateAutoTestGrade(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an("string");

        data = {delivId: "d0", score: 100, comment: "comment"} as AutoTestGradeTransport;
        deliv = await gc.validateAutoTestGrade(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an("string");

        data = {delivId: "d0", score: 100, comment: "comment", urlName: "urlName"} as AutoTestGradeTransport;
        deliv = await gc.validateAutoTestGrade(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an("string");

        data = {
            delivId: "d0",
            score: 100,
            comment: "comment",
            urlName: "urlName",
            URL: "http://url"
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
            timestamp: new Date(Date.UTC(2018, 1, 1, 1, 1)).getTime()
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
            custom: {}
        } as AutoTestGradeTransport;
        deliv = await gc.validateAutoTestGrade(data);
        expect(deliv).to.be.null;
    });

});
