import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {TestHarness} from "@common/test/TestHarness";

import {DatabaseController} from "@backend/controllers/DatabaseController";
import {DeliverablesController} from "@backend/controllers/DeliverablesController";
import {GitHubActions, IGitHubActions} from "@backend/controllers/GitHubActions";
import {GitHubController} from "@backend/controllers/GitHubController";
import {PersonController} from "@backend/controllers/PersonController";
import {RepositoryController} from "@backend/controllers/RepositoryController";
import {TeamController} from "@backend/controllers/TeamController";
import {PersonKind, Repository, Team} from "@backend/Types";

import "@common/test/GlobalSpec"; // load first
import "./TeamControllerSpec";

describe("GitHubController", () => {
    // TODO: investigate skipping this way: https://stackoverflow.com/a/41908943 (and turning them on/off with an env flag)

    let gc: GitHubController;

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    let gha: IGitHubActions;

    before(async function () {
        this.timeout(TestHarness.TIMEOUTLONG);

        Log.test("GitHubControllerSpec::before() - start; forcing testorg");
        // force testorg so real org does not get deleted or modified
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        await TestHarness.suiteBefore("GitHubController");

        gha = GitHubActions.getInstance(true);
        await gha.deleteTeam(TestHarness.TEAMNAME1);
        await gha.deleteTeam(TestHarness.TEAMNAME2);
        await gha.deleteRepo(TestHarness.REPONAME1);
        await gha.deleteRepo(TestHarness.REPONAME2);

        // get data ready
        await TestHarness.prepareDeliverables();

        // redo with real github people
        const dbc = DatabaseController.getInstance();
        const pc = new PersonController();
        let p = TestHarness.createPerson(
            TestHarness.GITHUB1.id,
            TestHarness.GITHUB1.csId,
            TestHarness.GITHUB1.github,
            PersonKind.STUDENT);
        await pc.writePerson(p);
        p = TestHarness.createPerson(
            TestHarness.GITHUB2.id,
            TestHarness.GITHUB2.csId,
            TestHarness.GITHUB2.github,
            PersonKind.STUDENT);
        await pc.writePerson(p);

        // const tc = new TeamController();
        const t1 = await TestHarness.createTeam(
            TestHarness.TEAMNAME1,
            TestHarness.DELIVID0,
            [TestHarness.GITHUB1.id, TestHarness.GITHUB2.id]);
        await dbc.writeTeam(t1);
        const t2 = await TestHarness.createTeam(
            TestHarness.TEAMNAME2,
            TestHarness.DELIVID1,
            [TestHarness.GITHUB1.id, TestHarness.GITHUB2.id]);
        await dbc.writeTeam(t2);
        // const t3 = await Test.teamCreate(Test.TEAMNAME3, Test.DELIVID2, [Test.BOTNAME01, Test.USERNAMEGITHUB2]);
        // await dbc.writeTeam(t3);

        const dc = new DeliverablesController();
        const deliv = await dc.getDeliverable(TestHarness.DELIVIDPROJ);

        const rc = new RepositoryController();
        await rc.createRepository(TestHarness.REPONAME1, deliv, [t1], {});
        await rc.createRepository(TestHarness.REPONAME2, deliv, [t2], {});
        // await rc.createRepository(Test.REPONAME3, [t3], {});
    });

    after(() => {
        Log.test("GitHubControllerSpec::after() - start; replacing original org");
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
        TestHarness.suiteAfter("GitHubController");
    });

    beforeEach(function () {
        const exec = TestHarness.runSlowTest();
        if (exec === true) {
            Log.test("GitHubController::BeforeEach() - running in CI; not skipping");
            gc = new GitHubController(GitHubActions.getInstance(true));
        } else {
            Log.test("GitHubController::BeforeEach() - skipping (not CI)");
            this.skip();
        }
    });

    it("Should be able to clear out prior result", async function () {
        // not really a test, we just want something to run first we can set timeout on (cannot add timeout to before)
        Log.test("Clearing prior result");
        try {
            await gha.deleteRepo(TestHarness.REPONAME1);
            await gha.deleteRepo(TestHarness.REPONAME2);
            await gha.deleteRepo(TestHarness.REPONAME3);
            await gha.deleteTeam(TestHarness.TEAMNAME1);
            await gha.deleteTeam(TestHarness.TEAMNAME2);
            await gha.deleteTeam(TestHarness.TEAMNAME3);
        } catch (err) {
            Log.test("Could not clear result: " + err);
        }
        Log.test("Prior result cleared");
    }).timeout(TestHarness.TIMEOUTLONG);

    it("Should be able to get a team url for a valid team.", async () => {
        const teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        const teamUrl = await gc.getTeamUrl(teams[0]);
        const config = Config.getInstance();
        const url = config.getProp(ConfigKey.githubHost) + "/orgs/" + config.getProp(ConfigKey.org) + "/teams/" + TestHarness.TEAMNAME1;
        expect(teamUrl).to.equal(url);
    });

    it("Should be able to get a repo url for a valid repo.", async () => {
        const repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        const repoUrl = await gc.getRepositoryUrl(repos[0]);
        const config = Config.getInstance();
        const url = config.getProp(ConfigKey.githubHost) + "/" + config.getProp(ConfigKey.org) + "/" + TestHarness.REPONAME1;
        expect(repoUrl).to.equal(url);
    });

    it("Should be able to provision a repo.", async function () {
        const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
        const repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        const teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        const importUrl = githubHost + "/classytest/" + TestHarness.REPONAMEREAL_TESTINGSAMPLE;
        const provisioned = await gc.provisionRepository(repos[0].id, teams, importUrl);
        expect(provisioned).to.be.true;
    }).timeout(TestHarness.TIMEOUTLONG);

    it("Should fail to provision a repo that already exists.", async function () {
        const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
        const repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        const teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        const importUrl = githubHost + "/classytest/" + TestHarness.REPONAMEREAL_TESTINGSAMPLE;
        let res = null;
        let ex = null;
        try {
            res = await gc.provisionRepository(repos[0].id, teams, importUrl);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;

        res = null;
        ex = null;
        try {
            // no repository object for this repoName
            res = await gc.provisionRepository("invalidRepo" + Date.now(), teams, importUrl);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;

    }).timeout(TestHarness.TIMEOUTLONG);

    it("Should be able to create a repo.", async function () {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository(TestHarness.REPONAME2);
        const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
        expect(repo).to.not.be.null;

        const importURL = githubHost + "/classytest/" + TestHarness.REPONAMEREAL_TESTINGSAMPLE;
        const success = await gc.createRepository(repo.id, importURL);
        expect(success).to.be.true;
    }).timeout(TestHarness.TIMEOUTLONG);

    // doesn"t actually check the right thing (aka it fails because the repo db object does not exist, not because creation failed)
    // it("Should not be able to create a repo with an invalid name.", async function() {
    //     const name = ""; // // repo names must have length 1 on github
    //     const importURL = "https://github.com/SECapstone/capstone";
    //
    //     repo = null;
    //     let ex = null;
    //     try {
    //         repo = await gc.createRepository(name, importURL);
    //     } catch (err) {
    //         ex = err;
    //     }
    //     expect(repo).to.be.null;
    //     expect(ex).to.not.be.null;
    // }).timeout(Test.TIMEOUTLONG);

    it("Should not be able to create a repo when preconditions are not met.", async function () {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository(TestHarness.REPONAME2);
        const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
        expect(repo).to.not.be.null;

        const importURL = githubHost + "/classytest/" + TestHarness.REPONAMEREAL_TESTINGSAMPLE;
        let res = null;
        let ex = null;
        try {
            // repo already exists
            Log.test("checking repo that already exists");
            res = await gc.createRepository(repo.id, importURL);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;

        res = null;
        ex = null;
        try {
            // should fail because Repository object does not exist for this repoName
            Log.test("checking repo that is not in datastore");
            res = await gc.createRepository("unknownId" + Date.now(), importURL);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;

    }).timeout(TestHarness.TIMEOUTLONG);

    it("Should be able to create a repo with a custom path.", async function () {
        // NOTE: this test is unreliable and needs to be fundamentally fixed
        this.skip();

        Log.test("Custom setup start");
        // setup
        await gha.deleteTeam(TestHarness.TEAMNAME1); // delete team
        await TestHarness.prepareTeams();
        await TestHarness.prepareRepositories();
        // await Test.deleteStaleRepositories();
        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository(TestHarness.REPONAME2); // get repo object
        const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);

        await gha.deleteRepo(repo.id); // delete repo from github
        await gha.deleteRepo(TestHarness.REPONAME2); // delete repo from github
        Log.test("Custom setup done");

        const importURL = githubHost + "/classytest/" + TestHarness.REPONAMEREAL_TESTINGSAMPLE;
        const success = await gc.createRepository(repo.id, importURL, "README.md");
        Log.test("Custom test done: " + success);
        expect(success).to.be.true;
    }).timeout(TestHarness.TIMEOUTLONG);

    it("Should be able to release a repo.", async function () {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const allRepos: Repository[] = await rc.getAllRepos();
        const repoCount: number = allRepos.length;

        const repo = await rc.getRepository(TestHarness.REPONAME1);

        expect(repoCount).to.be.greaterThan(1);

        const tc: TeamController = new TeamController();
        const allTeams: Team[] = await tc.getAllTeams();
        const team = await tc.getTeam(TestHarness.TEAMNAME1);
        const teamCount: number = allTeams.length;
        Log.info("GithubControllerSpec::ReleasingRepo - repoCount: " + repoCount + " teamcCount: " + teamCount);
        expect(teamCount).to.be.greaterThan(1);

        const success = await gc.releaseRepository(repo, [team], false);
        expect(success).to.be.true;
    }).timeout(TestHarness.TIMEOUT);

    it("Should fail to release a repo if preconditions are not met.", async function () {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const allRepos: Repository[] = await rc.getAllRepos();
        const repoCount: number = allRepos.length;

        expect(repoCount).to.be.greaterThan(1);

        const tc: TeamController = new TeamController();
        const allTeams: Team[] = await tc.getAllTeams();
        const teamCount: number = allTeams.length;
        Log.info("GithubControllerSpec::ReleasingRepo - repoCount: " + repoCount + " teamcCount: " + teamCount);
        expect(teamCount).to.be.greaterThan(1);
        let res = null;
        let ex = null;
        try {
            // try to release a repo with collaborators
            res = await gc.releaseRepository(allRepos[1], [allTeams[1]], true);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;

        res = null;
        ex = null;
        try {
            const team: any = {id: TestHarness.TEAMNAME3, personIds: [TestHarness.GITHUB1.id, TestHarness.GITHUB2.id]};
            // try to release a repo with a team that doesn"t exist
            res = await gc.releaseRepository(allRepos[1], [team], false);
            expect(res).to.be.false;
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
    }).timeout(TestHarness.TIMEOUT);

    it("Should be update branch protection.", async function () {
        await TestHarness.prepareRepositories();

        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository(TestHarness.REPONAME1);
        expect(repo).to.not.be.null;

        if (await gha.repoExists(TestHarness.REPONAME1) === false) {
            // create repo
            const url = await gha.createRepo(TestHarness.REPONAME1);
            expect(url).to.have.length.greaterThan(0);
        }
        const success = await gc.updateBranchProtection(repo, [{name: TestHarness.USER1.github, reviews: 1}]);
        expect(success).to.be.true;
    }).timeout(TestHarness.TIMEOUT);

    it("Should not update branch protection for a repo that does not exist.", async function () {
        await TestHarness.prepareRepositories();

        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository("repo_" + Date.now());
        expect(repo).to.be.null;

        let res = null;
        let ex = null;
        try {
            // should throw
            res = await gc.updateBranchProtection(repo, [{name: TestHarness.USER1.github, reviews: 1}]);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
        expect(ex.message).to.equal("GitHubController::updateBranchProtection(..) - null repo");
    }).timeout(TestHarness.TIMEOUT);

    it("Should be create an issue.", async function () {
        await TestHarness.prepareRepositories();

        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository(TestHarness.REPONAME1);
        expect(repo).to.not.be.null;

        if (await gha.repoExists(TestHarness.REPONAME1) === false) {
            // create repo
            const url = await gha.createRepo(TestHarness.REPONAME1);
            expect(url).to.have.length.greaterThan(0);
        }
        const success = await gc.createIssues(repo, [{title: "Issue Title", body: "Issue Body"}]);
        expect(success).to.be.true;
    }).timeout(TestHarness.TIMEOUT);

    it("Should not create an issue for a repo that does not exist.", async function () {
        await TestHarness.prepareRepositories();

        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository("repo_" + Date.now());
        expect(repo).to.be.null;

        let res = null;
        let ex = null;
        try {
            // should throw
            res = await gc.createIssues(repo, [{title: "Issue Title", body: "Should not exist"}]);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
        expect(ex.message).to.equal("GitHubController::createIssues(..) - null repo");
    }).timeout(TestHarness.TIMEOUT);

    // TODO: actually write tests for the PR feature
    // xit("Should fail to create a pull request.", async function() {
    //     let res = null;
    //     let ex = null;
    //     try {
    //         // patchtool has not been integrated with tests yet,
    //         // so should fail to contact patchtool and return false
    //         const repos = await new RepositoryController().getAllRepos();
    //         res = await gc.createPullRequest(repos[0], "patch");
    //     } catch (err) {
    //         ex = err;
    //     }
    //     expect(res).to.be.false;
    //     expect(ex).to.be.null;
    // }).timeout(Test.TIMEOUT);

});
