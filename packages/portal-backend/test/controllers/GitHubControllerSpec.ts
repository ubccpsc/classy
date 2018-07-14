import {expect} from "chai";
import "mocha";

import {GitHubController} from "../../src/controllers/GitHubController";
import {TeamController} from "../../src/controllers/TeamController";
import {RepositoryController} from "../../src/controllers/RepositoryController";

const loadFirst = require('../GlobalSpec');
const rFirst = require('./TeamControllerSpec');

describe.skip("GitHubController", () => {

    let TIMEOUT = 10000;

    let gc: GitHubController;

    before(async () => {
    });

    beforeEach(() => {
        gc = new GitHubController();
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
