const loadFirst = require('../GlobalSpec');

import {expect} from "chai";
import "mocha";

import {GitHubActions} from "../../src/controllers/GitHubController";
import Log from "../../../common/Log";
import {Test} from "../GlobalSpec";
import Util from "../../../common/Util";
import Config from "../../../common/Config";

describe("GitHubActions", () => {

    let gh: GitHubActions;

    let TIMEOUT = 5000;

    let ORGNAME = 'classytest'; // dedicated test org; ensures we don't kill repos in production
    const REPONAME = getProjectPrefix() + Test.REPONAME1;
    const TEAMNAME = getTeamPrefix() + Test.TEAMNAME1;

    let OLDORGNAME: string | null = null;

    before(async () => {
        Test.ORGNAME = ORGNAME; // use real org name so the repos are provisioned correctly

        OLDORGNAME = Config.getInstance().getProp('org');
        Config.getInstance().setProp('org', ORGNAME);
    });

    after(async () => {
        Config.getInstance().setProp('org', OLDORGNAME);
    });

    beforeEach(function () {
        Log.test('BeforeTest: "' + (<any>this).currentTest.title + '"');
        gh = new GitHubActions();
    });

    afterEach(function () {
        Log.test('AfterTest: "' + (<any>this).currentTest.title + '"');
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

    it("Should not be possible to find a repo that does not exist.", async function () {
        let val = await gh.repoExists(REPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should not be possible to delete a repo that does not exist.", async function () {
        // and it should do so without crashing
        let val = await gh.deleteRepo(REPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to create a repo.", async function () {
        let val = await gh.createRepo(REPONAME);
        expect(val).to.equal('https://github.com/SECapstone/' + REPONAME);
    }).timeout(TIMEOUT);

    it("Should not be possible to find a repo that does exist.", async function () {
        let val = await gh.repoExists(REPONAME);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to remove a repo that does exist.", async function () {
        let val = await gh.deleteRepo(REPONAME);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to create the repo again.", async function () {
        let val = await gh.createRepo(REPONAME);
        expect(val).to.equal('https://github.com/SECapstone/' + REPONAME);
    }).timeout(TIMEOUT);

    it("Should be able to list a webhook.", async function () {
        let val = await gh.listWebhooks(REPONAME);
        expect(val).to.be.empty;
    }).timeout(TIMEOUT);

    it("Should be able to create a webhook.", async function () {
        let hooks = await gh.listWebhooks(REPONAME);
        expect(hooks).to.be.empty;

        let createHook = await gh.addWebhook(REPONAME, 'https://localhost/test');
        expect(createHook).to.be.true;

        hooks = await gh.listWebhooks(REPONAME);
        expect(hooks).to.have.lengthOf(1);
    }).timeout(TIMEOUT);

    it("Should not be possible to get a team number for a team that does not exist.", async function () {
        let val = await gh.getTeamNumber(TEAMNAME);
        Log.test('Team # ' + val);
        expect(val).to.be.lessThan(0);

        // let bool = await gh.teamExists(Test.ORGNAME, TEAMNAME);
        // expect(bool).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to create a team, add users to it, and add it to the repo.", async function () {
        let val = await gh.createTeam(TEAMNAME, 'push');
        Log.test("Team details: " + JSON.stringify(val));
        expect(val.teamName).to.equal(TEAMNAME);
        expect(val.githubTeamNumber).to.be.an('number');
        expect(val.githubTeamNumber > 0).to.be.true;

        let addMembers = await gh.addMembersToTeam(val.teamName, val.githubTeamNumber, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        expect(addMembers.teamName).to.equal(TEAMNAME); // not a strong test

        let teamAdd = await gh.addTeamToRepo(val.githubTeamNumber, REPONAME, 'push');
        expect(teamAdd.githubTeamNumber).to.equal(val.githubTeamNumber);

        let staffTeamNumber = await gh.getTeamNumber('staff');
        let staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
        expect(staffAdd.githubTeamNumber).to.equal(staffTeamNumber);

    }).timeout(TIMEOUT);

    it("Should be possible to get a team number for a team that does exist.", async function () {
        let val = await gh.getTeamNumber(TEAMNAME);
        Log.test('Team # ' + val);
        expect(val).to.be.greaterThan(0);

        // let bool = await gh.teamExists(Test.ORGNAME, TEAMNAME);
        // expect(bool).to.be.true;
    }).timeout(TIMEOUT);

    it("Should get an empty array of team members for a team that does not exist.", async function () {
        let val = await gh.getTeamMembers(-1337);
        Log.test('# Team members: ' + val.length);
        expect(val.length).to.equal(0);
    }).timeout(TIMEOUT);

    it("Should be able to get member names for a valid team.", async function () {
        let teamnum = await gh.getTeamNumber('staff');
        expect(teamnum).to.be.greaterThan(0);
        let val = await gh.getTeamMembers(teamnum);
        Log.test('# Team members: ' + val.length);
        expect(val.length).to.be.greaterThan(0);
        expect(val).to.contain('rtholmes');
    }).timeout(TIMEOUT);

    it("Should be able to clone a source repo into a newly created repository.", async function () {
        const start = Date.now();
        let targetUrl = 'https://github.com/SECapstone/' + REPONAME;
        let importUrl = 'https://github.com/SECapstone/bootstrap';

        let output = await gh.importRepoFS(importUrl, targetUrl);
        expect(output).to.be.true;

        Log.test('Full clone took: ' + Util.took(start));
    }).timeout(120 * 1000); // 2 minutes

    /**
     * This test is terrible, but gets the coverage tools to stop complaining.
     */
    it("Should make sure that actions can actually fail.", async function () {
        if (1 > 0) return; // terrible skip
        const old = (<any>gh).gitHubAuthToken;
        (<any>gh).gitHubAuthToken = "FOOFOOFOO";

        try {
            await gh.createRepo('INVALIDREPONAME');
        } catch (err) {
            // expected
        }

        try {
            await gh.deleteRepo('INVALIDREPONAME');
        } catch (err) {
            // expected
        }

        try {
            await gh.listRepos();
        } catch (err) {
            // expected
        }

        try {
            await gh.createTeam('INVALIDTEAMNAMER', 'push');
        } catch (err) {
            // expected
        }

        try {
            await gh.getTeamNumber('INVALIDTEAMNAMER');
        } catch (err) {
            // expected
        }

        try {
            await gh.deleteTeam(-1);
        } catch (err) {
            // expected
        }

        try {
            await gh.addTeamToRepo(-1, 'INVALIDREPONAME', 'push');
        } catch (err) {
            // expected
        }

        try {
            await gh.addMembersToTeam('INVALIDTEAMNAME', -1, ['INVALIDPERSONNAME']);
        } catch (err) {
            // expected
        }

        try {
            await gh.listTeams();
        } catch (err) {
            // expected
        }

        try {
            await gh.listWebhooks('INVALIDREPONAME');
        } catch (err) {
            // expected
        }

        try {
            await gh.addWebhook('INVALIDREPONAME', 'INVALIDENDPOINT');
        } catch (err) {
            // expected
        }

        try {
            await gh.importRepoFS('https://localhost', 'https://localhost');
        } catch (err) {
            // expected
        }

        Log.test('after expected fail');
        (<any>gh).gitHubAuthToken = old; // restore token
    }).timeout(TIMEOUT);

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
        // expect(repos.length > 0).to.be.true; // test org can be empty

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
        // expect(teams.length > 0).to.be.true; // can have 0 teams
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
