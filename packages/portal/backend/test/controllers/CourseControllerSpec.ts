import { expect } from "chai";
import "mocha";

import { CourseController } from "@backend/controllers/CourseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { PersonController } from "@backend/controllers/PersonController";
import { Grade } from "@backend/Types";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import Util from "@common/Util";

import "@common/GlobalSpec"; // load first
import "./PersonControllerSpec";

describe("CourseController::interpretSubmission", () => {
	/**
	 * The DEFAULT reading of an externally-graded submission.
	 *
	 * This is what any course using the PrairieLearn connector inherits unless it overrides the
	 * hook, so it is the fallback that decides grades for a course that has not thought about it.
	 * Exercised directly here; PrairieLearnAgentSpec only reaches it through a whole sync.
	 *
	 * Deliberately NO bucket-to-number table: Classy used to carry CS210's rubric and no longer
	 * does, so a submission whose grader reports no number is not gradeable rather than being
	 * assigned one.
	 */
	const cc = new CourseController(null);
	const deliv: any = { id: "LA1" };

	function submission(overall: any, succeeded: boolean = true): any {
		return { feedback: { succeeded: succeeded, results: { report: { overall: overall } } } };
	}

	it("Should take the grader's score and band verbatim.", async () => {
		const result = await cc.interpretSubmission(submission({ score: 85.3, bucket: "developing", message: "some checks failed" }), deliv);

		expect(result).to.not.be.null;
		expect(result.score).to.equal(85.3);
		expect(result.displayScore).to.equal("developing");
		expect(result.custom.bucket).to.equal("developing");
	});

	it("Should rank by the score, so the best attempt is the highest-scoring one.", async () => {
		const low = await cc.interpretSubmission(submission({ score: 10, bucket: "beginning" }), deliv);
		const high = await cc.interpretSubmission(submission({ score: 90, bucket: "proficient" }), deliv);

		expect(high.rank).to.be.greaterThan(low.rank);
	});

	it("Should produce a report the admin views can render.", async () => {
		// scoreOverall is what the Results and Dashboard tabs read; the grader's own shape has no
		// such field, which is the whole reason this translation exists
		const result = await cc.interpretSubmission(submission({ score: 72, bucket: "developing", message: "hello" }), deliv);

		expect(result.report.scoreOverall).to.equal(72);
		expect(result.report.feedback).to.equal("hello");
		// the default cannot know a course's per-test shape, so the name lists are empty rather than wrong
		expect(result.report.passNames).to.deep.equal([]);
		expect(result.report.failNames).to.deep.equal([]);
		expect(result.report.scoreTest).to.be.null;
		expect(result.report.scoreCover).to.be.null;
	});

	it("Should accept a score of exactly zero.", async () => {
		// 0 is a real grade; only a NEGATIVE score means "no score here"
		const result = await cc.interpretSubmission(submission({ score: 0, bucket: "beginning" }), deliv);

		expect(result).to.not.be.null;
		expect(result.score).to.equal(0);
	});

	it("Should treat a submission with a band but no number as not gradeable.", async () => {
		// the rubric that used to turn a band into a number lives in the course plugin now, so the
		// default has nothing to grade on. Skipping is right; inventing a number would not be.
		expect(await cc.interpretSubmission(submission({ bucket: "proficient" }), deliv)).to.be.null;
	});

	it("Should reject a negative score rather than grading it.", async () => {
		expect(await cc.interpretSubmission(submission({ score: -1, bucket: "beginning" }), deliv)).to.be.null;
	});

	it("Should skip a submission whose grading job did not succeed.", async () => {
		expect(await cc.interpretSubmission(submission({ score: 90 }, false), deliv)).to.be.null;
	});

	it("Should skip a submission with no feedback or no report.", async () => {
		expect(await cc.interpretSubmission({}, deliv)).to.be.null;
		expect(await cc.interpretSubmission({ feedback: null }, deliv)).to.be.null;
		expect(await cc.interpretSubmission({ feedback: { succeeded: true, results: {} } }, deliv)).to.be.null;
	});

	it("Should cope with a band that is missing or blank.", async () => {
		// a course may report a number and no band at all; that is gradeable, just not bandable
		const result = await cc.interpretSubmission(submission({ score: 55 }), deliv);

		expect(result).to.not.be.null;
		expect(result.score).to.equal(55);
		expect(result.displayScore, "no band to show").to.be.undefined;
	});
});

