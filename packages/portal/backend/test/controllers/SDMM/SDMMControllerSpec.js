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
const loadFirst = require('../../GlobalSpec');
const rBefore = require('../GradeControllerSpec');
const chai_1 = require("chai");
require("mocha");
const GlobalSpec_1 = require("../../GlobalSpec");
const Config_1 = require("../../../../../common/Config");
const Log_1 = require("../../../../../common/Log");
const SDMMTypes_1 = require("../../../../../common/types/SDMMTypes");
const SDMMController_1 = require("../../../src/controllers/SDMM/SDMMController");
const GradesController_1 = require("../../../src/controllers/GradesController");
const RepositoryController_1 = require("../../../src/controllers/RepositoryController");
const TeamController_1 = require("../../../src/controllers/TeamController");
const PersonController_1 = require("../../../src/controllers/PersonController");
const GitHubController_1 = require("../../../src/controllers/GitHubController");
class TestData {
    constructor() {
        this.TEAMD0 = "sddmd0test";
        this.TEAMD1 = "sddmd1test";
        this.REPOD0 = "sddmd0repotest";
        this.REPOD1 = "sddmd1repotest";
        this.USER = "sddmdusertest";
        this.PRNAME = "prd3id";
        this.u1 = "sddmU1";
        this.u2 = "sddmU2";
        this.u3 = "sddmU3";
        this.PERSON1 = null;
        this.PERSON2 = null;
        this.PERSON3 = null;
        this.PERSON1 = {
            id: this.u1,
            csId: this.u1,
            githubId: this.u1,
            studentNumber: null,
            fName: '',
            lName: '',
            kind: 'student',
            URL: 'https://github.com/' + this.u1,
            labId: 'UNKNOWN',
            custom: {}
        };
        this.PERSON2 = {
            id: this.u2,
            csId: this.u2,
            githubId: this.u2,
            studentNumber: null,
            fName: '',
            lName: '',
            kind: 'student',
            URL: 'https://github.com/' + this.u2,
            labId: 'UNKNOWN',
            custom: {}
        };
        this.PERSON3 = {
            id: this.u3,
            csId: this.u3,
            githubId: this.u3,
            studentNumber: null,
            fName: '',
            lName: '',
            kind: 'student',
            URL: 'https://github.com/' + this.u3,
            labId: 'UNKNOWN',
            custom: {}
        };
    }
}
exports.TestData = TestData;
describe("SDDM: SDMMController", () => {
    let sc;
    let gc;
    let tc;
    let rc;
    let pc;
    let data;
    let OLD_ORG = null;
    before(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test("SDMMControllerSpec::before()");
        Config_1.default.getInstance();
        OLD_ORG = Config_1.default.getInstance().config.org;
        Config_1.default.getInstance().config.org = 'secapstonetest';
    }));
    beforeEach(() => {
        data = new TestData();
        const ghInstance = new GitHubController_1.TestGitHubController();
        sc = new SDMMController_1.SDMMController(ghInstance);
        rc = new RepositoryController_1.RepositoryController();
        gc = new GradesController_1.GradesController();
        tc = new TeamController_1.TeamController();
        pc = new PersonController_1.PersonController();
    });
    after(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test("SDMMControllerSpec::after()");
        Config_1.default.getInstance();
        Config_1.default.getInstance().config.org = OLD_ORG;
    }));
    it("Should not be able to get a status for an invalid user.", () => __awaiter(this, void 0, void 0, function* () {
        let status = null;
        let ex = null;
        try {
            status = yield sc.getStatus('invalidUserWhoDoesNotExist29922');
        }
        catch (err) {
            ex = err;
        }
        chai_1.expect(ex).to.not.be.null;
        chai_1.expect(ex.message).to.equal('Error computing status for invalidUserWhoDoesNotExist29922; contact course staff.');
        chai_1.expect(status).to.be.null;
    }));
    it("Should be able to get a D0PRE status.", () => __awaiter(this, void 0, void 0, function* () {
        yield sc.handleUnknownUser(data.USER);
        yield pc.getPerson(data.USER);
        let status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D0PRE");
    }));
    it("Should be able to get a D0 status.", () => __awaiter(this, void 0, void 0, function* () {
        let status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D0PRE");
        const person = yield pc.getPerson(data.USER);
        const team = yield tc.createTeam(data.TEAMD0, [person], { sdmmd0: true });
        const repo = yield rc.createRepository(data.REPOD0, [team], { d0enabled: true });
        chai_1.expect(repo).to.not.be.null;
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D0");
    }));
    it("Should be able to get a D1UNLOCKED status.", () => __awaiter(this, void 0, void 0, function* () {
        let status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D0");
        let grade = {
            score: 59,
            comment: '',
            urlName: '',
            URL: '',
            timestamp: Date.now(),
            custom: {}
        };
        yield gc.createGrade(data.REPOD0, "d0", grade);
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D0");
        grade = {
            score: 61,
            comment: '',
            urlName: '',
            URL: '',
            timestamp: Date.now(),
            custom: {}
        };
        yield gc.createGrade(data.REPOD0, "d0", grade);
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D1UNLOCKED");
    }));
    it("Should be able to get a D1TEAMSET status.", () => __awaiter(this, void 0, void 0, function* () {
        let status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D1UNLOCKED");
        const person = yield pc.getPerson(data.USER);
        const team = yield tc.createTeam(data.TEAMD1, [person], { sdmmd1: true });
        chai_1.expect(team).to.not.be.null;
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D1TEAMSET");
    }));
    it("Should be able to get a D1 status.", () => __awaiter(this, void 0, void 0, function* () {
        let status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D1TEAMSET");
        const team = yield tc.getTeam(data.TEAMD1);
        const repo = yield rc.createRepository(data.REPOD1, [team], { d1enabled: true });
        chai_1.expect(repo).to.not.be.null;
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D1");
    }));
    it("Should be able to get a D2 status.", () => __awaiter(this, void 0, void 0, function* () {
        let status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D1");
        let grade = {
            score: 59,
            comment: '',
            urlName: '',
            URL: '',
            timestamp: Date.now(),
            custom: {}
        };
        yield gc.createGrade(data.REPOD1, "d1", grade);
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D1");
        grade = {
            score: 61,
            comment: '',
            urlName: '',
            URL: '',
            timestamp: Date.now(),
            custom: {}
        };
        yield gc.createGrade(data.REPOD1, "d1", grade);
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D2");
    }));
    it("Should be able to get a D3PRE status.", () => __awaiter(this, void 0, void 0, function* () {
        let status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D2");
        let grade = {
            score: 59,
            comment: '',
            urlName: '',
            URL: '',
            timestamp: Date.now(),
            custom: {}
        };
        yield gc.createGrade(data.REPOD1, "d2", grade);
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D2");
        grade = {
            score: 61,
            comment: '',
            urlName: '',
            URL: '',
            timestamp: Date.now(),
            custom: {}
        };
        yield gc.createGrade(data.REPOD1, "d2", grade);
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D3PRE");
    }));
    it("Should be able to get a D3 status.", () => __awaiter(this, void 0, void 0, function* () {
        let status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D3PRE");
        const repo = yield rc.createPullRequest(data.REPOD1, data.PRNAME, { sddmD3pr: true });
        chai_1.expect(repo).to.not.be.null;
        chai_1.expect(repo.custom.sddmD3pr).to.be.true;
        status = yield sc.getStatus(data.USER);
        chai_1.expect(status.status).to.equal("D3");
    }));
    it("Should not be able to provision a d0 repo for a random person.", () => __awaiter(this, void 0, void 0, function* () {
        let val = null;
        try {
            yield sc.provision(GlobalSpec_1.Test.DELIVID0, ["this is a random name #@"]);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val.message).to.not.be.undefined;
        chai_1.expect(val.message).to.equal('Username not registered; contact course staff.');
    }));
    it("Should not allow multiple people to be added to a d0 repo.", () => __awaiter(this, void 0, void 0, function* () {
        let person = yield pc.createPerson(data.PERSON1);
        chai_1.expect(person).to.not.be.null;
        let person2 = yield pc.createPerson(data.PERSON2);
        chai_1.expect(person2).to.not.be.null;
        let allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.be.empty;
        let allTeams = yield tc.getTeamsForPerson(person);
        chai_1.expect(allTeams).to.be.empty;
        let val = null;
        try {
            yield sc.provision(GlobalSpec_1.Test.DELIVID0, ['23234#$Q#@#invalid']);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val).to.not.be.null;
        chai_1.expect(val.message).to.equal('Username not registered; contact course staff.');
        allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.be.empty;
        val = null;
        try {
            yield sc.provision(GlobalSpec_1.Test.DELIVID0, [data.PERSON1.id, data.PERSON2.id]);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val).to.not.be.null;
        chai_1.expect(val.message).to.equal('D0 for indivduals only; contact course staff.');
        allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.be.empty;
    }));
    it("Should be able to provision a d0 repo for an individual.", () => __awaiter(this, void 0, void 0, function* () {
        let person = yield pc.getPerson(data.PERSON1.id);
        chai_1.expect(person).to.not.be.null;
        let allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.be.empty;
        let allTeams = yield tc.getTeamsForPerson(person);
        chai_1.expect(allTeams).to.be.empty;
        let payload = yield sc.provision(GlobalSpec_1.Test.DELIVID0, [data.PERSON1.id]);
        chai_1.expect(payload.success).to.not.be.undefined;
        chai_1.expect(payload.failure).to.be.undefined;
        const status = payload.success.status;
        chai_1.expect(status.status).to.equal(SDMMTypes_1.SDMMStatus[SDMMTypes_1.SDMMStatus.D0]);
        allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(1);
        chai_1.expect(allRepos[0].custom.d0enabled).to.be.true;
        allTeams = yield tc.getTeamsForPerson(person);
        chai_1.expect(allTeams).to.have.lengthOf(1);
        chai_1.expect(allTeams[0].custom.sdmmd0).to.be.true;
    }));
    it("Should not upgrade a d0 repo for an individual if the grade is too low.", () => __awaiter(this, void 0, void 0, function* () {
        let person = yield pc.getPerson(data.PERSON1.id);
        chai_1.expect(person).to.not.be.null;
        let val = null;
        try {
            yield sc.provision(GlobalSpec_1.Test.DELIVID1, [data.PERSON1.id]);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val).to.not.be.null;
        chai_1.expect(val.message).to.equal('Current d0 grade is not sufficient to move on to d1.');
        let allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(1);
        chai_1.expect(allRepos[0].custom.d0enabled).to.be.true;
        chai_1.expect(allRepos[0].custom.d1enabled).to.be.false;
        let allTeams = yield tc.getTeamsForPerson(person);
        chai_1.expect(allTeams).to.have.lengthOf(1);
        chai_1.expect(allTeams[0].custom.sdmmd0).to.be.true;
        chai_1.expect(allTeams[0].custom.sdmmd1).to.be.false;
    }));
    it("Should be able to upgrade a d0 repo for an individual.", () => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test("getting person");
        let person = yield pc.getPerson(data.PERSON1.id);
        chai_1.expect(person).to.not.be.null;
        Log_1.default.test("getting repo");
        let allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(1);
        let gradeR = {
            score: 65,
            comment: 'TESTCOMMENT',
            urlName: 'TESTURLNAME',
            URL: 'TESTURL',
            timestamp: Date.now(),
            custom: {}
        };
        Log_1.default.test("setting d0 grade");
        let grade = yield gc.createGrade(allRepos[0].id, GlobalSpec_1.Test.DELIVID0, gradeR);
        chai_1.expect(grade).to.be.true;
        Log_1.default.test("checking status");
        allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(1);
        chai_1.expect(allRepos[0].custom.d0enabled).to.be.true;
        chai_1.expect(allRepos[0].custom.d1enabled).to.be.false;
        Log_1.default.test('provisioning d1 repo');
        let payload = yield sc.provision(GlobalSpec_1.Test.DELIVID1, [data.PERSON1.id]);
        Log_1.default.test('provisioning d1 repo complete');
        chai_1.expect(payload.success).to.not.be.undefined;
        chai_1.expect(payload.failure).to.be.undefined;
        const status = payload.success.status;
        chai_1.expect(status.status).to.equal(SDMMTypes_1.SDMMStatus[SDMMTypes_1.SDMMStatus.D1]);
        Log_1.default.test(payload.success.message);
        Log_1.default.test("checking d1 repo status");
        allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(1);
        chai_1.expect(allRepos[0].custom.d0enabled).to.be.true;
        chai_1.expect(allRepos[0].custom.d1enabled).to.be.true;
        Log_1.default.test("checking d1 team status");
        let allTeams = yield tc.getTeamsForPerson(person);
        chai_1.expect(allTeams).to.have.lengthOf(1);
        chai_1.expect(allTeams[0].custom.sdmmd0).to.be.true;
        chai_1.expect(allTeams[0].custom.sdmmd1).to.be.true;
        let val = null;
        try {
            Log_1.default.test("ensuring we can't provision d1 again");
            yield sc.provision(GlobalSpec_1.Test.DELIVID1, [data.PERSON1.id]);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val).to.not.be.null;
        chai_1.expect(val.message).to.equal('D1 repo has already been assigned: TEST__X__p_TEST__X__t_sddmU1');
        allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(1);
    }));
    it("Should not be able to form a d1 team if a member does not exist or has insufficient d0 standing.", () => __awaiter(this, void 0, void 0, function* () {
        let person = yield pc.getPerson(data.PERSON2.id);
        chai_1.expect(person).to.not.be.null;
        let allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(0);
        let val = null;
        try {
            yield sc.provision(GlobalSpec_1.Test.DELIVID1, [data.PERSON2.id, "asdf32#@@#INVALIDPERSON"]);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val).to.not.be.null;
        chai_1.expect(val.message).to.equal('All teammates must have achieved a score of 60% or more to join a team.');
        allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(0);
        let allTeams = yield tc.getTeamsForPerson(person);
        chai_1.expect(allTeams).to.have.lengthOf(0);
        val = null;
        try {
            yield sc.provision(GlobalSpec_1.Test.DELIVID1, [data.PERSON2.id, data.PERSON3.id]);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val).to.not.be.null;
        chai_1.expect(val.message).to.equal('All teammates must have achieved a score of 60% or more to join a team.');
        allRepos = yield rc.getReposForPerson(person);
        chai_1.expect(allRepos).to.have.lengthOf(0);
        allTeams = yield tc.getTeamsForPerson(person);
        chai_1.expect(allTeams).to.have.lengthOf(0);
        val = null;
        try {
            yield sc.provision(GlobalSpec_1.Test.DELIVID1, []);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val).to.not.be.null;
        chai_1.expect(val.message).to.equal('Invalid # of people; contact course staff.');
        val = null;
        try {
            yield sc.provision(GlobalSpec_1.Test.DELIVID1, [data.PERSON2.id, data.PERSON2.id]);
        }
        catch (err) {
            val = err;
        }
        chai_1.expect(val).to.not.be.null;
        chai_1.expect(val.message).to.equal("D1 duplicate users; if you wish to work alone, please select 'work individually'.");
    }));
    it("Should be able to form a d1 team with a partner.", () => __awaiter(this, void 0, void 0, function* () {
        let person2 = yield pc.getPerson(data.PERSON2.id);
        chai_1.expect(person2).to.not.be.null;
        let payload = yield sc.provision(GlobalSpec_1.Test.DELIVID0, [person2.id]);
        chai_1.expect(payload.success).to.not.be.undefined;
        chai_1.expect(payload.success.status.status).to.equal(SDMMTypes_1.SDMMStatus[SDMMTypes_1.SDMMStatus.D0]);
        let allRepos = yield rc.getReposForPerson(person2);
        chai_1.expect(allRepos).to.have.lengthOf(1);
        let gradeR = {
            score: 65,
            comment: 'TESTCOMMENT',
            urlName: 'TESTURLNAME',
            URL: 'TESTURL',
            timestamp: Date.now(),
            custom: {}
        };
        let grade = yield gc.createGrade(allRepos[0].id, GlobalSpec_1.Test.DELIVID0, gradeR);
        chai_1.expect(grade).to.be.true;
        let person3 = yield pc.createPerson(data.PERSON3);
        chai_1.expect(person3).to.not.be.null;
        payload = yield sc.provision(GlobalSpec_1.Test.DELIVID0, [person3.id]);
        chai_1.expect(payload.success).to.not.be.undefined;
        chai_1.expect(payload.success.status.status).to.equal(SDMMTypes_1.SDMMStatus[SDMMTypes_1.SDMMStatus.D0]);
        allRepos = yield rc.getReposForPerson(person3);
        chai_1.expect(allRepos).to.have.lengthOf(1);
        gradeR = {
            score: 70,
            comment: '',
            urlName: '',
            URL: '',
            timestamp: Date.now(),
            custom: {}
        };
        grade = yield gc.createGrade(allRepos[0].id, GlobalSpec_1.Test.DELIVID0, gradeR);
        chai_1.expect(grade).to.be.true;
        Log_1.default.test('Updating to d1');
        payload = yield sc.provision(GlobalSpec_1.Test.DELIVID1, [person2.id, person3.id]);
        chai_1.expect(payload.success).to.not.be.undefined;
        chai_1.expect(payload.failure).to.be.undefined;
        const status = payload.success.status;
        chai_1.expect(status.status).to.equal(SDMMTypes_1.SDMMStatus[SDMMTypes_1.SDMMStatus.D1]);
        Log_1.default.test(payload.message);
        allRepos = yield rc.getReposForPerson(person2);
        chai_1.expect(allRepos).to.have.lengthOf(2);
        let allTeams = yield tc.getTeamsForPerson(person2);
        chai_1.expect(allTeams).to.have.lengthOf(2);
    }));
    it("Should not be able to provision a d1 team with more than two people.", () => __awaiter(this, void 0, void 0, function* () {
        let payload = null;
        let ex = null;
        try {
            payload = yield sc.provision(GlobalSpec_1.Test.DELIVID1, [data.PERSON1.id, data.PERSON2.id, data.PERSON3.id]);
        }
        catch (err) {
            ex = err;
        }
        chai_1.expect(payload).to.be.null;
        chai_1.expect(ex).to.not.be.null;
        chai_1.expect(ex.message).to.equal('D1 can only be performed by single students or pairs of students.');
    }));
    it("Should not be able to provision a deliverable (d2) that does not need to be provisioned.", () => __awaiter(this, void 0, void 0, function* () {
        let payload = null;
        let ex = null;
        try {
            payload = yield sc.provision(GlobalSpec_1.Test.DELIVID2, [data.PERSON1.id, data.PERSON2.id]);
        }
        catch (err) {
            ex = err;
        }
        chai_1.expect(payload).to.be.null;
        chai_1.expect(ex).to.not.be.null;
        chai_1.expect(ex.message).to.equal('Repo not needed; contact course staff.');
    }));
});
//# sourceMappingURL=SDMMControllerSpec.js.map