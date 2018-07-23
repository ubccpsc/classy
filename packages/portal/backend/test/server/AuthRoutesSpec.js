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
const BackendServer_1 = require("../../src/server/BackendServer");
const DatabaseController_1 = require("../../src/controllers/DatabaseController");
const GlobalSpec_1 = require("../GlobalSpec");
const request = require('supertest');
describe('Auth Routes', function () {
    const TIMEOUT = 1000 * 10;
    var app = null;
    var server = null;
    // let oldOrg: string | null = null;
    before(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test('AuthRoutes::before - start');
        // oldOrg = Config.getInstance().getProp(ConfigKey.org);
        // Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest); // force testing environment
        let db = DatabaseController_1.DatabaseController.getInstance();
        // await db.clearData(); // nuke everything
        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer_1.default(false);
        return server.start().then(function () {
            Log_1.default.test('AuthRoutes::before - server started');
            app = server.getServer();
        }).catch(function (err) {
            Log_1.default.test('AuthRoutes::before - server might already be started: ' + err);
        });
    }));
    after(function () {
        Log_1.default.test('AuthRoutes::after - start');
        return server.stop();
    });
    it('Should be able to get some credentials for an admin.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            let auth = yield dc.getAuth(GlobalSpec_1.Test.USERNAMEADMIN);
            chai_1.expect(auth).to.not.be.null;
            let response = null;
            let body;
            const url = '/portal/getCredentials';
            try {
                Log_1.default.test('Making request');
                response = yield request(app).get(url).set('user', auth.personId).set('token', auth.token);
                Log_1.default.test('Response received');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test('checking assertions on: response');
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.personId).to.equal(auth.personId);
            chai_1.expect(body.success.token).to.equal(auth.token);
        });
    }).timeout(TIMEOUT);
    it('Should be able to get some credentials for a student.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            let auth = yield dc.getAuth(GlobalSpec_1.Test.USERNAME1);
            chai_1.expect(auth).to.not.be.null;
            let response = null;
            let body;
            const url = '/portal/getCredentials';
            try {
                Log_1.default.test('Making request');
                response = yield request(app).get(url).set('user', auth.personId).set('token', auth.token);
                Log_1.default.test('Response received');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test('checking assertions on: response');
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.personId).to.equal(auth.personId);
            chai_1.expect(body.success.token).to.equal(auth.token);
        });
    }).timeout(TIMEOUT);
    it('Should fail to get credentials if the token is bad.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            let auth = yield dc.getAuth(GlobalSpec_1.Test.USERNAMEADMIN);
            chai_1.expect(auth).to.not.be.null;
            let response = null;
            let body;
            const url = '/portal/getCredentials';
            try {
                response = yield request(app).get(url).set('user', auth.personId).set('token', 'totallyINVALIDtoken');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.failure).to.not.be.undefined;
        });
    });
    it('Should be able to logout a student.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            let auth = yield dc.getAuth(GlobalSpec_1.Test.USERNAME1);
            chai_1.expect(auth).to.not.be.null;
            let response = null;
            let body;
            const url = '/portal/logout';
            try {
                Log_1.default.test('Making request');
                response = yield request(app).get(url).set('user', auth.personId).set('token', auth.token);
                Log_1.default.test('Response received');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test('checking assertions on: response');
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
        });
    }).timeout(TIMEOUT);
    /**
     * This one is a bit controversial:
     *
     * While this means students _could_ log each other out, it also means that we
     * don't get into states where people can't logout on their own. Better safe
     * than sorry in this dimension.
     */
    it('Should be able to logout even if token is bad.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            // make sure there is a token to logout
            yield dc.writeAuth({ personId: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            let auth = yield dc.getAuth(GlobalSpec_1.Test.USERNAME1);
            chai_1.expect(auth).to.not.be.null;
            let response = null;
            let body;
            const url = '/portal/logout';
            try {
                Log_1.default.test('Making undefined token request');
                // undefined token
                response = yield request(app).get(url).set('user', auth.personId);
                Log_1.default.test('Response received');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test('checking assertions on: response');
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            try {
                Log_1.default.test('Making null token request');
                // null token
                response = yield request(app).get(url).set('user', auth.personId).set('token', null);
                Log_1.default.test('Response received');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test('checking assertions on: response');
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
        });
    }).timeout(TIMEOUT);
    /**
     * This one is a bit controversial:
     *
     * While this means students _could_ log each other out, it also means that we
     * don't get into states where people can't logout on their own. Better safe
     * than sorry in this dimension.
     */
    it('Should fail to logout if user is bad.', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            // make sure there is a token to logout
            yield dc.writeAuth({ personId: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' });
            let auth = yield dc.getAuth(GlobalSpec_1.Test.USERNAME1);
            chai_1.expect(auth).to.not.be.null;
            let response = null;
            let body;
            const url = '/portal/logout';
            try {
                Log_1.default.test('Making undefined user request');
                // undefined user
                response = yield request(app).get(url).set('token', auth.token);
                Log_1.default.test('Response received');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test('checking assertions on: response');
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.failure).to.not.be.undefined;
            try {
                Log_1.default.test('Making null user request');
                // null user
                response = yield request(app).get(url).set('user', null).set('token', auth.token);
                Log_1.default.test('Response received');
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test('checking assertions on: response');
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.failure).to.not.be.undefined;
        });
    }).timeout(TIMEOUT);
});
//# sourceMappingURL=AuthRoutesSpec.js.map