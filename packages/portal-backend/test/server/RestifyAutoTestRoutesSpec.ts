import {expect} from "chai";
import "mocha";

import {Test} from "../GlobalSpec";

import Log from "../../../common/Log";
import Config from "../../../common/Config";
import {GradePayload} from "../../../common/types/SDMMTypes";

import BackendServer from "../../src/server/BackendServer";
import {DatabaseController} from "../../src/controllers/DatabaseController";

// This seems silly, but just makes sure GlobalSpec runs first.
// It should be at the top of every test file.
const loadFirst = require('../GlobalSpec');

import restify = require('restify');

const request = require('supertest');

describe('REST Routes for AutoTest', function () {

    var app: restify.Server = null;

    var server: BackendServer = null;
    before(async () => {
        Log.test('RestifyAutoTestRoutes::before - start');

        Config.getInstance();
        (<any>Config.getInstance()).config.org = (<any>Config.getInstance()).config.testorg; // force testing environment
        // (<any>Config.getInstance()).config.name = 'secapstonetest'; // force testing in test environment // TODO: NOT GOOD for 340

        Test.ORGNAME = Config.getInstance().getProp('testorg');
        Log.info('GlobalSpec::before() - org: ' + Test.ORGNAME);
        let db = DatabaseController.getInstance();
        await db.clearData(); // nuke everything

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        return server.start().then(function () {
            Log.test('RestifyAutoTestRoutes::before - server started');
            Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function (err) {
            Log.test('RestifyAutoTestRoutes::before - server might already be started: ' + err);
        });
    });

    after(function () {
        Log.test('RestifyAutoTestRoutes::after - start');
        return server.stop();
    });

    it('Should respond to a valid defaultDeliverable request', async function () {

        let response = null;
        const url = '/defaultDeliverable/' + Test.ORGNAME;
        try {
            response = await request(app).get(url);
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body.delivId));
        expect(response.status).to.equal(200);
        expect(response.body.delivId).to.not.be.undefined;
        expect(response.body.delivId).to.equal('d0');
    });

    it('Should respond to a valid isStaff request for staff', async function () {

        let response = null;
        const url = '/isStaff/' + Test.ORGNAME + '/rtholmes';
        try {
            response = await request(app).get(url);
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body.isStaff));
        expect(response.status).to.equal(200);
        expect(response.body.isStaff).to.not.be.undefined;
        expect(response.body.isStaff).to.be.true;
    });

    it('Should respond to a valid isStaff request for non-staff', async function () {

        let response = null;
        const url = '/isStaff/' + Test.ORGNAME + '/INVALIDUSERNAME';
        try {
            response = await request(app).get(url);
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body.isStaff));
        expect(response.status).to.equal(200);
        expect(response.body.isStaff).to.not.be.undefined;
        expect(response.body.isStaff).to.be.false;
    });

    it('Should respond to a valid container request for a deliverable', async function () {

        let response = null;
        const url = '/container/' + Test.ORGNAME + '/d0';
        try {
            response = await request(app).get(url);
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);
        expect(response.body.dockerImage).to.not.be.undefined;
        expect(response.body.studentDelay).to.not.be.undefined;
        expect(response.body.maxExecTime).to.not.be.undefined;
        expect(response.body.regressionDelivIds).to.not.be.undefined;
    });

    it('Should respond to an invalid container request', async function () {

        let response = null;
        const url = '/container/INVALIDORG/d0';
        try {
            response = await request(app).get(url);
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400);
        expect(response.body.message).to.not.be.undefined;
    });

    it('Should be able to receive a grade event', async function () {

        let response = null;

        const gradePayload: GradePayload = {
            score:     51,
            URL:       'test URL from grade record',
            comment:   'test comment from grade record',
            timestamp: Date.now(),
            custom:    {}
        };

        // that.rest.post('/grade/:org/:repoId/:delivId', RouteHandler.atGradeResult);
        const url = '/grade/' + Test.ORGNAME + '/' + Test.REPONAME1 + '/' + Test.DELIVID0;
        try {
            response = await request(app).post(url).send(gradePayload).set('Accept', 'application/json');
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
    });

});

