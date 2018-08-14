import {expect} from "chai";
import "mocha";
import BackendServer from "../../../src/server/BackendServer";
import {ConfigKey} from "../../../../../common/Config";
import Config from "../../../../../common/Config";
import Log from "../../../../../common/Log";
import {fail} from "assert";
// import request = require("request");
const request = require('supertest');
import {Test} from "../../GlobalSpec";
import restify = require('restify');
import {QuestionGrade} from "../../../../../common/types/CS340Types";
import {PersonController} from "../../../src/controllers/PersonController";
import {GitHubActions} from "../../../src/controllers/GitHubActions";

const loadFirst = require('../../GlobalSpec');
const https = require('https');

// import {expect} from "chai";
// import "mocha";
//
// import Log from "../../../../../common/Log";
// import {Test} from "../../GlobalSpec";
//
// import BackendServer from "../../../src/server/BackendServer";
// import {Grade, Person} from "../../../src/Types";
// import {PersonController} from "../../../src/controllers/PersonController";
// import Config, {ConfigKey} from "../../../../../common/Config";
// import {GitHubActions} from "../../../src/controllers/GitHubActions";
// import {DatabaseController} from "../../../src/controllers/DatabaseController";
// import {RepositoryController} from "../../../src/controllers/RepositoryController";
//
// const loadFirst = require('../../GlobalSpec');
//
// import restify = require('restify');
//
// const request = require('supertest');
// const https = require('https');

const TIMEOUT = 7500;

let DELAY_SEC = 1000;
let DELAY_SHORT = 200;


