import {expect} from "chai";
import "mocha";

import Config from "../../common/Config";
import Log from "../../common/Log";
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

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #d1");
        expect(actual).to.equal("d1");

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot d1");
        expect(actual).to.be.null;

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #d101");
        expect(actual).to.equal("d101");

        actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #a1");
        expect(actual).to.be.null;
    });

    it("Should be able to correctly parse #silent from a commit comment.", () => {
        let actual;

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
        let actual;

        actual = GitHubUtil.parseForceFromComment("@ubcbot #d1");
        expect(actual).to.be.false;

        actual = GitHubUtil.parseForceFromComment("@ubcbot d1");
        expect(actual).to.be.false;

        actual = GitHubUtil.parseForceFromComment("@ubcbot #d101 #silent #force");
        expect(actual).to.be.true;

        actual = GitHubUtil.parseForceFromComment("@ubcbot #force.");
        expect(actual).to.be.true;
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
