import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";

import {AssignmentGrade, AssignmentStatus} from "../../../../../common/types/CS340Types";
import {AssignmentController} from "../../../src/controllers/340/AssignmentController";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import {GitHubActions, IGitHubActions} from "../../../src/controllers/GitHubActions";

import {GradesController} from "../../../src/controllers/GradesController";
import {PersonController} from "../../../src/controllers/PersonController";
import {RepositoryController} from "../../../src/controllers/RepositoryController";
import {TeamController} from "../../../src/controllers/TeamController";
import {Deliverable, Grade, Repository, Team} from "../../../src/Types";

import {Test} from "../../GlobalSpec";
import '../../GlobalSpec';
import '../GradeControllerSpec';

// const loadFirst = require('../../GlobalSpec');
// const dFirst = require('../GradeControllerSpec');

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

describe.only("CS340: AssignmentController", () => {
    let ac: AssignmentController = new AssignmentController();
    const gc: GradesController = new GradesController();
    const tc: TeamController = new TeamController();
    const rc: RepositoryController = new RepositoryController();
    const dc: DeliverablesController = new DeliverablesController();
    const pc: PersonController = new PersonController();
    const gha: IGitHubActions = GitHubActions.getInstance();
    const db: DatabaseController = DatabaseController.getInstance();

    let numberOfStudents: number;

    before(async () => {
        // change org to testing org for safety
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        await Test.suiteBefore('CS340: AssignmentController');

        // clear stale data
        await db.clearData();

        // get data ready
        await Test.prepareAll();

        const peopleList = await pc.getAllPeople();
        numberOfStudents = peopleList.length;

        // create assignment Deliverables
        await Test.prepareAssignment();
        await Test.prepareAssignmentTeam();

        // Log.info("Successfully created new Assignment Deliverable for testing");
        it("Clean stale repositories", async function() {
            Log.info("Cleaning stale repositories");
            await Test.deleteStaleRepositories();
            Log.info("Cleaned all stale information");
        }).timeout(Test.TIMEOUTLONG);
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
        const assignmentGrades = await ac.getAssignmentGrade("student1", "a1");
        expect(assignmentGrades).equals(null);
    });

    it("Should not be able to publish grades for a non-assignment.", async () => {
        const result = await ac.publishGrade(Test.REALUSER1.id + "_grades", "some String",
            Test.REALUSER1.id, Test.DELIVID0);
        expect(result).to.be.false;
    });

    it("Should not be able to publish grades for a deliverable that doesn't exist.", async () => {
        const result = await ac.publishGrade(Test.REALUSER1.id + "_grades", "some String",
            Test.REALUSER1.id, "fakeDeliv");
        expect(result).to.be.false;
    });

    it("Should be able to publish all grades, even if students do not have submissions.", async () => {
        // TODO: move this to the slow tests below; takes too long to run locally
        const result = await ac.publishAllGrades(Test.ASSIGNID0);
        expect(result).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to create an assignment grade.", async () => {
        // Check there is no grade associated with the assignment specified
        const assignmentGrade = await ac.getAssignmentGrade(TEST_STUDENT_ID_0, "a2");
        expect(assignmentGrade).equals(null);

        const aPayload: AssignmentGrade = {
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
                            graded:      true,
                            feedback:    "Good job!"
                        },
                        {
                            sectionName: "reasoning",
                            grade:       5,
                            graded:      true,
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
                            graded:      true,
                            feedback:    "Improper implementation"
                        }
                    ]
                }
            ]
        };
        const team1: Team = await tc.getTeam(Test.TEAMNAME1);

        const deliv = await dc.getDeliverable(Test.ASSIGNID0);

        const repo3: Repository = await rc.createRepository(Test.REPONAME3, deliv, [team1], {});

        await ac.setAssignmentGrade(Test.REPONAME3, Test.ASSIGNID0, aPayload);

        const aGrade: AssignmentGrade = await ac.getAssignmentGrade(Test.USER1.id, Test.ASSIGNID0);
        const grade: Grade = await gc.getGrade(Test.USER1.id, Test.ASSIGNID0);
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
        const team1: Team = await tc.getTeam(Test.TEAMNAME1);
        const repo2: Repository = await rc.getRepository(Test.REPONAME3);

        const previousGradeRecords = await gc.getAllGrades(); // Pre command count

        const aPayload: AssignmentGrade = {
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
                            graded:      true,
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
                            graded:      true,
                            feedback:    "Nice job"
                        }
                    ]
                }
            ]
        };

        await ac.setAssignmentGrade(Test.REPONAME3, Test.ASSIGNID0, aPayload);

        const afterGradeRecords = await gc.getAllGrades(); // Post command count

        expect(previousGradeRecords.length - afterGradeRecords.length).to.equal(0);

        const grade: Grade = await gc.getGrade(Test.USER1.id, Test.ASSIGNID0);
        expect(grade).to.not.be.null;
        expect(grade.score).to.equal(8);
    });

    it("Should be able to handle arbitrary subquestion sizes.", async () => {
        const aPayload: AssignmentGrade = {
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
                            graded:      true,
                            feedback:    ""
                        },
                        {
                            sectionName: "writing",
                            grade:       1,
                            graded:      true,
                            feedback:    ""
                        },
                        {
                            sectionName: "logic",
                            grade:       10,
                            graded:      true,
                            feedback:    ""
                        },
                        {
                            sectionName: "quality",
                            grade:       6,
                            graded:      true,
                            feedback:    ""
                        },
                        {
                            sectionName: "grammar",
                            grade:       6,
                            graded:      true,
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
                            graded:      true,
                            feedback:    "Nice job"
                        }
                    ]
                }
            ]
        };

        const success = await ac.setAssignmentGrade(Test.REPONAME3, Test.ASSIGNID0, aPayload);
        // let success = await ac.setAssignmentGrade(Test.ASSIGNID0 + "_" + Test.REALUSER1.id, Test.ASSIGNID0, aPayload);

        expect(success).to.be.true;

        const newGrade = await gc.getGrade(Test.USER1.id, Test.ASSIGNID0);
        expect(newGrade).to.not.be.null;
        expect(newGrade.score).to.be.equal(31);

        const aGrade = await ac.getAssignmentGrade(Test.USER1.id, Test.ASSIGNID0);

        expect(aGrade.studentID).to.be.equal(aPayload.studentID);
        expect(aGrade.assignmentID).to.be.equal(aPayload.assignmentID);
    });

    it("Should be able to publish all grades, after grades have been updated.", async () => {
        const result = await ac.publishAllGrades(Test.ASSIGNID0);
        expect(result).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to publish all final grades, after all grades have been inputted", async () => {
        // set the assignment status to released
        const assignment: Deliverable = await db.getDeliverable(Test.ASSIGNID0);
        assignment.gradesReleased = true;
        await db.writeDeliverable(assignment);
        const success = await ac.publishAllFinalGrades();
        expect(success).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Clean stale repositories.", async function() {
        Log.info("Cleaning stale repositories");
        await Test.deleteStaleRepositories();
        Log.info("Cleaned all stale information");
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to create an Assignment Repos.", async function() {
        const exec = Test.runSlowTest();

        if (exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        const allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        // let allTeams = await tc.getAllTeams();
        // expect(allTeams.length).to.be.greaterThan(0);
        const assignTeam: Team = await tc.getTeam(Test.ASSIGNTEAMNAME0);
        expect(assignTeam).to.not.be.null;

        const newAssignRepo: Repository = await ac.createAssignmentRepo(Test.ASSIGNID0 + "_" +
            allStudents[0].id,
            Test.ASSIGNID0, [assignTeam]);

        expect(newAssignRepo).to.not.be.null;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to release an Assignment Repo.", async function() {
        const exec = Test.runSlowTest();

        if (exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        const allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        const success = await ac.publishAssignmentRepo(Test.ASSIGNID0 + "_" + Test.REALUSER1.id);
        expect(success).to.be.true;
    }).timeout(Test.TIMEOUTLONG);

    it("Should not be able to publish an assignment repository again.", async function() {
        const exec = Test.runSlowTest();

        if (exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        const allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        const success = await ac.publishAssignmentRepo(Test.ASSIGNID0 + "_" + Test.REALUSER1.id);
        expect(success).to.be.false;
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to delete Assignment Repo, along with its records.", async function() {
        const exec = Test.runSlowTest();

        if (exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        const allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        const repoName = Test.ASSIGNID0 + "_" + Test.REALUSER1.id;

        const success: boolean = await ac.deleteAssignmentRepository(repoName, Test.ASSIGNID0, true);
        expect(success).to.be.true;
        // TODO: verify records are deleted
    });

    describe("Slow Assignment Tests", () => {

        before(async function() {
            Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

            await db.clearData();
            await resetData();
        });

        after(function() {
            Config.getInstance().setProp(ConfigKey.org, ORIGINAL_ORG);
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

        it("Clean stale repositories", async function() {
            Log.info("Cleaning stale repositories");
            await Test.deleteStaleRepositories();
            Log.info("Cleaned all stale information");
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to pre-create a team for the assignment.", async function() {
            const delivRecord = await db.getDeliverable(Test.ASSIGNID0);
            const personRecord = await pc.getPerson(Test.REALUSER2.id);
            const teamRecord = await tc.createTeam(Test.ASSIGNID0 + "_" + Test.REALUSER2.id,
                delivRecord, [personRecord], {});

            expect(teamRecord).to.not.be.null;
        });

        it("Should be able to create all Assignment Repositories at once.", async function() {
            const allStudents = await pc.getAllPeople();
            const studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            const oldGithubRepoArray = await gha.listRepos();
            const oldGithubRepoCount = oldGithubRepoArray.length;

            const success = await ac.initializeAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;

            const newGithubRepoArray = await gha.listRepos();
            const newGithubRepoCount = newGithubRepoArray.length;

            expect(newGithubRepoCount).to.be.greaterThan(oldGithubRepoCount);
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to get the correct assignment status after creating repositories.", async function() {

            const assignStatus: {
                assignStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.getAssignmentStatus(Test.ASSIGNID0);

            expect(assignStatus).to.not.be.null;
            expect(assignStatus.assignStatus).to.be.equal(AssignmentStatus.CREATED);
        });

        it("Should be able to update an assignment status that has been created", async function() {

            const assignStatus: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);

            expect(assignStatus).to.not.be.null;
            expect(assignStatus.assignmentStatus).to.be.equal(AssignmentStatus.CREATED);
        });

        it("Should be able to release all Assignment Repositories at once.", async function() {
            const allStudents = await pc.getAllPeople();
            const studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            const success = await ac.publishAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;

            // TODO: Verify
        }).timeout(Test.TIMEOUTLONG);

        it("Should not be able to release all Assignment " +
            "Repositories after releasing once.", async function() {
            const allStudents = await pc.getAllPeople();
            const studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            const success = await ac.publishAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.false;

            // TODO: Verify
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to close all Assignment Repositories at once.", async function() {
            const success = await ac.closeAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to assign a grade to a student after repositories close.", async function() {
            const newAssignmentGrade: AssignmentGrade = {
                assignmentID: Test.ASSIGNID0,
                studentID:    Test.REALUSER1.id,
                released:     false,
                questions:    [
                    {
                        questionName: "question 1",
                        commentName:  "",
                        subQuestion:  [
                            {
                                sectionName: "rubric",
                                grade:       3,
                                graded:      true,
                                feedback:    "mistakes were made"
                            }
                        ]
                    },
                    {
                        questionName: "question 2",
                        commentName:  "",
                        subQuestion:  [
                            {
                                sectionName: "code quality",
                                grade:       6,
                                graded:      true,
                                feedback:    "good job!"
                            }
                        ]
                    }
                ]
            };

            const success = await ac.setAssignmentGrade(Test.ASSIGNID0 + "_" + Test.REALUSER1.id,
                Test.ASSIGNID0, newAssignmentGrade, "testBot");

            expect(success).to.be.true;
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to publish grades again after grade update.", async () => {
            const result = await ac.publishAllGrades(Test.ASSIGNID0);
            expect(result).to.be.true;
        }).timeout(Test.TIMEOUTLONG);

        it("Should not be able to release all Assignment " +
            "Repositories after closing.", async function() {
            const allStudents = await pc.getAllPeople();
            const studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            const success = await ac.publishAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.false;

            // TODO: Verify
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to publish all grades after release.", async function() {
            const success = await ac.publishAllGrades(Test.ASSIGNID0);
            expect(success).to.be.true;
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to delete all Assignment Repositories, along with their records", async function() {
            const allStudents = await pc.getAllPeople();
            const studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            const oldGithubRepoArray = await gha.listRepos();
            const oldGithubRepoCount = oldGithubRepoArray.length;

            const success = await ac.deleteAllAssignmentRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;

            const newGithubRepoArray = await gha.listRepos();
            const newGithubRepoCount = newGithubRepoArray.length;

            expect(newGithubRepoCount).to.be.at.most(oldGithubRepoCount);
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to verify and schedule jobs for assignments", async () => {
            const count = await ac.verifyScheduledJobs();
            expect(count).to.be.greaterThan(0);
        });

        // fail cases

        it("Should not be able to initialize a deliverable that doesn't exist.", async function() {
            const success = await ac.initializeAllRepositories("invaliddeliv");
            expect(success).to.be.false;
        });

        it("Should not be able to release a deliverable that doesn't exists.", async function() {
            const success = await ac.publishAllRepositories("invaliddeliv");
            expect(success).to.be.false;
        });

        it("Should not be close to release a deliverable that doesn't exists.", async function() {
            const success = await ac.closeAllRepositories("invaliddeliv");
            expect(success).to.be.false;
        });

        it("Should not be able to get the status of an invalid deliverable.", async function() {
            const result = await ac.getAssignmentStatus("invaliddelv");
            expect(result).to.be.null;
        });

        it("Should not be able to get the status of an non-assignment.", async function() {
            const result = await ac.getAssignmentStatus(Test.DELIVID0);
            expect(result).to.be.null;
        });

        it("Should not be able to publish grades for a non-assignment.", async () => {
            const result = await ac.publishAllGrades(Test.DELIVID0);
            expect(result).to.be.false;
        });
    });

    describe("Students adding/dropping course in the middle of the course.", () => {
        before(async function() {
            Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
        });

        after(async function() {
            Config.getInstance().setProp(ConfigKey.org, ORIGINAL_ORG);
        });

        beforeEach(async function() {
            const exec = Test.runSlowTest();

            if (exec) {
                Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
            } else {
                Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
                this.skip();
            }
        });

        it("Should be able to reset and clean everything up.", async () => {
            await Test.deleteStaleRepositories();
            await resetData();
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to create repositories for an assignment.", async () => {
            const success = await ac.initializeAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to see an assignment status changing after a new student joins.", async () => {
            const assignStatus: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);

            expect(assignStatus.assignmentStatus).to.be.equal(AssignmentStatus.CREATED);
            const totalStudentCount = assignStatus.totalStudents;
            const studentReposCount = assignStatus.studentRepos;

            const p = Test.createPerson(Test.REALUSER3.id, Test.REALUSER3.csId, Test.REALUSER3.github, "student");
            await db.writePerson(p);

            const newAssignStatus: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);

            expect(newAssignStatus.assignmentStatus).to.be.equal(AssignmentStatus.INACTIVE);
            expect(newAssignStatus.totalStudents).to.be.greaterThan(totalStudentCount);
            expect(newAssignStatus.studentRepos).to.be.equal(studentReposCount);
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to re-create repositories, after a student has been added.", async () => {
            const success = await ac.initializeAllRepositories(Test.ASSIGNID0);
            expect(success).to.be.true;

            const assignStatus: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);

            expect(assignStatus.assignmentStatus).to.be.equal(AssignmentStatus.CREATED);
            expect(assignStatus.totalStudents).to.be.equal(assignStatus.studentRepos);
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to reset all the assignment and repositories.", async () => {
            await resetData();
            await Test.deleteStaleRepositories();
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to initialize and publish assignment repositories.", async () => {
            await ac.initializeAllRepositories(Test.ASSIGNID0);
            await ac.publishAllRepositories(Test.ASSIGNID0);

            const assignStatus: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);
            expect(assignStatus.assignmentStatus).to.equal(AssignmentStatus.RELEASED);
            expect(assignStatus.totalStudents).to.equal(assignStatus.studentRepos);
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able see an updated assignment status after a student joins.", async () => {
            await ac.initializeAllRepositories(Test.ASSIGNID0);
            await ac.publishAllRepositories(Test.ASSIGNID0);

            const assignStatus: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);
            expect(assignStatus.assignmentStatus).to.equal(AssignmentStatus.RELEASED);
            expect(assignStatus.totalStudents).to.equal(assignStatus.studentRepos);

            const p = Test.createPerson(Test.REALUSER3.id, Test.REALUSER3.csId, Test.REALUSER3.github, "student");
            await db.writePerson(p);

            const assignStatus2: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);
            expect(assignStatus2.assignmentStatus).to.be.equal(AssignmentStatus.INACTIVE);
            expect(assignStatus2.totalStudents).to.not.be.equal(assignStatus.totalStudents);
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to initialize repositories again, after a student has been added to a published assignment.", async () => {
            await ac.initializeAllRepositories(Test.ASSIGNID0);

            const assignStatus: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);
            expect(assignStatus.assignmentStatus).to.equal(AssignmentStatus.CREATED);
            expect(assignStatus.totalStudents).to.equal(assignStatus.studentRepos);
        }).timeout(Test.TIMEOUTLONG);

        it("Should be able to release repositories again, after a student has been added to a published assignment.", async () => {
            await ac.publishAllRepositories(Test.ASSIGNID0);

            const assignStatus: {
                assignmentStatus: AssignmentStatus,
                totalStudents: number, studentRepos: number
            } = await ac.updateAssignmentStatus(Test.ASSIGNID0);
            expect(assignStatus.assignmentStatus).to.equal(AssignmentStatus.RELEASED);
            expect(assignStatus.totalStudents).to.equal(assignStatus.studentRepos);
        }).timeout(Test.TIMEOUTLONG);
    });
});

async function resetData() {
    // clear stale data
    const db = DatabaseController.getInstance();
    await db.clearData();

    await Test.preparePeople();
    await Test.prepareAuth();
    await Test.prepareAssignment();
    await Test.prepareAssignment2();
}

function getProjectPrefix(): string {
    return "TEST__X__secap_";
}

function getTeamPrefix() {
    return "TEST__X__t_";
}
