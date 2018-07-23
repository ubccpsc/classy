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
describe('SDMM Routes', function () {
    var app = null;
    var server = null;
    var OLDNAME = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
    var OLDORG = Config_1.default.getInstance().getProp(Config_1.ConfigKey.org);
    before(function () {
        Log_1.default.test('SDMMFrontendRoutes::before - start');
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.name, 'sdmm');
        server = new BackendServer_1.default(false);
        return server.start().then(function () {
            Log_1.default.test('SDMMFrontendRoutes::before - server started');
            app = server.getServer();
        }).catch(function (err) {
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
            let response = null;
            const url = '/portal/sdmm/currentStatus/';
            try {
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).get(url).set({ name: name, user: 'ivaliduserstatusrequest', token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(403);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.equal('Invalid login token. Please logout and try again.');
        });
    });
    it('Should respond to a valid status request.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            yield dc.writeAuth({ personId: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            yield dc.writeAuth({ personId: GlobalSpec_1.Test.USERNAME2, token: 'testtoken' });
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
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
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
            yield dc.deleteRepository(repo);
            yield dc.deleteTeam(yield dc.getTeam('user1'));
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
                const deleted = yield gha.deleteRepo('secap_user1');
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
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
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
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
                const deleted = yield gha.deleteRepo('secap_user1');
                const name = Config_1.default.getInstance().getProp(Config_1.ConfigKey.name);
                response = yield request(app).post(url).send({}).set({ name: name, user: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.equal('Unknown person somerandmomusernamethatdoesnotexist requested to be on team; please make sure they are registered with the course.');
        });
    }).timeout(1000 * 30);
});
//# sourceMappingURL=SDMMRoutesSpec.js.map