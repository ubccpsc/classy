import {expect} from "chai";
import "mocha";
import {GradesController} from "../src/controllers/GradesController";
import {Test} from "./GlobalSpec";
import * as crypto from "crypto";
import Log from "../src/util/Log";

const loadFirst = require('./GlobalSpec');
const rFirst = require('./RepositoryControllerSpec');

describe("GradeController", () => {

    let gc: GradesController;

    before(async () => {
    });

    beforeEach(() => {
        gc = new GradesController();
    });

    it("Should be able to get all grades, even if there are none.", async () => {
        let grades = await gc.getAllGrades(Test.ORGNAME);
        expect(grades).to.have.lengthOf(0);
    });

    it("Should be able to create a grade.", async () => {
        let grades = await gc.getAllGrades(Test.ORGNAME);
        expect(grades).to.have.lengthOf(0);

        let valid = await gc.createGrade(Test.ORGNAME, Test.REPONAME1, Test.DELIVID1, 100, 'comment', 'URL');
        expect(valid).to.be.true;
        grades = await gc.getAllGrades(Test.ORGNAME);
        expect(grades).to.have.lengthOf(2);
        expect(grades[0].score).to.equal(100);
    });

    it("Should be able to update a grade.", async () => {
        let grades = await gc.getAllGrades(Test.ORGNAME);
        expect(grades).to.have.lengthOf(2); // from previous

        let valid = await gc.createGrade(Test.ORGNAME, Test.REPONAME1, Test.DELIVID1, 50, 'commentup', 'URLup');
        expect(valid).to.be.true;
        grades = await gc.getAllGrades(Test.ORGNAME);
        expect(grades).to.have.lengthOf(2); // still two (one for each teammember)
        expect(grades[0].score).to.equal(50);
        expect(grades[0].comment).to.equal('commentup');
        expect(grades[0].url).to.equal('URLup');
    });

    it("Should be able to get a grade for a user.", async () => {
        let grades = await gc.getAllGrades(Test.ORGNAME);
        expect(grades).to.have.lengthOf(2); // from previous

        let grade = await gc.getGrade(Test.ORGNAME, Test.USERNAME1, Test.DELIVID1);
        expect(grade).to.not.be.null;
        expect(grade.score).to.equal(50);
    });

});
