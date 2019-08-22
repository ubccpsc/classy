import {expect} from "chai";
import "mocha";
import * as restify from "restify";
import * as request from "supertest";

import Log from "../../../../common/Log";
import {AuthTransportPayload} from "../../../../common/types/PortalTypes";
import {DatabaseController} from "../../src/controllers/DatabaseController";

import BackendServer from "../../src/server/BackendServer";

import {Test} from "../../../../common/TestHarness";

// const loadFirst = require("../xRunLast/TestDatasetGeneratorSpec");

describe('Auth Routes', function() {

    // const TIMEOUT = 1000 * 10;

    let app: restify.Server = null;

    let server: BackendServer = null;

    // let oldOrg: string | null = null;
    before(async () => {
        Log.test('AuthRoutes::before - start');

        // oldOrg = Config.getInstance().getProp(ConfigKey.org);
        // Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest); // force testing environment

        await Test.suiteBefore('Auth Routes');

        // get data ready
        await Test.prepareAll();

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        return server.start().then(function() {
            Log.test('AuthRoutes::before - server started');
            app = server.getServer();
        }).catch(function(err) {
            Log.test('AuthRoutes::before - server might already be started: ' + err);
        });
    });

    after(async function() {
        Log.test('AuthRoutes::after - start');
        await server.stop();
        await Test.suiteAfter('Auth Routes');
    });

    it('Should be able to get some credentials for an admin.', async function() {

        const dc: DatabaseController = DatabaseController.getInstance();

        const auth = await dc.getAuth(Test.ADMIN1.id);
        expect(auth).to.not.be.null;

        let response = null;
        let body: AuthTransportPayload;
        const url = '/portal/getCredentials';
        try {
            Log.test('Making request');
            response = await request(app).get(url).set('user', auth.personId).set('token', auth.token);
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test('checking assertions on: response');

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.personId).to.equal(auth.personId);
        expect(body.success.token).to.equal(auth.token);
    }).timeout(Test.TIMEOUTLONG);

    it('Should be able to get some credentials for a student.', async function() {

        const dc: DatabaseController = DatabaseController.getInstance();

        const auth = await dc.getAuth(Test.USER1.id);
        expect(auth).to.not.be.null;

        let response = null;
        let body: AuthTransportPayload;
        const url = '/portal/getCredentials';
        try {
            Log.test('Making request');
            response = await request(app).get(url).set('user', auth.personId).set('token', auth.token);
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test('checking assertions on: response');

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.personId).to.equal(auth.personId);
        expect(body.success.token).to.equal(auth.token);
    }).timeout(Test.TIMEOUT);

    it('Should fail to get credentials if the token is bad.', async function() {

        const dc: DatabaseController = DatabaseController.getInstance();
        const auth = await dc.getAuth(Test.ADMIN1.id);
        expect(auth).to.not.be.null;

        let response = null;
        let body: AuthTransportPayload;
        const url = '/portal/getCredentials';
        try {
            response = await request(app).get(url).set('user', auth.personId).set('token', 'totallyINVALIDtoken');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.failure).to.not.be.undefined;
    });

    it('Should be able to logout a student.', async function() {

        const dc: DatabaseController = DatabaseController.getInstance();

        const auth = await dc.getAuth(Test.USER1.id);
        expect(auth).to.not.be.null;

        let response = null;
        let body: AuthTransportPayload;
        const url = '/portal/logout';
        try {
            Log.test('Making request');
            response = await request(app).get(url).set('user', auth.personId).set('token', auth.token);
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test('checking assertions on: response');

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
    }).timeout(Test.TIMEOUT);

    /**
     * This one is a bit controversial:
     *
     * While this means students _could_ log each other out, it also means that we
     * don't get into states where people can't logout on their own. Better safe
     * than sorry in this dimension.
     */
    it('Should be able to logout even if token is bad.', async function() {

        const dc: DatabaseController = DatabaseController.getInstance();

        // make sure there is a token to logout
        await dc.writeAuth({personId: Test.USER1.id, token: 'testtoken'});

        const auth = await dc.getAuth(Test.USER1.id);
        expect(auth).to.not.be.null;

        let response = null;
        let body: AuthTransportPayload;
        const url = '/portal/logout';
        try {
            Log.test('Making undefined token request');
            // undefined token
            response = await request(app).get(url).set('user', auth.personId);
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test('checking assertions on: response');

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;

        try {
            Log.test('Making null token request');
            // null token
            response = await request(app).get(url).set('user', auth.personId).set('token', null);
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test('checking assertions on: response');

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;

    }).timeout(Test.TIMEOUT);

    /**
     * This one is a bit controversial:
     *
     * While this means students _could_ log each other out, it also means that we
     * don't get into states where people can't logout on their own. Better safe
     * than sorry in this dimension.
     */
    it('Should fail to logout if user is bad.', async function() {

        const dc: DatabaseController = DatabaseController.getInstance();

        // make sure there is a token to logout
        await dc.writeAuth({personId: Test.USER1.id, token: 'testtoken'});

        const auth = await dc.getAuth(Test.USER1.id);
        expect(auth).to.not.be.null;

        let response = null;
        let body: AuthTransportPayload;
        const url = '/portal/logout';
        try {
            Log.test('Making undefined user request');
            // undefined user
            response = await request(app).get(url).set('token', auth.token);
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test('checking assertions on: response');

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.failure).to.not.be.undefined;

        try {
            Log.test('Making null user request');
            // null user
            response = await request(app).get(url).set('user', null).set('token', auth.token);
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test('checking assertions on: response');

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.failure).to.not.be.undefined;

    }).timeout(Test.TIMEOUT);

});
