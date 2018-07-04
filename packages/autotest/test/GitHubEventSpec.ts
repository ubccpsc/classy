const loadFirst = require('./GlobalSpec');

import {expect} from "chai";
import * as fs from "fs";
import "mocha";

import Config from "../../common/Config";
import Log from "../../common/Log";

import {GitHubUtil} from "../src/github/GitHubUtil";

describe("GitHub Event Parser", () => {
    Config.getInstance();

    it("Should fail gracefully with a bad push.", () => {

        let actual = GitHubUtil.processPush(null);
        expect(actual).to.deep.equal(null);

        actual = GitHubUtil.processPush(undefined);
        expect(actual).to.deep.equal(null);
    });

    it("Should be able to parse a standard push.", () => {
        const content = readFile("push_master-branch.json");
        const actual = GitHubUtil.processPush(JSON.parse(content));
        // Log.test(JSON.stringify(actual));

        const expected = {
            "branch":      "refs/heads/master",
            "repoId":      "d1_project9999",
            "cloneURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
            "commitSHA":   "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "postbackURL": "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
            // "org":         "CPSC310-2017W-T2",
            "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "timestamp":   1516324553000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a push that created a new branch.", () => {
        const content = readFile("push_create-new-branch.json");
        const actual = GitHubUtil.processPush(JSON.parse(content));
        // Log.test(JSON.stringify(actual));

        const expected = {
            "branch":      "refs/heads/test2",
            "cloneURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
            "commitSHA":   "6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            // "org":         "CPSC310-2017W-T2",
            "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL": "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/6da86d2bdfe8fec9120b60e8d7b71c66077489b6/comments",
            "repoId":      "d1_project9999",
            "timestamp":   1516322017000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a push that deleted an existing branch.", () => {
        const content = readFile("push_delete-branch.json");
        const actual = GitHubUtil.processPush(JSON.parse(content));

        const expected: any = null;
        expect(actual).to.equal(null); // nothing to do when a branch is deleted
    });

    it("Should be able to parse a push to a branch.", () => {
        const content = readFile("push_other-branch.json");
        const actual = GitHubUtil.processPush(JSON.parse(content));
        // Log.test(JSON.stringify(actual));

        const expected = {
            "branch":      "refs/heads/test2",
            "commitSHA":   "d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            "cloneURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
            "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            // "org":         "CPSC310-2017W-T2",
            "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL": "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
            "repoId":      "d1_project9999",
            "timestamp":   1516324487000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a comment on a master commit with one deliverable and a mention.", () => {
        const content = readFile("comment_master_bot_one-deliv.json");
        const actual = GitHubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: any = {
            "botMentioned": true,
            "commitSHA":    "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            // "org":          null,
            "delivId":      "d7",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            // "repoId":         "d1_project9999",
            "postbackURL":  "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
            "timestamp":    1516324753000,
            "personId":     "cs310"
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a comment on a master commit with multiple deliverables and a mention.", () => {
        const content = readFile("comment_master_bot_two-deliv.json");
        const actual = GitHubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: any = {
            "botMentioned": true,
            // "repoId":         "d1_project9999",
            "commitSHA":    "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL":  "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
            "personId":     "cs310",
            // "org":          null,
            "delivId":      "d7",
            "timestamp":    1516324833000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a comment on a master commit with no deliverables and no mention.", () => {
        const content = readFile("comment_master_no-bot_no-deliv.json");
        const actual = GitHubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: any = {
            "botMentioned": false,
            // "repoId":         "d1_project9999",
            "commitSHA":    "6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL":  "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/6da86d2bdfe8fec9120b60e8d7b71c66077489b6/comments",
            "personId":     "cs310",
            // "org":          null,
            "delivId":      null,
            "timestamp":    1516320674000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a comment on another branch with one deliverable and a mention.", () => {
        const content = readFile("comment_other-branch_bot_one-deliv.json");
        const actual = GitHubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: any = {
            "botMentioned": true,
            // "repoId":         "d1_project9999",
            "commitSHA":    "d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL":  "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
            "personId":     "cs310",
            // "org":          null,
            "delivId":      "d7",
            "timestamp":    1516324931000
        };

        expect(actual).to.deep.equal(expected);
    });

    function readFile(fName: string): string {
        return fs.readFileSync("./test/githubEvents/" + fName, "utf8");
    }

});
