import {expect} from "chai";
import "mocha";
import {AutoTestHandler} from "../src/autotest/AutoTestHandler";
import {DummyClassPortal, IClassPortal} from "../src/autotest/ClassPortal";
import {DummyDataStore} from "../src/autotest/DataStore";
import {ICommentInfo, IPushInfo} from "../src/Types";

import * as fs from "fs";
import Log from "../src/Log";
import {DummyGithubService, IGithubService} from "../src/autotest/GithubService";

describe("AutoTest", () => {

    let pushes: IPushInfo[];
    let data: DummyDataStore;
    let portal: IClassPortal;
    let gh: IGithubService;
    let at: AutoTestHandler;

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
            at = new AutoTestHandler(courseId, data, portal, gh);
        });
    });

    it("should be able to be instantiated", () => {
        expect(at).not.to.equal(null);
        expect(pushes.length).to.equal(9);
    });

    it("should receive a push event", () => {
        expect(at).not.to.equal(null);

        const pe: IPushInfo = pushes[0];
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

    it("should be able to tick and pull something off the queue", () => {
        expect(data.pushes.length).to.equal(6);
        at.tick();
        expect(data.pushes.length).to.equal(6); // pushes record should be the same size
    });

    it("should receive a comment event", () => {
        expect(at).not.to.equal(null);

        const pe: IPushInfo = pushes[0];
        const ce: ICommentInfo = {
            branch:     pe.branch,
            repo:       pe.repo,
            commit:     pe.commit,
            commitUrl:  pe.commitUrl,
            projectUrl: pe.projectUrl,
            userName:   "myUser",
            courseId:   "cs310",
            delivId:    "d0",
            timestamp:  1234567891
        };

        // chai.spy.on(gh, "postMarkdownToGithub"); // installing spies caused dependency issues
        expect(data.comments.length).to.equal(0);
        at.handleCommentEvent(ce);
        expect(data.comments.length).to.equal(1);
    });

});
