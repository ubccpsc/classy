"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
require("mocha");
const Log_1 = require("../../../../common/Log");
const GlobalSpec_1 = require("../GlobalSpec");
const BackendServer_1 = require("../../src/server/BackendServer");
const PersonController_1 = require("../../src/controllers/PersonController");
const Config_1 = require("../../../../common/Config");
const GitHubActions_1 = require("../../src/controllers/util/GitHubActions");
const DatabaseController_1 = require("../../src/controllers/DatabaseController");
const RepositoryController_1 = require("../../src/controllers/RepositoryController");
const loadFirst = require('../GlobalSpec');
const request = require('supertest');
const https = require('https');
// NOTE: skipped for now because the infrastructure spins up classytest
// which means the right routes aren't being started in the backend
// need to change how this loads to enable the right routes to be started
describe('SDMM Routes', function () {
    var app = null;
    var server = null;
    var OLDNAME = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
    var OLDORG = Config_1.default.getInstance().getProp(Config_1.ConfigKey.org);
    before(function () {
        Log_1.default.test('SDMMFrontendRoutes::before - start');
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.name, 'sdmm');
        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer_1.default(false);
        return server.start().then(function () {
            Log_1.default.test('SDMMFrontendRoutes::before - server started');
            // Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function (err) {
            // probably ok; ust means server is already started
            Log_1.default.test('SDMMFrontendRoutes::before - server might already be started: ' + err);
        });
    });
    after(function () {
        Log_1.default.test('SDMMFrontendRoutes::after - start');
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.name, OLDNAME);
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.org, OLDORG);
        return server.stop();
    });
    it('Should not be able to get status without a token.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // NOTE: this subsumed valid uers checks since only valid users can have valid auth tokens
            let response = null;
            const url = '/portal/sdmm/currentStatus/';
            try {
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).get(url).set({ name: name, user: 'ivaliduserstatusrequest', token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(403);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.equal('Invalid login token. Please logout and try again.');
        });
    });
    it('Should respond to a valid status request.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // make sure some valid tokens exist
            const dc = DatabaseController_1.DatabaseController.getInstance();
            yield dc.writeAuth({ personId: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' }); // create an auth record
            yield dc.writeAuth({ personId: GlobalSpec_1.Test.USERNAME2, token: 'testtoken' }); // create an auth record
            const PERSON1 = {
                id: GlobalSpec_1.Test.USERNAME1,
                csId: GlobalSpec_1.Test.USERNAME1,
                githubId: GlobalSpec_1.Test.USERNAME1,
                studentNumber: null,
                fName: '',
                lName: '',
                kind: 'student',
                URL: 'https://github.com/' + GlobalSpec_1.Test.USERNAME1,
                labId: 'UNKNOWN',
                custom: {}
            };
            const pc = new PersonController_1.PersonController();
            yield pc.createPerson(PERSON1);
            let response = null;
            const url = '/portal/sdmm/currentStatus/';
            try {
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).get(url).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(response.body.success).to.not.be.undefined;
            chai_1.expect(response.body.success.status).to.equal('D0PRE');
            chai_1.expect(response.body.success.d0).to.not.be.null;
            chai_1.expect(response.body.success.d1).to.not.be.null;
            chai_1.expect(response.body.success.d2).to.be.null;
            chai_1.expect(response.body.success.d3).to.be.null;
        });
    });
    it('Should not be able perform an unknown action.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/sdmm/performAction/doRandomInvalidThing';
            try {
                // const gha = new GitHubActions();
                // const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.equal('Unable to perform action.');
        });
    });
    it('Should fail to perform an action if the token is invalid.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/sdmm/performAction/provisionD0';
            try {
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'SUPERinvalidTOKEN' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(403);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.equal('Invalid login token. Please logout and try again.');
        });
    });
    it('Should fail to provision a d0 repo if one already exists.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/sdmm/performAction/provisionD0';
            const rc = new RepositoryController_1.RepositoryController();
            let repo = null;
            try {
                repo = yield rc.createRepository('secap_user1', [], {});
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            const dc = DatabaseController_1.DatabaseController.getInstance();
            yield dc.deleteRepository(repo); // cleanup repo
            yield dc.deleteTeam(yield dc.getTeam('user1')); // cleanup team
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.equal('Failed to provision d0 repo; already exists: secap_user1');
        });
    }).timeout(1000 * 30);
    it('Should provision a d0 repo.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/sdmm/performAction/provisionD0';
            try {
                const gha = new GitHubActions_1.GitHubActions();
                const deleted = yield gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(response.body.success).to.not.be.undefined;
            chai_1.expect(response.body.success.message).to.equal('Repository successfully created.');
        });
    }).timeout(1000 * 60);
    it('Should not be able provision a d1 repo if their d0 grade is too low.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/sdmm/performAction/provisionD1individual';
            try {
                // const gha = new GitHubActions();
                // const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.equal('Current d0 grade is not sufficient to move on to d1.');
        });
    }).timeout(1000 * 10);
    it('Should be able provision a d1 individual repo.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/sdmm/performAction/provisionD1individual';
            try {
                // const gha = new GitHubActions();
                // const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist
                const dc = DatabaseController_1.DatabaseController.getInstance();
                const g = {
                    personId: GlobalSpec_1.Test.USERNAME1,
                    delivId: GlobalSpec_1.Test.DELIVID0,
                    score: 60,
                    comment: 'comment',
                    timestamp: Date.now(),
                    urlName: 'urlName',
                    URL: 'url',
                    custom: {}
                };
                yield dc.writeGrade(g);
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(response.body.success).to.not.be.undefined;
            chai_1.expect(response.body.success.message).to.equal('D0 repo successfully updated to D1.');
        });
    }).timeout(1000 * 30);
    it('Should fail to provision a d1 team repo if both users are not known.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/sdmm/performAction/provisionD1team/somerandmomusernamethatdoesnotexist';
            try {
                const gha = new GitHubActions_1.GitHubActions();
                const deleted = yield gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // works on its own but not with others
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.equal('Unknown person somerandmomusernamethatdoesnotexist requested to be on team; please make sure they are registered with the course.');
        });
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
    //     expect(response.status).to.equal(200); // TODO: should be 400
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
    //     const PERSON3: Person = {
    //         id:            Test.USERNAME3,
    //         csId:          Test.USERNAME3, // sdmm doesn't have these
    //         githubId:      Test.USERNAME3,
    //         studentNumber: null,
    //
    //         fName:  '',
    //         lName:  '',
    //         kind:   'student',
    //         URL:    'https://github.com/' + Test.USERNAME3,
    //         labId:  'UNKNOWN',
    //         custom: {}
    //     };
    //     const pc = new PersonController();
    //     await pc.createPerson(PERSON2);
    //     await pc.createPerson(PERSON3);
    //
    //     const dc = DatabaseController.getInstance();
    //     const g: Grade = {
    //         personId:  Test.USERNAME2,
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
    //     (<any>g).personId = Test.USERNAME3;
    //     g.score = 71;
    //     await dc.writeGrade(g);
    //
    //     let response = null;
    //     const url = '/sdmm/performAction/provisionD1team/' + Test.USERNAME3;
    //     try {
    //         // const gha = new GitHubActions();
    //         // const deleted = await gha.deleteRepo('secap_user1'); // make sure the repo doesn't exist
    //
    //         const name = Config.getInstance().getProp(ConfigKey.name);
    //         response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAME2, token: 'testtoken'});
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
    //     expect(response.status).to.equal(200); // TODO: should be 400
    //
    //     expect(response.body.failure).to.not.be.undefined;
    //     // expect(response.body.failure.message).to.equal('Error provisioning d0 repo.');
    // }).timeout(1000 * 10);
});
//# sourceMappingURL=SDMMRoutesSpec.js.map