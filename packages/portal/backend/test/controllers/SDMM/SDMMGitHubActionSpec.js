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
const rFirst = require('./SDMMControllerSpec'); // so we go last
describe.skip("SDMM:: SDMMGitHubActions", () => {
    let gh;
    let TIMEOUT = 5000;
    // let ORGNAME = 'secapstone';
    const REPONAME = getProjectPrefix() + GlobalSpec_1.Test.REPONAME1;
    const TEAMNAME = getTeamPrefix() + GlobalSpec_1.Test.TEAMNAME1;
    let oldOrg = null; // track the old org so it can be restored
    before(() => __awaiter(this, void 0, void 0, function* () {
        // test github actions on a test github instance (for safety)
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
    /*
    it("Should not be possible to find a repo that does not exist.", async function () {
        let val = await gh.repoExists(Test.ORGNAME, REPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should not be possible to delete a repo that does not exist.", async function () {
        // and it should do so without crashing
        let val = await gh.deleteRepo(Test.ORGNAME, REPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to create a repo.", async function () {
        let val = await gh.createRepo(Test.ORGNAME, REPONAME);
        expect(val).to.equal('https://github.com/SECapstone/' + REPONAME);
    }).timeout(TIMEOUT);

    it("Should not be possible to find a repo that does exist.", async function () {
        let val = await gh.repoExists(Test.ORGNAME, REPONAME);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to remove a repo that does exist.", async function () {
        let val = await gh.deleteRepo(Test.ORGNAME, REPONAME);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to create the repo again.", async function () {
        let val = await gh.createRepo(Test.ORGNAME, REPONAME);
        expect(val).to.equal('https://github.com/SECapstone/' + REPONAME);
    }).timeout(TIMEOUT);

    it("Should be able to list a webhook.", async function () {
        let val = await gh.listWebhooks(Test.ORGNAME, REPONAME);
        expect(val).to.be.empty;
    }).timeout(TIMEOUT);

    it("Should be able to create a webhook.", async function () {
        let hooks = await gh.listWebhooks(Test.ORGNAME, REPONAME);
        expect(hooks).to.be.empty;

        let createHook = await gh.addWebhook(Test.ORGNAME, REPONAME, 'https://localhost/test');
        expect(createHook).to.be.true;

        hooks = await gh.listWebhooks(Test.ORGNAME, REPONAME);
        expect(hooks).to.have.lengthOf(1);
    }).timeout(TIMEOUT);

    it("Should not be possible to get a team number for a team that does not exist.", async function () {
        let val = await gh.getTeamNumber(Test.ORGNAME, TEAMNAME);
        Log.test('Team # ' + val);
        expect(val).to.be.lessThan(0);

        // let bool = await gh.teamExists(Test.ORGNAME, TEAMNAME);
        // expect(bool).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to create a team, add users to it, and add it to the repo.", async function () {
        let val = await gh.createTeam(Test.ORGNAME, TEAMNAME, 'push');
        Log.test("Team details: " + JSON.stringify(val));
        expect(val.teamName).to.equal(TEAMNAME);
        expect(val.githubTeamNumber).to.be.an('number');
        expect(val.githubTeamNumber > 0).to.be.true;

        let addMembers = await gh.addMembersToTeam(val.teamName, val.githubTeamNumber, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        expect(addMembers.teamName).to.equal(TEAMNAME); // not a strong test

        let teamAdd = await gh.addTeamToRepo(Test.ORGNAME, val.githubTeamNumber, REPONAME, 'push');
        expect(teamAdd.githubTeamNumber).to.equal(val.githubTeamNumber);

        let staffTeamNumber = await gh.getTeamNumber(Test.ORGNAME, 'staff');
        let staffAdd = await gh.addTeamToRepo(Test.ORGNAME, staffTeamNumber, REPONAME, 'admin');
        expect(staffAdd.githubTeamNumber).to.equal(staffTeamNumber);

    }).timeout(TIMEOUT);

    it("Should be possible to get a team number for a team that does exist.", async function () {
        let val = await gh.getTeamNumber(Test.ORGNAME, TEAMNAME);
        Log.test('Team # ' + val);
        expect(val).to.be.greaterThan(0);

        // let bool = await gh.teamExists(Test.ORGNAME, TEAMNAME);
        // expect(bool).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to clone a source repo into a newly created repository.", async function () {
        const start = Date.now();
        let targetUrl = 'https://github.com/SECapstone/' + REPONAME;
        let importUrl = 'https://github.com/SECapstone/bootstrap';

        let output = await gh.importRepoFS(Test.ORGNAME, importUrl, targetUrl);
        expect(output).to.be.true;

        Log.test('Full clone took: ' + Util.took(start));
    }).timeout(120 * 1000); // 2 minutes

    it("Should make sure that actions can actually fail.", async function () {
        if (1 > 0) return; // terrible skip
        const old = (<any>gh).gitHubAuthToken;
        (<any>gh).gitHubAuthToken = "FOOFOOFOO";

        try {
            await gh.createRepo(Test.ORGNAME, 'INVALIDREPONAME');
        } catch (err) {
            // expected
        }

        try {
            await gh.deleteRepo(Test.ORGNAME, 'INVALIDREPONAME');
        } catch (err) {
            // expected
        }

        try {
            await gh.listRepos(Test.ORGNAME + "INVALIDINVALIDINVALID");
        } catch (err) {
            // expected
        }

        try {
            await gh.createTeam(Test.ORGNAME, 'INVALIDTEAMNAMER', 'push');
        } catch (err) {
            // expected
        }

        try {
            await gh.getTeamNumber(Test.ORGNAME, 'INVALIDTEAMNAMER');
        } catch (err) {
            // expected
        }

        try {
            await gh.deleteTeam(Test.ORGNAME, -1);
        } catch (err) {
            // expected
        }

        try {
            await gh.addTeamToRepo(Test.ORGNAME, -1, 'INVALIDREPONAME', 'push');
        } catch (err) {
            // expected
        }

        try {
            await gh.addMembersToTeam(Test.ORGNAME, -1, ['INVALIDPERSONNAME']);
        } catch (err) {
            // expected
        }

        try {
            await gh.listTeams(Test.ORGNAME);
        } catch (err) {
            // expected
        }

        try {
            await gh.listWebhooks(Test.ORGNAME, 'INVALIDREPONAME');
        } catch (err) {
            // expected
        }

        try {
            await gh.addWebhook(Test.ORGNAME, 'INVALIDREPONAME', 'INVALIDENDPOINT');
        } catch (err) {
            // expected
        }

        try {
            await gh.importRepoFS(Test.ORGNAME, 'https://localhost', 'https://localhost');
        } catch (err) {
            // expected
        }

        Log.test('after expected fail');
        (<any>gh).gitHubAuthToken = old; // restore token
    }).timeout(TIMEOUT);

*/
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
    }).timeout(300 * 1000); // 5 minutes
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
    }).timeout(300 * 1000); // 5 minutes
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
            // NOTE: every time this is run it will create a team we can't programmatically delete
            Log_1.default.trace("Test took (2 users, 1 clones): " + Util_1.default.took(start));
        });
    }).timeout(300 * 1000); // 5 minutes
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
            // delete test repos if needed
            for (const repo of repos) {
                for (const r of TESTREPONAMES) {
                    if (repo.name === r) {
                        Log_1.default.info('Removing stale repo: ' + repo.name);
                        let val = yield gh.deleteRepo(r);
                        // expect(val).to.be.true;
                    }
                }
            }
            repos = yield gh.listRepos();
            // delete test repos if needed
            for (const repo of repos) {
                Log_1.default.info('Evaluating repo: ' + repo.name);
                if (repo.name.indexOf('TEST__X__') === 0) {
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
            chai_1.expect(teams.length > 0).to.be.true;
            Log_1.default.test('All Teams: ' + JSON.stringify(teams));
            Log_1.default.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
            for (const team of teams) {
                // Log.info('Evaluating team: ' + JSON.stringify(team));
                for (const t of TESTTEAMNAMES) {
                    if (team.name === t) {
                        Log_1.default.test("Removing stale team: " + team.name);
                        let val = yield gh.deleteTeam(team.id);
                        // expect(val).to.be.true;
                    }
                }
            }
            Log_1.default.test('GitHubActionSpec::deleteStale() - done');
            return true;
        });
    }
});
//# sourceMappingURL=SDMMGitHubActionSpec.js.map