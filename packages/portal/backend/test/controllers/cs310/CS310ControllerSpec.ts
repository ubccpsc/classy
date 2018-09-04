import {expect} from "chai";
import "mocha";

import Log from "../../../../../common/Log";
import {CS310Controller} from "../../../src/controllers/cs310/CS310Controller";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import {TestGitHubController} from "../../../src/controllers/GitHubController";
import {Test} from "../../GlobalSpec";

import "../../GlobalSpec";

describe("CS310: CS310Controller", () => {

    let cc: CS310Controller = null;

    before(async () => {
        await Test.suiteBefore('CS310Controller');

        // clear stale data
        const dc = DatabaseController.getInstance();
        await dc.clearData();
        cc = new CS310Controller(new TestGitHubController());

        // get data ready
        await Test.prepareAll();
    });

    after(async () => {
        Test.suiteAfter('CS310Controller');
    });

    it("Should not create a new unknown person.", async () => {
        const db = DatabaseController.getInstance();
        const oldPeople = await db.getPeople();

        const res = await cc.handleUnknownUser('unknownPerson' + Date.now());
        expect(res).to.be.null;

        const newPepople = await db.getPeople();
        expect(oldPeople.length).to.equal(newPepople.length);
    });

    it("Should be able to compute a team and repo name.", async () => {
        const dbc = DatabaseController.getInstance();
        const dc = new DeliverablesController();
        const deliv = await dc.getDeliverable(Test.DELIVID0);
        const p1 = await dbc.getPerson(Test.USER1.id);
        const p2 = await dbc.getPerson(Test.USER2.id);

        let res = await cc.computeNames(deliv, [p1, p2]);
        const tExpected = deliv.teamPrefix + '_' + deliv.id + '_' + Test.USER1.github + '_' + Test.USER2.github;
        const rExpected = deliv.id + '_' + Test.USER1.github + '_' + Test.USER2.github;

        expect(res.teamName).to.equal(tExpected);
        expect(res.repoName).to.equal(rExpected);

        // make those teams
        const t = await Test.createTeam(res.teamName, deliv.id, []);
        await dbc.writeTeam(t);

        const r = await Test.createRepository(res.repoName, deliv.id, res.teamName);
        await dbc.writeRepository(r);

        // try again once the teams / repos exist
        let ex = null;
        res = null;
        try {
            res = await cc.computeNames(deliv, [p1, p2]);
        } catch (err) {
            ex = err;
        }
        Log.test("res: " + res + "; ex: " + ex);
        expect(ex).to.be.null;
        expect(res).to.not.be.null;
        expect(res.teamName).to.equal(tExpected);
        expect(res.repoName).to.equal(rExpected);
    });

    it("Should fail to compute a team and repo name if people aren't sepecified.", async () => {
        const db = DatabaseController.getInstance();

        const deliv = await db.getDeliverable(Test.DELIVID0);

        // make sure this fails
        let ex = null;
        let res = null;
        try {
            res = await cc.computeNames(deliv, []);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
    });

    it("Should accept or reject grades as appropriate.", async () => {
        const db = DatabaseController.getInstance();

        const deliv = await db.getDeliverable(Test.DELIVID0);

        const grade = await Test.createGrade(Test.USER1.id, Test.DELIVID0, 50);
        grade.timestamp = 0;

        let existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        // higher than existingGrade will be null here
        let save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.true;
        await db.writeGrade(grade);

        // not higher
        existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.false;

        // but higher now
        grade.score = 60;
        existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.true;

        // but after the deadline
        existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        grade.timestamp = Date.now();
        grade.score = 70;
        save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.false;
    });

});
