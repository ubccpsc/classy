import BackendServer from "../../src/server/BackendServer";
import Log from "../../../common/Log";
import {Test} from "../GlobalSpec";

import {expect} from "chai";
import "mocha";
import {Person} from "../../src/Types";
import {PersonController} from "../../src/controllers/PersonController";

const loadFirst = require('../GlobalSpec');

import restify = require('restify');

const request = require('supertest');
const https = require('https');

describe('REST Routes for Frontend', function () {

    var app: restify.Server = null;

    before(function () {
        Log.test('RestifyFrontendRoutes::before - start');
        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        const server = new BackendServer(false);

        return server.start().then(function () {
            Log.test('RestifyFrontendRoutes::before - server started');
            Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function (err) {
            // probably ok; ust means server is already started
            Log.test('RestifyFrontendRoutes::before - server might already be started: ' + err);
        });
    });

    it.skip('Should respond to a valid status request', async function () {

        const PERSON1: Person = {
            id:            Test.USERNAME1,
            csId:          Test.USERNAME1, // sdmm doesn't have these
            githubId:      Test.USERNAME1,
            studentNumber: null,

            org:    Test.ORGNAME,
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
        expect(response.body.user).to.not.be.undefined;
        expect(response.body.status).to.not.be.undefined;
        expect(response.body.status).to.equal('D0PRE');
    });

});

