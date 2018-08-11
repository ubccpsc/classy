import {expect} from "chai";
import "mocha";
import Config, {ConfigCourses, ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {AutoTestGradeTransport, GradeTransport, TeamTransport} from "../../../../common/types/PortalTypes";

import {CourseController} from "../../src/controllers/CourseController";
import {TestGitHubController} from "../../src/controllers/GitHubController";
import {GradesController} from "../../src/controllers/GradesController";
import {PersonController} from "../../src/controllers/PersonController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {Test} from "../GlobalSpec";

import '../GlobalSpec'; // load first
import '../xRunLast/TestDatasetGeneratorSpec'; // load first
import './GradeControllerSpec'; // load first

export class TestData {
}

describe("CourseController", () => {

    let cc: CourseController;
    let gc: GradesController;
    let tc: TeamController;
    let rc: RepositoryController;
    let pc: PersonController;

    let data: TestData;

    beforeEach(() => {
        data = new TestData();

        const ghInstance = new TestGitHubController();
        cc = new CourseController(ghInstance);
        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
    });

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

        const s = {
            firstName:  'p1first',
            lastName:   'p1last',
            userName:   'p1',
            userUrl:    Config.getInstance().getProp(ConfigKey.githubHost) + '/p1',
            studentNum: 1,
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
            id:      "TESTteam1",
            delivId: "d0",
            people:  ["rthse2", "user2"],
            URL:     null
        };
        expect(res).to.deep.include(t); // make sure at least one student with the right format is in there
    });

    it("Should be able to get a list of grades.", async () => {
        const res = await cc.getGrades();
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);

        Log.test('grades: ' + JSON.stringify(res));
        const t: GradeTransport = {
            personId:  "rthse2",
            personURL: "https://github.com/rthse2",
            delivId:   "d1",
            score:     50,
            comment:   "commentup",
            urlName:   "urlName",
            URL:       "URLup",
            timestamp: 1517446860000,
            custom:    {}
        };
        expect(res).to.deep.include(t); // make sure at least one student with the right format is in there
    });

    it("Should be able to get a list of results.", async () => {
        const res = await cc.getResults('*', '*');
        expect(res).to.be.an('array');
        // expect(res.length).to.be.greaterThan(0);
        expect(res.length).to.equal(0); // TODO: insert some results!!!

        // Log.test('results: ' + JSON.stringify(res));
        // const t = res[0];
        // expect(res).to.deep.include(t); // make sure at least one student with the right format is in there
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

        const res = await cc.handleNewAutoTestGrade(grade);
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

        const res = await cc.handleNewAutoTestGrade(grade);
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

});
