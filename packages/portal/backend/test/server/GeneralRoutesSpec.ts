import {expect} from "chai";
import "mocha";
import * as restify from "restify";
import * as request from "supertest";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {ConfigTransportPayload, Payload} from "../../../../common/types/PortalTypes";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import BackendServer from "../../src/server/BackendServer";

import {Test} from "../GlobalSpec";

describe('General Routes', function() {

    let app: restify.Server = null;

    let server: BackendServer = null;

    before(async () => {
        Log.test('GeneralRoutes::before - start');

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        DatabaseController.getInstance(); // just get this done at the start
        server = new BackendServer(false);

        return server.start().then(function() {
            Log.test('GeneralRoutes::before - server started');
            app = server.getServer();
        }).catch(function(err) {
            Log.test('GeneralRoutes::before - server might already be started: ' + err);
        });
    });

    after(function() {
        Log.test('GeneralRoutes::after - start');
        return server.stop();
    });

    it('Should be able to get config details', async function() {

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

    it('Should be able to get get a released grade for a user.', async function() {
        const dc: DatabaseController = DatabaseController.getInstance();

        // get user
        const auth = await dc.getAuth(Test.USER1.id);
        expect(auth).to.not.be.null;

        // prepare deliverables
        let deliv = Test.getDeliverable(Test.DELIVID1);
        deliv.gradesReleased = true;
        await dc.writeDeliverable(deliv);
        deliv = Test.getDeliverable(Test.DELIVID2);
        deliv.gradesReleased = true;
        await dc.writeDeliverable(deliv);

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
        expect(body.success[0].score).to.equal(100);
        expect(body.success[1].delivId).to.equal(Test.DELIVID2);
        expect(body.success[1].score).to.equal(null);
    });

    it('Should not be able to get get grades without a valid token.', async function() {
        const dc: DatabaseController = DatabaseController.getInstance();

        // get user
        const auth = await dc.getAuth(Test.USER1.id);
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
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.equal('Invalid credentials');
    });

    it('Should be able to get get the teams for a user.', async function() {
        const dc: DatabaseController = DatabaseController.getInstance();

        // get user
        // await dc.writeAuth({personId: Test.USER3.id, token: Date.now() + '_token'});
        const auth = await dc.getAuth(Test.USER1.id);
        expect(auth).to.not.be.null;

        // const team = Test.getTeam(Test.TEAMNAME3, Test.DELIVID0, [Test.USERNAME3]);
        // await dc.writeTeam(team);

        // prepare deliverables
        // let deliv = Test.getDeliverable(Test.DELIVID1);
        // deliv.gradesReleased = true;
        // await dc.writeDeliverable(deliv);
        // deliv = Test.getDeliverable(Test.DELIVID2);
        // deliv.gradesReleased = true;
        // await dc.writeDeliverable(deliv);

        let response = null;
        let body: Payload;
        const url = '/portal/teams';
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
        expect(body.success.length).to.equal(1);
        expect(body.success[0].delivId).to.equal(Test.DELIVID0);
        expect(body.success[0].id).to.equal(Test.TEAMNAME1);
    });

    it('Should not be able to get get teams without a valid token.', async function() {
        const dc: DatabaseController = DatabaseController.getInstance();

        // get user
        const auth = await dc.getAuth(Test.USER1.id);
        expect(auth).to.not.be.null;

        let response = null;
        let body: Payload;
        const url = '/portal/teams';
        try {
            Log.test('Making request');
            response = await request(app).get(url).set('user', auth.personId).set('token', 'INVALIDTOKEN');
            Log.test('Response received');
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }

        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.equal('Invalid credentials');
    });

});
