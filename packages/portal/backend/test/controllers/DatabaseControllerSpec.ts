import {expect} from "chai";
import "mocha";
import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {Test} from "../../../../common/TestHarness";

import {DatabaseController} from "../../src/controllers/DatabaseController";
import {PersonKind} from "../../src/Types";

import '../GlobalSpec';

/**
 * This suite seems like a lot of boilerplate, but is crucial to make sure the
 * datastore works correctly in case we need to swap to something else in the
 * future (e.g., not mongo).
 *
 * While all the other tests implicitly hit this, it would be nice to know
 * directly if we have a datastore problem.
 *
 */
describe("DatabaseController", () => {

    let dc: DatabaseController;

    before(async () => {
        await Test.suiteBefore('DatabaseController');
    });

    beforeEach(() => {
        dc = DatabaseController.getInstance();
    });

    after(async () => {
        Test.suiteAfter('DatabaseController');
    });

    function expectEmptyArray(records: any) {
        expect(records).to.not.be.null;
        expect(records).to.be.an('array');
        expect(records).to.have.lengthOf(0);
    }

    it("Should not be able to get an invalid person by id.", async () => {
        const person = await dc.getPerson(Test.INVALIDUSER1.id);
        expect(person).to.be.null;
    });

    it("Should not fail when deleting a null person.", async () => {
        const res = await dc.deletePerson(null);
        expect(res).to.be.false;
    });

    it("Should not be able to get an invalid person by githubId.", async () => {
        const person = await dc.getGitHubPerson(Test.INVALIDUSER1.github);
        expect(person).to.be.null;
    });

    it("Should not be able to get an invalid deliverable by id.", async () => {
        const deliv = await dc.getDeliverable('invalidDelivId');
        expect(deliv).to.be.null;
    });

    it("Should not be able to get an invalid repo by id.", async () => {
        const repo = await dc.getRepository('invalidRepoId');
        expect(repo).to.be.null;
    });

    it("Should not fail when deleting a null repository.", async () => {
        const res = await dc.deleteRepository(null);
        expect(res).to.be.false;
    });

    it("Should not be able to get an invalid team by id.", async () => {
        const team = await dc.getTeam('invalidTeamId');
        expect(team).to.be.null;
    });

    it("Should not fail when deleting a null team.", async () => {
        const res = await dc.deleteTeam(null);
        expect(res).to.be.false;
    });

    it("Should not be able to get an invalid auth by personId.", async () => {
        const auth = await dc.getAuth(Test.INVALIDUSER1.id);
        expect(auth).to.be.null;
    });

    it("Should not fail when deleting a null auth.", async () => {
        const res = await dc.deleteAuth(null);
        expect(res).to.be.false;
    });

    it("Should not be able to get an invalid result.", async () => {
        const result = await dc.getResult('invalidDeliv', 'invalidRepo', 'invalidSHA' + Date.now());
        expect(result).to.be.null;
    });

    it("Should not be able to get an invalid result URL.", async () => {
        const result = await dc.getResultFromURL('invalidURL' + Date.now(), Test.DELIVID0);
        expect(result).to.be.null;
    });

    it("Should not be able to get an invalid grade.", async () => {
        const grade = await dc.getGrade(Test.INVALIDUSER1.id, 'invalidDeliv');
        expect(grade).to.be.null;
    });

    it("Should not be able to get a course record when it hasn't been stored.", async () => {
        const cr = await dc.getCourseRecord();
        expect(cr).to.be.null;
    });

    it("Should be able to get a list of repositories when there are none.", async () => {
        const repos = await dc.getRepositories();
        expectEmptyArray(repos);
    });

    it("Should be able to get a list of deliverables when there are none.", async () => {
        const delivs = await dc.getDeliverables();
        expectEmptyArray(delivs);
    });

    it("Should be able to get a list of grades when there are none.", async () => {
        const grades = await dc.getGrades();
        expectEmptyArray(grades);
    });

    it("Should be able to get a list of teams when there are none.", async () => {
        const teams = await dc.getTeams();
        expect(teams).to.have.lengthOf(3); // default teams: 'admin', 'staff', 'students'
        // expectEmptyArray(teams);
    });

    it("Should be able to get a list of people when there are none.", async () => {
        const people = await dc.getPeople();
        expectEmptyArray(people);
    });

    it("Should be able to get a list of results when there are none.", async () => {
        const results = await dc.getAllResults();
        expectEmptyArray(results);
    });

    it("Should be able to get a list teams for a person who is invalid.", async () => {
        const teams = await dc.getTeamsForPerson(Test.INVALIDUSER1.id);
        expectEmptyArray(teams);
    });

    it("Should be able to get a list repositories for a person who is invalid.", async () => {
        const teams = await dc.getRepositoriesForPerson(Test.INVALIDUSER1.id);
        expectEmptyArray(teams);
    });

    // write new course record
    it("Should be able to write a course record.", async () => {
        const cr = Test.createCourseRecord();
        const res = await dc.writeCourseRecord(cr);
        expect(res).to.be.true;
    });

    // read course record
    it("Should be able to read a course record.", async () => {
        const courseId = Config.getInstance().getProp(ConfigKey.name);

        const res = await dc.getCourseRecord();
        Log.test(JSON.stringify(res));
        expect(res).to.not.be.null;
        expect(res.id).to.equal(courseId);
    });

    // update course record
    it("Should be able to update the course record.", async () => {
        const courseId = Config.getInstance().getProp(ConfigKey.name);

        let res = await dc.getCourseRecord();
        expect(res.id).to.equal(courseId);
        expect(res.defaultDeliverableId).to.be.null;
        expect((res.custom as any).foo).to.be.undefined;

        (res.custom as any).foo = true;
        res.defaultDeliverableId = Test.DELIVID0;
        const worked = await dc.writeCourseRecord(res);
        expect(worked).to.be.true;

        res = await dc.getCourseRecord();
        expect(res.id).to.equal(courseId);
        expect(res.defaultDeliverableId).to.equal(Test.DELIVID0);
        expect((res.custom as any).foo).to.be.true;
    });

    // write new deliverable
    it("Should be able to write a deliverable.", async () => {
        const record = Test.createDeliverable(Test.DELIVID0);
        const res = await dc.writeDeliverable(record);
        expect(res).to.be.true;
    });

    // read deliverable
    it("Should be able to read a deliverable.", async () => {
        const res = await dc.getDeliverable(Test.DELIVID0);
        Log.test(JSON.stringify(res));
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.DELIVID0);
    });

    // update deliverable
    it("Should be able to update a deliverable.", async () => {
        let res = await dc.getDeliverable(Test.DELIVID0);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.DELIVID0);
        expect(res.visibleToStudents).to.be.true;
        expect((res.custom as any).foo).to.be.undefined;

        (res.custom as any).foo = true;
        res.visibleToStudents = false;
        const worked = await dc.writeDeliverable(res);
        expect(worked).to.be.true;

        res = await dc.getDeliverable(Test.DELIVID0);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.DELIVID0);
        expect(res.visibleToStudents).to.be.false;
        expect((res.custom as any).foo).to.be.true;
    });

    // write new person
    it("Should be able to write a person.", async () => {
        const record = Test.createPerson(Test.USER1.id, Test.USER1.csId, Test.USER1.github, PersonKind.STUDENT);
        const res = await dc.writePerson(record);
        expect(res).to.be.true;
    });

    // read person
    it("Should be able to read a person.", async () => {
        const res = await dc.getPerson(Test.USER1.id);
        Log.test(JSON.stringify(res));
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.USER1.id);
    });

    // delete person
    it("Should be able to delete a person.", async () => {
        let res = await dc.getPerson(Test.USER1.id);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.USER1.id);

        const worked = await dc.deletePerson(res);
        expect(worked).to.be.true;

        // verify they are deleted
        res = await dc.getPerson(Test.USER1.id);
        expect(res).to.be.null;
    });

    // update person
    it("Should be able to update a person.", async () => {
        // get the person in there
        const record = Test.createPerson(Test.USER1.id, Test.USER1.csId, Test.USER1.github, PersonKind.STUDENT);
        await dc.writePerson(record);

        let res = await dc.getPerson(Test.USER1.id);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.USER1.id);
        expect(res.githubId).to.equal(Test.USER1.github);
        expect((res.custom as any).foo).to.be.undefined;

        (res.custom as any).foo = true;
        res.githubId = 'newGHid';
        const worked = await dc.writePerson(res);
        expect(worked).to.be.true;

        res = await dc.getPerson(Test.USER1.id);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.USER1.id);
        expect(res.githubId).to.equal('newGHid');
        expect((res.custom as any).foo).to.be.true;
    });

    // write new team
    it("Should be able to write a team.", async () => {
        // prep
        const p2 = Test.createPerson(Test.USER2.id, Test.USER2.csId, Test.USER2.github, PersonKind.STUDENT);
        let res = await dc.writePerson(p2);
        expect(res).to.be.true;

        const team = await Test.createTeam(Test.TEAMNAME1, Test.DELIVID0, [Test.USER1.id, Test.USER2.id]);
        res = await dc.writeTeam(team);
        expect(res).to.be.true;
    });

    // read team
    it("Should be able to read a team.", async () => {
        const res = await dc.getTeam(Test.TEAMNAME1);
        Log.test(JSON.stringify(res));
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.TEAMNAME1);
    });

    // delete team
    it("Should be able to delete a team.", async () => {
        let res = await dc.getTeam(Test.TEAMNAME1);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.TEAMNAME1);

        const worked = await dc.deleteTeam(res);
        expect(worked).to.be.true;

        // verify they are deleted
        res = await dc.getTeam(Test.TEAMNAME1);
        expect(res).to.be.null;
    });

    // update team
    it("Should be able to update a team.", async () => {
        // get the person in there
        const team = await Test.createTeam(Test.TEAMNAME1, Test.DELIVID0, [Test.USER1.id, Test.USER2.id]);
        await dc.writeTeam(team);

        let res = await dc.getTeam(Test.TEAMNAME1);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.TEAMNAME1);
        expect(res.URL).to.equal(null);
        expect((res.custom as any).foo).to.be.undefined;

        (res.custom as any).foo = true;
        res.URL = 'newURL';
        const worked = await dc.writeTeam(res);
        expect(worked).to.be.true;

        res = await dc.getTeam(Test.TEAMNAME1);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.TEAMNAME1);
        expect(res.URL).to.equal('newURL');
        expect((res.custom as any).foo).to.be.true;
    });

    // write new repo
    it("Should be able to write a repository.", async () => {
        // prep
        // const p2 = Test.createPerson(Test.USER2.id, Test.USER2.csId, Test.USER2.github, 'student');
        // let res = await dbc.writePerson(p2);
        // expect(res).to.be.true;

        const repo = await Test.createRepository(Test.REPONAME1, Test.DELIVID0, Test.TEAMNAME1);
        const worked = await dc.writeRepository(repo);
        expect(worked).to.be.true;
    });

    // read repo
    it("Should be able to read a repository.", async () => {
        const res = await dc.getRepository(Test.REPONAME1);
        Log.test(JSON.stringify(res));
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.REPONAME1);
    });

    // delete repo
    it("Should be able to delete a repository.", async () => {
        let res = await dc.getRepository(Test.REPONAME1);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.REPONAME1);

        const worked = await dc.deleteRepository(res);
        expect(worked).to.be.true;

        // verify they are deleted
        res = await dc.getRepository(Test.REPONAME1);
        expect(res).to.be.null;
    });

    // update repository
    it("Should be able to update a repository.", async () => {
        // get the team in there
        const repo = await Test.createRepository(Test.REPONAME1, Test.DELIVID0, Test.TEAMNAME1);
        await dc.writeRepository(repo);

        let res = await dc.getRepository(Test.REPONAME1);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.REPONAME1);
        expect(res.URL).to.equal(null);
        expect((res.custom as any).foo).to.be.undefined;

        (res.custom as any).foo = true;
        res.URL = 'newURL';
        const worked = await dc.writeRepository(res);
        expect(worked).to.be.true;

        res = await dc.getRepository(Test.REPONAME1);
        expect(res).to.not.be.null;
        expect(res.id).to.equal(Test.REPONAME1);
        expect(res.URL).to.equal('newURL');
        expect((res.custom as any).foo).to.be.true;
    });

    // write new result
    // write new grade

    // read existing course record
    // read existing deliverable
    // read existing person
    // read existing team
    // read existing repo
    // read existing result
    // read existing grade

    // write existing course record
    // write existing deliverable
    // write existing person
    // write existing team
    // write existing repo
    // write existing result
    // write existing grade

    // repos for person with existing person
    // teams for person with existing person

    // delete existing auth
    // delete existing repo
    // delete existing team
    // delete existing person

});
