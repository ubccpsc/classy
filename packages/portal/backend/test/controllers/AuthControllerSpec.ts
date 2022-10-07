import {expect} from "chai";
import "mocha";

import {TestHarness} from "@common/TestHarness";

import {AuthController} from "@backend/controllers/AuthController";
import {DatabaseController} from "@backend/controllers/DatabaseController";
import {PersonController} from "@backend/controllers/PersonController";
import {Auth} from "@backend/Types";

import "@common/GlobalSpec"; // load first
import "./PersonControllerSpec";

describe("AuthController", () => {

    const TIMEOUT = 10000;

    let ac: AuthController;

    before(async () => {
        await TestHarness.suiteBefore("AuthController");
        await TestHarness.preparePeople();
    });

    beforeEach(() => {
        ac = new AuthController();
    });

    after(async () => {
        TestHarness.suiteAfter("AuthController");
    });

    it("Should not validate a user who is null.", async () => {
        const isValid = await ac.isValid(null, ""); // not registered
        expect(isValid).to.be.false;
    });

    it("Should not validate a user who does not exist.", async () => {
        const isValid = await ac.isValid("aUserwhoDoesNotExist_sadmewnmdsv", ""); // not registered
        expect(isValid).to.be.false;
    });

    it("Should not validate a user who exists but does not have a valid token.", async () => {
        const auth: Auth = {
            personId: TestHarness.USER1.id,
            token: TestHarness.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        const isValid = await ac.isValid(TestHarness.USER1.id, TestHarness.FAKETOKEN); // not valid
        expect(isValid).to.be.false;
    });

    it("Should not let a person who does not exist be privileged.", async () => {
        const isPriv = await ac.isPrivileged("aUserwhoDoesNotExist_" + Date.now(), ""); // not registered
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.false;
    });

    it("Should identify a staff correctly.", async function () {
        let isValid = await ac.isValid(TestHarness.STAFF1.id, TestHarness.FAKETOKEN);
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: TestHarness.STAFF1.id,
            token: TestHarness.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid(TestHarness.STAFF1.id, TestHarness.REALTOKEN);
        expect(isValid).to.be.true;

        const isPriv = await ac.isPrivileged(TestHarness.STAFF1.id, TestHarness.REALTOKEN);
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.true;
    }).timeout(TestHarness.TIMEOUTLONG);

    it("Should identify an adminstaff correctly.", async function () {
        let isValid = await ac.isValid(TestHarness.ADMINSTAFF1.id, TestHarness.FAKETOKEN);
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: TestHarness.ADMINSTAFF1.id,
            token: TestHarness.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid(TestHarness.ADMINSTAFF1.id, TestHarness.REALTOKEN);
        expect(isValid).to.be.true;

        const isPriv = await ac.isPrivileged(TestHarness.ADMINSTAFF1.id, TestHarness.REALTOKEN);
        expect(isPriv.isAdmin).to.be.true;
        expect(isPriv.isStaff).to.be.true;
    }).timeout(TestHarness.TIMEOUTLONG);

    it("Should identify an admin (but not adminstaff) correctly.", async function () {
        let isValid = await ac.isValid(TestHarness.ADMIN1.id, TestHarness.REALTOKEN);
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: TestHarness.ADMIN1.id,
            token: TestHarness.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid(TestHarness.ADMIN1.id, TestHarness.REALTOKEN);
        expect(isValid).to.be.true;

        const isPriv = await ac.isPrivileged(TestHarness.ADMIN1.id, TestHarness.REALTOKEN);
        expect(isPriv.isAdmin).to.be.true;
        expect(isPriv.isStaff).to.be.false;
    }).timeout(TestHarness.TIMEOUTLONG);

    it("Should identify a non-admin correctly.", async function () {
        let isValid = await ac.isValid(TestHarness.USER1.id, TestHarness.FAKETOKEN);
        expect(isValid).to.be.false;

        const auth: Auth = {
            personId: TestHarness.USER1.id,
            token: TestHarness.REALTOKEN
        };
        await DatabaseController.getInstance().writeAuth(auth);
        isValid = await ac.isValid(TestHarness.USER1.id, TestHarness.REALTOKEN);
        expect(isValid).to.be.true;

        const isPriv = await ac.isPrivileged(TestHarness.USER1.id, TestHarness.REALTOKEN);
        expect(isPriv.isAdmin).to.be.false;
        expect(isPriv.isStaff).to.be.false;
    }).timeout(TIMEOUT);

    it("Should be able to logout an admin user.", async () => {
        const dc = DatabaseController.getInstance();
        const pc = new PersonController();

        let person = await pc.getPerson(TestHarness.ADMIN1.id);
        expect(person.kind).to.not.be.null;

        const workedEnough = await ac.removeAuthentication(TestHarness.ADMIN1.id);
        expect(workedEnough).to.be.true;

        const auth = await dc.getAuth(TestHarness.ADMIN1.id);
        expect(auth).to.be.null; // shouldn"t exist for a logged out person

        person = await pc.getPerson(TestHarness.ADMIN1.id);
        expect(person.kind).to.be.null; // should be null after being logged out
    });

    it("Should be able to logout a student user.", async () => {
        const dc = DatabaseController.getInstance();
        const pc = new PersonController();

        let person = await pc.getPerson(TestHarness.USER1.id);
        expect(person.kind).to.not.be.null;

        const workedEnough = await ac.removeAuthentication(TestHarness.USER1.id);
        expect(workedEnough).to.be.true;

        const auth = await dc.getAuth(TestHarness.USER1.id);
        expect(auth).to.be.null; // shouldn"t exist for a logged out person

        person = await pc.getPerson(TestHarness.USER1.id);
        expect(person.kind).to.equal("student"); // students should stay students after logging out
    });

    it("Should be able to handle trying to logout users who do not exist.", async () => {
        // this seems strange, but really we just want it to not crash
        let workedEnough = await ac.removeAuthentication(undefined);
        expect(workedEnough).to.be.false;

        workedEnough = await ac.removeAuthentication(null);
        expect(workedEnough).to.be.false;

        workedEnough = await ac.removeAuthentication("totallyMADEUPname12388291900d");
        expect(workedEnough).to.be.false; // can"t
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
