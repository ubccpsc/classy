import {expect} from "chai";
import * as fs from "fs";
import "mocha";

import Config from "../../common/Config";
import Log from "../../common/Log";
import {ICommentEvent} from "../../common/types/AutoTestTypes";
import {PersonController} from "../../portal/backend/src/controllers/PersonController";
import BackendServer from "../../portal/backend/src/server/BackendServer";
import {Person} from "../../portal/backend/src/Types";
import {MockClassPortal} from "../src/autotest/mocks/MockClassPortal";

import {GitHubUtil} from "../src/github/GitHubUtil";
// const loadFirst = require('./GlobalSpec');
import './GlobalSpec'; // load first

describe("GitHub Event Parser", () => {
    Config.getInstance();

    const GITHUBID = 'rthse2';
    const TIMEOUT = 1000;

    let backend: BackendServer = null;
    before(async function() {
        Log.test("GitHubEventParserSpec::before() - start");
        backend = new BackendServer();
        await backend.start();

        const pc = new PersonController();
        const id = GITHUBID;
        const p: Person = {
            id:            id,
            csId:          id,
            githubId:      id,
            studentNumber: null,

            fName: 'f' + id,
            lName: 'l' + id,
            kind:  null,
            URL:   null,

            labId: null,

            custom: {}
        };
        // person needs to exist so we can do GitHubId <-> PersonId mapping
        await pc.createPerson(p);

        Log.test("GitHubEventParserSpec::before() - done");
    });

    after(async function() {
        Log.test("GitHubEventParserSpec::after() - start");
        await backend.stop();
        Log.test("GitHubEventParserSpec::after() - done");
    });

    it("Should fail gracefully with a bad push.", async () => {

        let actual = await GitHubUtil.processPush(null, new MockClassPortal());
        expect(actual).to.deep.equal(null);

        actual = await GitHubUtil.processPush(undefined, new MockClassPortal());
        expect(actual).to.deep.equal(null);
    });

    it("Should be able to parse a standard push.", async () => {
        const content = readFile("push_master-branch.json");
        const actual = await GitHubUtil.processPush(JSON.parse(content), new MockClassPortal());
        // Log.test(JSON.stringify(actual));

        const expected = {
            "delivId":     "d1",
            // "branch":      "refs/heads/master",
            "repoId":      "d1_project9999",
            "cloneURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
            "commitSHA":   "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "postbackURL": "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
            // "org":         "CPSC310-2017W-T2",
            // "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "timestamp":   1516324553000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a push that created a new branch.", async () => {
        const content = readFile("push_create-new-branch.json");
        const actual = await  GitHubUtil.processPush(JSON.parse(content), new MockClassPortal());
        // Log.test(JSON.stringify(actual));

        const expected = {
            "delivId":     "d1",
            // "branch":      "refs/heads/test2",
            "cloneURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
            "commitSHA":   "6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
            // "org":         "CPSC310-2017W-T2",
            // "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL": "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/6da86d2bdfe8fec9120b60e8d7b71c66077489b6/comments",
            "repoId":      "d1_project9999",
            "timestamp":   1516322017000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a push that deleted an existing branch.", async () => {
        const content = readFile("push_delete-branch.json");
        const actual = await  GitHubUtil.processPush(JSON.parse(content), new MockClassPortal());

        const expected: any = null;
        expect(actual).to.equal(expected); // nothing to do when a branch is deleted
    });

    it("Should be able to parse a push to a branch.", async () => {
        const content = readFile("push_other-branch.json");
        const actual = await GitHubUtil.processPush(JSON.parse(content), new MockClassPortal());
        // Log.test(JSON.stringify(actual));

        const expected = {
            "delivId":     "d1",
            // "branch":      "refs/heads/test2",
            "commitSHA":   "d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            "cloneURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
            "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            // "org":         "CPSC310-2017W-T2",
            // "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL": "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
            "repoId":      "d1_project9999",
            "timestamp":   1516324487000
        };

        expect(actual).to.deep.equal(expected);
    });

    it("Should be able to parse a comment on a master commit with one deliverable and a mention.", async () => {
        const content = readFile("comment_master_bot_one-deliv.json");
        const actual = await GitHubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: ICommentEvent = {
            "botMentioned": true,
            "commitSHA":    "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            // "org":          null,
            "delivId":      "d7",
            "repoId":       "d1_project9999",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            // "repoId":         "d1_project9999",
            "postbackURL":  "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
            "timestamp":    1516324753000,
            "personId":     GITHUBID
        };

        expect(actual).to.deep.equal(expected);
    }).timeout(TIMEOUT * 10);

    it("Should be able to parse a comment on a master commit with multiple deliverables and a mention.", async () => {
        const content = readFile("comment_master_bot_two-deliv.json");
        const actual = await GitHubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: ICommentEvent = {
            "botMentioned": true,
            // "repoId":         "d1_project9999",
            "commitSHA":    "bbe3980fff47b7d6a921e9f89c6727bea639589c",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL":  "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
            "personId":     GITHUBID,
            "repoId":       "d1_project9999",
            // "org":          null,
            "delivId":      "d7",
            "timestamp":    1516324833000
        };

        expect(actual).to.deep.equal(expected);
    }).timeout(TIMEOUT * 10);

    it("Should be able to parse a comment on a master commit with no deliverables and no mention.", async () => {
        const content = readFile("comment_master_no-bot_no-deliv.json");
        const actual = await GitHubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        // const expected: ICommentEvent = {
        //     "botMentioned": false,
        //     // "repoId":         "d1_project9999",
        //     "commitSHA":    "6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
        //     "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
        //     // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
        //     "postbackURL":  "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/6da86d2bdfe8fec9120b60e8d7b71c66077489b6/comments",
        //     "personId":     GITHUBID,
        //     "repoId":       "d1_project9999",
        //     // "org":          null,
        //     "delivId":      null,
        //     "timestamp":    1516320674000
        // };
        //
        const expected: any = null;
        expect(actual).to.deep.equal(expected);
    }).timeout(TIMEOUT * 10);

    it("Should be able to parse a comment on another branch with one deliverable and a mention.", async () => {
        const content = readFile("comment_other-branch_bot_one-deliv.json");
        const actual = await GitHubUtil.processComment(JSON.parse(content));
        Log.test(JSON.stringify(actual));

        const expected: ICommentEvent = {
            "botMentioned": true,
            // "repoId":         "d1_project9999",
            "commitSHA":    "d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
            // "projectURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999",
            "postbackURL":  "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
            "personId":     GITHUBID,
            "repoId":       "d1_project9999",
            // "org":          null,
            "delivId":      "d7",
            "timestamp":    1516324931000
        };

        expect(actual).to.deep.equal(expected);
    }).timeout(TIMEOUT * 10);

    function readFile(fName: string): string {
        return fs.readFileSync("./test/githubEvents/" + fName, "utf8");
    }

});
