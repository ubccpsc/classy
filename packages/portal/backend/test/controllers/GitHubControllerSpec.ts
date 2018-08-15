import {expect} from "chai";
import "mocha";
import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {GitHubActions} from "../../src/controllers/GitHubActions";

import {GitHubController} from "../../src/controllers/GitHubController";
import {PersonController} from "../../src/controllers/PersonController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {Repository, Team} from "../../src/Types";
import {Test} from "../GlobalSpec";

const loadFirst = require('../GlobalSpec');
const rFirst = require('./TeamControllerSpec');

describe("GitHubController", () => {
    // TODO: investigate skipping this way: https://stackoverflow.com/a/41908943 (and turning them on/off with an env flag)

    let gc: GitHubController;

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    before(async () => {
        Log.test("GitHubControllerSpec::before() - start; forcing testorg");
        // force testorg so real org does not get deleted or modified
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        Test.suiteBefore('GitHubController');

        // clear stale data
        const dc = DatabaseController.getInstance();
        await dc.clearData();

        // get data ready
        await Test.prepareDeliverables();

        // redo with real github people
        const pc = new PersonController();
        let p = Test.createPerson(Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB1, 'student');
        await pc.writePerson(p);
        p = Test.createPerson(Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB2, 'student');
        await pc.writePerson(p);

        const tc = new TeamController();
        const t1 = await Test.createTeam(Test.TEAMNAME1, Test.DELIVID0, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        await dc.writeTeam(t1);
        const t2 = await Test.createTeam(Test.TEAMNAME2, Test.DELIVID1, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        await dc.writeTeam(t2);
        const t3 = await Test.createTeam(Test.TEAMNAME3, Test.DELIVID2, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        await dc.writeTeam(t3);

        const rc = new RepositoryController();
        await rc.createRepository(Test.REPONAME1, [t1], {});
        await rc.createRepository(Test.REPONAME2, [t2], {});
        await rc.createRepository(Test.REPONAME3, [t3], {});
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
        expect(teamUrl).to.equal('https://github.com/orgs/classytest/teams/TESTteam1');
    });

    it("Should be able to get a repo url for a valid repo.", async () => {
        const repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        const repoUrl = await gc.getRepositoryUrl(repos[0]);
        expect(repoUrl).to.equal('https://github.com/classytest/TESTrepo1');
    });

    it("Should be able to provision a repo.", async function() {
        const repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        const teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        const webhook = 'https://devnull.cs.ubc.ca/classyWebhook';
        const importUrl = 'https://github.com/SECapstone/bootstrap';
        const provisioned = await gc.provisionRepository(repos[0].id, teams, importUrl, webhook);
        expect(provisioned).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to create a repo.", async function() {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const allRepos: Repository[] = await rc.getAllRepos();
        const repoCount: number = allRepos.length;

        expect(repoCount).to.be.greaterThan(1);

        const importURL = 'https://github.com/SECapstone/capstone';
        const success = await gc.createRepository(allRepos[1].id, importURL);
        expect(success).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to create a repo with a custom path.", async function() {
        // setup
        const rc: RepositoryController = new RepositoryController();
        const allRepos: Repository[] = await rc.getAllRepos();
        const repoCount: number = allRepos.length;

        expect(repoCount).to.be.greaterThan(2);

        const importURL = 'https://github.com/SECapstone/capstone';
        const success = await gc.createRepository(allRepos[2].id, importURL, "AutoTest.md");
        expect(success).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to release a repo.", async function() {
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

        const success = await gc.releaseRepository(allRepos[1], [allTeams[1]], false);
        expect(success).to.be.true;
    }).timeout(Test.TIMEOUT);

});
