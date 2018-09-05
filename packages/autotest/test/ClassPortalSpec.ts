import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../common/Config";
import Log from "../../common/Log";
import {IAutoTestResult, IContainerInput, IContainerOutput} from "../../common/types/AutoTestTypes";
import {AutoTestGradeTransport} from "../../common/types/PortalTypes";
import {DatabaseController} from "../../portal/backend/src/controllers/DatabaseController";
import BackendServer from "../../portal/backend/src/server/BackendServer";
import {Course} from "../../portal/backend/src/Types";
import {ClassPortal, IClassPortal} from "../src/autotest/ClassPortal";
// const loadFirst = require('./GlobalSpec');
import "./GlobalSpec";

describe("ClassPortal Service", () => {
    Config.getInstance();

    let cp: IClassPortal;
    // const classId = "secapstone";
    // const CURRENT_DEFAULT_DELIV = "d2";

    let backend: BackendServer = null;
    before(async function() {
        Log.test("ClassPortalSpec::before() - start");
        backend = new BackendServer();
        await backend.start();
        Log.test("ClassPortalSpec::before() - done");
    });

    after(async function() {
        Log.test("ClassPortalSpec::after() - start");
        await backend.stop();
        Log.test("ClassPortalSpec::after() - done");
    });

    beforeEach(function() {
        cp = new ClassPortal();
    });

    // NOTE: if this fails it could be because the ClassPortal Backend has not been started yet
    it("Should be able for a staff user to be staff.", async () => {
        try {
            const actual = await cp.isStaff("rtholmes");
            Log.test('Actual: ' + actual);
            expect(actual.isStaff).to.equal(true);
            expect(actual.isAdmin).to.equal(true);
        } catch (err) {
            expect.fail("Should not happen: " + err);
        }
    });

    it("Should be able for a non-staff user to not be staff.", async () => {
        try {
            const actual = await cp.isStaff("student");
            expect(actual.isStaff).to.equal(false);
            expect(actual.isAdmin).to.equal(false);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should be able for invalid user to not be staff.", async () => {
        try {
            const actual = await cp.isStaff("foo");
            expect(actual.isStaff).to.equal(false);
            expect(actual.isAdmin).to.equal(false);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return false for non-staff.", async () => {
        try {
            let actual = await cp.isStaff(null);
            expect(actual.isStaff).to.equal(false);
            expect(actual.isAdmin).to.equal(false);
            actual = await cp.isStaff(undefined);
            expect(actual.isStaff).to.equal(false);
            expect(actual.isAdmin).to.equal(false);
            actual = await cp.isStaff("");
            expect(actual.isStaff).to.equal(false);
            expect(actual.isAdmin).to.equal(false);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return the test delay in seconds for a course.", async () => {
        try {
            const res = await cp.getContainerDetails("d0");
            expect(res).to.not.be.null;
            const actual = res.studentDelay;
            expect(actual).to.equal(43200);
        } catch (err) {
            expect.fail("Should not happen: " + err.message);
        }
    });

    it("Should return a container id for an existing course.", async () => {
        try {
            const res = await cp.getContainerDetails("d0");
            const actual = res.dockerImage;
            expect(actual).to.equal("testImage");
        } catch (err) {
            expect.fail("Should not happen: " + err.message);
        }
    });

    it("Should return a null container id if delivId does not exist.", async () => {
        try {
            const res = await cp.getContainerDetails("d9997");
            expect(res).to.equal(null);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a default deliverable if the course has one.", async () => {
        // setup
        const db = DatabaseController.getInstance();
        const course: Course = {
            id:                   Config.getInstance().getProp(ConfigKey.name),
            defaultDeliverableId: 'd0',
            custom:               {}
        };
        await db.writeCourseRecord(course);

        // test
        const actual = await cp.getDefaultDeliverableId();
        Log.test("Actual: " + JSON.stringify(actual));

        expect(actual.defaultDeliverable).to.equal('d0');
        // expect(actual.defaultDeliverable).to.be.null;
    });

    it("Should be able to send a valid grade.", async () => {
        const grade: AutoTestGradeTransport = {
            repoId:    'repo1',
            repoURL:   'https://repo1',
            delivId:   'd0',
            score:     60,
            comment:   'comment!',
            urlName:   'SHAName',
            URL:       'https://SHAURL',
            timestamp: Date.now(),
            custom:    {}
        };
        const actual = await cp.sendGrade(grade);
        Log.test("Actual: " + JSON.stringify(actual));

        expect(actual.success).to.not.be.undefined;
    });

    it("Should fail to send an invalid grade.", async () => {
        const grade: any = { // AutoTestGradeTransport
            repoId:    'repo1',
            repoURL:   'https://repo1',
            // delivId:   'd0',  // this should be required
            score:     60,
            comment:   'comment!',
            urlName:   'SHAName',
            URL:       'https://SHAURL',
            timestamp: Date.now(),
            custom:    {}
        };
        const actual = await cp.sendGrade(grade);
        Log.test("Actual: " + JSON.stringify(actual));

        expect(actual.success).to.be.undefined;
        expect(actual.failure).to.not.be.undefined;
        expect(actual.failure.message).to.be.an('string');
    });

    function getResult(delivId: string, repoId: string, score: number) {
        const ts = Date.now() - Math.random() * 1000 * 600;
        const projectURL = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + repoId;
        const commitURL = projectURL + '/commits/FOOOSHA';
        const output: IContainerOutput = {
            // commitURL:          commitURL,
            timestamp:          ts,
            report:             {
                scoreOverall: score,
                scoreTest:    Math.random() * 100,
                scoreCover:   Math.random() * 100,
                passNames:    [],
                failNames:    [],
                errorNames:   [],
                skipNames:    [],
                custom:       {},
                feedback:     'feedback'
            },
            postbackOnComplete: true,
            custom:             {},
            attachments:        [],
            state:              'SUCCESS' // enum: SUCCESS, FAIL, TIMEOUT, INVALID_REPORT
        };

        const input: IContainerInput = {
            pushInfo:        {
                delivId: delivId,
                repoId:  repoId,

                // branch:    'master',
                cloneURL:  'cloneURL',
                commitSHA: 'sha',
                commitURL: commitURL,

                // projectURL:  projectURL,
                postbackURL: 'postbackURL',
                timestamp:   ts
            },
            containerConfig: {
                dockerImage:        "imageName",
                studentDelay:       300,
                maxExecTime:        6000,
                regressionDelivIds: [],
                custom:             {}
            },
            delivId:         delivId
        };

        const result: IAutoTestResult = {
            delivId:   delivId,
            repoId:    repoId,
            // timestamp: ts,
            commitURL: commitURL,
            commitSHA: 'SHA',
            input:     input,
            output:    output
        };

        return result;
    }

    it("Should be able to send a valid result.", async () => {

        // function getResult(delivId: string, repoId: string, score:number) {
        const result = getResult('d0', 'repo0', 50);
        const actual = await cp.sendResult(result);
        Log.test("Actual: " + JSON.stringify(actual));

        expect(actual.success).to.not.be.undefined;
    });

    it("Should not be able to send an invalid result.", async () => {

        // function getResult(delivId: string, repoId: string, score:number) {
        const result = getResult('d0', 'repo0', 50);
        delete result.delivId; // REQUIRED field
        const actual = await cp.sendResult(result);
        Log.test("Actual: " + JSON.stringify(actual));

        expect(actual.success).to.be.undefined;
        expect(actual.failure).to.not.be.undefined;
        expect(actual.failure.message).to.be.an('string');
    });

    it("Should be able to get a result.", async () => {
        const actual = await cp.getResult('d0', 'repo0');
        Log.test("Actual: " + JSON.stringify(actual));

        expect(actual).to.not.be.null;
        expect(actual.delivId).to.equal('d0');
        expect(actual.repoId).to.equal('repo0');
    });

    it("Should not get a result that does not exist.", async () => {
        const actual = await cp.getResult('d_' + Date.now(), 'repo0');
        Log.test("Actual: " + JSON.stringify(actual));

        expect(actual).to.be.null;
    });

});
