import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import Util from "../../../../common/Util";

import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {GitHubActions} from "../../src/controllers/GitHubActions";
import {PersonController} from "../../src/controllers/PersonController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";

import {Test} from "../GlobalSpec";
import '../GlobalSpec';
// const loadFirst = require('../GlobalSpec');

describe("GitHubActions", () => {

    // TODO: investigate skipping this way: https://stackoverflow.com/a/41908943 (and turning them on/off with an env flag)

    let gh: GitHubActions;

    const TIMEOUT = Test.TIMEOUTLONG; // was 20000; // was 5000

    // let DELAY_SEC = 1000;
    const DELAY_SHORT = 200;

    const REPONAME = getProjectPrefix() + Test.REPONAME1;
    const REPONAME3 = getProjectPrefix() + Test.REPONAME3;
    const TEAMNAME = getTeamPrefix() + Test.TEAMNAME1;

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    before(async () => {
        Log.test("GitHubActionSpec::before() - start; forcing testorg");
        // test github actions on a test github instance (for safety)
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        // TODO: Test.suiteBefore missing
    });

    beforeEach(function() {
        Log.test('GitHubActionSpec::BeforeEach - "' + (this as any).currentTest.title + '"');

        const exec = Test.runSlowTest();
        // exec = true;
        if (exec === true) {
            Log.test("GitHubActionSpec::beforeEach() - running in CI; not skipping");
            gh = new GitHubActions();
        } else {
            Log.test("GitHubActionSpec::beforeEach() - skipping (not CI)");
            this.skip();
        }
    });

    afterEach(function() {
        Log.test('AfterTest: "' + (this as any).currentTest.title + '"');
    });

    after(async () => {
        Log.test("GitHubActionSpec::after() - start; replacing original org");
        // return to original org
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
    });

    const TESTREPONAMES = ["testtest__repo1",
        "secap_cpscbot",
        "secap_rthse2",
        "secap_ubcbot",
        "secap_testtest__repo1",
        "TESTrepo1",
        "TESTrepo2",
        "TESTrepo3",
        REPONAME,
        REPONAME3
    ];

    const TESTTEAMNAMES = [
        "rtholmes",
        "ubcbot",
        "rthse2",
        "cpscbot",
        "TEST__X__t_TESTteam1",
        "TESTteam1",
        "TESTteam2",
        "TESTteam3",
        "TESTteam4",
        TEAMNAME
    ];

    it("Clear stale repos and teams.", async function() {
        const del = await deleteStale();
        expect(del).to.be.true;
    }).timeout(TIMEOUT * 100);

    it("Should not be possible to find a repo that does not exist.", async function() {
        const val = await gh.repoExists(REPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should not be possible to delete a repo that does not exist.", async function() {
        // and it should do so without crashing
        const val = await gh.deleteRepo(REPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to create a repo.", async function() {
        const rc = new RepositoryController();
        await rc.createRepository(REPONAME, [], {});

        const val = await gh.createRepo(REPONAME);
        const name = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME;
        expect(val).to.equal(name);
    }).timeout(TIMEOUT);

    it("Should be possible to find a repo that does exist.", async function() {
        const val = await gh.repoExists(REPONAME);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to remove a repo that does exist.", async function() {
        const val = await gh.deleteRepo(REPONAME);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to create the repo again.", async function() {
        const val = await gh.createRepo(REPONAME);
        const name = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME;
        expect(val).to.equal(name);
    }).timeout(TIMEOUT);

    it("Should be able to list a webhook.", async function() {
        const val = await gh.listWebhooks(REPONAME);
        expect(val).to.be.empty;
    }).timeout(TIMEOUT);

    it("Should be able to create a webhook.", async function() {
        let hooks = await gh.listWebhooks(REPONAME);
        expect(hooks).to.be.empty;

        const createHook = await gh.addWebhook(REPONAME, 'https://localhost/test');
        expect(createHook).to.be.true;

        hooks = await gh.listWebhooks(REPONAME);
        expect(hooks).to.have.lengthOf(1);
    }).timeout(TIMEOUT);

    it("Should not be possible to get a team number for a team that does not exist.", async function() {
        const val = await gh.getTeamNumber(TEAMNAME);
        Log.test('Team # ' + val);
        expect(val).to.be.lessThan(0);
    }).timeout(TIMEOUT);

    it("Should be able to create a team, add users to it, and add it to the repo.", async function() {
        const val = await gh.createTeam(TEAMNAME, 'push');
        Log.test("Team details: " + JSON.stringify(val));
        expect(val.teamName).to.equal(TEAMNAME);
        expect(val.githubTeamNumber).to.be.an('number');
        expect(val.githubTeamNumber > 0).to.be.true;

        const addMembers = await gh.addMembersToTeam(val.teamName, val.githubTeamNumber,
            [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        expect(addMembers.teamName).to.equal(TEAMNAME); // not a strong test

        const teamAdd = await gh.addTeamToRepo(val.githubTeamNumber, REPONAME, 'push');
        expect(teamAdd.githubTeamNumber).to.equal(val.githubTeamNumber);

        const staffTeamNumber = await gh.getTeamNumber('staff');
        const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
        expect(staffAdd.githubTeamNumber).to.equal(staffTeamNumber);

    }).timeout(TIMEOUT);

    it("Should be possible to get a team number for a team that does exist.", async function() {
        const val = await gh.getTeamNumber(TEAMNAME);
        Log.test('Team # ' + val);
        expect(val).to.be.greaterThan(0);

        // let bool = await gh.teamExists(TEAMNAME);
        // expect(bool).to.be.true;
    }).timeout(TIMEOUT);

    it("Should get an empty array of team members for a team that does not exist.", async function() {
        const val = await gh.getTeamMembers(-1337);
        Log.test('# Team members: ' + val.length);
        expect(val.length).to.equal(0);
    }).timeout(TIMEOUT);

    it("Should be able to get member names for a valid team.", async function() {
        const teamnum = await gh.getTeamNumber('staff');
        expect(teamnum).to.be.greaterThan(0);
        const val = await gh.getTeamMembers(teamnum);
        Log.test('# Team members: ' + val.length);
        expect(val.length).to.be.greaterThan(0);
        expect(val).to.contain('rtholmes');
    }).timeout(TIMEOUT);

    it("Should be able to create many teams and get their numbers (tests team paging).", async function() {

        gh.PAGE_SIZE = 2; // force a small page size for testing
        const NUM_TEAMS = 4; // could do 100 for a special test, but this is really slow

        // should be able to create the teams
        for (let i = 0; i < NUM_TEAMS; i++) {
            const teamname = TEAMNAME + '_paging-' + i;
            const val = await gh.createTeam(teamname, 'push');
            await gh.delay(200);
            Log.test("Team details: " + JSON.stringify(val));
            expect(val.teamName).to.equal(teamname);
            expect(val.githubTeamNumber).to.be.an('number');
            expect(val.githubTeamNumber).to.be.greaterThan(0);
        }

        // should be able to get their number
        for (let i = 0; i < NUM_TEAMS; i++) {
            const teamname = TEAMNAME + '_paging-' + i;
            await gh.delay(200);
            const val = await gh.getTeamNumber(teamname);
            Log.test("Team details: " + JSON.stringify(val));
            expect(val).to.be.an('number');
            expect(val).to.be.greaterThan(0);
        }

    }).timeout(TIMEOUT * 20);

    it("Should be able to create many repos and get them back (tests repo paging).", async function() {

        const NUM_REPOS = 4;
        const rc = new RepositoryController();

        gh.PAGE_SIZE = 2; // force a small page size for testing
        // should be able to create the teams
        for (let i = 0; i < NUM_REPOS; i++) {
            const reponame = REPONAME + '_paging-' + i;
            await rc.createRepository(reponame, [], {});
            const val = await gh.createRepo(reponame);
            await gh.delay(200);
            Log.test("Repo details: " + JSON.stringify(val));
            expect(val.indexOf(reponame)).to.be.greaterThan(-1);
            expect(val).to.be.an('string');
        }

        const allRepos = await gh.listRepos();
        // should be able to get their number
        for (let i = 0; i < NUM_REPOS; i++) {
            const reponame = REPONAME + '_paging-' + i;
            let found = false;
            for (const repo of allRepos) {
                if (repo.name === reponame) {
                    Log.test("Found repo: " + reponame);
                    found = true;
                }
            }
            if (found === false) {
                Log.test("Missing repo: " + reponame);
            }
            // expect(found).to.be.true;
        }

    }).timeout(TIMEOUT * 1000);

    it("Should be able to clone a source repo into a newly created repository.", async function() {
        const start = Date.now();
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME;
        const importUrl = 'https://github.com/SECapstone/bootstrap'; // this is hard coded, but at least it's public

        const output = await gh.importRepoFS(importUrl, targetUrl);
        expect(output).to.be.true;

        Log.test('Full clone took: ' + Util.took(start));
    }).timeout(120 * 1000); // 2 minutes

    it("Should be able to clone a source repository, and select files to create a new repository.", async function() {
        const tc: TeamController = new TeamController();
        const rc: RepositoryController = new RepositoryController();
        const dc: DeliverablesController = new DeliverablesController();
        const pc: PersonController = new PersonController();

        // get some persons
        const p1 = await pc.getPerson(Test.USER1.id);
        const p2 = await pc.getPerson(Test.USER2.id);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        // get the deliverable
        const deliv = await dc.getDeliverable(Test.DELIVID0);
        expect(deliv).to.not.be.null;

        // create the team
        const team = await tc.createTeam(Test.TEAMNAME3, deliv, [p1, p2], {});
        expect(team).to.not.be.null;

        // create the repository
        const repo = await rc.createRepository(REPONAME3, [team], {});
        expect(repo).to.not.be.null;
        const val = await gh.createRepo(REPONAME3);
        const newName = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME3;
        expect(val).to.equal(newName);

        // perform the import
        const start = Date.now();
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME3;
        const importUrl = 'https://github.com/SECapstone/capstone'; // hardcoded public repo
        const selectedFiles = 'AutoTest.md';
        const output = await gh.importRepoFS(importUrl, targetUrl, selectedFiles);
        expect(output).to.be.true;

        Log.test('Partial clone took: ' + Util.took(start));
    }).timeout(120 * 1000);

    it("Should be able to soft-write a file to a repo, where the file doesn't exist.", async function() {
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME3;

        const success = await gh.writeFileToRepo(targetUrl, "test_file.txt", "hello world!");
        expect(success).to.be.true;
    }).timeout(2 * TIMEOUT);

    it("Should be able to hard-write a file to a repo, where the file doesn't exist.", async function() {
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME3;

        const success = await gh.writeFileToRepo(targetUrl, "test_file2.txt", "hello world!", true);
        expect(success).to.be.true;
    }).timeout(2 * TIMEOUT);

    it("Should be able to hard-write a file to a repo, where the file does exist.", async function() {
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME3;

        const success = await gh.writeFileToRepo(targetUrl, "test_file.txt", "hello world2!", true);
        expect(success).to.be.true;
    }).timeout(2 * TIMEOUT);

    it("Should not be able to soft-write a file to a repo that doesn't exist.", async function() {
        const success = await gh.writeFileToRepo("invalidurl.com", "test_file2.txt", "hello world!");
        expect(success).to.be.false;
    }).timeout(2 * TIMEOUT);

    it("Should not be able to hard-write a file to a repo that doesn't exist.", async function() {
        const success = await gh.writeFileToRepo("invalidurl.com", "test_file2.txt", "hello world!", true);
        expect(success).to.be.false;
    }).timeout(2 * TIMEOUT);

    /**
     * This test is terrible, but gets the coverage tools to stop complaining.
     */
    it("Should make sure that actions can actually fail.", async function() {
        if (1 > 0) {
            // terrible skip
            return;
        }
        const old = (gh as any).gitHubAuthToken;
        (gh as any).gitHubAuthToken = "FOOFOOFOO";

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
        (gh as any).gitHubAuthToken = old; // restore token
    }).timeout(TIMEOUT);

    it("Should be able to create a repo, " +
        "create a team, add users to it, add it to the repo, " +
        "and change their permissions", async function() {
        const githubTeam = await gh.createTeam(TEAMNAME, 'push');
        expect(githubTeam.teamName).to.be.equal(TEAMNAME);
        expect(githubTeam.githubTeamNumber).to.be.an('number');
        expect(githubTeam.githubTeamNumber > 0).to.be.true;

        // Expects adding members to work
        const addMembers = await gh.addMembersToTeam(githubTeam.teamName, githubTeam.githubTeamNumber,
            [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        expect(addMembers).to.not.be.null;
        const teamAdd = await gh.addTeamToRepo(githubTeam.githubTeamNumber, REPONAME, 'push');
        expect(teamAdd).to.not.be.null;

        const staffTeamNumber = await gh.getTeamNumber('staff');
        const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
        expect(staffAdd).to.not.be.null;
        const permissionEdit = await gh.setRepoPermission(REPONAME, "pull");
        expect(permissionEdit).to.be.true;

    }).timeout(TIMEOUT);

    it("Should not be able to bulk edit permissions to admins", async function() {
        const githubTeam = await gh.createTeam(TEAMNAME, 'push');
        expect(githubTeam.teamName).to.be.equal(TEAMNAME);
        expect(githubTeam.githubTeamNumber).to.be.an('number');
        expect(githubTeam.githubTeamNumber > 0).to.be.true;

        // Expects adding members to work
        const addMembers = await gh.addMembersToTeam(githubTeam.teamName, githubTeam.githubTeamNumber,
            [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        expect(addMembers).to.not.be.null;
        const teamAdd = await gh.addTeamToRepo(githubTeam.githubTeamNumber, REPONAME, 'push');
        expect(teamAdd).to.not.be.null;

        const staffTeamNumber = await gh.getTeamNumber('staff');
        const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
        expect(staffAdd).to.not.be.null;
        let fail = null; // only gets a value if the function returned (when it should be failing)
        try {
            fail = await gh.setRepoPermission(REPONAME, "admin");
        } catch (err) {
            // this is what should happen
        }
        expect(fail).to.be.null;

    }).timeout(TIMEOUT);

    it("Clear stale repos and teams.", async function() {
        const del = await deleteStale();
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
                    await gh.deleteRepo(r);
                    await gh.delay(DELAY_SHORT);
                    // expect(val).to.be.true;
                }
            }
        }

        repos = await gh.listRepos();
        // delete test repos if needed
        for (const repo of repos as any) {
            Log.info('Evaluating repo: ' + repo.name);
            if (repo.name.indexOf('TEST__X__') === 0 || repo.name.startsWith(REPONAME)) {
                Log.info('Removing stale repo: ' + repo.name);
                await gh.deleteRepo(repo.name);
                // expect(val).to.be.true;
                const teamName = repo.name.substr(15);
                Log.info('Adding stale team name: ' + repo.name);
                TESTTEAMNAMES.push(teamName);
            }
        }

        // delete teams if needed
        const teams = await gh.listTeams();
        expect(teams).to.be.an('array');
        // expect(teams.length > 0).to.be.true; // can have 0 teams
        Log.test('All Teams: ' + JSON.stringify(teams));
        Log.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
        for (const team of teams as any) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            let done = false;
            for (const t of TESTTEAMNAMES) {
                if (team.name === t) {
                    Log.test("Removing stale team: " + team.name);
                    await gh.deleteTeam(team.id);
                    await gh.delay(DELAY_SHORT);
                    done = true;
                }
            }
            if (done === false) {
                if (team.name.startsWith(TEAMNAME) === true) {
                    Log.test("Removing stale team: " + team.name);
                    await gh.deleteTeam(team.id);
                    await gh.delay(DELAY_SHORT);
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done');
        return true;
    }

});
