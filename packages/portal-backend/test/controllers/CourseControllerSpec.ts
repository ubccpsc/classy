import "mocha";
import {expect} from "chai";

import {CourseController} from "../../src/controllers/CourseController";
import {GradesController} from "../../src/controllers/GradesController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {PersonController} from "../../src/controllers/PersonController";
import {TestGitHubController} from "../../src/controllers/GitHubController";
import Config, {ConfigKey} from "../../../common/Config";

const load1 = require('../GlobalSpec');
const load2 = require('./GradeControllerSpec');
const load3 = require('../xRunLast/TestDatasetGeneratorSpec');

export class TestData {

    constructor() {

    }
}

describe.only("CourseController", () => {

    let cc: CourseController;
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
        cc = new CourseController(ghInstance);
        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
    });

    it("Should not be able to get a user that doesn't exist.", async () => {
        const USERNAME = "UNKNOWNUSER" + new Date().getTime();
        const res = await cc.handleUnknownUser(USERNAME);
        expect(res).to.equal(null); // nothing should be returned

        const person = await pc.getPerson(USERNAME); // get user
        expect(person).to.equal(null); // should not exist
    });

    it("Should be able to get a list of students.", async () => {

        const res = await cc.getStudents();
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);

        const s = {
            firstName:  'p1first',
            lastName:   'p1last',
            userName:   'p1',
            userUrl:    Config.getInstance().getProp(ConfigKey.githubHost) + '/p1',
            studentNum: 1,
            labId:      'l1a'
        };

        expect(res).to.deep.include(s); // make sure at least one student with the right format is in there
    });

});
