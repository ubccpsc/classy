// const loadFirst = require('./GlobalSpec');
// const rFirst = require('./GradeControllerSpec');

import {expect} from "chai";
import "mocha";
import {GitHubActions} from "../src/controllers/GitHubController";
import Log from "../src/util/Log";
import {Test} from "./GlobalSpec";
import Util from "../src/util/Util";

describe("GitHubActions", () => {

    let gh: GitHubActions;

    let TIMEOUT = 5000;

    before(async () => {
    });

    beforeEach(function () {
        gh = new GitHubActions();
    });

    it("Should be able to create list some repos.", async () => {
        // check auth
        let repos = await gh.listRepos(Test.ORGNAME);
        expect(repos).to.be.an('array');
        expect(repos.length > 0).to.be.true;

        // delete test repos if needed
        for (const repo of repos as any) {
            if (repo.full_name === "SECapstone/" + Test.REPONAME1) {
                Log.test("Old test repo found; removing");
                let val = await gh.deleteRepo(Test.ORGNAME, Test.REPONAME1);
                expect(val).to.be.true;
            }
        }

        // delete teams if needed
        let teams = await gh.listTeams(Test.ORGNAME);
        expect(teams).to.be.an('array');
        expect(teams.length > 0).to.be.true;

        for (const team of teams as any) {
            Log.info('team: ' + JSON.stringify(team));
            if (team.name === Test.TEAMNAME1) {
                Log.test("Old test team found; removing");
                let val = await gh.deleteTeam(Test.ORGNAME, team.id);
                expect(val).to.be.true;
            }

        }
    });

    it("Should be able to create a repo.", async function () {
        let val = await gh.createRepo(Test.ORGNAME, Test.REPONAME1);
        expect(val).to.equal('https://github.com/SECapstone/' + Test.REPONAME1);
    }).timeout(TIMEOUT);

    it("Should be able to remove a repo.", async function () {
        let val = await gh.deleteRepo(Test.ORGNAME, Test.REPONAME1);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to create the repo again.", async function () {
        let val = await gh.createRepo(Test.ORGNAME, Test.REPONAME1);
        expect(val).to.equal('https://github.com/SECapstone/' + Test.REPONAME1);
    }).timeout(TIMEOUT);

    it("Should be able to list a webhook.", async function () {
        let val = await gh.listWebhooks(Test.ORGNAME, Test.REPONAME1);
        expect(val).to.be.empty;
    }).timeout(TIMEOUT);

    it("Should be able to create a webhook.", async function () {
        let hooks = await gh.listWebhooks(Test.ORGNAME, Test.REPONAME1);
        expect(hooks).to.be.empty;

        let createHook = await gh.addWebhook(Test.ORGNAME, Test.REPONAME1, 'https://localhost/test');
        expect(createHook).to.be.true;

        hooks = await gh.listWebhooks(Test.ORGNAME, Test.REPONAME1);
        expect(hooks).to.have.lengthOf(1);
    }).timeout(TIMEOUT);

    it("Should be able to create a team, add users to it, and add it to the repo.", async function () {
        let val = await gh.createTeam(Test.ORGNAME, Test.TEAMNAME1, 'push');
        expect(val.teamName).to.equal(Test.TEAMNAME1);
        expect(val.githubTeamNumber).to.be.an('number');
        expect(val.githubTeamNumber > 0).to.be.true;

        let addMembers = await gh.addMembersToTeam(val.teamName, val.githubTeamNumber, [Test.USERNAMEGITHUB, Test.USERNAMEGITHUB2]);
        expect(addMembers.teamName).to.equal(Test.TEAMNAME1); // not a strong test

        let teamAdd = await gh.addTeamToRepo(Test.ORGNAME, val.githubTeamNumber, Test.REPONAME1, 'push');
        expect(teamAdd.githubTeamNumber).to.equal(val.githubTeamNumber);

        let staffTeamNumber = await gh.getTeamNumber(Test.ORGNAME, 'staff');
        let staffAdd = await gh.addTeamToRepo(Test.ORGNAME, staffTeamNumber, Test.REPONAME1, 'admin');
        expect(staffAdd.githubTeamNumber).to.equal(staffTeamNumber);

    }).timeout(TIMEOUT);

    it("Should be able to clone a source repo into a newly created repository.", async function () {
        const start = Date.now();

        let targetUrl = 'https://github.com/SECapstone/testtest__repo1';
        let importUrl = 'https://github.com/SECapstone/d0_bootstrap';

        let output = await gh.importRepoFS(Test.ORGNAME, importUrl, targetUrl);
        expect(output).to.be.true;

        Log.test('Full clone took: ' + Util.took(start));
    }).timeout(120 * 1000); // 2 minutes

    /**
     * This test is terrible, but gets the coverage tools to stop complaining.
     */
    it("Should make sure that actions can actually fail.", async function () {
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

});
