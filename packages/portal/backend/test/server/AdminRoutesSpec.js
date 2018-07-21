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
const DeliverablesController_1 = require("../../src/controllers/DeliverablesController");
const Config_1 = require("../../../../common/Config");
const request = require('supertest');
const loadFirst = require("./AuthRoutesSpec");
describe('Admin Routes', function () {
    const TIMEOUT = 5000;
    var app = null;
    var server = null;
    var userName = GlobalSpec_1.Test.USERNAMEADMIN;
    var userToken;
    before(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test('AdminRoutes::before - start');
        // Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest);
        // Test.ORGNAME = Config.getInstance().getProp(ConfigKey.testorg);
        let db = DatabaseController_1.DatabaseController.getInstance();
        // await db.clearData(); // nuke everything
        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer_1.default(false);
        return server.start().then(function () {
            Log_1.default.test('AdminRoutes::before - server started');
            app = server.getServer();
            const dc = DatabaseController_1.DatabaseController.getInstance();
            return dc.getAuth(userName);
        }).then(function (auth) {
            Log_1.default.test('AdminRoutes::before - token set');
            userToken = auth.token;
        }).catch(function (err) {
            Log_1.default.test('AdminRoutes::before - server might already be started: ' + err);
        });
    }));
    after(() => __awaiter(this, void 0, void 0, function* () {
        Log_1.default.test('AdminRoutes::after - start');
        return server.stop();
    }));
    it('Should be able to get a list of students', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/students';
            try {
                response = yield request(app).get(url).set({ user: userName, token: userToken });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success).to.be.an('array');
            // expect(body.success).to.have.lengthOf(101);
            // should confirm body.success objects (at least one)
        });
    });
    it('Should not be able to get a list of students if the requestor is not privileged', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/students';
            try {
                response = yield request(app).get(url).set({ user: GlobalSpec_1.Test.USERNAME1, token: userToken });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(401);
            chai_1.expect(body.success).to.be.undefined;
            chai_1.expect(body.failure).to.not.be.undefined;
        });
    });
    it('Should be able to get a list of deliverables', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/deliverables';
            try {
                response = yield request(app).get(url).set({ user: userName, token: userToken });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success).to.be.an('array');
            chai_1.expect(body.success).to.have.lengthOf(5);
            const dc = new DeliverablesController_1.DeliverablesController();
            const actual = dc.validateDeliverableTransport(body.success[0]);
            chai_1.expect(actual).to.be.null; // make sure at least one of the deliverables validates
        });
    });
    it('Should be able to create a new deliverable', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/deliverable';
            try {
                const deliv = {
                    id: 'd' + new Date().getTime(),
                    openTimestamp: new Date().getTime(),
                    closeTimestamp: new Date().getTime(),
                    minTeamSize: 1,
                    maxTeamSize: 1,
                    teamsSameLab: false,
                    studentsFormTeams: false,
                    onOpenAction: '',
                    onCloseAction: '',
                    URL: 'url',
                    gradesReleased: false,
                    autoTest: {
                        dockerImage: '',
                        maxExecTime: 300,
                        studentDelay: 10000,
                        regressionDelivIds: [],
                        custom: {}
                    },
                    custom: {}
                };
                response = yield request(app).post(url).send(deliv).set({ user: userName, token: userToken });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.message).to.be.an('string');
        });
    });
    it('Should fail to create a new deliverable if the object is invalid', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/deliverable';
            try {
                const deliv = {
                    id: null,
                    openTimestamp: new Date().getTime(),
                    closeTimestamp: new Date().getTime(),
                    minTeamSize: 1,
                    maxTeamSize: 1,
                    teamsSameLab: false,
                    studentsFormTeams: false,
                    onOpenAction: '',
                    onCloseAction: '',
                    URL: 'url',
                    gradesReleased: false,
                    autoTest: {
                        dockerImage: '',
                        maxExecTime: 300,
                        studentDelay: 10000,
                        regressionDelivIds: [],
                        custom: {}
                    },
                    custom: {}
                };
                response = yield request(app).post(url).send(deliv).set({ user: userName, token: userToken });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(400);
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.message).to.be.an('string');
        });
    });
    it('Should fail to create a new deliverable if the user is not an admin', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // this test looks like overkill
            // but we want to have
            // 1) a valid user with valid tokens (who happens to be a student)
            // 2) a valid deliverable
            // and we _still_ want it all to fail
            const dc = DatabaseController_1.DatabaseController.getInstance();
            yield dc.writeAuth({ personId: GlobalSpec_1.Test.USERNAME1, token: 'testtoken' }); // create an auth record
            const auth = yield dc.getAuth(GlobalSpec_1.Test.USERNAME1);
            const token = auth.token;
            let response = null;
            let body;
            const url = '/portal/admin/deliverable';
            try {
                const deliv = {
                    id: 'd' + new Date().getTime(),
                    openTimestamp: new Date().getTime(),
                    closeTimestamp: new Date().getTime(),
                    minTeamSize: 1,
                    maxTeamSize: 1,
                    teamsSameLab: false,
                    studentsFormTeams: false,
                    onOpenAction: '',
                    onCloseAction: '',
                    URL: 'url',
                    gradesReleased: false,
                    autoTest: {
                        dockerImage: '',
                        maxExecTime: 300,
                        studentDelay: 10000,
                        regressionDelivIds: [],
                        custom: {}
                    },
                    custom: {}
                };
                response = yield request(app).post(url).send(deliv).set({ user: GlobalSpec_1.Test.USERNAME1, token: token });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(401);
            chai_1.expect(body.failure).to.not.be.undefined;
            chai_1.expect(body.failure.message).to.be.an('string');
        });
    });
    it('Should be able to update a deliverable', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const newTime = new Date().getTime();
            const dc = new DeliverablesController_1.DeliverablesController();
            const url = '/portal/admin/deliverable';
            try {
                let originalDelivs = yield dc.getAllDeliverables();
                const d0 = originalDelivs[0];
                const deliv = {
                    id: d0.id,
                    openTimestamp: d0.openTimestamp,
                    closeTimestamp: d0.closeTimestamp,
                    minTeamSize: d0.teamMinSize,
                    maxTeamSize: d0.teamMaxSize,
                    teamsSameLab: d0.teamSameLab,
                    studentsFormTeams: d0.teamStudentsForm,
                    onOpenAction: '',
                    onCloseAction: '',
                    URL: d0.URL,
                    gradesReleased: d0.gradesReleased,
                    autoTest: d0.autotest,
                    custom: d0.custom
                };
                // make sure the times were not already the new time
                chai_1.expect(deliv.openTimestamp).to.not.equal(newTime);
                chai_1.expect(deliv.closeTimestamp).to.not.equal(newTime);
                // update the times
                deliv.openTimestamp = newTime;
                deliv.closeTimestamp = newTime;
                // send an update
                response = yield request(app).post(url).send(deliv).set({ user: userName, token: userToken });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            // make sure the update did not fail
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.message).to.be.an('string');
            Log_1.default.test('update did not fail');
            // check that the newtime was updated
            let originalDelivs = yield dc.getAllDeliverables();
            const d0updated = originalDelivs[0];
            chai_1.expect(d0updated.openTimestamp).to.equal(newTime);
            chai_1.expect(d0updated.closeTimestamp).to.equal(newTime);
            Log_1.default.test('update did update the value');
        });
    });
    it('Should be able to upload a new classlist', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/classlist';
            try {
                response = yield request(app).post(url).attach('classlist', 'test/data/classlistValid.csv').set({
                    user: userName,
                    token: userToken
                });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
                chai_1.expect.fail('should not happen');
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success.message).to.be.an('string');
        });
    });
    it('Should fail to upload bad classlists', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/classlist';
            try {
                response = yield request(app).post(url).attach('classlist', 'test/data/classlistInvalid.csv').set({
                    user: userName,
                    token: userToken
                });
                body = response.body;
                Log_1.default.test(response.status + " -> " + JSON.stringify(body));
                chai_1.expect(response.status).to.equal(400);
                chai_1.expect(body.failure).to.not.be.undefined;
                chai_1.expect(body.failure.message).to.be.an('string'); // test column missing
                response = yield request(app).post(url).attach('classlist', 'test/data/classlistEmpty.csv').set({
                    user: userName,
                    token: userToken
                });
                body = response.body;
                Log_1.default.test(response.status + " -> " + JSON.stringify(body));
                chai_1.expect(response.status).to.equal(400);
                chai_1.expect(body.failure).to.not.be.undefined;
                chai_1.expect(body.failure.message).to.be.an('string'); // test no records found
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
                chai_1.expect.fail('should not happen');
            }
        });
    });
    it('Should be able to get the course object', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/course';
            try {
                response = yield request(app).get(url).set({ user: userName, token: userToken });
                body = response.body;
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
            Log_1.default.test(response.status + " -> " + JSON.stringify(body));
            chai_1.expect(response.status).to.equal(200);
            chai_1.expect(body.success).to.not.be.undefined;
            chai_1.expect(body.success).to.be.an('object');
            // TODO: check its properties
        });
    });
    it('Should be able to update the course object', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let response = null;
            let body;
            const url = '/portal/admin/course';
            try {
                const newId = Date.now() + 'id';
                const course = {
                    id: Config_1.default.getInstance().getProp(Config_1.ConfigKey.testname),
                    defaultDeliverableId: newId,
                    custom: {}
                };
                response = yield request(app).post(url).send(course).set({ user: userName, token: userToken });
                body = response.body;
                Log_1.default.test(response.status + " -> " + JSON.stringify(body));
                chai_1.expect(response.status).to.equal(200);
                chai_1.expect(body.success).to.not.be.undefined;
                chai_1.expect(body.success.message).to.be.an('string');
                // replace the defaultDeliverableId
                course.defaultDeliverableId = 'd0';
                response = yield request(app).post(url).send(course).set({ user: userName, token: userToken });
                body = response.body;
                Log_1.default.test(response.status + " -> " + JSON.stringify(body));
                chai_1.expect(response.status).to.equal(200);
            }
            catch (err) {
                Log_1.default.test('ERROR: ' + err);
            }
        });
    });
});
//# sourceMappingURL=AdminRoutesSpec.js.map