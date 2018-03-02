import {Test} from "./GlobalSpec";
import {expect} from "chai";
import "mocha";
import {PersonController} from "../src/controllers/PersonController";
import {Person} from "../src/Types";

const loadFirst = require('./GlobalSpec');
const dFirst = require('./DeliverablesControllerSpec');

describe("PersonController", () => {

    let pc: PersonController;

    let PERSON1: Person = null;
    let PERSON2: Person = null;
    let PERSON3: Person = null;

    before(async () => {
        PERSON1 = {
            id:            Test.USERNAME1,
            csId:          Test.USERNAME1, // sdmm doesn't have these
            githubId:      Test.USERNAME1,
            studentNumber: null,

            org:    Test.ORGNAME,
            fName:  '',
            lName:  '',
            kind:   'student',
            url:    'https://github.com/' + Test.USERNAME1,
            labId:  'UNKNOWN',
            custom: {}
        };

        PERSON2 = {
            id:            Test.USERNAME2,
            csId:          Test.USERNAME2, // sdmm doesn't have these
            githubId:      Test.USERNAME2,
            studentNumber: null,

            org:    Test.ORGNAME,
            fName:  '',
            lName:  '',
            kind:   'student',
            url:    'https://github.com/' + Test.USERNAME2,
            labId:  'UNKNOWN',
            custom: {}
        };

        PERSON3 = {
            id:            Test.USERNAME3,
            csId:          Test.USERNAME3, // sdmm doesn't have these
            githubId:      Test.USERNAME3,
            studentNumber: null,

            org:    Test.ORGNAME,
            fName:  '',
            lName:  '',
            kind:   'student',
            url:    'https://github.com/' + Test.USERNAME1,
            labId:  'UNKNOWN',
            custom: {}
        };
    });

    beforeEach(() => {
        pc = new PersonController();

    });

    it("Should be able to be validate a new user.", async () => {
        let people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(0);

        let person = await pc.getPerson(Test.ORGNAME, PERSON1.id);
        expect(person).to.be.null;

        person = await pc.createPerson(PERSON1);
        expect(person).to.not.be.null;

        person = await pc.getPerson(Test.ORGNAME, PERSON1.id);
        expect(person).to.not.be.null;
    });

    it("Should not add a person a second time.", async () => {
        let people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(1);

        let person = await pc.getPerson(Test.ORGNAME, PERSON1.id);
        expect(person).to.not.be.null;

        people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(1);

        person = await pc.createPerson(PERSON1);
        expect(person).to.be.null;

        people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(1);
    });

    it("Should be able to add a more users.", async () => {
        let people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(1);

        let person = await pc.createPerson(PERSON2);
        expect(person).to.not.be.null;

        person = await pc.createPerson(PERSON3);
        expect(person).to.not.be.null;

        people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(3);
    });

});
