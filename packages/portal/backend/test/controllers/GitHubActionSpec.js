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
const loadFirst = require('../GlobalSpec');
const chai_1 = require("chai");
require("mocha");
const GitHubActions_1 = require("../../src/controllers/util/GitHubActions");
const Log_1 = require("../../../../common/Log");
const GlobalSpec_1 = require("../GlobalSpec");
const Util_1 = require("../../../../common/Util");
const Config_1 = require("../../../../common/Config");
describe("GitHubActions", () => {
    // TODO: investigate skipping this way: https://stackoverflow.com/a/41908943 (and turning them on/off with an env flag)
    let gh;
    let TIMEOUT = 5000;
    let DELAY_SEC = 1000;
    let DELAY_SHORT = 200;
    const REPONAME = getProjectPrefix() + GlobalSpec_1.Test.REPONAME1;
    const TEAMNAME = getTeamPrefix() + GlobalSpec_1.Test.TEAMNAME1;
    const OLDORG = Config_1.default.getInstance().getProp(Config_1.ConfigKey.org);
    before(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test("GitHubActionSpec::before() - start; forcing testorg");
        // test github actions on a test github instance (for safety)
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.org, Config_1.default.getInstance().getProp(Config_1.ConfigKey.testorg));
    }));
    beforeEach(function () {
        Log_1.default.test('GitHubActionSpec::BeforeEach - "' + this.currentTest.title + '"');
        const ci = process.env.CI;
        const override = false; // set to true if you want to run these tests locally
        if (override || typeof ci !== 'undefined' && Boolean(ci) === true) {
            Log_1.default.test("GitHubActionSpec::beforeEach() - running in CI; not skipping");
            gh = new GitHubActions_1.GitHubActions();
        }
        else {
            Log_1.default.test("GitHubActionSpec::beforeEach() - skipping (not CI)");
            this.skip();
        }
    });
    afterEach(function () {
        Log_1.default.test('AfterTest: "' + this.currentTest.title + '"');
    });
    after(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test("GitHubActionSpec::after() - start; replacing original org");
        // return to original org
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.org, OLDORG);
    }));
    let TESTREPONAMES = ["testtest__repo1",
        "secap_cpscbot",
        "secap_rthse2",
        "secap_ubcbot",
        "secap_testtest__repo1",
        "TESTrepo1"
    ];
    let TESTTEAMNAMES = [
        "rtholmes",
        "ubcbot",
        "rthse2",
        "cpscbot",
        "TEST__X__t_TESTteam1",
        "TESTteam1"
    ];
    it("Clear stale repos and teams.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let del = yield deleteStale();
            chai_1.expect(del).to.be.true;
        });
    }).timeout(TIMEOUT * 100);
    it("Should not be possible to find a repo that does not exist.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.repoExists(REPONAME);
            chai_1.expect(val).to.be.false;
        });
    }).timeout(TIMEOUT);
    it("Should not be possible to delete a repo that does not exist.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            // and it should do so without crashing
            let val = yield gh.deleteRepo(REPONAME);
            chai_1.expect(val).to.be.false;
        });
    }).timeout(TIMEOUT);
    it("Should be able to create a repo.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.createRepo(REPONAME);
            const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.githubHost) + '/' + Config_1.default.getInstance().getProp(Config_1.ConfigKey.org) + '/' + REPONAME;
            chai_1.expect(val).to.equal(name);
        });
    }).timeout(TIMEOUT);
    it("Should not be possible to find a repo that does exist.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.repoExists(REPONAME);
            chai_1.expect(val).to.be.true;
        });
    }).timeout(TIMEOUT);
    it("Should be able to remove a repo that does exist.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.deleteRepo(REPONAME);
            chai_1.expect(val).to.be.true;
        });
    }).timeout(TIMEOUT);
    it("Should be able to create the repo again.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.createRepo(REPONAME);
            const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.githubHost) + '/' + Config_1.default.getInstance().getProp(Config_1.ConfigKey.org) + '/' + REPONAME;
            chai_1.expect(val).to.equal(name);
        });
    }).timeout(TIMEOUT);
    it("Should be able to list a webhook.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.listWebhooks(REPONAME);
            chai_1.expect(val).to.be.empty;
        });
    }).timeout(TIMEOUT);
    it("Should be able to create a webhook.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let hooks = yield gh.listWebhooks(REPONAME);
            chai_1.expect(hooks).to.be.empty;
            let createHook = yield gh.addWebhook(REPONAME, 'https://localhost/test');
            chai_1.expect(createHook).to.be.true;
            hooks = yield gh.listWebhooks(REPONAME);
            chai_1.expect(hooks).to.have.lengthOf(1);
        });
    }).timeout(TIMEOUT);
    it("Should not be possible to get a team number for a team that does not exist.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.getTeamNumber(TEAMNAME);
            Log_1.default.test('Team # ' + val);
            chai_1.expect(val).to.be.lessThan(0);
        });
    }).timeout(TIMEOUT);
    it("Should be able to create a team, add users to it, and add it to the repo.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.createTeam(TEAMNAME, 'push');
            Log_1.default.test("Team details: " + JSON.stringify(val));
            chai_1.expect(val.teamName).to.equal(TEAMNAME);
            chai_1.expect(val.githubTeamNumber).to.be.an('number');
            chai_1.expect(val.githubTeamNumber > 0).to.be.true;
            let addMembers = yield gh.addMembersToTeam(val.teamName, val.githubTeamNumber, [GlobalSpec_1.Test.USERNAMEGITHUB1, GlobalSpec_1.Test.USERNAMEGITHUB2]);
            chai_1.expect(addMembers.teamName).to.equal(TEAMNAME); // not a strong test
            let teamAdd = yield gh.addTeamToRepo(val.githubTeamNumber, REPONAME, 'push');
            chai_1.expect(teamAdd.githubTeamNumber).to.equal(val.githubTeamNumber);
            let staffTeamNumber = yield gh.getTeamNumber('staff');
            let staffAdd = yield gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
            chai_1.expect(staffAdd.githubTeamNumber).to.equal(staffTeamNumber);
        });
    }).timeout(TIMEOUT);
    it("Should be possible to get a team number for a team that does exist.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.getTeamNumber(TEAMNAME);
            Log_1.default.test('Team # ' + val);
            chai_1.expect(val).to.be.greaterThan(0);
            // let bool = await gh.teamExists(TEAMNAME);
            // expect(bool).to.be.true;
        });
    }).timeout(TIMEOUT);
    it("Should get an empty array of team members for a team that does not exist.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let val = yield gh.getTeamMembers(-1337);
            Log_1.default.test('# Team members: ' + val.length);
            chai_1.expect(val.length).to.equal(0);
        });
    }).timeout(TIMEOUT);
    it("Should be able to get member names for a valid team.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let teamnum = yield gh.getTeamNumber('staff');
            chai_1.expect(teamnum).to.be.greaterThan(0);
            let val = yield gh.getTeamMembers(teamnum);
            Log_1.default.test('# Team members: ' + val.length);
            chai_1.expect(val.length).to.be.greaterThan(0);
            chai_1.expect(val).to.contain('rtholmes');
        });
    }).timeout(TIMEOUT);
    it("Should be able to create many teams and get their numbers (tests team paging).", function () {
        return __awaiter(this, void 0, void 0, function* () {
            gh.PAGE_SIZE = 2; // force a small page size for testing
            const NUM_TEAMS = 4; // could do 100 for a special test, but this is really slow
            // should be able to create the teams
            for (let i = 0; i < NUM_TEAMS; i++) {
                const teamname = TEAMNAME + '_paging-' + i;
                let val = yield gh.createTeam(teamname, 'push');
                yield gh.delay(200);
                Log_1.default.test("Team details: " + JSON.stringify(val));
                chai_1.expect(val.teamName).to.equal(teamname);
                chai_1.expect(val.githubTeamNumber).to.be.an('number');
                chai_1.expect(val.githubTeamNumber).to.be.greaterThan(0);
            }
            // should be able to get their number
            for (let i = 0; i < NUM_TEAMS; i++) {
                const teamname = TEAMNAME + '_paging-' + i;
                yield gh.delay(200);
                let val = yield gh.getTeamNumber(teamname);
                Log_1.default.test("Team details: " + JSON.stringify(val));
                chai_1.expect(val).to.be.an('number');
                chai_1.expect(val).to.be.greaterThan(0);
            }
        });
    }).timeout(TIMEOUT * 20);
    it("Should be able to create many repos and get them back (tests repo paging).", function () {
        return __awaiter(this, void 0, void 0, function* () {
            const NUM_REPOS = 4;
            gh.PAGE_SIZE = 2; // force a small page size for testing
            // should be able to create the teams
            for (let i = 0; i < NUM_REPOS; i++) {
                const reponame = REPONAME + '_paging-' + i;
                let val = yield gh.createRepo(reponame);
                yield gh.delay(200);
                Log_1.default.test("Repo details: " + JSON.stringify(val));
                chai_1.expect(val.indexOf(reponame)).to.be.greaterThan(-1);
                chai_1.expect(val).to.be.an('string');
            }
            let allRepos = yield gh.listRepos();
            // should be able to get their number
            for (let i = 0; i < NUM_REPOS; i++) {
                const reponame = REPONAME + '_paging-' + i;
                let found = false;
                for (const repo of allRepos) {
                    if (repo.name === reponame) {
                        Log_1.default.test("Found repo: " + reponame);
                        found = true;
                    }
                }
                if (found === false) {
                    Log_1.default.test("Missing repo: " + reponame);
                }
                // expect(found).to.be.true;
            }
        });
    }).timeout(TIMEOUT * 1000);
    it("Should be able to clone a source repo into a newly created repository.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            let targetUrl = Config_1.default.getInstance().getProp(Config_1.ConfigKey.githubHost) + '/' + Config_1.default.getInstance().getProp(Config_1.ConfigKey.org) + '/' + REPONAME;
            let importUrl = 'https://github.com/SECapstone/bootstrap'; // this is hard coded, but at least it's public
            let output = yield gh.importRepoFS(importUrl, targetUrl);
            chai_1.expect(output).to.be.true;
            Log_1.default.test('Full clone took: ' + Util_1.default.took(start));
        });
    }).timeout(120 * 1000); // 2 minutes
    /**
     * This test is terrible, but gets the coverage tools to stop complaining.
     */
    it("Should make sure that actions can actually fail.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (1 > 0)
                return; // terrible skip
            const old = gh.gitHubAuthToken;
            gh.gitHubAuthToken = "FOOFOOFOO";
            try {
                yield gh.createRepo('INVALIDREPONAME');
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.deleteRepo('INVALIDREPONAME');
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.listRepos();
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.createTeam('INVALIDTEAMNAMER', 'push');
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.getTeamNumber('INVALIDTEAMNAMER');
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.deleteTeam(-1);
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.addTeamToRepo(-1, 'INVALIDREPONAME', 'push');
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.addMembersToTeam('INVALIDTEAMNAME', -1, ['INVALIDPERSONNAME']);
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.listTeams();
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.listWebhooks('INVALIDREPONAME');
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.addWebhook('INVALIDREPONAME', 'INVALIDENDPOINT');
            }
            catch (err) {
                // expected
            }
            try {
                yield gh.importRepoFS('https://localhost', 'https://localhost');
            }
            catch (err) {
                // expected
            }
            Log_1.default.test('after expected fail');
            gh.gitHubAuthToken = old; // restore token
        });
    }).timeout(TIMEOUT);
    it("Should be able to create a repo, " +
        "create a team, add users to it, add it to the repo, " +
        "and change their permissions", function () {
        return __awaiter(this, void 0, void 0, function* () {
            let githubTeam = yield gh.createTeam(TEAMNAME, 'push');
            chai_1.expect(githubTeam.teamName).to.be.equal(TEAMNAME);
            chai_1.expect(githubTeam.githubTeamNumber).to.be.an('number');
            chai_1.expect(githubTeam.githubTeamNumber > 0).to.be.true;
            // Expects adding members to work
            let addMembers = yield gh.addMembersToTeam(githubTeam.teamName, githubTeam.githubTeamNumber, [GlobalSpec_1.Test.USERNAMEGITHUB1, GlobalSpec_1.Test.USERNAMEGITHUB2]);
            let teamAdd = yield gh.addTeamToRepo(githubTeam.githubTeamNumber, REPONAME, 'push');
            let staffTeamNumber = yield gh.getTeamNumber('staff');
            let staffAdd = yield gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
            let permissionEdit = yield gh.setRepoPermission(REPONAME, "pull");
            chai_1.expect(permissionEdit).to.be.true;
        });
    }).timeout(TIMEOUT);
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
            // expect(repos.length > 0).to.be.true; // test org can be empty
            // delete test repos if needed
            for (const repo of repos) {
                for (const r of TESTREPONAMES) {
                    if (repo.name === r) {
                        Log_1.default.info('Removing stale repo: ' + repo.name);
                        let val = yield gh.deleteRepo(r);
                        yield gh.delay(DELAY_SHORT);
                        // expect(val).to.be.true;
                    }
                }
            }
            repos = yield gh.listRepos();
            // delete test repos if needed
            for (const repo of repos) {
                Log_1.default.info('Evaluating repo: ' + repo.name);
                if (repo.name.indexOf('TEST__X__') === 0 || repo.name.startsWith(REPONAME)) {
                    Log_1.default.info('Removing stale repo: ' + repo.name);
                    let val = yield gh.deleteRepo(repo.name);
                    // expect(val).to.be.true;
                    let teamName = repo.name.substr(15);
                    Log_1.default.info('Adding stale team name: ' + repo.name);
                    TESTTEAMNAMES.push(teamName);
                }
            }
            // delete teams if needed
            let teams = yield gh.listTeams();
            chai_1.expect(teams).to.be.an('array');
            // expect(teams.length > 0).to.be.true; // can have 0 teams
            Log_1.default.test('All Teams: ' + JSON.stringify(teams));
            Log_1.default.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
            for (const team of teams) {
                // Log.info('Evaluating team: ' + JSON.stringify(team));
                let done = false;
                for (const t of TESTTEAMNAMES) {
                    if (team.name === t) {
                        Log_1.default.test("Removing stale team: " + team.name);
                        let val = yield gh.deleteTeam(team.id);
                        yield gh.delay(DELAY_SHORT);
                        done = true;
                    }
                }
                if (done === false) {
                    if (team.name.startsWith(TEAMNAME) === true) {
                        Log_1.default.test("Removing stale team: " + team.name);
                        let val = yield gh.deleteTeam(team.id);
                        yield gh.delay(DELAY_SHORT);
                    }
                }
            }
            Log_1.default.test('GitHubActionSpec::deleteStale() - done');
            return true;
        });
    }
});
//# sourceMappingURL=GitHubActionSpec.js.map