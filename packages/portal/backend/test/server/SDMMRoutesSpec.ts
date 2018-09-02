import {expect} from "chai";
import "mocha";
import * as restify from 'restify';
import * as request from 'supertest';
import Config, {ConfigKey} from "../../../../common/Config";

import Log from "../../../../common/Log";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {GitHubActions} from "../../src/controllers/GitHubActions";
import {GitHubController} from "../../src/controllers/GitHubController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {SDMMController} from "../../src/controllers/SDMM/SDMMController";
import {TeamController} from "../../src/controllers/TeamController";

import BackendServer from "../../src/server/BackendServer";
import {Grade} from "../../src/Types";
import {Test} from "../GlobalSpec";
import '../GlobalSpec';

// NOTE: skipped for now because the infrastructure spins up classytest
// which means the right routes aren't being started in the backend
// need to change how this loads to enable the right routes to be started
describe('SDMM Routes', function() {

    let app: restify.Server = null;
    let server: BackendServer = null;

    const OLDNAME = Config.getInstance().getProp(ConfigKey.name);
    const OLDORG = Config.getInstance().getProp(ConfigKey.org);
    // const user1id = Test.REALUSER1.github; // sdmm only uses github

    before(async function() {
        Log.test('SDMMRoutes::before - start');
        await Test.suiteBefore('SDMM Routes');

        // get data ready
        await Test.prepareDeliverables();

        // fix deliverables so they have test prefixes
        const delivC = new DeliverablesController();
        const dataC = DatabaseController.getInstance();
        const delivs = ["d0", "d1", "d2", "d3"];
        for (const dId of delivs) {
            const deliv = await delivC.getDeliverable(dId);
            deliv.repoPrefix = "TEST__X__p_";
            deliv.teamPrefix = "TEST__X__t_";
            await dataC.writeDeliverable(deliv);
        }

        Config.getInstance().setProp(ConfigKey.name, 'sdmm');

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        try {
            await server.start();
            Log.test('SDMMRoutesSpec::before - server started');
            app = server.getServer();
        } catch (err) {
            Log.test('SDMMRoutesSpec::before - server might already be started: ' + err);
        }
    });

    after(async function() {
        Log.test('SDMMRoutesSpec::after - start');
        Config.getInstance().setProp(ConfigKey.name, OLDNAME);
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
        await server.stop();
        await Test.suiteAfter('SDMM Routes');
    });

    async function clearGithub() {
        Log.test('SDMMRoutesSpec::clearGithub() - start');

        // clear repos from github
        const gha = new GitHubActions();
        await gha.deleteRepo('secap_' + Test.USERNAMEGITHUB1);
        await gha.deleteRepo('secap_' + Test.USERNAMEGITHUB2);
        await gha.deleteRepo('TEST__X__p_cpscbot');

        const dataC = DatabaseController.getInstance();
        const repos = await dataC.getRepositories();
        for (const repo of repos) {
            if (repo.id.startsWith('TEST__X__p_')) {
                await gha.deleteRepo(repo.id);
            }
        }

        const teams = await dataC.getTeams();
        for (const team of teams) {
            const teamNum = await gha.getTeamNumber(team.id);
            if (teamNum > 0 && team.id.startsWith('TEST__X__t_')) {
                await gha.deleteTeam(teamNum);
            }
        }

        await gha.deleteRepo('TEST__X__p_TEST__X__t_' + Test.USERNAMEGITHUB1);
        await gha.deleteRepo('TEST__X__p_TEST__X__t_' + Test.USERNAMEGITHUB2);
        await gha.deleteRepo('TEST__X__p_TEST__X__t_' + Test.USERNAMEGITHUB3);
        await gha.deleteRepo('TEST__X__p_TEST__X__t_' + Test.USERNAMEGITHUB4);

        const teamNames = ['TEST__X__t_' + Test.USERNAMEGITHUB1,
            'TEST__X__t_' + Test.USERNAMEGITHUB2,
            'TEST__X__t_' + Test.USERNAMEGITHUB3,
            'TEST__X__t_' + Test.USERNAMEGITHUB4];

        for (const tName of teamNames) {
            const teamNum = await gha.getTeamNumber(tName);
            if (teamNum > 0) {
                await gha.deleteTeam(teamNum);
            }
        }

        Log.test('SDMMRoutesSpec::clearGithub() - done');
    }

    it('Should be possible to clear stale state.', async function() {
        await clearGithub();
    }).timeout(Test.TIMEOUTLONG);

    it('Should not be able to get status without a token.', async function() {
        // NOTE: this subsumed valid uers checks since only valid users can have valid auth tokens

        let response = null;
        const url = '/portal/sdmm/currentStatus/';
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).get(url).set({name: name, user: 'ivaliduserstatusrequest', token: 'testtoken'});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));

        expect(response.status).to.equal(401);
        expect(response.body.failure).to.not.be.undefined;
        expect(response.body.failure.message).to.equal('Invalid login token. Please logout and try again.');
    });

    it('Should respond to a valid status request.', async function() {
        const dc: DatabaseController = DatabaseController.getInstance();

        const ghInstance = new GitHubController();
        const sc = new SDMMController(ghInstance);

        // create some users
        let p = await sc.handleUnknownUser(Test.USERNAMEGITHUB1);
        await dc.writePerson(p);
        p = await sc.handleUnknownUser(Test.USERNAMEGITHUB2);
        await dc.writePerson(p);
        p = await sc.handleUnknownUser(Test.USERNAMEGITHUB3);
        await dc.writePerson(p);

        // make sure some valid tokens exist
        await dc.writeAuth({personId: Test.USERNAMEGITHUB1, token: Test.REALTOKEN}); // create an auth record
        await dc.writeAuth({personId: Test.USERNAMEGITHUB2, token: Test.REALTOKEN}); // create an auth record
        await dc.writeAuth({personId: Test.USERNAMEGITHUB3, token: Test.REALTOKEN}); // create an auth record

        let response = null;
        const url = '/portal/sdmm/currentStatus/';
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).get(url).set({name: name, user: Test.USERNAMEGITHUB1, token: Test.REALTOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.success).to.not.be.undefined;
        expect(response.body.success.status).to.equal('D0PRE');
        // expect(response.body.success.d0).to.not.be.null; // TODO: changed during test isolation
        // expect(response.body.success.d1).to.not.be.null; // TODO: changed during test isolation
        expect(response.body.success.d0).to.be.null;
        expect(response.body.success.d1).to.be.null;
        expect(response.body.success.d2).to.be.null;
        expect(response.body.success.d3).to.be.null;
    });

    it('Should not be able perform an unknown action.', async function() {

        let response = null;
        const url = '/portal/sdmm/performAction/doRandomInvalidThing';
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAMEGITHUB1, token: Test.REALTOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400);

        expect(response.body.failure).to.not.be.undefined;
        expect(response.body.failure.message).to.contain('unknown action');
    });

    it('Should fail to perform an action if the token is invalid.', async function() {
        let response = null;
        const url = '/portal/sdmm/performAction/provisionD0';
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAMEGITHUB1, token: Test.FAKETOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(401);

        expect(response.body.failure).to.not.be.undefined;
        expect(response.body.failure.message).to.equal('Invalid login token. Please logout and try again.');
    });

    it('Should provision a d0 repo.', async function() {
        let response = null;

        // // this test is slow, so skip it if we aren't on CI
        // const shouldRun = Test.runSlowTest();
        // if (shouldRun === false) {
        //     this.skip();
        // }
        try {
            // const gha = new GitHubActions();
            // const deleted = await gha.deleteRepo('secap_' + Test.USERNAMEGITHUB1); // make sure the repo doesn't exist
            const url = '/portal/sdmm/performAction/provisionD0';
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAMEGITHUB1, token: Test.REALTOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.success).to.not.be.undefined;
        expect(response.body.success.message).to.equal('Repository successfully created.');
    }).timeout(Test.TIMEOUTLONG * 2);

    it('Should fail to provision a d0 repo if one already exists.', async function() {

        let response = null;
        const url = '/portal/sdmm/performAction/provisionD0';
        const rc = new RepositoryController();
        try {
            await rc.createRepository('secap_' + Test.USERNAMEGITHUB1, [], {}); // make sure the repo exists already
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAMEGITHUB1, token: Test.REALTOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }

        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400);

        expect(response.body.failure).to.not.be.undefined;
        // expect(response.body.failure.message).to.equal('Failed to provision d0 repo; ' +
        //     'repository already exists in datastore: secap_' + Test.USERNAMEGITHUB1);
    }).timeout(Test.TIMEOUTLONG);

    it('Should not be able provision a d1 repo if their d0 grade is too low.', async function() {

        let response = null;
        const url = '/portal/sdmm/performAction/provisionD1individual';
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAMEGITHUB1, token: Test.REALTOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400);

        expect(response.body.failure).to.not.be.undefined;
        expect(response.body.failure.message).to.equal('Current d0 grade is not sufficient to move on to d1.');
    }).timeout(Test.TIMEOUTLONG);

    it('Should be able provision a d1 individual repo.', async function() {

        let response = null;
        const url = '/portal/sdmm/performAction/provisionD1individual';
        try {
            const dc = DatabaseController.getInstance();
            const g: Grade = {
                personId:  Test.USERNAMEGITHUB1,
                delivId:   Test.DELIVID0,
                score:     90,
                comment:   'comment',
                timestamp: Date.now(),

                urlName: 'urlName',
                URL:     'url',

                custom: {}
            };
            await dc.writeGrade(g);

            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAMEGITHUB1, token: Test.REALTOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.success).to.not.be.undefined;
        expect(response.body.success.message).to.equal('D0 repo successfully updated to D1.');
    }).timeout(Test.TIMEOUTLONG);

    it('Should fail to provision a d1 team repo if both users are not known.', async function() {

        let response = null;
        const url = '/portal/sdmm/performAction/provisionD1team/somerandmomusernamethatdoesnotexist';
        try {
            const gha = new GitHubActions();
            await gha.deleteRepo('secap_' + Test.USERNAMEGITHUB1); // make sure the repo doesn't exist

            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAMEGITHUB1, token: Test.REALTOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(400);

        expect(response.body.failure).to.not.be.undefined;
        expect(response.body.failure.message).to.equal(
            'Username ( somerandmomusernamethatdoesnotexist ) not registered; contact course staff.');
    }).timeout(Test.TIMEOUTLONG);

    it('Should be able provision a d1 team repo.', async function() {

        let response = null;
        const url = '/portal/sdmm/performAction/provisionD1team/' + Test.USERNAMEGITHUB3;
        try {
            const dc = DatabaseController.getInstance();

            const tc = new TeamController();
            // public async createTeam(name: string, deliv: Deliverable, people: Person[], custom: any): Promise<Team | null> {
            const deliv = await dc.getDeliverable(Test.DELIVID0);
            const p2 = await dc.getPerson(Test.USERNAMEGITHUB2);
            const t2 = await tc.createTeam('secap_' + Test.TEAMNAME2, deliv, [p2], {});
            const p3 = await dc.getPerson(Test.USERNAMEGITHUB3);
            const t3 = await tc.createTeam('secap_' + Test.TEAMNAME3, deliv, [p3], {});
            const rc = new RepositoryController();
            await rc.createRepository('secap_' + Test.USERNAMEGITHUB2, [t2], {d0enabled: true}); // make sure the repo exists already
            await rc.createRepository('secap_' + Test.USERNAMEGITHUB3, [t3], {d0enabled: true}); // make sure the repo exists already

            let g: Grade = {
                personId:  Test.USERNAMEGITHUB2, // rthse2
                delivId:   Test.DELIVID0,
                score:     90,
                comment:   'comment',
                timestamp: Date.now(),

                urlName: 'urlName',
                URL:     'url',

                custom: {}
            };
            await dc.writeGrade(g);

            g = {
                personId:  Test.USERNAMEGITHUB3, // ubccpscbot
                delivId:   Test.DELIVID0,
                score:     90,
                comment:   'comment',
                timestamp: Date.now(),

                urlName: 'urlName',
                URL:     'url',

                custom: {}
            };
            await dc.writeGrade(g);

            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).post(url).send({}).set({name: name, user: Test.USERNAMEGITHUB2, token: Test.REALTOKEN});
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        // works on its own but not with others
        Log.test(response.status + " -> " + JSON.stringify(response.body));
        expect(response.status).to.equal(200);

        expect(response.body.success).to.not.be.undefined;
        expect(response.body.success.message).to.equal('D1 repository successfully provisioned.');
    }).timeout(Test.TIMEOUTLONG);
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
    //         response = await request(app).post(url).send({}).set({name: name, user: Test.USER1.id, token: 'testtoken'});
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
    //     const dbc = DatabaseController.getInstance();
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
    //     await dbc.writeGrade(g);
    //
    //     (<any>g).personId = Test.USERNAME3;
    //     g.score = 71;
    //     await dbc.writeGrade(g);
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
    //         response = await request(app).post(url).send({}).set({name: name, user: Test.USER1.id, token: 'testtoken'});
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

    it('Should be possible to clear stale state.', async function() {
        await clearGithub();
    }).timeout(Test.TIMEOUTLONG);

});
