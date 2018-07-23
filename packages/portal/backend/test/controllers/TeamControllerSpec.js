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
const TeamController_1 = require("../../src/controllers/TeamController");
const loadFirst = require('../GlobalSpec');
const pFirst = require('./PersonControllerSpec');
describe("TeamController", () => {
    let tc;
    let pc;
    before(() => __awaiter(this, void 0, void 0, function* () {
    }));
    beforeEach(() => {
        tc = new TeamController_1.TeamController();
        pc = new PersonController_1.PersonController();
    });
    it("Should be able to get all teams, even if there are none.", () => __awaiter(this, void 0, void 0, function* () {
        let teams = yield tc.getAllTeams();
        chai_1.expect(teams).to.have.lengthOf(0);
    }));
    it("Should be able to create a team.", () => __awaiter(this, void 0, void 0, function* () {
        let teams = yield tc.getAllTeams();
        chai_1.expect(teams).to.have.lengthOf(0);
        let p1 = yield pc.getPerson(GlobalSpec_1.Test.USERNAME1);
        let p2 = yield pc.getPerson(GlobalSpec_1.Test.USERNAME2);
        chai_1.expect(p1).to.not.be.null;
        chai_1.expect(p2).to.not.be.null;
        let team = yield tc.createTeam(GlobalSpec_1.Test.TEAMNAME1, [p1, p2], {});
        chai_1.expect(team).to.not.be.null;
        teams = yield tc.getAllTeams();
        chai_1.expect(teams).to.have.lengthOf(1);
    }));
    it("Should not add a team a second time.", () => __awaiter(this, void 0, void 0, function* () {
        let teams = yield tc.getAllTeams();
        chai_1.expect(teams).to.have.lengthOf(1);
        let p1 = yield pc.getPerson(GlobalSpec_1.Test.USERNAME1);
        let p2 = yield pc.getPerson(GlobalSpec_1.Test.USERNAME2);
        chai_1.expect(p1).to.not.be.null;
        chai_1.expect(p2).to.not.be.null;
        let team = yield tc.createTeam(GlobalSpec_1.Test.TEAMNAME1, [p1, p2], {});
        chai_1.expect(team).to.not.be.null;
        teams = yield tc.getAllTeams();
        chai_1.expect(teams).to.have.lengthOf(1);
    }));
    it("Should be able to create an individual team.", () => __awaiter(this, void 0, void 0, function* () {
        let teams = yield tc.getAllTeams();
        chai_1.expect(teams).to.have.lengthOf(1);
        let person = yield pc.getPerson(GlobalSpec_1.Test.USERNAME3);
        chai_1.expect(person).to.not.be.null;
        let team = yield tc.createTeam(GlobalSpec_1.Test.TEAMNAME2, [person], {});
        chai_1.expect(team).to.not.be.null;
        teams = yield tc.getAllTeams();
        chai_1.expect(teams).to.have.lengthOf(2);
    }));
});
//# sourceMappingURL=TeamControllerSpec.js.map