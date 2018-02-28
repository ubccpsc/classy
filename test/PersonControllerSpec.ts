const loadFirst = require('./GlobalSpec');

import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {PersonController} from "../src/controllers/PersonController";

describe("PersonController", () => {

    let ORGNAME: string;
    let pc: PersonController;

    const NAME1 = 'user1';
    const NAME2 = 'user2';

    before(async () => {
        ORGNAME = Config.getInstance().getProp('org');
    });

    beforeEach(() => {
        pc = new PersonController();

    });

    it("Should be able to be validate a new user.", async () => {
        let people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(0);

        let valid = await pc.configureUsername(ORGNAME, NAME1);
        expect(valid).to.be.true;
        people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(1);
    });

    it("Should not add a person a second time.", async () => {
        let people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(1);

        let valid = await pc.configureUsername(ORGNAME, NAME1);
        expect(valid).to.be.true;
        people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(1);
    });

    it("Should be able to add a second user.", async () => {
        let people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(1);

        let valid = await pc.configureUsername(ORGNAME, NAME2);
        expect(valid).to.be.true;
        people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(2);
    });

});
