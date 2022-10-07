import {expect} from "chai";
import "mocha";

import {TestHarness} from "@common/TestHarness";
import "@common/GlobalSpec";
import Util from "@common/Util"; // load first

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

});
