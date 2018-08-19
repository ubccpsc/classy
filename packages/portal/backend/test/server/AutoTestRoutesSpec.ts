import {expect} from "chai";
import * as fs from "fs-extra";
import "mocha";
import * as restify from "restify";
import * as request from "supertest";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";

import {
    AutoTestAuthPayload,
    AutoTestConfigPayload,
    AutoTestDefaultDeliverablePayload,
    AutoTestGradeTransport
} from "../../../../common/types/PortalTypes";

import {DatabaseController} from "../../src/controllers/DatabaseController";

import BackendServer from "../../src/server/BackendServer";

import {Test} from "../GlobalSpec";

// This seems silly, but just makes sure GlobalSpec runs first.
// It should be at the top of every test file.
// const loadFirst = require('../GlobalSpec');

describe('AutoTest Routes', function() {

    const TIMEOUT = 5000;

    let app: restify.Server = null;

    let server: BackendServer = null;
    before(async () => {
        Log.test('RestifyAutoTestRoutes::before - start');

        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
        Config.getInstance().setProp(ConfigKey.name, Config.getInstance().getProp(ConfigKey.testname));

        DatabaseController.getInstance(); // invoke early
        // await db.clearData(); // nuke everything

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        return server.start().then(function() {
            Log.test('RestifyAutoTestRoutes::before - server started');
            // Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function(err) {
            Log.test('RestifyAutoTestRoutes::before - server might already be started: ' + err);
        });
    });

    after(async function() {
        Log.test('RestifyAutoTestRoutes::after - start');
        return server.stop();
    });

    it('Should reject an unauthorized defaultDeliverable request', async function() {

        let response = null;
        const url = '/portal/at/defaultDeliverable/';
        let body = null;
        try {
            response = await request(app).get(url).set('token', 'INVALID');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.shouldLogout).to.be.true;
    });

    it('Should respond to a valid defaultDeliverable request', async function() {

        let response = null;
        let body: AutoTestDefaultDeliverablePayload;
        const url = '/portal/at/defaultDeliverable/';
        try {
            response = await request(app).get(url).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success.defaultDeliverable).to.not.be.undefined;
        expect(body.success.defaultDeliverable).to.equal('d0');
    }).timeout(TIMEOUT);

    it('Should reject an authorized result', async function() {

        let response = null;
        const url = '/portal/at/result/';

        let body = null;
        try {
            response = await request(app).post(url).send(body).set('token', 'INVALIDTOKEN');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.shouldLogout).to.be.true;
    });

    it('Should accept a valid result payload', async function() {

        let response = null;
        const url = '/portal/at/result/';

        // public static getResult(delivId: string, repoId: string, people: string[], score: number): Result {
        const body = Test.createResult(Test.DELIVID0, Test.REPONAME1, [Test.USER1.id], 50);
        // const body = { // : IAutoTestResult
        //     delivId:   Test.DELIVID0,
        //     repoId:    Test.REPONAME1,
        //     timestamp: 0,
        //     commitURL: 'url',
        //     commitSHA: 'sha',
        //     input:     {
        //         delivId:  Test.DELIVID0,
        //         pushInfo: {} // should not be empty
        //     },
        //     output:    {}
        // }; // TODO: this should send a real result

        try {
            response = await request(app).post(url).send(body).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);
        expect(response.body.success).to.not.be.undefined;
        // expect(response.body.success).to.equal(true);
    }).timeout(TIMEOUT);

    it('Should reject an invalid result payload', async function() {

        let response = null;
        const url = '/portal/at/result/';

        const body = { // : IAutoTestResult
            delivId:   Test.DELIVID0,
            repoId:    Test.REPONAME1,
            timestamp: 0,
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {},
            output:    {}
        };

        delete body.delivId; // remove required field

        try {
            response = await request(app).post(url).send(body).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400);
        expect(response.body.success).to.be.undefined;
        expect(response.body.failure).to.not.be.undefined;
    }).timeout(TIMEOUT);

    it('Should respond to a valid result request', async function() {

        let response = null;
        const url = '/portal/at/result/' + Test.DELIVID0 + '/' + Test.REPONAME1;
        let body = null;
        try {
            response = await request(app).get(url).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.failure).to.be.undefined;
    });

    it('Should reject an unauthorized result request', async function() {

        let response = null;
        const url = '/portal/at/result/' + Test.DELIVID0 + '/' + Test.REPONAME1;
        let body = null;
        try {
            response = await request(app).get(url).set('token', 'INVALID');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.shouldLogout).to.be.true;
    });

    it('Should reject an unauthorized isStaff request', async function() {

        let response = null;
        const url = '/portal/at/isStaff/rtholmes';
        let body = null;
        try {
            response = await request(app).get(url).set('token', 'INVALID');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.shouldLogout).to.be.true;
    });

    it('Should respond to a valid isStaff request for staff', async function() {

        let response = null;
        let body: AutoTestAuthPayload;
        const url = '/portal/at/isStaff/rtholmes';
        try {
            response = await request(app).get(url).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.isStaff).to.not.be.undefined;
        expect(body.success.isStaff).to.be.true;
        expect(body.success.isAdmin).to.be.true;
    });

    it('Should respond to a valid isStaff request for non-staff', async function() {

        let response = null;
        let body: AutoTestAuthPayload;
        const url = '/portal/at/isStaff/INVALIDUSERNAME';
        try {
            response = await request(app).get(url).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.isStaff).to.not.be.undefined;
        expect(body.success.isAdmin).to.not.be.undefined;
        expect(body.success.isStaff).to.be.false;
        expect(body.success.isAdmin).to.be.false;
    });

    it('Should reject an unauthorized personId request', async function() {

        let response = null;
        const url = '/portal/at/personId/rtholmes';
        let body = null;
        try {
            response = await request(app).get(url).set('token', 'INVALID');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.shouldLogout).to.be.true;
    });

    it('Should respond to a valid personId request', async function() {

        let response = null;
        let body: AutoTestAuthPayload;
        const url = '/portal/at/personId/' + Test.USER1.github; // AutoTest only knows about githubId not personId
        try {
            response = await request(app).get(url).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.personId).to.not.be.undefined;
        expect(body.success.personId).to.be.an('string'); // TODO: check what it is?
    });

    it('Should reject an unauthorized container request', async function() {

        let response = null;
        const url = '/portal/at/container/d0';
        let body = null;
        try {
            response = await request(app).get(url).set('token', 'INVALID');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.shouldLogout).to.be.true;
    });

    it('Should respond to a valid container request for a deliverable', async function() {

        let response = null;
        const url = '/portal/at/container/d0';
        let body: AutoTestConfigPayload;
        try {
            response = await request(app).get(url).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.dockerImage).to.not.be.undefined;
        expect(body.success.studentDelay).to.not.be.undefined;
        expect(body.success.maxExecTime).to.not.be.undefined;
        expect(body.success.regressionDelivIds).to.not.be.undefined;
        expect(body.success.regressionDelivIds).to.be.an('array');
    });

    it('Should respond to an invalid container request', async function() {

        let response = null;
        const url = '/portal/at/container/d9997';
        let body: AutoTestConfigPayload;
        try {
            response = await request(app).get(url).set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.not.be.undefined;
    });

    it('Should reject an unauthorized grade request', async function() {

        let response = null;
        const url = '/portal/at/grade';
        let body = null;
        try {
            response = await request(app).post(url).send({}).set('token', 'INVALID');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.shouldLogout).to.be.true;
    });

    it('Should be able to receive a grade event', async function() {

        let response = null;

        const gradePayload: AutoTestGradeTransport = {
            delivId:   Test.DELIVID0,
            score:     51,
            repoId:    Test.REPONAME1,
            repoURL:   'repoURL',
            urlName:   'urlName',
            URL:       'test URL from grade record',
            comment:   'test comment from grade record',
            timestamp: Date.now(),
            custom:    {}
        };

        const url = '/portal/at/grade/';
        try {
            response = await request(app)
                .post(url)
                .send(gradePayload)
                .set('Accept', 'application/json')
                .set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);
        expect(response.body.success).to.not.be.undefined;
        expect(response.body.success.success).to.be.true;
    });

    it('Should reject an invalid grade event', async function() {

        let response = null;

        const gradePayload: AutoTestGradeTransport = {
            delivId:   Test.DELIVID0,
            score:     51,
            repoId:    Test.REPONAME1,
            repoURL:   'repoURL',
            urlName:   'urlName',
            URL:       'test URL from grade record',
            comment:   'test comment from grade record',
            timestamp: Date.now(),
            custom:    {}
        };

        delete gradePayload.score; // remove field

        const url = '/portal/at/grade/';
        try {
            response = await request(app)
                .post(url)
                .send(gradePayload)
                .set('Accept', 'application/json')
                .set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400);
        expect(response.body.failure).to.not.be.undefined;
        expect(response.body.failure.message).to.be.a('string');
    });

    it('Should be able to receive a Webhook event from GitHub', async function() {
        let response = null;

        const body = fs.readJSONSync(__dirname + "/../../../../autotest/test/githubEvents/push_master-branch.json"); // __dirname

        const url = '/portal/githubWebhook';
        try {
            response = await request(app)
                .post(url).send(body)
                .set('Accept', 'application/json')
                .set('token', Config.getInstance().getProp(ConfigKey.autotestSecret));
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400); // really should be 200, but AutoTest isn't running so it will return this error
        const text = response.text;
        expect(text.indexOf('ECONNREFUSED')).to.be.greaterThan(0); // at least make sure it fails for the right reason
    });

});
