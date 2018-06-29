import {expect} from "chai";
import "mocha";

import {Queue} from "../src/autotest/Queue";
import {TestData} from "./TestData";

const loadFirst = require('./GlobalSpec');

describe("Queue", () => {

    let q: Queue;

    before(function () {
        q = new Queue();
    });

    it("Should work when empty.", () => {
        let res: any = q.indexOf('foo');
        expect(res).to.equal(-1);
        res = q.pop();
        expect(res).to.be.null;
        res = q.length();
        expect(res).to.equal(0);
        res = q.remove('bar');
        expect(res).to.equal(null);
        res = q.indexOf('baz');
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

        res = q.indexOf(TestData.inputRecordA.pushInfo.commitURL);
        expect(res).to.equal(0);

        res = q.remove(TestData.inputRecordA.pushInfo.commitURL);
        expect(res).to.not.be.null;
        expect(q.length()).to.equal(0);
    });
});
