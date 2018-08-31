import {expect} from "chai";
import "mocha";

import {CS340Controller} from "../../../src/controllers/340/CS340Controller";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {TestGitHubController} from "../../../src/controllers/GitHubController";

import "../../GlobalSpec";
import {Test} from "../../GlobalSpec";
import {PersonController} from "../../../src/controllers/PersonController";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import {AssignmentController} from "../../../src/controllers/340/AssignmentController";
import {TeamController} from "../../../src/controllers/TeamController";
import * as assert from "assert";


describe("CS340: CS340Controller", () => {
    let cc: CS340Controller = null;
    let pc: PersonController = new PersonController();
    let dc: DeliverablesController  = new DeliverablesController();
    let ac: AssignmentController    = new AssignmentController();
    let db: DatabaseController      = DatabaseController.getInstance();
    let tc: TeamController          = new TeamController();

    before(async () => {
        await Test.suiteBefore('CS340Controller');

        // clear stale data
        const dc = DatabaseController.getInstance();
        await dc.clearData();
        cc = new CS340Controller(new TestGitHubController());

        // get data ready
        await Test.prepareAll();
        await Test.prepareAssignment();
        await Test.prepareAssignment2();
        await Test.prepareAssignmentTeam();
        await Test.prepareAssignmentTeam2();
    });

    after(async () => {
        Test.suiteAfter('CS340Controller');
    });

    it("Should be able to compute a name for one person.", async () => {
        let person = await pc.getPerson(Test.USER1.id);
        let deliv = await db.getDeliverable(Test.ASSIGNID0);
        let computedNames: any;
        try {
            computedNames = await cc.computeNames(deliv, [person]);
        } catch (err) {
            assert.fail("Expected to not catch an error.");
        }

        expect(computedNames.teamName).to.not.be.null;
        expect(computedNames.repoName).to.not.be.null;
    });


    it("Should throw an exception when attempting to computer a name with no people.", async () => {
        let deliv = await db.getDeliverable(Test.ASSIGNID0);
        let computedNames: any;
        try {
            computedNames = await cc.computeNames(deliv, []);
            assert.fail("Did not expect to catch an error.");
        } catch (err) {

        }
        expect(computedNames).to.be.undefined;
        // expect(computedNames.teamName).to.be.undefined;
        // expect(computedNames.repoName).to.be.undefined;
    });

    it("Should be able to compute a name for one person, when there is no deliv prefixes.", async () => {
        let person = await pc.getPerson(Test.USER1.id);
        let deliv = await db.getDeliverable(Test.ASSIGNID1);
        let computedNames: any;
        try {
            computedNames = await cc.computeNames(deliv, [person]);
        } catch (err) {
            assert.fail("Expected to not catch an error.");
        }

        expect(computedNames.teamName).to.not.be.null;
        expect(computedNames.repoName).to.not.be.null;
    });

    it("Should be able to compute a name for multiple persons.", async () => {
        let person1 = await pc.getPerson(Test.USER1.id);
        let person2 = await pc.getPerson(Test.USER2.id);
        let deliv = await db.getDeliverable(Test.ASSIGNID0);
        let computedNames: any;
        try {
            computedNames = await cc.computeNames(deliv, [person1, person2]);
        } catch (err) {
            assert.fail("Expected to not catch an error.");
        }

        expect(computedNames.teamName).to.not.be.null;
        expect(computedNames.repoName).to.not.be.null;
    });

    it("Should be able to compute a name after a team has already been formed.", async () => {
        let person1 = await pc.getPerson(Test.USER1.id);
        let person2 = await pc.getPerson(Test.USER2.id);
        let deliv = await db.getDeliverable(Test.ASSIGNID0);
        let computedNames: any;
        try {
            computedNames = await cc.computeNames(deliv, [person1, person2]);
            await tc.createTeam(computedNames.teamName, deliv, [person1, person2], null);
            computedNames = await cc.computeNames(deliv, [person1, person2]);
        } catch (err) {
            assert.fail("Expected to not catch an error.");
        }

        expect(computedNames.teamName).to.not.be.null;
        expect(computedNames.repoName).to.not.be.null;
    });

});
