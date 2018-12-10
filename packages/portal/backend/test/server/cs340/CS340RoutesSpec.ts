import {fail} from "assert";
import {expect} from "chai";
import "mocha";

import * as restify from 'restify';
import * as request from 'supertest';
import Config, {ConfigCourses, ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {PersonController} from "../../../src/controllers/PersonController";
import BackendServer from "../../../src/server/BackendServer";
import {CS340Test} from "../../controllers/cs340/CS340Test";

import '../../GlobalSpec';
import {Test} from "../../TestHarness";

// tslint:disable-next-line
const https = require('https');

const REPONAME = getProjectPrefix() + Test.ASSIGNID0;

const adminUserName = Test.ADMIN1.id;
let adminUserToken: string;

describe.skip("CS340: Routes", () => {
    let app: restify.Server = null;
    let server: BackendServer = null;

    const OLDNAME = Config.getInstance().getProp(ConfigKey.name);
    const OLDORG = Config.getInstance().getProp(ConfigKey.org);
    let name: string;

    let numberOfStudents: number;

    before(async function() {
        Log.test("CS340Routes::before - start");
        this.timeout(Test.TIMEOUTLONG);

        // set testing env
        Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest); // force testing env

        await Test.suiteBefore('CS340Routes');

        // clear stale data
        const db = DatabaseController.getInstance();
        await db.clearData();

        // get data ready
        await Test.prepareAll();
        await CS340Test.prepareAssignment();
        await CS340Test.prepareAssignment2();
        await CS340Test.prepareAssignmentTeam();
        await CS340Test.prepareAssignmentTeam2();

        Config.getInstance().setProp(ConfigKey.name, 'cs340');
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new BackendServer(false);

        const pc: PersonController = new PersonController();
        const peopleList = await pc.getAllPeople();
        numberOfStudents = peopleList.length;

        name = Config.getInstance().getProp(ConfigKey.name);

        Log.test("CS340RoutesSpec::before - token set");
        const auth = await db.getAuth(adminUserName);
        adminUserToken = auth.token;

        // make sure there are some normal student tokens
        await db.writeAuth({personId: Test.USER1.id, token: Test.REALTOKEN}); // create an auth record

        await Test.deleteStaleRepositories();

        return server.start().then(function() {
            Log.test('CS340Routes::before - server started');
            // Log.test('orgName: ' + Test.ORGNAME);
            app = server.getServer();
        }).catch(function(err) {
            // probably ok; ust means server is already started
            Log.test('CS340Routes::before - server might already be started: ' + err);
        });

    });

    after(async function() {
        Log.test('CS340Routes::after - start');
        this.timeout(Test.TIMEOUTLONG);

        Config.getInstance().setProp(ConfigKey.name, OLDNAME);
        Config.getInstance().setProp(ConfigKey.org, OLDORG);

        await server.stop();
        await Test.suiteAfter('CS340Routes');
        await Test.deleteStaleRepositories();
    });

    beforeEach(async function() {
        Log.test("Start");
    });

    // it("Clean up stale repos.", async function() {
    //     Log.test("Cleaning up stale repositories...");
    //     await Test.deleteStaleRepositories();
    // }).timeout(Test.TIMEOUTLONG);

    it("Should be able to get all deliverables.", async function() {
        let response = null;
        const url = '/portal/cs340/getAllDeliverables';

        try {
            // const name = Config.getInstance().getProp(ConfigKey.name);
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
            // response = await request(app).get(url).send({}).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            // fail(err);
            // done();
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get assignment rubric based on ID.", async function() {
        const aid = Test.ASSIGNID0;
        let response = null;
        const url = '/portal/cs340/getAssignmentRubric/' + aid;
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all assignment rubrics.", async function() {
        let response = null;
        const url = '/portal/cs340/getAllAssignmentRubrics/';
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to save a student's grade even if there is no repo.", async function() {
        const aid = Test.ASSIGNID0;
        const pc: PersonController = new PersonController();
        const allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        const aPayload = {
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

        try {
            response = await request(app).put(url).send(aPayload).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all grades.", async function() {
        let response = null;
        const url = '/portal/cs340/getAllGrades';
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all information on deliverables.", async function() {
        let response = null;
        const url = '/portal/cs340/getAllDelivInfo';
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all information on deliverables as a student.", async function() {
        let response = null;
        const url = '/portal/cs340/getAllDelivInfo';
        try {
            response = await request(app).get(url).set({name: name, user: Test.USER1.id, token: Test.REALTOKEN});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all Submissions using assignment ID.", async function() {
        const aid = Test.ASSIGNID0;

        let response = null;
        const url = '/portal/cs340/getAllSubmissionsByDelivID/' + aid;
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get a person using their Github username.", async function() {
        const pc: PersonController = new PersonController();
        const allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);
        const sid = allPeople[0].githubId;

        let response = null;
        const url = '/portal/cs340/getPersonByID/' + sid;
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get all persons.", async function() {
        let response = null;
        const url = '/portal/cs340/getAllPersons';
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to update the assignment status.", async function() {
        let response = null;
        const aid = Test.ASSIGNID0;

        const url = '/portal/cs340/updateAssignmentStatus/' + aid;
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    });

    it("Should be able to get the assignment status.", async function() {
        let response = null;
        const aid = Test.ASSIGNID0;

        const url = '/portal/cs340/getAssignmentStatus/' + aid;
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to initialize all repositories.", async function() {
        let response = null;
        const aid = Test.ASSIGNID0;

        const url = '/portal/cs340/initializeAllRepositories/' + aid;
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to publish all repositories.", async function() {

        // TODO: move this to a 'slow tests' block

        let response = null;
        const aid = Test.ASSIGNID0;

        const url = '/portal/cs340/publishAllRepositories/' + aid;
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to \"publish\" all repositories again, even though they have already been created.", async function() {
        let response = null;
        const aid = Test.ASSIGNID0;

        // TODO: move this to a 'slow tests' block

        const url = '/portal/cs340/publishAllRepositories/' + aid;
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to retrieve a repository from specifying a team.", async function() {
        let response = null;

        const url = '/portal/cs340/getRepository/' + Test.ASSIGNTEAMNAME0;
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
            Log.test("status: " + response.status + "; body: " + JSON.stringify(response.body));
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).not.be.null;
    });

    it("Should be able to get a shortlist of all students.", async function() {
        let response = null;

        const url = '/portal/cs340/getStudentsInOrg';
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).not.be.null;
    });

    it("Should be able to close all repositories.", async function() {
        let response = null;
        const aid = Test.ASSIGNID0;

        const url = '/portal/cs340/closeAllRepositories/' + aid;
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to set a student's grade.", async function() {
        Log.test("CS340RoutesSpec:: should be able to set a student's grade");

        const aid = Test.ASSIGNID0;
        const pc: PersonController = new PersonController();
        const allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        const aPayload = {
            assignmentID: aid,
            studentID:    Test.REALUSER1.id,
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

        try {
            response = await request(app).put(url).send(aPayload).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to get a specific grade using student ID and assignment ID.", async function() {

        Log.test("CS340RoutesSpec:: get specific grade");

        const aid = Test.ASSIGNID0;
        const pc: PersonController = new PersonController();
        const allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        const sid = Test.REALUSER1.id;

        let response = null;
        const url = '/portal/cs340/getAssignmentGrade/' + sid + '/' + aid;
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to delete a specific repository.", async function() {
        let response = null;
        const aid = Test.ASSIGNID0;
        const pc: PersonController = new PersonController();

        const allPeople = await pc.getAllPeople();

        expect(allPeople.length).to.be.at.least(0);

        // find rthse2
        let index = -1;
        for (let i = 0; i < allPeople.length; i++) {
            if (allPeople[i].githubId === 'rthse2') {
                index = i;
                break;
            }
        }

        if (index === -1) {
            fail("Unable to find rthse2 in records, something is wrong with the database...");
        }

        const sid = allPeople[index].githubId;

        const url = '/portal/cs340/deleteRepository/' + aid + '/' + aid + '_' + sid;
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to delete all repositories of a given assignment.", async function() {
        let response = null;
        const aid = Test.ASSIGNID0;

        const url = '/portal/cs340/deleteAllRepositories/' + aid;
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to verify all and create jobs for an assignment.", async function() {
        const aid = Test.ASSIGNID0;
        let response = null;
        const url = '/portal/cs340/verifyScheduledJobs/' + aid;
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.be.greaterThan(0);
    });

    it("Should be able to verify all and create jobs for all assignment.", async function() {
        let response = null;
        const url = '/portal/cs340/verifyScheduledJobs';
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.be.greaterThan(0);
    });

    it("Should be able to retrieve a team by giving a user ID and deliverable ID.", async function() {
        let response = null;

        const url = '/portal/cs340/getStudentTeamByDeliv/' + Test.REALUSER1.id + '/' + Test.ASSIGNID1;
        try {
            response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.be.not.null;
        expect(response.body.response.id).to.be.equal(Test.ASSIGNID1 + "__" + Test.REALUSER1.id);
    });

    it("Should be able release grades of an assignment.", async function() {
        let response = null;

        // TODO: move this to a 'slow tests' block

        const url = '/portal/cs340/releaseGrades/' + Test.ASSIGNID1;
        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    // it("Clean up stale repos.", async function() {
    //     Log.test("Cleaning up stale repositories...");
    //     await Test.deleteStaleRepositories();
    // }).timeout(Test.TIMEOUTLONG);

    it("Should be able to publish final grades of all students using the API.", async function() {
        let response = null;
        const url = '/portal/cs340/publishAllFinalGrades';

        try {
            response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
        } catch (err) {
            Log.test("ERROR: " + err);
            fail(err);
        }

        expect(response).to.not.be.null;
        expect(response.status).to.be.equal(200);
        expect(response.body.response).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    describe("Failing API tests", () => {
        // before()

        it("Should not be able to get all deliverables as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getAllDeliverables';

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get a shortlist of all students as an invalid user.", async function() {
            let response = null;

            const url = '/portal/cs340/getStudentsInOrg';
            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).not.be.null;
        });

        it("Should not be able to get an assignment rubric as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getAssignmentRubric/' + Test.ASSIGNID0;

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get all rubrics as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getAllAssignmentRubrics';

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get all grades as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getAllGrades';

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get an assignment grade " +
            "as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getAssignmentGrade/' + Test.REALUSER1.id + "/" + Test.ASSIGNID0;

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get all submissions as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getAllSubmissionsByDelivID/' + Test.ASSIGNID0;

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get a person using their GithubID as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getPersonByID/' + Test.REALUSER1.github;

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get all persons as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getAllPersons';

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to update the assignment status as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/updateAssignmentStatus/' + Test.ASSIGNID0;

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get a student team as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getStudentTeamByDeliv/' + Test.REALUSER1.id + "/" + Test.ASSIGNID0;

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get a repository from a team as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getRepository/' + Test.ASSIGNTEAMNAME0;

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get all deliverable infos as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/getAllDelivInfo';

            try {
                response = await request(app).get(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to set an assignment grade as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/setAssignmentGrade';

            try {
                response = await request(app).put(url).send({data: null}).set({
                    user:  "invalidUser",
                    token: "invalidToken"
                });
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to release grades as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/releaseGrades/' + Test.ASSIGNID0;

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to initialize all repos as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/initializeAllRepositories/' + Test.ASSIGNID0;

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to publish all repos as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/publishAllRepositories/' + Test.ASSIGNID0;

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to close all repos as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/closeAllRepositories/' + Test.ASSIGNID0;

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to delete a repo as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/deleteRepository/' + Test.ASSIGNID0 + "/" + Test.REPONAME1;

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to delete all repos as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/deleteAllRepositories/' + Test.ASSIGNID0;

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to verify scheduled jobs for an assignment as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/verifyScheduledJobs/' + Test.ASSIGNID0;

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to verify scheduled jobs for all assignments as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/verifyScheduledJobs';

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to publish final grades as an invalid user.", async function() {
            let response = null;
            const url = '/portal/cs340/publishAllFinalGrades';

            try {
                response = await request(app).post(url).set({user: "invalidUser", token: "invalidToken"});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(401);
            expect(response.body.response).to.be.undefined;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to get an assignment grade that doesn't exist.", async function() {
            let response = null;
            const url = '/portal/cs340/getAssignmentGrade/' + "invalidStudent" + "/" + "invalidAssignmentId";

            try {
                response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(400);
            expect(response.body.response).to.be.null;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to find a student team that doesn't exist.", async function() {
            let response = null;
            const url = '/portal/cs340/getStudentTeamByDeliv/' + "invalidStudent" + "/" + "invalidAssignmentId";

            try {
                response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(400);
            expect(response.body.response).to.not.exist;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able find a repository with and invalid team.", async function() {
            let response = null;
            const url = '/portal/cs340/getRepository/' + "invalidTeamId";

            try {
                response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(400);
            expect(response.body.response).to.not.exist;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be get an assignment rubric from a deliverable that " +
            "doesn't exist.", async function() {
            let response = null;
            const url = '/portal/cs340/getAssignmentRubric/' + "invalidAssignmentID";

            try {
                response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(204);
            expect(response.body.response).to.not.exist;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be get an assignment rubric from a deliverable that " +
            "does exist, but it is not an assignment.", async function() {
            let response = null;
            const url = '/portal/cs340/getAssignmentRubric/' + Test.DELIVID0;

            try {
                response = await request(app).get(url).set({user: adminUserName, token: adminUserToken});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(204);
            expect(response.body.response).to.not.exist;
            expect(response.body.error).to.not.be.null;
        });

        it("Should not be able to initialize all repositories for a deliverable " +
            "that doesn't exist.", async function() {
            let response = null;
            const url = '/portal/cs340/initializeAllRepositories/' + "invalidDeliverableID";

            try {
                response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(400);
            expect(response.body.response).to.not.exist;
            expect(response.body.error).to.not.be.null;
        }).timeout(Test.TIMEOUTLONG);

        it("Should not be able to initialize all repositories for a deliverable " +
            "that exists, but is not an assignment.", async function() {
            let response = null;
            const url = '/portal/cs340/initializeAllRepositories/' + Test.DELIVID0;

            try {
                response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
                Log.test("response receiced");
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(400);
            expect(response.body.response).to.not.exist;
            expect(response.body.error).to.not.be.null;
        }).timeout(Test.TIMEOUTLONG);

        it("Should not be able to publish all repositories for a deliverable " +
            "that doesn't exist.", async function() {
            let response = null;
            const url = '/portal/cs340/publishAllRepositories/' + "invalidDeliverableID";

            try {
                response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(400);
            expect(response.body.response).to.not.exist;
            expect(response.body.error).to.not.be.null;
        }).timeout(Test.TIMEOUTLONG);

        it("Should not be able to publish all repositories for a deliverable " +
            "that exists, but is not an assignment.", async function() {
            let response = null;
            const url = '/portal/cs340/publishAllRepositories/' + Test.DELIVID0;

            try {
                response = await request(app).post(url).set({user: adminUserName, token: adminUserToken});
            } catch (err) {
                Log.test("ERROR: " + err);
                fail(err);
            }

            expect(response).to.not.be.null;
            expect(response.status).to.be.equal(400);
            expect(response.body.response).to.not.exist;
            expect(response.body.error).to.not.be.null;
        }).timeout(Test.TIMEOUTLONG);

    });
});

function getProjectPrefix(): string {
    return "TEST__X__secap_";
}

function getTeamPrefix() {
    return "TEST__X__t_";
}
