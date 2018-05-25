import {expect} from "chai";
import "mocha";

import Log from "../../../common/Log";
import {Test} from "../GlobalSpec";

import BackendServer from "../../src/server/BackendServer";
import {Person} from "../../src/Types";
import {PersonController} from "../../src/controllers/PersonController";

const loadFirst = require('../GlobalSpec');

import restify = require('restify');

const request = require('supertest');
const https = require('https');

describe('SDMM: Frontend Routes', function () {

    var app: restify.Server = null;
    var server: BackendServer = null;

    before(function () {
        Log.test('SDMMFrontendRoutes::before - start');
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
        return server.stop();
    });

    it('Should respond to a valid status request', async function () {

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
        const url = '/currentStatus/';
        try {
            response = await request(app).get(url).set({org: Test.ORGNAME, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.success).to.not.be.undefined;

        expect(response.body.success.status).to.equal('D0PRE');

        expect(response.body.success.d0).to.be.null;
        expect(response.body.success.d1).to.be.null;
        expect(response.body.success.d2).to.be.null;
        expect(response.body.success.d3).to.be.null;
    });

});

