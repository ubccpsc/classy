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
const AuthController_1 = require("../../src/controllers/AuthController");
const PersonController_1 = require("../../src/controllers/PersonController");
const DatabaseController_1 = require("../../src/controllers/DatabaseController");
const loadFirst = require('../GlobalSpec');
const teamsFirst = require('./PersonControllerSpec');
describe("AuthController", () => {
    const TIMEOUT = 5000;
    let ac;
    before(() => __awaiter(this, void 0, void 0, function* () {
    }));
    beforeEach(() => {
        ac = new AuthController_1.AuthController();
    });
    it("Should not validate a user who does not exist.", () => __awaiter(this, void 0, void 0, function* () {
        let isValid = yield ac.isValid('aUserwhoDoesNotExist_sadmewnmdsv', '');
        chai_1.expect(isValid).to.be.false;
    }));
    it("Should not let a person who does not exist be privileged.", () => __awaiter(this, void 0, void 0, function* () {
        let isPriv = yield ac.isPrivileged('aUserwhoDoesNotExist_sadmewnmdsvKKDSS', '');
        chai_1.expect(isPriv.isAdmin).to.be.false;
        chai_1.expect(isPriv.isStaff).to.be.false;
    }));
    it("Should identify a staff correctly.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            const pc = new PersonController_1.PersonController();
            const p = {
                id: 'rtholmes',
                csId: 'r2d2',
                githubId: 'rtholmes',
                studentNumber: null,
                fName: '',
                lName: '',
                kind: '',
                URL: null,
                labId: null,
                custom: {}
            };
            const newPerson = yield pc.createPerson(p);
            chai_1.expect(newPerson).to.not.be.null;
            let isValid = yield ac.isValid('rtholmes', 'faketoken');
            chai_1.expect(isValid).to.be.false;
            const auth = {
                personId: 'rtholmes',
                token: 'realtoken'
            };
            yield DatabaseController_1.DatabaseController.getInstance().writeAuth(auth);
            isValid = yield ac.isValid('rtholmes', 'realtoken');
            chai_1.expect(isValid).to.be.true;
            let isPriv = yield ac.isPrivileged('rtholmes', 'realtoken');
            chai_1.expect(isPriv.isAdmin).to.be.true;
            chai_1.expect(isPriv.isStaff).to.be.true;
        });
    }).timeout(TIMEOUT);
    it("Should identify a non-admin correctly.", function () {
        return __awaiter(this, void 0, void 0, function* () {
            const pc = new PersonController_1.PersonController();
            const p = {
                id: 'user',
                csId: 'r2d2',
                githubId: 'user',
                studentNumber: null,
                fName: '',
                lName: '',
                kind: '',
                URL: null,
                labId: null,
                custom: {}
            };
            const newPerson = yield pc.createPerson(p);
            chai_1.expect(newPerson).to.not.be.null;
            let isValid = yield ac.isValid('user', 'faketoken');
            chai_1.expect(isValid).to.be.false;
            const auth = {
                personId: 'user',
                token: 'realtoken'
            };
            yield DatabaseController_1.DatabaseController.getInstance().writeAuth(auth);
            isValid = yield ac.isValid('user', 'realtoken');
            chai_1.expect(isValid).to.be.true;
            let isPriv = yield ac.isPrivileged('user', 'realtoken');
            chai_1.expect(isPriv.isAdmin).to.be.false;
            chai_1.expect(isPriv.isStaff).to.be.false;
        });
    }).timeout(TIMEOUT);
    it("Should be able to logout a real user.", () => __awaiter(this, void 0, void 0, function* () {
        const personId = 'rtholmes';
        const dc = DatabaseController_1.DatabaseController.getInstance();
        const pc = new PersonController_1.PersonController();
        let auth = yield dc.getAuth(personId);
        let person = yield pc.getPerson(personId);
        chai_1.expect(person.kind).to.not.be.null;
        let workedEnough = yield ac.removeAuthentication(personId);
        chai_1.expect(workedEnough).to.be.true;
        auth = yield dc.getAuth('rtholmes');
        chai_1.expect(auth).to.be.null;
        person = yield pc.getPerson(personId);
        chai_1.expect(person.kind).to.be.null;
    }));
    it("Should be able to handle trying to logout users who do not exist.", () => __awaiter(this, void 0, void 0, function* () {
        let workedEnough = yield ac.removeAuthentication(undefined);
        chai_1.expect(workedEnough).to.be.false;
        workedEnough = yield ac.removeAuthentication(null);
        chai_1.expect(workedEnough).to.be.false;
        workedEnough = yield ac.removeAuthentication('totallyMADEUPname12388291900d');
        chai_1.expect(workedEnough).to.be.false;
    }));
});
//# sourceMappingURL=AuthControllerSpec.js.map