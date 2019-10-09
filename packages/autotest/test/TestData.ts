import {AutoTestResult, IFeedbackGiven} from "../../common/types/AutoTestTypes";
import {CommitTarget, ContainerInput, ContainerState} from "../../common/types/ContainerTypes";

export class TestData {
    public static readonly pushEventA: CommitTarget = {
        cloneURL:     "",
        commitSHA:    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        commitURL:    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        postbackURL:  "EMPTY",
        repoId:       "d0_team999",
        timestamp:    1516472872288,
        botMentioned: false,
        personId:     null,
        kind:         'push',
        flags:        [],
        delivId:      "d0"
    };

    public static readonly pushEventB: CommitTarget = {
        // "branch":      "master",
        cloneURL:     "",
        commitSHA:    "eventb0918b872997de4c4d2baf4c263f8d4c6dc2",
        commitURL:    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/eventb0918b872997de4c4d2baf4c263f8d4c6dc2",
        postbackURL:  "EMPTY",
        repoId:       "d0_team999",
        timestamp:    1516992872288,
        botMentioned: false,
        personId:     null,
        kind:         'push',
        flags:        [],
        delivId:      "d0"
    };

    public static readonly pushEventPostback: CommitTarget = {
        // "branch":      "master",
        cloneURL:     "",
        commitSHA:    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        commitURL:    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        // "projectURL": "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/",
        postbackURL:  "POSTBACK",
        repoId:       "d0_team999",
        timestamp:    1516472872288,
        botMentioned: false,
        personId:     null,
        kind:         'push',
        flags:        [],
        delivId:      "d0"
    };

    public static readonly inputRecordA: ContainerInput = {
        delivId:         "d0",
        containerConfig: {
            dockerImage:        "imageName",
            studentDelay:       300,
            maxExecTime:        6000,
            regressionDelivIds: [],
            custom:             {},
            openTimestamp:      0,
            closeTimestamp:     10000,
            lateAutoTest:       true,
        },
        target:          TestData.pushEventA,
    };

    public static readonly inputRecordB: ContainerInput = {
        delivId:         "d0",
        containerConfig: {
            dockerImage:        "imageName",
            studentDelay:       300,
            maxExecTime:        6000,
            regressionDelivIds: [],
            custom:             {},
            openTimestamp:      0,
            closeTimestamp:     10000,
            lateAutoTest:       true,
        },
        target:          TestData.pushEventB,
    };

    public static readonly commentRecordUserA: CommitTarget = {
        botMentioned: true,
        commitSHA:    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        commitURL:    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        personId:     "cs310test",
        kind:         'standard',
        flags:        [],
        repoId:       "d0_team999",
        delivId:      "d1",
        postbackURL:  "EMPTY",
        cloneURL:     "https://cloneURL",
        timestamp:    1516472873288
    };

    public static readonly commentRecordUserATooSoon: CommitTarget = {
        botMentioned: true,
        commitSHA:    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        commitURL:    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        personId:     "cs310test",
        kind:         'standard',
        flags:        [],
        repoId:       "d0_team999",
        delivId:      "d1",
        postbackURL:  "EMPTY",
        cloneURL:     "https://cloneURL",
        timestamp:    1516523258762
    };

    public static readonly commentRecordStaffA: CommitTarget = {
        botMentioned: true,
        commitSHA:    "abe1b0918b872997de4c4d2baf4c263f8d4staff",
        commitURL:    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4staff",
        personId:     "staff",
        kind:         'standard',
        flags:        [],
        repoId:       "d0_team999",
        delivId:      "d1",
        postbackURL:  "EMPTY",
        cloneURL:     "https://cloneURL",
        timestamp:    1516472874288
    };

    public static readonly feedbackRecordA: IFeedbackGiven = {
        personId:  TestData.commentRecordStaffA.personId,
        // org:       TestData.commentRecordStaffA.org,
        delivId:   TestData.commentRecordStaffA.delivId,
        timestamp: TestData.commentRecordStaffA.timestamp + 1000,
        commitURL: TestData.commentRecordStaffA.commitURL,
        kind:      'standard'
    };

    public static readonly feedbackRecordB: IFeedbackGiven = {
        personId:  TestData.commentRecordUserA.personId,
        // org:       TestData.commentRecordUserA.org,
        delivId:   TestData.commentRecordUserA.delivId,
        timestamp: TestData.commentRecordUserA.timestamp + 1000,
        commitURL: TestData.commentRecordUserA.commitURL,
        kind:      'standard'
    };

    public static readonly outputRecordA: AutoTestResult = {
        delivId:   TestData.inputRecordA.delivId,
        repoId:    TestData.inputRecordA.target.repoId,
        // "timestamp": TestData.inputRecordA.pushInfo.timestamp,
        commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        commitSHA: "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        input:     TestData.inputRecordA,
        output:    {
            timestamp:          1516523418918,
            report:             {
                scoreOverall: 50,
                scoreTest:    50,
                scoreCover:   50,
                passNames:    [],
                failNames:    [],
                errorNames:   [],
                skipNames:    [],
                custom:       [],
                feedback:     "Test Feedback",
                result:       "SUCCESS",
                attachments:  []
            },
            // "feedback":           "Test Feedback",
            postbackOnComplete: false,
            custom:             {},
            state:              ContainerState.SUCCESS,
            graderTaskId:       ""
        }
    };

    public static readonly outputRecordB: AutoTestResult = {
        delivId:   TestData.inputRecordB.delivId,
        repoId:    TestData.inputRecordB.target.repoId,
        // "timestamp": TestData.inputRecordB.pushInfo.timestamp,
        commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4staff",
        commitSHA: "abe1b0918b872997de4c4d2baf4c263f8d4staff",
        input:     TestData.inputRecordA,
        output:    {
            timestamp:          1516523418918,
            report:             {
                scoreOverall: 50,
                scoreTest:    50,
                scoreCover:   50,
                passNames:    [],
                failNames:    [],
                errorNames:   [],
                skipNames:    [],
                custom:       [],
                feedback:     "Test Feedback",
                result:       "SUCCESS",
                attachments:  []
            },
            // "feedback":           "Test Feedback",
            postbackOnComplete: false,
            custom:             {},
            state:              ContainerState.SUCCESS,
            graderTaskId:       ""
        }
    };
}
