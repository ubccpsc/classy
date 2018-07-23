import {SDMMController} from "../../../src/controllers/SDMM/SDMMController";
import {expect} from "chai";
import "mocha";

import {Test} from "../../GlobalSpec";

import Log from "../../../../../common/Log";
import Util from "../../../../../common/Util";
import {ActionPayload, GradePayload} from "../../../../../common/types/SDMMTypes";

import {GitHubController} from "../../../src/controllers/GitHubController";
import {GitHubActions} from "../../../src/controllers/util/GitHubActions";
import {GradesController} from "../../../src/controllers/GradesController";
import Config, {ConfigKey} from "../../../../../common/Config";

const loadFirst = require('../../GlobalSpec');
const rFirst = require('./SDMMControllerSpec'); // so we go last

describe.skip("SDMM:: SDMMGitHubActions", () => {

    let gh: GitHubActions;

    let TIMEOUT = 5000;

    // let ORGNAME = 'secapstone';
    const REPONAME = getProjectPrefix() + Test.REPONAME1;
    const TEAMNAME = getTeamPrefix() + Test.TEAMNAME1;

    let oldOrg: string = null; // track the old org so it can be restored

    before(async () => {
        // test github actions on a test github instance (for safety)
        oldOrg = Config.getInstance().getProp(ConfigKey.org);
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
    });

    before(async () => {
        Config.getInstance().setProp(ConfigKey.org, oldOrg);
    });

    beforeEach(function () {
        gh = new GitHubActions();
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


    it("Clear stale repos and teams.", async function () {
        let del = await deleteStale();
        expect(del).to.be.true;
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

    it("Clear stale repos and teams.", async function () {
        let del = await deleteStale();
        expect(del).to.be.true;
    }).timeout(TIMEOUT * 10);

    it("Should be able to provision d0.", async function () {
        const start = Date.now();

        const sc = new SDMMController(new GitHubController());

        Log.test('Provisioning three users');
        const p1 = await sc.handleUnknownUser(Test.USERNAMEGITHUB1);
        expect(p1).to.not.be.null;
        const p2 = await sc.handleUnknownUser(Test.USERNAMEGITHUB2);
        expect(p2).to.not.be.null;
        const p3 = await sc.handleUnknownUser(Test.USERNAMEGITHUB3);
        expect(p3).to.not.be.null;

        Log.test('Provisioning three d0 repos');
        let provision = await sc.provision('d0', [Test.USERNAMEGITHUB1]);
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D0");

        provision = await sc.provision('d0', [Test.USERNAMEGITHUB2]);
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D0");

        provision = await sc.provision('d0', [Test.USERNAMEGITHUB3]);
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D0");

        Log.test('Adding some grades for the d0 repos');
        const gc = new GradesController();
        let grade: GradePayload = {
            score:     65,
            comment:   'test',
            urlName:   'urlName',
            URL:       'TESTURL',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(getProjectPrefix() + Test.USERNAMEGITHUB1, "d0", grade);

        grade = {
            score:     70,
            comment:   'test',
            urlName:   'urlName',
            URL:       'TESTURL',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(getProjectPrefix() + Test.USERNAMEGITHUB2, "d0", grade);

        grade = {
            score:     75,
            comment:   'test',
            urlName:   'name',
            URL:       'TESTURL',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(getProjectPrefix() + Test.USERNAMEGITHUB3, "d0", grade);

        Log.trace("Test took (3 users, 3 d0 repos): " + Util.took(start));
    }).timeout(300 * 1000); // 5 minutes

    it("Should be able to provision an individual d1.", async function () {
        const start = Date.now();

        const sc = new SDMMController(new GitHubController());

        Log.test('Provision solo D1');
        const provision = await sc.provision('d1', [Test.USERNAMEGITHUB1]);
        Log.test('Provision solo d1; payload: ' + JSON.stringify(provision));
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D1");

        Log.trace("Test took (1 users, 1 upgrade): " + Util.took(start));
    }).timeout(300 * 1000); // 5 minutes

    it("Should be able to provision a paired d1.", async function () {
        const start = Date.now();

        const sc = new SDMMController(new GitHubController());

        Log.test('Provision paired d1');
        const provision = await sc.provision('d1', [Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB3]);
        Log.test('Provision paired d1; payload: ' + JSON.stringify(provision));
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D1");

        // NOTE: every time this is run it will create a team we can't programmatically delete

        Log.trace("Test took (2 users, 1 clones): " + Util.took(start));
    }).timeout(300 * 1000); // 5 minutes


    it("Clear stale repos and teams.", async function () {
        let del = await deleteStale();
        expect(del).to.be.true;
    }).timeout(TIMEOUT * 10);


    function getProjectPrefix(): string {
        return "TEST__X__secap_";
    }

    function getTeamPrefix() {
        return "TEST__X__t_";
    }

    async function deleteStale(): Promise<true> {
        Log.test('GitHubActionSpec::deleteStale() - start');

        let repos = await gh.listRepos();
        expect(repos).to.be.an('array');
        expect(repos.length > 0).to.be.true;

        // delete test repos if needed
        for (const repo of repos as any) {

            for (const r of TESTREPONAMES) {
                if (repo.name === r) {
                    Log.info('Removing stale repo: ' + repo.name);
                    let val = await gh.deleteRepo(r);
                    // expect(val).to.be.true;
                }
            }
        }

        repos = await gh.listRepos();
        // delete test repos if needed
        for (const repo of repos as any) {
            Log.info('Evaluating repo: ' + repo.name);
            if (repo.name.indexOf('TEST__X__') === 0) {
                Log.info('Removing stale repo: ' + repo.name);
                let val = await gh.deleteRepo(repo.name);
                // expect(val).to.be.true;
                let teamName = repo.name.substr(15);
                Log.info('Adding stale team name: ' + repo.name);
                TESTTEAMNAMES.push(teamName);
            }
        }

        // delete teams if needed
        let teams = await gh.listTeams();
        expect(teams).to.be.an('array');
        expect(teams.length > 0).to.be.true;
        Log.test('All Teams: ' + JSON.stringify(teams));
        Log.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
        for (const team of teams as any) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            for (const t of TESTTEAMNAMES) {
                if (team.name === t) {
                    Log.test("Removing stale team: " + team.name);
                    let val = await gh.deleteTeam(team.id);
                    // expect(val).to.be.true;
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done');
        return true;
    }


});
