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
const PersonController_1 = require("../../src/controllers/PersonController");
const loadFirst = require('../GlobalSpec');
const dFirst = require('./DeliverablesControllerSpec');
describe("PersonController", () => {
    let pc;
    let PERSON1 = null;
    let PERSON2 = null;
    let PERSON3 = null;
    before(() => __awaiter(this, void 0, void 0, function* () {
        PERSON1 = {
            id: GlobalSpec_1.Test.USERNAME1,
            csId: GlobalSpec_1.Test.USERNAME1,
            githubId: GlobalSpec_1.Test.USERNAME1,
            studentNumber: null,
            fName: '',
            lName: '',
            kind: 'student',
            URL: 'https://github.com/' + GlobalSpec_1.Test.USERNAME1,
            labId: 'UNKNOWN',
            custom: {}
        };
        PERSON2 = {
            id: GlobalSpec_1.Test.USERNAME2,
            csId: GlobalSpec_1.Test.USERNAME2,
            githubId: GlobalSpec_1.Test.USERNAME2,
            studentNumber: null,
            fName: '',
            lName: '',
            kind: 'student',
            URL: 'https://github.com/' + GlobalSpec_1.Test.USERNAME2,
            labId: 'UNKNOWN',
            custom: {}
        };
        PERSON3 = {
            id: GlobalSpec_1.Test.USERNAME3,
            csId: GlobalSpec_1.Test.USERNAME3,
            githubId: GlobalSpec_1.Test.USERNAME3,
            studentNumber: null,
            fName: '',
            lName: '',
            kind: 'student',
            URL: 'https://github.com/' + GlobalSpec_1.Test.USERNAME1,
            labId: 'UNKNOWN',
            custom: {}
        };
    }));
    beforeEach(() => {
        pc = new PersonController_1.PersonController();
    });
    it("Should be able to be validate a new user.", () => __awaiter(this, void 0, void 0, function* () {
        let people = yield pc.getAllPeople();
        chai_1.expect(people).to.have.lengthOf(0);
        let person = yield pc.getPerson(PERSON1.id);
        chai_1.expect(person).to.be.null;
        person = yield pc.createPerson(PERSON1);
        chai_1.expect(person).to.not.be.null;
        person = yield pc.getPerson(PERSON1.id);
        chai_1.expect(person).to.not.be.null;
    }));
    it("Should not add a person a second time.", () => __awaiter(this, void 0, void 0, function* () {
        let people = yield pc.getAllPeople();
        chai_1.expect(people).to.have.lengthOf(1);
        let person = yield pc.getPerson(PERSON1.id);
        chai_1.expect(person).to.not.be.null;
        people = yield pc.getAllPeople();
        chai_1.expect(people).to.have.lengthOf(1);
        person = yield pc.createPerson(PERSON1);
        chai_1.expect(person).to.not.be.null;
        people = yield pc.getAllPeople();
        chai_1.expect(people).to.have.lengthOf(1);
    }));
    it("Should be able to add a more users.", () => __awaiter(this, void 0, void 0, function* () {
        let people = yield pc.getAllPeople();
        chai_1.expect(people).to.have.lengthOf(1);
        let person = yield pc.createPerson(PERSON2);
        chai_1.expect(person).to.not.be.null;
        person = yield pc.createPerson(PERSON3);
        chai_1.expect(person).to.not.be.null;
        people = yield pc.getAllPeople();
        chai_1.expect(people).to.have.lengthOf(3);
    }));
    it("Should be able to get a person.", () => __awaiter(this, void 0, void 0, function* () {
        let person = yield pc.getPerson(PERSON1.id);
        chai_1.expect(person).to.not.be.null;
        chai_1.expect(person.id).to.equal(PERSON1.id);
        person = yield pc.getPerson('randomIDthatDoesNotexist23232333');
        chai_1.expect(person).to.be.null;
        person = yield pc.getGitHubPerson(PERSON1.githubId);
        chai_1.expect(person).to.not.be.null;
        chai_1.expect(person.id).to.equal(PERSON1.githubId);
        person = yield pc.getGitHubPerson('randomIDthatDoesNotexist23232333');
        chai_1.expect(person).to.be.null;
    }));
});
//# sourceMappingURL=PersonControllerSpec.js.map