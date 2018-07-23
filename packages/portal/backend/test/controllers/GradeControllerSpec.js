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
const GlobalSpec_1 = require("../GlobalSpec");
const GradesController_1 = require("../../src/controllers/GradesController");
const loadFirst = require('../GlobalSpec');
const rFirst = require('./RepositoryControllerSpec');
describe("GradeController", () => {
    let gc;
    before(() => __awaiter(this, void 0, void 0, function* () {
    }));
    beforeEach(() => {
        gc = new GradesController_1.GradesController();
    });
    it("Should be able to get all grades, even if there are none.", () => __awaiter(this, void 0, void 0, function* () {
        let grades = yield gc.getAllGrades();
        chai_1.expect(grades).to.have.lengthOf(0);
    }));
    it("Should be able to create a grade.", () => __awaiter(this, void 0, void 0, function* () {
        let grades = yield gc.getAllGrades();
        chai_1.expect(grades).to.have.lengthOf(0);
        let grade = {
            score: 100,
            comment: 'comment',
            urlName: 'urlName',
            URL: 'URL',
            timestamp: Date.now(),
            custom: {}
        };
        let valid = yield gc.createGrade(GlobalSpec_1.Test.REPONAME1, GlobalSpec_1.Test.DELIVID1, grade);
        chai_1.expect(valid).to.be.true;
        grades = yield gc.getAllGrades();
        chai_1.expect(grades).to.have.lengthOf(2);
        chai_1.expect(grades[0].score).to.equal(100);
    }));
    it("Should be able to update a grade.", () => __awaiter(this, void 0, void 0, function* () {
        let grades = yield gc.getAllGrades();
        chai_1.expect(grades).to.have.lengthOf(2);
        let grade = {
            score: 50,
            comment: 'commentup',
            urlName: 'urlName',
            URL: 'URLup',
            timestamp: Date.now(),
            custom: {}
        };
        let valid = yield gc.createGrade(GlobalSpec_1.Test.REPONAME1, GlobalSpec_1.Test.DELIVID1, grade);
        chai_1.expect(valid).to.be.true;
        grades = yield gc.getAllGrades();
        chai_1.expect(grades).to.have.lengthOf(2);
        chai_1.expect(grades[0].score).to.equal(50);
        chai_1.expect(grades[0].comment).to.equal('commentup');
        chai_1.expect(grades[0].URL).to.equal('URLup');
    }));
    it("Should be able to get a grade for a user.", () => __awaiter(this, void 0, void 0, function* () {
        let grades = yield gc.getAllGrades();
        chai_1.expect(grades).to.have.lengthOf(2);
        let grade = yield gc.getGrade(GlobalSpec_1.Test.USERNAME1, GlobalSpec_1.Test.DELIVID1);
        chai_1.expect(grade).to.not.be.null;
        chai_1.expect(grade.score).to.equal(50);
    }));
    it("Should be able to invalidate bad grades.", () => __awaiter(this, void 0, void 0, function* () {
        let deliv = yield gc.validateAutoTestGrade(undefined);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        deliv = yield gc.validateAutoTestGrade(null);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        let data = {};
        deliv = yield gc.validateAutoTestGrade(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0' };
        deliv = yield gc.validateAutoTestGrade(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', score: 100 };
        deliv = yield gc.validateAutoTestGrade(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', score: 100, comment: 'comment' };
        deliv = yield gc.validateAutoTestGrade(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', score: 100, comment: 'comment', urlName: 'urlName' };
        deliv = yield gc.validateAutoTestGrade(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = { delivId: 'd0', score: 100, comment: 'comment', urlName: 'urlName', URL: 'http://url' };
        deliv = yield gc.validateAutoTestGrade(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = {
            delivId: 'd0',
            score: 100,
            comment: 'comment',
            urlName: 'urlName',
            URL: 'http://url',
            timestamp: Date.now()
        };
        deliv = yield gc.validateAutoTestGrade(data);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        data = {
            delivId: 'd0',
            score: 100,
            comment: 'comment',
            urlName: 'urlName',
            URL: 'http://url',
            timestamp: Date.now(),
            custom: {}
        };
        deliv = yield gc.validateAutoTestGrade(data);
        chai_1.expect(deliv).to.be.null;
    }));
});
//# sourceMappingURL=GradeControllerSpec.js.map