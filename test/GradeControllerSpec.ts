const loadFirst = require('./GlobalSpec');

import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {GradesController} from "../src/controllers/GradesController";

describe("GradeController", () => {

    let ORGNAME: string;
    let gc: GradesController;

    const TEAMNAME1 = 'user1';
    const USERNAME1 = 'user1';
    const USERNAME2 = 'user2';

    const DELIVID1 = 'd1';
    const DELIVID2 = 'd2';

    before(async () => {
        ORGNAME = Config.getInstance().getProp('org');
    });

    beforeEach(() => {
        gc = new GradesController();
    });

    it("Should be able to get all grades, even if there are none.", async () => {
        let grades = await gc.getAllGrades(ORGNAME);
        expect(grades).to.have.lengthOf(0);
    });

    it("Should be able to create a grade.", async () => {
        let grades = await gc.getAllGrades(ORGNAME);
        expect(grades).to.have.lengthOf(0);

        let valid = await gc.createGrade(ORGNAME, USERNAME1, DELIVID1, 100, 'comment', 'URL');
        expect(valid).to.not.be.null;
        grades = await gc.getAllGrades(ORGNAME);
        expect(grades).to.have.lengthOf(1);
        expect(grades[0].score).to.equal(100);
    });

    it("Should be able to update a grade.", async () => {
        let grades = await gc.getAllGrades(ORGNAME);
        expect(grades).to.have.lengthOf(1); // from previous

        let valid = await gc.createGrade(ORGNAME, USERNAME1, DELIVID1, 50, 'commentup', 'URLup');
        expect(valid).to.not.be.null;
        grades = await gc.getAllGrades(ORGNAME);
        expect(grades).to.have.lengthOf(1); // still one
        expect(grades[0].score).to.equal(50);
        expect(grades[0].comment).to.equal('commentup');
        expect(grades[0].url).to.equal('URLup');
    });
});
