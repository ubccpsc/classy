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
const fs = require("fs-extra");
const GlobalSpec_1 = require("../GlobalSpec");
const Log_1 = require("../../../../common/Log");
const Config_1 = require("../../../../common/Config");
const BackendServer_1 = require("../../src/server/BackendServer");
const DatabaseController_1 = require("../../src/controllers/DatabaseController");
const request = require('supertest');
describe('AutoTest Routes', function () {
    const TIMEOUT = 5000;
    var app = null;
    var server = null;
    before(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test('RestifyAutoTestRoutes::before - start');
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.org, Config_1.default.getInstance().getProp(Config_1.ConfigKey.testorg));
        Config_1.default.getInstance().setProp(Config_1.ConfigKey.name, Config_1.default.getInstance().getProp(Config_1.ConfigKey.testname));
        let db = DatabaseController_1.DatabaseController.getInstance();
        // await db.clearData(); // nuke everything
        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer_1.default(false);
        return server.start().then(function () {
            Log_1.default.test('RestifyAutoTestRoutes::before - server started');
            // Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function (err) {
            Log_1.default.test('RestifyAutoTestRoutes::before - server might already be started: ' + err);
        });
    }));
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            Log_1.default.test('RestifyAutoTestRoutes::after - start');
            return server.stop();
        });
    });
    it('Should reject an unauthorized defaultDeliverable request', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/defaultDeliverable/';
            let body = null;
            try {
                response = yield request(app).get(url).set('token', 'INVALID');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.success).to.be.undefined;
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.shouldLogout).to.be.true;
        });
    });
    it('Should respond to a valid defaultDeliverable request', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/at/defaultDeliverable/';
            try {
                response = yield request(app).get(url).set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success.defaultDeliverable).to.not.be.undefined;
            chai_1.expect(body.success.defaultDeliverable).to.equal('d0');
        });
    }).timeout(TIMEOUT);
    it('Should reject an authorized result', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/result/';
            let body = null;
            try {
                response = yield request(app).post(url).send(body).set('token', 'INVALIDTOKEN');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.success).to.be.undefined;
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.shouldLogout).to.be.true;
        });
    });
    it('Should accept a valid result payload', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/result/';
            const body = {
                delivId: GlobalSpec_1.Test.DELIVID0,
                repoId: GlobalSpec_1.Test.REPONAME1,
                timestamp: 0,
                commitURL: 'url',
                commitSHA: 'sha',
                input: {},
                output: {}
            }; // TODO: this should send a real result
            try {
                response = yield request(app).post(url).send(body).set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(response.body.success).to.not.be.undefined;
            // expect(response.body.success).to.equal(true);
        });
    }).timeout(TIMEOUT);
    it('Should reject an invalid result payload', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/result/';
            const body = {
                delivId: GlobalSpec_1.Test.DELIVID0,
                repoId: GlobalSpec_1.Test.REPONAME1,
                timestamp: 0,
                commitURL: 'url',
                commitSHA: 'sha',
                input: {},
                output: {}
            };
            delete body.delivId; // remove required field
            try {
                response = yield request(app).post(url).send(body).set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(response.body.success).to.be.undefined;
            chai_1.expect(response.body.failure).to.not.be.undefined;
        });
    }).timeout(TIMEOUT);
    it('Should respond to a valid result request', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/result/' + GlobalSpec_1.Test.DELIVID0 + '/' + GlobalSpec_1.Test.REPONAME1;
            let body = null;
            try {
                response = yield request(app).get(url).set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.failure).to.be.undefined;
        });
    });
    it('Should reject an unauthorized result request', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/result/' + GlobalSpec_1.Test.DELIVID0 + '/' + GlobalSpec_1.Test.REPONAME1;
            let body = null;
            try {
                response = yield request(app).get(url).set('token', 'INVALID');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.success).to.be.undefined;
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.shouldLogout).to.be.true;
        });
    });
    it('Should reject an unauthorized isStaff request', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/isStaff/rtholmes';
            let body = null;
            try {
                response = yield request(app).get(url).set('token', 'INVALID');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.success).to.be.undefined;
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.shouldLogout).to.be.true;
        });
    });
    it('Should respond to a valid isStaff request for staff', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/at/isStaff/rtholmes';
            try {
                response = yield request(app).get(url).set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.isStaff).to.not.be.undefined;
            chai_1.expect(body.success.isStaff).to.be.true;
            chai_1.expect(body.success.isAdmin).to.be.true;
        });
    });
    it('Should respond to a valid isStaff request for non-staff', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/at/isStaff/INVALIDUSERNAME';
            try {
                response = yield request(app).get(url).set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.isStaff).to.not.be.undefined;
            chai_1.expect(body.success.isAdmin).to.not.be.undefined;
            chai_1.expect(body.success.isStaff).to.be.false;
            chai_1.expect(body.success.isAdmin).to.be.false;
        });
    });
    it('Should reject an unauthorized container request', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/container/d0';
            let body = null;
            try {
                response = yield request(app).get(url).set('token', 'INVALID');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.success).to.be.undefined;
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.shouldLogout).to.be.true;
        });
    });
    it('Should respond to a valid container request for a deliverable', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/container/d0';
            let body;
            try {
                response = yield request(app).get(url).set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.dockerImage).to.not.be.undefined;
            chai_1.expect(body.success.studentDelay).to.not.be.undefined;
            chai_1.expect(body.success.maxExecTime).to.not.be.undefined;
            chai_1.expect(body.success.regressionDelivIds).to.not.be.undefined;
            chai_1.expect(body.success.regressionDelivIds).to.be.an('array');
        });
    });
    it('Should respond to an invalid container request', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/container/d9997';
            let body;
            try {
                response = yield request(app).get(url).set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.success).to.be.undefined;
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.message).to.not.be.undefined;
        });
    });
    it('Should reject an unauthorized grade request', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const url = '/portal/at/grade';
            let body = null;
            try {
                response = yield request(app).post(url).send({}).set('token', 'INVALID');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.success).to.be.undefined;
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.shouldLogout).to.be.true;
        });
    });
    it('Should be able to receive a grade event', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const gradePayload = {
                delivId: GlobalSpec_1.Test.DELIVID0,
                score: 51,
                repoId: GlobalSpec_1.Test.REPONAME1,
                repoURL: 'repoURL',
                urlName: 'urlName',
                URL: 'test URL from grade record',
                comment: 'test comment from grade record',
                timestamp: Date.now(),
                custom: {}
            };
            const url = '/portal/at/grade/';
            try {
                response = yield request(app).post(url).send(gradePayload).set('Accept', 'application/json').set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(response.body.success).to.not.be.undefined;
            chai_1.expect(response.body.success.success).to.be.true;
        });
    });
    it('Should reject an invalid grade event', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            const gradePayload = {
                delivId: GlobalSpec_1.Test.DELIVID0,
                score: 51,
                repoId: GlobalSpec_1.Test.REPONAME1,
                repoURL: 'repoURL',
                urlName: 'urlName',
                URL: 'test URL from grade record',
                comment: 'test comment from grade record',
                timestamp: Date.now(),
                custom: {}
            };
            delete gradePayload.score; // remove field
            const url = '/portal/at/grade/';
            try {
                response = yield request(app).post(url).send(gradePayload).set('Accept', 'application/json').set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(response.body.failure).to.not.be.undefined;
            chai_1.expect(response.body.failure.message).to.be.a('string');
        });
    });
    it('Should be able to receive a Webhook event from GitHub', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body = fs.readJSONSync("../../packages/../autotest/test/githubEvents/push_master-branch.json"); // __dirname
            const url = '/portal/githubWebhook';
            try {
                response = yield request(app).post(url).send(body).set('Accept', 'application/json').set('token', Config_1.default.getInstance().getProp(Config_1.ConfigKey.autotestSecret));
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // Log.test(response.status + " -> " + JSON.stringify(response.body));
            chai_1.expect(response.status).to.equal(400); // really should be 200, but AutoTest isn't running so it will return this error
            const text = response.text;
            chai_1.expect(text.indexOf('ECONNREFUSED')).to.be.greaterThan(0); // at least make sure it fails for the right reason
        });
    });
});
//# sourceMappingURL=AutoTestRoutesSpec.js.map