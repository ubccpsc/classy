import {expect} from "chai";
import "mocha";
import * as fs from "fs-extra";

import {Test} from "../GlobalSpec";

import Log from "../../../common/Log";
import Config, {ConfigKey} from "../../../common/Config";

import BackendServer from "../../src/server/BackendServer";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {
    AutoTestAuthPayload,
    AutoTestConfigPayload,
    AutoTestDefaultDeliverablePayload,
    AutoTestGradeTransport
} from "../../../common/types/PortalTypes";

// This seems silly, but just makes sure GlobalSpec runs first.
// It should be at the top of every test file.
// const loadFirst = require('../GlobalSpec');

import restify = require('restify');

const request = require('supertest');

describe.only('AutoTest Routes', function () {

    const TIMEOUT = 5000;

    var app: restify.Server = null;

    var server: BackendServer = null;
    before(async () => {
        Log.test('RestifyAutoTestRoutes::before - start');

        Config.getInstance();
        (<any>Config.getInstance()).config.org = (<any>Config.getInstance()).config.testorg; // force testing environment
        // (<any>Config.getInstance()).config.name = 'secapstonetest'; // force testing in test environment // TODO: NOT GOOD for 340

        // Test.ORGNAME = Config.getInstance().getProp(ConfigKey.testorg);
        // Log.info('GlobalSpec::before() - org: ' + Test.ORGNAME);

        let db = DatabaseController.getInstance();
        // await db.clearData(); // nuke everything

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        return server.start().then(function () {
            Log.test('RestifyAutoTestRoutes::before - server started');
            // Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function (err) {
            Log.test('RestifyAutoTestRoutes::before - server might already be started: ' + err);
        });
    });

    after(async function () {
        Log.test('RestifyAutoTestRoutes::after - start');
        return server.stop();
    });//.timeout(TIMEOUT);

    it('Should respond to a valid defaultDeliverable request', async function () {

        let response = null;
        let body: AutoTestDefaultDeliverablePayload;
        const url = '/at/defaultDeliverable/';
        try {
            response = await request(app).get(url);
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success.defaultDeliverable).to.not.be.undefined;
        expect(body.success.defaultDeliverable).to.equal('d0');
    }).timeout(TIMEOUT);

    it('Should respond to a valid result', async function () {

        let response = null;
        const url = '/at/result/';

        const body = {dummy: true}; // TODO: this should send a real result

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

    it('Should respond to a valid isStaff request for staff', async function () {

        let response = null;
        let body: AutoTestAuthPayload;
        const url = '/at/isStaff/rtholmes';
        try {
            response = await request(app).get(url);
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

    it('Should respond to a valid isStaff request for non-staff', async function () {

        let response = null;
        let body: AutoTestAuthPayload;
        const url = '/at/isStaff/INVALIDUSERNAME';
        try {
            response = await request(app).get(url);
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

    it('Should respond to a valid container request for a deliverable', async function () {

        let response = null;
        const url = '/at/container/d0';
        let body: AutoTestConfigPayload;
        try {
            response = await request(app).get(url);
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

    it('Should respond to an invalid container request', async function () {

        let response = null;
        const url = '/at/container/d9997';
        let body: AutoTestConfigPayload;
        try {
            response = await request(app).get(url);
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

    it('Should be able to receive a grade event', async function () {

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

        const url = '/at/grade/';
        try {
            response = await request(app).post(url).send(gradePayload).set('Accept', 'application/json');
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);
        expect(response.body.success).to.not.be.undefined;
        expect(response.body.success.success).to.be.true;
    });

    it('Should be able to receive a Webhook event from GitHub', async function () {
        let response = null;

        let body = fs.readJSONSync("../../packages/autotest/test/githubEvents/push_master-branch.json"); // __dirname

        const url = '/githubWebhook';
        try {
            response = await request(app).post(url).send(body).set('Accept', 'application/json');
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400); // really should be 200, but AutoTest isn't running so it will return this error
        const text = response.text;
        expect(text.indexOf('ECONNREFUSED')).to.be.greaterThan(0); // at least make sure it fails for the right reason
    });

});

