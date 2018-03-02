import {Test} from "./GlobalSpec";
import {expect} from "chai";
import "mocha";
import {PersonController} from "../src/controllers/PersonController";

const loadFirst = require('./GlobalSpec');
const dFirst = require('./DeliverablesControllerSpec');

describe("PersonController", () => {

    let pc: PersonController;

    before(async () => {
    });

    beforeEach(() => {
        pc = new PersonController();

    });

    it("Should be able to be validate a new user.", async () => {
        let people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(0);

        let person = await pc.getPerson(Test.ORGNAME, Test.USERNAME1);
        expect(person).to.not.be.null;
        people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(1);
    });

    it("Should not add a person a second time.", async () => {
        let people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(1);

        let person = await pc.getPerson(Test.ORGNAME, Test.USERNAME1);
        expect(person).to.not.be.null;
        people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(1);
    });

    it("Should be able to add a more users.", async () => {
        let people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(1);

        let person = await pc.getPerson(Test.ORGNAME, Test.USERNAME2);
        expect(person).to.not.be.null;
        people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(2);

        person = await pc.getPerson(Test.ORGNAME, Test.USERNAME3);
        expect(person).to.not.be.null;
        people = await pc.getAllPeople(Test.ORGNAME);
        expect(people).to.have.lengthOf(3);
    });

});
