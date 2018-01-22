import {AutoTest} from "../src/autotest/AutoTest";
import {DummyClassPortal, IClassPortal} from "../src/autotest/ClassPortal";
import {DummyDataStore} from "../src/autotest/DataStore";
import {GithubService} from "../src/autotest/GithubService";
import {ICommentEvent, ICommitRecord, IContainerInput, IFeedbackGiven, IPushEvent} from "../src/Types";
import Log from "../src/util/Log";

import {expect} from "chai";
import * as fs from "fs-extra";
import "mocha";
import {Config} from "../src/Config";
import Util from "../src/util/Util";

describe("AutoTest", () => {

    Config.getInstance("test");
    let pushes: IPushEvent[];
    let data: DummyDataStore;
    let portal: IClassPortal;
    let gh: GithubService;
    let at: AutoTest;

    // now: 1516559187579
    // now -10h: 1516523258762
    // now - 24h: 1516472872288

    const pushEventA: IPushEvent = {
        "branch":      "master",
        "commitSHA":   "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":   "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "projectURL":  "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/",
        "org":         "CPSC310-2017W-T2",
        "postbackURL": "EMPTY",
        "repo":        "d0_team999",
        "timestamp":   1516472872288
    };

    const inputRecordA: IContainerInput = {
        "courseId": "cs310",
        "delivId":  "d0",
        "pushInfo": pushEventA
    };

    const commentRecordUserA = {
        "botMentioned": true,
        "commitSHA":    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "userName":     "cs310test",
        "courseId":     "cs310",
        "delivId":      "d9",
        "postbackURL":  "EMPTY",
        "timestamp":    1516472873288
    };

    const commentRecordUserATooSoon = {
        "botMentioned": true,
        "commitSHA":    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "userName":     "cs310test",
        "courseId":     "cs310",
        "delivId":      "d9",
        "postbackURL":  "EMPTY",
        "timestamp":    1516523258762
    };

    const commentRecordStaffA = {
        "botMentioned": true,
        "commitSHA":    "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitURL":    "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "userName":     "staff",
        "courseId":     "cs310",
        "delivId":      "d9",
        "postbackURL":  "EMPTY",
        "timestamp":    1516472874288
    };

    const outputRecordA: ICommitRecord = {
        "commitURL": "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "commitSHA": "abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
        "input":     inputRecordA,
        "output":    {
            "commitUrl":          "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
            "timestamp":          1516523418918,
            "report":             {
                "scoreOverall": 50,
                "scoreTest":    50,
                "scoreCover":   50,
                "passNames":    [],
                "failNames":    [],
                "errorNames":   [],
                "skipNames":    [],
                "custom":       []
            },
            "feedback":           "Test Feedback",
            "postbackOnComplete": false,
            "custom":             {},
            "attachments":        [],
            "state":              "SUCCESS"
        }
    };

    before(function () {
        Log.test("AutoTest::before() - start");

        pushes = fs.readJSONSync("./test/pushes.json");

        data = new DummyDataStore();
        data.clearData();

        portal = new DummyClassPortal();
        gh = new GithubService();
        const courseId = "cs310";
        at = new AutoTest(courseId, data, portal, gh);
    });

    beforeEach(function () {
        Log.test("AutoTest::beforeEach() - start");
        data.clearData();
    });

    it("Should be able to be instantiated.", () => {
        expect(at).not.to.equal(null);
        expect(pushes.length).to.equal(9);
    });

    it("Should be able to receive multiple pushes.", async () => {
        expect(at).not.to.equal(null);

        const pe: IPushEvent = pushes[0];
        let allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(0);
        await at.handlePushEvent(pe);
        await at.handlePushEvent(pushes[1]);
        await at.handlePushEvent(pushes[2]);
        await at.handlePushEvent(pushes[3]);
        await at.handlePushEvent(pushes[4]);
        await at.handlePushEvent(pushes[5]);
        allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(6);
    });

    it("Should be able to receive multiple concurrent pushes.", async () => {
        expect(at).not.to.equal(null);

        const pe: IPushEvent = pushes[0];
        const arr = [];
        arr.push(at.handlePushEvent(pushes[0]));
        arr.push(at.handlePushEvent(pushes[1]));
        arr.push(at.handlePushEvent(pushes[2]));
        arr.push(at.handlePushEvent(pushes[3]));
        arr.push(at.handlePushEvent(pushes[4]));
        arr.push(at.handlePushEvent(pushes[5]));

        await Promise.all(arr);
        const allData = await data.getAllData();
        // expect(allData.pushes.length).to.equal(6);
        await Util.timeout(100); // just wait
    });

    it("Should receive a comment event.", async () => {
        expect(at).not.to.equal(null);

        const pe: IPushEvent = pushes[0];
        const ce: ICommentEvent = {
            botMentioned:  false,
            commitSHA:     pe.commitSHA,
            commitURL:     pe.commitURL,
            userName:      "myUser",
            courseId:      "cs310",
            delivId:       "d0",
            "postbackURL": "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
            timestamp:     1234567891
        };

        let allData = await data.getAllData();
        expect(allData.comments.length).to.equal(0);
        await at.handleCommentEvent(ce);
        allData = await data.getAllData();
        expect(allData.comments.length).to.equal(0);

        await Util.timeout(1 * 1000); // let test finish so it doesn't ruin subsequent executions
    });

    it("User should be given a warning message on a commit that has not been queued.", async () => {
        // This case happens when a comment is made on a commit that AutoTest did not see the push for
        expect(at).not.to.equal(null);

        // start fresh
        data.clearData();
        gh.messages = [];

        // SETUP: add a push with no output records
        // await data.savePush(inputRecordA);
        let allData = await data.getAllData();
        expect(gh.messages.length).to.equal(0); // should not generate feedback
        expect(allData.pushes.length).to.equal(0);
        Log.test("Setup complete");

        // TEST: send a comment
        await at.handleCommentEvent(commentRecordUserA);
        allData = await data.getAllData();
        expect(gh.messages.length).to.equal(1); // should generate a warning
        expect(gh.messages[0].message).to.equal("This commit is has not been queued; please make and push a new commit.");
        expect(allData.comments.length).to.equal(0); // comment event should not have been saved
    });

    it("User should be given 'still processing' message on a commit that has not been finished.", async () => {
        // This case happens when a comment is made on a commit that AutoTest did not see the push for
        expect(at).not.to.equal(null);

        // start fresh
        data.clearData();
        gh.messages = [];

        // SETUP: add a push with no output records
        await at.handlePushEvent(pushEventA);
        let allData = await data.getAllData();
        expect(gh.messages.length).to.equal(0); // should not be any feedback yet
        expect(allData.pushes.length).to.equal(1);
        Log.test("Setup complete");

        // TEST: send a comment
        await at.handleCommentEvent(commentRecordUserA);
        allData = await data.getAllData();
        expect(gh.messages.length).to.equal(1); // should generate a warning
        expect(gh.messages[0].message).to.equal("This commit is still queued for processing against d9. Your results will be posted here as soon as they are ready.");
        expect(allData.comments.length).to.equal(1);
    });

    it("User should be given the results message on a commit that has been finished.", async () => {
        // This case happens when a comment is made on a commit that AutoTest did not see the push for
        expect(at).not.to.equal(null);

        // start fresh
        data.clearData();
        gh.messages = [];

        // SETUP: add a push with no output records
        await at.handlePushEvent(pushEventA);
        let allData = await data.getAllData();
        expect(gh.messages.length).to.equal(0); // should not be any feedback yet
        expect(allData.pushes.length).to.equal(1);
        expect(allData.feedback.length).to.equal(0);
        await Util.timeout(200); // should be long enough for processing to finish
        Log.test("Setup complete");

        // TEST: send a comment
        await at.handleCommentEvent(commentRecordUserA);
        allData = await data.getAllData();
        expect(gh.messages.length).to.equal(1); // should generate a warning
        expect(gh.messages[0].message).to.equal("Test execution complete."); // would really be the whole message
        expect(allData.comments.length).to.equal(1);
        expect(allData.feedback.length).to.equal(1); // user should have been charged
        Log.test("First request complete; starting second.");

        // FOLLOWUP: do it again, user should be given result for free since they previously asked
        await at.handleCommentEvent(commentRecordUserA);
        allData = await data.getAllData();
        expect(gh.messages.length).to.equal(2); // should return the row
        expect(gh.messages[0].message).to.equal("Test execution complete."); // would really be the whole message
        expect(allData.comments.length).to.equal(2);
        expect(allData.feedback.length).to.equal(2);
        Log.test("Test complete.");
    });

    it("User should not be able to request results too soon.", async () => {
        // This case happens when a comment is made on a commit that AutoTest did not see the push for
        expect(at).not.to.equal(null);

        // start fresh
        data.clearData();
        gh.messages = [];

        // SETUP: add a push with no output records
        const fg: IFeedbackGiven = {
            "commitURL": "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263fSOMEOTHER",
            "courseId":  "cs310",
            "delivId":   "d9",
            "timestamp": 1516451273288, ///
            "userName":  "cs310test"
        };
        data.savePush(inputRecordA);
        data.saveOutputRecord(outputRecordA);
        data.saveFeedbackGivenRecord(fg);
        let allData = await data.getAllData();
        expect(allData.comments.length).to.equal(0);
        expect(allData.feedback.length).to.equal(1); // user should have been charged
        Log.test("Setup complete");

        // TEST: send a comment
        await at.handleCommentEvent(commentRecordUserA);
        allData = await data.getAllData();
        expect(gh.messages.length).to.equal(1); // should generate a warning
        expect(gh.messages[0].message).to.equal("You must wait 6 hours and 0 minutes before requesting feedback."); // would really be the whole message
        expect(allData.comments.length).to.equal(0); // doesn't count as a comment, user has to ask again once they are in-quota

        Log.test("Test complete.");
    });

});
