import {expect} from "chai";
import "mocha";

import {PersonController} from "../../src/controllers/PersonController";
import {Person} from "../../src/Types";

import {Test} from "../GlobalSpec";
import '../GlobalSpec';
import './DeliverablesControllerSpec';

describe("PersonController", () => {

    let pc: PersonController;

    let PERSON1: Person = null;
    let PERSON2: Person = null;
    let PERSON3: Person = null;

    const TIMEOUT = 1000;

    before(async () => {
        await Test.suiteBefore('PersonController');
        PERSON1 = Test.createPerson(Test.USER1.id, Test.USER1.csId, Test.USER1.github, 'student');
        PERSON2 = Test.createPerson(Test.USER2.id, Test.USER2.csId, Test.USER2.github, 'student');
        PERSON3 = Test.createPerson(Test.USER3.id, Test.USER3.csId, Test.USER3.github, 'student');
    });

    beforeEach(() => {
        pc = new PersonController();
    });

    after(async () => {
        Test.suiteAfter('PersonController');
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

        person = await pc.getPerson('randomIDthatDoesNotexist23232333');
        expect(person).to.be.null;

        person = await pc.getGitHubPerson(PERSON1.githubId);
        expect(person).to.not.be.null;
        expect(person.id).to.equal(PERSON1.id);

        person = await pc.getGitHubPerson('randomIDthatDoesNotexist23232333');
        expect(person).to.be.null;
    }).timeout(Test.TIMEOUTLONG);

});
