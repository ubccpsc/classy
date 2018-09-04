import {expect} from "chai";
import "mocha";
import * as restify from 'restify';
import * as request from 'supertest';

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {
    AutoTestResultPayload,
    CourseTransport,
    CourseTransportPayload,
    DeliverableTransport,
    DeliverableTransportPayload,
    Payload,
    ProvisionTransport,
    RepositoryPayload,
    StudentTransportPayload,
    TeamTransportPayload
} from "../../../../common/types/PortalTypes";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";

import BackendServer from "../../src/server/BackendServer";

import {Test} from "../GlobalSpec";
import './AuthRoutesSpec';
// import restify = require('restify');
// const request = require('supertest');
// const loadFirst = require("./AuthRoutesSpec");

describe.only('Admin Routes', function() {

    // const TIMEOUT = 5000;

    let app: restify.Server = null;
    let server: BackendServer = null;

    const userName = Test.ADMIN1.id;
    let userToken: string;

    before(async () => {
        Log.test('AdminRoutes::before - start');

        await Test.suiteBefore('Admin Routes');

        // get data ready
        await Test.prepareAll();

        try {
            // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
            server = new BackendServer(false);

            await server.start();
            Log.test('AdminRoutes::before - server started');
            app = server.getServer();

            const dc: DatabaseController = DatabaseController.getInstance();
            const auth = await dc.getAuth(userName);

            Log.test('AdminRoutes::before - token set');
            userToken = auth.token;
        } catch (err) {
            Log.test('AdminRoutes::before - server might already be started: ' + err);
        }
    });

    after(async () => {
        Log.test('AdminRoutes::after - start');
        await server.stop();
        await Test.suiteAfter('Admin Routes');
    });

    it('Should be able to get a list of students', async function() {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/portal/admin/students';
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
    }).timeout(Test.TIMEOUT);

    it('Should not be able to get a list of students if the requestor is not privileged', async function() {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/portal/admin/students';
        try {
            response = await request(app).get(url).set({user: Test.USER1.id, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
    });

    it('Should be able to get a list of teams', async function() {

        let response = null;
        let body: TeamTransportPayload;
        const url = '/portal/admin/teams';
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

        // should confirm body.success objects (at least one)
    });

    it('Should not be able to get a list of teams if the requestor is not privileged', async function() {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/portal/admin/teams';
        try {
            response = await request(app).get(url).set({user: Test.USER1.id, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
    });

    it('Should be able to get a list of students', async function() {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/portal/admin/grades';
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
    }).timeout(Test.TIMEOUT);

    it('Should not be able to get a list of grades if the requestor is not privileged', async function() {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/portal/admin/grades';
        try {
            response = await request(app).get(url).set({user: Test.USER1.id, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
    });

    it('Should be able to get a list of results', async function() {

        let response = null;
        let body: AutoTestResultPayload;
        const url = '/portal/admin/results/any/any';
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

    it('Should not be able to get a list of results if the requestor is not privileged', async function() {

        let response = null;
        let body: AutoTestResultPayload;
        const url = '/portal/admin/results/any/any';
        try {
            response = await request(app).get(url).set({user: Test.USER1.id, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
    });

    it('Should be able to get a list of repositories', async function() {

        let response = null;
        let body: RepositoryPayload;
        const url = '/portal/admin/repositories';
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
        expect(body.success).to.have.lengthOf(2);

        // check one entry
        const entry = body.success[0];
        expect(entry.id).to.not.be.undefined;
        expect(entry.URL).to.not.be.undefined;
    });

    it('Should be able to get a list of deliverables', async function() {

        let response = null;
        let body: DeliverableTransportPayload;
        const url = '/portal/admin/deliverables';
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

    it('Should be able to create a new deliverable', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/deliverable';
        try {
            const deliv = DeliverablesController.deliverableToTransport(
                Test.createDeliverable('d' + new Date().getTime()));

            // const deliv: DeliverableTransport = {
            //     id:                'd' + new Date().getTime(),
            //     openTimestamp:     new Date().getTime(),
            //     closeTimestamp:    new Date().getTime(),
            //     minTeamSize:       1,
            //     maxTeamSize:       1,
            //     teamsSameLab:      false,
            //     studentsFormTeams: false,
            //     onOpenAction:      '',
            //     onCloseAction:     '',
            //     URL:               'url',
            //     gradesReleased:    false,
            //     repoPrefix:        'r_',
            //     teamPrefix:        't_',
            //     autoTest:          {
            //         dockerImage:        '',
            //         maxExecTime:        300,
            //         studentDelay:       10000,
            //         regressionDelivIds: [],
            //         custom:             {}
            //     },
            //     visibleToStudents: true,
            //     rubric:            {},
            //     custom:            {}
            // };
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

    it('Should fail to create a new deliverable if the object is invalid', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/deliverable';
        try {
            const deliv = DeliverablesController.deliverableToTransport(
                Test.createDeliverable('d' + new Date().getTime()));
            deliv.id = null; // make invalid

            // const deliv: DeliverableTransport = {
            //     id:                null,
            //     openTimestamp:     new Date().getTime(),
            //     closeTimestamp:    new Date().getTime(),
            //     minTeamSize:       1,
            //     maxTeamSize:       1,
            //     teamsSameLab:      false,
            //     studentsFormTeams: false,
            //     onOpenAction:      '',
            //     onCloseAction:     '',
            //     URL:               'url',
            //     gradesReleased:    false,
            //     visibleToStudents: true,
            //     repoPrefix:        'r_',
            //     teamPrefix:        't_',
            //
            //     autoTest: {
            //         dockerImage:        '',
            //         maxExecTime:        300,
            //         studentDelay:       10000,
            //         regressionDelivIds: [],
            //         custom:             {}
            //     },
            //     rubric:   {},
            //     custom:   {}
            // };
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

    it('Should fail to create a new deliverable if the user is not an admin', async function() {

        // this test looks like overkill
        // but we want to have
        // 1) a valid user with valid tokens (who happens to be a student)
        // 2) a valid deliverable
        // and we _still_ want it all to fail

        const dc: DatabaseController = DatabaseController.getInstance();
        await dc.writeAuth({personId: Test.USER1.id, token: 'testtoken'}); // create an auth record
        const auth = await dc.getAuth(Test.USER1.id);
        const token = auth.token;

        let response = null;
        let body: Payload;
        const url = '/portal/admin/deliverable';
        try {

            const deliv = DeliverablesController.deliverableToTransport(
                Test.createDeliverable('d' + new Date().getTime()));

            // const deliv: DeliverableTransport = {
            //     id:                'd' + new Date().getTime(),
            //     openTimestamp:     new Date().getTime(),
            //     closeTimestamp:    new Date().getTime(),
            //     minTeamSize:       1,
            //     maxTeamSize:       1,
            //     teamsSameLab:      false,
            //     studentsFormTeams: false,
            //     onOpenAction:      '',
            //     onCloseAction:     '',
            //     URL:               'url',
            //     gradesReleased:    false,
            //     re
            //     autoTest: {
            //         dockerImage:        '',
            //         maxExecTime:        300,
            //         studentDelay:       10000,
            //         regressionDelivIds: [],
            //         custom:             {}
            //     },
            //     custom:   {}
            // };
            response = await request(app).post(url).send(deliv).set({user: Test.USER1.id, token: token});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.be.an('string');
    });

    it('Should be able to update a deliverable', async function() {

        let response = null;
        let body: Payload;
        const newTime = new Date().getTime();
        const dc = new DeliverablesController();
        const url = '/portal/admin/deliverable';
        try {
            const originalDelivs = await dc.getAllDeliverables();
            const d0 = originalDelivs[0];

            const deliv: DeliverableTransport = {
                id:                d0.id,
                openTimestamp:     d0.openTimestamp,
                closeTimestamp:    d0.closeTimestamp,
                shouldProvision:   d0.shouldProvision,
                importURL:         d0.importURL,
                minTeamSize:       d0.teamMinSize,
                maxTeamSize:       d0.teamMaxSize,
                teamsSameLab:      d0.teamSameLab,
                studentsFormTeams: d0.teamStudentsForm,
                onOpenAction:      '',
                onCloseAction:     '',
                repoPrefix:        d0.repoPrefix,
                teamPrefix:        d0.teamPrefix,
                visibleToStudents: d0.visibleToStudents,
                URL:               d0.URL,
                gradesReleased:    d0.gradesReleased,
                shouldAutoTest:    d0.shouldAutoTest,
                autoTest:          d0.autotest,
                rubric:            d0.rubric,
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
        const allDelivs = await dc.getAllDeliverables();
        const d0updated = allDelivs[0];
        expect(d0updated.openTimestamp).to.equal(newTime);
        expect(d0updated.closeTimestamp).to.equal(newTime);
        Log.test('update did update the value');
    });

    it('Should be able to upload a new classlist', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/classlist';
        try {
            response = await request(app).post(url).attach('classlist', __dirname + '/../data/classlistValid.csv').set({
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

    it('Should fail to upload bad classlists', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/classlist';
        try {
            response = await request(app).post(url).attach('classlist', __dirname + '/../data/classlistInvalid.csv').set({
                user:  userName,
                token: userToken
            });
            body = response.body;
            Log.test(response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.failure).to.not.be.undefined;
            expect(body.failure.message).to.be.an('string'); // test column missing

            response = await request(app).post(url).attach('classlist', __dirname + '/../data/classlistEmpty.csv').set({
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

    it('Should be able to upload an updated classlist', async function() {

        const dc = DatabaseController.getInstance();
        let people = await dc.getPeople();
        const peopleLength = people.length;
        const person = await dc.getPerson('rthse2');

        let response = null;
        let body: Payload;
        const url = '/portal/admin/classlist';
        try {
            response = await request(app).post(url).attach('classlist', __dirname + '/../data/classlistValidUpdate.csv').set({
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

        people = await dc.getPeople();
        expect(peopleLength).to.equal(people.length); // no new people should have been added
        const newPerson = await dc.getPerson('rthse2');
        expect(person.githubId).to.not.equal(newPerson.githubId); // should have been updated
        expect(person.labId).to.not.equal(newPerson.labId); // should have been updated
        expect(person.studentNumber).to.equal(newPerson.studentNumber); // should be the same

    });

    it('Should be able to get the course object', async function() {

        let response = null;
        let body: CourseTransportPayload;
        const url = '/portal/admin/course';
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

    it('Should be able to update the course object', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/course';
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

    it('Should not be able to update the course object with invalid settings', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/course';
        try {
            const newId = Date.now() + 'id';

            const course: any = {
                // id: 'some id', // THIS IS A REQUIRED FIELD
                defaultDeliverableId: newId,
                custom:               {}
            };
            response = await request(app).post(url).send(course).set({user: userName, token: userToken});
            body = response.body;
            Log.test(response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;
            expect(body.failure.message).to.be.an('string');

        } catch (err) {
            Log.test('ERROR: ' + err);
        }
    });

    it('Should be able to provision a deliverable', async function() {
        let response = null;
        let body: Payload;
        const url = '/portal/admin/provision';
        try {
            const provision: ProvisionTransport = {
                delivId:    Test.DELIVID0,
                formSingle: false
            };
            response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            body = response.body;
            Log.test('first provision: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.not.be.undefined;
            expect(body.success).to.be.an('array');
            expect(body.success.length).to.be.greaterThan(0);

            // provision again; should not make anything new
            response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            body = response.body;
            Log.test('second provision: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.be.an('array');
            expect(body.success.length).to.equal(0);
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
    });

    it('Should fail to provision a deliverable if invalid options are given', async function() {
        let response = null;
        let body: Payload;
        const url = '/portal/admin/provision';
        try {
            const provision: ProvisionTransport = {
                delivId:    Test.DELIVID0,
                formSingle: false
            };
            // bad token
            response = await request(app).post(url).send(provision).set({user: userName, token: Test.FAKETOKEN});
            body = response.body;
            Log.test('bad token: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

            // invalid deliverable
            provision.delivId = 'FAKEDELIVERABLE';
            response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            body = response.body;
            Log.test('invalid deliverable: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

            // non-provisioning deliverable
            provision.delivId = Test.DELIVID1;
            response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            body = response.body;
            Log.test('non-provisioning deliverable: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

        } catch (err) {
            Log.test('ERROR: ' + err);
        }
    });

    it('Should be able to release a deliverable', async function() {
        let response = null;
        let body: Payload;
        const url = '/portal/admin/release';
        try {
            const provision: ProvisionTransport = {
                delivId:    Test.DELIVID0,
                formSingle: false
            };
            response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            body = response.body;
            Log.test('first release: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.not.be.undefined;
            expect(body.success).to.be.an('array');
            expect(body.success.length).to.be.greaterThan(0);

            // release again; should not release anything new
            response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            body = response.body;
            Log.test('second release: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.be.an('array');
            expect(body.success.length).to.equal(0);
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
    });

    it('Should fail to release a deliverable if invalid options are given', async function() {
        let response = null;
        let body: Payload;
        const url = '/portal/admin/release';
        try {
            const provision: ProvisionTransport = {
                delivId:    Test.DELIVID0,
                formSingle: false
            };
            // bad token
            response = await request(app).post(url).send(provision).set({user: userName, token: Test.FAKETOKEN});
            body = response.body;
            Log.test('bad token: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

            // invalid deliverable
            provision.delivId = 'FAKEDELIVERABLE';
            response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            body = response.body;
            Log.test('invalid deliverable: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

            // non-provisioning deliverable
            provision.delivId = Test.DELIVID1;
            response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            body = response.body;
            Log.test('non-provisioning deliverable: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

        } catch (err) {
            Log.test('ERROR: ' + err);
        }
    });

});
