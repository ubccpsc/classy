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
const chai_1 = require("chai");
require("mocha");
const GlobalSpec_1 = require("../GlobalSpec");
const RepositoryController_1 = require("../../src/controllers/RepositoryController");
const TeamController_1 = require("../../src/controllers/TeamController");
const PersonController_1 = require("../../src/controllers/PersonController");
const Log_1 = require("../../../../common/Log");
const loadFirst = require('../GlobalSpec');
const teamsFirst = require('./TeamControllerSpec');
describe("RepositoryController", () => {
    let rc;
    let tc;
    let pc;
    before(() => __awaiter(this, void 0, void 0, function* () {
    }));
    beforeEach(() => {
        tc = new TeamController_1.TeamController();
        rc = new RepositoryController_1.RepositoryController();
        pc = new PersonController_1.PersonController();
    });
    it("Should be able to get all repositories, even if there are none.", () => __awaiter(this, void 0, void 0, function* () {
        let repos = yield rc.getAllRepos();
        chai_1.expect(repos).to.have.lengthOf(0);
    }));
    it("Should be able to create a repo.", () => __awaiter(this, void 0, void 0, function* () {
        let repos = yield rc.getAllRepos();
        chai_1.expect(repos).to.have.lengthOf(0);
        let team = yield tc.getTeam(GlobalSpec_1.Test.TEAMNAME1);
        chai_1.expect(team).to.not.be.null;
        let repo = yield rc.createRepository(GlobalSpec_1.Test.REPONAME1, [team], {});
        chai_1.expect(repo).to.not.be.null;
        repos = yield rc.getAllRepos();
        chai_1.expect(repos).to.have.lengthOf(1);
    }));
    it("Should not create a repo a second time.", () => __awaiter(this, void 0, void 0, function* () {
        let repos = yield rc.getAllRepos();
        chai_1.expect(repos).to.have.lengthOf(1);
        let team = yield tc.getTeam(GlobalSpec_1.Test.TEAMNAME1);
        chai_1.expect(team).to.not.be.null;
        let repo = yield rc.createRepository(GlobalSpec_1.Test.REPONAME1, [team], {});
        chai_1.expect(repo).to.not.be.null;
        repos = yield rc.getAllRepos();
        chai_1.expect(repos).to.have.lengthOf(1);
    }));
    it("Should be able to find all repos for a user.", () => __awaiter(this, void 0, void 0, function* () {
        let repos = yield rc.getAllRepos();
        chai_1.expect(repos).to.have.lengthOf(1);
        const person = yield pc.getPerson(GlobalSpec_1.Test.USERNAME1);
        repos = yield rc.getReposForPerson(person);
        chai_1.expect(repos).to.have.lengthOf(1);
    }));
    it("Should be able to find all users for a repo.", () => __awaiter(this, void 0, void 0, function* () {
        let repos = yield rc.getAllRepos();
        chai_1.expect(repos).to.have.lengthOf(1);
        let people = yield rc.getPeopleForRepo(repos[0].id);
        Log_1.default.test(JSON.stringify(people));
        chai_1.expect(people).to.have.lengthOf(2);
        chai_1.expect(people).to.contain('user1');
        chai_1.expect(people).to.contain('user2');
    }));
    it("Should be able to find repos for a person.", () => __awaiter(this, void 0, void 0, function* () {
        // test should be in PersonControllerSpec but the repos are made here...
        const pc = new PersonController_1.PersonController();
        const repos = yield pc.getRepos(GlobalSpec_1.Test.USERNAME1);
        chai_1.expect(repos).to.have.lengthOf(1);
    }));
});
//# sourceMappingURL=RepositoryControllerSpec.js.map