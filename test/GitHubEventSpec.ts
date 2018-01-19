import {AutoTest} from "../src/autotest/AutoTest";
import {DummyClassPortal, IClassPortal} from "../src/autotest/ClassPortal";
import {DummyDataStore} from "../src/autotest/DataStore";
import {DummyGithubService} from "../src/autotest/GithubService";
import Log from "../src/Log";
import {ICommentEvent, IPushEvent} from "../src/Types";

import {expect} from "chai";
import * as fs from "fs";
import "mocha";
import {GithubUtil} from "../src/util/GithubUtil";

describe("GitHub Event Parser", () => {

    it("Should be able to parse a standard push.", () => {
        const content = readFile("push_master-branch.json");
        const actual = GithubUtil.processPush(JSON.parse(content));
        // Log.test(JSON.stringify(actual));

        const expected = {
            "branch":     "refs/heads/master",
            "repo":       "d1_project9999",
            "commitSHA":  "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "org":        "CPSC310-2017W-T2",
            "projectURL": "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "timestamp":  1516324553000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a push that created a new branch.", () => {
        const content = readFile("push_create-new-branch.json");
        const actual = GithubUtil.processPush(JSON.parse(content));
        // Log.test(JSON.stringify(actual));

        const expected = {
            "branch":     "refs/heads/test2",
            "commitSHA":  "6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            "commitURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            "org":        "CPSC310-2017W-T2",
            "projectURL": "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "repo":       "d1_project9999",
            "timestamp":  1516322017000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a push to a branch.", () => {
        const content = readFile("push_other-branch.json");
        const actual = GithubUtil.processPush(JSON.parse(content));
        // Log.test(JSON.stringify(actual));

        const expected = {
            "branch":     "refs/heads/test2",
            "commitSHA":  "d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            "commitURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            "org":        "CPSC310-2017W-T2",
            "projectURL": "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "repo":       "d1_project9999",
            "timestamp":  1516324487000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a comment on a master commit with one deliverable and a mention.", () => {
        const content = readFile("comment_master_bot_one-deliv.json");
        const actual = GithubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: any = {
            "botMentioned": true,
            "commitSHA":    "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "courseId":     null,
            "delivId":      "d7",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            // "repo":         "d1_project9999",
            "timestamp":    1516324753000,
            "userName":     "cs310"
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a comment on a master commit with multiple deliverables and a mention.", () => {
        const content = readFile("comment_master_bot_two-deliv.json");
        const actual = GithubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: any = {
            "botMentioned": true,
            // "repo":         "d1_project9999",
            "commitSHA":    "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "userName":     "cs310",
            "courseId":     null,
            "delivId":      "d7",
            "timestamp":    1516324833000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a comment on a master commit with no deliverables and no mention.", () => {
        const content = readFile("comment_master_no-bot_no-deliv.json");
        const actual = GithubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: any = {
            "botMentioned": false,
            // "repo":         "d1_project9999",
            "commitSHA":    "6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "userName":     "cs310",
            "courseId":     null,
            "delivId":      null,
            "timestamp":    1516320674000
        };

        expect(actual).to.deep.equal(expected);
    });


    it("Should be able to parse a comment on another branch with one deliverable and a mention.", () => {
        const content = readFile("comment_other-branch_bot_one-deliv.json");
        const actual = GithubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: any = {
            "botMentioned": true,
            // "repo":         "d1_project9999",
            "commitSHA":    "d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "userName":     "cs310",
            "courseId":     null,
            "delivId":      "d7",
            "timestamp":    1516324931000
        };

        expect(actual).to.deep.equal(expected);
    });

    function readFile(fName: string): string {
        return fs.readFileSync("./test/githubEvents/" + fName, "utf8");
    }

});
