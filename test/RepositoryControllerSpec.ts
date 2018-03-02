import {RepositoryController} from "../src/controllers/RepositoryController";
import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {TeamController} from "../src/controllers/TeamController";
import {PersonController} from "../src/controllers/PersonController";

const loadFirst = require('./GlobalSpec');
const teamsFirst = require('./TeamControllerSpec');

describe("RepositoryController", () => {

    let ORGNAME: string;
    let rc: RepositoryController;
    let tc: TeamController;
    let pc: PersonController;

    const TEAMNAME1 = 'team1';

    const REPONAME1 = 'repo1';
    const REPONAME2 = 'repo2';

    const NAME1 = 'user1';
    const NAME2 = 'user2';

    before(async () => {
        ORGNAME = Config.getInstance().getProp('org');
    });

    beforeEach(() => {
        tc = new TeamController();
        rc = new RepositoryController();
        pc = new PersonController();
    });

    it("Should be able to get all repositories, even if there are none.", async () => {
        let repos = await rc.getAllRepos(ORGNAME);
        expect(repos).to.have.lengthOf(0);
    });

    it("Should be able to create a repo.", async () => {
        let repos = await rc.getAllRepos(ORGNAME);
        expect(repos).to.have.lengthOf(0);

        let teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);

        let repo = await rc.createRepository(ORGNAME, REPONAME1, teams, {});
        expect(repo).to.not.be.null;

        repos = await rc.getAllRepos(ORGNAME);
        expect(repos).to.have.lengthOf(1);
    });

    it("Should not create a repo a second time.", async () => {
        let repos = await rc.getAllRepos(ORGNAME);
        expect(repos).to.have.lengthOf(1);

        let teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);

        let repo = await rc.createRepository(ORGNAME, REPONAME1, teams, {});
        expect(repo).to.not.be.null;

        repos = await rc.getAllRepos(ORGNAME);
        expect(repos).to.have.lengthOf(1);
    });

    it("Should be able to find all repos for a user.", async () => {
        let repos = await rc.getAllRepos(ORGNAME);
        expect(repos).to.have.lengthOf(1);

        const person = await pc.getPerson(ORGNAME, NAME1);
        repos = await rc.getReposForPerson(person);
        expect(repos).to.have.lengthOf(1);
    });


});
