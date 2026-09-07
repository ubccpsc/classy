import { expect } from "chai";
import "mocha";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import "@common/GlobalSpec";

import { CourseController } from "@backend/controllers/CourseController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GradesController } from "@backend/controllers/GradesController";
import {
	PLAssessment,
	PLAssessmentInstance,
	PLSubmission,
	PrairieLearnAgent,
	PrairieLearnWatermark,
} from "@backend/server/common/PrairieLearnAgent";
import { Person, PersonKind } from "@backend/Types";

import * as fs from "fs";

/**
 * Tests for the PrairieLearn grade connector.
 *
 * NOTE: no network. The agent takes an injectable fetcher, so the whole sync runs against responses
 * captured from the live course instance (test/data/prairieLearn*.json, scrubbed of identities and
 * submitted code). The repo declares no mocking library, and this avoids needing one.
 *
 * NOTE: `report.overall.score` in those fixtures was ADDED, not captured. The captures predate the
 * grader emitting a score -- they carry only a bucket -- and Classy no longer maps a bucket to a
 * number (that rubric was CS210's and moved to its plugin). Without a score the fixtures would be
 * ungradeable, which is a fact about the old grader rather than about the code under test. The added
 * values keep bucket rank order; "developing" uses the 85.3 seen in a real 2026-09 payload.
 */
