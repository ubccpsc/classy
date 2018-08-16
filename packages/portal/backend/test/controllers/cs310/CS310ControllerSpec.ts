const loadFirst = require('../../GlobalSpec');
const rBefore = require('../GradeControllerSpec');

import {expect} from "chai";
import "mocha";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {Test} from "../../GlobalSpec";

describe("CS310: CS310Controller", () => {

    before(async () => {
        await Test.suiteBefore('CS310Controller');

        // clear stale data
        const dc = DatabaseController.getInstance();
        await dc.clearData();

        // get data ready
        await Test.prepareAll();
    });

    after(async () => {
        Test.suiteAfter('CS310Controller');
    });

    it("Should not fail.", async () => {
        // empty tests
        expect(true).to.be.true;
    });

});
