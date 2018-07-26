import {expect} from "chai";
import "mocha";

import {Test} from "../GlobalSpec";

import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {PersonController} from "../../src/controllers/PersonController";
import Log from "../../../../common/Log";

const loadFirst = require('../GlobalSpec');
const teamsFirst = require('./TeamControllerSpec');

describe("RepositoryController", () => {

    let rc: RepositoryController;
    let tc: TeamController;
    let pc: PersonController;

    before(async () => {
    });

    beforeEach(() => {
        tc = new TeamController();
        rc = new RepositoryController();
        pc = new PersonController();
    });

    it("Should be able to get all repositories, even if there are none.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(0);
    });

    it("Should be able to create a repo.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(0);

        let team = await tc.getTeam(Test.TEAMNAME1);
        expect(team).to.not.be.null;

        let repo = await rc.createRepository(Test.REPONAME1, [team], {});
        expect(repo).to.not.be.null;

        repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);
    });

    it("Should not create a repo a second time.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);

        let team = await tc.getTeam(Test.TEAMNAME1);
        expect(team).to.not.be.null;

        let repo = await rc.createRepository(Test.REPONAME1, [team], {});
        expect(repo).to.not.be.null;

        repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);
    });

    it("Should be able to find all repos for a user.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);

        const person = await pc.getPerson(Test.USERNAME1);
        repos = await rc.getReposForPerson(person);
        expect(repos).to.have.lengthOf(1);
    });

    it("Should be able to find all users for a repo.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);

        let people = await rc.getPeopleForRepo(repos[0].id);
        Log.test(JSON.stringify(people));
        expect(people).to.have.lengthOf(2);
        expect(people).to.contain(Test.USERNAME1);
        expect(people).to.contain(Test.USERNAME2);
    });

    it("Should be able to find repos for a person.", async () => {
        // test should be in PersonControllerSpec but the repos are made here...
        const pc = new PersonController();
        const repos = await pc.getRepos(Test.USERNAME1);
        expect(repos).to.have.lengthOf(1);
    });

});
