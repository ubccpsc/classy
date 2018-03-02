import {ResponsePayload, SDDMController} from "../src/controllers/SDDMController";
import {expect} from "chai";
import "mocha";
import {GradesController} from "../src/controllers/GradesController";
import {RepositoryController} from "../src/controllers/RepositoryController";
import {TeamController} from "../src/controllers/TeamController";
import {PersonController} from "../src/controllers/PersonController";
import {Test} from "./GlobalSpec";
import {TestGitHubController} from "../src/controllers/GitHubController";
import Log from "../src/util/Log";
import {Person} from "../src/Types";

const loadFirst = require('./GlobalSpec');

describe("SDDMController", () => {

    let sc: SDDMController;
    let gc: GradesController;
    let tc: TeamController;
    let rc: RepositoryController;
    let pc: PersonController;

    // NOTE: does not use the Test. values on purpose to make it easier
    // to validate status without having to nuke the db first
    const TEAMD0 = "sddmd0test";
    const TEAMD1 = "sddmd1test";

    const REPOD0 = "sddmd0repotest";
    const REPOD1 = "sddmd1repotest";

    const USER = "sddmdusertest";

    const PRNAME = "prd3id";

    const u1 = "sddmU1";
    const u2 = "sddmU2";
    const u3 = "sddmU3";


    let PERSON1: Person = null;
    let PERSON2: Person = null;
    let PERSON3: Person = null;

    before(async () => {
        PERSON1 = {
            id:            u1,
            csId:          u1, // sdmm doesn't have these
            githubId:      u1,
            studentNumber: null,

            org:    Test.ORGNAME,
            fName:  '',
            lName:  '',
            kind:   'student',
            url:    'https://github.com/' + u1,
            labId:  'UNKNOWN',
            custom: {}
        };

        PERSON2 = {
            id:            u2,
            csId:          u2, // sdmm doesn't have these
            githubId:      u2,
            studentNumber: null,

            org:    Test.ORGNAME,
            fName:  '',
            lName:  '',
            kind:   'student',
            url:    'https://github.com/' + u2,
            labId:  'UNKNOWN',
            custom: {}
        };

        PERSON3 = {
            id:            u3,
            csId:          u3, // sdmm doesn't have these
            githubId:      u3,
            studentNumber: null,

            org:    Test.ORGNAME,
            fName:  '',
            lName:  '',
            kind:   'student',
            url:    'https://github.com/' + u3,
            labId:  'UNKNOWN',
            custom: {}
        };
    });

    beforeEach(() => {
        sc = new SDDMController(new TestGitHubController());
        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
    });

    it("Should be able to get a D0PRE status.", async () => {
        await sc.handleUnknownUser(Test.ORGNAME, USER); // provision user

        await pc.getPerson(Test.ORGNAME, USER); // get user

        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0PRE");
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
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0PRE");

        const person = await pc.getPerson(Test.ORGNAME, USER);
        const team = await tc.createTeam(Test.ORGNAME, TEAMD0, [person], {sdmmd0: true});
        const repo = await rc.createRepository(Test.ORGNAME, REPOD0, [team], {d0enabled: true});
        expect(repo).to.not.be.null;

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0");
    });

    it("Should be able to get a D1UNLOCKED status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0");

        await gc.createGrade(Test.ORGNAME, REPOD0, "d0", 59, '', '');
        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0"); // 59 is too low

        await gc.createGrade(Test.ORGNAME, REPOD0, "d0", 61, '', '');
        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1UNLOCKED");
    });

    it("Should be able to get a D1TEAMSET status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1UNLOCKED");

        const person = await pc.getPerson(Test.ORGNAME, USER);
        const team = await tc.createTeam(Test.ORGNAME, TEAMD1, [person], {sdmmd1: true});
        expect(team).to.not.be.null;

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1TEAMSET");
    });

    it("Should be able to get a D1 status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1TEAMSET");

        const team = await tc.getTeam(Test.ORGNAME, TEAMD1);
        const repo = await rc.createRepository(Test.ORGNAME, REPOD1, [team], {d1enabled: true});
        expect(repo).to.not.be.null;

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1");
    });

    it("Should be able to get a D2 status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1");

        await gc.createGrade(Test.ORGNAME, REPOD1, "d1", 59, '', '');
        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1"); // 59 is too low

        await gc.createGrade(Test.ORGNAME, REPOD1, "d1", 61, '', '');

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D2");
    });

    it("Should be able to get a D3PRE status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D2");

        await gc.createGrade(Test.ORGNAME, REPOD1, "d2", 59, '', '');
        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D2"); // 59 is too low

        await gc.createGrade(Test.ORGNAME, REPOD1, "d2", 61, '', '');

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D3PRE");
    });

    it("Should be able to get a D3 status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D3PRE");

        const repo = await rc.createPullRequest(Test.ORGNAME, REPOD1, PRNAME, {sddmD3pr: true});
        expect(repo).to.not.be.null;
        expect(repo.custom.sddmD3pr).to.be.true;

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D3");
    });

    it("Should not be able to provision a d0 repo for a random person.", async () => {
        let payload = await sc.provision(Test.ORGNAME, Test.DELIVID0, ["this is a random name #@"]);
        expect(payload.success).to.be.false;
        Log.test(payload.message);
    });

    /**
     *
     *
     * Provisioning tests. These do need to run in order.
     *
     *
     */

    it("Should not allow multiple people to be added to a d0 repo.", async () => {
        let person = await pc.createPerson(PERSON1);
        expect(person).to.not.be.null;

        let person2 = await pc.createPerson(PERSON2);
        expect(person2).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.be.empty;

        // don't provision for non-existent users
        let payload = await sc.provision(Test.ORGNAME, Test.DELIVID0, [PERSON1.id, '23234#$Q#@#invalid']);
        expect(payload.success).to.be.false;
        Log.test(payload.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        // don't create a d0 repo with multiple people
        payload = await sc.provision(Test.ORGNAME, Test.DELIVID0, [PERSON1.id, PERSON2.id]);
        expect(payload.success).to.be.false;
        Log.test(payload.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;
    });

    it("Should be able to provision a d0 repo for an individual.", async () => {
        let person = await pc.getPerson(PERSON1.org, PERSON1.id);
        expect(person).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.be.empty;

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.be.empty;

        let payload = await sc.provision(Test.ORGNAME, Test.DELIVID0, [PERSON1.id]);
        expect(payload.success).to.be.true;
        Log.test(payload.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);
        expect(allRepos[0].custom.d0enabled).to.be.true;

        allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(1);
        expect(allTeams[0].custom.sdmmd0).to.be.true;
    });


    it("Should not upgrade a d0 repo for an individual if the grade is too low.", async () => {
        let person = await pc.getPerson(PERSON1.org, PERSON1.id);
        expect(person).to.not.be.null;

        let payload = await sc.provision(Test.ORGNAME, Test.DELIVID1, [PERSON1.id]);
        expect(payload.success).to.be.false;
        Log.test(payload.message);

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
        let person = await pc.getPerson(PERSON1.org, PERSON1.id);
        expect(person).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);

        let grade = await gc.createGrade(PERSON1.org, allRepos[0].id, Test.DELIVID0, 65, 'TESTCOMMENT', 'TESTURL');
        expect(grade).to.be.true;

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1);
        expect(allRepos[0].custom.d0enabled).to.be.true;
        expect(allRepos[0].custom.d1enabled).to.be.false;

        Log.test('provisioning');
        let payload = await sc.provision(Test.ORGNAME, Test.DELIVID1, [PERSON1.id]); // do it
        Log.test('provisioning complete');
        expect(payload.success).to.be.true;
        Log.test(payload.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1); // no new repo
        expect(allRepos[0].custom.d0enabled).to.be.true;
        expect(allRepos[0].custom.d1enabled).to.be.true; // should be provisioned for d1 now

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(1);
        expect(allTeams[0].custom.sdmmd0).to.be.true;
        expect(allTeams[0].custom.sdmmd1).to.be.true; // should be provisioned for d1 now

        // try to do it again (should fail)  // makes sure they can't get multiple d1 repos
        payload = await sc.provision(Test.ORGNAME, Test.DELIVID1, [PERSON1.id]); // do it
        expect(payload.success).to.be.false;
        Log.test(payload.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(1); // no new repo
    });


    it("Should not be able to form a d1 team if a member does not exist or has insufficient d0 standing.", async () => {
        let person = await pc.getPerson(PERSON2.org, PERSON2.id); // person2; person1 has a d1 repo from previous upgrade
        expect(person).to.not.be.null;

        let allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0); // no new repo

        // don't allow pairing with someone who doesn't exist
        let payload = await sc.provision(Test.ORGNAME, Test.DELIVID1, [PERSON2.id, "asdf32#@@#INVALIDPERSON"]);
        expect(payload.success).to.be.false; // person2 doesn't exist
        Log.test("User shouldn't exist: " + payload.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0);
        // expect(allRepos[0].custom.d0enabled).to.be.true;
        // expect(allRepos[0].custom.d1enabled).to.be.false;

        let allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(0);
        // expect(allTeams[0].custom.sdmmd0).to.be.true;
        // expect(allTeams[0].custom.sdmmd1).to.be.false;

        // don't allow pairing with someone with insufficient d0 credit
        payload = await sc.provision(Test.ORGNAME, Test.DELIVID1, [PERSON2.id, PERSON3.id]);
        expect(payload.success).to.be.false; // person2 doesn't exist
        Log.test("User's d0 grade is insufficient: " + payload.message);

        allRepos = await rc.getReposForPerson(person);
        expect(allRepos).to.have.lengthOf(0);
        // expect(allRepos[0].custom.d0enabled).to.be.true;
        // expect(allRepos[0].custom.d1enabled).to.be.false;

        allTeams = await tc.getTeamsForPerson(person);
        expect(allTeams).to.have.lengthOf(0);
        // expect(allTeams[0].custom.sdmmd0).to.be.true;
        // expect(allTeams[0].custom.sdmmd1).to.be.false;
    });


    it("Should be able to form a d1 team with a partner.", async () => {
        // prepare person 2
        let person2 = await pc.getPerson(PERSON2.org, PERSON2.id);
        expect(person2).to.not.be.null;
        let payload = await sc.provision(Test.ORGNAME, Test.DELIVID0, [person2.id]);
        expect(payload.success).to.be.true;
        let allRepos = await rc.getReposForPerson(person2);
        expect(allRepos).to.have.lengthOf(1);
        let grade = await gc.createGrade(person2.org, allRepos[0].id, Test.DELIVID0, 65, 'TESTCOMMENT', 'TESTURL');
        expect(grade).to.be.true;

        // prepare person3
        let person3 = await pc.createPerson(PERSON3);
        expect(person3).to.not.be.null;
        // create d0 payload for person2
        payload = await sc.provision(Test.ORGNAME, Test.DELIVID0, [person3.id]);
        expect(payload.success).to.be.true;
        // create d0 grade for person2
        allRepos = await rc.getReposForPerson(person3);
        expect(allRepos).to.have.lengthOf(1);
        grade = await gc.createGrade(person3.org, allRepos[0].id, Test.DELIVID0, 70, 'TESTCOMMENT', 'TESTURL');
        expect(grade).to.be.true;


        // try to upgrade them to d1
        Log.test('Updating to d1');
        payload = await sc.provision(Test.ORGNAME, Test.DELIVID1, [person2.id, person3.id]);
        expect(payload.success).to.be.true;
        Log.test(payload.message);

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
