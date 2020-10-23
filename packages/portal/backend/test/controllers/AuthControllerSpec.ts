import {expect} from "chai";
import "mocha";

import {AuthController} from "../../src/controllers/AuthController";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {PersonController} from "../../src/controllers/PersonController";
import {Auth} from "../../src/Types";

import {Test} from "../../../../common/TestHarness";
import '../GlobalSpec';
import './PersonControllerSpec';

describe("AuthController", () => {

    const TIMEOUT = 10000;

    let ac: AuthController;

    before(async () => {
        await Test.suiteBefore('AuthController');
        await Test.preparePeople();
    });

    beforeEach(() => {
        ac = new AuthController();
    });

    after(async () => {
        Test.suiteAfter('AuthController');
    });

    it("Should not validate a user who is null.", async () => {
        const isValid = await ac.isValid(null, ''); // not registered
        expect(isValid).to.be.false;
    });

    it("Should not validate a user who does not exist.", async () => {
        const isValid = await ac.isValid('aUserwhoDoesNotExist_sadmewnmdsv', ''); // not registered
        expect(isValid).to.be.false;
    });

    it("Should not validate a user who exists but does not have a valid token.", async () => {
        const auth: Auth = {
            personId: Test.USER1.id,
            token:    Test.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        const isValid = await ac.isValid(Test.USER1.id, Test.FAKETOKEN); // not valid
        expect(isValid).to.be.false;
    });

    it("Should not let a person who does not exist be privileged.", async () => {
        const isPriv = await ac.isPrivileged('aUserwhoDoesNotExist_' + Date.now(), ''); // not registered
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.false;
    });

    it("Should identify a staff correctly.", async function() {
        let isValid = await ac.isValid(Test.STAFF1.id, Test.FAKETOKEN);
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: Test.STAFF1.id,
            token:    Test.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid(Test.STAFF1.id, Test.REALTOKEN);
        expect(isValid).to.be.true;

        const isPriv = await ac.isPrivileged(Test.STAFF1.id, Test.REALTOKEN);
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should identify an adminstaff correctly.", async function() {
        let isValid = await ac.isValid(Test.ADMINSTAFF1.id, Test.FAKETOKEN);
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: Test.ADMINSTAFF1.id,
            token:    Test.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid(Test.ADMINSTAFF1.id, Test.REALTOKEN);
        expect(isValid).to.be.true;

        const isPriv = await ac.isPrivileged(Test.ADMINSTAFF1.id, Test.REALTOKEN);
        expect(isPriv.isAdmin).to.be.true;
        expect(isPriv.isStaff).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should identify an admin (but not adminstaff) correctly.", async function() {
        let isValid = await ac.isValid(Test.ADMIN1.id, Test.REALTOKEN);
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: Test.ADMIN1.id,
            token:    Test.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid(Test.ADMIN1.id, Test.REALTOKEN);
        expect(isValid).to.be.true;

        const isPriv = await ac.isPrivileged(Test.ADMIN1.id, Test.REALTOKEN);
        expect(isPriv.isAdmin).to.be.true;
        expect(isPriv.isStaff).to.be.false;
    }).timeout(Test.TIMEOUTLONG);

    it("Should identify a non-admin correctly.", async function() {
        let isValid = await ac.isValid(Test.USER1.id, Test.FAKETOKEN);
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: Test.USER1.id,
            token:    Test.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid(Test.USER1.id, Test.REALTOKEN);
        expect(isValid).to.be.true;

        const isPriv = await ac.isPrivileged(Test.USER1.id, Test.REALTOKEN);
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to logout an admin user.", async () => {
        // const personId = 'rtholmes';
        const dc = DatabaseController.getInstance();
        const pc = new PersonController();

        // await dbc.getAuth(personId);
        let person = await pc.getPerson(Test.ADMIN1.id);
        expect(person.kind).to.not.be.null;

        const workedEnough = await ac.removeAuthentication(Test.ADMIN1.id);
        expect(workedEnough).to.be.true;

        const auth = await dc.getAuth(Test.ADMIN1.id);
        expect(auth).to.be.null; // shouldn't exist for a logged out person

        person = await pc.getPerson(Test.ADMIN1.id);
        expect(person.kind).to.be.null; // should be null after being logged out
    });

    it("Should be able to logout a student user.", async () => {
        // const personId = 'rtholmes';
        const dc = DatabaseController.getInstance();
        const pc = new PersonController();

        // await dbc.getAuth(personId);
        let person = await pc.getPerson(Test.USER1.id);
        expect(person.kind).to.not.be.null;

        const workedEnough = await ac.removeAuthentication(Test.USER1.id);
        expect(workedEnough).to.be.true;

        const auth = await dc.getAuth(Test.USER1.id);
        expect(auth).to.be.null; // shouldn't exist for a logged out person

        person = await pc.getPerson(Test.USER1.id);
        expect(person.kind).to.equal('student'); // students should stay students after logging out
    });

    it("Should be able to handle trying to logout users who do not exist.", async () => {
        // this seems strange, but really we just want it to not crash
        let workedEnough = await ac.removeAuthentication(undefined);
        expect(workedEnough).to.be.false;

        workedEnough = await ac.removeAuthentication(null);
        expect(workedEnough).to.be.false;

        workedEnough = await ac.removeAuthentication('totallyMADEUPname12388291900d');
        expect(workedEnough).to.be.false; // can't
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
