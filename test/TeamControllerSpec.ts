const loadFirst = require('./GlobalSpec');
const pFirst = require('./PersonControllerSpec');

import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {PersonController} from "../src/controllers/PersonController";
import {TeamController} from "../src/controllers/TeamController";

describe("TeamController", () => {

    let ORGNAME: string;
    let tc: TeamController;
    let pc: PersonController;

    const TEAMNAME1 = 'team1';
    const TEAMNAME2 = 'team2';

    const USERNAME1 = 'user1';
    const USERNAME2 = 'user2';
    const USERNAME3 = 'user3';

    before(async () => {
        ORGNAME = Config.getInstance().getProp('org');
    });

    beforeEach(() => {
        tc = new TeamController();
        pc = new PersonController();
    });

    it("Should be able to get all teams, even if there are none.", async () => {
        let teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(0);
    });

    it("Should be able to create a team.", async () => {
        let teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(0);

        let p1 = await pc.getPerson(ORGNAME, USERNAME1);
        let p2 = await pc.getPerson(ORGNAME, USERNAME2);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        let team = await tc.createTeam(ORGNAME, TEAMNAME1, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);
    });

    it("Should not add a team a second time.", async () => {
        let teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);

        let p1 = await pc.getPerson(ORGNAME, USERNAME1);
        let p2 = await pc.getPerson(ORGNAME, USERNAME2);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        let team = await tc.createTeam(ORGNAME, TEAMNAME1, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);
    });


    it("Should be able to create an individual team.", async () => {
        let teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);

        let person = await pc.getPerson(ORGNAME, USERNAME3);
        expect(person).to.not.be.null;

        let team = await tc.createTeam(ORGNAME, TEAMNAME2, [person], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(2);
    });

});
