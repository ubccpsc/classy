import {expect} from "chai";
import "mocha";
import * as restify from 'restify';
import * as request from 'supertest';

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";

import {Test} from "../../../../common/TestHarness";
import {
    AutoTestConfigTransport,
    AutoTestResultPayload,
    CourseTransport,
    CourseTransportPayload,
    DeliverableTransport,
    DeliverableTransportPayload,
    Payload,
    RepositoryPayload,
    StudentTransportPayload,
    TeamFormationTransport,
    TeamTransportPayload
} from "../../../../common/types/PortalTypes";
import Util from "../../../../common/Util";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {GitHubActions} from "../../src/controllers/GitHubActions";
import {PersonController} from "../../src/controllers/PersonController";
import {TeamController} from "../../src/controllers/TeamController";
import BackendServer from "../../src/server/BackendServer";
import './AuthRoutesSpec';

describe('Admin Routes', function() {

    let app: restify.Server = null;
    let server: BackendServer = null;

    const userName = Test.ADMIN1.id;
    let userToken: string;

    const TIMEOUT = 1000;

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
        // should confirm body.success objects (at least one)
    }).timeout(Test.TIMEOUT);

    it('Should be able to get a list of students with cookies for authentication', async function() {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/portal/admin/students';
        try {
            response = await request(app).get(url).set('Cookie', 'token=' + userToken + '__' + userName);
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success).to.be.an('array');
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

    it('Should not be able to get a list of students with bad cookies for auth', async function() {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/portal/admin/students';
        try {
            response = await request(app).get(url).set('Cookie', 'token=BADTOKEN' + Date.now() + '__' + userName);
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
    });

    it('Should not be able to get a list of students without any auth data', async function() {

        let response = null;
        let body: StudentTransportPayload;
        const url = '/portal/admin/students';
        try {
            response = await request(app).get(url);
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

    it('Should be able to get a list of dashboard results', async function() {

        let response = null;
        let body: AutoTestResultPayload;
        const url = '/portal/admin/dashboard/any/any';
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

    it('Should not be able to get a list of dashboard results if the requestor is not privileged', async function() {

        let response = null;
        let body: AutoTestResultPayload;
        const url = '/portal/admin/dashboard/any/any';
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

    it('Should be able to export the list of dashboard results', async function() {

        let response = null;
        let body: AutoTestResultPayload;
        const url = '/portal/admin/export/dashboard/any/any';
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

    it('Should not be able to export the list of dashboard results if the requestor is not privileged', async function() {

        let response = null;
        let body: AutoTestResultPayload;
        const url = '/portal/admin/export/dashboard/any/any';
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
            const at = d0.autotest as AutoTestConfigTransport;
            at.openTimestamp = d0.openTimestamp;
            at.closeTimestamp = d0.closeTimestamp;

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
                lateAutoTest:      d0.lateAutoTest,
                shouldAutoTest:    d0.shouldAutoTest,
                autoTest:          at,
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
        expect(body.success).to.be.an('object');
        expect(body.success.classlist.length).to.equal(5);
    });

    it('Should fail to upload bad classlists', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/classlist';

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
        expect(body.failure.message).to.contain('no students');
    });

    it('Should be able to upload an updated classlist', async function() {

        const dc = DatabaseController.getInstance();
        let people = await dc.getPeople();
        const peopleLength = people.length;
        const person = await dc.getPerson('rthse2');
        person.githubId = 'oldGithub';
        await dc.writePerson(person); // change the github

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
        expect(body.success).to.be.an('object');
        expect(body.success.classlist.length).to.equal(5); // capture how many changed?

        people = await dc.getPeople();
        expect(peopleLength).to.equal(people.length); // no new people should have been added
        const newPerson = await dc.getPerson('rthse2');
        expect(person.githubId).to.not.equal(newPerson.githubId); // should have been updated
        expect(person.labId).to.not.equal(newPerson.labId); // should have been updated
        expect(person.studentNumber).to.equal(newPerson.studentNumber); // should be the same
    });

    it('Should be able to upload a new grades', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/grades/' + Test.DELIVID1;
        try {
            response = await request(app).post(url).attach('gradelist', __dirname + '/../data/gradesValid.csv').set({
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
        expect(body.success.message).to.contain('3 grades');
    });

    it('Should fail to upload a bad grades list', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/grades/' + Test.DELIVID1;

        response = await request(app).post(url).attach('gradelist', __dirname + '/../data/gradesInvalid.csv').set({
            user:  userName,
            token: userToken
        });
        body = response.body;
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.be.an('string'); // test column missing
        expect(body.failure.message).to.contain('column missing');

        response = await request(app).post(url).attach('gradelist', __dirname + '/../data/gradesEmpty.csv').set({
            user:  userName,
            token: userToken
        });
        body = response.body;
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.failure).to.not.be.undefined;
        expect(body.failure.message).to.be.an('string'); // test no records found
        expect(body.failure.message).to.contain('no grades');
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

        // TODO: check response properties
    });

    it('Should be able to update the course object', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/course';

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
    });

    it('Should not be able to update the course object with invalid settings', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/course';

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
    });

    describe("Slow AdminRoute Tests", () => {

        beforeEach(function() {
            const exec = Test.runSlowTest();

            if (exec) {
                Log.test("AdminRoutesSpec::slowTests - running: " + this.currentTest.title);
            } else {
                Log.test("AdminRoutesSpec::slowTests - skipping; will run on CI");
                this.skip();
            }
        });

        /**
         * With hybrid tests sometimes we need to make sure the cached TestGitHubActions and
         * live GitHubActions are consistently cleaned.
         *
         * @param {string[]} repoNames
         * @param {string[]} teamNames
         * @returns {Promise<void>}
         */
        async function clearAll(repoNames: string[], teamNames: string[]): Promise<void> {
            // somettimes we need to clear resources on both github and the cache
            Log.test("AdminRoutesSpec::clearAll() - start");
            const start = Date.now();

            const ghCache = GitHubActions.getInstance(false);
            const ghReal = GitHubActions.getInstance(true);
            const tcCache = new TeamController(ghCache);
            const tcReal = new TeamController(ghReal);

            for (const repoName of repoNames) {
                await ghCache.deleteRepo(repoName);
                await ghReal.deleteRepo(repoName);
            }

            for (const teamName of teamNames) {
                const cacheNum = await tcCache.getTeamNumber(teamName); // ghCache.getTeamNumber(teamName);
                await ghCache.deleteTeam(cacheNum);

                const realNum = await tcReal.getTeamNumber(teamName); // ghCache.getTeamNumber(teamName);
                await ghReal.deleteTeam(realNum);
            }

            Log.test("AdminRoutesSpec::clearAll() - done; took: " + Util.took(start));
        }

        it('Should be able to get a provision plan for a deliverable', async function() {

            let response = null;
            let body: RepositoryPayload;
            const url = '/portal/admin/provision/' + Test.DELIVIDPROJ;
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
            expect(body.success).to.have.lengthOf(0);

            // check one entry
            // const entry = body.success[0];
            // expect(entry.id).to.not.be.undefined;
            // expect(entry.URL).to.not.be.undefined;
        });

        // it('Should be able to perform provision', async function() {
        //     let response = null;
        //     let body: Payload;
        //     const url = '/portal/admin/provision/' + Test.DELIVIDPROJ + '/' + Test.REPONAME1;
        //     try {
        //         response = await request(app).post(url).send({}).set({user: userName, token: userToken});
        //         body = response.body;
        //     } catch (err) {
        //         Log.test('ERROR: ' + err);
        //     }
        //     Log.test(response.status + " -> " + JSON.stringify(body));
        //     expect(response.status).to.equal(200);
        //     expect(body.success).to.not.be.undefined;
        //     expect(body.success).to.be.an('array');
        //     expect(body.success[0].id).to.equal(Test.REPONAME1);
        // }).timeout(TIMEOUT * 30);

        it('Should be able to get a release plan for a deliverable', async function() {

            let response = null;
            let body: RepositoryPayload;
            const url = '/portal/admin/release/' + Test.DELIVIDPROJ;
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
            expect(body.success).to.have.lengthOf(0);

            // check one entry
            // const entry = body.success[0];
            // expect(entry.id).to.not.be.undefined;
            // expect(entry.URL).to.not.be.undefined;
        });

        // it('Should be able to perform release', async function() {
        //     let response = null;
        //     let body: Payload;
        //     const url = '/portal/admin/release/' + Test.REPONAME1;
        //     try {
        //         response = await request(app).post(url).send({}).set({user: userName, token: userToken});
        //         body = response.body;
        //     } catch (err) {
        //         Log.test('ERROR: ' + err);
        //     }
        //     Log.test(response.status + " -> " + JSON.stringify(body));
        //     expect(response.status).to.equal(200);
        //     expect(body.success).to.not.be.undefined;
        //     expect(body.success).to.be.an('array');
        //     expect(body.success.length).to.equal(0); // NOTE: this is terrible, something should be being released
        // }).timeout(TIMEOUT * 30);

        it('Should be able to perform a withdraw task', async function() {
            // This is tricky because the live github data will have a different team id than we're using locally

            const pc = new PersonController();
            const dc = DatabaseController.getInstance();

            let response = null;
            let body: Payload;
            const url = '/portal/admin/withdraw';
            try {
                response = await request(app).post(url).send({}).set({user: userName, token: userToken});
                body = response.body;
            } catch (err) {
                Log.test('ERROR: ' + err);
            }
            Log.test(response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.not.be.undefined;
            expect(body.success.message).to.be.an('string');
        }).timeout(TIMEOUT * 10);

        it('Should be able to sanity check a database', async function() {

            let response = null;
            let body: Payload;
            const url = '/portal/admin/checkDatabase/true';
            try {
                response = await request(app).post(url).send({}).set({user: userName, token: userToken});
                body = response.body;
            } catch (err) {
                Log.test('ERROR: ' + err);
            }
            Log.test(response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.not.be.undefined;
            expect(body.success.message).to.be.an('string');
        }).timeout(TIMEOUT * 10);

        it('Should be able to provision a deliverable', async function() {

            const dbc = DatabaseController.getInstance();
            await dbc.clearData();

            await clearAll([Test.REPONAMEREAL], []);

            // const gha = GitHubActions.getInstance();
            // await gha.deleteRepo(Test.REPONAMEREAL);

            await Test.prepareAllReal(); // create a valid set of users and teams

            let response = null;
            let body: Payload;
            let url = '/portal/admin/provision/' + Test.DELIVID0;

            Log.test('planning the provisioning');
            // first plan the url
            response = await request(app).get(url).set({user: userName, token: userToken});
            body = response.body;
            Log.test('plan: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.be.an('array');
            expect(body.success.length).to.be.greaterThan(0);

            // const provision: ProvisionTransport = {
            //     delivId:    Test.DELIVID0,
            //     formSingle: false
            // };

            Log.test('performing the provisioning');
            url = '/portal/admin/provision/' + Test.DELIVID0 + '/' + Test.REPONAMEREAL;
            // response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            response = await request(app).post(url).set({user: userName, token: userToken});
            body = response.body;
            Log.test('first provision: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.not.be.undefined;
            expect(body.success).to.be.an('array');
            expect(body.success.length).to.be.greaterThan(0);

            // Log.test('performing the provisioning a second time');
            // // provision again; should not make anything new
            // // response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            // response = await request(app).post(url).set({user: userName, token: userToken});
            // body = response.body;
            // Log.test('second provision: ' + response.status + " -> " + JSON.stringify(body));
            // expect(response.status).to.equal(200);
            // expect(body.success).to.be.an('array');
            // expect(body.success.length).to.equal(0);

        }).timeout(Test.TIMEOUTLONG);

        it('Should fail to provision a deliverable if invalid options are given', async function() {

            let response = null;
            let body: Payload;
            let url = '/portal/admin/provision/' + Test.DELIVID0 + '/' + Test.REPONAMEREAL;

            // const provision: ProvisionTransport = {
            //     delivId:    Test.DELIVID0,
            //     formSingle: false
            // };
            // bad token
            response = await request(app).post(url).set({user: userName, token: Test.FAKETOKEN});
            body = response.body;
            Log.test('bad token: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(401);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

            // invalid deliverable
            url = '/portal/admin/provision/' + 'FAKEDELIVERABLE' + '/' + Test.REPONAMEREAL;
            response = await request(app).post(url).set({user: userName, token: userToken});
            body = response.body;
            Log.test('invalid deliverable: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

            // non-provisioning deliverable
            url = '/portal/admin/provision/' + Test.DELIVID1 + '/' + Test.REPONAMEREAL;
            response = await request(app).post(url).set({user: userName, token: userToken});
            body = response.body;
            Log.test('non-provisioning deliverable: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;
        });

        it('Should be able to release a deliverable', async function() {

            let response = null;
            let body: Payload;
            const url = '/portal/admin/release/' + Test.REPONAMEREAL;

            // const provision: ProvisionTransport = {
            //     delivId:    Test.DELIVID0,
            //     formSingle: false
            // };
            response = await request(app).post(url).set({user: userName, token: userToken});
            body = response.body;
            Log.test('first release: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(200);
            expect(body.success).to.not.be.undefined;
            expect(body.success).to.be.an('array');
            expect(body.success.length).to.be.greaterThan(0);

            // release again; should not release anything new
            // response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            // body = response.body;
            // Log.test('second release: ' + response.status + " -> " + JSON.stringify(body));
            // expect(response.status).to.equal(200);
            // expect(body.success).to.be.an('array');
            // expect(body.success.length).to.equal(0);
        }).timeout(Test.TIMEOUTLONG);

        it('Should fail to release a deliverable if invalid options are given', async function() {

            let response = null;
            let body: Payload;
            const url = '/portal/admin/release/repoId';

            response = await request(app).post(url).set({user: userName, token: Test.FAKETOKEN});
            body = response.body;
            Log.test('bad token: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(401);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

            // invalid deliverable
            response = await request(app).post(url).set({user: userName, token: userToken});
            body = response.body;
            Log.test('invalid deliverable: ' + response.status + " -> " + JSON.stringify(body));
            expect(response.status).to.equal(400);
            expect(body.success).to.be.undefined;
            expect(body.failure).to.not.be.undefined;

            // non-provisioning deliverable
            // provision.delivId = Test.DELIVID1;
            // response = await request(app).post(url).send(provision).set({user: userName, token: userToken});
            // body = response.body;
            // Log.test('non-provisioning deliverable: ' + response.status + " -> " + JSON.stringify(body));
            // expect(response.status).to.equal(400);
            // expect(body.success).to.be.undefined;
            // expect(body.failure).to.not.be.undefined;
        });
    });

    it('Should be able to create a team for a deliverable.', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/team';
        let ex = null;
        try {
            // create 2 people in an individual deliverable (should be allowed for admin)
            const team: TeamFormationTransport = {
                delivId:   Test.DELIVID0,
                githubIds: [Test.USER5.github, Test.USER6.github]
            };

            response = await request(app).post(url).send(team).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(ex).to.be.null;
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success).to.be.an('array');
        expect(body.success.length).to.equal(1);
    });

    it('Should fail to create a team for a deliverable if something is invalid', async function() {

        let response = null;
        let body: Payload;
        const url = '/portal/admin/team';
        let ex = null;
        const team: TeamFormationTransport = {
            delivId:   Test.DELIVID0,
            githubIds: [Test.USER5.github, Test.USER6.github]
        };
        try {
            // already on team
            response = await request(app).post(url).send(team).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(ex).to.be.null;
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;

        try {
            // invalid deliv
            team.delivId = 'INVALIDDELIVID' + Date.now();
            response = await request(app).post(url).send(team).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(ex).to.be.null;
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;

        try {
            // invalid user
            team.delivId = Test.DELIVID0;
            team.githubIds = ['INVALIDUSERNAME' + Date.now()];
            response = await request(app).post(url).send(team).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(ex).to.be.null;
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;

    }).timeout(Test.TIMEOUT);

    it('Should be able to delete a deliverable', async function() {
        const url = '/portal/admin/deliverable/' + Test.DELIVID0;
        let response = null;
        let body: Payload;
        let ex = null;
        try {
            response = await request(app).del(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.message).to.be.an('string');
        expect(ex).to.be.null;
    });

    it('Should fail to delete a deliverable if appropriate', async function() {
        const url = '/portal/admin/deliverable/';
        let response = null;
        let body: Payload;
        let ex = null;
        try {
            // delivId doesn't exist
            response = await request(app).del(url + Date.now()).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(ex).to.be.null;

        response = null;
        body = null;
        ex = null;
        try {
            // token is invalid
            response = await request(app).del(url + Test.DELIVIDPROJ).set({user: userName, token: Test.FAKETOKEN});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(ex).to.be.null;
    });

    it('Should be able to delete a repository', async function() {
        const url = '/portal/admin/repository/' + Test.REPONAME1;
        let response = null;
        let body: Payload;
        let ex = null;
        try {
            response = await request(app).del(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.message).to.be.an('string');
        expect(ex).to.be.null;
    }).timeout(Test.TIMEOUT);

    it('Should fail to delete a repository if appropriate', async function() {
        const url = '/portal/admin/repository/';
        let response = null;
        let body: Payload;
        let ex = null;
        try {
            // delivId doesn't exist
            response = await request(app).del(url + Date.now()).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(ex).to.be.null;

        response = null;
        body = null;
        ex = null;
        try {
            // token is invalid
            response = await request(app).del(url + Test.REPONAME1).set({user: userName, token: Test.FAKETOKEN});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(ex).to.be.null;
    });

    it('Should be able to delete a team', async function() {
        const url = '/portal/admin/team/' + Test.TEAMNAME1;
        let response = null;
        let body: Payload;
        let ex = null;
        try {
            response = await request(app).del(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
        expect(body.success).to.not.be.undefined;
        expect(body.success.message).to.be.an('string');
        expect(ex).to.be.null;
    });

    it('Should fail to delete a team if appropriate', async function() {
        const url = '/portal/admin/team/';
        let response = null;
        let body: Payload;
        let ex = null;
        try {
            // delivId doesn't exist
            response = await request(app).del(url + Date.now()).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(400);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(ex).to.be.null;

        response = null;
        body = null;
        ex = null;
        try {
            // token is invalid
            response = await request(app).del(url + Test.TEAMNAME1).set({user: userName, token: Test.FAKETOKEN});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
            ex = err;
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(401);
        expect(body.success).to.be.undefined;
        expect(body.failure).to.not.be.undefined;
        expect(ex).to.be.null;
    });

    it('Should be able to update a classlist if authorized as admin', async function() {
        let response = null;
        let body: Payload;
        const url = '/portal/admin/classlist';
        try {
            response = await request(app).put(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }

        expect(body).to.haveOwnProperty('success');
        expect(body.success).to.haveOwnProperty('created');
        expect(body.success).to.haveOwnProperty('updated');
        expect(body.success).to.haveOwnProperty('removed');
    });

    it('Should NOT be able to update a classlist if not authorized as admin', async function() {
        let response = null;
        let body: Payload;
        const url = '/portal/admin/classlist';
        try {
            response = await request(app).put(url);
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }

        expect(body).to.haveOwnProperty('failure');
    });
});
