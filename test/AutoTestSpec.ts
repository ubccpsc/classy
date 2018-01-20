import {AutoTest} from "../src/autotest/AutoTest";
import {DummyClassPortal, IClassPortal} from "../src/autotest/ClassPortal";
import {DummyDataStore} from "../src/autotest/DataStore";
import {GithubService} from "../src/autotest/GithubService";
import {ICommentEvent, IPushEvent} from "../src/Types";
import Log from "../src/util/Log";

import {expect} from "chai";
import * as fs from "fs-extra";
import "mocha";

describe("AutoTest", () => {

    let pushes: IPushEvent[];
    let data: DummyDataStore;
    let portal: IClassPortal;
    let gh: GithubService;
    let at: AutoTest;

    before(function () {
        Log.test("AutoTest::before() - start");

        pushes = fs.readJSONSync("./test/pushes.json");

        data = new DummyDataStore();
        portal = new DummyClassPortal();
        gh = new GithubService();
        const courseId = "cs310";
        at = new AutoTest(courseId, data, portal, gh);
    });

    it("Should be able to be instantiated.", () => {
        expect(at).not.to.equal(null);
        expect(pushes.length).to.equal(9);
    });

    it("Should be able to receive multiple pushes.", async () => {
        expect(at).not.to.equal(null);

        const pe: IPushEvent = pushes[0];
        // expect(data.pushes.length).to.equal(0);
        await at.handlePushEvent(pe);
        await at.handlePushEvent(pushes[1]);
        await at.handlePushEvent(pushes[2]);
        await at.handlePushEvent(pushes[3]);
        await at.handlePushEvent(pushes[4]);
        await at.handlePushEvent(pushes[5]);
        // expect(data.pushes.length).to.equal(6);
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

        // should assert something
    });

    it("Should be able to tick and pull something off the queue.", () => {
        // expect(data.pushes.length).to.equal(6);
        at.tick();
        // expect(data.pushes.length).to.equal(6); // pushes record should be the same size
    });

    it("Should receive a comment event.", async () => {
        expect(at).not.to.equal(null);

        const pe: IPushEvent = pushes[0];
        const ce: ICommentEvent = {
            // branch:     pe.branch,
            botMentioned:  false,
            // repo:         pe.repo,
            commitSHA:     pe.commitSHA,
            commitURL:     pe.commitURL,
            // projectUrl:   pe.projectUrl,
            userName:      "myUser",
            courseId:      "cs310",
            delivId:       "d0",
            "postbackURL": "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
            timestamp:     1234567891
        };

        // chai.spy.on(gh, "postMarkdownToGithub"); // installing spies caused dependency issues
        // expect(data.comments.length).to.equal(0);
        expect(gh.messages.length).to.equal(0);
        await at.handleCommentEvent(ce);
        // expect(data.comments.length).to.equal(1);
        // expect(gh.messages.length).to.equal(1); // commented out because it's async and we aren't waiting yet
    });

});
