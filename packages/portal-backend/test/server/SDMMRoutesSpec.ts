import {expect} from "chai";
import "mocha";

import Log from "../../../common/Log";
import {Test} from "../GlobalSpec";

import BackendServer from "../../src/server/BackendServer";
import {Person} from "../../src/Types";
import {PersonController} from "../../src/controllers/PersonController";
import Config, {ConfigKey} from "../../../common/Config";
import {GitHubActions} from "../../src/controllers/util/GitHubActions";

const loadFirst = require('../GlobalSpec');

import restify = require('restify');

const request = require('supertest');
const https = require('https');

// NOTE: skipped for now because the infrastructure spins up classytest
// which means the right routes aren't being started in the backend
// need to change how this loads to enable the right routes to be started
describe('SDMM Routes', function () {

    var app: restify.Server = null;
    var server: BackendServer = null;

    var OLDNAME = Config.getInstance().getProp(ConfigKey.name);
    var OLDORG = Config.getInstance().getProp(ConfigKey.org);

    before(function () {
        Log.test('SDMMFrontendRoutes::before - start');

        Config.getInstance().setProp(ConfigKey.name, 'sdmm');

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);


        return server.start().then(function () {
            Log.test('SDMMFrontendRoutes::before - server started');
            // Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function (err) {
            // probably ok; ust means server is already started
            Log.test('SDMMFrontendRoutes::before - server might already be started: ' + err);
        });
    });

    after(function () {
        Log.test('SDMMFrontendRoutes::after - start');
        Config.getInstance().setProp(ConfigKey.name, OLDNAME);
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
        return server.stop();
    });

    it('Should respond to a valid status request.', async function () {

        const PERSON1: Person = {
            id:            Test.USERNAME1,
            csId:          Test.USERNAME1, // sdmm doesn't have these
            githubId:      Test.USERNAME1,
            studentNumber: null,

            fName:  '',
            lName:  '',
            kind:   'student',
            URL:    'https://github.com/' + Test.USERNAME1,
            labId:  'UNKNOWN',
            custom: {}
        };

        const pc = new PersonController();
        await pc.createPerson(PERSON1);

        let response = null;
        const url = '/sdmm/currentStatus/';
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.success).to.not.be.undefined;

        expect(response.body.success.status).to.equal('D0PRE');

        expect(response.body.success.d0).to.not.be.null;
        expect(response.body.success.d1).to.not.be.null;
        expect(response.body.success.d2).to.be.null;
        expect(response.body.success.d3).to.be.null;
    });

    it('Should provision a d0 repo.', async function () {

        let response = null;
        const url = '/sdmm/performAction/provisionD0';
        try {
            const gha = new GitHubActions();
            const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist

            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.success).to.not.be.undefined;
        expect(response.body.success.message).to.equal('Repository successfully created.');
    }).timeout(1000 * 30);

    it('Should fail provision repo that already exists.', async function () {

        let response = null;
        const url = '/sdmm/performAction/provisionD0';
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.failure).to.not.be.undefined;
        // expect(response.body.failure.message).to.equal('Error provisioning d0 repo.');
    }).timeout(1000 * 10);


});

