const loadFirst = require('./GlobalSpec');

import {expect} from "chai";
import "mocha";

import Config from "../../common/Config";
import Log from "../../common/Log";

import {GitHubUtil} from "../src/github/GitHubUtil";

describe.only("GitHubUtil", () => {
    Config.getInstance();

    before(() => {
        Log.test("GitHubUtilSpec::before");
    });

    after(() => {
        Log.test("GitHubUtilSpec::after");
    });

    it("Should be able to correctly parse deliv ids from a commit comment.", () => {
        let actual = '';

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #d1");
        expect(actual).to.equal("d1");

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot d1");
        expect(actual).to.be.null

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #d101");
        expect(actual).to.equal("d101");

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #a1");
        expect(actual).to.be.null;
    });

    it("Should be able to correctly parse #silent from a commit comment.", () => {
        let actual = false;

        actual = GitHubUtil.parseSilentFromComment("@ubcbot #d1");
        expect(actual).to.be.false;

        actual = GitHubUtil.parseSilentFromComment("@ubcbot d1");
        expect(actual).to.be.false;

        actual = GitHubUtil.parseSilentFromComment("@ubcbot #d101 #silent");
        expect(actual).to.be.true;

        actual = GitHubUtil.parseSilentFromComment("@ubcbot #silent.");
        expect(actual).to.be.true;
    });

    it("Should be able to correctly parse #force from a commit comment.", () => {
        let actual = false;

        actual = GitHubUtil.parseForceFromComment("@ubcbot #d1");
        expect(actual).to.be.false;

        actual = GitHubUtil.parseForceFromComment("@ubcbot d1");
        expect(actual).to.be.false;

        actual = GitHubUtil.parseForceFromComment("@ubcbot #d101 #silent #force");
        expect(actual).to.be.true;

        actual = GitHubUtil.parseForceFromComment("@ubcbot #force.");
        expect(actual).to.be.true;
    });


});
