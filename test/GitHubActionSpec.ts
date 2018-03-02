// const loadFirst = require('./GlobalSpec');
// const rFirst = require('./GradeControllerSpec');

import {expect} from "chai";
import "mocha";
import {GitHubActions} from "../src/controllers/GitHubController";
import Log from "../src/util/Log";
import {Test} from "./GlobalSpec";
import Util from "../src/util/Util";

describe.only("GitHubActions", () => {

    // let ORGNAME: string;
    let gh: GitHubActions;

    let TIMEOUT = 5000;

    /*
    const TEAMNAME1 = 'team1';

    const USERNAME1 = 'user1';
    const USERNAME2 = 'user2';

    const DELIVID1 = 'd1';
    const DELIVID2 = 'd2';

    const REPONAME1 = 'repo1';
    const REPONAME2 = 'repo2';
*/

    before(async () => {
        //  ORGNAME = Config.getInstance().getProp('org');
    });

    beforeEach(function () {
        gh = new GitHubActions();
    });

    it("Should be able to create list some repos.", async () => {
        // really just checks that auth is correct

        // delete test repos if needed
        let repos = await gh.listRepos(Test.ORGNAME);
        expect(repos).to.be.an('array');
        expect(repos.length > 0).to.be.true;

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

        let addMembers = await gh.addMembersToTeam(val.teamName, val.githubTeamNumber, [Test.USERNAMEGITHUB,Test.USERNAMEGITHUB2]);
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
    }).timeout(TIMEOUT * 10);


});
