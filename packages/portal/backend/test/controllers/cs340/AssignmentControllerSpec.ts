import {expect} from "chai";
import "mocha";
import Config, {ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";
import {
    AssignmentGrade,
    AssignmentGradingRubric,
    AssignmentInfo,
    AssignmentStatus,
    QuestionGrade, SubQuestionGrade
} from "../../../../../common/types/CS340Types";
import {AssignmentController} from "../../../src/controllers/340/AssignmentController";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import {GitHubActions} from "../../../src/controllers/GitHubActions";
import {GitHubController} from "../../../src/controllers/GitHubController";

import {GradesController} from "../../../src/controllers/GradesController";
import {PersonController} from "../../../src/controllers/PersonController";
import {RepositoryController} from "../../../src/controllers/RepositoryController";
import {TeamController} from "../../../src/controllers/TeamController";
import {Deliverable, Grade, Repository, Team} from "../../../src/Types";

import {Test} from "../../GlobalSpec";

const loadFirst = require('../../GlobalSpec');
const dFirst = require('../GradeControllerSpec');

const TEST_ORG = "CPSC340";
const TEST_STUDENT_ID_0 = "student0";
const TEST_STUDENT_ID_1 = "student1";
const TEST_STUDENT_ID_2 = "student2";
const TEST_STUDENT_ID_3 = "student3";

const TEST_STUDENT_MAP = [
    TEST_STUDENT_ID_0,
    TEST_STUDENT_ID_1,
    TEST_STUDENT_ID_2,
    TEST_STUDENT_ID_3
];

const ORIGINAL_ORG = Config.getInstance().getProp(ConfigKey.org);

const TIMEOUT = 7500;

let DELAY_SEC = 1000;
let DELAY_SHORT = 200;


describe("CS340: AssignmentController", () => {
    let ac: AssignmentController = new AssignmentController();
    let gc: GradesController = new GradesController();
    let tc: TeamController = new TeamController();
    let rc: RepositoryController = new RepositoryController();
    let dc: DeliverablesController = new DeliverablesController();
    let pc: PersonController = new PersonController();
    let gh: GitHubController = new GitHubController();
    let gha: GitHubActions;
    let db: DatabaseController = DatabaseController.getInstance();

    let numberOfStudents: number;

    before(async () => {
        // change org to testing org for safety
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        await Test.suiteBefore('CS340: AssignmentController');

        // clear stale data
        db = DatabaseController.getInstance();
        await db.clearData();

        // get data ready
        await Test.prepareAll();

        let peopleList = await pc.getAllPeople();
        numberOfStudents = peopleList.length;

        gha = new GitHubActions();

        // create assignment Deliverables
        await Test.prepareAssignment();

        // Log.info("Successfully created new Assignment Deliverable for testing");
    });

    beforeEach(() => {
        // initialize a new controller before each tests
        ac = new AssignmentController();
    });

    after(async () => {
        Log.test("AssignmentControllerSpec::after() - start; replacing original org");
        // return to original org
        Config.getInstance().setProp(ConfigKey.org, ORIGINAL_ORG);
        await Test.suiteAfter('CS340: AssignmentController');
    });

    it("Attempting to retrieve an assignment grade that doesn't exist should return null.", async () => {
        let assignmentGrades = await ac.getAssignmentGrade("student1", "a1");
        expect(assignmentGrades).equals(null);
    });

    it("Should not be able to publish grades for a non-assignment.", async () => {
        let result = await ac.publishGrade(Test.REALUSER1.id + "_grades", "some String",
            Test.REALUSER1.id, Test.DELIVID0);
        expect(result).to.be.false;
    });

    it("Should not be able to publish grades for a deliverable that doesn't exist.", async () => {
        let result = await ac.publishGrade(Test.REALUSER1.id + "_grades", "some String",
            Test.REALUSER1.id, "fakeDeliv");
        expect(result).to.be.false;
    });

    it("Should be able to publish all grades, even if students do not have submissions.", async () => {
        let result = await ac.publishAllGrades(Test.ASSIGNID0);
        expect(result).to.be.true;
    }).timeout(numberOfStudents * TIMEOUT);


    it("Should be able to create an assignment grade.", async () => {
        // Check there is no grade associated with the assignment specified
        let assignmentGrade = await ac.getAssignmentGrade(TEST_STUDENT_ID_0, "a2");
        expect(assignmentGrade).equals(null);

        let aPayload: AssignmentGrade = {
            assignmentID: "a2",
            studentID:    TEST_STUDENT_ID_0,
            released:     false,
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
                            grade:       2,
                            feedback:    "Improper implementation"
                        }
                    ]
                }
            ]
        };
        let team1: Team = await tc.getTeam(Test.TEAMNAME1);

        let repo3: Repository = await rc.createRepository(Test.REPONAME3, [team1], null);

        await ac.setAssignmentGrade(Test.REPONAME3, Test.ASSIGNID0, aPayload);

        let aGrade: AssignmentGrade = await ac.getAssignmentGrade(Test.USER1.id, Test.ASSIGNID0);
        let grade: Grade = await gc.getGrade(Test.USER1.id, Test.ASSIGNID0);
        // Check if the assignment information is set properly
        expect(aGrade).to.not.be.null;
        expect(aGrade.assignmentID).equals("a2");
        expect(aGrade.studentID).equals(TEST_STUDENT_ID_0);
        expect(aGrade.questions).to.have.lengthOf(2);

        // Check if the grade is set properly
        expect(grade).to.not.be.null;
        expect(grade.score).equals(11);
    });

    it("Should be able to update a grade.", async () => {
        let team1: Team = await tc.getTeam(Test.TEAMNAME1);
        let repo2: Repository = await rc.getRepository(Test.REPONAME3);

        let previousGradeRecords = await gc.getAllGrades(); // Pre command count

        let aPayload: AssignmentGrade = {
            assignmentID: "a2",
            studentID:    TEST_STUDENT_ID_0,
            released:     false,
            questions:    [
                {
                    questionName: "Question 1",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       3,
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
                            grade:       5,
                            feedback:    "Nice job"
                        }
                    ]
                }
            ]
        };

        await ac.setAssignmentGrade(Test.REPONAME3, Test.ASSIGNID0, aPayload);

        let afterGradeRecords = await gc.getAllGrades(); // Post command count

        expect(previousGradeRecords.length - afterGradeRecords.length).to.equal(0);

        let grade: Grade = await gc.getGrade(Test.USER1.id, Test.ASSIGNID0);
        expect(grade).to.not.be.null;
        expect(grade.score).to.equal(8);
    });

    it("Should be able to handle arbitrary subquestion sizes.", async () => {
        let aPayload: AssignmentGrade = {
            assignmentID: "a2",
            studentID:    TEST_STUDENT_ID_0,
            // assignmentID: Test.ASSIGNID0,
            // studentID:    Test.REALUSER1.id,
            released:     false,
            questions:    [
                {
                    questionName: "Question 1",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       3,
                            feedback:    ""
                        },
                        {
                            sectionName: "writing",
                            grade:       1,
                            feedback:    ""
                        },
                        {
                            sectionName: "logic",
                            grade:       10,
                            feedback:    ""
                        },
                        {
                            sectionName: "quality",
                            grade:       6,
                            feedback:    ""
                        },
                        {
                            sectionName: "grammar",
                            grade:       6,
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
                            grade:       5,
                            feedback:    "Nice job"
                        }
                    ]
                }
            ]
        };

        let success = await ac.setAssignmentGrade(Test.REPONAME3, Test.ASSIGNID0, aPayload);
        // let success = await ac.setAssignmentGrade(Test.ASSIGNID0 + "_" + Test.REALUSER1.id, Test.ASSIGNID0, aPayload);

        expect(success).to.be.true;

        let newGrade = await gc.getGrade(Test.USER1.id, Test.ASSIGNID0);
        expect(newGrade).to.not.be.null;
        expect(newGrade.score).to.be.equal(31);

        let aGrade = await ac.getAssignmentGrade(Test.USER1.id, Test.ASSIGNID0);

        expect(aGrade.studentID).to.be.equal(aPayload.studentID);
        expect(aGrade.assignmentID).to.be.equal(aPayload.assignmentID);
    });

    it("Should be able to publish all grades, after grades have been updated.", async () => {
        let result = await ac.publishAllGrades(Test.ASSIGNID0);
        expect(result).to.be.true;
    }).timeout(numberOfStudents * TIMEOUT);


    it("Clean stale repositories.", async function() {
        Log.info("Cleaning stale repositories");
        await deleteStale();
        Log.info("Cleaned all stale information");
    }).timeout(2 * TIMEOUT);

    it("Should be able to create an Assignment Repos.", async function() {
        const exec = Test.runSlowTest();

        if (exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        let allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        // let allTeams = await tc.getAllTeams();
        // expect(allTeams.length).to.be.greaterThan(0);
        let assignTeam: Team = await tc.getTeam(Test.ASSIGNTEAMNAME1);
        expect(assignTeam).to.not.be.null;

        let newAssignRepo: Repository = await ac.createAssignmentRepo(Test.ASSIGNID0 + "_" +
            allStudents[0].id,
            Test.ASSIGNID0, [assignTeam]);

        expect(newAssignRepo).to.not.be.null;
    }).timeout(3 * TIMEOUT);

    it("Should be able to release an Assignment Repo.", async function() {
        const exec = Test.runSlowTest();

        if (exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        let allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        let success = await ac.publishAssignmentRepo(Test.ASSIGNID0 + "_" + Test.REALUSER1.id);
        expect(success).to.be.true;
    }).timeout(3 * TIMEOUT);


    it("Should not be able to publish an assignment repository again.", async function() {
        const exec = Test.runSlowTest();

        if (exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        let allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        let success = await ac.publishAssignmentRepo(Test.ASSIGNID0 + "_" + Test.REALUSER1.id);
        expect(success).to.be.false;
    }).timeout(3 * TIMEOUT);

    it("Should be able to delete Assignment Repo, along with it's records.", async function() {
        const exec = Test.runSlowTest();

        if (exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        let allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        let repoName = Test.ASSIGNID0 + "_" + Test.REALUSER1.id;

        let success: boolean = await ac.deleteAssignmentRepository(repoName, Test.ASSIGNID0, true);
        expect(success).to.be.true;
        // TODO: verify records are deleted
    });

    it("Clean stale repositories", async function() {
        Log.info("Cleaning stale repositories");
        await deleteStale();
        Log.info("Cleaned all stale information");
    }).timeout(2 * TIMEOUT);

    describe("Slow Assignment Tests", () => {

        before(function() {
            Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
            gha = new GitHubActions();

            it("Clean stale repositories", async function() {
                Log.info("Cleaning stale repositories");
                await deleteStale();
                Log.info("Cleaned all stale information");
            }).timeout(2 * TIMEOUT);

        });

        after(function() {
            Config.getInstance().setProp(ConfigKey.org, ORIGINAL_ORG);

            it("Clean stale repositories", async function() {
                Log.info("Cleaning stale repositories");
                await deleteStale();
                Log.info("Cleaned all stale information");
            }).timeout(2 * TIMEOUT);

        });

        beforeEach(function() {
            const exec = Test.runSlowTest();

            if (exec) {
                Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
            } else {
                Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
                this.skip();
            }
        });

        it("Should be able to create all Assignment Repositories at once.", async function() {
            let allStudents = await pc.getAllPeople();
            let studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            let oldGithubRepoArray = await gha.listRepos();
            let oldGithubRepoCount = oldGithubRepoArray.length;

            let success = await ac.initializeAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;

            let newGithubRepoArray = await gha.listRepos();
            let newGithubRepoCount = newGithubRepoArray.length;

            expect(newGithubRepoCount).to.be.at.least(oldGithubRepoCount);
        }).timeout(numberOfStudents * 2 * TIMEOUT);

        it("Should be able to get the correct assignment status after creating repositories.", async function() {

            let assignStatus: {assignStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number} = await ac.getAssignmentStatus(Test.ASSIGNID0);

            expect(assignStatus).to.not.be.null;
            expect(assignStatus.assignStatus).to.be.equal(AssignmentStatus.CREATED);
        });

        it("Should be able to update an assignment status that has been created", async function() {

            let assignStatus: {assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number} = await ac.updateAssignmentStatus(Test.ASSIGNID0);

            expect(assignStatus).to.not.be.null;
            expect(assignStatus.assignmentStatus).to.be.equal(AssignmentStatus.CREATED);
        });

        it("Should be able to release all Assignment Repositories at once.", async function() {
            let allStudents = await pc.getAllPeople();
            let studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            let success = await ac.publishAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;

            // TODO: Verify
        }).timeout(numberOfStudents * TIMEOUT);

        it("Should not be able to release all Assignment " +
            "Repositories after releasing once.", async function() {
            let allStudents = await pc.getAllPeople();
            let studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            let success = await ac.publishAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.false;

            // TODO: Verify
        }).timeout(numberOfStudents * TIMEOUT);

        it("Should be able to close all Assignment Repositories at once.", async function() {
            let success = await ac.closeAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;
        }).timeout(numberOfStudents * TIMEOUT);

        it("Should be able to assign a grade to a student after repositories close.", async function() {
            let newAssignmentGrade: AssignmentGrade = {
                assignmentID: Test.ASSIGNID0,
                studentID: Test.REALUSER1.id,
                released: false,
                questions: [
                    {
                        questionName: "question 1",
                        commentName: "",
                        subQuestion: [
                            {
                                sectionName: "rubric",
                                grade: 3,
                                feedback: "mistakes were made",
                            }
                        ]
                    },
                    {
                        questionName: "question 2",
                        commentName: "",
                        subQuestion: [
                            {
                                sectionName: "code quality",
                                grade: 6,
                                feedback: "good job!",
                            }
                        ]
                    }
                ]
            };

            let success = await ac.setAssignmentGrade(Test.ASSIGNID0 + "_" + Test.REALUSER1.id,
                Test.ASSIGNID0, newAssignmentGrade, "testBot");

            expect(success).to.be.true;
        });

        it("Should be able to publish grades again after grade update.", async () => {
            let result = await ac.publishAllGrades(Test.ASSIGNID0);
            expect(result).to.be.true;
        }).timeout(numberOfStudents * TIMEOUT);

        it("Should not be able to release all Assignment " +
            "Repositories after closing.", async function() {
            let allStudents = await pc.getAllPeople();
            let studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            let success = await ac.publishAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.false;

            // TODO: Verify
        }).timeout(numberOfStudents * TIMEOUT);

        it("Should be able to publish all grades after release.", async function() {
            let success = await ac.publishAllGrades(Test.ASSIGNID0);
            expect(success).to.be.true;
        }).timeout(numberOfStudents * TIMEOUT);

        it("Should be able to delete all Assignment Repositories, along with their records", async function() {
            let allStudents = await pc.getAllPeople();
            let studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            let oldGithubRepoArray = await gha.listRepos();
            let oldGithubRepoCount = oldGithubRepoArray.length;

            let success = await ac.deleteAllAssignmentRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;

            let newGithubRepoArray = await gha.listRepos();
            let newGithubRepoCount = newGithubRepoArray.length;

            expect(newGithubRepoCount).to.be.at.most(oldGithubRepoCount);
        }).timeout(numberOfStudents * 2 * TIMEOUT);

        it("Should be able to verify and schedule jobs for assignments", async () => {
            let count = await ac.verifyScheduledJobs();
            expect(count).to.be.greaterThan(0);
        });


        // fail cases

        it("Should not be able to initialize a deliverable that doesn't exist.", async function() {
            let success = await ac.initializeAllRepositories("invaliddeliv");
            expect(success).to.be.false;
        });

        it("Should not be able to release a deliverable that doesn't exists.", async function() {
            let success = await ac.publishAllRepositories("invaliddeliv");
            expect(success).to.be.false;
        });

        it("Should not be close to release a deliverable that doesn't exists.", async function() {
            let success = await ac.closeAllRepositories("invaliddeliv");
            expect(success).to.be.false;
        });

        it("Should not be able to get the status of an invalid deliverable.", async function() {
            let result = await ac.getAssignmentStatus("invaliddelv");
            expect(result).to.be.null;
        });

        it("Should not be able to get the status of an non-assignment.", async function() {
            let result = await ac.getAssignmentStatus(Test.DELIVID0);
            expect(result).to.be.null;
        });

        it("Should not be able to publish grades for a non-assignment.", async () => {
            let result = await ac.publishAllGrades(Test.DELIVID0);
            expect(result).to.be.false;
        });


    });


    /*
        ========= IMPORTED CODE FROM GITHUBACTIONSPEC ===========
     */

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

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
                    team.name.startsWith(Test.ASSIGNID0 + "_")
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

const REPONAME = getProjectPrefix() + Test.ASSIGNID0;
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
    Test.REALUSER1.id + "_grades"
];

let TESTTEAMNAMES = [
    "rtholmes",
    "ubcbot",
    "rthse2",
    "cpscbot",
    "TEST__X__t_TESTteam1",
    "TESTteam1",
    "TESTteam2",
    "TESTteam3"
];

function getProjectPrefix(): string {
    return "TEST__X__secap_";
}

function getTeamPrefix() {
    return "TEST__X__t_";
}
