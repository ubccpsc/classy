import {expect} from "chai";
import "mocha";

import Config, {ConfigCourses, ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {AutoTestGradeTransport, GradeTransport, StudentTransport, TeamTransport} from "../../../../common/types/PortalTypes";

import {CourseController} from "../../src/controllers/CourseController";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {GitHubActions, IGitHubActions} from "../../src/controllers/GitHubActions";
import {GitHubController} from "../../src/controllers/GitHubController";
import {GradesController} from "../../src/controllers/GradesController";
import {PersonController} from "../../src/controllers/PersonController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {Factory} from "../../src/Factory";
import {Person, Repository, Team} from "../../src/Types";
import {Test} from "../GlobalSpec";

import '../GlobalSpec'; // load first
import './GradeControllerSpec'; // load first

describe("CourseController", () => {

    let cc: CourseController;
    let gc: GradesController;
    let tc: TeamController;
    let rc: RepositoryController;
    let pc: PersonController;
    let dc: DeliverablesController;
    let gha: IGitHubActions;

    before(async () => {
        await Test.suiteBefore('CourseController');
        await clearAndPrepareAll();
    });

    beforeEach(() => {
        gha = GitHubActions.getInstance(true);
        const ghInstance = new GitHubController(gha);
        cc = Factory.getCourseController(ghInstance);

        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
        dc = new DeliverablesController();
    });

    after(async () => {
        Test.suiteAfter('CourseController');
    });

    async function clearAndPrepareAll(): Promise<void> {
        // clear objects
        const dbc = DatabaseController.getInstance();
        await dbc.clearData();

        // TODO: clear github teams and repositories we need

        await Test.prepareAll();
    }

    async function clearAndPreparePartial(): Promise<void> {
        // clear objects
        const dbc = DatabaseController.getInstance();
        await dbc.clearData();

        // clear github teams and repositories we will end up provisioning
        await gha.deleteRepo(Test.REPONAMEREAL);
        await gha.deleteRepo('d0_' + Test.USERNAMEGITHUB1 + '_' + Test.USERNAMEGITHUB2);
        await gha.deleteRepo('d0_' + Test.USERNAMEGITHUB3);
        await gha.deleteRepo(Test.REPONAME1);
        await gha.deleteRepo(Test.REPONAME2);

        let teamNum = await gha.getTeamNumber('t_d0_' + Test.USERNAMEGITHUB1 + '_' + Test.USERNAMEGITHUB2);
        await gha.deleteTeam(teamNum);
        teamNum = await gha.getTeamNumber('t_d0_' + Test.USERNAMEGITHUB3);
        await gha.deleteTeam(teamNum);
        teamNum = await gha.getTeamNumber(Test.TEAMNAMEREAL);
        await gha.deleteTeam(teamNum);

        await Test.prepareDeliverables();

        const p1: Person = Test.createPerson(Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB1, 'student');
        await dbc.writePerson(p1);
        const p2 = Test.createPerson(Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB2, 'student');
        await dbc.writePerson(p2);
        const p3 = Test.createPerson(Test.USERNAMEGITHUB3, Test.USERNAMEGITHUB3, Test.USERNAMEGITHUB3, 'student');
        await dbc.writePerson(p3);

        const d0 = await dbc.getDeliverable(Test.DELIVID0);
        const names = await cc.computeNames(d0, [p1, p2]);

        const t = await Test.createTeam(names.teamName, Test.DELIVID0, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        await dbc.writeTeam(t);
    }

    it("Should be able to get the config name.", async () => {
        const res = await CourseController.getName();
        expect(res).to.equal(ConfigCourses.classytest);
    });

    it("Should not be able to get a user that doesn't exist.", async () => {
        const USERNAME = "UNKNOWNUSER" + new Date().getTime();
        const res = await cc.handleUnknownUser(USERNAME);
        expect(res).to.equal(null); // nothing should be returned

        const person = await pc.getPerson(USERNAME); // get user
        expect(person).to.equal(null); // should not exist
    });

    it("Should be able to get a list of students.", async () => {

        const res = await cc.getStudents();
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);

        const s: StudentTransport = {
            firstName:  'first_' + Test.USER1.id,
            lastName:   'last_' + Test.USER1.id,
            id:         Test.USER1.id,
            githubId:   Test.USER1.github,
            userUrl:    Config.getInstance().getProp(ConfigKey.githubHost) + '/' + Test.USER1.github,
            studentNum: null,
            labId:      'l1a'
        };

        expect(res).to.deep.include(s); // make sure at least one student with the right format is in there
    });

    it("Should be able to get a list of teams.", async () => {
        const res = await cc.getTeams();
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);

        Log.test('teams: ' + JSON.stringify(res));
        const t: TeamTransport = {
            id:      Test.TEAMNAME1,
            delivId: "d0",
            people:  [Test.USER1.id, Test.USER2.id],
            URL:     null
        };
        expect(res).to.deep.include(t); // make sure at least one student with the right format is in there
    });

    it("Should be able to get a list of grades.", async () => {
        const res = await cc.getGrades();
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);

        // Log.test('grades: ' + JSON.stringify(res));
        const url = Config.getInstance().getProp(ConfigKey.githubHost) + '/' + Test.USER2.github;
        const id = Test.USER2.id;
        const t: GradeTransport = {
            personId:  id,
            personURL: url,
            delivId:   "d1",
            score:     100,
            comment:   "comment",
            urlName:   "urlName",
            URL:       "URL",
            timestamp: 1517446860000,
            custom:    {}
        };
        expect(res).to.deep.include(t); // make sure at least one student with the right format is in there
    });

    it("Should be able to get a list of results with wildcards.", async () => {
        const res = await cc.getResults('any', 'any');
        expect(res).to.be.an('array');
        expect(res.length).to.equal(20);
    });

    it("Should be able to get a list of results without wildcards.", async () => {
        const res = await cc.getResults(Test.DELIVID0, Test.REPONAME1);
        expect(res).to.be.an('array');
        expect(res.length).to.equal(10);
    });

    it("Should be able to get a list of results with partial wildcards.", async () => {
        // doesn't really work with the result tuples we have...
        const res = await cc.getResults('any', Test.REPONAME1);
        expect(res).to.be.an('array');
        expect(res.length).to.equal(10);
    });

    it("Should be able to get a list of repositories.", async () => {
        const res = await cc.getRepositories();

        // Log.test(JSON.stringify(res));
        expect(res).to.be.an('array');
        expect(res).to.have.lengthOf(2);
        expect(res[0].id).to.be.an('string');
        expect(res[0].URL).to.not.be.undefined;
    });

    it("Should be able to get a list of deliverables.", async () => {

        const res = await cc.getDeliverables();
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);

        // const e = { // : DeliverableTransport only partial so type skipped
        //     id: 'd1',
        //
        //     url:            'http://NOTSET',
        //     gradesReleased: false,
        //
        //     minTeamSize:       1,
        //     maxTeamSize:       2,
        //     teamsSameLab:      true,
        //     studentsFormTeams: true
        //
        // };

        // Log.test(JSON.stringify(res));
        // expect(res).to.deep.include(d); // make sure at least one deliverable with the right format is in there
    });

    it("Should be able to handle a new AutoTest grade.", async () => {

        const grade: AutoTestGradeTransport = {
            delivId: 'd0',

            score:   100, // grade: < 0 will mean 'N/A' in the UI
            comment: '', // simple grades will just have a comment

            urlName: 'commitName', // description to go with the URL (repo if exists)
            URL:     'commitUrl', // commit URL if known, otherwise repo URL (commit / repo if exists)

            timestamp: Date.now(), // even if grade < 0 might as well return when the entry was made
            custom:    {},

            repoId:  Test.REPONAME1,
            repoURL: 'repoUrl'
        };

        const res = await cc.processNewAutoTestGrade(grade);
        expect(res).to.be.an('boolean');
        expect(res).to.be.true;
    });

    it("Should fail to handle a new AutoTest grade if the repoId is invalid.", async () => {

        const grade: AutoTestGradeTransport = {
            delivId: 'd0',

            score:   100, // grade: < 0 will mean 'N/A' in the UI
            comment: '', // simple grades will just have a comment

            urlName: 'commitName', // description to go with the URL (repo if exists)
            URL:     'commitUrl', // commit URL if known, otherwise repo URL (commit / repo if exists)

            timestamp: Date.now(), // even if grade < 0 might as well return when the entry was made
            custom:    {},

            repoId:  'INVALIDID',
            repoURL: 'repoUrl'
        };

        const res = await cc.processNewAutoTestGrade(grade);
        expect(res).to.be.an('boolean');
        expect(res).to.be.false;
    });

    it("Should be able to get the course object.", async () => {
        const res = await cc.getCourse();

        expect(res).to.be.an('object');
        expect(res.id).to.be.an('string');
        expect(res.defaultDeliverableId).to.not.be.undefined;
        expect(res.custom).to.be.an('object');
    });

    it("Should be able to update the course object.", async () => {
        const NEWID = Date.now() + 'id';
        const res = await cc.getCourse();
        expect(res.defaultDeliverableId).to.not.equal(NEWID);

        res.defaultDeliverableId = NEWID;
        (res.custom as any).fooProperty = 'asdfasdf';
        await cc.saveCourse(res);

        const newRes = await cc.getCourse();
        expect(newRes.defaultDeliverableId).to.equal(NEWID);
        expect((newRes.custom as any).fooProperty).to.equal('asdfasdf');

        // reset course id
        res.defaultDeliverableId = null;
        delete (res.custom as any).fooProperty;
        await cc.saveCourse(res);
    });

    it("Should not be able to validate an invalid course object.", function() {
        let res = null;
        try {
            CourseController.validateCourseTransport(null);
            res = 'NOT THROWN';
        } catch (err) {
            res = 'THROW CAUGHT';
        }
        expect(res).to.equal('THROW CAUGHT');

        let course: any = {id: 'foo'};
        res = CourseController.validateCourseTransport(course);
        expect(res).to.not.be.null;
        expect(res).to.be.an('string');

        course = {id: 'foo', defaultDeliverableId: 'bar'};
        res = CourseController.validateCourseTransport(course);
        expect(res).to.not.be.null;
        expect(res).to.be.an('string');
    });

    it("Should be able to compute a team and repo name.", async () => {
        const db = DatabaseController.getInstance();

        const tExpected = 't_d0_' + Test.USER1.github + '_' + Test.USER2.github;
        const rExpected = 'd0_' + Test.USER1.github + '_' + Test.USER2.github;

        // prepare
        const dbc = DatabaseController.getInstance();
        await dbc.deleteRepository({id: rExpected} as Repository);
        await dbc.deleteTeam({id: tExpected} as Team);

        const deliv = await db.getDeliverable(Test.DELIVID0);
        const p1 = await db.getPerson(Test.USER1.id);
        const p2 = await db.getPerson(Test.USER2.id);

        let res = await cc.computeNames(deliv, [p1, p2]);

        expect(res.teamName).to.equal(tExpected);
        expect(res.repoName).to.equal(rExpected);

        // make those teams
        const t = await Test.createTeam(res.teamName, deliv.id, []);
        await db.writeTeam(t);
        const r = await Test.createRepository(res.repoName, deliv.id, res.teamName);
        await db.writeRepository(r);

        // make sure the bar has been raised
        res = await cc.computeNames(deliv, [p1, p2]);
        expect(res.teamName).to.equal(tExpected);
        expect(res.repoName).to.equal(rExpected);
    });

    describe("Slow CourseController Tests", () => {

        // before(async function() {
        //     await clearAndPreparePartial();
        // });

        beforeEach(function() {
            const exec = Test.runSlowTest();
            if (exec) {
                Log.test("CourseControllerSpec::slowTests - running: " + this.currentTest.title);
            } else {
                Log.test("CourseControllerSpec::slowTests - skipping; will run on CI");
                this.skip();
            }
        });

        it("Should provision repos if there are some to do and singles are disabled.", async () => {
            await clearAndPreparePartial();

            const allRepos = await rc.getAllRepos();
            expect(allRepos.length).to.equal(0);

            const allTeams = await tc.getAllTeams();
            expect(allTeams.length).to.equal(1);
            expect(allTeams[0].URL).to.be.null; // not provisioned yet

            const d0 = await dc.getDeliverable(Test.DELIVID0);
            const res = await cc.provision(d0, false);
            Log.test("provisioned: " + JSON.stringify(res));
            expect(res).to.be.an('array');
            expect(res.length).to.equal(1);

            const allNewRepos = await rc.getAllRepos();
            const allNewTeams = await tc.getAllTeams();

            expect(allNewRepos.length).to.equal(1);
            expect(allNewTeams.length).to.equal(1);

            const teamNum = await gha.getTeamNumber(allNewTeams[0].id);
            expect(teamNum).to.be.greaterThan(0); // should be provisioned

            const repoExists = await gha.repoExists(allNewRepos[0].id);
            expect(repoExists).to.be.true; // should be provisioned

            expect(allNewTeams[0].URL).to.not.be.null; // team was used, but repo was only provisioned, not released
            expect(allNewRepos[0].URL).to.not.be.null;
        }).timeout(Test.TIMEOUTLONG);

        it("Should release repos.", async () => {
            // await clearAndPreparePartial();
            const allRepos = await rc.getAllRepos();
            expect(allRepos.length).to.equal(1);
            expect(allRepos[0].URL).to.not.be.null; // provisioned

            const allTeams = await tc.getAllTeams();
            expect(allTeams.length).to.equal(1);
            expect(allTeams[0].URL).to.not.be.null; // provisioned

            const d0 = await dc.getDeliverable(Test.DELIVID0);
            let res = await cc.release(d0);

            Log.test("released: " + JSON.stringify(res));
            expect(res).to.be.an('array');
            expect(res.length).to.equal(1);

            const allNewTeams = await tc.getAllTeams();
            expect(allNewTeams.length).to.equal(1);
            expect(allNewTeams[0].custom.githubAttached).to.be.true;

            // try again: should not release any more repos
            res = await cc.release(d0);
            Log.test("released: " + JSON.stringify(res));
            expect(res).to.be.an('array');
            expect(res.length).to.equal(0);
        }).timeout(Test.TIMEOUTLONG);

        it("Should provision repos if singles are enabled.", async () => {
            await clearAndPreparePartial();

            const allRepos = await rc.getAllRepos();
            const allTeams = await tc.getAllTeams();

            expect(allRepos.length).to.equal(0);
            expect(allTeams.length).to.equal(1);
            let teamNum = await gha.getTeamNumber(allTeams[0].id);
            expect(teamNum).to.be.lessThan(0); // should not be provisioned yet

            const d0 = await dc.getDeliverable(Test.DELIVID0);
            const res = await cc.provision(d0, true);
            Log.test("provisioned: " + JSON.stringify(res));
            expect(res).to.be.an('array');
            expect(res.length).to.equal(2);

            const allNewRepos = await rc.getAllRepos();
            const allNewTeams = await tc.getAllTeams();

            expect(allNewRepos.length).to.equal(2);
            expect(allNewTeams.length).to.equal(2);

            teamNum = await gha.getTeamNumber(allNewTeams[0].id);
            expect(teamNum).to.be.greaterThan(0); // should be provisioned

            teamNum = await gha.getTeamNumber(allNewTeams[1].id);
            expect(teamNum).to.be.greaterThan(0); // should be provisioned

            let repoExists = await gha.repoExists(allNewRepos[0].id);
            expect(repoExists).to.be.true; // should be provisioned

            repoExists = await gha.repoExists(allNewRepos[1].id);
            expect(repoExists).to.be.true; // should be provisioned

            expect(allNewRepos[0].URL).to.not.be.null;
            expect(allNewRepos[1].URL).to.not.be.null;

            expect(allNewTeams[0].URL).to.not.be.null;
            expect(allNewTeams[1].URL).to.not.be.null;
        }).timeout(Test.TIMEOUTLONG * 5);

        it("Should not provision any new repos if nothing has changed.", async () => {
            // await clearAndPreparePartial();

            const allRepos = await rc.getAllRepos();
            const allTeams = await tc.getAllTeams();

            expect(allRepos.length).to.equal(2);
            expect(allTeams.length).to.equal(2);

            const d0 = await dc.getDeliverable(Test.DELIVID0);
            const res = await cc.provision(d0, true);
            Log.test("provisioned: " + JSON.stringify(res));
            expect(res).to.be.an('array');
            expect(res.length).to.equal(0);

            const allNewRepos = await rc.getAllRepos();
            const allNewTeams = await tc.getAllTeams();

            expect(allNewRepos.length).to.equal(2);
            expect(allNewTeams.length).to.equal(2);
        }).timeout(Test.TIMEOUTLONG * 5);
    });
});
