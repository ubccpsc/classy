import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {GitHubActions} from "../../src/controllers/GitHubActions";
import {GitHubController} from "../../src/controllers/GitHubController";
import {PersonController} from "../../src/controllers/PersonController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {Repository, Team} from "../../src/Types";

import {Test} from "../GlobalSpec";
import '../GlobalSpec';
import './TeamControllerSpec';
// const loadFirst = require('../GlobalSpec');
// const rFirst = require('./TeamControllerSpec');

describe("GitHubController", () => {
    // TODO: investigate skipping this way: https://stackoverflow.com/a/41908943 (and turning them on/off with an env flag)

    let gc: GitHubController;

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    before(async () => {
        Log.test("GitHubControllerSpec::before() - start; forcing testorg");
        // force testorg so real org does not get deleted or modified
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        await Test.suiteBefore('GitHubController');

        // clear stale data (removed; happens in suitebefore)
        const dbc = DatabaseController.getInstance();
        // await dbc.clearData();

        // get data ready
        await Test.prepareDeliverables();

        // redo with real github people
        const pc = new PersonController();
        let p = Test.createPerson(Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB1, 'student');
        await pc.writePerson(p);
        p = Test.createPerson(Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB2, 'student');
        await pc.writePerson(p);

        // const tc = new TeamController();
        const t1 = await Test.createTeam(Test.TEAMNAME1, Test.DELIVID0, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        await dbc.writeTeam(t1);
        const t2 = await Test.createTeam(Test.TEAMNAME2, Test.DELIVID1, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        await dbc.writeTeam(t2);
        // const t3 = await Test.createTeam(Test.TEAMNAME3, Test.DELIVID2, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        // await dbc.writeTeam(t3);

        const dc = new DeliverablesController();
        const deliv = await dc.getDeliverable(Test.DELIVIDPROJ);

        const rc = new RepositoryController();
        await rc.createRepository(Test.REPONAME1, deliv, [t1], {});
        await rc.createRepository(Test.REPONAME2, deliv, [t2], {});
        // await rc.createRepository(Test.REPONAME3, [t3], {});
    });

    after(() => {
        Log.test("GitHubControllerSpec::after() - start; replacing original org");
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
        Test.suiteAfter('GitHubController');
    });

    beforeEach(function() {
        Log.test('GitHubController::BeforeEach - "' + (this as any).currentTest.title + '"');

        const exec = Test.runSlowTest();
        if (exec === true) {
            Log.test("GitHubController::beforeEach() - running in CI; not skipping");
            gc = new GitHubController();
        } else {
            Log.test("GitHubController::beforeEach() - skipping (not CI)");
            this.skip();
        }
    });

    it("Should be able to clear out prior state", async function() {
        // not really a test, we just want something to run first we can set timeout on
        Log.test("Clearing prior state");
        try {
            const gha = new GitHubActions();
            await gha.deleteRepo(Test.REPONAME1);
            await gha.deleteRepo(Test.REPONAME2);
            await gha.deleteRepo(Test.REPONAME3);
            let teamNum = await gha.getTeamNumber(Test.TEAMNAME1);
            if (teamNum > 0) {
                await gha.deleteTeam(teamNum);
            }
            teamNum = await gha.getTeamNumber(Test.TEAMNAME2);
            if (teamNum > 0) {
                await gha.deleteTeam(teamNum);
            }
            teamNum = await gha.getTeamNumber(Test.TEAMNAME3);
            if (teamNum > 0) {
                await gha.deleteTeam(teamNum);
            }
        } catch (err) {
            Log.test("Could not clear state: " + err);
        }
        Log.test("Prior state cleared");
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to get a team url for a valid team.", async () => {
        const teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        const teamUrl = await gc.getTeamUrl(teams[0]);
        const config = Config.getInstance();
        const url = config.getProp(ConfigKey.githubHost) + '/orgs/' + config.getProp(ConfigKey.org) + '/teams/' + Test.TEAMNAME1;
        expect(teamUrl).to.equal(url);
    });

    it("Should be able to get a repo url for a valid repo.", async () => {
        const repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        const repoUrl = await gc.getRepositoryUrl(repos[0]);
        const config = Config.getInstance();
        const url = config.getProp(ConfigKey.githubHost) + '/' + config.getProp(ConfigKey.org) + '/' + Test.REPONAME1;
        expect(repoUrl).to.equal(url);
    });

    it("Should be able to provision a repo.", async function() {
        const repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        const teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        // const webhook = 'https://devnull.cs.ubc.ca/classyWebhook';
        const importUrl = 'https://github.com/SECapstone/bootstrap';
        const provisioned = await gc.provisionRepository(repos[0].id, teams, importUrl, true);
        expect(provisioned).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should fail to provision a repo that already exists.", async function() {
        const repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        const teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        // const webhook = 'https://devnull.cs.ubc.ca/classyWebhook';
        const importUrl = 'https://github.com/SECapstone/bootstrap';
        let res = null;
        let ex = null;
        try {
            res = await gc.provisionRepository(repos[0].id, teams, importUrl, true);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;

        res = null;
        ex = null;
        try {
            // no repository object for this repoName
            res = await gc.provisionRepository('invalidRepo' + Date.now(), teams, importUrl, true);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;

    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to create a repo.", async function() {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository(Test.REPONAME2);
        expect(repo).to.not.be.null;

        const importURL = 'https://github.com/SECapstone/capstone';
        const success = await gc.createRepository(repo.id, importURL);
        expect(success).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should not be able to create a repo when preconditions are not met.", async function() {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository(Test.REPONAME2);
        expect(repo).to.not.be.null;

        const importURL = 'https://github.com/SECapstone/capstone';
        let res = null;
        let ex = null;
        try {
            // repo already exists
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
            res = await gc.createRepository('unknownId' + Date.now(), importURL);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;

    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to create a repo with a custom path.", async function() {
        // setup
        await Test.prepareTeams();
        await Test.prepareRepositories();
        // await Test.deleteStaleRepositories();
        const rc: RepositoryController = new RepositoryController();
        const repo = await rc.getRepository(Test.REPONAME2); // get repo object

        const gha = new GitHubActions();
        await gha.deleteRepo(repo.id); // delete repo from github
        await gha.deleteRepo(Test.REPONAME2); // delete repo from github

        const importURL = 'https://github.com/SECapstone/capstone';
        const success = await gc.createRepository(repo.id, importURL, "AutoTest.md");
        expect(success).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to release a repo.", async function() {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const allRepos: Repository[] = await rc.getAllRepos();
        const repoCount: number = allRepos.length;

        const repo = await rc.getRepository(Test.REPONAME1);

        expect(repoCount).to.be.greaterThan(1);

        const tc: TeamController = new TeamController();
        const allTeams: Team[] = await tc.getAllTeams();
        const team = await tc.getTeam(Test.TEAMNAME1);
        const teamCount: number = allTeams.length;
        Log.info("GithubControllerSpec::ReleasingRepo - repoCount: " + repoCount + " teamcCount: " + teamCount);
        expect(teamCount).to.be.greaterThan(1);

        const success = await gc.releaseRepository(repo, [team], false);
        expect(success).to.be.true;
    }).timeout(Test.TIMEOUT);

    it("Should fail to release a repo if preconditions are not met.", async function() {
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

        const team: any = {id: Test.TEAMNAME3, personIds: [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]};
        // try to release a repo with a team that doesn't exist
        res = await gc.releaseRepository(allRepos[1], [team], false);
        expect(res).to.be.false;

    }).timeout(Test.TIMEOUT);

    it("Should fail to create a pull request.", async function() {
        let res = null;
        let ex = null;
        try {
            // not implemented yet, shoulf fail right away
            res = await gc.createPullRequest('', '');
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
    }).timeout(Test.TIMEOUT);

});
