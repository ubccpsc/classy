import {expect} from "chai";
import "mocha";
import * as fs from "fs-extra";

import Config, {ConfigKey} from "../../../common/Config";
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


        const dir = Config.getInstance().getProp(ConfigKey.persistDir);
        const fullPath = dir + "/outputRecords.json";

        let data = fs.readJSONSync(__dirname + "/outputRecords.json"); // TODO: known not to be right
        let output = await rc.createResult(data[0]);
        expect(output).to.be.true;

        results = await rc.getAllResults();
        expect(results).to.have.lengthOf(1);
    });

});
