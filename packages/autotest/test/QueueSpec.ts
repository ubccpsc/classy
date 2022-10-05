import {expect} from "chai";
import "mocha";

import Log from "../../common/Log";
import {Queue} from "../src/autotest/Queue";
// const loadFirst = require('./GlobalSpec');
import "@common/test/GlobalSpec";
import {TestData} from "./TestData";

describe("Queue", () => {

    let q: Queue;

    before(function () {
        Log.test("QueueSpec::before");
        q = new Queue('test', 1);
    });

    after(function () {
        Log.test("QueueSpec::after");
        q = new Queue('test', 1);
    });

    it("Should work when empty.", () => {
        let res: any = q.indexOf(TestData.inputRecordA);
        expect(res).to.equal(-1);
        res = q.pop();
        expect(res).to.be.null;
        res = q.length();
        expect(res).to.equal(0);
        res = q.remove(TestData.inputRecordB);
        expect(res).to.equal(null);
        res = q.indexOf(TestData.inputRecordB);
        expect(res).to.equal(-1);
    });

    it("Should work with real data.", () => {
        expect(q.length()).to.equal(0);
        let res: any = q.push(TestData.inputRecordA);
        expect(res).to.equal(1);
        expect(q.length()).to.equal(1);

        expect(q.pop()).to.not.be.null;
        expect(q.length()).to.equal(0);

        res = q.push(TestData.inputRecordA);
        expect(res).to.equal(1);

        res = q.indexOf(TestData.inputRecordA);
        expect(res).to.equal(0);

        res = q.remove(TestData.inputRecordA);
        expect(res).to.not.be.null;
        expect(q.length()).to.equal(0);
    });
});
