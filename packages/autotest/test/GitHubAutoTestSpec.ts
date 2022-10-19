import {expect} from "chai";
import * as fs from "fs-extra";
import "mocha";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {IFeedbackGiven} from "@common/types/AutoTestTypes";
import {CommitTarget} from "@common/types/ContainerTypes";
import Util from "@common/Util";

import {IClassPortal} from "@autotest/autotest/ClassPortal";
import {MockClassPortal} from "@autotest/autotest/mocks/MockClassPortal";
import {MockDataStore} from "@autotest/autotest/mocks/MockDataStore";
import {GitHubAutoTest} from "@autotest/github/GitHubAutoTest";
import {IGitHubMessage} from "@autotest/github/GitHubUtil";

import "@common/GlobalSpec"; // load first
import {TestData} from "./TestData";

/* tslint:disable:max-line-length */
describe("GitHubAutoTest", () => {

    Config.getInstance();

    let pushes: CommitTarget[];
    let data: MockDataStore;
    let portal: IClassPortal;
    let at: GitHubAutoTest;

    const now = Date.now();
    const TS_IN = new Date(now - (1000 * 60 * 5)).getTime(); // 5 mins ago
    // const TS_IN = new Date(2018, 3, 3).getTime();

    const WAIT = 1000;

    // now: 1516559187579
    // now -10h: 1516523258762
    // now - 24h: 1516472872288

    before(async function () {
        Log.test("AutoTest::before() - start");

        pushes = fs.readJSONSync(__dirname + "/githubAutoTestData/pushes.json");

        let i = 0;
        for (const push of pushes) {
            push.timestamp = TS_IN + i++ * 1000;
        }

        data = new MockDataStore();
        await data.clearData();

        portal = new MockClassPortal();
        Config.getInstance().setProp(ConfigKey.postback, false);

        Log.test("AutoTest::before() - done");
    });

    beforeEach(async function () {
        await data.clearData();

        // create a new AutoTest every test (allows us to mess with methods and make sure they are called)
        at = new GitHubAutoTest(data, portal, null);
    });

    afterEach(async function () {
        // pause after each test so async issues don"t persist
        // this is a hack, but makes the tests more deterministic
        // Log.test("AutoTest::afterEach() - start");
        await Util.timeout(WAIT / 2);
    });

    it("Should be able to be instantiated.", () => {
        expect(at).not.to.equal(null);
        expect(pushes.length).to.equal(9);
    });

    it("Should be able to read numJobs from config if given.", () => {
        // check default
        expect(Config.getInstance().getProp(ConfigKey.autotestJobs)).to.be.null;
        expect(at["numJobs"]).to.equal(5); // 5 jobs by default

        // update
        Config.getInstance().setProp(ConfigKey.autotestJobs, 10);
        at = new GitHubAutoTest(data, portal, null);
        expect(at["numJobs"]).to.equal(10);

        Config.getInstance().setProp(ConfigKey.autotestJobs, 5); // put back to 5 jobs
    });

    it("Should gracefully fail with bad pushes.", async () => {
        expect(at).not.to.equal(null);

        let res = await at.handlePushEvent(null);
        expect(res).to.be.false;
        res = await at.handlePushEvent(undefined);
        expect(res).to.be.false;
    });

    it("Should be able to receive multiple pushes.", async () => {
        expect(at).to.not.be.null;

        let allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(0);
        await at.handlePushEvent(pushes[0]);
        await at.handlePushEvent(pushes[1]);
        await at.handlePushEvent(pushes[2]);
        await at.handlePushEvent(pushes[3]);
        await at.handlePushEvent(pushes[4]);
        await at.handlePushEvent(pushes[5]);
        allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(6);
    });

    // this works, but with the filesystem-backed mock data store, race conditions
    // keep happening
    // it("Admin requests should go to the front of the queue.", async () => {
    //     expect(at).to.not.be.null;
    //
    //     let allData = await data.getAllData();
    //     expect(allData.pushes.length).to.equal(0);
    //     await at.handlePushEvent(pushes[0]);
    //     await at.handlePushEvent(pushes[1]);
    //     await at.handlePushEvent(pushes[2]);
    //     await at.handlePushEvent(pushes[3]);
    //     await at.handlePushEvent(pushes[4]);
    //     const push = Object.assign({}, pushes[5]);
    //     push.commitSHA = "admin_" + push.commitSHA;
    //     push.adminRequest = true;
    //     push.personId = "admin1";
    //     await at.handlePushEvent(push);
    //     allData = await data.getAllData();
    //     expect(allData.pushes.length).to.equal(6);
    //
    //     await Util.delay(WAIT * 5);
    //     allData = await data.getAllData();
    //     expect(allData.pushes.length).to.equal(6); // unchanged
    //     expect(allData.records.length).to.equal(6);
    //     // as long as the last record isn"t the admin record it must have been bumped up
    //     expect(allData.records[5].input.target.adminRequest).to.be.undefined;
    //     // need to wait longer really, but
    //
    //     // TODO, check all data to make sure the admin push processed first
    // }).timeout(WAIT * 6);

    it("Rapid requests should go to the low queue.", async () => {
        expect(at).to.not.be.null;
        await Util.delay(WAIT); // let old tests expire before starting

        // start fresh
        await data.clearData();
        stubDependencies();

        let jobs = at["jobs"];
        expect(jobs).to.have.length(0);

        let allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(0);
        await at.handlePushEvent(pushes[0]);
        await at.handlePushEvent(pushes[1]);
        await at.handlePushEvent(pushes[2]);
        await at.handlePushEvent(pushes[3]);
        await at.handlePushEvent(pushes[4]);
        await at.handlePushEvent(pushes[5]);
        await at.handlePushEvent(pushes[6]);
        await at.handlePushEvent(pushes[7]);
        await at.handlePushEvent(pushes[8]);
        Log.test("all pushes sent");

        // to see at what admin pushes look like
        // const push = Object.assign({}, pushes[5]);
        // push.commitSHA = "admin_" + push.commitSHA;
        // push.adminRequest = true;
        // push.personId = "admin1";
        // await at.handlePushEvent(push);

        allData = await data.getAllData();

        await Util.delay(10);

        jobs = at["jobs"];
        expect(jobs).to.have.length(5);

        // all pushes should be here
        expect(allData.pushes.length).to.equal(9);
        const eq = (at["expressQueue"] as any);
        const sq = (at["standardQueue"] as any);
        const rq = (at["lowQueue"] as any);
        Log.test("about to check values");

        Log.test("#exp: " + eq.data.length + "; #std: " + sq.data.length + "; #low: " + rq.data.length + "; #jobs: " + jobs.length);
        expect(eq.data).to.have.length(0); // nothing should be queued on express
        expect(sq.data).to.have.length(3); // three should be waiting on standard
        // this is the main check: if this all worked, a job should have been pushed onto the regression queue
        expect(rq.data).to.have.length(1); // one should be queued on regression
        Log.test("values checked");
    }).timeout(WAIT * 3);

    it("Should gracefully fail with bad comments.", async () => {
        expect(at).not.to.equal(null);

        let res = null;
        let ex = null;
        try {
            res = await at.handleCommentEvent(null);
        } catch (err) {
            ex = err;
        }
        expect(res).to.be.null;
        expect(ex).to.not.be.null;
    });

    it("Check comment preconditions fail appropriately", async () => {
        let info: CommitTarget;
        let meetsPreconditions: boolean;

        Log.test("null info");
        info = null;
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;

        Log.test("undefined info");
        info = undefined;
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;

        Log.test("???");
        info = {
            adminRequest: false,
            personId: Config.getInstance().getProp(ConfigKey.botName),
            botMentioned: true,
            delivId: "d1",
            kind: "standard",
            repoId: "repoId",
            commitSHA: "SHA",
            commitURL: "https://URL",
            postbackURL: "https://postback",
            timestamp: new Date(2018, 2, 1).getTime(),
            cloneURL: "https://cloneURL"
        };
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        info.personId = "validName";

        Log.test("bot not mentioned");
        info.botMentioned = false;
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        info.botMentioned = true;

        Log.test("null delivId");
        info.delivId = null;
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        info.delivId = "d1";

        Log.test("wrong term");
        const oldOrg = info.orgId;
        info.orgId = "INVALIDTERM";
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        info.orgId = oldOrg;

        Log.test("invalid delivId");
        info.delivId = "d_" + Date.now();
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        info.delivId = "d1";

        // This actually passes: we don"t check if the person exists, just if they are staff (and unknown users are not staff)
        // Log.test("invalid person");
        // const person = info.personId;
        // info.personId = "person_" + Date.now();
        // meetsPreconditions = await at["checkCommentPreconditions"](info);
        // expect(meetsPreconditions).to.be.false;
        // info.personId = person;

        // This actually passes: we don"t validate repo existence at this point (since these events should only come from valid repos anyways)
        // Log.test("invalid repo");
        // const repo = info.repoId;
        // info.repoId = "repo_" + Date.now();
        // meetsPreconditions = await at["checkCommentPreconditions"](info);
        // expect(meetsPreconditions).to.be.false;
        // info.repoId = repo;

        Log.test("force by student");
        info.flags = ["#force"];
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        delete info.flags;

        Log.test("silent by student");
        info.flags = ["#silent"];
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        delete info.flags;

        Log.test("force by autobot");
        const student = info.personId;
        info.personId = Config.getInstance().getProp(ConfigKey.botName);
        info.flags = ["#force"];
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        info.personId = student;
        delete info.flags;

        Log.test("silent by staff");
        info.personId = "staff"; // Config.getInstance().getProp(ConfigKey.botName);
        info.flags = ["#silent"];
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.true;
        info.personId = student;
        delete info.flags;

        Log.test("not open yet");
        info.timestamp = new Date(2001, 12, 1).getTime(); // not open yet
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        info.timestamp = new Date(2018, 2, 1).getTime();

        Log.test("closed but with late autotest allowed");
        info.timestamp = new Date(2050, 12, 1).getTime(); // closed, but late autotest is true
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.true;
        info.timestamp = new Date(2018, 2, 1).getTime();

        Log.test("closed but with late autotest disallowed");
        info.delivId = "d0";
        info.timestamp = new Date(2050, 12, 1).getTime(); // closed, but late autotest is true
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.false;
        info.timestamp = new Date(2018, 2, 1).getTime();

        // valid case
        info.delivId = "d1";
        meetsPreconditions = await at["checkCommentPreconditions"](info);
        expect(meetsPreconditions).to.be.true;
    });

    it("Should be able to receive a valid comment event from a student for an open deliverable.", async () => {
        expect(at).not.to.equal(null);

        const pe: CommitTarget = pushes[0];
        const ce: CommitTarget = {
            botMentioned: true,
            commitSHA: pe.commitSHA,
            commitURL: pe.commitURL,
            adminRequest: false,
            personId: "myUser",
            kind: "standard",
            repoId: "d1_project9999",
            delivId: "d0",
            postbackURL: "https://github.students.cs.ubc.ca/api/v3/repos/classytest/PostTestDoNotDelete/commit/c35a0e5968338a9757813b58368f36ddd64b063e/comments",
            timestamp: TS_IN,
            cloneURL: "https://cloneURL"
        };

        Log.test("getting data");
        let allData = await data.getAllData();
        expect(allData.comments.length).to.equal(0);
        Log.test("handling comment");
        await at.handleCommentEvent(ce);
        Log.test("re-getting data");
        allData = await data.getAllData();
        expect(allData.comments.length).to.equal(1);

        // await Util.timeout(1 * 1000); // let test finish so it doesn"t ruin subsequent executions
    });

    it("Should be able to receive a comment event that queues right away due to no prior request.", async () => {
        expect(at).not.to.equal(null);

        const pe: CommitTarget = pushes[0];
        const ce: CommitTarget = {
            botMentioned: true,
            commitSHA: pe.commitSHA,
            commitURL: pe.commitURL,
            adminRequest: false,
            personId: "myUser",
            kind: "standard",
            repoId: "d1_project9999",
            delivId: "d0",
            postbackURL: "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
            timestamp: TS_IN,
            cloneURL: "https://cloneURL"
        };
        ce.flags = [];

        Log.test("getting data");
        let allData = await data.getAllData();
        expect(allData.comments.length).to.equal(0);

        Log.test("handling schedule");
        await at.handleCommentEvent(ce);

        Log.test("re-getting data");
        allData = await data.getAllData();
        expect(allData.comments.length).to.equal(1);
    });

    it("Should be able to use a comment event to start the express queue.", async () => {
        expect(at).not.to.equal(null);

        const pe: CommitTarget = pushes[0];
        let allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(0);
        await at.handlePushEvent(pe);
        await at.handlePushEvent(pushes[1]);
        await at.handlePushEvent(pushes[2]);

        const ce: CommitTarget = {
            botMentioned: true,
            commitSHA: pushes[2].commitSHA,
            commitURL: pushes[2].commitURL,
            adminRequest: false,
            personId: "myUser",
            kind: "standard",
            delivId: "d0",
            repoId: "d1_project9999",
            postbackURL: "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/cbe1b0918b872997de4c4d2baf4c263f8d4c6dc2/comments",
            timestamp: TS_IN,
            cloneURL: "https://cloneURL"
        };

        await Util.delay(WAIT);

        expect(allData.comments.length).to.equal(0);
        await at.handleCommentEvent(ce);

        await Util.delay(WAIT);
        allData = await data.getAllData();
        expect(allData.comments.length).to.equal(1);
    }).timeout(WAIT * 10);

    let gitHubMessages: IGitHubMessage[] = [];

    function stubDependencies() {
        gitHubMessages = [];
        at["postToGitHub"] = function (info: CommitTarget, message: IGitHubMessage): Promise<boolean> {
            Log.test("stubbed postToGitHub(..) - message: " + JSON.stringify(message));
            Log.test(gitHubMessages.length + "");
            if (typeof info.flags === "undefined" || info.flags.indexOf("#silent") < 0) {
                if (message !== null && typeof message.message !== "undefined") {
                    gitHubMessages.push(message);
                } else {
                    Log.test("stubbed postToGitHub(..) - invalid arg: " + message);
                    return Promise.resolve(false);
                }
            } else {
                Log.test("stubbed postToGitHub(..) - #silent");
            }
            Log.test(gitHubMessages.length + "");
            return Promise.resolve(true);
        };
    }

    it("Should give a user a warning message on a commit that has not been queued.", async () => {
        // This case happens when a comment is made on a commit that AutoTest did not see the push for
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        stubDependencies();

        // SETUP: add a push with no output records
        // await data.savePush(inputRecordA);
        let allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0); // should not generate feedback
        expect(allData.pushes.length).to.equal(0);
        Log.test("Setup complete");

        // TEST: send a comment
        TestData.commentRecordUserA.timestamp = TS_IN;
        await at.handleCommentEvent(TestData.commentRecordUserA);
        allData = await data.getAllData();

        expect(gitHubMessages.length).to.equal(1); // should generate a warning
        expect(gitHubMessages[0].message).to.contain("queued for processing against d1");
        expect(allData.comments.length).to.equal(1); // comment event should not have been saved
    });

    it("Should give a user a 'still processing' message on a commit that has not been finished.", async () => {
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        stubDependencies();
        // gh.messages = [];

        // SETUP: add a push with no output records
        await at.handlePushEvent(TestData.pushEventA);
        let allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0); // should not be any feedback yet
        expect(allData.pushes.length).to.equal(1);
        Log.test("Setup complete");

        // TEST: send a comment
        await at.handleCommentEvent(TestData.commentRecordUserA);
        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(1); // should generate a warning
        expect(gitHubMessages[0].message).to.contain("queued for processing against d1");
        expect(allData.comments.length).to.equal(1);

        await Util.timeout(WAIT); // just clear the buffer before moving onto the next test
    }).timeout(WAIT * 10);

    it("Should give a user a response for on a commit once it finishes if they have previously requested it.", async () => {
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        stubDependencies();

        // SETUP: add a push with no output records
        await at.handlePushEvent(TestData.pushEventA);
        let allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0); // should not be any feedback yet
        expect(allData.comments.length).to.equal(0);
        expect(allData.pushes.length).to.equal(1);
        // don"t wait; want to catch this push in flight
        Log.test("Setup complete");

        // TEST: send a comment (this is the previous test)
        await at.handleCommentEvent(TestData.commentRecordUserA);
        allData = await data.getAllData();
        Log.test("1: - ghMessages: " + JSON.stringify(gitHubMessages));
        expect(gitHubMessages.length).to.equal(1); // should generate a warning
        expect(gitHubMessages[0].message).to.contain("queued for processing against d1");
        Log.test("1: - allData: " + JSON.stringify(allData));
        expect(allData.comments.length).to.equal(1);
        expect(allData.feedback.length).to.equal(0); // don"t charge for feedback until it is given
        await Util.timeout(WAIT); // Wait for it!
        Log.test("Round 1 complete");

        allData = await data.getAllData();
        Log.test("2: - githubMessages: " + JSON.stringify(gitHubMessages));
        Log.test("2: - allData: " + JSON.stringify(allData));
        expect(gitHubMessages.length).to.equal(2); // should generate a warning
        expect(gitHubMessages[1].message).to.equal("Test execution complete.");
        expect(allData.comments.length).to.equal(1);
        expect(allData.feedback.length).to.equal(1); // should be charged
        Log.test("Test complete");
    }).timeout(WAIT * 10);

    it("Should give a user a response for on a commit once it finishes if they have previously requested a check on it.", async () => {
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        stubDependencies();

        // SETUP: add a push with no output records
        await at.handlePushEvent(TestData.pushEventA);
        Log.test("Setup push complete");
        let allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0); // should not be any feedback yet
        expect(allData.comments.length).to.equal(0);
        expect(allData.pushes.length).to.equal(1);
        // don"t wait; want to catch this push in flight
        Log.test("Setup validated");

        // TEST: send a comment (this is the previous test)
        const req = Util.clone(TestData.commentRecordUserA) as CommitTarget;
        req.flags = ["#check"];
        req.kind = "check";
        await at.handleCommentEvent(req);
        Log.test("Test comment complete");
        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(1); // should generate a warning
        expect(gitHubMessages[0].message).to.equal("This commit is still queued for processing against d1. Your results will be posted here as soon as they are ready.");
        expect(allData.comments.length).to.equal(1);
        expect(allData.feedback.length).to.equal(0); // don"t charge for feedback until it is given
        await Util.timeout(WAIT); // Wait for it!
        Log.test("Round 1 complete");

        allData = await data.getAllData();
        Log.trace(JSON.stringify(gitHubMessages));
        expect(gitHubMessages.length).to.equal(2); // should generate a warning
        expect(gitHubMessages[1].message).to.equal("Test execution complete.");
        expect(allData.comments.length).to.equal(1);
        expect(allData.feedback.length).to.equal(1);
        Log.test("Test complete");
    }).timeout(WAIT * 10);

    it("Should give a user a response for on a commit once it finishes if postback is true.", async () => {
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        // gh.messages = [];
        stubDependencies();

        // SETUP: add a push with no output records
        await at.handlePushEvent(TestData.pushEventPostback);
        let allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0); // should not be any feedback yet
        expect(allData.comments.length).to.equal(0);
        expect(allData.pushes.length).to.equal(1);
        Log.test("Setup complete");

        // TEST: send a comment (this is the previous test)
        // await at.handleCommentEvent(commentRecordUserA);
        // allData = await data.getAllData();
        // expect(gh.messages.length).to.equal(1); // should generate a warning
        // expect(gh.messages[0].message).to.equal("This commit is still queued for processing against d1. Your results will be posted here as soon as they are ready.");
        // expect(allData.comments.length).to.equal(1);
        // expect(allData.feedback.length).to.equal(0); // don"t charge for feedback until it is given

        // Wait for it!
        await Util.timeout(WAIT);
        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(1); // should post response
        expect(gitHubMessages[0].message).to.equal("Build Problem Encountered.");
        expect(allData.comments.length).to.equal(0);
        expect(allData.feedback.length).to.equal(0); // no charge
    }).timeout(WAIT * 10);

    it("Should give a user a response for on a commit once it finishes if postback is true. They should not be charged if they requested this build.", async () => {
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        // gh.messages = [];
        stubDependencies();

        // SETUP: add a push with no output records
        await at.handlePushEvent(TestData.pushEventPostback);
        let allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0); // should not be any feedback yet
        expect(allData.comments.length).to.equal(0);
        expect(allData.pushes.length).to.equal(1);
        Log.test("Setup complete");

        // TEST: send a comment (this is the previous test)
        await at.handleCommentEvent(TestData.commentRecordUserA);
        Log.test("test one ready");
        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(1); // should generate a warning
        expect(gitHubMessages[0].message).to.equal("This commit is still queued for processing against d1. Your results will be posted here as soon as they are ready.");
        expect(allData.comments.length).to.equal(1);
        expect(allData.feedback.length).to.equal(0); // don"t charge for feedback until it is given

        // Wait for it!
        await Util.timeout(WAIT);
        Log.test("test two ready");
        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(2); // should post response
        expect(gitHubMessages[1].message).to.equal("Build Problem Encountered.");
        expect(allData.comments.length).to.equal(1);
        expect(allData.feedback.length).to.equal(0); // no charge
    }).timeout(WAIT * 10);

    it("Should ignore a request for a push from a prior version of the course.", async () => {
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        // gh.messages = [];
        stubDependencies();

        let allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0);
        expect(allData.comments.length).to.equal(0);
        expect(allData.pushes.length).to.equal(0);

        // SETUP: add a push with no output records
        const push = Object.assign({}, TestData.pushEventPostback);
        push.orgId = "SOMERANDOMTERM";
        await at.handlePushEvent(push);

        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0); // should not be any feedback yet
        expect(allData.comments.length).to.equal(0);
        expect(allData.pushes.length).to.equal(0); // push should not save as it was dropped

        //
        //
        // // TEST: send a comment (this is the previous test)
        // // await at.handleCommentEvent(commentRecordUserA);
        // // allData = await data.getAllData();
        // // expect(gh.messages.length).to.equal(1); // should generate a warning
        // // expect(gh.messages[0].message).to.equal("This commit is still queued for processing against d1. Your results will be posted here as soon as they are ready.");
        // // expect(allData.comments.length).to.equal(1);
        // // expect(allData.feedback.length).to.equal(0); // don"t charge for feedback until it is given
        //
        // // Wait for it!
        // await Util.timeout(WAIT);
        // allData = await data.getAllData();
        // expect(gitHubMessages.length).to.equal(1); // should post response
        // expect(gitHubMessages[0].message).to.equal("Build Problem Encountered.");
        // expect(allData.comments.length).to.equal(0);
        // expect(allData.feedback.length).to.equal(0); // no charge
    }).timeout(WAIT * 10);

    it("Should give a user the results message on a commit that has been finished.", async () => {
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        // gh.messages = [];
        stubDependencies();

        // SETUP: add a push with no output records
        await at.handlePushEvent(TestData.pushEventA);
        let allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(0); // should not be any feedback yet
        expect(allData.pushes.length).to.equal(1);
        expect(allData.feedback.length).to.equal(0);
        await Util.timeout(WAIT); // should be long enough for processing to finish
        Log.test("Setup complete");

        // TEST: send a comment
        await at.handleCommentEvent(TestData.commentRecordUserA);
        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(1); // should generate a warning
        expect(gitHubMessages[0].message).to.equal("Test execution complete."); // would really be the whole message
        expect(allData.comments.length).to.equal(1);
        expect(allData.feedback.length).to.equal(1); // user should have been charged
        Log.test("First request complete; starting second.");

        // FOLLOWUP: do it again, user should be given result for free since they previously asked
        await at.handleCommentEvent(TestData.commentRecordUserA);
        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(2); // should return the row
        expect(gitHubMessages[0].message).to.equal("Test execution complete."); // would really be the whole message
        expect(allData.comments.length).to.equal(2);
        expect(allData.feedback.length).to.equal(1); // user should not have been charged again
        Log.test("Test complete.");
    }).timeout(WAIT * 10);

    it("Should not let a user request results too soon.", async () => {
        // This case happens when a comment is made on a commit that AutoTest did not see the push for
        expect(at).not.to.equal(null);

        // start fresh
        await data.clearData();
        // gh.messages = [];
        stubDependencies();

        // SETUP: add a push with no output records
        const fg: IFeedbackGiven = {
            commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263fSOMEOTHER", // different commit
            delivId: "d1", // same deliverable
            timestamp: TestData.commentRecordUserA.timestamp, // 1516451273288,
            personId: "cs310test",
            kind: "standard"
        };

        await data.savePush(TestData.inputRecordA.target);

        await data.saveFeedbackGivenRecord(fg);
        let allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(1);
        expect(allData.feedback.length).to.equal(1); // the feedback record we inserted from a recent past request
        expect(allData.comments.length).to.equal(0);
        Log.test("Setup complete");

        // TEST: send a comment
        await at.handleCommentEvent(TestData.commentRecordUserA);
        allData = await data.getAllData();
        expect(gitHubMessages.length).to.equal(1); // should generate a warning
        expect(gitHubMessages[0].message).to.equal("You must wait 6 hours and 0 minutes before requesting feedback."); // would really be the whole message
        expect(allData.comments.length).to.equal(0); // doesn"t count as a comment, user has to ask again once they are in-quota
        expect(allData.feedback.length).to.equal(1); // no extra feedback records should be present

        Log.test("Test complete.");
    }).timeout(WAIT * 10);

    it("Should be able to invoke a container.", async () => {
        expect(at).not.to.equal(null);

        const pe: CommitTarget = pushes[0];
        pe.postbackURL = "do it here";
        let allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(0);
        await at.handlePushEvent(pe);
        allData = await data.getAllData();
        expect(allData.pushes.length).to.equal(1);

    });

    // it.skip("Should let a user request results without specifying delivId.", async () => {
    //     return;
    // });
    //
    // it.skip("Should let a user request results for a delivId other than the default.", async () => {
    //     return;
    // });
    //
    // it.skip("Should let a user request results that promotes a push to the express queue.", async () => {
    //     return;
    // });
    //
    // it.skip("Should let a staff request results without being rate limited.", async () => {
    //     return;
    // });
    //
    // it.skip("Should ignore comments made by @autobot.", async () => {
    //     return;
    // });
    //
    // it.skip("Should ignore comments that don"t mention @autobot.", async () => {
    //     return;
    // });

});
