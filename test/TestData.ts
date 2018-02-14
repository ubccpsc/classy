import {ICommitRecord, IContainerInput, IPushEvent} from "../src/Types";

export class TestData {
    static readonly pushEventA: IPushEvent = {
        "branch":      "master",
        "commitSHA":   "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/",
        "org":         "CPSC310-2017W-T2",
        "postbackURL": "EMPTY",
        "repo":        "d0_team999",
        "timestamp":   1516472872288
    };

    static readonly pushEventPostback: IPushEvent = {
        "branch":      "master",
        "commitSHA":   "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/",
        "org":         "CPSC310-2017W-T2",
        "postbackURL": "POSTBACK",
        "repo":        "d0_team999",
        "timestamp":   1516472872288
    };

    static readonly inputRecordA: IContainerInput = {
        "courseId": "310",
        "delivId":  "d0",
        "pushInfo": TestData.pushEventA
    };

    static readonly commentRecordUserA = {
        "botMentioned": true,
        "commitSHA":    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "userName":     "cs310test",
        "courseId":     "310",
        "delivId":      "d1",
        "postbackURL":  "EMPTY",
        "timestamp":    1516472873288
    };

    static readonly commentRecordUserATooSoon = {
        "botMentioned": true,
        "commitSHA":    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "userName":     "cs310test",
        "courseId":     "310",
        "delivId":      "d1",
        "postbackURL":  "EMPTY",
        "timestamp":    1516523258762
    };

    static readonly commentRecordStaffA = {
        "botMentioned": true,
        "commitSHA":    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "userName":     "staff",
        "courseId":     "310",
        "delivId":      "d1",
        "postbackURL":  "EMPTY",
        "timestamp":    1516472874288
    };

    static readonly outputRecordA: ICommitRecord = {
        "commitURL": "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitSHA": "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "input":     TestData.inputRecordA,
        "output":    {
            "commitUrl":          "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
            "timestamp":          1516523418918,
            "report":             {
                "scoreOverall": 50,
                "scoreTest":    50,
                "scoreCover":   50,
                "passNames":    [],
                "failNames":    [],
                "errorNames":   [],
                "skipNames":    [],
                "custom":       [],
                "feedback":     ""
            },
            "feedback":           "Test Feedback",
            "postbackOnComplete": false,
            "custom":             {},
            "attachments":        [],
            "state":              "SUCCESS"
        }
    };
}
