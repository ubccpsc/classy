import {expect} from "chai";
import "mocha";
import Log from "../../../common/Log";

import BackendServer from "../../src/server/BackendServer";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {Test} from "../GlobalSpec";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import Config, {ConfigKey} from "../../../common/Config";
import {
    CourseTransport,
    CourseTransportPayload,
    DeliverableTransport,
    DeliverableTransportPayload,
    Payload,
    StudentTransportPayload,
} from "../../../common/types/PortalTypes";
import restify = require('restify');

const request = require('supertest');

const loadFirst = require("./AuthRoutesSpec");

describe('Admin Routes', function () {

    const TIMEOUT = 5000;

    var app: restify.Server = null;

    var server: BackendServer = null;

    var userName = Test.USERNAMEADMIN;
    var userToken: string;
    before(async () => {
        Log.test('AdminRoutes::before - start');

        // Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest);
        // Test.ORGNAME = Config.getInstance().getProp(ConfigKey.testorg);

        let db = DatabaseController.getInstance();
        // await db.clearData(); // nuke everything

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        return server.start().then(function () {
            Log.test('AdminRoutes::before - server started');
            app = server.getServer();

            const dc: DatabaseController = DatabaseController.getInstance();
            return dc.getAuth(userName);
        }).then(function (auth) {
            Log.test('AdminRoutes::before - token set');
            userToken = auth.token;
        }).catch(function (err) {
            Log.test('AdminRoutes::before - server might already be started: ' + err);
        });
    });

    after(function () {
        Log.test('AdminRoutes::after - start');
        return server.stop();
    });

    it('Should be able to get a list of students', async function () {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/admin/students';
        try {
            response = await request(app).get(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success).to.be.an('array');
        // expect(body.success).to.have.lengthOf(101);

        // should confirm body.success objects (at least one)
    });

    it('Should not be able to get a list of students if the requestor is not privileged', async function () {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/admin/students';
        try {
            response = await request(app).get(url).set({user: Test.USERNAME1, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
    });

    it('Should be able to get a list of deliverables', async function () {

        let response = null;
        let body: DeliverableTransportPayload;
        const url = '/admin/deliverables';
        try {
            response = await request(app).get(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success).to.be.an('array');
        expect(body.success).to.have.lengthOf(5);

        const dc = new DeliverablesController();
        const actual = dc.validateDeliverableTransport(body.success[0]);
        expect(actual).to.be.null; // make sure at least one of the deliverables validates
    });

    it('Should be able to create a new deliverable', async function () {

        let response = null;
        let body: Payload;
        const url = '/admin/deliverable';
        try {
            const deliv: DeliverableTransport = {
                id:                'd' + new Date().getTime(),
                openTimestamp:     new Date().getTime(),
                closeTimestamp:    new Date().getTime(),
                minTeamSize:       1,
                maxTeamSize:       1,
                teamsSameLab:      false,
                studentsFormTeams: false,
                onOpenAction:      '',
                onCloseAction:     '',
                URL:               'url',
                gradesReleased:    false,

                autoTest: {
                    dockerImage:        '',
                    maxExecTime:        300,
                    studentDelay:       10000,
                    regressionDelivIds: [],
                    custom:             {}
                },
                custom:   {}
            };
            response = await request(app).post(url).send(deliv).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.message).to.be.an('string');
    });

    it('Should fail to create a new deliverable if the object is invalid', async function () {

        let response = null;
        let body: Payload;
        const url = '/admin/deliverable';
        try {
            const deliv: DeliverableTransport = {
                id:                null,
                openTimestamp:     new Date().getTime(),
                closeTimestamp:    new Date().getTime(),
                minTeamSize:       1,
                maxTeamSize:       1,
                teamsSameLab:      false,
                studentsFormTeams: false,
                onOpenAction:      '',
                onCloseAction:     '',
                URL:               'url',
                gradesReleased:    false,

                autoTest: {
                    dockerImage:        '',
                    maxExecTime:        300,
                    studentDelay:       10000,
                    regressionDelivIds: [],
                    custom:             {}
                },
                custom:   {}
            };
            response = await request(app).post(url).send(deliv).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.be.an('string');
    });

    it('Should fail to create a new deliverable if the user is not an admin', async function () {

        // this test looks like overkill
        // but we want to have
        // 1) a valid user with valid tokens (who happens to be a student)
        // 2) a valid deliverable
        // and we _still_ want it all to fail

        const dc: DatabaseController = DatabaseController.getInstance();
        await dc.writeAuth({personId: Test.USERNAME1, token: 'testtoken'}); // create an auth record
        const auth = await dc.getAuth(Test.USERNAME1);
        const token = auth.token;

        let response = null;
        let body: Payload;
        const url = '/admin/deliverable';
        try {
            const deliv: DeliverableTransport = {
                id:                'd' + new Date().getTime(),
                openTimestamp:     new Date().getTime(),
                closeTimestamp:    new Date().getTime(),
                minTeamSize:       1,
                maxTeamSize:       1,
                teamsSameLab:      false,
                studentsFormTeams: false,
                onOpenAction:      '',
                onCloseAction:     '',
                URL:               'url',
                gradesReleased:    false,

                autoTest: {
                    dockerImage:        '',
                    maxExecTime:        300,
                    studentDelay:       10000,
                    regressionDelivIds: [],
                    custom:             {}
                },
                custom:   {}
            };
            response = await request(app).post(url).send(deliv).set({user: Test.USERNAME1, token: token});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.be.an('string');
    });

    it('Should be able to update a deliverable', async function () {

        let response = null;
        let body: Payload;
        const newTime = new Date().getTime();
        const dc = new DeliverablesController();
        const url = '/admin/deliverable';
        try {
            let originalDelivs = await dc.getAllDeliverables();
            const d0 = originalDelivs[0];

            const deliv: DeliverableTransport = {
                id:                d0.id,
                openTimestamp:     d0.openTimestamp,
                closeTimestamp:    d0.closeTimestamp,
                minTeamSize:       d0.teamMinSize,
                maxTeamSize:       d0.teamMaxSize,
                teamsSameLab:      d0.teamSameLab,
                studentsFormTeams: d0.teamStudentsForm,
                onOpenAction:      '',
                onCloseAction:     '',
                URL:               d0.URL,
                gradesReleased:    d0.gradesReleased,
                autoTest:          d0.autotest,
                custom:            d0.custom
            };

            // make sure the times were not already the new time
            expect(deliv.openTimestamp).to.not.equal(newTime);
            expect(deliv.closeTimestamp).to.not.equal(newTime);

            // update the times
            deliv.openTimestamp = newTime;
            deliv.closeTimestamp = newTime;

            // send an update
            response = await request(app).post(url).send(deliv).set({user: userName, token: userToken});
            body = response.body;

        } catch (err) {
            Log.test('ERROR: ' + err);
        }

        // make sure the update did not fail
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.message).to.be.an('string');
        Log.test('update did not fail');

        // check that the newtime was updated
        let originalDelivs = await dc.getAllDeliverables();
        const d0updated = originalDelivs[0];
        expect(d0updated.openTimestamp).to.equal(newTime);
        expect(d0updated.closeTimestamp).to.equal(newTime);
        Log.test('update did update the value');
    });

    it('Should be able to upload a new classlist', async function () {

        let response = null;
        let body: Payload;
        const url = '/admin/classlist';
        try {
            response = await request(app).post(url).attach('classlist', 'test/data/classlistValid.csv').set({
                user:  userName,
                token: userToken
            });
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            expect.fail('should not happen');
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.message).to.be.an('string');
    });


    it('Should fail to upload bad classlists', async function () {

        let response = null;
        let body: Payload;
        const url = '/admin/classlist';
        try {
            response = await request(app).post(url).attach('classlist', 'test/data/classlistInvalid.csv').set({
                user:  userName,
                token: userToken
            });
            body = response.body;
            Log.test(response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.failure).to.not.be.undefined;
            expect(body.failure.message).to.be.an('string'); // test column missing

            response = await request(app).post(url).attach('classlist', 'test/data/classlistEmpty.csv').set({
                user:  userName,
                token: userToken
            });
            body = response.body;
            Log.test(response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.failure).to.not.be.undefined;
            expect(body.failure.message).to.be.an('string'); // test no records found

        } catch (err) {
            Log.test('ERROR: ' + err);
            expect.fail('should not happen');
        }
    });


    it('Should be able to get the course object', async function () {

        let response = null;
        let body: CourseTransportPayload;
        const url = '/admin/course';
        try {
            response = await request(app).get(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success).to.be.an('object');
        // TODO: check its properties
    });

    it('Should be able to update the course object', async function () {

        let response = null;
        let body: Payload;
        const url = '/admin/course';
        try {
            const newId = Date.now() + 'id';

            const course: CourseTransport = {
                id:                   Config.getInstance().getProp(ConfigKey.testname),
                defaultDeliverableId: newId,
                custom:               {}
            };
            response = await request(app).post(url).send(course).set({user: userName, token: userToken});
            body = response.body;
            Log.test(response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.not.be.undefined;
            expect(body.success.message).to.be.an('string');

            // replace the defaultDeliverableId
            course.defaultDeliverableId = 'd0';
            response = await request(app).post(url).send(course).set({user: userName, token: userToken});
            body = response.body;
            Log.test(response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
        } catch (err) {
            Log.test('ERROR: ' + err);
        }


    });

});

