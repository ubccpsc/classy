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

describe("CS340: Routes", () => {
    let app: restify.Server = null;
    let server: BackendServer = null;

    let OLDNAME = Config.getInstance().getProp(ConfigKey.name);
    let OLDORG = Config.getInstance().getProp(ConfigKey.org);
    let name: string;

    before(() => {
        Log.test("CS340Routes::before - start");
        Config.getInstance().setProp(ConfigKey.name, 'cs340');


        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);
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


    after(function () {
        Log.test('CS340Routes::after - start');
        Config.getInstance().setProp(ConfigKey.name, OLDNAME);
        Config.getInstance().setProp(ConfigKey.org, OLDORG);
        return server.stop();
    });

    it("Should be able to get all deliverables.", async function () {
        let response = null;
        const url = '/portal/cs340/getAllDeliverables';

        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
            // response = await request(app).get(url).send({}).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
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
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
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
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to set a student's grade", async function() {
        let aid = "test_assignDeliv3";
        let pc: PersonController = new PersonController();
        let allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        let aPayload = {
            assignmentID: aid,
            studentID:    allPeople[0],
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
            response = await request(app).put(url).send(aPayload).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });


    it("Should be able to get all grades", async function() {
        let response = null;
        const url = '/portal/cs340/getAllGrades';
        try{
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get a specific grade using student ID and assignment ID", async function() {
        let aid = "test_assignDeliv3";
        let pc: PersonController = new PersonController();
        let allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);
        let sid = allPeople[0];

        let response = null;
        const url = '/portal/cs340/getAssignmentGrade/' + sid + '/' + aid;
        try{
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
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
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
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
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
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
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
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
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
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
            response = await request(app).get(url).set({name: name, user: Test.USERNAME1, token: 'testtoken'});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });


    it("Should be able to initialize all repositories", async function() {

    });


    it("Should be able to publish all repositories", async function() {

    });


    it("Should be able to delete a specific repository", async function() {

    });


    it("Should be able to delete all repositories of a given assignment", async function() {

    });


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






});
