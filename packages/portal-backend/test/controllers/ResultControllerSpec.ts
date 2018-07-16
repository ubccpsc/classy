import {expect} from "chai";
import "mocha";
import * as fs from "fs-extra";
import {ResultsController} from "../../src/controllers/ResultsController";
import {AutoTestResultTransport} from "../../../common/types/PortalTypes";

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

    it("Should be able to invalidate bad results.", async () => {
        let deliv = await rc.validateAutoTestResult(undefined);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        deliv = await rc.validateAutoTestResult(null);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        let data: AutoTestResultTransport = <AutoTestResultTransport>{};
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = <AutoTestResultTransport>{delivId: 'd0'};
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = <AutoTestResultTransport>{delivId: 'd0', repoId: 'r1'};
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = <AutoTestResultTransport>{delivId: 'd0', repoId: 'r1', timestamp: 1001};
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = <AutoTestResultTransport>{delivId: 'd0', repoId: 'r1', timestamp: 1001, commitURL: 'url'};
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = <AutoTestResultTransport>{delivId: 'd0', repoId: 'r1', timestamp: 1001, commitURL: 'url', commitSHA: 'sha'};
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = <AutoTestResultTransport>{delivId: 'd0', repoId: 'r1', timestamp: 1001, commitURL: 'url', commitSHA: 'sha', input: {}};
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        // more here
    });


});
