import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";
import {ActionPayload, GradePayload, SDMMStatus} from "../../../../../common/types/SDMMTypes";

import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {GitHubController} from "../../../src/controllers/GitHubController";
// import {TestGitHubController} from "../../../src/controllers/GitHubController";
import {GradesController} from "../../../src/controllers/GradesController";
import {PersonController} from "../../../src/controllers/PersonController";
import {RepositoryController} from "../../../src/controllers/RepositoryController";
import {SDMMController} from "../../../src/controllers/SDMM/SDMMController";
import {TeamController} from "../../../src/controllers/TeamController";
import {Person} from "../../../src/Types";

import {Test} from "../../GlobalSpec";
import '../../GlobalSpec'; // load first
import '../GradeControllerSpec'; // load first

export class TestData {

    // NOTE: does not use the Test. values on purpose to make it easier
    // to validate status without having to nuke the db first
    public TEAMD0 = "sddmd0test";
    public TEAMD1 = "sddmd1test";

    public REPOD0 = "sddmd0repotest";
    public REPOD1 = "sddmd1repotest";

    public USER = "sddmdusertest";

    public PRNAME = "prd3id";

    public u1 = "sddmU1";
    public u2 = "sddmU2";
    public u3 = "sddmU3";

    public PERSON1: Person = null;
    public PERSON2: Person = null;
    public PERSON3: Person = null;

    constructor() {
        this.PERSON1 = {
            id:            this.u1,
            csId:          this.u1, // sdmm doesn't have these
            githubId:      this.u1,
            studentNumber: null,

            fName:  '',
            lName:  '',
            kind:   'student',
            URL:    'https://github.com/' + this.u1,
            labId:  'UNKNOWN',
            custom: {}
        };

        this.PERSON2 = {
            id:            this.u2,
            csId:          this.u2, // sdmm doesn't have these
            githubId:      this.u2,
            studentNumber: null,

            fName:  '',
            lName:  '',
            kind:   'student',
            URL:    'https://github.com/' + this.u2,
            labId:  'UNKNOWN',
            custom: {}
        };

        this.PERSON3 = {
            id:            this.u3,
            csId:          this.u3, // sdmm doesn't have these
            githubId:      this.u3,
            studentNumber: null,

            fName:  '',
            lName:  '',
            kind:   'student',
            URL:    'https://github.com/' + this.u3,
            labId:  'UNKNOWN',
            custom: {}
        };
    }
}