describe("CourseController", () => {
	let cc: CourseController;

	before(async () => {
		await TestHarness.suiteBefore("CourseController");
		await TestHarness.preparePeople();
		await TestHarness.prepareDeliverables();
	});

	beforeEach(() => {
		const ghc = new GitHubController(GitHubActions.getInstance());
		cc = new CourseController(ghc);
	});

	after(async () => {
		TestHarness.suiteAfter("CourseController");
	});

	it("Should be able to handle an unknown user.", async () => {
		const person = await cc.handleUnknownUser("unknown_" + Date.now());
		// should do nothing
		expect(person).to.be.null;
	});

	it("Should be able to compute names.", async () => {
		const p1 = await new PersonController().getPerson(TestHarness.USER1.id);
		const p2 = await new PersonController().getPerson(TestHarness.USER2.id);
		const deliv = await new DeliverablesController().getDeliverable(TestHarness.DELIVID1);
		const names = await cc.computeNames(deliv, [p1, p2]);
		Log.test("computed names: " + JSON.stringify(names));

		expect(names.teamName).to.equal("t_d1_" + TestHarness.USER1.csId + "_" + TestHarness.USER2.csId);
		// expect(names.teamName).to.equal("t_d1_user1CSID_user2CSID");
		expect(names.repoName).to.equal("d1_user1CSID_user2CSID");
	});

	it("Should not be able to compute names if there are no people or no deliverable.", async () => {
		const deliv = await new DeliverablesController().getDeliverable(TestHarness.DELIVID1);
		let ex = null;
		try {
			await cc.computeNames(deliv, []);
		} catch (err) {
			ex = err;
		}
		expect(ex).to.not.be.null;

		const p1 = await new PersonController().getPerson(TestHarness.USER1.id);
		ex = null;
		try {
			await cc.computeNames(null, [p1]);
		} catch (err) {
			ex = err;
		}
		expect(ex).to.not.be.null;
	});

	it("Should accept an autotest grade.", async () => {
		const deliv = await new DeliverablesController().getDeliverable(TestHarness.DELIVID1);
		const g: Grade = {
			personId: TestHarness.USER1.id,
			delivId: TestHarness.DELIVID1,
			score: 50,
			timestamp: deliv.closeTimestamp - 100,
			urlName: null,
			URL: null,
			comment: "",
			custom: {},
		};

		let acceptGrade = await cc.handleNewAutoTestGrade(deliv, g, null);
		expect(acceptGrade).to.be.true;

		// should still accept it if it comes in with the same size (so later requests count)
		acceptGrade = await cc.handleNewAutoTestGrade(deliv, g, g);
		expect(acceptGrade).to.be.true;
	});

	it("Should not accept an autotest grade once grades are released.", async () => {
		// Policy decided 2026-09-08: a later AutoTest result must not silently replace a grade the
		// student has already seen. The common way to get here is moving closeTimestamp to grant one
		// extension, which reopens grading for the whole class. Un-release first to regrade.
		const deliv = JSON.parse(JSON.stringify(await new DeliverablesController().getDeliverable(TestHarness.DELIVID1)));
		deliv.gradesReleased = true;
		const g: Grade = {
			personId: TestHarness.USER1.id,
			delivId: TestHarness.DELIVID1,
			score: 99, // higher than anything existing, and inside the open window: only release blocks it
			timestamp: deliv.closeTimestamp - 100,
			urlName: null,
			URL: null,
			comment: "",
			custom: {},
		};

		expect(await cc.handleNewAutoTestGrade(deliv, g, null), "released: refuse even with no existing grade").to.be.false;

		deliv.gradesReleased = false;
		expect(await cc.handleNewAutoTestGrade(deliv, g, null), "un-released: accepted again").to.be.true;
	});

	it("Should not accept a smaller autotest grade.", async () => {
		const deliv = await new DeliverablesController().getDeliverable(TestHarness.DELIVID1);
		const g: Grade = {
			personId: TestHarness.USER1.id,
			delivId: TestHarness.DELIVID1,
			score: 49,
			timestamp: deliv.closeTimestamp - 100,
			urlName: null,
			URL: null,
			comment: "",
			custom: {},
		};

		const g1 = Util.clone(g) as Grade;
		g1.score = 50; // existing grade is higher

		const acceptGrade = await cc.handleNewAutoTestGrade(deliv, g, g1);
		expect(acceptGrade).to.be.false;
	});

	it("Should not accept an autotest grade outside of the deliverable window.", async () => {
		const deliv = await new DeliverablesController().getDeliverable(TestHarness.DELIVID1);
		const g: Grade = {
			personId: TestHarness.USER1.id,
			delivId: TestHarness.DELIVID1,
			score: 49,
			timestamp: 0,
			urlName: null,
			URL: null,
			comment: "",
			custom: {},
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
