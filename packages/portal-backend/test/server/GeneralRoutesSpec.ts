import {expect} from "chai";
import "mocha";

import {Test} from "../GlobalSpec";

import Log from "../../../common/Log";
import Config, {ConfigKey} from "../../../common/Config";

import BackendServer from "../../src/server/BackendServer";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {OrgTransportPayload} from "../../../common/types/PortalTypes";

import restify = require('restify');
const request = require('supertest');

describe('General Routes', function () {

    var app: restify.Server = null;

    var server: BackendServer = null;
    before(async () => {
        Log.test('GeneralRoutes::before - start');
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg)); // force testing environment
        Test.ORGNAME = Config.getInstance().getProp(ConfigKey.testorg);

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

    it('Should be able to get the org name', async function () {

        let response = null;
        let body: OrgTransportPayload;
        const url = '/org';
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
        expect(body.success.org).to.equal(Config.getInstance().getProp(ConfigKey.org));
    });

});

