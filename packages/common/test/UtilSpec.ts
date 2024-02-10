import {expect} from "chai";
import "mocha";
import "@common/GlobalSpec";
import Util from "@common/Util";
import Log from "@common/Log";
import {TestHarness} from "@common/TestHarness"; // load first

describe("Util", function () {

    before(async function () {
        await TestHarness.suiteBefore("Util");
    });

    after(async function () {
        TestHarness.suiteAfter("Util");
    });

    it("Should be able to parse a boolean.", async () => {
        // why this is a problem
        expect(Boolean("false")).to.be.true;
        // false checks
        expect(Util.toBoolean("false")).to.be.false;

        // false checks
        expect(Util.toBoolean(false)).to.be.false;
        expect(Util.toBoolean("False")).to.be.false;
        expect(Util.toBoolean("FALSE")).to.be.false;
        expect(Util.toBoolean("0")).to.be.false;
        expect(Util.toBoolean(0)).to.be.false;
        expect(Util.toBoolean(null)).to.be.false;
        expect(Util.toBoolean(undefined)).to.be.false;

        // true checks
        expect(Util.toBoolean(true)).to.be.true;
        expect(Util.toBoolean("true")).to.be.true;
        expect(Util.toBoolean("True")).to.be.true;
        expect(Util.toBoolean("TRUE")).to.be.true;
        expect(Util.toBoolean("yes")).to.be.true;
        expect(Util.toBoolean("Yes")).to.be.true;
        expect(Util.toBoolean("YES")).to.be.true;
        expect(Util.toBoolean("1")).to.be.true;
        expect(Util.toBoolean(1)).to.be.true;
    });

    it("Should be able to took w/ padding.", () => {
        // sure, there should be some assertions here
        // but instead we were just eyeballing things
        Log.info(Util.tookHuman(0, 1, true, true));
        Log.info(Util.tookHuman(0, 10, true, true));
        Log.info(Util.tookHuman(0, 100, true, true));
        Log.info(Util.tookHuman(0, 999, true, true));
        Log.info(Util.tookHuman(0, 1000, true, true));
        Log.info(Util.tookHuman(0, 9999, true, true));
        Log.info(Util.tookHuman(0, 10000, true, true));
        Log.info(Util.tookHuman(0, 11000, true, true));
        Log.info(Util.tookHuman(0, 1000 * 59, true, true));
        Log.info(Util.tookHuman(0, 1000 * 60, true, true));
        Log.info(Util.tookHuman(0, 1000 * 61, true, true));
        Log.info(Util.tookHuman(0, 1000 * 60 * 5, true, true));
        Log.info(Util.tookHuman(0, 1000 * 60 * 30, true, true));
        Log.info(Util.tookHuman(0, 1000 * 60 * 59, true, true));
        Log.info(Util.tookHuman(0, 1000 * 60 * 60, true, true));
        Log.info(Util.tookHuman(0, 1000 * 60 * 61, true, true));
        Log.info(Util.tookHuman(0, 1000 * 3600 * 1, true, true));
        Log.info(Util.tookHuman(0, 1000 * 3600 * 2, true, true));
        Log.info(Util.tookHuman(0, 1000 * 3600 * 12, true, true));
        Log.info(Util.tookHuman(0, 1000 * 3600 * 24, true, true));
        Log.info(Util.tookHuman(0, 1000 * 3600 * 36, true, true));
        Log.info(Util.tookHuman(0, 1000 * 3600 * 24 * 5, true, true));
    });
});
