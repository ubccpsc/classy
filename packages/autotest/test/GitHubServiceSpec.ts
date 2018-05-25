const loadFirst = require('./GlobalSpec');

import {expect} from "chai";
import "mocha";

import Config from "../../common/Config";
import Log from "../../common/Log";

import {GithubService, IGithubMessage, IGithubService} from "../src/github/GithubService";

describe("GitHub Markdown Service", () => {
    Config.getInstance("test");

    const VALID_URL = "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments";
    // const INVALID_URL = "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2XXXXXINVALID/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments";

    let gh: IGithubService;

    before(function () {
        gh = new GithubService();
    });

    it("Should be able to post a valid message.", () => {
        const post: IGithubMessage = {
            url:     VALID_URL,
            message: "Automated Test Suite Message"
        };

        Log.test("Trying a valid url");
        return gh.postMarkdownToGithub(post).then(function (res: boolean) {
            Log.test("Success (expected)");
            expect(res).to.equal(true);
        }).catch(function (err) {
            Log.test("Failure (unexpected)");
            expect.fail();
        });
    });

    it("Should fail when trying to post an invalid message.", () => {
        const post: any = {
            url: VALID_URL
        };

        Log.test("Trying an invalid message");
        return gh.postMarkdownToGithub(post).then(function (res: boolean) {
            Log.test("Success (unexpected)");
            expect.fail();
        }).catch(function (err) {
            Log.test("Failure (expected)");
            expect(err).to.equal(false);
        });
    });

});
