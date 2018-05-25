import {expect} from "chai";
import "mocha";

import {Test} from "../../GlobalSpec";

import {GradesController} from "../../../src/controllers/GradesController";
import {AssignmentController, AssignmentGrade} from "../../../src/controllers/340/AssignmentController";
import {RepositoryController} from "../../../src/controllers/RepositoryController";
import {TeamController} from "../../../src/controllers/TeamController";
import {Grade, Repository, Team} from "../../../src/Types";

const loadFirst = require('../../GlobalSpec');
const rFirst = require('./GradeControllerSpec');

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

const TEST_REPO_ID = "A2_REPO_STUDENT0";

const TEST_ASSN_ID = "A2";


xdescribe("AssignmentController", () => {
    let ac: AssignmentController = new AssignmentController();
    let gc: GradesController = new GradesController();
    let tc = new TeamController();
    let rc = new RepositoryController();

    before(async () => {
        // nothing
    });

    beforeEach(() => {
        // initialize a new controller before each tests
        ac = new AssignmentController();
    });

    it("Attempting to retrieve an assignment grade that doesn't exist should return null.", async () => {
        let assignmentGrades = await ac.getAssignmentGrade("CPSC340", "student1", "a1");
        expect(assignmentGrades).equals(null);
    });

    it("Should be able to create an assignment grade.", async () => {
        // Check there is no grade associated with the assignment specified
        let assignmentGrade = await ac.getAssignmentGrade(TEST_ORG, TEST_STUDENT_ID_0, "a2");
        expect(assignmentGrade).equals(null);

        let aPayload = {
            assignmentID: "a2",
            studentID:    TEST_STUDENT_ID_0,
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

        let repo2: Repository = await rc.createRepository(Test.REPONAME2, [team1], null);

        await ac.setAssignmentGrade(Test.ORGNAME, Test.REPONAME2, TEST_ASSN_ID, aPayload);

        let aGrade: AssignmentGrade = await ac.getAssignmentGrade(Test.ORGNAME, Test.USERNAME1, TEST_ASSN_ID);
        let grade: Grade = await gc.getGrade(Test.USERNAME1, TEST_ASSN_ID);
        // Check if the assignment information is set properly
        expect(aGrade.assignmentID).equals("a2");
        expect(aGrade.studentID).equals(TEST_STUDENT_ID_0);
        expect(aGrade.questions).to.have.lengthOf(2);

        // Check if the grade is set properly
        expect(grade.score).equals(11);
    });

    it("Should be able to update a grade.", async () => {
        let team1: Team = await tc.getTeam(Test.TEAMNAME1);
        let repo2: Repository = await rc.getRepository(Test.REPONAME2);

        let previousGradeRecords = await gc.getAllGrades(); // Previous count

        let aPayload = {
            assignmentID: "a2",
            studentID:    TEST_STUDENT_ID_0,
            questions:    [
                {
                    questionName: "Question 1",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       2,
                            feedback:    ""
                        },
                        {
                            sectionName: "reasoning",
                            grade:       1,
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

        await ac.setAssignmentGrade(Test.ORGNAME, Test.REPONAME2, TEST_ASSN_ID, aPayload);

        let afterGradeRecords = await gc.getAllGrades(); // Post command count

        expect(afterGradeRecords.length - afterGradeRecords.length).to.equal(0);

        let grade: Grade = await gc.getGrade(Test.USERNAME1, TEST_ASSN_ID);

        expect(grade.score).to.equal(8);
    });
});
