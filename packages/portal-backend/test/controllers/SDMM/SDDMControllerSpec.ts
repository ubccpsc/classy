const loadFirst = require('../../GlobalSpec');
const rBefore = require('../GradeControllerSpec');

import {expect} from "chai";
import "mocha";

import Log from "../../../../common/Log";

import {ActionPayload, FailurePayload, GradePayload, SDDMStatus} from "../../../src/controllers/CourseController";
import {SDMMController} from "../../../src/controllers/SDMM/SDMMController";
import {GradesController} from "../../../src/controllers/GradesController";
import {RepositoryController} from "../../../src/controllers/RepositoryController";
import {TeamController} from "../../../src/controllers/TeamController";
import {PersonController} from "../../../src/controllers/PersonController";
import {Test} from "../../GlobalSpec";
import {Person} from "../../../src/Types";
import {TestGitHubController} from "../../../src/controllers/GitHubController";


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

describe("SDDMController", () => {

    let sc: SDMMController;
    let gc: GradesController;
    let tc: TeamController;
    let rc: RepositoryController;
    let pc: PersonController;

    let data: TestData;

    before(async () => {

    });

    beforeEach(() => {
        data = new TestData();

        const ghInstance = new TestGitHubController();
        sc = new SDMMController(ghInstance);
        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
    });

    it("Should be able to get a D0PRE status.", async () => {
        await sc.handleUnknownUser(data.USER); // provision user

        await pc.getPerson(data.USER); // get user

        let status = await sc.getStatus(data.USER);
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
        const team = await tc.createTeam(data.TEAMD0, [person], {sdmmd0: true});
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
            URL:       '',
            timestamp: Date.now()
        };
        await gc.createGrade(data.REPOD0, "d0", grade);
        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D0"); // 59 is too low

        grade = {
            score:     61,
            comment:   '',
            URL:       '',
            timestamp: Date.now()
        };
        await gc.createGrade(data.REPOD0, "d0", grade);
        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1UNLOCKED");
    });

    it("Should be able to get a D1TEAMSET status.", async () => {
        let status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1UNLOCKED");

        const person = await pc.getPerson(data.USER);
        const team = await tc.createTeam(data.TEAMD1, [person], {sdmmd1: true});
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
            URL:       '',
            timestamp: Date.now()
        };
        await gc.createGrade(data.REPOD1, "d1", grade);
        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D1"); // 59 is too low

        grade = {
            score:     61,
            comment:   '',
            URL:       '',
            timestamp: Date.now()
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
            URL:       '',
            timestamp: Date.now()
        };
        await gc.createGrade(data.REPOD1, "d2", grade);
        status = await sc.getStatus(data.USER);
        expect(status.status).to.equal("D2"); // 59 is too low

        grade = {
            score:     61,
            comment:   '',
            URL:       '',
            timestamp: Date.now()
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
        let payload = await sc.provision(Test.DELIVID0, ["this is a random name #@"]);
        expect(payload.failure).to.not.be.undefined;
        Log.test(payload.failure.message);
    });

    /**
     *
     *
     * Provisioning tests. These do need to run in order.
     *
     *
     */

    it("Should not allow multiple people to be added to a d0 repo.", async () => {
        let person = await pc.createPerson(data.PERSON1);
        expect(person).to.not.be.null;

        let person2 = await pc.createPerson(data.PERSON2);
        expect(person2).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.be.empty;

        // don't provision for non-existent users
        let payload = await sc.provision(Test.DELIVID0, [data.PERSON1.id, '23234#$Q#@#invalid']);
        expect(payload.failure).to.not.be.undefined;
        Log.test(payload.failure.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        // don't create a d0 repo with multiple people
        payload = await sc.provision(Test.DELIVID0, [data.PERSON1.id, data.PERSON2.id]);
        expect(payload.failure).to.not.be.undefined;
        Log.test(payload.failure.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        // also shouldn't be able to provision someone who hasn't been created yet
        payload = await sc.provision(Test.DELIVID0, [data.PERSON3.id]);
        expect(payload.failure).to.not.be.undefined;
        Log.test(payload.failure.message);
    });


    it("Should be able to provision a d0 repo for an individual.", async () => {
        let person = await pc.getPerson(data.PERSON1.id);
        expect(person).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.be.empty;

        let payload = await sc.provision(Test.DELIVID0, [data.PERSON1.id]);
        expect(payload.success).to.not.be.undefined;
        expect(payload.failure).to.be.undefined;
        const status = (<ActionPayload>payload.success).status;
        expect(status.status).to.equal(SDDMStatus[SDDMStatus.D0]);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);
        expect(allRepos[0].custom.d0enabled).to.be.true;

        allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(1);
        expect(allTeams[0].custom.sdmmd0).to.be.true;
    });


    it("Should not upgrade a d0 repo for an individual if the grade is too low.", async () => {
        let person = await pc.getPerson(data.PERSON1.id);
        expect(person).to.not.be.null;

        let payload = await sc.provision(Test.DELIVID1, [data.PERSON1.id]);
        expect(payload.failure).to.not.be.undefined;
        Log.test((<FailurePayload>payload.failure).message);

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);
        expect(allRepos[0].custom.d0enabled).to.be.true;
        expect(allRepos[0].custom.d1enabled).to.be.false; // should stay d0

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(1);
        expect(allTeams[0].custom.sdmmd0).to.be.true;
        expect(allTeams[0].custom.sdmmd1).to.be.false; // should stay d0
    });

    it("Should be able to upgrade a d0 repo for an individual.", async () => {
        let person = await pc.getPerson(data.PERSON1.id);
        expect(person).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);

        let gradeR: GradePayload = {
            score:     65,
            comment:   'TESTCOMMENT',
            URL:       'TESTURL',
            timestamp: Date.now()
        };

        let grade = await gc.createGrade(allRepos[0].id, Test.DELIVID0, gradeR);
        expect(grade).to.be.true;

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);
        expect(allRepos[0].custom.d0enabled).to.be.true;
        expect(allRepos[0].custom.d1enabled).to.be.false;

        Log.test('provisioning');
        let payload = await sc.provision(Test.DELIVID1, [data.PERSON1.id]); // do it
        Log.test('provisioning complete');
        expect(payload.success).to.not.be.undefined;
        expect(payload.failure).to.be.undefined;
        const status = (<ActionPayload>payload.success).status;
        expect(status.status).to.equal(SDDMStatus[SDDMStatus.D1]);
        Log.test((<ActionPayload>payload.success).message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1); // no new repo
        expect(allRepos[0].custom.d0enabled).to.be.true;
        expect(allRepos[0].custom.d1enabled).to.be.true; // should be provisioned for d1 now

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(1);
        expect(allTeams[0].custom.sdmmd0).to.be.true;
        expect(allTeams[0].custom.sdmmd1).to.be.true; // should be provisioned for d1 now

        // try to do it again (should fail)  // makes sure they can't get multiple d1 repos
        payload = await sc.provision(Test.DELIVID1, [data.PERSON1.id]); // do it
        expect(payload.failure).to.not.be.undefined;
        Log.test((<FailurePayload>payload.failure).message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1); // no new repo
    });


    it("Should not be able to form a d1 team if a member does not exist or has insufficient d0 standing.", async () => {
        let person = await pc.getPerson(data.PERSON2.id); // person2; person1 has a d1 repo from previous upgrade
        expect(person).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0); // no new repo

        // don't allow pairing with someone who doesn't exist
        let payload = await sc.provision(Test.DELIVID1, [data.PERSON2.id, "asdf32#@@#INVALIDPERSON"]);
        expect(payload.failure).to.not.be.undefined;
        Log.test((<FailurePayload>payload.failure).message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0);

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(0);

        // don't allow pairing with someone with insufficient d0 credit
        payload = await sc.provision(Test.DELIVID1, [data.PERSON2.id, data.PERSON3.id]);
        expect(payload.failure).to.not.be.undefined;
        Log.test((<FailurePayload>payload.failure).message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0);

        allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(0);

        // and some other reasons you can't provision d1 repos

        // need at least one person
        payload = await sc.provision(Test.DELIVID1, []);
        expect(payload.success).to.be.undefined;
        expect(payload.failure).to.not.be.undefined;

        // can't form a group with yourself
        payload = await sc.provision(Test.DELIVID1, [data.PERSON2.id, data.PERSON2.id]);
        expect(payload.success).to.be.undefined;
        expect(payload.failure).to.not.be.undefined; // person2 doesn't exist
    });


    it("Should be able to form a d1 team with a partner.", async () => {
        // prepare person 2
        let person2 = await pc.getPerson(data.PERSON2.id);
        expect(person2).to.not.be.null;
        let payload = await sc.provision(Test.DELIVID0, [person2.id]);
        expect(payload.success).to.not.be.undefined;
        expect((<ActionPayload>payload.success).status.status).to.equal(SDDMStatus[SDDMStatus.D0]);

        let allRepos = await rc.getReposForPerson(person2);
        expect(allRepos).to.have.lengthOf(1);
        let gradeR: GradePayload = {
            score:     65,
            comment:   'TESTCOMMENT',
            URL:       'TESTURL',
            timestamp: Date.now()
        };
        let grade = await gc.createGrade(allRepos[0].id, Test.DELIVID0, gradeR);
        expect(grade).to.be.true;

        // prepare person3
        let person3 = await pc.createPerson(data.PERSON3);
        expect(person3).to.not.be.null;
        // create d0 payload for person2
        payload = await sc.provision(Test.DELIVID0, [person3.id]);
        expect(payload.success).to.not.be.undefined;
        expect((<ActionPayload>payload.success).status.status).to.equal(SDDMStatus[SDDMStatus.D0]);

        // create d0 grade for person2
        allRepos = await rc.getReposForPerson(person3);
        expect(allRepos).to.have.lengthOf(1);
        gradeR = {
            score:     70,
            comment:   '',
            URL:       '',
            timestamp: Date.now()
        };
        grade = await gc.createGrade(allRepos[0].id, Test.DELIVID0, gradeR);
        expect(grade).to.be.true;


        // try to upgrade them to d1
        Log.test('Updating to d1');
        payload = await sc.provision(Test.DELIVID1, [person2.id, person3.id]);
        expect(payload.success).to.not.be.undefined;
        expect(payload.failure).to.be.undefined;
        const status = (<ActionPayload>payload.success).status;
        expect(status.status).to.equal(SDDMStatus[SDDMStatus.D1]);
        Log.test((<ActionPayload>payload).message);

        allRepos = await rc.getReposForPerson(person2);
        expect(allRepos).to.have.lengthOf(2);

        // expect(allRepos[0].custom.d0enabled).to.be.true;
        // expect(allRepos[0].custom.d1enabled).to.be.false;

        let allTeams = await tc.getTeamsForPerson(person2);
        expect(allTeams).to.have.lengthOf(2);
        // expect(allTeams[0].custom.sdmmd0).to.be.true;
        // expect(allTeams[0].custom.sdmmd1).to.be.false;
    });


});
