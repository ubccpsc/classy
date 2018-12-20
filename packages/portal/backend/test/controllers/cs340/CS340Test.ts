import {AssignmentGradingRubric, AssignmentInfo, AssignmentStatus} from "../../../../../common/types/CS340Types";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import {Deliverable} from "../../../src/Types";

import {Test} from "../../TestHarness";

export class CS340Test {
    public static async prepareAssignment() {
        const dc: DeliverablesController = new DeliverablesController();

        const newAssignmentStatus: AssignmentStatus = AssignmentStatus.INACTIVE;

        const newAssignmentGradingRubric: AssignmentGradingRubric = {
            name:      Test.ASSIGNID0,
            comment:   "test assignment",
            questions: [
                {
                    name:         "question 1",
                    comment:      "",
                    subQuestions: [
                        {
                            name:      "rubric",
                            comment:   "rubric question",
                            outOf:     5,
                            weight:    0.25,
                            modifiers: null
                        }
                    ]
                },
                {
                    name:         "question 2",
                    comment:      "",
                    subQuestions: [
                        {
                            name:      "code quality",
                            comment:   "",
                            outOf:     6,
                            weight:    0.5,
                            modifiers: null
                        }
                    ]
                }
            ]
        };

        const newAssignmentInfo: AssignmentInfo = {
            seedRepoURL:  "https://github.com/SECapstone/capstone",
            seedRepoPath: "",
            mainFilePath: "",
            courseWeight: 0.5,
            status:       newAssignmentStatus,
            rubric:       newAssignmentGradingRubric,
            repositories: []
        };

        const openDate: Date = new Date();
        openDate.setHours(openDate.getHours() + 4);

        const closeDate: Date = new Date();
        closeDate.setDate(closeDate.getDate() + 4);

        const openNumber: number = Date.parse(openDate.toISOString());
        const closeNumber: number = Date.parse(closeDate.toISOString());

        const newDeliv: Deliverable = {
            id:                Test.ASSIGNID0,
            URL:               "",
            repoPrefix:        Test.ASSIGNID0 + "_",
            openTimestamp:     openNumber,
            closeTimestamp:    closeNumber,
            gradesReleased:    false,
            shouldProvision:   true,
            importURL:         null,
            teamMinSize:       1,
            teamMaxSize:       1,
            teamSameLab:       false,
            teamStudentsForm:  false,
            teamPrefix:        Test.ASSIGNID0 + "_",
            lateAutoTest:      false,
            shouldAutoTest:    true,
            autotest:          {
                dockerImage:        'testImage',
                studentDelay:       60 * 60 * 12, // 12h
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {}
            },
            visibleToStudents: true,

            rubric: {},
            custom: {
                assignment: newAssignmentInfo
            }
        };

        // const newDelivSuccess =
        await dc.saveDeliverable(newDeliv);

        // await this.createTeam(this.ASSIGNTEAMNAME0, Test.ASSIGNID0, [Test.REALUSER1.id]);
    }

    public static async prepareAssignmentTeam() {
        await Test.createTeam(Test.ASSIGNTEAMNAME0, Test.ASSIGNID0, [Test.REALUSER1.id]);
    }

    public static async prepareAssignmentTeam2() {
        await Test.createTeam(Test.ASSIGNTEAMNAME1, Test.ASSIGNID1, [Test.REALUSER1.id]);
    }

    public static async prepareAssignment2() {
        const dc: DeliverablesController = new DeliverablesController();

        const newAssignmentStatus: AssignmentStatus = AssignmentStatus.INACTIVE;

        const newAssignmentGradingRubric: AssignmentGradingRubric = {
            name:      Test.ASSIGNID1,
            comment:   "test assignment2",
            questions: []
        };

        const newAssignmentInfo: AssignmentInfo = {
            seedRepoURL:  "https://github.com/CPSC340/test_repository",
            seedRepoPath: "labs/lab2/*",
            mainFilePath: "labs/lab2/a2.tex",
            courseWeight: 0.5,
            status:       newAssignmentStatus,
            rubric:       newAssignmentGradingRubric,
            repositories: []
        };

        const openDate: Date = new Date();
        openDate.setHours(openDate.getHours() + 4);

        const closeDate: Date = new Date();
        closeDate.setDate(closeDate.getDate() + 4);

        const openNumber: number = Date.parse(openDate.toISOString());
        const closeNumber: number = Date.parse(closeDate.toISOString());

        const newDeliv: Deliverable = {
            id:                Test.ASSIGNID1,
            URL:               "",
            repoPrefix:        "",
            visibleToStudents: false,
            rubric:            {},
            openTimestamp:     openNumber,
            closeTimestamp:    closeNumber,
            gradesReleased:    false,
            shouldProvision:   true,
            importURL:         null,
            teamMinSize:       1,
            teamMaxSize:       1,
            teamSameLab:       false,
            teamStudentsForm:  false,
            teamPrefix:        "",
            lateAutoTest:      false,
            shouldAutoTest:    true,
            autotest:          {
                dockerImage:        'testImage',
                studentDelay:       60 * 60 * 12, // 12h
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {}
            },
            custom:            {
                assignment: newAssignmentInfo
            }
        };

        // const newDelivSuccess =
        await dc.saveDeliverable(newDeliv);

        // await this.createTeam(Test.ASSIGNTEAMNAME1, Test.ASSIGNID1, [Test.REALUSER1.id]);
    }
}
