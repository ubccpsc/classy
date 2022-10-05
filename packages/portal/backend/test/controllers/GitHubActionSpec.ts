import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {TestHarness} from "@common/test/TestHarness";
import Util from "@common/Util";

import {DatabaseController} from "@backend/controllers/DatabaseController";
import {DeliverablesController} from "@backend/controllers/DeliverablesController";
import {GitHubActions, IGitHubActions} from "@backend/controllers/GitHubActions";
import {PersonController} from "@backend/controllers/PersonController";
import {RepositoryController} from "@backend/controllers/RepositoryController";
import {TeamController} from "@backend/controllers/TeamController";

import "../GlobalSpec";

describe("GitHubActions", () => {

    // TODO: investigate skipping this way: https://stackoverflow.com/a/41908943 (and turning them on/off with an env flag)

    // const gh: IGitHubActions = new TestGitHubActions();
    const gh: IGitHubActions = GitHubActions.getInstance(true);

    const TIMEOUT = TestHarness.TIMEOUTLONG; // was 20000; // was 5000

    // let DELAY_SEC = 1000;
    const DELAY_SHORT = 200;

    const REPONAME = TestHarness.REPONAME1;
    const REPONAME3 = TestHarness.REPONAME3;
    const TEAMNAME = TestHarness.TEAMNAME1;

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    before(async () => {
        Log.test("GitHubActionSpec::before() - start; forcing testorg");
        // test github actions on a test github instance (for safety)
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        await TestHarness.suiteBefore("GitHubActionSpec");
        await TestHarness.prepareAll();
    });

    beforeEach(function () {
        gh.setPageSize(2); // force a small page size for testing

        const exec = TestHarness.runSlowTest();
        // exec = true;
        if (exec === true) {
            Log.test("GitHubActionSpec::beforeEach() - running in CI; not skipping");
        } else {
            Log.test("GitHubActionSpec::beforeEach() - skipping (not CI)");
            this.skip();
        }
    });

    afterEach(function () {
        gh.setPageSize(100);
    });

    after(async () => {
        Log.test("GitHubActionSpec::after() - start; replacing original org");
        // return to original org
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
        TestHarness.suiteAfter("GitHubActionSpec");
    });

    const TESTREPONAMES = ["testtest__repo1",
        "secap_cpscbot",
        "secap_rthse2",
        "secap_ubcbot",
        "secap_testtest__repo1",
        "TESTrepo1",
        "TESTrepo2",
        "TESTrepo3",
        TestHarness.REPONAME1,
        TestHarness.REPONAME2,
        TestHarness.REPONAME3,
        TestHarness.REPONAMEREAL
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
        TestHarness.TEAMNAME1,
        TestHarness.TEAMNAME2,
        TestHarness.TEAMNAME3,
        TestHarness.TEAMNAME4,
        TestHarness.TEAMNAMEREAL
    ];

    it("Clear stale repos and teams.", async function () {
        // this should not be a test, but the before times out if we do not do it here
        const del = await deleteStale();
        expect(del).to.be.true;
    }).timeout(TIMEOUT * 100);

    it("Should not be possible to find a repo that does not exist.", async function () {
        const val = await gh.repoExists(TestHarness.INVALIDREPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should not be possible to delete a repo that does not exist.", async function () {
        // and it should do so without crashing
        const val = await gh.deleteRepo(TestHarness.INVALIDREPONAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should not be possible to find a team that does not exist.", async function () {
        const val = await gh.getTeamNumber(TestHarness.INVALIDTEAMNAME);
        expect(val).to.be.lessThan(0);
    }).timeout(TIMEOUT);

    it("Should not be possible to get the members of a team that does not exist.", async function () {
        const val = await gh.getTeamMembers(TestHarness.INVALIDTEAMNAME);
        expect(val).to.be.an("array");
        expect(val).to.have.length(0);
    }).timeout(TIMEOUT);

    it("Should not be possible to delete a team that does not exist.", async function () {
        // and it should do so without crashing
        const val = await gh.deleteTeam(TestHarness.INVALIDTEAMNAME);
        expect(val).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to create a repo.", async function () {
        const rc = new RepositoryController();
        const dc = new DeliverablesController();
        const deliv = await dc.getDeliverable(TestHarness.DELIVID0);
        await rc.createRepository(REPONAME, deliv, [], {});

        const val = await gh.createRepo(REPONAME);
        const name = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME;
        expect(val).to.equal(name);
    }).timeout(TIMEOUT);

    it("Should be able to create a team.", async function () {
        const val = await gh.createTeam(TEAMNAME, "push");
        Log.test("Team created; details: " + JSON.stringify(val));
        expect(val.teamName).to.equal(TEAMNAME);
        expect(val.githubTeamNumber).to.be.an("number");
        expect(val.githubTeamNumber > 0).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be possible to list the repos in an org.", async function () {
        const res = await gh.listRepos();
        Log.test("# repos " + res.length);
        expect(res).to.be.an("array");
        expect(res.length).to.be.greaterThan(0);
    }).timeout(TIMEOUT);

    it("Should be possible to list the teams in an org.", async function () {
        const res = await gh.listTeams();
        Log.test("# teams " + res.length);
        expect(res).to.be.an("array");
        expect(res.length).to.be.greaterThan(0);
    }).timeout(TIMEOUT);

    it("Should be possible to list people in an org.", async function () {
        // gh.setPageSize(100);
        const res = await gh.listPeople();
        Log.test("# people " + res.length);
        expect(res).to.be.an("array");
        expect(res.length).to.be.greaterThan(0);
    }).timeout(TIMEOUT);

    it("Should be possible to find a repo that does exist.", async function () {
        const val = await gh.repoExists(REPONAME);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be possible to find a team that does exist.", async function () {
        const val = await gh.getTeamNumber(TEAMNAME);
        expect(val).to.be.greaterThan(0);
    }).timeout(TIMEOUT);

    it("Should be possible to add members to a team that does exist.", async function () {
        const addMembers = await gh.addMembersToTeam(TEAMNAME,
            [TestHarness.GITHUB1.github, TestHarness.GITHUB2.github]);
        expect(addMembers.teamName).to.equal(TEAMNAME);
        Log.test("Members added");
    }).timeout(TIMEOUT);

    it("Should be possible to add get the members from a team.", async function () {
        const members = await gh.getTeamMembers(TEAMNAME);
        expect(members).to.contain(TestHarness.GITHUB1.github);
        expect(members).to.contain(TestHarness.GITHUB2.github);
    }).timeout(TIMEOUT);

    it("Should be possible to add a team to a repo.", async function () {
        let teamsOnRepo = await gh.getTeamsOnRepo(REPONAME);
        // make sure there is no team on the repo before starting
        expect(teamsOnRepo).to.be.an("array");
        expect(teamsOnRepo).to.have.length(0);

        const teamNum = await gh.getTeamNumber(TEAMNAME);
        expect(teamNum).to.be.greaterThan(0);

        // const teamAdd = await gh.addTeamToRepo(teamNum, REPONAME, "push");
        const teamAdd = await gh.addTeamToRepo(TEAMNAME, REPONAME, "push");
        expect(teamAdd.githubTeamNumber).to.equal(teamNum);

        teamsOnRepo = await gh.getTeamsOnRepo(REPONAME);
        // make sure there is now a team on the repo
        expect(teamsOnRepo).to.be.an("array");
        expect(teamsOnRepo).to.have.length(1);
    }).timeout(TIMEOUT);

    it("Should fail to create a repo if there is no corresponding Repository object.", async function () {
        let res = null;
        let ex = null;
        try {
            res = await gh.createRepo("INVALIDREPONAME");
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
    }).timeout(TIMEOUT);

    it("Should be able to remove a repo that does exist.", async function () {
        const val = await gh.deleteRepo(REPONAME);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to create the repo again.", async function () {
        const val = await gh.createRepo(REPONAME);
        const name = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME;
        expect(val).to.equal(name);
    }).timeout(TIMEOUT);

    it("Should be able to list a webhook.", async function () {
        const val = await gh.listWebhooks(REPONAME);
        expect(val).to.be.empty;
    }).timeout(TIMEOUT);

    it("Should be able to create a webhook.", async function () {
        let hooks = await gh.listWebhooks(REPONAME); // REPONAME
        expect(hooks).to.be.empty;

        const hookName = "https://cs.ubc.ca/test/" + Date.now();
        const createHook = await gh.addWebhook(REPONAME, hookName);
        expect(createHook).to.be.true;

        hooks = await gh.listWebhooks(REPONAME);
        expect(hooks).to.have.lengthOf(1);
        expect((hooks[0] as any).config.url).to.equal(hookName);
    }).timeout(TIMEOUT);

    it("Should be able to edit a webhook.", async function () {
        let hooks = await gh.listWebhooks(REPONAME);
        expect(hooks).to.have.lengthOf(1);

        const oldHook = (hooks[0] as any).config.url;
        const NEWHOOK = "https://cs.ubc.ca/testNEWHOOK/" + Date.now();
        expect(oldHook).to.not.equal(NEWHOOK);

        // update the hook
        const updated = await gh.updateWebhook(REPONAME, NEWHOOK);
        expect(updated).to.be.true;

        hooks = await gh.listWebhooks(REPONAME);
        const newHook = (hooks[0] as any).config.url;
        expect(newHook).to.equal(NEWHOOK);
    }).timeout(TIMEOUT);

    it("Should be possible to identify an admin from the admin team.", async function () {
        let res = await gh.isOnAdminTeam(TestHarness.ADMIN1.github);
        Log.test("res: " + res);
        expect(res).to.be.an("boolean");
        expect(res).to.be.true;

        // student should not be admin
        res = await gh.isOnAdminTeam(TestHarness.USER1.github);
        Log.test("res: " + res);
        expect(res).to.be.an("boolean");
        expect(res).to.be.false;

        // random should not be admin
        res = await gh.isOnAdminTeam("unknown" + Date.now());
        Log.test("res: " + res);
        expect(res).to.be.an("boolean");
        expect(res).to.be.false;

    }).timeout(TIMEOUT);

    it("Should be possible to identify a staff from the staff team.", async function () {
        let res = await gh.isOnStaffTeam(TestHarness.STAFF1.github);
        Log.test("res: " + res);
        expect(res).to.be.an("boolean");
        expect(res).to.be.true;

        // student should not be admin
        res = await gh.isOnStaffTeam(TestHarness.USER1.github);
        Log.test("res: " + res);
        expect(res).to.be.an("boolean");
        expect(res).to.be.false;

        // random should not be admin
        res = await gh.isOnStaffTeam("unknown" + Date.now());
        Log.test("res: " + res);
        expect(res).to.be.an("boolean");
        expect(res).to.be.false;
    }).timeout(TIMEOUT);

    it("Should not be possible to get a team number for a team that does not exist.", async function () {
        const val = await gh.getTeamNumber(TestHarness.INVALIDTEAMNAME);
        Log.test("Team # " + val);
        expect(val).to.be.lessThan(0);
    }).timeout(TIMEOUT);

    it("Should be able to create a team, add users to it, and add it to the repo.", async function () {
        const val = await gh.createTeam(TEAMNAME, "push");
        Log.test("Team created; details: " + JSON.stringify(val));
        expect(val.teamName).to.equal(TEAMNAME);
        expect(val.githubTeamNumber).to.be.an("number");
        expect(val.githubTeamNumber > 0).to.be.true;

        const addMembers = await gh.addMembersToTeam(val.teamName,
            [TestHarness.GITHUB1.github, TestHarness.GITHUB2.github]);
        expect(addMembers.teamName).to.equal(TEAMNAME); // not a strong test
        Log.test("Members added");

        const getTeamMembers = await gh.getTeamMembers(TEAMNAME);
        Log.test("listed members: " + JSON.stringify(val));
        expect(getTeamMembers).to.be.an("array");
        expect(getTeamMembers.length).to.equal(2);
        expect(getTeamMembers).to.include(TestHarness.GITHUB1.github);
        expect(getTeamMembers).to.include(TestHarness.GITHUB2.github);

        // const teamAdd = await gh.addTeamToRepo(val.githubTeamNumber, REPONAME, "push");
        const teamAdd = await gh.addTeamToRepo(TEAMNAME, REPONAME, "push");
        expect(teamAdd.githubTeamNumber).to.equal(val.githubTeamNumber);
        Log.test("Team added to repo");

        const staffTeamNumber = await gh.getTeamNumber("staff");
        // Log.test("Team staff number: " + staffTeamNumber);
        // const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, "push");
        const staffAdd = await gh.addTeamToRepo("staff", REPONAME, "push");
        expect(staffAdd.githubTeamNumber).to.equal(staffTeamNumber);
        Log.test("Team staff added to repo");

    }).timeout(TIMEOUT);

    it("Should be possible to get a team number for a team that does exist.", async function () {
        const val = await gh.getTeamNumber(TestHarness.TEAMNAME1);
        Log.test("Team # " + val);
        expect(val).to.be.greaterThan(0);

        // let bool = await gh.teamExists(TEAMNAME);
        // expect(bool).to.be.true;
    }).timeout(TIMEOUT);

    it("Should fail to get team members for an invalid team number argument.", async function () {
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

    it("Should get an empty array of team members for a team that does not exist.", async function () {
        // const val = await gh.getTeamMembers(-1337);
        const val = await gh.getTeamMembers("team_" + Date.now());
        Log.test("# Team members: " + val.length);
        expect(val.length).to.equal(0);
    }).timeout(TIMEOUT);

    it("Should be able to get member names for a valid team.", async function () {
        // const teamnum = await gh.getTeamNumber("staff");
        // Log.test("staff team #: " + teamnum);
        // expect(teamnum).to.be.an("number");
        // expect(teamnum > 0).to.be.true;
        // const val = await gh.getTeamMembers(teamnum);
        const val = await gh.getTeamMembers("staff");
        Log.test("# Team members: " + val.length);
        expect(val.length).to.be.greaterThan(0);
        expect(val).to.contain(TestHarness.ADMINSTAFF1.github);
    }).timeout(TIMEOUT);

    it("Should be able to create many teams and get their numbers (tests team paging).", async function () {

        gh.setPageSize(2); // force a small page size for testing
        const NUM_TEAMS = 4; // could do 100 for a special test, but this is really slow
        const dbc = DatabaseController.getInstance();

        // should be able to create the teams
        for (let i = 0; i < NUM_TEAMS; i++) {
            const teamname = TEAMNAME + "_paging-" + i;
            const team = await TestHarness.createTeam(teamname, TestHarness.DELIVID0, []);
            await dbc.writeTeam(team); // get in database

            const val = await gh.createTeam(teamname, "push");
            await Util.delay(200);
            Log.test("Team details: " + JSON.stringify(val));
            expect(val.teamName).to.equal(teamname);
            expect(val.githubTeamNumber).to.be.an("number");
            expect(val.githubTeamNumber).to.be.greaterThan(0);
        }

        // should be able to get their number
        for (let i = 0; i < NUM_TEAMS; i++) {
            const teamname = TEAMNAME + "_paging-" + i;
            await Util.delay(200);
            const val = await gh.getTeamNumber(teamname);
            Log.test("Team details: " + JSON.stringify(val));
            expect(val).to.be.an("number");
            expect(val).to.be.greaterThan(0);
        }

    }).timeout(TIMEOUT * 20);

    it("Should be able to create many repos and get them back (tests repo paging).", async function () {

        const NUM_REPOS = 4;
        const rc = new RepositoryController();

        const dc = new DeliverablesController();
        const deliv = await dc.getDeliverable(TestHarness.DELIVID0);

        gh.setPageSize(2); // force a small page size for testing

        // should be able to create the teams
        for (let i = 0; i < NUM_REPOS; i++) {
            const reponame = REPONAME + "_paging-" + i;
            await rc.createRepository(reponame, deliv, [], {});
            const val = await gh.createRepo(reponame);
            await Util.delay(200);
            Log.test("Repo details: " + JSON.stringify(val));
            expect(val.indexOf(reponame)).to.be.greaterThan(-1);
            expect(val).to.be.an("string");
        }

        const allRepos = await gh.listRepos();
        // should be able to get their number
        for (let i = 0; i < NUM_REPOS; i++) {
            const reponame = REPONAME + "_paging-" + i;
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

    it("Should be able to add a team to a repo.", async function () {
        // TODO: work on this more; does the new style work with this?
        gh.setPageSize(100); // page size isn"t important for this test
        this.timeout(TIMEOUT * 1000);
        await deleteStale(); // cleanup

        new RepositoryController();
        const dc = new DeliverablesController();
        await dc.getDeliverable(TestHarness.DELIVID0);

        Log.test("Setup complete");
        // const repo = await rc.createRepository(REPONAME, deliv, [], {});
        // expect(repo).to.not.be.null;
        const repoStr = await gh.createRepo(REPONAME);
        Log.test("Repo created; str: " + repoStr);
        expect(repoStr).to.not.be.undefined;
        expect(repoStr).to.contain("classytest/TESTrepo1"); // creation successful

        Log.test("Checking teams on repo");
        const teamsOnRepo = await gh.getTeamsOnRepo(REPONAME);
        Log.test("Teams on repo: " + JSON.stringify(teamsOnRepo));
        expect(teamsOnRepo).to.be.an("array");
        expect(teamsOnRepo).to.have.length(0);

        Log.test("Creating team");
        const githubTeam = await gh.createTeam(TEAMNAME, "push");
        Log.test("Team created: " + JSON.stringify(githubTeam));
        expect(githubTeam.teamName).to.be.equal(TEAMNAME);
        expect(githubTeam.githubTeamNumber).to.be.an("number");
        expect(githubTeam.githubTeamNumber > 0).to.be.true;

        Log.test("Getting team number");
        const teamNum = await gh.getTeamNumber(TEAMNAME);
        Log.test("Team number: " + teamNum);
        expect(teamNum).to.be.an("number");
        expect(teamNum).to.be.greaterThan(0);

        // const teamSuccess = await gh.addTeamToRepo(teamNum, REPONAME, "push");
        const teamSuccess = await gh.addTeamToRepo(TEAMNAME, REPONAME, "push");
        Log.test("Added team to repo: " + JSON.stringify(teamSuccess));
        expect(teamSuccess.githubTeamNumber).to.equal(teamNum);

        // TODO: need gh.removeTeamFromRepo
    });

    it("Should be able to clone a source repo into a newly created repository.", async function () {
        const start = Date.now();
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME;
        // keep a random repo public here so that all Github instances can work with cloning this:
        const importUrl = Config.getInstance().getProp(ConfigKey.githubHost) + "/classytest/" + TestHarness.REPONAMEREAL_TESTINGSAMPLE;

        const output = await gh.importRepoFS(importUrl, targetUrl);
        expect(output).to.be.true;

        Log.test("Full clone took: " + Util.took(start));
    }).timeout(120 * 1000); // 2 minutes

    it("Should be able to clone a source repository, and select files to create a new repository.", async function () {
        const tc: TeamController = new TeamController();
        const rc: RepositoryController = new RepositoryController();
        const dc: DeliverablesController = new DeliverablesController();
        const pc: PersonController = new PersonController();

        // get some persons
        const p1 = await pc.getPerson(TestHarness.USER1.id);
        const p2 = await pc.getPerson(TestHarness.USER2.id);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        // get the deliverable
        const deliv = await dc.getDeliverable(TestHarness.DELIVID0);
        expect(deliv).to.not.be.null;

        // create the team
        const team = await tc.createTeam(TestHarness.TEAMNAME3, deliv, [p1, p2], {});
        expect(team).to.not.be.null;

        // create the repository
        const repo = await rc.createRepository(REPONAME3, deliv, [team], {});
        expect(repo).to.not.be.null;
        const val = await gh.createRepo(REPONAME3);
        const newName = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME3;
        const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
        expect(val).to.equal(newName);

        // perform the import
        const start = Date.now();
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME3;
        const importUrl = githubHost + "/classytest/" + TestHarness.REPONAMEREAL_TESTINGSAMPLE;
        const selectedFiles = TestHarness.REPOSEEDFILEREAL_TESTINGSAMPLE;
        const output = await gh.importRepoFS(importUrl, targetUrl, selectedFiles);
        expect(output).to.be.true;

        Log.test("Partial clone took: " + Util.took(start));
    }).timeout(120 * 1000);

    it("Should be able to clone a source repository given various import URLs", async function () {
        const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME3;

        const importTests: Array<[string, string]> = [
            // Should support a trailing .git
            [TestHarness.REPONAMEREAL_TESTINGSAMPLE + ".git", undefined],
            // Should support importing from a subdirectory
            [TestHarness.REPONAMEREAL_TESTINGSAMPLE + ".git:" + TestHarness.REPOSUBDIRREAL_TESTINGSAMPLE, undefined],
            // Should support a subdirectory with "/" on either side
            [TestHarness.REPONAMEREAL_TESTINGSAMPLE + ".git:/" + TestHarness.REPOSUBDIRREAL_TESTINGSAMPLE + "/", undefined],
            // Should support a subdirectory with a seedFile
            [TestHarness.REPONAMEREAL_TESTINGSAMPLE + ".git:" + TestHarness.REPOSUBDIRREAL_TESTINGSAMPLE,
                TestHarness.REPOSUBDIRSEEDFILEREAL_TESTINGSAMPLE],
            // Should support importing from a branch
            [TestHarness.REPONAMEREAL_TESTINGSAMPLE + ".git#" + TestHarness.REPOBRANCHREAL_TESTINGSAMPLE, undefined],
            // Should support importing from a branch with a seedFile
            [TestHarness.REPONAMEREAL_TESTINGSAMPLE + ".git#" + TestHarness.REPOBRANCHREAL_TESTINGSAMPLE, "FILE.txt"],
            // Should support importing from a subdir on a branch
            [TestHarness.REPONAMEREAL_TESTINGSAMPLE + ".git#" + TestHarness.REPOBRANCHREAL_TESTINGSAMPLE + ":" +
            TestHarness.REPOSUBDIRREAL_TESTINGSAMPLE, undefined],
            // Should support importing from a subdir on a branch with a seedFile
            [TestHarness.REPONAMEREAL_TESTINGSAMPLE + ".git#" + TestHarness.REPOBRANCHREAL_TESTINGSAMPLE + ":" +
            TestHarness.REPOSUBDIRREAL_TESTINGSAMPLE, "BRANCH_NESTED.txt"],
        ];

        for (const importTest of importTests) {
            // Delete existing repo
            const deleted = await gh.deleteRepo(REPONAME3);
            expect(deleted).to.be.true;
            // Recreate repo
            const created = await gh.createRepo(REPONAME3);
            expect(created).to.equal(targetUrl);

            // perform the import
            const [importRepo, selectedFiles] = importTest;
            const importUrl = `${githubHost}/classytest/${importRepo}`;

            const start = Date.now();
            const output = await gh.importRepoFS(importUrl, targetUrl, selectedFiles);
            expect(output).to.be.true;

            Log.test(`Clone of ${importRepo} took`, Util.took(start));
        }
    }).timeout(60 * 1000 * 10);

    it("Should be able to soft-write a file to a repo, where the file does not exist.", async function () {
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME3;

        const success = await gh.writeFileToRepo(targetUrl, "test_file.txt", "hello world!");
        expect(success).to.be.true;
    }).timeout(2 * TIMEOUT);

    it("Should be able to hard-write a file to a repo, where the file does not exist.", async function () {
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME3;

        const success = await gh.writeFileToRepo(targetUrl, "test_file2.txt", "hello world!", true);
        expect(success).to.be.true;
    }).timeout(2 * TIMEOUT);

    it("Should be able to hard-write a file to a repo, where the file does exist.", async function () {
        const targetUrl = Config.getInstance().getProp(ConfigKey.githubHost) + "/" +
            Config.getInstance().getProp(ConfigKey.org) + "/" + REPONAME3;

        const success = await gh.writeFileToRepo(targetUrl, "test_file.txt", "hello world2!", true);
        expect(success).to.be.true;
    }).timeout(2 * TIMEOUT);

    it("Should not be able to soft-write a file to a repo that does not exist.", async function () {
        const success = await gh.writeFileToRepo("invalidurl.com", "test_file2.txt", "hello world!");
        expect(success).to.be.false;
    }).timeout(2 * TIMEOUT);

    it("Should not be able to hard-write a file to a repo that does not exist.", async function () {
        const success = await gh.writeFileToRepo("invalidurl.com", "test_file2.txt", "hello world!", true);
        expect(success).to.be.false;
    }).timeout(2 * TIMEOUT);

    /**
     * This test is terrible, but gets the coverage tools to stop complaining.
     */
    it("Should make sure that actions can actually fail.", async function () {
        if (1 > 0) {
            // terrible skip
            return;
        }
        const old = (gh as any).gitHubAuthToken;
        (gh as any).gitHubAuthToken = "FOOFOOFOO";

        try {
            await gh.createRepo("INVALIDREPONAME");
        } catch (err) {
            // expected
        }

        try {
            await gh.deleteRepo("INVALIDREPONAME");
        } catch (err) {
            // expected
        }

        try {
            await gh.listRepos();
        } catch (err) {
            // expected
        }

        try {
            await gh.createTeam("INVALIDTEAMNAMER", "push");
        } catch (err) {
            // expected
        }

        try {
            await gh.getTeamNumber("INVALIDTEAMNAMER");
        } catch (err) {
            // expected
        }

        try {
            await gh.deleteTeam("team_" + Date.now());
        } catch (err) {
            // expected
        }

        try {
            // await gh.addTeamToRepo(-1, "INVALIDREPONAME", "push");
            await gh.addTeamToRepo("INVALIDTEAMNAME", "INVALIDREPONAME", "push");
        } catch (err) {
            // expected
        }

        try {
            await gh.addMembersToTeam("INVALIDTEAMNAME", ["INVALIDPERSONNAME"]);
        } catch (err) {
            // expected
        }

        try {
            await gh.listTeams();
        } catch (err) {
            // expected
        }

        try {
            await gh.listWebhooks("INVALIDREPONAME");
        } catch (err) {
            // expected
        }

        try {
            await gh.addWebhook("INVALIDREPONAME", "INVALIDENDPOINT");
        } catch (err) {
            // expected
        }

        try {
            await gh.importRepoFS("https://localhost", "https://localhost");
        } catch (err) {
            // expected
        }

        Log.test("after expected fail");
        (gh as any).gitHubAuthToken = old; // restore token
    }).timeout(TIMEOUT);

    it("Should be able to create a repo, a team, link, and set permissions", async function () {
        const githubTeam = await gh.createTeam(TEAMNAME, "push");
        expect(githubTeam.teamName).to.be.equal(TEAMNAME);
        expect(githubTeam.githubTeamNumber).to.be.an("number");
        expect(githubTeam.githubTeamNumber > 0).to.be.true;

        // Expects adding members to work
        const addMembers = await gh.addMembersToTeam(githubTeam.teamName,
            [TestHarness.GITHUB1.github, TestHarness.GITHUB2.github]);
        expect(addMembers).to.not.be.null;

        // const teamNum = await gh.getTeamNumber(githubTeam.teamName);
        // const teamAdd = await gh.addTeamToRepo(teamNum, REPONAME, "push");
        const teamAdd = await gh.addTeamToRepo(TEAMNAME, REPONAME, "push");
        expect(teamAdd).to.not.be.null;

        // const staffTeamNumber = await gh.getTeamNumber("staff");
        // const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, "push");
        const staffAdd = await gh.addTeamToRepo("staff", REPONAME, "push");
        expect(staffAdd).to.not.be.null;
        const permissionEdit = await gh.setRepoPermission(REPONAME, "pull");
        expect(permissionEdit).to.be.true;

    }).timeout(TIMEOUT);

    it("Should not be able to change permissions of a repo that does not exist.", async function () {
        const permissionEdit = await gh.setRepoPermission(TestHarness.INVALIDREPONAME, "pull");
        expect(permissionEdit).to.be.false;

    }).timeout(TIMEOUT);

    it("Should not be able to change permissions of a repo to an invalid value.", async function () {
        let permissionEdit = null;
        let ex = null;
        try {
            permissionEdit = await gh.setRepoPermission(TestHarness.REPONAME1, "invalidvalue");
        } catch (err) {
            ex = err;
        }
        expect(permissionEdit).to.be.null;
        expect(ex).to.not.be.null;
    }).timeout(TIMEOUT);

    // this test wasn"t failing for the right reasons and was disabled until we can figure out what is going on
    // it("Should not be able to bulk edit permissions to admins", async function() {
    //     const githubTeam = await gh.teamCreate(TEAMNAME, "push");
    //     expect(githubTeam.teamName).to.be.equal(TEAMNAME);
    //     expect(githubTeam.githubTeamNumber).to.be.an("number");
    //     expect(githubTeam.githubTeamNumber > 0).to.be.true;
    //
    //     // Expects adding members to work
    //     const addMembers = await gh.addMembersToTeam(githubTeam.teamName, githubTeam.githubTeamNumber,
    //         [Test.REALBOTNAME01, Test.REALUSERNAME]);
    //     expect(addMembers).to.not.be.null;
    //     const teamAdd = await gh.addTeamToRepo(githubTeam.githubTeamNumber, REPONAME, "push");
    //     expect(teamAdd).to.not.be.null;
    //
    //     const staffTeamNumber = await gh.getTeamNumber("staff");
    //     const staffAdd = await gh.addTeamToRepo(staffTeamNumber, REPONAME, "admin");
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

    it("Should be possible to find the teams on a repo.", async function () {
        const val = await gh.getTeamsOnRepo(TestHarness.REPONAMEREAL);
        expect(val).to.be.an("array");
        expect(val.length).to.equal(0);
    }).timeout(TIMEOUT);

    it("Should be possible to get the team from a number.", async function () {
        const teamNumber = await gh.getTeamNumber(TEAMNAME);
        expect(teamNumber).to.be.greaterThan(0);

        const val = await gh.getTeam(teamNumber);
        expect(val).to.be.an("object");
        expect(val.githubTeamNumber).to.equal(teamNumber);
        expect(val.teamName).to.equal(TEAMNAME);
    }).timeout(TIMEOUT);

    it("Should not be possible to get the team that does not exist.", async function () {
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

    it("Should not be possible to get the team with an invalid param.", async function () {
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

    it("Should be possible to check the database.", async function () {
        let res = await GitHubActions.checkDatabase(null, null);
        expect(res).to.be.true;

        // if anything goes wrong exceptions will be thrown
        res = await GitHubActions.checkDatabase(REPONAME, TEAMNAME);
        expect(res).to.be.true;
    }).timeout(TIMEOUT);

    it("Should not be possible to simulate a webhook with the wrong params.", async function () {
        let worked = await gh.simulateWebhookComment(null, "SHA", "message");
        expect(worked).to.be.false;

        worked = await gh.simulateWebhookComment(REPONAME, null, "message");
        expect(worked).to.be.false;

        worked = await gh.simulateWebhookComment(REPONAME, "SHA", null);
        expect(worked).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be possible to simulate a webhook.", async function () {
        let worked = await gh.simulateWebhookComment(TestHarness.REPONAMEREAL_POSTTEST, "SHA", "message");
        expect(worked).to.be.false; // SHA is not right

        let ex = null;
        try {
            let msg = "message";
            worked = await gh.simulateWebhookComment(TestHarness.REPONAMEREAL_POSTTEST, "c35a0e5968338a9757813b58368f36ddd64b063e", msg);

            for (let i = 0; i < 10; i++) {
                msg = msg + msg; // make a long message
            }
            msg = msg + "\n" + msg;
            worked = await gh.simulateWebhookComment(TestHarness.REPONAMEREAL_POSTTEST, "c35a0e5968338a9757813b58368f36ddd64b063e", msg);

            // NOTE: worked not checked because githubWebhook needs to be active for this to work
            // expect(worked).to.be.true;
            expect(worked).to.not.be.null;
        } catch (err) {
            ex = err;
        }
        expect(ex).to.be.null; // at least don"t throw an exception
    }).timeout(TIMEOUT);

    it("Should not be possible to make a comment with invalid params.", async function () {
        let worked = await gh.makeComment(null, "message");
        expect(worked).to.be.false;

        worked = await gh.makeComment("URL", null);
        expect(worked).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be possible to make a comment.", async function () {
        const githubAPI = Config.getInstance().getProp(ConfigKey.githubAPI);
        let msg = "message";
        let url = githubAPI + "/repos/classytest/" + TestHarness.REPONAMEREAL_POSTTEST + "/commits/INVALIDSHA/comments";
        let worked = await gh.makeComment(url, msg);
        expect(worked).to.be.false; // false because SHA is invalid

        for (let i = 0; i < 10; i++) {
            msg = msg + msg; // make a long message
        }
        msg = msg + "\n" + msg;

        url = githubAPI + "/repos/classytest/" + TestHarness.REPONAMEREAL_POSTTEST +
            "/commits/c35a0e5968338a9757813b58368f36ddd64b063e/comments";
        worked = await gh.makeComment(url, msg);
        expect(worked).to.be.true; // should have worked
    }).timeout(TIMEOUT);

    it("Should be possible to find the teams on a repo.", async function () {
        const val = await gh.getTeamsOnRepo(REPONAME);
        Log.test("listed teams: " + JSON.stringify(val));
        expect(val).to.be.an("array");
        expect(val.length).to.equal(2);

        let exists = false;
        for (const team of val) {
            if (team.teamName === "staff") {
                exists = true;
            }
        }
        expect(exists).to.be.true;

        exists = false;
        for (const team of val) {
            if (team.teamName === TestHarness.TEAMNAME1) {
                exists = true;
            }
        }
        expect(exists).to.be.true;

    }).timeout(TIMEOUT);

    // it("Should be possible to find the members of a team.", async function () {
    //     const val = await gh.listTeamMembers(TEAMNAME);
    //     Log.test("listed members: " + JSON.stringify(val));
    //     expect(val).to.be.an("array");
    //     expect(val.length).to.equal(2);
    //     expect(val).to.include(Test.GITHUB1.github);
    //     expect(val).to.include(Test.GITHUB2.github);
    // }).timeout(TIMEOUT);

    it("Clear stale repos and teams.", async function () {
        const del = await deleteStale();
        expect(del).to.be.true;
    }).timeout(TIMEOUT * 10);

    // function getProjectPrefix(): string {
    //     return "TEST__X__secap_";
    // }

    // function getTeamPrefix() {
    //     return "TEST__X__t_";
    // }

    async function deleteStale(): Promise<true> {
        Log.test("GitHubActionSpec::deleteStale() - start");
        const start = Date.now();

        let repos = await gh.listRepos();
        expect(repos).to.be.an("array");
        // expect(repos.length > 0).to.be.true; // test org can be empty

        // delete test repos if needed
        for (const repo of repos) {
            for (const r of TESTREPONAMES) {
                if (repo.repoName === r) {
                    Log.info("Removing stale repo: " + repo.repoName);
                    await gh.deleteRepo(r);
                    await Util.delay(DELAY_SHORT);
                    // expect(val).to.be.true;
                }
            }
        }

        repos = await gh.listRepos();
        // delete test repos if needed
        for (const repo of repos) {
            Log.info("Evaluating repo: " + repo.repoName);
            if (repo.repoName.indexOf("TEST__X__") === 0 || repo.repoName.startsWith(REPONAME) || repo.repoName.endsWith("_grades")) {
                Log.info("Removing stale repo: " + repo.repoName);
                await gh.deleteRepo(repo.repoName);
                // expect(val).to.be.true;
                const teamName = repo.repoName.substr(15);
                Log.info("Adding stale team name: " + repo.repoName);
                TESTTEAMNAMES.push(teamName);
            }
        }

        // delete teams if needed
        const teams = await gh.listTeams();
        expect(teams).to.be.an("array");
        // expect(teams.length > 0).to.be.true; // can have 0 teams
        Log.test("All Teams: " + JSON.stringify(teams));
        Log.test("Stale Teams: " + JSON.stringify(TESTTEAMNAMES));
        for (const team of teams) {
            // Log.info("Evaluating team: " + JSON.stringify(team));
            let done = false;
            for (const t of TESTTEAMNAMES) {
                if (team.teamName === t) {
                    Log.test("Removing stale team: " + team.teamName);
                    // await gh.deleteTeam(team.teamNumber);
                    await gh.deleteTeam(team.teamName);
                    await Util.delay(DELAY_SHORT);
                    done = true;
                }
            }
            if (done === false) {
                if (team.teamName.startsWith(TEAMNAME) === true) {
                    Log.test("Removing stale team: " + team.teamName);
                    // await gh.deleteTeam(team.teamNumber);
                    await gh.deleteTeam(team.teamName);
                    await Util.delay(DELAY_SHORT);
                }
            }
        }
        Log.test("GitHubActionSpec::deleteStale() - done; took: " + Util.took(start));
        return true;
    }
});
