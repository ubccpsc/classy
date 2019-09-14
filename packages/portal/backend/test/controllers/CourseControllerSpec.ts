import {expect} from "chai";
import "mocha";
import Log from "../../../../common/Log";
import {Test} from "../../../../common/TestHarness";
import Util from "../../../../common/Util";

import {CourseController} from "../../src/controllers/CourseController";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {GitHubActions} from "../../src/controllers/GitHubActions";
import {GitHubController} from "../../src/controllers/GitHubController";
import {PersonController} from "../../src/controllers/PersonController";
import {Grade} from "../../src/Types";

import '../GlobalSpec';
import './PersonControllerSpec';

describe("CourseController", () => {

    const TIMEOUT = 10000;

    let cc: CourseController;

    before(async () => {
        await Test.suiteBefore('CourseController');
        await Test.preparePeople();
        await Test.prepareDeliverables();
    });

    beforeEach(() => {
        const ghc = new GitHubController(GitHubActions.getInstance());
        cc = new CourseController(ghc);
    });

    after(async () => {
        Test.suiteAfter('CourseController');
    });

    it("Should be able to handle an unknown user.", async () => {
        const person = await cc.handleUnknownUser('unknown_' + Date.now());
        // should do nothing
        expect(person).to.be.null;
    });

    it("Should be able to compute names.", async () => {

        const p1 = await new PersonController().getPerson(Test.USER1.id);
        const p2 = await new PersonController().getPerson(Test.USER2.id);
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID1);
        const names = await cc.computeNames(deliv, [p1, p2]);
        Log.test("computed names: " + JSON.stringify(names));

        expect(names.teamName).to.equal('t_d1_' + Test.USER1.csId + '_' + Test.USER2.csId);
        // expect(names.teamName).to.equal('t_d1_user1CSID_user2CSID');
        expect(names.repoName).to.equal('d1_user1CSID_user2CSID');
    });

    it("Should not be able to compute names if there are no people or no deliverable.", async () => {

        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID1);
        let ex = null;
        try {
            await cc.computeNames(deliv, []);
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;

        const p1 = await new PersonController().getPerson(Test.USER1.id);
        ex = null;
        try {
            await cc.computeNames(null, [p1]);
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;
    });

    it("Should accept an autotest grade.", async () => {
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID1);
        const g: Grade = {
            personId:  Test.USER1.id,
            delivId:   Test.DELIVID1,
            score:     50,
            timestamp: deliv.closeTimestamp - 100,
            urlName:   null,
            URL:       null,
            comment:   '',
            custom:    {}
        };

        let acceptGrade = await cc.handleNewAutoTestGrade(deliv, g, null);
        expect(acceptGrade).to.be.true;

        // should still accept it if it comes in with the same size (so later requests count)
        acceptGrade = await cc.handleNewAutoTestGrade(deliv, g, g);
        expect(acceptGrade).to.be.true;
    });

    it("Should not accept a smaller autotest grade.", async () => {
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID1);
        const g: Grade = {
            personId:  Test.USER1.id,
            delivId:   Test.DELIVID1,
            score:     49,
            timestamp: deliv.closeTimestamp - 100,
            urlName:   null,
            URL:       null,
            comment:   '',
            custom:    {}
        };

        const g1 = Util.clone(g) as Grade;
        g1.score = 50; // existing grade is higher

        const acceptGrade = await cc.handleNewAutoTestGrade(deliv, g, g1);
        expect(acceptGrade).to.be.false;
    });

    it("Should not accept an autotest grade outside of the deliverable window.", async () => {
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID1);
        const g: Grade = {
            personId:  Test.USER1.id,
            delivId:   Test.DELIVID1,
            score:     49,
            timestamp: 0,
            urlName:   null,
            URL:       null,
            comment:   '',
            custom:    {}
        };

        // too early
        g.timestamp = deliv.openTimestamp - 100;
        let acceptGrade = await cc.handleNewAutoTestGrade(deliv, g, null);
        expect(acceptGrade).to.be.false;

        // too late
        g.timestamp = deliv.closeTimestamp + 100;
        acceptGrade = await cc.handleNewAutoTestGrade(deliv, g, null);
        expect(acceptGrade).to.be.false;
    });
});
