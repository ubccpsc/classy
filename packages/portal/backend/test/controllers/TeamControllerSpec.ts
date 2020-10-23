import {expect} from "chai";
import "mocha";

import Log from "../../../../common/Log";
import {Test} from "../../../../common/TestHarness";

import {DatabaseController} from "../../src/controllers/DatabaseController";
import {PersonController} from "../../src/controllers/PersonController";
import {TeamController} from "../../src/controllers/TeamController";
import {PersonKind} from "../../src/Types";

import '../GlobalSpec';
import './PersonControllerSpec';

describe("TeamController", () => {

    let tc: TeamController;
    let pc: PersonController;
    let dc: DatabaseController;

    before(async () => {
        await Test.suiteBefore('TeamController');

        // clear stale data (removed; happens in suitebefore)
        // await dbc.clearData();

        // get data ready
        await Test.prepareDeliverables();
        await Test.preparePeople();
        await Test.prepareAuth();

        dc = DatabaseController.getInstance();
        tc = new TeamController();
        pc = new PersonController();
    });

    after(async () => {
        Test.suiteAfter('TeamController');
    });

    it("Should be able to get all teams, even if there are none.", async () => {
        const teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);
    });

    it("Should be able to get the teams for a person even if there are none.", async () => {
        const person = await pc.getPerson(Test.USER1.id);
        const teams = await tc.getTeamsForPerson(person);
        expect(teams).to.have.lengthOf(0);
    });

    it("Should not be able to get the number for a null team.", async () => {
        const teamNumber = await tc.getTeamNumber(null);
        expect(teamNumber).to.be.null;
    });

    it("Should not be able to get the number for a team that does not exist.", async () => {
        const teamNumber = await tc.getTeamNumber("INVALIDTEAMNAME" + Date.now());
        expect(teamNumber).to.be.null;
    });

    it("Should not able to create a team if a deliverable was not specified.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);

        const p1 = await pc.getPerson(Test.USER1.id);
        const p2 = await pc.getPerson(Test.USER2.id);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        let ex = null;
        let team = null;
        try {
            team = await tc.createTeam(Test.TEAMNAME1, null, [p1, p2], {});
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);
    });

    it("Should be able to create a team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);

        const p1 = await pc.getPerson(Test.USER1.id);
        const p2 = await pc.getPerson(Test.USER2.id);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        let deliv = await dc.getDeliverable(Test.DELIVID0);
        let team = await tc.createTeam(Test.TEAMNAME1, deliv, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(1);

        deliv = await dc.getDeliverable(Test.DELIVID1);
        team = await tc.createTeam(Test.TEAMNAME3, deliv, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(2);
    });

    it("Should not add a team a second time.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(2);

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
        expect(teams).to.have.lengthOf(2);
    });

    it("Should be able to create an individual team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(2);

        const person = await pc.getPerson(Test.USER3.id);
        expect(person).to.not.be.null;

        const deliv = await dc.getDeliverable(Test.DELIVID0);
        const team = await tc.createTeam(Test.TEAMNAME2, deliv, [person], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(3);
    });

    it("Should be able to get the teams for a person.", async () => {
        const person = await pc.getPerson(Test.USER1.id);
        const teams = await tc.getTeamsForPerson(person);
        expect(teams).to.have.lengthOf(2);
    });

    it("Should fail to form a team if deliverable constraints are violated.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(3);

        const p1 = await pc.getGitHubPerson(Test.GITHUB1.github);
        const p2 = await pc.getGitHubPerson(Test.GITHUB2.github);
        const p3 = await pc.getGitHubPerson(Test.GITHUB3.github);

        // invalid deliverable
        let team = null;
        let ex = null;
        try {
            team = await tc.formTeam('testTeamName_' + Date.now(), null, [p1], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        const d0 = await dc.getDeliverable(Test.DELIVID0);
        // too few students
        team = null;
        ex = null;
        try {
            team = await tc.formTeam('testTeamName_' + Date.now(), d0, [], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        // too many students
        team = null;
        ex = null;
        try {
            team = await tc.formTeam('testTeamName_' + Date.now(), d0, [p1, p2], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        // student's can't form for this deliverable
        team = null;
        ex = null;
        try {
            const d3 = await dc.getDeliverable(Test.DELIVID0);
            team = await tc.formTeam('testTeamName_' + Date.now(), d3, [p1, p2], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        // github id not in course
        const proj = await dc.getDeliverable(Test.DELIVIDPROJ);
        team = null;
        ex = null;
        try {
            team = await tc.formTeam('testTeamName_' + Date.now(), proj, [p1, null], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        // students not in same lab section
        team = null;
        ex = null;
        try {
            team = await tc.formTeam('testTeamName_' + Date.now(), proj, [p1, p3], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        // students already on teams
        const d1 = await dc.getDeliverable(Test.DELIVID0);
        team = null;
        ex = null;
        try {
            team = await tc.formTeam('testTeamName_' + Date.now(), d1, [p2, p2], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        // student already withrdawn
        team = null;
        ex = null;
        try {
            // withdraw a student
            const dbc = DatabaseController.getInstance();
            const p6 = await pc.getGitHubPerson(Test.USER6.github);
            p6.kind = PersonKind.WITHDRAWN;
            await dbc.writePerson(p6);

            team = await tc.formTeam('testTeamName_' + Date.now(), proj, [p2, p6], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.not.be.null;
        expect(team).to.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(3);
    }).timeout(Test.TIMEOUT);

    it("Should form a team if deliverable constraints are not violated.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(3);

        // should work
        let team = null;
        let ex = null;
        try {
            const proj = await dc.getDeliverable(Test.DELIVIDPROJ);
            const p1 = await pc.getGitHubPerson(Test.USER1.github);
            const p2 = await pc.getGitHubPerson(Test.USER2.github);
            team = await tc.formTeam(Test.REUSABLETEAMNAME, proj, [p1, p2], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.be.null;
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(4);
    }).timeout(Test.TIMEOUT);

    it("Should silently do nothing team is to be formed that already exists", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(4);

        // Should still work
        let team = null;
        let ex = null;
        try {
            const proj = await dc.getDeliverable(Test.DELIVIDPROJ);
            const p1 = await pc.getGitHubPerson(Test.USER1.github);
            const p2 = await pc.getGitHubPerson(Test.USER2.github);
            team = await tc.formTeam(Test.REUSABLETEAMNAME, proj, [p1, p2], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.be.null;
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(4);
    }).timeout(Test.TIMEOUT);

    it("Translation to transport type should work.", async () => {
        const team = await tc.getTeam(Test.TEAMNAME1);
        expect(team).to.not.be.null;

        const trans = tc.teamToTransport(team);
        expect(team.id).to.equal(trans.id);
        expect(team.URL).to.equal(trans.URL);
        expect(team.delivId).to.equal(trans.delivId);

        for (const p of team.personIds) {
            expect(trans.people).to.contain(p);
        }
    }).timeout(Test.TIMEOUT);
});
