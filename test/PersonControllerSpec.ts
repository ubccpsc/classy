import {expect} from "chai";
import "mocha";

import {PersonController} from "../src/controllers/PersonController";
import {Config} from "../src/Config";


describe("PersonController", () => {
    const ORGNAME = 'secapstonetest';

    const PERSON1USER = '';
    const PERSON2USER = '';
    const PERSON3USER = '';

    let pc: PersonController;

    before(() => {
        Config.getInstance('test');
    });

    beforeEach(() => {
        pc = new PersonController();
    });

    it("Should be able to be validate a new user.", async () => {
        const org = 'test';
        const name = 'name';
        let people = await pc.getAllPeople(org);
        expect(people).to.have.lengthOf(0);

        let valid = await pc.configureUsername(ORGNAME, name);
        expect(valid).to.be.true;
        people = await pc.getAllPeople(org);
        expect(people).to.have.lengthOf(1);

    });

});
