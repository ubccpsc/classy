import {expect} from "chai";
import "mocha";
import * as fs from "fs-extra";
import {ResultsController} from "../../src/controllers/ResultsController";

const loadFirst = require('../GlobalSpec');

describe("ResultController", () => {

    let rc: ResultsController;

    before(async () => {
    });

    beforeEach(() => {
        rc = new ResultsController();
    });

    it("Should be able to get all results, even if there are none.", async () => {
        let results = await rc.getAllResults();
        expect(results).to.have.lengthOf(0);
    });

    it("Should be able to save a result.", async () => {
        let results = await rc.getAllResults();
        expect(results).to.have.lengthOf(0);

        const fullPath = "../autotest/test/githubAutoTestData/outputRecords.json";
        let data = fs.readJSONSync(fullPath);
        let output = await rc.createResult(data[0]);
        expect(output).to.be.true;

        results = await rc.getAllResults();
        expect(results).to.have.lengthOf(1);
    });

});
