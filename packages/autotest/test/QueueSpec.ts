import { expect } from "chai";
import "mocha";

import Log from "@common/Log";
import "@common/GlobalSpec";

import { Queue } from "@autotest/autotest/Queue";

import { TestData } from "./TestData";
import Util from "@common/Util";
import { ContainerInput } from "@common/types/ContainerTypes";

describe("Queue", () => {
	let q: Queue;

	before(function () {
		Log.test("QueueSpec::before");
	});

	beforeEach(function () {
		Log.test("QueueSpec::beforeEach");
		q = new Queue("test");
	});

	after(function () {
		Log.test("QueueSpec::after");
		q = new Queue("test");
	});

	it("Should work when empty.", () => {
		let res: any = q.indexOf(TestData.inputRecordA);
		expect(res).to.equal(-1);
		res = q.pop();
		expect(res).to.be.null;
		expect(q.length()).to.equal(0);

		res = q.remove(TestData.inputRecordB);
		expect(res).to.equal(null);
		res = q.indexOf(TestData.inputRecordB);
		expect(res).to.equal(-1);
		expect(q.length()).to.equal(0);
	});

	it("Should be able to push and pop jobs.", () => {
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

	it("Should be able to get the number of jobs for a person.", () => {
		const r1 = Util.clone(TestData.inputRecordA) as ContainerInput;
		const r2 = Util.clone(TestData.inputRecordB) as ContainerInput;
		r1.target.personId = "person1";
		r2.target.personId = "person1";

		expect(q.numberJobsForPerson(r1)).to.equal(0); // nothing added, should return 0

		q.push(r1);
		expect(q.length()).to.equal(1);
		expect(q.numberJobsForPerson(r1)).to.equal(1);

		q.push(r2);
		expect(q.length()).to.equal(2); // should have 2 jobs on queue
		expect(q.numberJobsForPerson(r2)).to.equal(2);
	});

	it("Should be able to replace the oldest job for a person.", () => {
		const r1 = Util.clone(TestData.inputRecordA) as ContainerInput;
		const r2 = Util.clone(TestData.inputRecordB) as ContainerInput;
		r1.target.personId = "person1";
		r1.target.botMentioned = false;
		r2.target.personId = "person1";
		r2.target.botMentioned = false;

		const res: number = q.push(r1);
		expect(res).to.equal(1);
		expect(q.length()).to.equal(1);

		q.replaceOldestForPerson(r2, false);
		expect(q.length()).to.equal(1); // should still be 1
	});

	it("Should not replace the oldest job for a person if the oldest job mentions the bot.", () => {
		const r1 = Util.clone(TestData.inputRecordA) as ContainerInput;
		const r2 = Util.clone(TestData.inputRecordB) as ContainerInput;
		r1.target.personId = "person1";
		r1.target.botMentioned = true;
		r2.target.personId = "person1";
		r2.target.botMentioned = true;

		q.push(r1);
		expect(q.length()).to.equal(1);
		expect(q.numberJobsForPerson(r1)).to.equal(1);

		const job = q.replaceOldestForPerson(r2, true);
		expect(job).to.be.null;
		expect(q.length()).to.equal(2);
		expect(q.numberJobsForPerson(r1)).to.equal(2); // enqued rather than replaced
	});

	it("Should enqueue a job for a person when they do not have one yet.", () => {
		const r1 = Util.clone(TestData.inputRecordA) as ContainerInput;
		const r2 = Util.clone(TestData.inputRecordB) as ContainerInput;
		r1.target.personId = "person1";
		r2.target.personId = "person2"; // new job is for a different person

		const res: number = q.push(r1);
		expect(res).to.equal(1);
		expect(q.length()).to.equal(1);

		q.replaceOldestForPerson(r2, true);
		expect(q.length()).to.equal(2);
	});
});
