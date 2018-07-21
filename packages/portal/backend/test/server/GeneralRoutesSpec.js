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
const Config_1 = require("../../../../common/Config");
const BackendServer_1 = require("../../src/server/BackendServer");
const DatabaseController_1 = require("../../src/controllers/DatabaseController");
const request = require('supertest');
describe('General Routes', function () {
    var app = null;
    var server = null;
    before(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test('GeneralRoutes::before - start');
        // Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest);
        // Test.ORGNAME = Config.getInstance().getProp(ConfigKey.testorg);
        let db = DatabaseController_1.DatabaseController.getInstance();
        // await db.clearData(); // nuke everything
        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer_1.default(false);
        return server.start().then(function () {
            Log_1.default.test('GeneralRoutes::before - server started');
            app = server.getServer();
        }).catch(function (err) {
            Log_1.default.test('GeneralRoutes::before - server might already be started: ' + err);
        });
    }));
    after(function () {
        Log_1.default.test('GeneralRoutes::after - start');
        return server.stop();
    });
    it('Should be able to get config details', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/config';
            try {
                response = yield request(app).get(url);
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.org).to.not.be.undefined;
            chai_1.expect(body.success.org).to.equal(Config_1.default.getInstance().getProp(Config_1.ConfigKey.org)); // valid .org usage
            chai_1.expect(body.success.name).to.equal(Config_1.default.getInstance().getProp(Config_1.ConfigKey.name));
        });
    });
});
//# sourceMappingURL=GeneralRoutesSpec.js.map