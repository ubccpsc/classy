import {expect} from "chai";
import "mocha";

import Log from "../../../../common/Log";
import {PersonController} from "../../src/controllers/PersonController";
import {Person, PersonKind} from "../../src/Types";

import '../GlobalSpec';
import {Test} from "../TestHarness";
import './DeliverablesControllerSpec';

describe("PersonController", () => {

    let pc: PersonController;

    let PERSON1: Person = null;
    let PERSON2: Person = null;
    let PERSON3: Person = null;

    const TIMEOUT = 1000;

    before(async () => {
        await Test.suiteBefore('PersonController');
        PERSON1 = Test.createPerson(Test.USER1.id, Test.USER1.csId, Test.USER1.github, PersonKind.STUDENT);
        PERSON2 = Test.createPerson(Test.USER2.id, Test.USER2.csId, Test.USER2.github, PersonKind.STUDENT);
        PERSON3 = Test.createPerson(Test.USER3.id, Test.USER3.csId, Test.USER3.github, PersonKind.STUDENT);
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
    }).timeout(Test.TIMEOUTLONG);

    it("Should be able to get a person who is not registered but is an admin.", async () => {
        let person = await pc.getPerson(Test.ADMIN1.github);
        expect(person).to.be.null;

        person = await pc.getGitHubPerson(Test.ADMIN1.github);
        expect(person).to.not.be.null;
        expect(person.id).to.equal(Test.ADMIN1.github); // admin ids are their github id
    }).timeout(Test.TIMEOUT);

    it("Should be able to get the repos for a person.", async () => {

        const repos = await pc.getRepos(PERSON1.id);
        expect(repos).to.be.an('array');
        expect(repos).to.be.empty;

        // TODO: create a repo

    }).timeout(Test.TIMEOUTLONG);

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

    }).timeout(Test.TIMEOUTLONG);

    it('Should be able to process an empty classlist', async function() {
        const path = __dirname + '/../data/classlistEmpty.csv';
        const rows = await pc.processClasslist(Test.ADMIN1.id, path, null);
        Log.test('# rows processed: ' + rows.length);
        expect(rows).to.have.lengthOf(0);
    });

    it('Should be able to process a vaild classlist', async function() {
        const path = __dirname + '/../data/classlistValid.csv';
        const rows = await pc.processClasslist(Test.ADMIN1.id, path, null);
        Log.test('# rows processed: ' + rows.length);
        expect(rows).to.have.lengthOf(5);
    });

    it('Should reject a classlist with empty field in fields: CWL, ACCT', async function() {
        const path = __dirname + '/../data/classlistEmptyField.csv';
        let ex = null;
        try {
            await pc.processClasslist(Test.ADMIN1.id, path, null);
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;
    });

    it('Should reject a classlist with duplicate data in fields: CWL, ACCT', async function() {
        const path = __dirname + '/../data/classlistDuplicateField.csv';
        let ex = null;
        try {
            await pc.processClasslist(Test.ADMIN1.id, path, null);
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;
    });

    it('Should be able to process an updated classlist', async function() {
        const path = __dirname + '/../data/classlistValidUpdate.csv';
        const rows = await pc.processClasslist(Test.ADMIN1.id, path, null);
        Log.test('# rows processed: ' + rows.length);
        expect(rows).to.have.lengthOf(5);
    });

    it('Should not be able to process an invalid classlist', async function() {
        let rows = null;
        let ex = null;
        try {
            const path = __dirname + '/../data/classlistInvalid.csv';
            rows = await pc.processClasslist(Test.ADMIN1.id, path, null);
        } catch (err) {
            ex = err;
        }
        expect(rows).to.be.null;
        expect(ex).to.not.be.null;
    });

});
