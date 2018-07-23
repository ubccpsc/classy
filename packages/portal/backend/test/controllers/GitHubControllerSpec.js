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
const GitHubController_1 = require("../../src/controllers/GitHubController");
const TeamController_1 = require("../../src/controllers/TeamController");
const RepositoryController_1 = require("../../src/controllers/RepositoryController");
const Log_1 = require("../../../../common/Log");
const Config_1 = require("../../../../common/Config");
const loadFirst = require('../GlobalSpec');
const rFirst = require('./TeamControllerSpec');
describe("GitHubController", () => {
    let TIMEOUT = 10000;
    let gc;
    const OLDORG = Config_1.default.getInstance().getProp(Config_1.ConfigKey.org);
    before(() => {
        Log_1.default.test("GitHubControllerSpec::before() - start; forcing testorg");
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.org, Config_1.default.getInstance().getProp(Config_1.ConfigKey.testorg));
    });
    after(() => {
        Log_1.default.test("GitHubControllerSpec::after() - start; replacing original org");
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.org, OLDORG);
    });
    beforeEach(function () {
        Log_1.default.test('GitHubController::BeforeEach - "' + this.currentTest.title + '"');
        const ci = process.env.CI;
        const override = false;
        if (override || typeof ci !== 'undefined' && Boolean(ci) === true) {
            Log_1.default.test("GitHubController::beforeEach() - running in CI; not skipping");
            gc = new GitHubController_1.GitHubController();
        }
        else {
            Log_1.default.test("GitHubController::beforeEach() - skipping (not CI)");
            this.skip();
        }
    });
    it("Should be able to get a team url for a valid team.", () => __awaiter(this, void 0, void 0, function* () {
        let teams = yield new TeamController_1.TeamController().getAllTeams();
        chai_1.expect(teams.length).to.be.greaterThan(0);
        let teamUrl = yield gc.getTeamUrl(teams[0]);
        chai_1.expect(teamUrl).to.equal('https://github.com/orgs/classytest/teams/TESTteam1');
    }));
    it("Should be able to get a repo url for a valid repo.", () => __awaiter(this, void 0, void 0, function* () {
        let repos = yield new RepositoryController_1.RepositoryController().getAllRepos();
        chai_1.expect(repos.length).to.be.greaterThan(0);
        let repoUrl = yield gc.getRepositoryUrl(repos[0]);
        chai_1.expect(repoUrl).to.equal('https://github.com/classytest/TESTrepo1');
    }));
    it("Should be able to provision a repo.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let repos = yield new RepositoryController_1.RepositoryController().getAllRepos();
            chai_1.expect(repos.length).to.be.greaterThan(0);
            let teams = yield new TeamController_1.TeamController().getAllTeams();
            chai_1.expect(teams.length).to.be.greaterThan(0);
            const webhook = 'https://devnull.cs.ubc.ca/classyWebhook';
            let importUrl = 'https://github.com/SECapstone/bootstrap';
            const provisioned = yield gc.provisionRepository(repos[0].id, teams, importUrl, webhook);
            chai_1.expect(provisioned).to.be.true;
        });
    }).timeout(TIMEOUT * 2);
});
//# sourceMappingURL=GitHubControllerSpec.js.map