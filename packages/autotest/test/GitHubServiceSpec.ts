import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../common/Config";
import Log from "../../common/Log";
import {Test} from "../../common/TestHarness";

import {GitHubUtil, IGitHubMessage} from "../src/github/GitHubUtil";
import "./GlobalSpec";

describe("GitHub Markdown Service", () => {
    Config.getInstance();

    // tslint:disable-next-line
    const githubAPI = Config.getInstance().getProp(ConfigKey.githubAPI);
    const VALID_URL = githubAPI + '/repos/classytest/PostTestDoNotDelete/commits/c35a0e5968338a9757813b58368f36ddd64b063e/comments';

    const TIMEOUT = 5000;

    // let gh: IGitHubService;

    const postbackVal = Config.getInstance().getProp(ConfigKey.postback);

    before(function() {
        // gh = new GitHubService();

        // set postback to be true so we an actually validate this
        const config = Config.getInstance();
        config.setProp(ConfigKey.postback, true);
    });

    after(function() {
        // return postback val
        const config = Config.getInstance();
        config.setProp(ConfigKey.postback, postbackVal);
    });

    it("Should be able to post a valid message.", async function() {
        const post: IGitHubMessage = {
            url:     VALID_URL,
            message: "Automated Test Suite Message"
        };

        Log.test("Trying a valid url");
        const res = await GitHubUtil.postMarkdownToGithub(post);
        if (res === true) {
            Log.test("Success (expected)");
            expect(res).to.equal(true);
        } else {
            Log.test("Failure (unexpected)");
            expect.fail();
        }
    }).timeout(TIMEOUT);

    it("Should fail when trying to post an invalid message.", async function() {
        const post: any = {
            url: VALID_URL
        };

        Log.test("Trying an invalid message");

        const res = await GitHubUtil.postMarkdownToGithub(post);
        if (res === true) {
            Log.test("Success (unexpected): " + res);
            expect.fail();
        } else {
            Log.test("Failure (expected)");
            expect(res).to.equal(false);
        }
    }).timeout(TIMEOUT);

});
