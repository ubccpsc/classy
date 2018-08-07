import {expect} from "chai";
import "mocha";

import {DatabaseController} from "../../src/controllers/DatabaseController";
import {PersonController} from "../../src/controllers/PersonController";
import {TeamController} from "../../src/controllers/TeamController";

import {Test} from "../GlobalSpec";
import '../GlobalSpec';
import './PersonControllerSpec';

describe("TeamController", () => {

    let tc: TeamController;
    let pc: PersonController;
    let dc: DatabaseController;

    before(async () => {
        tc = new TeamController();
        pc = new PersonController();
        dc = DatabaseController.getInstance();

        const deliv = Test.getDeliverable(Test.DELIVID0);
        await dc.writeDeliverable(deliv);
    });

    it("Should be able to get all teams, even if there are none.", async () => {
        const teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);
    });

    it("Should be able to create a team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);

        const p1 = await pc.getPerson(Test.USERNAME1);
        const p2 = await pc.getPerson(Test.USERNAME2);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        const deliv = await dc.getDeliverable(Test.DELIVID0);
        const team = await tc.createTeam(Test.TEAMNAME1, deliv, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(1);
    });

    it("Should not add a team a second time.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(1);

        const p1 = await pc.getPerson(Test.USERNAME1);
        const p2 = await pc.getPerson(Test.USERNAME2);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        const deliv = await dc.getDeliverable(Test.DELIVID0);
        const team = await tc.createTeam(Test.TEAMNAME1, deliv, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(1);
    });

    it("Should be able to create an individual team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(1);

        const person = await pc.getPerson(Test.USERNAME3);
        expect(person).to.not.be.null;

        const deliv = await dc.getDeliverable(Test.DELIVID0);
        const team = await tc.createTeam(Test.TEAMNAME2, deliv, [person], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(2);
    });

});
