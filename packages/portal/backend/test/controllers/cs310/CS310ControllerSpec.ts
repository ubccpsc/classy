import {expect} from "chai";
import "mocha";

import Log from "../../../../../common/Log";
import {CS310Controller} from "../../../src/controllers/cs310/CS310Controller";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import {TestGitHubController} from "../../../src/controllers/GitHubController";

import "../../GlobalSpec";
import {Test} from "../../TestHarness";

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

    it("Should be able to compute a team and repo name w/ stable ordering.", async () => {
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

        res = await cc.computeNames(deliv, [p2, p1]); // reverse people names
        expect(res.teamName).to.equal(tExpected);
        expect(res.repoName).to.equal(rExpected);
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

        const INIT_GRADE = 50;
        const grade = await Test.createGrade(Test.USER1.id, Test.DELIVID0, INIT_GRADE);
        grade.timestamp = 0;

        let existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        // higher than existingGrade will be null here
        Log.test('try to save a non-existent grade');
        let save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.true;
        await db.writeGrade(grade);

        // lower, don't save
        existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        grade.score = INIT_GRADE - 1;
        Log.test('try to save a lower grade');
        save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.false;

        // the same score, save anyways (so the last max score is taken if there are ties)
        existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        grade.score = INIT_GRADE;
        Log.test('try to save an equal grade');
        save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.true;

        // but higher now
        grade.score = INIT_GRADE + 10;
        existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        Log.test('try to save a higher grade');
        save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.true;

        // but after the deadline
        existingGrade = await db.getGrade(Test.USER1.id, Test.DELIVID0);
        grade.timestamp = Date.now();
        grade.score = INIT_GRADE + 20;
        Log.test('try to save a higher grade, but too late');
        save = await cc.handleNewAutoTestGrade(deliv, grade, existingGrade);
        expect(save).to.be.false;
    });

});
