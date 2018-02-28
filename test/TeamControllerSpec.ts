const loadFirst = require('./GlobalSpec');
const peopleFirst = require('./PersonControllerSpec');

import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {PersonController} from "../src/controllers/PersonController";
import {TeamController} from "../src/controllers/TeamController";

describe("TeamController", () => {

    let ORGNAME: string;
    let tc: TeamController;
    let pc: PersonController;

    const TEAMNAME1 = 'user1';

    const USERNAME1 = 'user1';
    const USERNAME2 = 'user2';

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

        let people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(2);

        let valid = await tc.createTeam(ORGNAME, TEAMNAME1, people);
        expect(valid).to.be.true;
        teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);
    });

    it("Should not add a team a second time.", async () => {
        let teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);

        let people = await pc.getAllPeople(ORGNAME);
        expect(people).to.have.lengthOf(2);

        let valid = await tc.createTeam(ORGNAME, TEAMNAME1, people);
        expect(valid).to.be.false;
        teams = await tc.getAllTeams(ORGNAME);
        expect(teams).to.have.lengthOf(1);
    });


});