describe("SDDM: SDMMController", () => {

    let sc: SDMMController;
    let gc: GradesController;
    let tc: TeamController;
    let rc: RepositoryController;
    let pc: PersonController;
    let dc: DatabaseController;

    let data: TestData;

    let OLD_ORG: string | null = null;

    before(async () => {
        try {
            await Test.suiteBefore('SDMMController');
        } catch (err) {
            Log.test("SDMMControllerSpec::before - err: " + err);
        }

        Config.getInstance();
        OLD_ORG = Config.getInstance().getProp(ConfigKey.org);
        Config.getInstance().setProp(ConfigKey.org, 'secapstonetest');

        // clear stale data
        dc = DatabaseController.getInstance();
        await dc.clearData();

        // only bootstrap the database with deliverables
        await Test.prepareDeliverables();

        data = new TestData();

        rc = new RepositoryController();

        const ghInstance = new GitHubController();
        sc = new SDMMController(ghInstance);
        await sc.handleUnknownUser(data.u1); // provision user
        await sc.handleUnknownUser(data.u2); // provision user
        await sc.handleUnknownUser(data.u3); // provision user
    });

    after(async () => {
        Test.suiteAfter('SDMMController');
        // Force SDMM tests to run in an SDMM org
        Log.test("SDMMControllerSpec::after()");
        Config.getInstance();
        Config.getInstance().setProp(ConfigKey.org, OLD_ORG);
    });

    beforeEach(() => {
        data = new TestData();

        const ghInstance = new GitHubController();
        sc = new SDMMController(ghInstance);
        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
        dc = DatabaseController.getInstance();
    });

    it("Should not be able to get a status for an invalid user.", async () => {
        let status = null;
        let ex = null;
        try {
            status = await sc.getStatus('invalidUserWhoDoesNotExist29922');
        } catch (err) {
            ex = err;
        }

        expect(ex).to.not.be.null;
        expect(ex.message).to.equal('Error computing status for invalidUserWhoDoesNotExist29922; contact course staff.');
        expect(status).to.be.null;
    });

    it("Should be able to get a D0PRE status.", async () => {
        await sc.handleUnknownUser(data.USER); // provision user

        await pc.getPerson(data.USER); // get user

        const status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D0PRE");
    });

    /* D0PRE
        * D0
        * D1UNLOCKED
        * D1TEAMSET
        * D1
        * D2
        * D3PRE
        * D3
        */
    it("Should be able to get a D0 status.", async () => {
        let status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D0PRE");

        const person = await pc.getPerson(data.USER);
        const deliv = await dc.getDeliverable('d0');
        const team = await tc.createTeam(data.TEAMD0, deliv, [person], {sdmmd0: true});
        const repo = await rc.createRepository(data.REPOD0, [team], {d0enabled: true});
        expect(repo).to.not.be.null;

        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D0");
    });

    it("Should be able to get a D1UNLOCKED status.", async () => {
        let status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D0");

        let grade: GradePayload = {
            score:     59,
            comment:   '',
            urlName:   '',
            URL:       '',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(data.REPOD0, "d0", grade);
        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D0"); // 59 is too low

        grade = {
            score:     61,
            comment:   '',
            urlName:   '',
            URL:       '',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(data.REPOD0, "d0", grade);
        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1UNLOCKED");
    });

    it("Should be able to get a D1TEAMSET status.", async () => {
        let status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1UNLOCKED");

        const person = await pc.getPerson(data.USER);
        const deliv = await dc.getDeliverable('d1');
        const team = await tc.createTeam(data.TEAMD1, deliv, [person], {sdmmd1: true});
        expect(team).to.not.be.null;

        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1TEAMSET");
    });

    it("Should be able to get a D1 status.", async () => {
        let status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1TEAMSET");

        const team = await tc.getTeam(data.TEAMD1);
        const repo = await rc.createRepository(data.REPOD1, [team], {d1enabled: true});
        expect(repo).to.not.be.null;

        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1");
    });

    it("Should be able to get a D2 status.", async () => {
        let status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1");

        let grade: GradePayload = {
            score:     59,
            comment:   '',
            urlName:   '',
            URL:       '',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(data.REPOD1, "d1", grade);
        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1"); // 59 is too low

        grade = {
            score:     61,
            comment:   '',
            urlName:   '',
            URL:       '',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(data.REPOD1, "d1", grade);

        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D2");
    });

    it("Should be able to get a D3PRE status.", async () => {
        let status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D2");

        let grade: GradePayload = {
            score:     59,
            comment:   '',
            urlName:   '',
            URL:       '',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(data.REPOD1, "d2", grade);
        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D2"); // 59 is too low

        grade = {
            score:     61,
            comment:   '',
            urlName:   '',
            URL:       '',
            timestamp: Date.now(),
            custom:    {}
        };
        await gc.createGrade(data.REPOD1, "d2", grade);

        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D3PRE");
    });

    it("Should be able to get a D3 status.", async () => {
        let status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D3PRE");

        const repo = await rc.createPullRequest(data.REPOD1, data.PRNAME, {sddmD3pr: true});
        expect(repo).to.not.be.null;
        expect(repo.custom.sddmD3pr).to.be.true;

        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D3");
    });

    it("Should not be able to provision a d0 repo for a random person.", async () => {
        let val = null;
        try {
            await sc.provision(Test.DELIVID0, ["this is a random name #@"]);
        } catch (err) {
            val = err;
        }
        expect(val.message).to.not.be.undefined;
        expect(val.message).to.equal('Username not registered; contact course staff.');
    });

    /**
     *
     *
     * Provisioning tests. These do need to run in order.
     *
     *
     */

    it("Should not allow multiple people to be added to a d0 repo.", async () => {
        const person = await pc.createPerson(data.PERSON1);
        expect(person).to.not.be.null;

        const person2 = await pc.createPerson(data.PERSON2);
        expect(person2).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        const allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.be.empty;

        // don't provision for non-existent users
        let val = null;
        try {
            await sc.provision(Test.DELIVID0, ['23234#$Q#@#invalid']);
        } catch (err) {
            val = err;
        }
        expect(val).to.not.be.null;
        expect(val.message).to.equal('Username not registered; contact course staff.');

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        // don't create a d0 repo with multiple people
        val = null;
        try {
            await sc.provision(Test.DELIVID0, [data.PERSON1.id, data.PERSON2.id]);
        } catch (err) {
            val = err;
        }
        expect(val).to.not.be.null;
        expect(val.message).to.equal('D0 for indivduals only; contact course staff.');

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;
    });

    it("Should be able to provision a d0 repo for an individual.", async () => {
        const person = await pc.getPerson(data.PERSON1.id);
        expect(person).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.be.empty;

        const payload = await sc.provision(Test.DELIVID0, [data.PERSON1.id]);
        expect(payload.success).to.not.be.undefined;
        expect(payload.failure).to.be.undefined;
        const status = (payload.success as ActionPayload).status;
        expect(status.status).to.equal(SDMMStatus[SDMMStatus.D0]);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);
        expect(allRepos[0].custom.d0enabled).to.be.true;

        allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(1);
        expect(allTeams[0].custom.sdmmd0).to.be.true;
    });

    it("Should not upgrade a d0 repo for an individual if the grade is too low.", async () => {
        const person = await pc.getPerson(data.PERSON1.id);
        expect(person).to.not.be.null;

        let val = null;
        try {
            await sc.provision(Test.DELIVID1, [data.PERSON1.id]);
        } catch (err) {
            val = err;
        }
        expect(val).to.not.be.null;
        expect(val.message).to.equal('Current d0 grade is not sufficient to move on to d1.');

        const allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);
        expect(allRepos[0].custom.d0enabled).to.be.true;
        expect(allRepos[0].custom.d1enabled).to.be.false; // should stay d0

        const allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(1);
        expect(allTeams[0].custom.sdmmd0).to.be.true;
        expect(allTeams[0].custom.sdmmd1).to.be.false; // should stay d0
    });

    it("Should be able to upgrade a d0 repo for an individual.", async () => {
        Log.test("getting person");
        const person = await pc.getPerson(data.PERSON1.id);
        expect(person).to.not.be.null;

        Log.test("getting repo");
        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);

        const gradeR: GradePayload = {
            score:     65,
            comment:   'TESTCOMMENT',
            urlName:   'TESTURLNAME',
            URL:       'TESTURL',
            timestamp: Date.now(),
            custom:    {}
        };

        Log.test("setting d0 grade");
        const grade = await gc.createGrade(allRepos[0].id, Test.DELIVID0, gradeR);
        expect(grade).to.be.true;

        Log.test("checking status");
        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);
        expect(allRepos[0].custom.d0enabled).to.be.true;
        expect(allRepos[0].custom.d1enabled).to.be.false;

        Log.test('provisioning d1 repo');
        const payload = await sc.provision(Test.DELIVID1, [data.PERSON1.id]); // do it
        Log.test('provisioning d1 repo complete');
        expect(payload.success).to.not.be.undefined;
        expect(payload.failure).to.be.undefined;
        const status = (payload.success as ActionPayload).status;
        expect(status.status).to.equal(SDMMStatus[SDMMStatus.D1]);
        Log.test((payload.success as ActionPayload).message);

        Log.test("checking d1 repo status");
        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1); // no new repo
        expect(allRepos[0].custom.d0enabled).to.be.true;
        expect(allRepos[0].custom.d1enabled).to.be.true; // should be provisioned for d1 now

        Log.test("checking d1 team status");
        const allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(1);
        expect(allTeams[0].custom.sdmmd0).to.be.true;
        expect(allTeams[0].custom.sdmmd1).to.be.true; // should be provisioned for d1 now

        // try to do it again (should fail)  // makes sure they can't get multiple d1 repos
        let val = null;
        try {
            Log.test("ensuring we can't provision d1 again");
            await sc.provision(Test.DELIVID1, [data.PERSON1.id]); // do it
        } catch (err) {
            val = err;
        }
        expect(val).to.not.be.null;
        expect(val.message).to.equal('D1 repo has already been assigned: TEST__X__p_TEST__X__t_sddmU1');

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1); // no new repo
    });

    it("Should not be able to form a d1 team if a member does not exist or has insufficient d0 standing.", async () => {
        const person = await pc.getPerson(data.PERSON2.id); // person2; person1 has a d1 repo from previous upgrade
        expect(person).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0); // no new repo

        // don't allow pairing with someone who doesn't exist
        let val = null;
        try {
            await sc.provision(Test.DELIVID1, [data.PERSON2.id, "asdf32#@@#INVALIDPERSON"]);
        } catch (err) {
            val = err;
        }
        expect(val).to.not.be.null;
        expect(val.message).to.equal('All teammates must have achieved a score of 60% or more to join a team.');

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0);

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(0);

        // don't allow pairing with someone with insufficient d0 credit
        val = null;
        try {
            await sc.provision(Test.DELIVID1, [data.PERSON2.id, data.PERSON3.id]);
        } catch (err) {
            val = err;
        }
        expect(val).to.not.be.null;
        expect(val.message).to.equal('All teammates must have achieved a score of 60% or more to join a team.');

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0);

        allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(0);

        // and some other reasons you can't provision d1 repos

        // need at least one person
        val = null;
        try {
            await sc.provision(Test.DELIVID1, []);
        } catch (err) {
            val = err;
        }
        expect(val).to.not.be.null;
        expect(val.message).to.equal('Invalid # of people; contact course staff.');

        // can't form a group with yourself
        val = null;
        try {
            await sc.provision(Test.DELIVID1, [data.PERSON2.id, data.PERSON2.id]);
        } catch (err) {
            val = err;
        }
        expect(val).to.not.be.null;
        expect(val.message).to.equal("D1 duplicate users; if you wish to work alone, please select 'work individually'.");
    });

    it("Should be able to form a d1 team with a partner.", async () => {
        // prepare person 2
        const person2 = await pc.getPerson(data.PERSON2.id);
        expect(person2).to.not.be.null;
        let payload = await sc.provision(Test.DELIVID0, [person2.id]);
        expect(payload.success).to.not.be.undefined;
        expect((payload.success as ActionPayload).status.status).to.equal(SDMMStatus[SDMMStatus.D0]);

        let allRepos = await rc.getReposForPerson(person2);
        expect(allRepos).to.have.lengthOf(1);
        let gradeR: GradePayload = {
            score:     65,
            comment:   'TESTCOMMENT',
            urlName:   'TESTURLNAME',
            URL:       'TESTURL',
            timestamp: Date.now(),
            custom:    {}
        };
        let grade = await gc.createGrade(allRepos[0].id, Test.DELIVID0, gradeR);
        expect(grade).to.be.true;

        // prepare person3
        const person3 = await pc.createPerson(data.PERSON3);
        expect(person3).to.not.be.null;
        // create d0 payload for person2
        payload = await sc.provision(Test.DELIVID0, [person3.id]);
        expect(payload.success).to.not.be.undefined;
        expect((payload.success as ActionPayload).status.status).to.equal(SDMMStatus[SDMMStatus.D0]);

        // create d0 grade for person2
        allRepos = await rc.getReposForPerson(person3);
        expect(allRepos).to.have.lengthOf(1);
        gradeR = {
            score:     70,
            comment:   '',
            urlName:   '',
            URL:       '',
            timestamp: Date.now(),
            custom:    {}
        };
        grade = await gc.createGrade(allRepos[0].id, Test.DELIVID0, gradeR);
        expect(grade).to.be.true;

        // try to upgrade them to d1
        Log.test('Updating to d1');
        payload = await sc.provision(Test.DELIVID1, [person2.id, person3.id]);
        expect(payload.success).to.not.be.undefined;
        expect(payload.failure).to.be.undefined;
        const status = (payload.success as ActionPayload).status;
        expect(status.status).to.equal(SDMMStatus[SDMMStatus.D1]);
        Log.test((payload as ActionPayload).message);

        allRepos = await rc.getReposForPerson(person2);
        expect(allRepos).to.have.lengthOf(2);

        // expect(allRepos[0].custom.d0enabled).to.be.true;
        // expect(allRepos[0].custom.d1enabled).to.be.false;

        const allTeams = await tc.getTeamsForPerson(person2);
        expect(allTeams).to.have.lengthOf(2);
        // expect(allTeams[0].custom.sdmmd0).to.be.true;
        // expect(allTeams[0].custom.sdmmd1).to.be.false;
    });

    it("Should not be able to provision a d1 team with more than two people.", async () => {
        let payload = null;
        let ex = null;
        try {
            payload = await sc.provision(Test.DELIVID1, [data.PERSON1.id, data.PERSON2.id, data.PERSON3.id]);
        } catch (err) {
            ex = err;
        }
        expect(payload).to.be.null;
        expect(ex).to.not.be.null;
        expect(ex.message).to.equal('D1 can only be performed by single students or pairs of students.');
    });

    it("Should not be able to provision a deliverable (d2) that does not need to be provisioned.", async () => {
        let payload = null;
        let ex = null;
        try {
            payload = await sc.provision(Test.DELIVID2, [data.PERSON1.id, data.PERSON2.id]);
        } catch (err) {
            ex = err;
        }
        expect(payload).to.be.null;
        expect(ex).to.not.be.null;
        expect(ex.message).to.equal('Repo not needed; contact course staff.');
    });

});
