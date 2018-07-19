import {expect} from "chai";
import "mocha";

import Log from "../../../common/Log";
import {Test} from "../GlobalSpec";

import BackendServer from "../../src/server/BackendServer";
import {Grade, Person} from "../../src/Types";
import {PersonController} from "../../src/controllers/PersonController";
import Config, {ConfigKey} from "../../../common/Config";
import {GitHubActions} from "../../src/controllers/util/GitHubActions";
import {DatabaseController} from "../../src/controllers/DatabaseController";

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


    it('Should not be able provision a d1 repo if their d0 grade is too low.', async function () {

        let response = null;
        const url = '/sdmm/performAction/provisionD1individual';
        try {
            // const gha = new GitHubActions();
            // const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist

            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.failure).to.not.be.undefined;
        expect(response.body.failure.message).to.equal('Current d0 grade is not sufficient to move on to d1.');
    }).timeout(1000 * 10);

    it('Should be able provision a d1 individual repo.', async function () {

        let response = null;
        const url = '/sdmm/performAction/provisionD1individual';
        try {
            // const gha = new GitHubActions();
            // const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist

            const dc = DatabaseController.getInstance();
            const g: Grade = {
                personId:  Test.USERNAME1,
                delivId:   Test.DELIVID0,
                score:     60,
                comment:   'comment',
                timestamp: Date.now(),

                urlName: 'urlName',
                URL:     'url',

                custom: {}
            };
            await dc.writeGrade(g);

            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.success).to.not.be.undefined;
        expect(response.body.success.message).to.equal('D0 repo successfully updated to D1.');
    }).timeout(1000 * 30);

    it('Should fail to provision a d1 team repo if both users are not known.', async function () {

        let response = null;
        const url = '/sdmm/performAction/provisionD1team/somerandmomusernamethatdoesnotexist';
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

        expect(response.body.failure).to.not.be.undefined;
        expect(response.body.failure.message).to.equal('Unknown person somerandmomusernamethatdoesnotexist requested to be on team; please make sure they are registered with the course.');
    }).timeout(1000 * 30);

    // it('Should fail to provision a d1 team repo if both users do not have sufficient d0 grades.', async function () {
    //
    //     const PERSON2: Person = {
    //         id:            Test.USERNAME2,
    //         csId:          Test.USERNAME2, // sdmm doesn't have these
    //         githubId:      Test.USERNAME2,
    //         studentNumber: null,
    //
    //         fName:  '',
    //         lName:  '',
    //         kind:   'student',
    //         URL:    'https://github.com/' + Test.USERNAME2,
    //         labId:  'UNKNOWN',
    //         custom: {}
    //     };
    //
    //     const pc = new PersonController();
    //     await pc.createPerson(PERSON2);
    //
    //     let response = null;
    //     const url = '/sdmm/performAction/provisionD1team/' + Test.USERNAME2;
    //     try {
    //         const gha = new GitHubActions();
    //         const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist
    //
    //         const name = Config.getInstance().getProp(ConfigKey.name);
    //         response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
    //     } catch (err) {
    //         Log.test('ERROR: ' + err);
    //     }
    //     // works on its own but not with others
    //     Log.test(response.status + " -> " + JSON.stringify(response.body));
    //     expect(response.status).to.equal(200);
    //
    //     expect(response.body.failure).to.not.be.undefined;
    //     expect(response.body.failure.message).to.equal('All teammates must have achieved a score of 60% or more to join a team.');
    // }).timeout(1000 * 30);

    // it('Should be able to provision a d1 team repo.', async function () {
    //
    //     const PERSON2: Person = {
    //         id:            Test.USERNAME2,
    //         csId:          Test.USERNAME2, // sdmm doesn't have these
    //         githubId:      Test.USERNAME2,
    //         studentNumber: null,
    //
    //         fName:  '',
    //         lName:  '',
    //         kind:   'student',
    //         URL:    'https://github.com/' + Test.USERNAME2,
    //         labId:  'UNKNOWN',
    //         custom: {}
    //     };
    //
    //     const pc = new PersonController();
    //     await pc.createPerson(PERSON2);
    //
    //     const dc = DatabaseController.getInstance();
    //     const g: Grade = {
    //         personId:  Test.USERNAME1,
    //         delivId:   Test.DELIVID0,
    //         score:     60,
    //         comment:   'comment',
    //         timestamp: Date.now(),
    //
    //         urlName: 'urlName',
    //         URL:     'url',
    //
    //         custom: {}
    //     };
    //     await dc.writeGrade(g);
    //
    //     (<any>g).personId = Test.USERNAME2;
    //     g.score = 71;
    //     await dc.writeGrade(g);
    //
    //     let response = null;
    //     const url = '/sdmm/performAction/provisionD1team/' + Test.USERNAME2;
    //     try {
    //         const gha = new GitHubActions();
    //         const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist
    //
    //         const name = Config.getInstance().getProp(ConfigKey.name);
    //         response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
    //     } catch (err) {
    //         Log.test('ERROR: ' + err);
    //     }
    //     // works on its own but not with others
    //     Log.test(response.status + " -> " + JSON.stringify(response.body));
    //     expect(response.status).to.equal(200);
    //
    //     expect(response.body.success).to.not.be.undefined;
    //     expect(response.body.success.message).to.equal('sweetas');
    // }).timeout(1000 * 30);

    // this test was passing, but for the wrong reason:
    //
    // it('Should fail provision repo that already exists.', async function () {
    //
    //     let response = null;
    //     const url = '/sdmm/performAction/provisionD0';
    //     try {
    //         const name = Config.getInstance().getProp(ConfigKey.name);
    //         response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
    //     } catch (err) {
    //         Log.test('ERROR: ' + err);
    //     }
    //     // works on its own but not with others
    //     Log.test(response.status + " -> " + JSON.stringify(response.body));
    //     expect(response.status).to.equal(200);
    //
    //     expect(response.body.failure).to.not.be.undefined;
    //     // expect(response.body.failure.message).to.equal('Error provisioning d0 repo.');
    // }).timeout(1000 * 10);


});

