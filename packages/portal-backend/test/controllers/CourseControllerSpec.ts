const loadFirst = require('../GlobalSpec');
const rBefore = require('./GradeControllerSpec');

import "mocha";
import {expect} from "chai";

import {Test} from "../GlobalSpec";

import {CourseController} from "../../src/controllers/CourseController";
import {GradesController} from "../../src/controllers/GradesController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {PersonController} from "../../src/controllers/PersonController";
import {TestGitHubController} from "../../src/controllers/GitHubController";

export class TestData {

    constructor() {

    }
}

describe("CourseController", () => {

    let sc: CourseController;
    let gc: GradesController;
    let tc: TeamController;
    let rc: RepositoryController;
    let pc: PersonController;

    let data: TestData;

    before(async () => {

    });

    beforeEach(() => {
        data = new TestData();

        const ghInstance = new TestGitHubController();
        sc = new CourseController(ghInstance);
        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
    });

    it("Should not be able to get a user that doesn't exist.", async () => {
        const USERNAME = "UNKNOWNUSER" + new Date().getTime();
        const res = await sc.handleUnknownUser(Test.ORGNAME, USERNAME);
        expect(res).to.equal(null); // nothing should be returned

        const person = await pc.getPerson(Test.ORGNAME, USERNAME); // get user
        expect(person).to.equal(null); // should not exist
    });

});
