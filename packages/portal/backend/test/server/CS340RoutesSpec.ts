import {expect} from "chai";
import "mocha";
import * as restify from 'restify';
import * as request from 'supertest';

import Config, {ConfigCourses, ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import Util from "../../../../common/Util";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {GitHubActions, IGitHubActions} from "../../src/controllers/GitHubActions";
import {TeamController} from "../../src/controllers/TeamController";

import BackendServer from "../../src/server/BackendServer";

import {Payload} from "../../../../common/types/PortalTypes";
import {GitHubController} from "../../src/controllers/GitHubController";
import {Test} from "../TestHarness";
import './AuthRoutesSpec';

describe('CS340 Routes', () => {
    let app: restify.Server = null;
    let server: BackendServer = null;

    const userName = Test.ADMIN1.id;
    let userToken: string;

    const OLDNAME = Config.getInstance().getProp(ConfigKey.name);
    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    // before(async () => {
    //     Log.test(`CS340Routes::before - start`);
    //
    //     await Test.suiteBefore(`CS340 Routes`);
    //
    //     // get data ready
    //     await Test.prepareAll();
    //
    //     try {
    //         // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
    //         server = new BackendServer(false);
    //
    //         await server.start();
    //         Log.test('CS340Routes::before - server started');
    //         app = server.getServer();
    //
    //         const dc: DatabaseController = DatabaseController.getInstance();
    //         const auth = await dc.getAuth(userName);
    //
    //         Log.test('CS340Routes::before - token set');
    //         userToken = auth.token;
    //     } catch (err) {
    //         Log.test('CS340Routes::before - server might already be started: ' + err);
    //     }
    // });

    before(async () => {
        Log.test('CS340Routes::before - start');

        await Test.suiteBefore('CS340 Routes');

        // get data ready
        await Test.prepareAll();

        Config.getInstance().setProp(ConfigKey.name, 'cs340');
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        try {
            // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
            server = new BackendServer(false);

            await server.start();
            Log.test('CS340Routes::before - server started');
            app = server.getServer();

            const dc: DatabaseController = DatabaseController.getInstance();
            const auth = await dc.getAuth(userName);

            Log.test('CS340Routes::before - token set');
            userToken = auth.token;
            Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest);

        } catch (err) {
            Log.test('CS340Routes::before - server might already be started: ' + err);
        }
    });

    after( async () => {
        Log.test(`CS340Routes::after - start`);

        Config.getInstance().setProp(ConfigKey.name, OLDNAME);
        Config.getInstance().setProp(ConfigKey.org, OLDORG);

        await server.stop();
        await Test.suiteAfter(`CS340 Routes`);
    });

    it("Should be able to retrieve a repository's URL", async () => {
        let response = null;
        let body: Payload;
        const url = '/portal/cs340/retrieveRepoUrl/' + Test.USER1.id + "/" + Test.DELIVID1;
        try {
            response = await request(app).get(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
    });

    it("Should be able to retrieve a student team from deliverable and studentId", async () => {
        let response = null;
        let body;
        const url = `/portal/cs340/getStudentTeamByDeliv/${Test.USER1.id}/${Test.DELIVID1}`;
        try {
            response = await request(app).get(url).set({user: userName, token: userToken});
            body = response.body;
        } catch (err) {
            Log.test('ERROR: ' + err);
        }
        Log.test(response.status + " -> " + JSON.stringify(body));
        expect(response.status).to.equal(200);
    });

    describe(`Slow CS340Route Tests`, () => {
        it(`Should be able to provision all repositories for a deliverable`, async () => {
            const dbc = DatabaseController.getInstance();
            await dbc.clearData();
            const gha: IGitHubActions = GitHubActions.getInstance(true);
            const ghc: GitHubController = new GitHubController(gha);

            await clearAll([Test.REPONAMEREAL], []);

            await Test.prepareAllReal();

            let response = null;
            let body = null;
            Log.test(`preforming the provisioning of all repositories for ${Test.DELIVID0}`);
            const url = `/portal/cs340/createAllRepositories/${Test.DELIVID0}`;
            try {
                response = await request(app).post(url).set({user: userName, token: userToken});
                body = response.body;
                Log.test(`first provision ${response.status} -> ${JSON.stringify(body)}`);
            } catch (e) {
                Log.error("ERROR: " + e);
            }

            expect(response.status).to.equal(200);
            expect(body.result).to.be.true;
        }).timeout(Test.TIMEOUTLONG * 5);

        it(`Should be able to release all repositories for a deliverable`, async () => {
            const dbc = DatabaseController.getInstance();
            await dbc.clearData();

            await clearAll([Test.REPONAMEREAL], []);

            await Test.prepareAllReal();

            let response = null;
            let body = null;
            Log.test(`preforming the provisioning of all repositories for ${Test.DELIVID0}`);
            const url = `/portal/cs340/releaseAllRepositories/${Test.DELIVID0}`;
            try {
                response = await request(app).post(url).set({user: userName, token: userToken});
                body = response.body;
                Log.test(`first release ${response.status} -> ${JSON.stringify(body)}`);
            } catch (e) {
                Log.error("ERROR: " + e);
            }

            expect(response.status).to.equal(200);
            expect(body.result).to.be.true;
        }).timeout(Test.TIMEOUTLONG * 5);

        it(`Should be able to close all repositories for a deliverable`, async () => {
            const dbc = DatabaseController.getInstance();
            await dbc.clearData();

            await clearAll([Test.REPONAMEREAL], []);

            await Test.prepareAllReal();

            let response = null;
            let body = null;
            Log.test(`preforming the provisioning of all repositories for ${Test.DELIVID0}`);
            const url = `/portal/cs340/closeAssignmentRepositories/${Test.DELIVID0}`;
            try {
                response = await request(app).post(url).set({user: userName, token: userToken});
                body = response.body;
                Log.test(`first close ${response.status} -> ${JSON.stringify(body)}`);
            } catch (e) {
                Log.error("ERROR: " + e);
            }

            expect(response.status).to.equal(200);
            expect(body.response).to.be.true;
        }).timeout(Test.TIMEOUTLONG * 5);
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
        // sometimes we need to clear resources on both github and the cache
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
});
