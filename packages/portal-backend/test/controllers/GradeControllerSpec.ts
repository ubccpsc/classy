import {expect} from "chai";
import "mocha";

import {Test} from "../GlobalSpec";

import {GradesController} from "../../src/controllers/GradesController";
import {GradePayload} from "../../src/controllers/CourseController";

const loadFirst = require('../GlobalSpec');
const rFirst = require('./RepositoryControllerSpec');

describe("GradeController", () => {

    let gc: GradesController;

    before(async () => {
    });

    beforeEach(() => {
        gc = new GradesController();
    });

    it("Should be able to get all grades, even if there are none.", async () => {
        let grades = await gc.getAllGrades();
        expect(grades).to.have.lengthOf(0);
    });

    it("Should be able to create a grade.", async () => {
        let grades = await gc.getAllGrades();
        expect(grades).to.have.lengthOf(0);

        let grade: GradePayload = {
            score:     100,
            comment:   'comment',
            URL:       'URL',
            timestamp: Date.now(),
            custom:    {}
        };

        let valid = await gc.createGrade(Test.REPONAME1, Test.DELIVID1, grade);
        expect(valid).to.be.true;
        grades = await gc.getAllGrades();
        expect(grades).to.have.lengthOf(2);
        expect(grades[0].score).to.equal(100);
    });

    it("Should be able to update a grade.", async () => {
        let grades = await gc.getAllGrades();
        expect(grades).to.have.lengthOf(2); // from previous

        let grade: GradePayload = {
            score:     50,
            comment:   'commentup',
            URL:       'URLup',
            timestamp: Date.now(),
            custom:    {}
        };

        let valid = await gc.createGrade(Test.REPONAME1, Test.DELIVID1, grade);
        expect(valid).to.be.true;
        grades = await gc.getAllGrades();
        expect(grades).to.have.lengthOf(2); // still two (one for each teammember)
        expect(grades[0].score).to.equal(50);
        expect(grades[0].comment).to.equal('commentup');
        expect(grades[0].URL).to.equal('URLup');
    });

    it("Should be able to get a grade for a user.", async () => {
        let grades = await gc.getAllGrades();
        expect(grades).to.have.lengthOf(2); // from previous

        let grade = await gc.getGrade(Test.USERNAME1, Test.DELIVID1);
        expect(grade).to.not.be.null;
        expect(grade.score).to.equal(50);
    });

});