describe("CS340: Routes", () => {
    let app: restify.Server = null;
    let server: BackendServer = null;

    let OLDNAME = Config.getInstance().getProp(ConfigKey.name);
    let OLDORG = Config.getInstance().getProp(ConfigKey.org);
    let name: string;

    let numberOfStudents: number;

    before(async () => {
        Log.test("CS340Routes::before - start");
        Config.getInstance().setProp(ConfigKey.name, 'cs340');
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        let pc: PersonController = new PersonController();
        let peopleList = await pc.getAllPeople();
        numberOfStudents = peopleList.length;


        name = Config.getInstance().getProp(ConfigKey.name);

        return server.start().then(function () {
            Log.test('CS340Routes::before - server started');
            // Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function (err) {
            // probably ok; ust means server is already started
            Log.test('CS340Routes::before - server might already be started: ' + err);
        });

    });


    after(async function () {
        Log.test('CS340Routes::after - start');

        Config.getInstance().setProp(ConfigKey.name, OLDNAME);
        Config.getInstance().setProp(ConfigKey.org, OLDORG);

        return server.stop();
    });

    it("Clean up stale repos", async function() {
        Log.test("Cleaning up stale repositories...");
        await deleteStale();
    }).timeout(2 * TIMEOUT);

    it("Should be able to get all deliverables.", async function () {
        let response = null;
        const url = '/portal/cs340/getAllDeliverables';

        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
            // response = await request(app).get(url).send({}).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            // fail(err);
            // done();
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });


    it("Should be able to get assignment rubric based on ID", async function() {
        let aid = "test_assignDeliv3";
        let response = null;
        const url = '/portal/cs340/getAssignmentRubric/' + aid;
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all assignment rubrics", async function() {
        let response = null;
        const url = '/portal/cs340/getAllAssignmentRubrics/';
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should not be able to set a student's grade if there is no repo", async function() {
        let aid = "test_assignDeliv3";
        let pc: PersonController = new PersonController();
        let allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        let aPayload = {
            assignmentID: aid,
            studentID:    allPeople[0].id,
            questions:    [
                {
                    questionName: "Question 1",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       4,
                            feedback:    "Good job!"
                        },
                        {
                            sectionName: "reasoning",
                            grade:       5,
                            feedback:    ""
                        }
                    ]
                },
                {
                    questionName: "Question 2",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       4,
                            feedback:    "Improper implementation"
                        }
                    ]
                }
            ]
        };

        let response = null;
        const url = '/portal/cs340/setAssignmentGrade';

        // TODO: Verify this

        try{
            response = await request(app).put(url).send(aPayload).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(400);
        expect(response.body.response).to.not.be.null;
    });


    it("Should be able to get all grades", async function() {
        let response = null;
        const url = '/portal/cs340/getAllGrades';
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all Submissions using assignment ID.", async function() {
        let aid = "test_assignDeliv3";

        let response = null;
        const url = '/portal/cs340/getAllSubmissionsByDelivID/' + aid;
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get a person using their Github username", async function() {
        let pc: PersonController = new PersonController();
        let allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);
        let sid = allPeople[0].githubId;

        let response = null;
        const url = '/portal/cs340/getPersonByID/' + sid;
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all persons", async function() {
        let response = null;
        const url = '/portal/cs340/getAllPersons' ;
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to update the assignment status", async function() {
        let response = null;
        let aid = "test_assignDeliv3";

        const url = '/portal/cs340/updateAssignmentStatus/' + aid;
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });


    it("Should be able to get the assignment status", async function() {
        let response = null;
        let aid = "test_assignDeliv3";

        const url = '/portal/cs340/getAssignmentStatus/' + aid;
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });


    it("Should be able to initialize all repositories", async function() {
        let response = null;
        let aid = "test_assignDeliv3";

        const url = '/portal/cs340/initializeAllRepositories/' + aid;
        try{
            response = await request(app).post(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(numberOfStudents * TIMEOUT);


    it("Should be able to publish all repositories", async function() {
        let response = null;
        let aid = "test_assignDeliv3";



        const url = '/portal/cs340/publishAllRepositories/' + aid;
        try{
            response = await request(app).post(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(2 * TIMEOUT);

    it("Should be able to set a student's grade", async function() {
        Log.test("CS340RoutesSpec:: should be able to set a student's grade");

        let aid = "test_assignDeliv3";
        let pc: PersonController = new PersonController();
        let allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        // find rthse2
        let index = -1;
        for(let i = 0; i < allPeople.length; i++) {
            if(allPeople[i].githubId === 'rthse2') {

                index = i;
                break;
            }
        }

        if(index === -1) {
            fail("Unable to find rthse2 in records, something is wrong with the database...");
        }

        let aPayload = {
            assignmentID: aid,
            studentID:    allPeople[index].id,
            questions:    [
                {
                    questionName: "Question 1",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       4,
                            feedback:    "Good job!"
                        },
                        {
                            sectionName: "reasoning",
                            grade:       5,
                            feedback:    ""
                        }
                    ]
                },
                {
                    questionName: "Question 2",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       4,
                            feedback:    "Improper implementation"
                        }
                    ]
                }
            ]
        };

        let response = null;
        const url = '/portal/cs340/setAssignmentGrade';

        // TODO: Verify this

        try{
            response = await request(app).put(url).send(aPayload).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(2 * TIMEOUT);

    it("Should be able to get a specific grade using student ID and assignment ID", async function() {

        Log.test("CS340RoutesSpec:: get specific grade");

        let aid = "test_assignDeliv3";
        let pc: PersonController = new PersonController();
        let allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        // find rthse2
        let index = -1;
        for(let i = 0; i < allPeople.length; i++) {
            if(allPeople[i].githubId === 'rthse2') {
                index = i;
                break;
            }
        }

        if(index === -1) {
            fail("Unable to find rthse2 in records, something is wrong with the database...");
        }

        let sid = allPeople[index].id;

        let response = null;
        const url = '/portal/cs340/getAssignmentGrade/' + sid + '/' + aid;
        try{
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(2 * TIMEOUT);



    it("Should be able to delete a specific repository", async function() {
        let response = null;
        let aid = "test_assignDeliv3";
        let pc: PersonController = new PersonController();

        let allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        // find rthse2
        let index = -1;
        for(let i = 0; i < allPeople.length; i++) {
            if(allPeople[i].githubId === 'rthse2') {
                index = i;
                break;
            }
        }

        if(index === -1) {
            fail("Unable to find rthse2 in records, something is wrong with the database...");
        }

        let sid = allPeople[index].githubId;


        const url = '/portal/cs340/deleteRepository/' + aid + '/' + aid + '_' + sid;
        try{
            response = await request(app).post(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });


    it("Should be able to delete all repositories of a given assignment", async function() {
        let response = null;
        let aid = "test_assignDeliv3";

        const url = '/portal/cs340/deleteAllRepositories/' + aid;
        try{
            response = await request(app).post(url).set({name: name, user: Test.USER1.id, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Clean up stale repos", async function() {
        Log.test("Cleaning up stale repositories...");
        await deleteStale();
    }).timeout(numberOfStudents * TIMEOUT);



    // it("Should be able to ", async function() {
    //
    // });
    //
    //
    // it("Should be able to ", async function() {
    //
    // });
    //
    //
    // it("Should be able to ", async function() {
    //
    // });
    //
    //
    // it("Should be able to ", async function() {
    //
    // });
    //
    //
    // it("Should be able to ", async function() {
    //
    // });

    /*
        ========= IMPORTED CODE FROM GITHUBACTIONSPEC ===========
     */

    async function deleteStale(): Promise<true> {
        Log.test('GitHubActionSpec::deleteStale() - start');
        let gh: GitHubActions = new GitHubActions();
        let repos = await gh.listRepos();
        expect(repos).to.be.an('array');
        // expect(repos.length > 0).to.be.true; // test org can be empty

        // delete test repos if needed
        for (const repo of repos as any) {
            for (const r of TESTREPONAMES) {
                if (repo.name === r) {
                    Log.info('Removing stale repo: ' + repo.name);
                    let val = await gh.deleteRepo(r);
                    await gh.delay(DELAY_SHORT);
                    // expect(val).to.be.true;
                }
            }
        }

        repos = await gh.listRepos();
        // delete test repos if needed
        for (const repo of repos as any) {
            Log.info('Evaluating repo: ' + repo.name);
            if (repo.name.indexOf('TEST__X__') === 0 ||
                repo.name.startsWith(REPONAME) ||
                repo.name.startsWith("test_")) {
                Log.info('Removing stale repo: ' + repo.name);
                let val = await gh.deleteRepo(repo.name);
                // expect(val).to.be.true;
                let teamName = repo.name.substr(15);
                Log.info('Adding stale team name: ' + repo.name);
                TESTTEAMNAMES.push(teamName);
            }
        }

        // delete teams if needed
        let teams = await gh.listTeams();
        expect(teams).to.be.an('array');
        // expect(teams.length > 0).to.be.true; // can have 0 teams
        Log.test('All Teams: ' + JSON.stringify(teams));
        Log.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
        for (const team of teams as any) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            let done = false;
            for (const t of TESTTEAMNAMES) {
                if (team.name === t ||
                    team.name.startsWith("test_assignDeliv3_")
                ) {
                    Log.test("Removing stale team: " + team.name);
                    let val = await gh.deleteTeam(team.id);
                    await gh.delay(DELAY_SHORT);
                    done = true;
                }
            }
            if (done === false) {
                if (team.name.startsWith(TEAMNAME) === true) {
                    Log.test("Removing stale team: " + team.name);
                    let val = await gh.deleteTeam(team.id);
                    await gh.delay(DELAY_SHORT);
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done');
        return true;
    }

});

const REPONAME = getProjectPrefix() + "test_assignDeliv3";
const REPONAME3 = getProjectPrefix() + Test.REPONAME3;
const TEAMNAME = getTeamPrefix() + Test.TEAMNAME1;

let TESTREPONAMES = [
    "testtest__repo1",
    "secap_cpscbot",
    "secap_rthse2",
    "secap_ubcbot",
    "secap_testtest__repo1",
    "TESTrepo1",
    "TESTrepo2",
    "TESTrepo3",
];

let TESTTEAMNAMES = [
    "rtholmes",
    "ubcbot",
    "rthse2",
    "cpscbot",
    "TEST__X__t_TESTteam1",
    "TESTteam1",
    "TESTteam2",
    "TESTteam3",
];

function getProjectPrefix(): string {
    return "TEST__X__secap_";
}

function getTeamPrefix() {
    return "TEST__X__t_";
}
