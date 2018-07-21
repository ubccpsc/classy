"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
require("mocha");
const fs = require("fs-extra");
const ResultsController_1 = require("../../src/controllers/ResultsController");
const loadFirst = require('../GlobalSpec');
describe("ResultController", () => {
    let rc;
    before(() => __awaiter(this, void 0, void 0, function* () {
    }));
    beforeEach(() => {
        rc = new ResultsController_1.ResultsController();
    });
    it("Should be able to get all results, even if there are none.", () => __awaiter(this, void 0, void 0, function* () {
        let results = yield rc.getAllResults();
        chai_1.expect(results).to.have.lengthOf(0);
    }));
    it("Should be able to save a result.", () => __awaiter(this, void 0, void 0, function* () {
        let results = yield rc.getAllResults();
        chai_1.expect(results).to.have.lengthOf(0);
        const fullPath = "../../autotest/test/githubAutoTestData/outputRecords.json";
        let data = fs.readJSONSync(fullPath);
        let output = yield rc.createResult(data[0]);
        chai_1.expect(output).to.be.true;
        results = yield rc.getAllResults();
        chai_1.expect(results).to.have.lengthOf(1);
    }));
    it("Should be able to invalidate bad results.", () => __awaiter(this, void 0, void 0, function* () {
        let deliv = yield rc.validateAutoTestResult(undefined);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        deliv = yield rc.validateAutoTestResult(null);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        let data = {};
        deliv = yield rc.validateAutoTestResult(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0' };
        deliv = yield rc.validateAutoTestResult(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', repoId: 'r1' };
        deliv = yield rc.validateAutoTestResult(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', repoId: 'r1', timestamp: 1001 };
        deliv = yield rc.validateAutoTestResult(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', repoId: 'r1', timestamp: 1001, commitURL: 'url' };
        deliv = yield rc.validateAutoTestResult(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', repoId: 'r1', timestamp: 1001, commitURL: 'url', commitSHA: 'sha' };
        deliv = yield rc.validateAutoTestResult(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', repoId: 'r1', timestamp: 1001, commitURL: 'url', commitSHA: 'sha', input: {} };
        deliv = yield rc.validateAutoTestResult(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        // more here
    }));
});
//# sourceMappingURL=ResultControllerSpec.js.map