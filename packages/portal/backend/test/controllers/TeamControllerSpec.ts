import {expect} from "chai";
import "mocha";

import Log from "@common/Log";
import {TestHarness} from "@common/TestHarness";

import {DatabaseController} from "@backend/controllers/DatabaseController";
import {PersonController} from "@backend/controllers/PersonController";
import {TeamController} from "@backend/controllers/TeamController";
import {Deliverable, Person, PersonKind, Team} from "@backend/Types";

import "@common/GlobalSpec"; // load first
import "./PersonControllerSpec";

describe("TeamController", () => {

    let tc: TeamController;
    let pc: PersonController;
    let dc: DatabaseController;

    before(async () => {
        await TestHarness.suiteBefore("TeamController");

        // clear stale data (removed; happens in suite before)
        // await dbc.clearData();

        // get data ready
        await TestHarness.prepareDeliverables();
        await TestHarness.preparePeople();
        await TestHarness.prepareAuth();

        dc = DatabaseController.getInstance();
        tc = new TeamController();
        pc = new PersonController();
    });

    after(async () => {
        TestHarness.suiteAfter("TeamController");
    });

    it("Should be able to get all teams, even if there are none.", async () => {
        const teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);
    });

    it("Should be able to get the teams for a person even if there are none.", async () => {
        const person = await pc.getPerson(TestHarness.USER1.id);
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

    it("Should not able to create a team if a constraint is violated.", async () => {
        let team: Team = null;
        let teams: Team[] = null;
        let ex: Error = null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);

        const p1 = await pc.getPerson(TestHarness.USER1.id);
        const p2 = await pc.getPerson(TestHarness.USER2.id);

        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        const createTeam = async function (name: string, deliv: Deliverable, people: Person[]): Promise<void> {
            try {
                team = null;
                ex = null;
                teams = null;

                team = await tc.createTeam(name, deliv, people, {});
            } catch (err) {
                ex = err;
            }
            teams = await tc.getAllTeams();
            return;
        };

        // empty name
        const d0 = await dc.getDeliverable(TestHarness.DELIVID0);
        await createTeam("", d0, [p1, p2]);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("no team name");
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(0);

        // invalid deliverable
        await createTeam(TestHarness.TEAMNAME1, null, [p1, p2]);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("no deliverable");
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(0);

        // TODO: duplicate team
    });

    it("Should be able to create a team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(0);

        const p1 = await pc.getPerson(TestHarness.USER1.id);
        const p2 = await pc.getPerson(TestHarness.USER2.id);
        expect(p1).to.not.be.null;
        expect(p2).to.not.be.null;

        let deliv = await dc.getDeliverable(TestHarness.DELIVID0);
        let team = await tc.createTeam(TestHarness.TEAMNAME1, deliv, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(1);

        deliv = await dc.getDeliverable(TestHarness.DELIVID1);
        team = await tc.createTeam(TestHarness.TEAMNAME3, deliv, [p1, p2], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(2);
    });

    it("Should be able to save a team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(2);

        await tc.saveTeam(teams[0]);
        teams = await tc.getAllTeams(); // only really checking for not crashing
        expect(teams).to.have.lengthOf(2); // still one team
    });

    // it("Should not add a team a second time.", async () => {
    //     let teams = await tc.getAllTeams();
    //     expect(teams).to.have.lengthOf(2);
    //
    //     const p1 = await pc.getPerson(TestHarness.USER1.id);
    //     const p2 = await pc.getPerson(TestHarness.USER2.id);
    //     expect(p1).to.not.be.null;
    //     expect(p2).to.not.be.null;
    //
    //     const deliv = await dc.getDeliverable(TestHarness.DELIVID0);
    //     let team = null;
    //     let exc = null;
    //     try {
    //         team = await tc.createTeam(TestHarness.TEAMNAME1, deliv, [p1, p2], {});
    //     } catch (err) {
    //         exc = err;
    //     }
    //     expect(team).to.be.null;
    //     expect(exc).to.not.be.null;
    //
    //     teams = await tc.getAllTeams();
    //     expect(teams).to.have.lengthOf(2);
    // });

    it("Should be able to create an individual team.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(2);

        const person = await pc.getPerson(TestHarness.USER3.id);
        expect(person).to.not.be.null;

        const deliv = await dc.getDeliverable(TestHarness.DELIVID0);
        const team = await tc.createTeam(TestHarness.TEAMNAME2, deliv, [person], {});
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(3);
    });

    it("Should be able to get the teams for a person.", async () => {
        const person = await pc.getPerson(TestHarness.USER1.id);
        const teams = await tc.getTeamsForPerson(person);
        expect(teams).to.have.lengthOf(2);
    });

    it("Should fail to form a team if constraints are violated.", async () => {
        let team: Team = null;
        let teams: Team[] = null;
        let ex: Error = null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(3);

        const p1 = await pc.getGitHubPerson(TestHarness.USER1.github);
        const p2 = await pc.getGitHubPerson(TestHarness.USER2.github);
        const p3 = await pc.getGitHubPerson(TestHarness.USER3.github);

        // let p1 = await pc.getGitHubPerson(TestHarness.GITHUB1.github);
        // let p2 = await pc.getGitHubPerson(TestHarness.GITHUB2.github);
        // let p3 = await pc.getGitHubPerson(TestHarness.GITHUB3.github);

        const formTeam = async function (name: string, deliv: Deliverable, people: Person[], override: boolean): Promise<void> {
            team = null;
            teams = null;
            ex = null;
            try {
                team = await tc.formTeam(name, deliv, people, override);
            } catch (err) {
                Log.test(err);
                ex = err;
            }
            teams = await tc.getAllTeams();
            return;
        };

        // invalid deliverable
        const tName = "testTeamName_" + Date.now();
        await formTeam(tName, null, [p1], false);
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(3);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("deliverable does not");

        // too few students
        const d0 = await dc.getDeliverable(TestHarness.DELIVID0);
        await formTeam(tName, d0, [], false);
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(3);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("too few team members");

        // too many students
        await formTeam(tName, d0, [p1, p2], false);
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(3);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("too many team members");

        // student not in course
        await formTeam(tName, d0, [p1, null], false);
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(3);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("not members of the course");

        // not in same lab
        const proj = await dc.getDeliverable(TestHarness.DELIVIDPROJ);
        p3.labId = "L1other";
        await formTeam(tName, proj, [p1, p3], false);
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(3);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("not in the same lab");

        // students already on teams for deliverable
        await formTeam(tName, d0, [p1], false);
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(3);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("on existing team");

        // student withdrawn
        const p6 = {kind: PersonKind.WITHDRAWN} as Person;
        await formTeam(tName, proj, [p2, p6], false);
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(3);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("not an active member");

        // students cannot form for this deliverable
        const d3 = await dc.getDeliverable(TestHarness.DELIVID3);
        d3.teamStudentsForm = false;
        d3.teamMaxSize = 2;
        await formTeam(tName, d3, [p1, p2], false);
        expect(team).to.be.null;
        expect(teams).to.have.lengthOf(3);
        expect(ex).to.not.be.null;
        expect(ex.message).to.contain("students cannot form");

    }).timeout(TestHarness.TIMEOUT);

    it("Should form a team if deliverable constraints are not violated.", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(3);

        // should work
        let team = null;
        let ex = null;
        try {
            const proj = await dc.getDeliverable(TestHarness.DELIVIDPROJ);
            const p1 = await pc.getGitHubPerson(TestHarness.USER1.github);
            const p2 = await pc.getGitHubPerson(TestHarness.USER2.github);
            team = await tc.formTeam(TestHarness.REUSABLETEAMNAME, proj, [p1, p2], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.be.null;
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(4);
    }).timeout(TestHarness.TIMEOUT);

    it("Should silently do nothing team is to be formed that already exists", async () => {
        let teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(4);

        // Should still work
        let team = null;
        let ex = null;
        try {
            const proj = await dc.getDeliverable(TestHarness.DELIVIDPROJ);
            const p1 = await pc.getGitHubPerson(TestHarness.USER1.github);
            const p2 = await pc.getGitHubPerson(TestHarness.USER2.github);
            team = await tc.formTeam(TestHarness.REUSABLETEAMNAME, proj, [p1, p2], false);
        } catch (err) {
            Log.test(err);
            ex = err;
        }
        expect(ex).to.be.null;
        expect(team).to.not.be.null;

        teams = await tc.getAllTeams();
        expect(teams).to.have.lengthOf(4);
    }).timeout(TestHarness.TIMEOUT);

    it("Translation to transport type should work.", async () => {
        const team = await tc.getTeam(TestHarness.TEAMNAME1);
        expect(team).to.not.be.null;

        const trans = tc.teamToTransport(team);
        expect(team.id).to.equal(trans.id);
        expect(team.URL).to.equal(trans.URL);
        expect(team.delivId).to.equal(trans.delivId);

        for (const p of team.personIds) {
            expect(trans.people).to.contain(p);
        }
    }).timeout(TestHarness.TIMEOUT);
});
