"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
require("mocha");
const GlobalSpec_1 = require("../../GlobalSpec");
const GradesController_1 = require("../../../src/controllers/GradesController");
const AssignmentController_1 = require("../../../src/controllers/340/AssignmentController");
const RepositoryController_1 = require("../../../src/controllers/RepositoryController");
const TeamController_1 = require("../../../src/controllers/TeamController");
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
const TEST_REPO_ID = "A2_REPO_STUDENT0";
const TEST_ASSN_ID = "A2";
describe.skip("CS340: AssignmentController", () => {
    let ac = new AssignmentController_1.AssignmentController();
    let gc = new GradesController_1.GradesController();
    let tc = new TeamController_1.TeamController();
    let rc = new RepositoryController_1.RepositoryController();
    before(() => __awaiter(this, void 0, void 0, function* () {
    }));
    beforeEach(() => {
        ac = new AssignmentController_1.AssignmentController();
    });
    it("Attempting to retrieve an assignment grade that doesn't exist should return null.", () => __awaiter(this, void 0, void 0, function* () {
        let assignmentGrades = yield ac.getAssignmentGrade("student1", "a1");
        chai_1.expect(assignmentGrades).equals(null);
    }));
    it("Should be able to create an assignment grade.", () => __awaiter(this, void 0, void 0, function* () {
        let assignmentGrade = yield ac.getAssignmentGrade(TEST_STUDENT_ID_0, "a2");
        chai_1.expect(assignmentGrade).equals(null);
        let aPayload = {
            assignmentID: "a2",
            studentID: TEST_STUDENT_ID_0,
            questions: [
                {
                    questionName: "Question 1",
                    commentName: "",
                    subQuestion: [
                        {
                            sectionName: "code",
                            grade: 4,
                            feedback: "Good job!"
                        },
                        {
                            sectionName: "reasoning",
                            grade: 5,
                            feedback: ""
                        }
                    ]
                },
                {
                    questionName: "Question 2",
                    commentName: "",
                    subQuestion: [
                        {
                            sectionName: "code",
                            grade: 2,
                            feedback: "Improper implementation"
                        }
                    ]
                }
            ]
        };
        let team1 = yield tc.getTeam(GlobalSpec_1.Test.TEAMNAME1);
        let repo2 = yield rc.createRepository(GlobalSpec_1.Test.REPONAME2, [team1], null);
        yield ac.setAssignmentGrade(GlobalSpec_1.Test.REPONAME2, TEST_ASSN_ID, aPayload);
        let aGrade = yield ac.getAssignmentGrade(GlobalSpec_1.Test.USERNAME1, TEST_ASSN_ID);
        let grade = yield gc.getGrade(GlobalSpec_1.Test.USERNAME1, TEST_ASSN_ID);
        chai_1.expect(aGrade).to.not.be.null;
        chai_1.expect(aGrade.assignmentID).equals("a2");
        chai_1.expect(aGrade.studentID).equals(TEST_STUDENT_ID_0);
        chai_1.expect(aGrade.questions).to.have.lengthOf(2);
        chai_1.expect(grade).to.not.be.null;
        chai_1.expect(grade.score).equals(11);
    }));
    it("Should be able to update a grade.", () => __awaiter(this, void 0, void 0, function* () {
        let team1 = yield tc.getTeam(GlobalSpec_1.Test.TEAMNAME1);
        let repo2 = yield rc.getRepository(GlobalSpec_1.Test.REPONAME2);
        let previousGradeRecords = yield gc.getAllGrades();
        let aPayload = {
            assignmentID: "a2",
            studentID: TEST_STUDENT_ID_0,
            questions: [
                {
                    questionName: "Question 1",
                    commentName: "",
                    subQuestion: [
                        {
                            sectionName: "code",
                            grade: 3,
                            feedback: ""
                        }
                    ]
                },
                {
                    questionName: "Question 2",
                    commentName: "",
                    subQuestion: [
                        {
                            sectionName: "code",
                            grade: 5,
                            feedback: "Nice job"
                        }
                    ]
                }
            ]
        };
        yield ac.setAssignmentGrade(GlobalSpec_1.Test.REPONAME2, TEST_ASSN_ID, aPayload);
        let afterGradeRecords = yield gc.getAllGrades();
        chai_1.expect(previousGradeRecords.length - afterGradeRecords.length).to.equal(0);
        let grade = yield gc.getGrade(GlobalSpec_1.Test.USERNAME1, TEST_ASSN_ID);
        chai_1.expect(grade).to.not.be.null;
        chai_1.expect(grade.score).to.equal(8);
    }));
    it("Should be able to handle arbitrary subquestion sizes", () => __awaiter(this, void 0, void 0, function* () {
        let aPayload = {
            assignmentID: "a2",
            studentID: TEST_STUDENT_ID_0,
            questions: [
                {
                    questionName: "Question 1",
                    commentName: "",
                    subQuestion: [
                        {
                            sectionName: "code",
                            grade: 3,
                            feedback: ""
                        },
                        {
                            sectionName: "writing",
                            grade: 1,
                            feedback: ""
                        },
                        {
                            sectionName: "logic",
                            grade: 10,
                            feedback: ""
                        },
                        {
                            sectionName: "quality",
                            grade: 6,
                            feedback: ""
                        },
                        {
                            sectionName: "grammar",
                            grade: 6,
                            feedback: ""
                        }
                    ]
                },
                {
                    questionName: "Question 2",
                    commentName: "",
                    subQuestion: [
                        {
                            sectionName: "code",
                            grade: 5,
                            feedback: "Nice job"
                        }
                    ]
                }
            ]
        };
        let success = yield ac.setAssignmentGrade(GlobalSpec_1.Test.REPONAME2, TEST_ASSN_ID, aPayload);
        chai_1.expect(success).to.be.true;
        let newGrade = yield gc.getGrade(GlobalSpec_1.Test.USERNAME1, TEST_ASSN_ID);
        chai_1.expect(newGrade).to.not.be.null;
        chai_1.expect(newGrade.score).to.be.equal(31);
        let aGrade = yield ac.getAssignmentGrade(GlobalSpec_1.Test.USERNAME1, TEST_ASSN_ID);
        chai_1.expect(aGrade.studentID).to.be.equal(aPayload.studentID);
        chai_1.expect(aGrade.assignmentID).to.be.equal(aPayload.assignmentID);
    }));
});
//# sourceMappingURL=AssignmentControllerSpec.js.map