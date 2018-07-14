require('./GlobalSpec');

import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../common/Config";
import Log from "../../common/Log";

import {GitHubService, IGitHubMessage, IGitHubService} from "../src/github/GitHubService";

describe("GitHub Markdown Service", () => {
    Config.getInstance();

    // POST /repos/:owner/:repo/commits/:sha/comments
    const VALID_URL = "https://api.github.com/repos/classytest/PostTestDoNotDelete/commits/c35a0e5968338a9757813b58368f36ddd64b063e/comments";
    // const VALID_URL = "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments";
    // const INVALID_URL = "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2XXXXXINVALID/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments";

    const TIMEOUT = 5000;

    let gh: IGitHubService;

    let postbackVal = Config.getInstance().getProp(ConfigKey.postback);

    before(function () {
        gh = new GitHubService();

        // set postback to be true so we an actually validate this
        let config = Config.getInstance();
        config.setProp(ConfigKey.postback, true);
    });

    after(function () {
        // return postback val
        let config = Config.getInstance();
        config.setProp(ConfigKey.postback, postbackVal);
    });

    it("Should be able to post a valid message.", function () {
        const post: IGitHubMessage = {
            url:     VALID_URL,
            message: "Automated Test Suite Message"
        };

        Log.test("Trying a valid url");
        return gh.postMarkdownToGithub(post).then(function (res: boolean) {
            Log.test("Success (expected)");
            expect(res).to.equal(true);
        }).catch(function (err) {
            Log.test("Failure (unexpected): " + err);
            expect.fail();
        });
    }).timeout(TIMEOUT);

    it("Should fail when trying to post an invalid message.", () => {
        const post: any = {
            url: VALID_URL
        };

        Log.test("Trying an invalid message");
        return gh.postMarkdownToGithub(post).then(function (res: boolean) {
            Log.test("Success (unexpected): " + res);
            expect.fail();
        }).catch(function (err) {
            Log.test("Failure (expected)");
            expect(err).to.equal(false);
        });
    });

});
