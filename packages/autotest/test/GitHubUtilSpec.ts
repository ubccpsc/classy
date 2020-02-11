import {expect} from "chai";
import "mocha";

import Config from "../../common/Config";
import Log from "../../common/Log";
import {Test} from "../../common/TestHarness";
import Util from "../../common/Util";
import {GitHubUtil} from "../src/github/GitHubUtil";
// const loadFirst = require('./GlobalSpec');
import "./GlobalSpec";

describe("GitHubUtil", () => {
    Config.getInstance();

    before(() => {
        Log.test("GitHubUtilSpec::before");
    });

    after(() => {
        Log.test("GitHubUtilSpec::after");
    });

    it("Should be able to correctly parse deliv ids from a commit comment.", () => {
        let actual = '';

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #d1", ["d1", "d2", "project"]);
        expect(actual).to.equal("d1");

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot d1", ["d1", "d2", "project"]);
        expect(actual).to.be.null;

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #d101", ["d101", "d2", "project"]);
        expect(actual).to.equal("d101");

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #a1", ["d1", "d2", "project"]);
        expect(actual).to.be.null;

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #a1", ["d1", "d2", "project", "a1"]);
        expect(actual).to.equal("a1");
    });

    it("Should be able to correctly parse #silent from a commit comment.", () => {
        let actual;

        actual = GitHubUtil.parseCommandFromComment("@ubcbot #d1", 'silent');
        expect(actual).to.be.false;

        actual = GitHubUtil.parseCommandFromComment("@ubcbot d1", 'silent');
        expect(actual).to.be.false;

        actual = GitHubUtil.parseCommandFromComment("@ubcbot #d101 #silent", 'silent');
        expect(actual).to.be.true;

        actual = GitHubUtil.parseCommandFromComment("@ubcbot #silent.", 'silent');
        expect(actual).to.be.true;
    });

    it("Should be able to correctly parse #force from a commit comment.", () => {
        let actual;

        actual = GitHubUtil.parseCommandFromComment("@ubcbot #d1", 'force');
        expect(actual).to.be.false;

        actual = GitHubUtil.parseCommandFromComment("@ubcbot d1", 'force');
        expect(actual).to.be.false;

        actual = GitHubUtil.parseCommandFromComment("@ubcbot #d101 #silent #force", 'force');
        expect(actual).to.be.true;

        actual = GitHubUtil.parseCommandFromComment("@ubcbot #force.", 'force');
        expect(actual).to.be.true;
    });

    it("Should be able to find extra commands from a commit comment.", () => {
        let actual;

        actual = GitHubUtil.parseAllCommandsFromComment("@ubcbot #d1 #verbose");
        expect(actual).to.deep.equal(["#d1", "#verbose"]);

        actual = GitHubUtil.parseAllCommandsFromComment("@ubcbot d1 verbose ## # ###");
        expect(actual).to.deep.equal([]);

        actual = GitHubUtil.parseAllCommandsFromComment("@ubcbot #d101 #silent #force #verbose");
        expect(actual).to.deep.equal(["#d101", "#silent", "#force", "#verbose"]);

        actual = GitHubUtil.parseAllCommandsFromComment("@ubcbot #force. #verbose. #force #silent\n");
        expect(actual).to.deep.equal(["#force", "#verbose", "#silent"]);
    });

    it("Should be able to correctly create human durations", () => {
        const now = Date.now();
        const oneSecond = now - 1000;
        const twoSeconds = now - 1000 * 2;
        const oneMinute = now - (60 * 1000);
        const oneMinuteHalf = now - (90 * 1000);
        const halfHour = now - (30 * 60 * 1000);
        const halfHourSecond = now - (30 * 60 * 1000) - 1000;
        const halfHourSeconds = now - (30 * 60 * 1000) - 2000;
        const oneHour = now - (60 * 60 * 1000);
        const oneHourHalf = now - (90 * 60 * 1000);

        expect(Util.tookHuman(oneSecond)).to.equal('1 second');
        expect(Util.tookHuman(twoSeconds)).to.equal('2 seconds');
        expect(Util.tookHuman(oneMinute)).to.equal('1 minute');
        expect(Util.tookHuman(oneMinuteHalf)).to.equal('1 minute and 30 seconds');
        expect(Util.tookHuman(halfHour)).to.equal('30 minutes');
        expect(Util.tookHuman(halfHourSecond)).to.equal('30 minutes and 1 second');
        expect(Util.tookHuman(halfHourSeconds)).to.equal('30 minutes and 2 seconds');
        expect(Util.tookHuman(oneHour)).to.equal('1 hour and 0 minutes');
        expect(Util.tookHuman(oneHourHalf)).to.equal('1 hour and 30 minutes');
    });

});
