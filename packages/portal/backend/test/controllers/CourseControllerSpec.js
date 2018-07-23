"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const chai_1 = require("chai");
const CourseController_1 = require("../../src/controllers/CourseController");
const GradesController_1 = require("../../src/controllers/GradesController");
const RepositoryController_1 = require("../../src/controllers/RepositoryController");
const TeamController_1 = require("../../src/controllers/TeamController");
const PersonController_1 = require("../../src/controllers/PersonController");
const GitHubController_1 = require("../../src/controllers/GitHubController");
const Config_1 = require("../../../../common/Config");
const GlobalSpec_1 = require("../GlobalSpec");
const load1 = require('../GlobalSpec');
const load2 = require('./GradeControllerSpec');
const load3 = require('../xRunLast/TestDatasetGeneratorSpec');
class TestData {
    constructor() {
    }
}
exports.TestData = TestData;
describe("CourseController", () => {
    let cc;
    let gc;
    let tc;
    let rc;
    let pc;
    let data;
    before(() => __awaiter(this, void 0, void 0, function* () {
    }));
    beforeEach(() => {
        data = new TestData();
        const ghInstance = new GitHubController_1.TestGitHubController();
        cc = new CourseController_1.CourseController(ghInstance);
        rc = new RepositoryController_1.RepositoryController();
        gc = new GradesController_1.GradesController();
        tc = new TeamController_1.TeamController();
        pc = new PersonController_1.PersonController();
    });
    it("Should be able to get the config name.", () => __awaiter(this, void 0, void 0, function* () {
        const res = yield CourseController_1.CourseController.getName();
        chai_1.expect(res).to.equal(Config_1.ConfigCourses.classytest);
    }));
    it("Should not be able to get a user that doesn't exist.", () => __awaiter(this, void 0, void 0, function* () {
        const USERNAME = "UNKNOWNUSER" + new Date().getTime();
        const res = yield cc.handleUnknownUser(USERNAME);
        chai_1.expect(res).to.equal(null); // nothing should be returned
        const person = yield pc.getPerson(USERNAME); // get user
        chai_1.expect(person).to.equal(null); // should not exist
    }));
    it("Should be able to get a list of students.", () => __awaiter(this, void 0, void 0, function* () {
        const res = yield cc.getStudents();
        chai_1.expect(res).to.be.an('array');
        chai_1.expect(res.length).to.be.greaterThan(0);
        const s = {
            firstName: 'p1first',
            lastName: 'p1last',
            userName: 'p1',
            userUrl: Config_1.default.getInstance().getProp(Config_1.ConfigKey.githubHost) + '/p1',
            studentNum: 1,
            labId: 'l1a'
        };
        chai_1.expect(res).to.deep.include(s); // make sure at least one student with the right format is in there
    }));
    it("Should be able to get a list of deliverables.", () => __awaiter(this, void 0, void 0, function* () {
        const res = yield cc.getDeliverables();
        chai_1.expect(res).to.be.an('array');
        chai_1.expect(res.length).to.be.greaterThan(0);
        const e = {
            id: 'd1',
            url: 'http://NOTSET',
            gradesReleased: false,
            minTeamSize: 1,
            maxTeamSize: 2,
            teamsSameLab: true,
            studentsFormTeams: true
        };
        // Log.test(JSON.stringify(res));
        // expect(res).to.deep.include(d); // make sure at least one deliverable with the right format is in there
    }));
    it("Should be able to handle a new AutoTest grade.", () => __awaiter(this, void 0, void 0, function* () {
        const grade = {
            delivId: 'd0',
            score: 100,
            comment: '',
            urlName: 'commitName',
            URL: 'commitUrl',
            timestamp: Date.now(),
            custom: {},
            repoId: GlobalSpec_1.Test.REPONAME1,
            repoURL: 'repoUrl',
        };
        const res = yield cc.handleNewAutoTestGrade(grade);
        chai_1.expect(res).to.be.an('boolean');
        chai_1.expect(res).to.be.true;
    }));
    it("Should fail to handle a new AutoTest grade if the repoId is invalid.", () => __awaiter(this, void 0, void 0, function* () {
        const grade = {
            delivId: 'd0',
            score: 100,
            comment: '',
            urlName: 'commitName',
            URL: 'commitUrl',
            timestamp: Date.now(),
            custom: {},
            repoId: 'INVALIDID',
            repoURL: 'repoUrl',
        };
        const res = yield cc.handleNewAutoTestGrade(grade);
        chai_1.expect(res).to.be.an('boolean');
        chai_1.expect(res).to.be.false;
    }));
    it("Should should be able to get the course object.", () => __awaiter(this, void 0, void 0, function* () {
        const res = yield cc.getCourse();
        chai_1.expect(res).to.be.an('object');
        chai_1.expect(res.id).to.be.an('string');
        chai_1.expect(res.defaultDeliverableId).to.not.be.undefined;
        chai_1.expect(res.custom).to.be.an('object');
    }));
    it("Should should be able to update the course object.", () => __awaiter(this, void 0, void 0, function* () {
        const NEWID = Date.now() + 'id';
        const res = yield cc.getCourse();
        chai_1.expect(res.defaultDeliverableId).to.not.equal(NEWID);
        res.defaultDeliverableId = NEWID;
        res.custom.fooProperty = 'asdfasdf';
        yield cc.saveCourse(res);
        const newRes = yield cc.getCourse();
        chai_1.expect(newRes.defaultDeliverableId).to.equal(NEWID);
        chai_1.expect(newRes.custom.fooProperty).to.equal('asdfasdf');
        // reset course id
        res.defaultDeliverableId = null;
        delete res.custom.fooProperty;
        yield cc.saveCourse(res);
    }));
});
//# sourceMappingURL=CourseControllerSpec.js.map