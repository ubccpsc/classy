import Log from "../src/util/Log";

import {expect} from "chai";
import "mocha";

import {PersonController} from "../src/controllers/PersonController";

describe("PersonController", () => {

    it("Should be able to be validate a new user.", async () => {
        const org = 'test';
        const name = 'name';
        let valid = await PersonController.configureUsername(org, name);
        expect(valid).not.to.be.true;
    });

});
