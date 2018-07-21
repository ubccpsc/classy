import {expect} from "chai";
import "mocha";

import {GitHubController} from "../../src/controllers/GitHubController";
import {TeamController} from "../../src/controllers/TeamController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import Log from "../../../../common/Log";
import Config, {ConfigKey} from "../../../../common/Config";

const loadFirst = require('../GlobalSpec');
const rFirst = require('./TeamControllerSpec');

describe("GitHubController", () => {
    // TODO: investigate skipping this way: https://stackoverflow.com/a/41908943 (and turning them on/off with an env flag)

    let TIMEOUT = 10000;

    let gc: GitHubController;

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    before(() => {
        Log.test("GitHubControllerSpec::before() - start; forcing testorg");
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg)); // force testorg so real org does not get deleted or modified
    });

    after(() => {
        Log.test("GitHubControllerSpec::after() - start; replacing original org");
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
    });


    beforeEach(function () {
        Log.test('GitHubController::BeforeEach - "' + (<any>this).currentTest.title + '"');
        const ci = process.env.CI;
        const override = false; // set to true if you want to run these tests locally
        if (override || typeof ci !== 'undefined' && Boolean(ci) === true) {
            Log.test("GitHubController::beforeEach() - running in CI; not skipping");
            gc = new GitHubController();
        } else {
            Log.test("GitHubController::beforeEach() - skipping (not CI)");
            this.skip();
        }
    });

    it("Should be able to get a team url for a valid team.", async () => {
        let teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        let teamUrl = await gc.getTeamUrl(teams[0]);
        expect(teamUrl).to.equal('https://github.com/orgs/classytest/teams/TESTteam1');
    });

    it("Should be able to get a repo url for a valid repo.", async () => {
        let repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        let repoUrl = await gc.getRepositoryUrl(repos[0]);
        expect(repoUrl).to.equal('https://github.com/classytest/TESTrepo1');
    });


    it("Should be able to provision a repo.", async function () {
        let repos = await new RepositoryController().getAllRepos();
        expect(repos.length).to.be.greaterThan(0);

        let teams = await new TeamController().getAllTeams();
        expect(teams.length).to.be.greaterThan(0);

        const webhook = 'https://devnull.cs.ubc.ca/classyWebhook';
        let importUrl = 'https://github.com/SECapstone/bootstrap';
        const provisioned = await gc.provisionRepository(repos[0].id, teams, importUrl, webhook);
        expect(provisioned).to.be.true;
    }).timeout(TIMEOUT * 2);

});
