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
const SDMMController_1 = require("../../../src/controllers/SDMM/SDMMController");
const chai_1 = require("chai");
require("mocha");
const GlobalSpec_1 = require("../../GlobalSpec");
const Log_1 = require("../../../../../common/Log");
const Util_1 = require("../../../../../common/Util");
const GitHubController_1 = require("../../../src/controllers/GitHubController");
const GitHubActions_1 = require("../../../src/controllers/util/GitHubActions");
const GradesController_1 = require("../../../src/controllers/GradesController");
const Config_1 = require("../../../../../common/Config");
const loadFirst = require('../../GlobalSpec');
const rFirst = require('./SDMMControllerSpec');
describe.skip("SDMM:: SDMMGitHubActions", () => {
    let gh;
    let TIMEOUT = 5000;
    const REPONAME = getProjectPrefix() + GlobalSpec_1.Test.REPONAME1;
    const TEAMNAME = getTeamPrefix() + GlobalSpec_1.Test.TEAMNAME1;
    let oldOrg = null;
    before(() => __awaiter(this, void 0, void 0, function* () {
        oldOrg = Config_1.default.getInstance().getProp(Config_1.ConfigKey.org);
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.org, Config_1.default.getInstance().getProp(Config_1.ConfigKey.testorg));
    }));
    before(() => __awaiter(this, void 0, void 0, function* () {
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.org, oldOrg);
    }));
    beforeEach(function () {
        gh = new GitHubActions_1.GitHubActions();
    });
    let TESTREPONAMES = ["testtest__repo1",
        "secap_cpscbot",
        "secap_rthse2",
        "secap_ubcbot",
        "secap_testtest__repo1"
    ];
    let TESTTEAMNAMES = [
        "rtholmes",
        "ubcbot",
        "rthse2",
        "cpscbot",
        "TEST__X__t_TESTteam1"
    ];
    it("Clear stale repos and teams.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let del = yield deleteStale();
            chai_1.expect(del).to.be.true;
        });
    }).timeout(TIMEOUT * 10);
    it("Clear stale repos and teams.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let del = yield deleteStale();
            chai_1.expect(del).to.be.true;
        });
    }).timeout(TIMEOUT * 10);
    it("Should be able to provision d0.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const sc = new SDMMController_1.SDMMController(new GitHubController_1.GitHubController());
            Log_1.default.test('Provisioning three users');
            const p1 = yield sc.handleUnknownUser(GlobalSpec_1.Test.USERNAMEGITHUB1);
            chai_1.expect(p1).to.not.be.null;
            const p2 = yield sc.handleUnknownUser(GlobalSpec_1.Test.USERNAMEGITHUB2);
            chai_1.expect(p2).to.not.be.null;
            const p3 = yield sc.handleUnknownUser(GlobalSpec_1.Test.USERNAMEGITHUB3);
            chai_1.expect(p3).to.not.be.null;
            Log_1.default.test('Provisioning three d0 repos');
            let provision = yield sc.provision('d0', [GlobalSpec_1.Test.USERNAMEGITHUB1]);
            chai_1.expect(provision.success).to.not.be.undefined;
            chai_1.expect(provision.failure).to.be.undefined;
            chai_1.expect(provision.success.status.status).to.equal("D0");
            provision = yield sc.provision('d0', [GlobalSpec_1.Test.USERNAMEGITHUB2]);
            chai_1.expect(provision.success).to.not.be.undefined;
            chai_1.expect(provision.failure).to.be.undefined;
            chai_1.expect(provision.success.status.status).to.equal("D0");
            provision = yield sc.provision('d0', [GlobalSpec_1.Test.USERNAMEGITHUB3]);
            chai_1.expect(provision.success).to.not.be.undefined;
            chai_1.expect(provision.failure).to.be.undefined;
            chai_1.expect(provision.success.status.status).to.equal("D0");
            Log_1.default.test('Adding some grades for the d0 repos');
            const gc = new GradesController_1.GradesController();
            let grade = {
                score: 65,
                comment: 'test',
                urlName: 'urlName',
                URL: 'TESTURL',
                timestamp: Date.now(),
                custom: {}
            };
            yield gc.createGrade(getProjectPrefix() + GlobalSpec_1.Test.USERNAMEGITHUB1, "d0", grade);
            grade = {
                score: 70,
                comment: 'test',
                urlName: 'urlName',
                URL: 'TESTURL',
                timestamp: Date.now(),
                custom: {}
            };
            yield gc.createGrade(getProjectPrefix() + GlobalSpec_1.Test.USERNAMEGITHUB2, "d0", grade);
            grade = {
                score: 75,
                comment: 'test',
                urlName: 'name',
                URL: 'TESTURL',
                timestamp: Date.now(),
                custom: {}
            };
            yield gc.createGrade(getProjectPrefix() + GlobalSpec_1.Test.USERNAMEGITHUB3, "d0", grade);
            Log_1.default.trace("Test took (3 users, 3 d0 repos): " + Util_1.default.took(start));
        });
    }).timeout(300 * 1000);
    it("Should be able to provision an individual d1.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const sc = new SDMMController_1.SDMMController(new GitHubController_1.GitHubController());
            Log_1.default.test('Provision solo D1');
            const provision = yield sc.provision('d1', [GlobalSpec_1.Test.USERNAMEGITHUB1]);
            Log_1.default.test('Provision solo d1; payload: ' + JSON.stringify(provision));
            chai_1.expect(provision.success).to.not.be.undefined;
            chai_1.expect(provision.failure).to.be.undefined;
            chai_1.expect(provision.success.status.status).to.equal("D1");
            Log_1.default.trace("Test took (1 users, 1 upgrade): " + Util_1.default.took(start));
        });
    }).timeout(300 * 1000);
    it("Should be able to provision a paired d1.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            const sc = new SDMMController_1.SDMMController(new GitHubController_1.GitHubController());
            Log_1.default.test('Provision paired d1');
            const provision = yield sc.provision('d1', [GlobalSpec_1.Test.USERNAMEGITHUB2, GlobalSpec_1.Test.USERNAMEGITHUB3]);
            Log_1.default.test('Provision paired d1; payload: ' + JSON.stringify(provision));
            chai_1.expect(provision.success).to.not.be.undefined;
            chai_1.expect(provision.failure).to.be.undefined;
            chai_1.expect(provision.success.status.status).to.equal("D1");
            Log_1.default.trace("Test took (2 users, 1 clones): " + Util_1.default.took(start));
        });
    }).timeout(300 * 1000);
    it("Clear stale repos and teams.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let del = yield deleteStale();
            chai_1.expect(del).to.be.true;
        });
    }).timeout(TIMEOUT * 10);
    function getProjectPrefix() {
        return "TEST__X__secap_";
    }
    function getTeamPrefix() {
        return "TEST__X__t_";
    }
    function deleteStale() {
        return __awaiter(this, void 0, void 0, function* () {
            Log_1.default.test('GitHubActionSpec::deleteStale() - start');
            let repos = yield gh.listRepos();
            chai_1.expect(repos).to.be.an('array');
            chai_1.expect(repos.length > 0).to.be.true;
            for (const repo of repos) {
                for (const r of TESTREPONAMES) {
                    if (repo.name === r) {
                        Log_1.default.info('Removing stale repo: ' + repo.name);
                        let val = yield gh.deleteRepo(r);
                    }
                }
            }
            repos = yield gh.listRepos();
            for (const repo of repos) {
                Log_1.default.info('Evaluating repo: ' + repo.name);
                if (repo.name.indexOf('TEST__X__') === 0) {
                    Log_1.default.info('Removing stale repo: ' + repo.name);
                    let val = yield gh.deleteRepo(repo.name);
                    let teamName = repo.name.substr(15);
                    Log_1.default.info('Adding stale team name: ' + repo.name);
                    TESTTEAMNAMES.push(teamName);
                }
            }
            let teams = yield gh.listTeams();
            chai_1.expect(teams).to.be.an('array');
            chai_1.expect(teams.length > 0).to.be.true;
            Log_1.default.test('All Teams: ' + JSON.stringify(teams));
            Log_1.default.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
            for (const team of teams) {
                for (const t of TESTTEAMNAMES) {
                    if (team.name === t) {
                        Log_1.default.test("Removing stale team: " + team.name);
                        let val = yield gh.deleteTeam(team.id);
                    }
                }
            }
            Log_1.default.test('GitHubActionSpec::deleteStale() - done');
            return true;
        });
    }
});
//# sourceMappingURL=SDMMGitHubActionSpec.js.map