import { expect } from "chai";
import "mocha";

import { TestHarness } from "@common/TestHarness";

import { PersonController } from "@backend/controllers/PersonController";
import { Person, PersonKind } from "@backend//Types";

import "@common/GlobalSpec"; // load first
import "./DeliverablesControllerSpec";

describe("PersonController", () => {
	let pc: PersonController;

	let PERSON1: Person = null;
	let PERSON2: Person = null;
	let PERSON3: Person = null;

	before(async () => {
		await TestHarness.suiteBefore("PersonController");
		PERSON1 = TestHarness.createPerson(TestHarness.USER1.id, TestHarness.USER1.csId, TestHarness.USER1.github, PersonKind.STUDENT);
		PERSON2 = TestHarness.createPerson(TestHarness.USER2.id, TestHarness.USER2.csId, TestHarness.USER2.github, PersonKind.STUDENT);
		PERSON3 = TestHarness.createPerson(TestHarness.USER3.id, TestHarness.USER3.csId, TestHarness.USER3.github, PersonKind.STUDENT);
	});

	beforeEach(() => {
		pc = new PersonController();
	});

	after(async () => {
		TestHarness.suiteAfter("PersonController");
	});

	it("Should be able to be validate a new user.", async () => {
		const people = await pc.getAllPeople();
		expect(people).to.have.lengthOf(0);

		let person = await pc.getPerson(PERSON1.id);
		expect(person).to.be.null;

		person = await pc.createPerson(PERSON1);
		expect(person).to.not.be.null;

		person = await pc.getPerson(PERSON1.id);
		expect(person).to.not.be.null;
	});

	it("Should not add a person a second time.", async () => {
		let people = await pc.getAllPeople();
		expect(people).to.have.lengthOf(1);

		let person = await pc.getPerson(PERSON1.id);
		expect(person).to.not.be.null;

		people = await pc.getAllPeople();
		expect(people).to.have.lengthOf(1);

		person = await pc.createPerson(PERSON1);
		expect(person).to.not.be.null; // returns the existing one

		people = await pc.getAllPeople();
		expect(people).to.have.lengthOf(1); // should still be the same number
	});

	it("Should be able to add a more users.", async () => {
		let people = await pc.getAllPeople();
		expect(people).to.have.lengthOf(1);

		let person = await pc.createPerson(PERSON2);
		expect(person).to.not.be.null;

		person = await pc.createPerson(PERSON3);
		expect(person).to.not.be.null;

		people = await pc.getAllPeople();
		expect(people).to.have.lengthOf(3);
	});

	it("Should be able to get a person.", async () => {
		let person = await pc.getPerson(PERSON1.id);
		expect(person).to.not.be.null;
		expect(person.id).to.equal(PERSON1.id);

		person = await pc.getPerson("randomIDthatDoesNotexist23232333");
		expect(person).to.be.null;

		person = await pc.getGitHubPerson(PERSON1.githubId);
		expect(person).to.not.be.null;
		expect(person.id).to.equal(PERSON1.id);

		person = await pc.getGitHubPerson("randomIDthatDoesNotexist23232333");
		expect(person).to.be.null;
	}).timeout(TestHarness.TIMEOUTLONG);

	it("Should be able to write a person.", async () => {
		let person = await pc.getPerson(PERSON1.id);
		expect(person).to.not.be.null;
		expect(person.id).to.equal(PERSON1.id);
		expect(person.custom.myProp).to.be.undefined;

		person.custom.myProp = true;
		const success = await pc.writePerson(person);
		expect(success).to.be.true;
		person = await pc.getPerson(PERSON1.id);
		expect(person.custom.myProp).to.be.true;
	}).timeout(TestHarness.TIMEOUTLONG);

	it("Should be able to get a person who is not registered but is an admin.", async () => {
		let person = await pc.getPerson(TestHarness.ADMIN1.github);
		expect(person).to.be.null;

		person = await pc.getGitHubPerson(TestHarness.ADMIN1.github);
		expect(person).to.not.be.null;
		expect(person.id).to.equal(TestHarness.ADMIN1.github); // admin ids are their github id
	}).timeout(TestHarness.TIMEOUT);

	it("Should be able to get the repos for a person.", async () => {
		const repos = await pc.getRepos(PERSON1.id);
		expect(repos).to.be.an("array");
		expect(repos).to.be.empty;

		// TODO: create a repo
	}).timeout(TestHarness.TIMEOUTLONG);

	it("Should be able to translate a person.", async () => {
		const person = await pc.getPerson(PERSON1.id);
		expect(person).to.not.be.null;
		expect(person.id).to.equal(PERSON1.id);

		// not exhaustive
		let trans = PersonController.personToTransport(person);
		expect(trans.id).to.equal(person.id);
		expect(trans.labId).to.equal(person.labId);
		expect(trans.firstName).to.equal(person.fName);
		expect(trans.lastName).to.equal(person.lName);

		trans = null;
		let ex = null;
		try {
			trans = PersonController.personToTransport(null);
		} catch (err) {
			ex = err;
		}
		expect(trans).to.be.null;
		expect(ex).to.not.be.null;
	}).timeout(TestHarness.TIMEOUTLONG);
});
