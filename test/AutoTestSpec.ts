import {AutoTest} from "../src/autotest/AutoTest";
import {DummyClassPortal, IClassPortal} from "../src/autotest/ClassPortal";
import {DummyDataStore} from "../src/autotest/DataStore";
import {DummyGithubService} from "../src/autotest/GithubService";
import Log from "../src/util/Log";
import {ICommentEvent, IPushEvent} from "../src/Types";

import {expect} from "chai";
import * as fs from "fs";
import "mocha";

describe("AutoTest", () => {

    let pushes: IPushEvent[];
    let data: DummyDataStore;
    let portal: IClassPortal;
    let gh: DummyGithubService;
    let at: AutoTest;

    before(async function () {
        Log.test("AutoTest::before() - start");
        return new Promise(function (resolve, reject) {
            fs.readFile("test/pushes.json", (err: any, data2: any) => {
                if (err) {
                    reject(err);
                }
                pushes = JSON.parse(data2);
                resolve(data2);
            });

            // setup other vars
            data = new DummyDataStore();
            portal = new DummyClassPortal();
            gh = new DummyGithubService();
            const courseId = "cs310";
            at = new AutoTest(courseId, data, portal, gh);
        });
    });

    it("Should be able to be instantiated.", () => {
        expect(at).not.to.equal(null);
        expect(pushes.length).to.equal(9);
    });

    it("Should receive a push event.", () => {
        expect(at).not.to.equal(null);

        const pe: IPushEvent = pushes[0];
        expect(data.pushes.length).to.equal(0);
        at.handlePushEvent(pe);
        expect(data.pushes.length).to.equal(1);
        at.handlePushEvent(pushes[1]);
        at.handlePushEvent(pushes[2]);
        at.handlePushEvent(pushes[3]);
        at.handlePushEvent(pushes[4]);
        at.handlePushEvent(pushes[5]);
        expect(data.pushes.length).to.equal(6);
    });

    it("Should be able to tick and pull something off the queue.", () => {
        expect(data.pushes.length).to.equal(6);
        at.tick();
        expect(data.pushes.length).to.equal(6); // pushes record should be the same size
    });

    it("Should receive a comment event.", () => {
        expect(at).not.to.equal(null);

        const pe: IPushEvent = pushes[0];
        const ce: ICommentEvent = {
            // branch:     pe.branch,
            botMentioned: false,
            // repo:         pe.repo,
            commitSHA:    pe.commitSHA,
            commitURL:    pe.commitURL,
            // projectUrl:   pe.projectUrl,
            userName:     "myUser",
            courseId:     "cs310",
            delivId:      "d0",
            postbackURL:  "postbackUrl!",
            timestamp:    1234567891
        };

        // chai.spy.on(gh, "postMarkdownToGithub"); // installing spies caused dependency issues
        expect(data.comments.length).to.equal(0);
        expect(gh.messages.length).to.equal(0);
        at.handleCommentEvent(ce);
        expect(data.comments.length).to.equal(1);
        expect(gh.messages.length).to.equal(1);
    });

});
