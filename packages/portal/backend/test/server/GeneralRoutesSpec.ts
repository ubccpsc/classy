import {expect} from "chai";
import "mocha";

import {Test} from "../GlobalSpec";

import Log from "../../../../common/Log";
import Config, {ConfigKey} from "../../../../common/Config";

import BackendServer from "../../src/server/BackendServer";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {ConfigTransportPayload, Payload} from "../../../../common/types/PortalTypes";
import restify = require('restify');


const request = require('supertest');

describe('General Routes', function () {

    var app: restify.Server = null;

    var server: BackendServer = null;
    before(async () => {
        Log.test('GeneralRoutes::before - start');

        // Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest);
        // Test.ORGNAME = Config.getInstance().getProp(ConfigKey.testorg);

        let db = DatabaseController.getInstance();
        // await db.clearData(); // nuke everything

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        return server.start().then(function () {
            Log.test('GeneralRoutes::before - server started');
            app = server.getServer();
        }).catch(function (err) {
            Log.test('GeneralRoutes::before - server might already be started: ' + err);
        });
    });

    after(function () {
        Log.test('GeneralRoutes::after - start');
        return server.stop();
    });

    it('Should be able to get config details', async function () {

        let response = null;
        let body: ConfigTransportPayload;
        const url = '/portal/config';
        try {
            response = await request(app).get(url);
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.org).to.not.be.undefined;
        expect(body.success.org).to.equal(Config.getInstance().getProp(ConfigKey.org)); // valid .org usage
        expect(body.success.name).to.equal(Config.getInstance().getProp(ConfigKey.name));
    });

    it('Should be able to get get a released grade for a user.', async function () {
        const dc: DatabaseController = DatabaseController.getInstance();

        // get user
        let auth = await dc.getAuth(Test.USERNAME1);
        expect(auth).to.not.be.null;

        // prepare deliverables
        let deliv = Test.getDeliverable(Test.DELIVID1);
        deliv.gradesReleased = true;
        dc.writeDeliverable(deliv);
        deliv = Test.getDeliverable(Test.DELIVID2);
        deliv.gradesReleased = true;
        dc.writeDeliverable(deliv);

        let response = null;
        let body: Payload;
        const url = '/portal/grades';
        try {
            Log.test('Making request');
            response = await request(app).get(url).set('user', auth.personId).set('token', auth.token);
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.length).to.equal(2);
        expect(body.success[0].delivId).to.equal(Test.DELIVID1);
        expect(body.success[0].score).to.equal(50);
        expect(body.success[1].delivId).to.equal(Test.DELIVID2);
        expect(body.success[1].score).to.equal(null);
    });

    it('Should not be able to get get grades without a valid token.', async function () {
        const dc: DatabaseController = DatabaseController.getInstance();

        // get user
        let auth = await dc.getAuth(Test.USERNAME1);
        expect(auth).to.not.be.null;

        let response = null;
        let body: Payload;
        const url = '/portal/grades';
        try {
            Log.test('Making request');
            response = await request(app).get(url).set('user', auth.personId).set('token', 'INVALIDTOKEN');
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.equal('Authorization error; invalid token.');
    });

});

