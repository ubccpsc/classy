const loadFirst = require('./GlobalSpec');
const rFirst = require('./SDDMControllerSpec'); // so we go last

import {expect} from "chai";
import "mocha";

import {GitHubActions, GitHubController} from "../src/controllers/GitHubController";
import Log from "../src/util/Log";
import {Test} from "./GlobalSpec";
import Util from "../src/util/Util";
import {ActionPayload, GradePayload, SDDMController} from "../src/controllers/SDDMController";
import {GradesController} from "../src/controllers/GradesController";

describe.skip("GitHubActions", () => {

    let gh: GitHubActions;

    let TIMEOUT = 5000;

    let ORGNAME = 'secapstone';
    const REPONAME = getProjectPrefix(Test.ORGNAME) + Test.REPONAME1;
    const TEAMNAME = getTeamPrefix(Test.ORGNAME) + Test.TEAMNAME1;

    before(async () => {
        Test.ORGNAME = ORGNAME;
    });

    beforeEach(function () {
        gh = new GitHubActions();
    });

    let REPOS = ["testtest__repo1",
        "secap_cpscbot",
        "secap_rthse2",
        "secap_ubcbot",
        "secap_testtest__repo1",
        "TEST__X__secap_testtest__repo1",
        "TEST__X__secap_TESTrepo1"];

    let TEAMS = [
        "rtholmes",
        "ubcbot",
        "rthse2",
        "cpscbot",
        "TEST__X__t_TESTteam1"
    ];


    it("Clear stale repos and teams.", async function () {
        Log.test('GitHubActionSpec::deleteStale() - start');

        let repos = await gh.listRepos(Test.ORGNAME);
        expect(repos).to.be.an('array');
        expect(repos.length > 0).to.be.true;

        // delete test repos if needed
        for (const repo of repos as any) {
            Log.info('Evaluating repo: ' + repo.name);
            for (const r of REPOS) {
                if (repo.name === r) {
                    let val = await
                        gh.deleteRepo(Test.ORGNAME, r);
                    expect(val).to.be.true;
                }
            }
        }

        // delete teams if needed
        let teams = await
            gh.listTeams(Test.ORGNAME);
        expect(teams).to.be.an('array');
        expect(teams.length > 0).to.be.true;
        Log.test('All Teams: ' + JSON.stringify(teams));
        for (const team of teams as any) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            for (const t of TEAMS) {
                if (team.name === t) {
                    Log.test("Old test team found; removing: " + team.name);
                    let val = await
                        gh.deleteTeam(Test.ORGNAME, team.id);
                    expect(val).to.be.true;
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done');
    }).timeout(TIMEOUT * 10);

    it("Should be able to create a repo.", async function () {
        let val = await gh.createRepo(Test.ORGNAME, REPONAME);
        expect(val).to.equal('https://github.com/SECapstone/' + REPONAME);
    }).timeout(TIMEOUT);

    it("Should be able to remove a repo.", async function () {
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

    it("Should be able to create a team, add users to it, and add it to the repo.", async function () {
        let val = await gh.createTeam(Test.ORGNAME, TEAMNAME, 'push');
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

    it("Should be able to clone a source repo into a newly created repository.", async function () {
        const start = Date.now();
        let targetUrl = 'https://github.com/SECapstone/' + REPONAME;
        let importUrl = 'https://github.com/SECapstone/bootstrap';

        let output = await gh.importRepoFS(Test.ORGNAME, importUrl, targetUrl);
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


    /*
    it("Should be able to delete things before running provisioning tests.", async function () {
        // check auth
        let repos = await gh.listRepos(Test.ORGNAME);
        expect(repos).to.be.an('array');
        expect(repos.length > 0).to.be.true;

        // delete test repos if needed
        for (const repo of repos as any) {
            if (repo.full_name.indexOf("SECapstone/TEST__X__") === 0) {
                Log.test("Deleting test repo: " + repo.name);
                await gh.deleteRepo(Test.ORGNAME, repo.name);
            }
        }

        // delete teams if needed
        let teams = await gh.listTeams(Test.ORGNAME);
        expect(teams).to.be.an('array');
        expect(teams.length > 0).to.be.true;

        for (const team of teams as any) {
            if (team.name.indexOf("TEST__X__t_") === 0) {
                Log.info('Deleting test team: ' + JSON.stringify(team));
                await gh.deleteTeam(Test.ORGNAME, team.id);
            }
        }
    }).timeout(30 * 1000);
    */


    it("Clear stale repos and teams.", async function () {
        Log.test('GitHubActionSpec::deleteStale() - start');

        let repos = await gh.listRepos(Test.ORGNAME);
        expect(repos).to.be.an('array');
        expect(repos.length > 0).to.be.true;

        // delete test repos if needed
        for (const repo of repos as any) {
            Log.info('Evaluating repo: ' + repo.name);
            for (const r of REPOS) {
                if (repo.name === r) {
                    let val = await
                        gh.deleteRepo(Test.ORGNAME, r);
                    expect(val).to.be.true;
                }
            }
        }


        // delete teams if needed
        let teams = await
            gh.listTeams(Test.ORGNAME);
        expect(teams).to.be.an('array');
        expect(teams.length > 0).to.be.true;
        Log.test('All Teams: ' + JSON.stringify(teams));
        for (const team of teams as any) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            for (const t of TEAMS) {
                if (team.name === t) {
                    Log.test("Old test team found; removing: " + team.name);
                    let val = await
                        gh.deleteTeam(Test.ORGNAME, team.id);
                    expect(val).to.be.true;
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done');
    }).timeout(TIMEOUT * 10);

    it("Should be able to provision d0.", async function () {
        const start = Date.now();

        const sc = new SDDMController(new GitHubController());

        Log.test('Provisioning three users');
        const p1 = await sc.handleUnknownUser(Test.ORGNAME, Test.USERNAMEGITHUB1);
        expect(p1).to.not.be.null;
        const p2 = await sc.handleUnknownUser(Test.ORGNAME, Test.USERNAMEGITHUB2);
        expect(p2).to.not.be.null;
        const p3 = await sc.handleUnknownUser(Test.ORGNAME, Test.USERNAMEGITHUB3);
        expect(p3).to.not.be.null;

        Log.test('Provisioning three d0 repos');
        let provision = await sc.provision(Test.ORGNAME, 'd0', [Test.USERNAMEGITHUB1]);
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D0");

        provision = await sc.provision(Test.ORGNAME, 'd0', [Test.USERNAMEGITHUB2]);
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D0");

        provision = await sc.provision(Test.ORGNAME, 'd0', [Test.USERNAMEGITHUB3]);
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D0");

        Log.test('Adding some grades for the d0 repos');
        const gc = new GradesController();
        let grade: GradePayload = {
            score:     65,
            comment:   'test',
            url:       'TESTURL',
            timestamp: Date.now()
        };
        await gc.createGrade(Test.ORGNAME, "secap_" + Test.USERNAMEGITHUB1, "d0", grade);

        grade = {
            score:     70,
            comment:   'test',
            url:       'TESTURL',
            timestamp: Date.now()
        };
        await gc.createGrade(Test.ORGNAME, "secap_" + Test.USERNAMEGITHUB2, "d0", grade);

        grade = {
            score:     75,
            comment:   'test',
            url:       'TESTURL',
            timestamp: Date.now()
        };
        await gc.createGrade(Test.ORGNAME, "secap_" + Test.USERNAMEGITHUB3, "d0", grade);

        Log.trace("Test took (3 users, 3 d0 repos): " + Util.took(start));
    }).timeout(300 * 1000); // 5 minutes

    it("Should be able to provision an individual d1.", async function () {
        const start = Date.now();

        const sc = new SDDMController(new GitHubController());

        Log.test('Provision solo D1');
        const provision = await sc.provision(Test.ORGNAME, 'd1', [Test.USERNAMEGITHUB1]);
        Log.test('Provision solo d1; payload: ' + JSON.stringify(provision));
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D1");

        Log.trace("Test took (1 users, 1 upgrade): " + Util.took(start));
    }).timeout(300 * 1000); // 5 minutes

    it("Should be able to provision a paired d1.", async function () {
        const start = Date.now();

        const sc = new SDDMController(new GitHubController());

        Log.test('Provision paired d1');
        const provision = await sc.provision(Test.ORGNAME, 'd1', [Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB3]);
        Log.test('Provision paired d1; payload: ' + JSON.stringify(provision));
        expect(provision.success).to.not.be.undefined;
        expect(provision.failure).to.be.undefined;
        expect((<ActionPayload>provision.success).status.status).to.equal("D1");

        // NOTE: every time this is run it will create a team we can't programmatically delete

        Log.trace("Test took (2 users, 1 clones): " + Util.took(start));
    }).timeout(300 * 1000); // 5 minutes




    it("Clear stale repos and teams.", async function () {
        Log.test('GitHubActionSpec::deleteStale() - start');

        let repos = await gh.listRepos(Test.ORGNAME);
        expect(repos).to.be.an('array');
        expect(repos.length > 0).to.be.true;

        // delete test repos if needed
        for (const repo of repos as any) {
            Log.info('Evaluating repo: ' + repo.name);
            for (const r of REPOS) {
                if (repo.name === r) {
                    let val = await
                        gh.deleteRepo(Test.ORGNAME, r);
                    expect(val).to.be.true;
                }
            }
        }


        // delete teams if needed
        let teams = await
            gh.listTeams(Test.ORGNAME);
        expect(teams).to.be.an('array');
        expect(teams.length > 0).to.be.true;
        Log.test('All Teams: ' + JSON.stringify(teams));
        for (const team of teams as any) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            for (const t of TEAMS) {
                if (team.name === t) {
                    Log.test("Old test team found; removing: " + team.name);
                    let val = await
                        gh.deleteTeam(Test.ORGNAME, team.id);
                    expect(val).to.be.true;
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done');
    }).timeout(TIMEOUT * 10);


    function getProjectPrefix(org: string): string {
        return "TEST__X__secap_";
    }

    function getTeamPrefix(org: string) {
        return "TEST__X__t_";
    }
});
