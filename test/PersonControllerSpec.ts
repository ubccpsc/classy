const loadFirst = require('./GlobalSpec');
const dFirst = require('./DeliverablesControllerSpec');

import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {PersonController} from "../src/controllers/PersonController";

describe("PersonController", () => {

    let ORGNAME: string;
    let pc: PersonController;

    const NAME1 = 'user1';
    const NAME2 = 'user2';
    const NAME3 = 'user3';

    before(async () => {
        ORGNAME = Config.getInstance().getProp('org');
    });

    beforeEach(() => {
        pc = new PersonController();

    });

    it("Should be able to be validate a new user.", async () => {
        let people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(0);

        let person = await pc.getPerson(ORGNAME, NAME1);
        expect(person).to.not.be.null;
        people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(1);
    });

    it("Should not add a person a second time.", async () => {
        let people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(1);

        let person = await pc.getPerson(ORGNAME, NAME1);
        expect(person).to.not.be.null;
        people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(1);
    });

    it("Should be able to add a more users.", async () => {
        let people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(1);

        let person = await pc.getPerson(ORGNAME, NAME2);
        expect(person).to.not.be.null;
        people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(2);

        person = await pc.getPerson(ORGNAME, NAME3);
        expect(person).to.not.be.null;
        people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(3);
    });

});
