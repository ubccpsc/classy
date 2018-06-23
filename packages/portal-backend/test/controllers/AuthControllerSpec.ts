import {expect} from "chai";
import "mocha";

import {Test} from "../GlobalSpec";
import {AuthController} from "../../src/controllers/AuthController";
import {PersonController} from "../../src/controllers/PersonController";
import {Auth, Person} from "../../src/Types";
import {DatabaseController} from "../../src/controllers/DatabaseController";

const loadFirst = require('../GlobalSpec');
const teamsFirst = require('./PersonControllerSpec');

describe.only("AuthController", () => {

    let ac: AuthController;

    before(async () => {
    });

    beforeEach(() => {
        ac = new AuthController();
    });

    it("Should not validate a user who does not exist.", async () => {
        let isValid = await ac.isValid(Test.USERNAME3, ''); // not registered
        expect(isValid).to.be.false;
    });


    it("Should not let invalid be admins.", async () => {
        let isPriv = await ac.isPrivileged(Test.USERNAME3, ''); // not registered
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.false;
    });


    it("Should identify a staff correctly.", async () => {
        const pc = new PersonController();
        const p: Person = {
            id:            'rtholmes',
            csId:          'r2d2',
            githubId:      'rtholmes',
            studentNumber: null,

            fName: '',
            lName: '',
            kind:  '',
            URL:   null,

            labId: null,

            custom: {}
        };
        const newPerson = await pc.createPerson(p);
        expect(newPerson).to.not.be.null;

        let isValid = await ac.isValid('rtholmes', 'faketoken');
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: 'rtholmes',
            token:    'realtoken'
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid('rtholmes', 'realtoken');
        expect(isValid).to.be.true;

        let isPriv = await ac.isPrivileged('rtholmes', 'realtoken');
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.true;
    });


    it("Should identify a non-admin correctly.", async () => {
        const pc = new PersonController();
        const p: Person = {
            id:            'user',
            csId:          'r2d2',
            githubId:      'user',
            studentNumber: null,

            fName: '',
            lName: '',
            kind:  '',
            URL:   null,

            labId: null,

            custom: {}
        };
        const newPerson = await pc.createPerson(p);
        expect(newPerson).to.not.be.null;

        let isValid = await ac.isValid('user', 'faketoken');
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: 'user',
            token:    'realtoken'
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid('user', 'realtoken');
        expect(isValid).to.be.true;

        let isPriv = await ac.isPrivileged('user', 'realtoken');
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.false;
    });

    // TODO: implement auth controller tests
    /*
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
        let repos = await rc.getAllRepos(Test.ORGNAME);
        expect(repos).to.have.lengthOf(0);
    });

    it("Should be able to create a repo.", async () => {
        let repos = await rc.getAllRepos(Test.ORGNAME);
        expect(repos).to.have.lengthOf(0);

        let team = await tc.getTeam(Test.ORGNAME, Test.TEAMNAME1);
        expect(team).to.not.be.null;

        let repo = await rc.createRepository(Test.ORGNAME, Test.REPONAME1, [team], {});
        expect(repo).to.not.be.null;

        repos = await rc.getAllRepos(Test.ORGNAME);
        expect(repos).to.have.lengthOf(1);
    });

    it("Should not create a repo a second time.", async () => {
        let repos = await rc.getAllRepos(Test.ORGNAME);
        expect(repos).to.have.lengthOf(1);

        let team = await tc.getTeam(Test.ORGNAME, Test.TEAMNAME1);
        expect(team).to.not.be.null;

        let repo = await rc.createRepository(Test.ORGNAME, Test.REPONAME1, [team], {});
        expect(repo).to.not.be.null;

        repos = await rc.getAllRepos(Test.ORGNAME);
        expect(repos).to.have.lengthOf(1);
    });

    it("Should be able to find all repos for a user.", async () => {
        let repos = await rc.getAllRepos(Test.ORGNAME);
        expect(repos).to.have.lengthOf(1);

        const person = await pc.getPerson(Test.ORGNAME, Test.USERNAME1);
        repos = await rc.getReposForPerson(person);
        expect(repos).to.have.lengthOf(1);
    });
    */
});