describe("PrairieLearnAgent", function () {
	const dc = DatabaseController.getInstance();

	const ASSESSMENT_ID = "2693345";
	const DELIV_ID = "LA1";

	let allBuckets: PLSubmission[];

	/**
	 * Two assessments so the "unmapped" and multi-assessment paths are exercised.
	 */
	function assessments(): PLAssessment[] {
		return [{ assessment_id: ASSESSMENT_ID, assessment_label: DELIV_ID, assessment_name: "lecture/lec01", title: "Lecture 01" }];
	}

	function instance(overrides: Partial<PLAssessmentInstance> = {}): PLAssessmentInstance {
		return Object.assign(
			{
				assessment_instance_id: "14492573",
				assessment_label: DELIV_ID,
				user_uid: TestHarness.REALUSER1.github + "@ubc.ca",
				user_role: "Student",
				modified_at: "2026-08-21T15:26:31-07:00",
			},
			overrides
		);
	}

	/**
	 * Builds a fetcher over supplied data. Records what was requested so specs can assert that an
	 * unchanged instance was never fetched.
	 */
	function fetcherFor(
		instances: PLAssessmentInstance[],
		submissions: PLSubmission[],
		calls: string[] = []
	): (path: string) => Promise<any> {
		return async function (path: string): Promise<any> {
			calls.push(path);
			if (path === "/assessments") {
				return assessments();
			}
			if (path.indexOf("/assessment_instances") > 0 && path.indexOf("/assessments/") === 0) {
				return instances;
			}
			if (path.indexOf("/submissions") > 0) {
				const id = path.split("/")[2];
				return submissions.filter((s) => s.assessment_instance_id === id);
			}
			throw new Error("unexpected path: " + path);
		};
	}

	before(async () => {
		await TestHarness.suiteBefore("PrairieLearnAgent");
		await TestHarness.prepareAll();

		// the agent refuses to run unless PrairieLearn is configured; supply test values
		Config.getInstance().setProp(ConfigKey.prairieLearnUrl, "https://us.prairielearn.com");
		Config.getInstance().setProp(ConfigKey.prairieLearnToken, "test-token");
		Config.getInstance().setProp(ConfigKey.prairieLearnCourseInstanceId, "218182");
		Config.getInstance().setProp(ConfigKey.prairieLearnUidDomain, "@ubc.ca");

		const raw = fs.readFileSync(__dirname + "/../data/prairieLearnSubmissionsAllBuckets.json", "utf8");
		allBuckets = JSON.parse(raw).map((s: any) => Object.assign(s, { assessment_instance_id: "14492573" }));

		// give the joined person a githubId matching the uid local-part
		const person: Person = await dc.getPerson(TestHarness.REALUSER1.id);
		if (person !== null) {
			person.githubId = TestHarness.REALUSER1.github;
			await dc.writePerson(person);
		}
	});

	after(async () => {
		TestHarness.suiteAfter("PrairieLearnAgent");
	});

	beforeEach(async () => {
		// watermarks persist by design; clear them so each spec starts from a cold sync
		const col = await dc.getCollection("jobWatermarks");
		await (col as any).deleteMany({});
	});

	it("Should refuse to run when PrairieLearn is not configured.", async function () {
		const saved = Config.getInstance().getProp(ConfigKey.prairieLearnToken);
		Config.getInstance().setProp(ConfigKey.prairieLearnToken, "");

		let ex = null;
		try {
			await new PrairieLearnAgent(fetcherFor([], [])).sync(TestHarness.ADMIN1.id);
		} catch (err) {
			ex = err;
		}
		Config.getInstance().setProp(ConfigKey.prairieLearnToken, saved);

		// a blank value in .env must not look configured; the message has to name the real fix
		expect(ex).to.not.be.null;
		expect(ex.message).to.contain("not configured");
	});

	describe("who gets synced", function () {
		// The sync joins PrairieLearn uids to Classy people by githubId and applies no PersonKind
		// filter anywhere, so a staff member who did a PrairieLearn activity gets a grade like
		// anyone else. This is pinned because it is easy to "tidy" resolvePeople into a
		// students-only query and not notice: staff grades would simply stop appearing.
		const STAFF_GH = "plStaffGh";
		const STAFF_ID = "plStaffId";
		const ADMIN_GH = "plAdminGh";
		const ADMIN_ID = "plAdminId";

		before(async function () {
			for (const [id, gh, kind] of [
				[STAFF_ID, STAFF_GH, PersonKind.STAFF],
				[ADMIN_ID, ADMIN_GH, PersonKind.ADMINSTAFF],
			] as Array<[string, string, PersonKind]>) {
				const person = TestHarness.createPerson(id, id + "CSID", gh, kind);
				await dc.writePerson(person);
			}
		});

		it("Should write a grade for a staff member who did the activity.", async function () {
			const inst = instance({ assessment_instance_id: "77001", user_uid: STAFF_GH + "@ubc.ca", user_role: "Staff" });
			const subs = allBuckets.map((sub: any) => Object.assign({}, sub, { assessment_instance_id: "77001" }));

			const summary = await new PrairieLearnAgent(fetcherFor([inst], subs)).sync(TestHarness.ADMIN1.id);
			Log.test("staff sync summary: " + JSON.stringify(summary));

			expect(summary.unmatchedUids, "a staff uid must join like any other").to.not.contain(inst.user_uid);

			const grade = await new GradesController().getGrade(STAFF_ID, DELIV_ID);
			expect(grade, "the staff member's grade must be written").to.not.be.null;
			expect(grade.custom.source).to.equal("prairielearn");
		});

		it("Should write a grade for an adminstaff member too.", async function () {
			const inst = instance({ assessment_instance_id: "77002", user_uid: ADMIN_GH + "@ubc.ca", user_role: "Staff" });
			const subs = allBuckets.map((sub: any) => Object.assign({}, sub, { assessment_instance_id: "77002" }));

			await new PrairieLearnAgent(fetcherFor([inst], subs)).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(ADMIN_ID, DELIV_ID);
			expect(grade, "adminstaff are people too").to.not.be.null;
		});

		it("Should surface a student uid it cannot join, rather than dropping it silently.", async function () {
			const inst = instance({ assessment_instance_id: "77003", user_uid: "nobodyHere@ubc.ca" });
			const subs = allBuckets.map((sub: any) => Object.assign({}, sub, { assessment_instance_id: "77003" }));

			const summary = await new PrairieLearnAgent(fetcherFor([inst], subs)).sync(TestHarness.ADMIN1.id);
			expect(summary.unmatchedUids).to.contain("nobodyHere@ubc.ca");
			expect(summary.unmatchedNonStudentUids, "a student miss belongs in the student list").to.not.contain("nobodyHere@ubc.ca");
		});

		it("Should keep an unjoined non-student out of the student list.", async function () {
			// Syncing every role means PL accounts that were never in the classlist now reach the
			// join and fail it on every run. Those misses are expected and permanent; mixing them
			// into unmatchedUids would bury the ones that indicate a real join problem.
			const inst = instance({
				assessment_instance_id: "77004",
				user_uid: "someInstructor@ubc.ca",
				user_role: "Staff",
			});
			const subs = allBuckets.map((sub: any) => Object.assign({}, sub, { assessment_instance_id: "77004" }));

			const summary = await new PrairieLearnAgent(fetcherFor([inst], subs)).sync(TestHarness.ADMIN1.id);

			expect(summary.unmatchedNonStudentUids).to.contain("someInstructor@ubc.ca");
			expect(summary.unmatchedUids, "must not dilute the signal the student list carries").to.not.contain("someInstructor@ubc.ca");
		});
	});

	it("Should take the best-ever bucket, not the most recent one.", async function () {
		const agent = new PrairieLearnAgent(fetcherFor([instance()], allBuckets));
		const summary = await agent.sync(TestHarness.ADMIN1.id);

		Log.test("PrairieLearnAgent - summary: " + JSON.stringify(summary));
		expect(summary.gradesWritten).to.equal(1);

		// the fixture is beginning -> proficient -> developing -> acquiring, i.e. a student who
		// peaked then regressed. Taking the latest submission would score 55, not 100.
		const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
		expect(grade).to.not.be.null;
		expect(grade.score).to.equal(97.5); // the grader's score for the proficient attempt
		expect(grade.custom.bucket).to.equal("proficient");
		expect(grade.custom.source).to.equal("prairielearn");
	});

	it("Should render the bucket via custom.displayScore, keeping score numeric.", async function () {
		await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);

		const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);

		// both AdminGradesTab and AbstractStudentView prefer custom.displayScore over
		// score.toFixed(2), so the grade sheet shows the bucket rather than "100.00"
		expect(grade.custom.displayScore).to.equal("proficient");

		// ...while score stays a number. It must: CourseController compares
		// newGrade.score >= existingGrade.score to keep the "last highest" grade, and the buckets do
		// not sort alphabetically in rank order (acquiring < beginning as text, but beginning ranks
		// lower), so a string here would silently reject a real improvement.
		expect(grade.score).to.be.a("number");
		expect(grade.score).to.equal(97.5); // the grader's score for the proficient attempt
	});

	describe("Submissions that are not gradeable", function () {
		// NOTE: PrairieLearn returns every submission, including ones the grader never finished and
		// ones from a grader version that reported nothing useful. Those must be skipped rather than
		// scored, and skipping them must not hide the attempts that *are* gradeable.
		//
		// Reading the payload is the course's job now (ICourseController::interpretSubmission), so
		// these drive the default implementation directly and then feed its answers to the agent's
		// ranking, which is the same path sync() takes.
		const cc = new CourseController(null);

		function submission(): any {
			return JSON.parse(JSON.stringify(allBuckets[0]));
		}

		async function interpret(sub: any): Promise<any> {
			return await cc.interpretSubmission(sub, TestHarness.createDeliverable(DELIV_ID));
		}

		async function pair(sub: any): Promise<any> {
			return { submission: sub, interpretation: await interpret(sub) };
		}

		it("Should ignore a submission whose grader did not succeed.", async function () {
			const sub = submission();
			sub.feedback.succeeded = false;

			expect(await interpret(sub), "a failed grading run is not gradeable").to.be.null;
		});

		it("Should ignore a submission with no feedback at all.", async function () {
			const sub = submission();
			sub.feedback = null;

			expect(await interpret(sub)).to.be.null;
		});

		it("Should ignore a submission whose report carries no score.", async function () {
			// the grader always reports overall.score; one that does not is a broken or ancient
			// run, and must be skipped rather than treated as a zero
			const sub = submission();
			delete sub.feedback.results.report.overall.score;

			expect(await interpret(sub)).to.be.null;
		});

		it("Should still find the best attempt among a mix of graded and ungraded ones.", async function () {
			// the case that matters: one bad submission must not cost a student their real grade
			const agent = new PrairieLearnAgent(fetcherFor([instance()], []));

			const ungraded = submission();
			ungraded.feedback.succeeded = false;

			const graded = submission();
			graded.feedback.results.report.overall.score = 91;

			// only interpretable submissions reach bestSubmission, exactly as sync() arranges
			const candidates = [await pair(graded)];
			expect(await interpret(ungraded), "setup: the bad one is not gradeable").to.be.null;

			const best = agent.bestSubmission(candidates);
			expect(best, "the graded attempt must still win").to.not.be.null;
			expect(best.interpretation.score).to.equal(91);
		});

		it("Should break a tie on the most recent attempt.", async function () {
			// two attempts with identical scores: the later one wins. This reverses the previous
			// behaviour (earliest won), and is what a student expects after resubmitting.
			const agent = new PrairieLearnAgent(fetcherFor([instance()], []));

			const earlier = submission();
			earlier.submission_id = "tieEarly";
			earlier.date = "2026-09-01T10:00:00Z";
			earlier.feedback.results.report.overall.score = 80;

			const later = submission();
			later.submission_id = "tieLate";
			later.date = "2026-09-02T10:00:00Z";
			later.feedback.results.report.overall.score = 80;

			// order in the list must not matter; the date decides
			expect(agent.bestSubmission([await pair(earlier), await pair(later)]).submission.submission_id).to.equal("tieLate");
			expect(agent.bestSubmission([await pair(later), await pair(earlier)]).submission.submission_id).to.equal("tieLate");
		});
	});

	describe("Explicit numeric score", function () {
		/**
		 * Builds one submission carrying a given bucket and (optionally) report.overall.score.
		 */
		function scored(bucket: string, score: number | null, id = "num1"): PLSubmission[] {
			const sub = JSON.parse(JSON.stringify(allBuckets[0]));
			sub.assessment_instance_id = id;
			sub.submission_id = "sub_" + id;
			sub.feedback.results.report.overall.bucket = bucket;
			sub.feedback.results.bucket = bucket;
			if (score !== null) {
				sub.feedback.results.report.overall.score = score;
			}
			return [sub];
		}

		it("Should use report.overall.score when present.", async function () {
			const inst = instance({ assessment_instance_id: "num1", assessment_label: DELIV_ID });
			await new PrairieLearnAgent(fetcherFor([inst], scored("developing", 87))).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			// the explicit number wins over the bucket score (developing would have been 75)
			expect(grade.score).to.equal(87);
			expect(grade.custom.bucket).to.equal("developing"); // bucket still recorded
			// displayScore is what the STUDENT sees, so it stays the band even when a number exists;
			// staff read grade.score instead (AdminGradesTab renders it, not displayScore)
			expect(grade.custom.displayScore).to.equal("developing");
		});

		it("Should accept a score of exactly 0.", async function () {
			const inst = instance({ assessment_instance_id: "num0", assessment_label: DELIV_ID });
			await new PrairieLearnAgent(fetcherFor([inst], scored("proficient", 0, "num0"))).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			// 0 is a real score, not "absent"; proficient would otherwise have mapped to 100
			expect(grade.score).to.equal(0);
			expect(grade.custom.displayScore, "the student still sees the band").to.equal("proficient");
		});

		it("Should keep displayScore as the band even when the grader reports a number.", async function () {
			// the rule this file used to encode was "show the number when there is one, otherwise the
			// bucket". That is now split by audience: displayScore is always the band (students see
			// it), and the number lives in score (staff see that, via AdminGradesTab).
			const inst = instance({ assessment_instance_id: "bandAlways", assessment_label: DELIV_ID });
			await new PrairieLearnAgent(fetcherFor([inst], scored("acquiring", 42, "bandAlways"))).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			expect(grade.score, "the number is preserved for staff").to.equal(42);
			expect(grade.custom.displayScore, "students see the band, not the number").to.equal("acquiring");
			expect(String(grade.custom.displayScore)).to.not.equal("42");
		});

		it("Should rank by the numeric score once any submission carries one.", async function () {
			const inst = instance({ assessment_instance_id: "numTie", assessment_label: DELIV_ID });
			const mk = (bucket: string, score: number, id: string) => {
				const sub = JSON.parse(JSON.stringify(allBuckets[0]));
				sub.assessment_instance_id = "numTie";
				sub.submission_id = id;
				sub.feedback.results.report.overall.bucket = bucket;
				sub.feedback.results.bucket = bucket;
				sub.feedback.results.report.overall.score = score;
				return sub;
			};
			// once the grader reports numbers, the number is what the student is graded on: a
			// "developing" worth 99 beats a "proficient" worth 80
			const subs = [mk("developing", 99, "a"), mk("proficient", 80, "b"), mk("proficient", 91, "c")];

			await new PrairieLearnAgent(fetcherFor([inst], subs)).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			expect(grade.score).to.equal(99);
			expect(grade.custom.bucket).to.equal("developing"); // the bucket of the winning attempt
			expect(grade.custom.displayScore, "displayScore follows the winning attempt's band").to.equal("developing");
		});
	});

	it("Should keep displayScore and score consistent for a lower bucket.", async function () {
		// guards against displayScore being hardcoded or copied from the wrong submission
		const inst = instance({ assessment_instance_id: "995", assessment_label: DELIV_ID });
		const only = JSON.parse(JSON.stringify(allBuckets))
			.filter((sub: any) => sub.feedback.results.report.overall.bucket === "acquiring")
			.map((sub: any) => Object.assign(sub, { assessment_instance_id: inst.assessment_instance_id }));

		await new PrairieLearnAgent(fetcherFor([inst], only)).sync(TestHarness.ADMIN1.id);

		const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
		expect(grade.custom.displayScore).to.equal("acquiring");
		expect(grade.score).to.equal(48); // acquiring, per the grader's own score
	});

	describe("when a course cannot interpret a payload", function () {
		/**
		 * A controller that throws for one nominated instance and behaves normally otherwise.
		 *
		 * interpretSubmission throwing is how a course says "this payload is recognisably wrong",
		 * as opposed to returning null for "not graded yet". The difference has to survive all the
		 * way out to the sync summary.
		 */
		function throwingFor(badInstanceId: string): any {
			const real = new CourseController(null);
			return {
				interpretSubmission: async (submission: any, deliv: any) => {
					if (submission?.assessment_instance_id === badInstanceId) {
						throw new Error("unrecognised grader payload");
					}
					return await real.interpretSubmission(submission, deliv);
				},
			};
		}

		it("Should fail only that instance, and keep syncing the rest.", async function () {
			const good = instance({ assessment_instance_id: "containGood", assessment_label: DELIV_ID });
			const bad = instance({ assessment_instance_id: "containBad", assessment_label: DELIV_ID });

			const subs = [
				Object.assign(JSON.parse(JSON.stringify(allBuckets[1])), { assessment_instance_id: "containGood" }),
				Object.assign(JSON.parse(JSON.stringify(allBuckets[1])), { assessment_instance_id: "containBad" }),
			];

			const agent = new PrairieLearnAgent(fetcherFor([good, bad], subs), throwingFor("containBad"));
			const summary = await agent.sync(TestHarness.ADMIN1.id);

			// the bad one is named, not silently swallowed
			expect(summary.instancesFailed).to.deep.equal(["containBad"]);

			// ...and the good one still got graded: one bad payload must not cost the class its sync
			expect(summary.instancesSynced, "the healthy instance still syncs").to.equal(1);
			expect(summary.gradesWritten).to.equal(1);
		});

		it("Should not watermark a failed instance, so the next run retries it.", async function () {
			// the point of failing loudly: fix the grader, re-sync, and it is picked up again. A
			// watermark would record the failure as if it had succeeded.
			const bad = instance({ assessment_instance_id: "containRetry", assessment_label: DELIV_ID });
			const subs = [Object.assign(JSON.parse(JSON.stringify(allBuckets[1])), { assessment_instance_id: "containRetry" })];

			const first = await new PrairieLearnAgent(fetcherFor([bad], subs), throwingFor("containRetry")).sync(TestHarness.ADMIN1.id);
			expect(first.instancesFailed).to.deep.equal(["containRetry"]);

			// now the course can read it; nothing about the instance itself changed
			const second = await new PrairieLearnAgent(fetcherFor([bad], subs)).sync(TestHarness.ADMIN1.id);

			expect(second.instancesSkipped, "a failed instance must not have been watermarked").to.equal(0);
			expect(second.gradesWritten, "so the retry grades it").to.equal(1);
		});
	});

	it("Should store one Result per submission, with the derived report and the raw one beside it.", async function () {
		const agent = new PrairieLearnAgent(fetcherFor([instance()], allBuckets));
		const summary = await agent.sync(TestHarness.ADMIN1.id);

		expect(summary.resultsWritten).to.equal(allBuckets.length);

		const results = await dc.getResults(DELIV_ID, "14492573");
		expect(results).to.have.length(allBuckets.length);

		// output.report is the DERIVED GradeReport -- the shape the admin views render. It is what
		// the course's interpretSubmission returned, not the grader's document.
		const report = (results[0].output as any).report;
		expect(report).to.not.be.null;
		expect(report.scoreOverall, "the views read scoreOverall; the grader's shape has no such field").to.be.a("number");
		expect(report.passNames).to.be.an("array");

		// ...and the grader's own document is archived beside it, so a later change to the mapping
		// can be re-derived from storage rather than re-fetched from PrairieLearn
		const raw = (results[0].output as any).custom.rawReport;
		expect(raw, "the raw grader report must be kept").to.not.be.null;
		expect(raw.overall.bucket).to.be.a("string");
		expect(raw.findings).to.be.an("array"); // the whole document, not just the value
	});

	it("Should be idempotent: syncing twice does not duplicate Results or Grades.", async function () {
		const agent = new PrairieLearnAgent(fetcherFor([instance()], allBuckets));
		await agent.sync(TestHarness.ADMIN1.id);

		const after1 = await dc.getResults(DELIV_ID, "14492573");

		// clear the watermark so the second run actually refetches rather than skipping
		const col = await dc.getCollection("jobWatermarks");
		await (col as any).deleteMany({});
		await agent.sync(TestHarness.ADMIN1.id);

		const after2 = await dc.getResults(DELIV_ID, "14492573");

		// exercises the upsert key, including the stable input.target.ref
		expect(after1.length).to.be.greaterThan(0); // guard: 0 === 0 would pass vacuously
		expect(after2.length).to.equal(after1.length);
	});

	it("Should skip an instance whose modified_at has not changed.", async function () {
		const calls: string[] = [];
		const agent = new PrairieLearnAgent(fetcherFor([instance()], allBuckets, calls));

		await agent.sync(TestHarness.ADMIN1.id);
		const firstCalls = calls.filter((c) => c.indexOf("/submissions") > 0).length;
		expect(firstCalls).to.equal(1);

		const second = await agent.sync(TestHarness.ADMIN1.id);
		const totalCalls = calls.filter((c) => c.indexOf("/submissions") > 0).length;

		// the whole point of the watermark: no refetch when nothing moved
		expect(totalCalls).to.equal(firstCalls);
		expect(second.instancesSkipped).to.equal(1);
		expect(second.instancesSynced).to.equal(0);
	});

	it("Should resync an instance whose modified_at advanced.", async function () {
		const calls: string[] = [];
		await new PrairieLearnAgent(fetcherFor([instance()], allBuckets, calls)).sync(TestHarness.ADMIN1.id);

		const moved = instance({ modified_at: "2026-08-22T09:00:00-07:00" });
		const summary = await new PrairieLearnAgent(fetcherFor([moved], allBuckets, calls)).sync(TestHarness.ADMIN1.id);

		expect(summary.instancesSynced).to.equal(1);
		expect(summary.instancesSkipped).to.equal(0);
	});

	it("Should record the enumeration-time modified_at, not a fetch-time value.", async function () {
		const modified = "2026-08-21T15:26:31-07:00";
		await new PrairieLearnAgent(fetcherFor([instance({ modified_at: modified })], allBuckets)).sync(TestHarness.ADMIN1.id);

		const mark = await dc.getJobWatermark<PrairieLearnWatermark>("prairielearn-sync", "14492573");
		expect(mark).to.not.be.null;
		// storing anything else opens a window where a concurrent submission is silently skipped
		expect(mark.modifiedAt).to.equal(modified);
		expect(mark.submissionCount).to.equal(allBuckets.length);
	});

	it("Should write no grade when there are no usable submissions.", async function () {
		await new GradesController().saveGrade({
			personId: TestHarness.REALUSER1.id,
			delivId: "LA_NOSUB",
			score: -1,
			comment: "sentinel",
			timestamp: 0,
			urlName: null,
			URL: null,
			custom: {},
		});

		const inst = instance({ assessment_instance_id: "999", assessment_label: "LA_NOSUB" });
		const summary = await new PrairieLearnAgent(fetcherFor([inst], [])).sync(TestHarness.ADMIN1.id);

		expect(summary.gradesWritten).to.equal(0);
		expect(summary.instancesSynced).to.equal(1); // watermarked, so we do not refetch forever

		// "did not attempt" must never become a zero
		const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, "LA_NOSUB");
		expect(grade.score).to.equal(-1); // untouched sentinel
	});

	it("Should skip submissions whose grading job did not succeed.", async function () {
		const failed = JSON.parse(JSON.stringify(allBuckets.slice(0, 1)));
		failed[0].feedback.succeeded = false;

		const inst = instance({ assessment_instance_id: "998", assessment_label: "LA_FAILED" });
		const summary = await new PrairieLearnAgent(fetcherFor([inst], failed)).sync(TestHarness.ADMIN1.id);

		// a failed grading run is not a score of "beginning"
		expect(summary.gradesWritten).to.equal(0);
		expect(summary.resultsWritten).to.equal(0);
	});

	it("Should sync a staff attempt, not skip it.", async function () {
		// NOTE: this used to assert the opposite. The agent skipped any user_role other than
		// "Student" because "staff attempts are not grades", but staff do real PrairieLearn work and
		// those grades are wanted when checking a grade sheet. The join to a Classy person is now
		// the only filter.
		// the submissions must carry this instance's id, or the fetcher returns none and the sync
		// writes nothing regardless of role -- which is why the previous version of this test passed
		// whether or not the role filter existed
		const staff = instance({ assessment_instance_id: "997", user_role: "Staff" });
		const subs = allBuckets.map((sub: any) => Object.assign({}, sub, { assessment_instance_id: "997" }));
		const summary = await new PrairieLearnAgent(fetcherFor([staff], subs)).sync(TestHarness.ADMIN1.id);

		expect(summary.instancesSeen).to.equal(1);
		expect(summary.instancesSynced).to.equal(1);
		expect(summary.gradesWritten).to.equal(1);
	});

	it("Should report unmatched uids instead of dropping them silently.", async function () {
		const unknown = instance({ assessment_instance_id: "996", user_uid: "nosuchperson@ubc.ca" });
		const summary = await new PrairieLearnAgent(fetcherFor([unknown], allBuckets)).sync(TestHarness.ADMIN1.id);

		// a systematic mismatch (wrong join field, wrong domain) otherwise looks exactly like
		// "no students have submitted yet"
		expect(summary.unmatchedUids).to.contain("nosuchperson@ubc.ca");
		expect(summary.gradesWritten).to.equal(0);
	});

	it("Should auto-create a missing deliverable with grades unreleased.", async function () {
		const dcon = new DeliverablesController();
		const existing = await dcon.getDeliverable(DELIV_ID);
		if (existing !== null) {
			await dc.deleteDeliverable(existing);
		}

		const summary = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);
		expect(summary.deliverablesCreated).to.contain(DELIV_ID);

		const created = await dcon.getDeliverable(DELIV_ID);
		expect(created).to.not.be.null;
		expect(created.gradesReleased).to.be.false; // never expose on creation
		expect(created.visibleToStudents).to.be.false;
		expect(created.shouldProvision).to.be.false; // no repos involved

		// sensible dates, not the 1969 epoch: open at the start of term, close far enough out that
		// the close-date gating does not silently drop attempts before a real date is set
		expect(created.openTimestamp).to.equal(Date.parse("2026-09-01T00:00:00-07:00"));
		expect(created.closeTimestamp).to.equal(Date.parse("2035-12-31T18:00:00-08:00"));
		expect(created.openTimestamp).to.be.lessThan(created.closeTimestamp);
	});

	it("Should not overwrite an existing deliverable.", async function () {
		const dcon = new DeliverablesController();
		const deliv = await dcon.getDeliverable(DELIV_ID);
		deliv.gradesReleased = true; // a course-made customisation
		await dcon.saveDeliverable(deliv);

		const summary = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);
		expect(summary.deliverablesCreated).to.not.contain(DELIV_ID);

		const after = await dcon.getDeliverable(DELIV_ID);
		expect(after.gradesReleased).to.be.true; // the sync must not stomp it
	});

	describe("Deliverable close date", function () {
		/**
		 * The all-buckets fixture is chronological: beginning, proficient, developing, acquiring at
		 * 15:20, 15:21, 15:22, 15:23. Setting the close date between them selects a prefix.
		 */
		const T = (hhmm: string) => Date.parse("2026-08-21T" + hhmm + ":00-07:00");

		async function setClose(close: number): Promise<void> {
			const dcon = new DeliverablesController();
			let deliv = await dcon.getDeliverable(DELIV_ID);
			if (deliv === null) {
				await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);
				deliv = await dcon.getDeliverable(DELIV_ID);
			}
			deliv.closeTimestamp = close;
			await dcon.saveDeliverable(deliv);
			const col = await dc.getCollection("jobWatermarks");
			await (col as any).deleteMany({});
		}

		it("Should ignore submissions made after the deliverable closed.", async function () {
			// closes at 15:21:30, so only "beginning" (15:20) and "proficient" (15:21) count
			await setClose(T("15:21") + 30000);

			const summary = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);
			Log.test("PrairieLearnAgent - after close: " + summary.submissionsAfterClose);

			expect(summary.submissionsAfterClose).to.equal(2); // developing + acquiring
			expect(summary.gradesWritten).to.equal(1);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			expect(grade.custom.bucket).to.equal("proficient"); // best ON-TIME attempt
			expect(grade.score).to.equal(97.5); // the best ON-TIME attempt's own score
		});

		it("Should grade the best on-time attempt even when a later one scored higher.", async function () {
			// closes at 15:20:30, so only "beginning" (15:20) counts; proficient arrived later
			await setClose(T("15:20") + 30000);

			const summary = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);
			expect(summary.submissionsAfterClose).to.equal(3);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			// the student did reach proficient, but not before the deadline
			expect(grade.custom.bucket).to.equal("beginning");
			expect(grade.score).to.equal(12.5); // beginning: the grader's score, not a rubric's zero
		});

		it("Should write no grade when every attempt was after the close date.", async function () {
			await setClose(T("15:00")); // before any submission

			const summary = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);

			expect(summary.submissionsAfterClose).to.equal(allBuckets.length);
			expect(summary.gradesWritten).to.equal(0);
			// late work is not a zero, just as "did not attempt" is not a zero
			expect(summary.instancesSynced).to.equal(1); // still watermarked, so we do not refetch
		});

		it("Should still archive Results for late submissions.", async function () {
			await setClose(T("15:00"));

			const summary = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);

			// the grade is gated, but the record of what happened is not: Results are the archive
			expect(summary.resultsWritten).to.equal(allBuckets.length);
			const results = await dc.getResults(DELIV_ID, "14492573");
			expect(results.length).to.equal(allBuckets.length);
		});

		it("Should gate on the attempt time, not the sync time.", async function () {
			// closed long ago, but the attempts predate it: syncing today must still grade them
			await setClose(T("23:59"));

			const summary = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);

			expect(summary.submissionsAfterClose).to.equal(0);
			expect(summary.gradesWritten).to.equal(1);
		});

		it("Should resync when the close date changes, even though modified_at did not.", async function () {
			await setClose(T("15:00")); // nothing counts
			const first = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);
			expect(first.gradesWritten).to.equal(0);

			// extend the deadline; PrairieLearn's modified_at is unchanged, so a modified_at-only
			// watermark would skip this instance forever and the grade would never appear
			const dcon = new DeliverablesController();
			const deliv = await dcon.getDeliverable(DELIV_ID);
			deliv.closeTimestamp = T("23:59");
			await dcon.saveDeliverable(deliv);

			const second = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);
			expect(second.instancesSkipped).to.equal(0);
			expect(second.gradesWritten).to.equal(1);
		});

		after(async function () {
			// leave the deliverable open so later specs are unaffected
			const dcon = new DeliverablesController();
			const deliv = await dcon.getDeliverable(DELIV_ID);
			if (deliv !== null) {
				deliv.closeTimestamp = Number.MAX_SAFE_INTEGER;
				await dcon.saveDeliverable(deliv);
			}
		});
	});

	it("Should stop between instances when cancelled.", async function () {
		const many: PLAssessmentInstance[] = [];
		for (let i = 0; i < 12; i++) {
			many.push(instance({ assessment_instance_id: "cancel" + i, modified_at: "2026-08-2" + i + "T00:00:00-07:00" }));
		}
		const subs: PLSubmission[] = [];
		for (const inst of many) {
			const s = JSON.parse(JSON.stringify(allBuckets[0]));
			s.assessment_instance_id = inst.assessment_instance_id;
			s.submission_id = "sub_" + inst.assessment_instance_id;
			subs.push(s);
		}

		let cancelled = false;
		const ctx = {
			isCancelled: () => cancelled,
			progress: async () => {
				return;
			},
			error: async () => {
				return;
			},
		};

		const agent = new PrairieLearnAgent(async (path: string) => {
			if (path === "/assessments") {
				return assessments();
			}
			if (path.indexOf("/assessments/") === 0) {
				return many;
			}
			cancelled = true; // trip cancellation as soon as the first instance is fetched
			const id = path.split("/")[2];
			return subs.filter((s) => s.assessment_instance_id === id);
		});

		const summary = await agent.sync(TestHarness.ADMIN1.id, ctx);

		Log.test("PrairieLearnAgent - synced " + summary.instancesSynced + " of " + many.length + " before cancelling");
		expect(summary.cancelled).to.be.true;
		expect(summary.instancesSynced).to.be.lessThan(many.length);
		expect(summary.instancesSynced).to.be.greaterThan(0); // work already started still finished
	});

	it("Should resume after a cancelled run rather than restarting.", async function () {
		const insts = [instance({ assessment_instance_id: "resume1" }), instance({ assessment_instance_id: "resume2" })];
		const subs = insts.map((inst) => {
			const s = JSON.parse(JSON.stringify(allBuckets[0]));
			s.assessment_instance_id = inst.assessment_instance_id;
			s.submission_id = "sub_" + inst.assessment_instance_id;
			return s;
		});

		// first pass: sync only the first instance
		await new PrairieLearnAgent(fetcherFor([insts[0]], subs)).sync(TestHarness.ADMIN1.id);

		// second pass sees both; the already-synced one is skipped
		const calls: string[] = [];
		const summary = await new PrairieLearnAgent(fetcherFor(insts, subs, calls)).sync(TestHarness.ADMIN1.id);

		expect(summary.instancesSkipped).to.equal(1);
		expect(summary.instancesSynced).to.equal(1);
		expect(calls.filter((c) => c.indexOf("/submissions") > 0)).to.have.length(1);
	});
});
