import {Test} from "./GlobalSpec";
import {expect} from "chai";
import "mocha";
import {PersonController} from "../src/controllers/PersonController";
import {TeamController} from "../src/controllers/TeamController";

const loadFirst = require('./GlobalSpec');
const pFirst = require('./PersonControllerSpec');

describe("TeamController", () => {

    let tc: TeamController;
    let pc: PersonController;

    before(async () => {
    });

    beforeEach(() => {
        tc = new TeamController();
        pc = new PersonController();
    });

    it("Should be able to get all teams, even if there are none.", async () => {
        let teams = await tc.getAllTeams(Test.ORGNAME);
        expect(teams).to.have.lengthOf(0);
    });

    it("Should be able to create a team.", async () => {
        let teams = await tc.getAllTeams(Test.ORGNAME);
        expect(teams).to.have.lengthOf(0);

        let p1 = await pc.getPerson(Test.ORGNAME, Test.USERNAME1);
        let p2 = await pc.getPerson(Test.ORGNAME, Test.USERNAME2);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        let team = await tc.createTeam(Test.ORGNAME, Test.TEAMNAME1, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams(Test.ORGNAME);
        expect(teams).to.have.lengthOf(1);
    });

    it("Should not add a team a second time.", async () => {
        let teams = await tc.getAllTeams(Test.ORGNAME);
        expect(teams).to.have.lengthOf(1);

        let p1 = await pc.getPerson(Test.ORGNAME, Test.USERNAME1);
        let p2 = await pc.getPerson(Test.ORGNAME, Test.USERNAME2);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        let team = await tc.createTeam(Test.ORGNAME, Test.TEAMNAME1, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams(Test.ORGNAME);
        expect(teams).to.have.lengthOf(1);
    });


    it("Should be able to create an individual team.", async () => {
        let teams = await tc.getAllTeams(Test.ORGNAME);
        expect(teams).to.have.lengthOf(1);

        let person = await pc.getPerson(Test.ORGNAME, Test.USERNAME3);
        expect(person).to.not.be.null;

        let team = await tc.createTeam(Test.ORGNAME, Test.TEAMNAME2, [person], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams(Test.ORGNAME);
        expect(teams).to.have.lengthOf(2);
    });

});
