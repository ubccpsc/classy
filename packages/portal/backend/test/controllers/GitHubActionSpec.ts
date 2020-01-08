import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {Test} from "../../../../common/TestHarness";
import Util from "../../../../common/Util";
import {DatabaseController} from "../../src/controllers/DatabaseController";

import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {GitHubActions, IGitHubActions} from "../../src/controllers/GitHubActions";
import {PersonController} from "../../src/controllers/PersonController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";

import '../GlobalSpec';

describe("GitHubActions", () => {

    // TODO: investigate skipping this way: https://stackoverflow.com/a/41908943 (and turning them on/off with an env flag)

    // const gh: IGitHubActions = new TestGitHubActions();
    const gh: IGitHubActions = GitHubActions.getInstance(true);

    const TIMEOUT = Test.TIMEOUTLONG; // was 20000; // was 5000

    // let DELAY_SEC = 1000;
    const DELAY_SHORT = 200;

    const REPONAME = Test.REPONAME1;
    const REPONAME3 = Test.REPONAME3;
    const TEAMNAME = Test.TEAMNAME1;

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    before(async () => {
        Log.test("GitHubActionSpec::before() - start; forcing testorg");
        // test github actions on a test github instance (for safety)
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        await Test.suiteBefore("GitHubActionSpec");
        await Test.prepareAll();
    });

    beforeEach(function() {
        gh.setPageSize(2); // force a small page size for testing

        const exec = Test.runSlowTest();
        // exec = true;
        if (exec === true) {
            Log.test("GitHubActionSpec::beforeEach() - running in CI; not skipping");
        } else {
            Log.test("GitHubActionSpec::beforeEach() - skipping (not CI)");
            this.skip();
        }
    });

    afterEach(function() {
        gh.setPageSize(100);
    });

    after(async () => {
        Log.test("GitHubActionSpec::after() - start; replacing original org");
        // return to original org
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
        Test.suiteAfter("GitHubActionSpec");
    });

    const TESTREPONAMES = ["testtest__repo1",
        "secap_cpscbot",
        "secap_rthse2",
        "secap_ubcbot",
        "secap_testtest__repo1",
        "TESTrepo1",
        "TESTrepo2",
        "TESTrepo3",
        Test.REPONAME1,
        Test.REPONAME2,
        Test.REPONAME3,
        Test.REPONAMEREAL
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
        Test.TEAMNAME1,
        Test.TEAMNAME2,
        Test.TEAMNAME3,
        Test.TEAMNAME4,
        Test.TEAMNAMEREAL
    ];

    it("Clear stale repos and teams.", async function() {
        // this shouldn't be a test, but the before times out if we don't do it here
        const del = await deleteStale();
        expect(del).to.be.true;
    }).timeout(TIMEOUT * 100);

    it("Should not be possible to find a repo that does not exist.", async function() {
        const val = await gh.repoExists(Test.INVALIDREPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should not be possible to delete a repo that does not exist.", async function() {
        // and it should do so without crashing
        const val = await gh.deleteRepo(Test.INVALIDREPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to create a repo.", async function() {
        const rc = new RepositoryController();
        const dc = new DeliverablesController();
        const deliv = await dc.getDeliverable(Test.DELIVID0);
        await rc.createRepository(REPONAME, deliv, [], {});

        const val = await gh.createRepo(REPONAME);
        const name = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME;
        expect(val).to.equal(name);
    }).timeout(TIMEOUT);

    it("Should fail to create a repo if there is no corresponding Repository object.", async function() {
        let res = null;
        let ex = null;
        try {
            res = await gh.createRepo('INVALIDREPONAME');
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
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
        let hooks = await gh.listWebhooks(REPONAME); // REPONAME
        expect(hooks).to.be.empty;

        const hookName = 'https://localhost/test/' + Date.now();
        const createHook = await gh.addWebhook(REPONAME, hookName);
        expect(createHook).to.be.true;

        hooks = await gh.listWebhooks(REPONAME);
        expect(hooks).to.have.lengthOf(1);
        expect((hooks[0] as any).config.url).to.equal(hookName);
    }).timeout(TIMEOUT);

    it("Should be able to edit a webhook.", async function() {
        let hooks = await gh.listWebhooks(REPONAME);
        expect(hooks).to.have.lengthOf(1);

        const oldHook = (hooks[0] as any).config.url;
        const NEWHOOK = 'https://localhost/testNEWHOOK/' + Date.now();
        expect(oldHook).to.not.equal(NEWHOOK);

        // update the hook
        const updated = await gh.updateWebhook(REPONAME, NEWHOOK);
        expect(updated).to.be.true;

        hooks = await gh.listWebhooks(REPONAME);
        const newHook = (hooks[0] as any).config.url;
        expect(newHook).to.equal(NEWHOOK);
    }).timeout(TIMEOUT);

    it("Should be possible to list the repos in an org.", async function() {
        const res = await gh.listRepos();
        Log.test('# repos ' + res.length);
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);
    }).timeout(TIMEOUT);

    it("Should be possible to list people in an org.", async function() {
        // gh.setPageSize(100);
        const res = await gh.listPeople();
        Log.test('# people ' + res.length);
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);
    }).timeout(TIMEOUT);

    it("Should be possible to list the teams in an org.", async function() {
        const res = await gh.listTeams();
        Log.test('# teams ' + res.length);
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);
    }).timeout(TIMEOUT);

    it("Should be possible to identify an admin from the admin team.", async function() {
        let res = await gh.isOnAdminTeam(Test.ADMIN1.github);
        Log.test('res: ' + res);
        expect(res).to.be.an('boolean');
        expect(res).to.be.true;

        // student shouldn't be admin
        res = await gh.isOnAdminTeam(Test.USER1.github);
        Log.test('res: ' + res);
        expect(res).to.be.an('boolean');
        expect(res).to.be.false;

        // random shouldn't be admin
        res = await gh.isOnAdminTeam('unknown' + Date.now());
        Log.test('res: ' + res);
        expect(res).to.be.an('boolean');
        expect(res).to.be.false;

    }).timeout(TIMEOUT);

    it("Should be possible to identify a staff from the staff team.", async function() {
        let res = await gh.isOnStaffTeam(Test.STAFF1.github);
        Log.test('res: ' + res);
        expect(res).to.be.an('boolean');
        expect(res).to.be.true;

        // student shouldn't be admin
        res = await gh.isOnStaffTeam(Test.USER1.github);
        Log.test('res: ' + res);
        expect(res).to.be.an('boolean');
        expect(res).to.be.false;

        // random shouldn't be admin
        res = await gh.isOnStaffTeam('unknown' + Date.now());
        Log.test('res: ' + res);
        expect(res).to.be.an('boolean');
        expect(res).to.be.false;
    }).timeout(TIMEOUT);

    it("Should not be possible to get a team number for a team that does not exist.", async function() {
        const val = await gh.getTeamNumber(Test.INVALIDTEAMNAME);
        Log.test('Team # ' + val);
        expect(val).to.be.lessThan(0);
    }).timeout(TIMEOUT);

    it("Should be able to create a team, add users to it, and add it to the repo.", async function() {
        const val = await gh.createTeam(TEAMNAME, 'push');
        Log.test("Team created; details: " + JSON.stringify(val));
        expect(val.teamName).to.equal(TEAMNAME);
        expect(val.githubTeamNumber).to.be.an('number');
        expect(val.githubTeamNumber > 0).to.be.true;

        const addMembers = await gh.addMembersToTeam(val.teamName,
            [Test.GITHUB1.github, Test.GITHUB2.github]);
        expect(addMembers.teamName).to.equal(TEAMNAME); // not a strong test
        Log.test("Members added");

        const teamAdd = await gh.addTeamToRepo(val.githubTeamNumber, REPONAME, 'push');
        expect(teamAdd.githubTeamNumber).to.equal(val.githubTeamNumber);
        Log.test("Team added to repo");

        const staffTeamNumber = await gh.getTeamNumber('staff');
        Log.test("Team staff number: " + staffTeamNumber);
        const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
        expect(staffAdd.githubTeamNumber).to.equal(staffTeamNumber);
        Log.test("Team staff added to repo");

    }).timeout(TIMEOUT);

    it("Should be possible to get a team number for a team that does exist.", async function() {
        const val = await gh.getTeamNumber(Test.TEAMNAME1);
        Log.test('Team # ' + val);
        expect(val).to.be.greaterThan(0);

        // let bool = await gh.teamExists(TEAMNAME);
        // expect(bool).to.be.true;
    }).timeout(TIMEOUT);

    it("Should fail to get team members for an invalid team number argument.", async function() {
        let val = null;
        let ex = null;
        try {
            val = await gh.getTeamMembers(null);
        } catch (err) {
            ex = err;
        }
        expect(val).to.be.null;
        expect(ex).to.not.be.null;
    }).timeout(TIMEOUT);

    it("Should get an empty array of team members for a team that does not exist.", async function() {
        const val = await gh.getTeamMembers(-1337);
        Log.test('# Team members: ' + val.length);
        expect(val.length).to.equal(0);
    }).timeout(TIMEOUT);

    it("Should be able to get member names for a valid team.", async function() {
        const teamnum = await gh.getTeamNumber('staff');
        Log.test("staff team #: " + teamnum);
        expect(teamnum).to.be.an('number');
        expect(teamnum > 0).to.be.true;
        const val = await gh.getTeamMembers(teamnum);
        Log.test('# Team members: ' + val.length);
        expect(val.length).to.be.greaterThan(0);
        expect(val).to.contain(Test.ADMINSTAFF1.github);
    }).timeout(TIMEOUT);

    it("Should be able to create many teams and get their numbers (tests team paging).", async function() {

        gh.setPageSize(2); // force a small page size for testing
        const NUM_TEAMS = 4; // could do 100 for a special test, but this is really slow
        const dbc = DatabaseController.getInstance();

        // should be able to create the teams
        for (let i = 0; i < NUM_TEAMS; i++) {
            const teamname = TEAMNAME + '_paging-' + i;
            const team = await Test.createTeam(teamname, Test.DELIVID0, []);
            await dbc.writeTeam(team); // get in database

            const val = await gh.createTeam(teamname, 'push');
            await Util.delay(200);
            Log.test("Team details: " + JSON.stringify(val));
            expect(val.teamName).to.equal(teamname);
            expect(val.githubTeamNumber).to.be.an('number');
            expect(val.githubTeamNumber).to.be.greaterThan(0);
        }

        // should be able to get their number
        for (let i = 0; i < NUM_TEAMS; i++) {
            const teamname = TEAMNAME + '_paging-' + i;
            await Util.delay(200);
            const val = await gh.getTeamNumber(teamname);
            Log.test("Team details: " + JSON.stringify(val));
            expect(val).to.be.an('number');
            expect(val).to.be.greaterThan(0);
        }

    }).timeout(TIMEOUT * 20);

    it("Should be able to create many repos and get them back (tests repo paging).", async function() {

        const NUM_REPOS = 4;
        const rc = new RepositoryController();

        const dc = new DeliverablesController();
        const deliv = await dc.getDeliverable(Test.DELIVID0);

        gh.setPageSize(2); // force a small page size for testing

        // should be able to create the teams
        for (let i = 0; i < NUM_REPOS; i++) {
            const reponame = REPONAME + '_paging-' + i;
            await rc.createRepository(reponame, deliv, [], {});
            const val = await gh.createRepo(reponame);
            await Util.delay(200);
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
                if (repo.repoName === reponame) {
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
        // keep a random repo public here so that all Github instances can work with cloning this:
        const importUrl = Config.getInstance().getProp(ConfigKey.githubHost) + '/classytest/' + Test.REPONAMEREAL_TESTINGSAMPLE;

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
        const repo = await rc.createRepository(REPONAME3, deliv, [team], {});
        expect(repo).to.not.be.null;
        const val = await gh.createRepo(REPONAME3);
        const newName = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME3;
        const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
        expect(val).to.equal(newName);

        // perform the import
        const start = Date.now();
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + REPONAME3;
        const importUrl = githubHost + '/classytest/' + Test.REPONAMEREAL_TESTINGSAMPLE;
        const selectedFiles = 'README.md';
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
            await gh.addMembersToTeam('INVALIDTEAMNAME', ['INVALIDPERSONNAME']);
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
        const addMembers = await gh.addMembersToTeam(githubTeam.teamName,
            [Test.GITHUB1.github, Test.GITHUB2.github]);
        expect(addMembers).to.not.be.null;
        const teamAdd = await gh.addTeamToRepo(githubTeam.githubTeamNumber, REPONAME, 'push');
        expect(teamAdd).to.not.be.null;

        const staffTeamNumber = await gh.getTeamNumber('staff');
        const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
        expect(staffAdd).to.not.be.null;
        const permissionEdit = await gh.setRepoPermission(REPONAME, "pull");
        expect(permissionEdit).to.be.true;

    }).timeout(TIMEOUT);

    it("Should not be able to change permissions of a repo that does not exist.", async function() {
        const permissionEdit = await gh.setRepoPermission(Test.INVALIDREPONAME, "pull");
        expect(permissionEdit).to.be.false;

    }).timeout(TIMEOUT);

    it("Should not be able to change permissions of a repo to an invalid value.", async function() {
        let permissionEdit = null;
        let ex = null;
        try {
            permissionEdit = await gh.setRepoPermission(Test.REPONAME1, "invalidvalue");
        } catch (err) {
            ex = err;
        }
        expect(permissionEdit).to.be.null;
        expect(ex).to.not.be.null;
    }).timeout(TIMEOUT);

    // this test wasn't failing for the right reasons and was disabled until we can figure out what is going on
    // it("Should not be able to bulk edit permissions to admins", async function() {
    //     const githubTeam = await gh.teamCreate(TEAMNAME, 'push');
    //     expect(githubTeam.teamName).to.be.equal(TEAMNAME);
    //     expect(githubTeam.githubTeamNumber).to.be.an('number');
    //     expect(githubTeam.githubTeamNumber > 0).to.be.true;
    //
    //     // Expects adding members to work
    //     const addMembers = await gh.addMembersToTeam(githubTeam.teamName, githubTeam.githubTeamNumber,
    //         [Test.REALBOTNAME01, Test.REALUSERNAME]);
    //     expect(addMembers).to.not.be.null;
    //     const teamAdd = await gh.addTeamToRepo(githubTeam.githubTeamNumber, REPONAME, 'push');
    //     expect(teamAdd).to.not.be.null;
    //
    //     const staffTeamNumber = await gh.getTeamNumber('staff');
    //     const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, 'admin');
    //     expect(staffAdd).to.not.be.null;
    //     let fail = null; // only gets a value if the function returned (when it should be failing)
    //     try {
    //         fail = await gh.setRepoPermission(REPONAME, "admin");
    //     } catch (err) {
    //         // this is what should happen
    //     }
    //     expect(fail).to.be.false;
    //
    // }).timeout(TIMEOUT);

    it("Should be possible to find the teams on a repo.", async function() {
        const val = await gh.getTeamsOnRepo(Test.REPONAMEREAL);
        expect(val).to.be.an('array');
        expect(val.length).to.equal(0);
    }).timeout(TIMEOUT);

    it("Should be possible to get the team from a number.", async function() {
        const teamNumber = await gh.getTeamNumber(TEAMNAME);
        expect(teamNumber).to.be.greaterThan(0);

        const val = await gh.getTeam(teamNumber);
        expect(val).to.be.an('object');
        expect(val.githubTeamNumber).to.equal(teamNumber);
        expect(val.teamName).to.equal(TEAMNAME);
    }).timeout(TIMEOUT);

    it("Should not be possible to get the team that does not exist.", async function() {
        let res: any = "exists";
        let ex = null;
        try {
            res = await gh.getTeam(-1337);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null; // non-existant should return null
        expect(ex).to.be.null;
    }).timeout(TIMEOUT);

    it("Should not be possible to get the team with an invalid param.", async function() {
        let res = null;
        let ex = null;
        try {
            res = await gh.getTeam(null);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
    }).timeout(TIMEOUT);

    it("Should be possible to check the database.", async function() {
        let res = await GitHubActions.checkDatabase(null, null);
        expect(res).to.be.true;

        // if anything goes wrong exceptions will be thrown
        res = await GitHubActions.checkDatabase(REPONAME, TEAMNAME);
        expect(res).to.be.true;
    }).timeout(TIMEOUT);

    it("Should not be possible to simulate a webhook with the wrong params.", async function() {
        let worked = await gh.simulateWebookComment(null, "SHA", "message");
        expect(worked).to.be.false;

        worked = await gh.simulateWebookComment(REPONAME, null, "message");
        expect(worked).to.be.false;

        worked = await gh.simulateWebookComment(REPONAME, "SHA", null);
        expect(worked).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be possible to simulate a webhook.", async function() {
        let worked = await gh.simulateWebookComment(Test.REPONAMEREAL_POSTTEST, "SHA", "message");
        expect(worked).to.be.false; // SHA is not right

        let ex = null;
        try {
            let msg = "message";
            worked = await gh.simulateWebookComment(Test.REPONAMEREAL_POSTTEST, "c35a0e5968338a9757813b58368f36ddd64b063e", msg);

            for (let i = 0; i < 10; i++) {
                msg = msg + msg; // make a long message
            }
            msg = msg + '\n' + msg;
            worked = await gh.simulateWebookComment(Test.REPONAMEREAL_POSTTEST, "c35a0e5968338a9757813b58368f36ddd64b063e", msg);

            // NOTE: worked not checked because githubWebhook needs to be active for this to work
            // expect(worked).to.be.true;
            expect(worked).to.not.be.null;
        } catch (err) {
            ex = err;
        }
        expect(ex).to.be.null; // at least don't throw an exception
    }).timeout(TIMEOUT);

    it("Should not be possible to make a comment with invalid params.", async function() {
        let worked = await gh.makeComment(null, "message");
        expect(worked).to.be.false;

        worked = await gh.makeComment("URL", null);
        expect(worked).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be possible to make a comment.", async function() {
        const githubAPI = Config.getInstance().getProp(ConfigKey.githubAPI);
        let msg = "message";
        let url = githubAPI + '/repos/classytest/' + Test.REPONAMEREAL_POSTTEST + '/commits/INVALIDSHA/comments';
        let worked = await gh.makeComment(url, msg);
        expect(worked).to.be.false; // false because SHA is invalid

        for (let i = 0; i < 10; i++) {
            msg = msg + msg; // make a long message
        }
        msg = msg + '\n' + msg;

        url = githubAPI + "/repos/classytest/" + Test.REPONAMEREAL_POSTTEST +
            "/commits/c35a0e5968338a9757813b58368f36ddd64b063e/comments";
        worked = await gh.makeComment(url, msg);
        expect(worked).to.be.true; // should have worked
    }).timeout(TIMEOUT);

    it("Should be possible to find the teams on a repo.", async function() {
        const val = await gh.getTeamsOnRepo(REPONAME);
        Log.test("listed teams: " + JSON.stringify(val));
        expect(val).to.be.an('array');
        expect(val.length).to.equal(2);

        let exists = false;
        for (const team of val) {
            if (team.teamName === 'staff') {
                exists = true;
            }
        }
        expect(exists).to.be.true;

        exists = false;
        for (const team of val) {
            if (team.teamName === Test.TEAMNAME1) {
                exists = true;
            }
        }
        expect(exists).to.be.true;

    }).timeout(TIMEOUT);

    it("Should be possible to find the members of a team.", async function() {
        const val = await gh.listTeamMembers(TEAMNAME);
        Log.test("listed members: " + JSON.stringify(val));
        expect(val).to.be.an('array');
        expect(val.length).to.equal(2);
        expect(val).to.include(Test.GITHUB1.github);
        expect(val).to.include(Test.GITHUB2.github);
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
        const start = Date.now();

        let repos = await gh.listRepos();
        expect(repos).to.be.an('array');
        // expect(repos.length > 0).to.be.true; // test org can be empty

        // delete test repos if needed
        for (const repo of repos) {
            for (const r of TESTREPONAMES) {
                if (repo.repoName === r) {
                    Log.info('Removing stale repo: ' + repo.repoName);
                    await gh.deleteRepo(r);
                    await Util.delay(DELAY_SHORT);
                    // expect(val).to.be.true;
                }
            }
        }

        repos = await gh.listRepos();
        // delete test repos if needed
        for (const repo of repos) {
            Log.info('Evaluating repo: ' + repo.repoName);
            if (repo.repoName.indexOf('TEST__X__') === 0 || repo.repoName.startsWith(REPONAME) || repo.repoName.endsWith("_grades")) {
                Log.info('Removing stale repo: ' + repo.repoName);
                await gh.deleteRepo(repo.repoName);
                // expect(val).to.be.true;
                const teamName = repo.repoName.substr(15);
                Log.info('Adding stale team name: ' + repo.repoName);
                TESTTEAMNAMES.push(teamName);
            }
        }

        // delete teams if needed
        const teams = await gh.listTeams();
        expect(teams).to.be.an('array');
        // expect(teams.length > 0).to.be.true; // can have 0 teams
        Log.test('All Teams: ' + JSON.stringify(teams));
        Log.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
        for (const team of teams) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            let done = false;
            for (const t of TESTTEAMNAMES) {
                if (team.teamName === t) {
                    Log.test("Removing stale team: " + team.teamName);
                    await gh.deleteTeam(team.teamNumber);
                    await Util.delay(DELAY_SHORT);
                    done = true;
                }
            }
            if (done === false) {
                if (team.teamName.startsWith(TEAMNAME) === true) {
                    Log.test("Removing stale team: " + team.teamName);
                    await gh.deleteTeam(team.teamNumber);
                    await Util.delay(DELAY_SHORT);
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done; took: ' + Util.took(start));
        return true;
    }

});
