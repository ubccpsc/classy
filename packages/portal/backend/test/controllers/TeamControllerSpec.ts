import {expect} from "chai";
import "mocha";

import {DatabaseController} from "../../src/controllers/DatabaseController";
import {PersonController} from "../../src/controllers/PersonController";
import {TeamController} from "../../src/controllers/TeamController";
import {Test} from "../GlobalSpec";
// import '../GlobalSpec';
import './PersonControllerSpec';

const loadFirst = require("../GlobalSpec");

describe("TeamController", () => {

    let tc: TeamController;
    let pc: PersonController;
    let dc: DatabaseController;

    before(async () => {
        Test.suiteBefore('TeamController');

        // clear stale data
        dc = DatabaseController.getInstance();
        await dc.clearData();

        // get data ready
        await Test.prepareDeliverables();
        await Test.preparePeople();
        await Test.prepareAuth();

        tc = new TeamController();
        pc = new PersonController();

        // const deliv = Test.getDeliverable(Test.DELIVID0);
        // await dc.writeDeliverable(deliv);
    });

    after(async () => {
        Test.suiteAfter('TeamController');
    });

    it("Should be able to get all teams, even if there are none.", async () => {
        const teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);
    });

    it("Should be able to create a team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);

        const p1 = await pc.getPerson(Test.USER1.id);
        const p2 = await pc.getPerson(Test.USER2.id);
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

        const p1 = await pc.getPerson(Test.USER1.id);
        const p2 = await pc.getPerson(Test.USER2.id);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        const deliv = await dc.getDeliverable(Test.DELIVID0);
        let team = null;
        let exc = null;
        try {
            team = await tc.createTeam(Test.TEAMNAME1, deliv, [p1, p2], {});
        } catch (err) {
            exc = err;
        }
        expect(team).to.be.null;
        expect(exc).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(1);
    });

    it("Should be able to create an individual team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(1);

        const person = await pc.getPerson(Test.USER3.id);
        expect(person).to.not.be.null;

        const deliv = await dc.getDeliverable(Test.DELIVID0);
        const team = await tc.createTeam(Test.TEAMNAME2, deliv, [person], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(2);
    });

});
