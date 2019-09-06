import {expect} from "chai";
import "mocha";

import Log from "../../../../common/Log";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {PersonController} from "../../src/controllers/PersonController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {Repository} from "../../src/Types";

import {Test} from "../../../../common/TestHarness";
import '../GlobalSpec'; // load first
import './TeamControllerSpec'; // load first

describe("RepositoryController", () => {

    let rc: RepositoryController;
    let tc: TeamController;
    let pc: PersonController;
    let dc: DeliverablesController;

    before(async () => {
        await Test.suiteBefore('RepositoryController');

        // clear stale data (removed; happens in suitebefore)
        // const dbc = DatabaseController.getInstance();
        // await dbc.clearData();

        // get data ready
        await Test.prepareDeliverables();
        await Test.preparePeople();
        await Test.prepareAuth();
        await Test.prepareTeams();

        tc = new TeamController();
        rc = new RepositoryController();
        pc = new PersonController();
        dc = new DeliverablesController();
    });

    after(async () => {
        Test.suiteAfter('RepositoryController');
    });

    it("Should be able to get all repositories, even if there are none.", async () => {
        const repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(0);
    });

    it("Should be able to create a repo.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(0);

        const team = await tc.getTeam(Test.TEAMNAME1);
        expect(team).to.not.be.null;

        const deliv = await dc.getDeliverable(Test.DELIVID0);

        const repo = await rc.createRepository(Test.REPONAME1, deliv, [team], {});
        expect(repo).to.not.be.null;

        repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);
    });

    it("Should not create a repo a second time.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);

        const team = await tc.getTeam(Test.TEAMNAME1);
        expect(team).to.not.be.null;

        const deliv = await dc.getDeliverable(Test.DELIVID0);

        const repo = await rc.createRepository(Test.REPONAME1, deliv, [team], {});
        expect(repo).to.not.be.null;

        repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);
    });

    it("Should be able to find all repos for a user.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);

        const person = await pc.getPerson(Test.USER1.id);
        repos = await rc.getReposForPerson(person);
        expect(repos).to.have.lengthOf(1);
    });

    it("Should be able to find all users for a repo.", async () => {
        const repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);

        const people = await rc.getPeopleForRepo(repos[0].id);
        Log.test(JSON.stringify(people));
        expect(people).to.have.lengthOf(2);
        expect(people).to.contain(Test.USER1.id);
        expect(people).to.contain(Test.USER2.id);
    });

    it("Should be able to find repos for a person.", async () => {
        // test should be in PersonControllerSpec but the repos are made here...
        const repos = await pc.getRepos(Test.USER1.id);
        expect(repos).to.have.lengthOf(1);
    });

    it("Should be able to update a repo.", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);

        const repo = repos[0];
        expect(repo).to.not.be.null;
        expect(repo.URL).to.not.equal('FOOURL');

        repo.URL = 'FOOURL';
        const res = await rc.updateRepository(repo);
        expect(res).to.not.be.null;
        expect(res.URL).to.equal('FOOURL');

        repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1); // should still only have one
    });

    it("Should be able to update a repo, even if it doesn't exist (aka it should create it).", async () => {
        let repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(1);

        const repo: Repository = {
            id:       Date.now() + '_id',
            delivId:  Test.DELIVID0,
            URL:      null,
            cloneURL: null,
            custom:   {},
            teamIds:  []
        };

        const res = await rc.updateRepository(repo);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(repo.id);

        repos = await rc.getAllRepos();
        expect(repos).to.have.lengthOf(2); // should have created a new repo
    });

    it("Should fail to update a repo gracefully.", async () => {
        const res = await rc.updateRepository(null);
        expect(res).to.be.null;
    });

    it("Should be able to create a RepositoryTransport.", async () => {
        const repo: Repository = {
            id:       Date.now() + '_id',
            delivId:  Test.DELIVID0,
            URL:      null,
            cloneURL: null,
            custom:   {},
            teamIds:  []
        };

        const rt = RepositoryController.repositoryToTransport(repo);

        expect(rt.id).to.equal(repo.id);
        expect(rt.delivId).to.equal(repo.delivId);
        expect(rt.URL).to.equal(repo.URL);
    });

    it("Should fail to create a RepositoryTransport gracefully if something is wrong.", async () => {
        let ex = null;
        try {
            RepositoryController.repositoryToTransport(null);
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;

        ex = null;
        try {
            RepositoryController.repositoryToTransport(undefined);
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;
    });

});
