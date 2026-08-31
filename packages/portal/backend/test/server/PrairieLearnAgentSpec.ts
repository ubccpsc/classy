import { expect } from "chai";
import "mocha";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import "@common/GlobalSpec";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GradesController } from "@backend/controllers/GradesController";
import {
	BUCKET_SCORE,
	PLAssessment,
	PLAssessmentInstance,
	PLSubmission,
	PrairieLearnAgent,
	PrairieLearnWatermark,
} from "@backend/server/common/PrairieLearnAgent";
import { Person } from "@backend/Types";

import * as fs from "fs";

/**
 * Tests for the PrairieLearn grade connector.
 *
 * NOTE: no network. The agent takes an injectable fetcher, so the whole sync runs against responses
 * captured from the live course instance (test/data/prairieLearn*.json, scrubbed of identities and
 * submitted code). The repo declares no mocking library, and this avoids needing one.
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

	it("Should take the best-ever bucket, not the most recent one.", async function () {
		const agent = new PrairieLearnAgent(fetcherFor([instance()], allBuckets));
		const summary = await agent.sync(TestHarness.ADMIN1.id);

		Log.test("PrairieLearnAgent - summary: " + JSON.stringify(summary));
		expect(summary.gradesWritten).to.equal(1);

		// the fixture is beginning -> proficient -> developing -> acquiring, i.e. a student who
		// peaked then regressed. Taking the latest submission would score 55, not 100.
		const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
		expect(grade).to.not.be.null;
		expect(grade.score).to.equal(100);
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
		expect(grade.score).to.equal(100);

		// the two are consistent by construction
		expect(BUCKET_SCORE[grade.custom.displayScore]).to.equal(grade.score);
	});

	describe("Submissions that carry no usable bucket", function () {
		// NOTE: PrairieLearn returns every submission, including ones the grader never finished and
		// ones from a grader version that reported nothing useful. Those must be skipped rather than
		// scored, and skipping them must not hide the attempts that *are* gradeable.
		function submission(): any {
			return JSON.parse(JSON.stringify(allBuckets[0]));
		}

		it("Should ignore a submission whose grader did not succeed.", function () {
			const agent = new PrairieLearnAgent(fetcherFor([instance()], []));
			const sub = submission();
			sub.feedback.succeeded = false;

			expect(agent.bucketOf(sub), "a failed grading run has no bucket to report").to.be.null;
			expect(agent.bestSubmission([sub]), "and cannot be anyone's best attempt").to.be.null;
		});

		it("Should ignore a submission with no feedback at all.", function () {
			const agent = new PrairieLearnAgent(fetcherFor([instance()], []));
			const sub = submission();
			sub.feedback = null;

			expect(agent.bucketOf(sub)).to.be.null;
		});

		it("Should ignore a submission whose report carries no bucket.", function () {
			const agent = new PrairieLearnAgent(fetcherFor([instance()], []));
			const sub = submission();
			delete sub.feedback.results.report.overall.bucket;

			expect(agent.bucketOf(sub)).to.be.null;
		});

		it("Should still find the best attempt among a mix of graded and ungraded ones.", function () {
			// the case that matters: one bad submission must not cost a student their real grade
			const agent = new PrairieLearnAgent(fetcherFor([instance()], []));
			const ungraded = submission();
			ungraded.feedback.succeeded = false;

			const graded = submission();
			graded.feedback.results.report.overall.bucket = "proficient";

			const best = agent.bestSubmission([ungraded, graded, ungraded]);
			expect(best, "the graded attempt must still win").to.not.be.null;
			expect(best.bucket).to.equal("proficient");
		});

		it("Should prefer the report bucket when the envelope disagrees.", function () {
			// the two come from different parts of the grader output; if they disagree the report is
			// the one the student was actually graded on, and the mismatch is logged
			const agent = new PrairieLearnAgent(fetcherFor([instance()], []));
			const sub = submission();
			sub.feedback.results.report.overall.bucket = "developing";
			sub.feedback.results.bucket = "beginning";

			expect(agent.bucketOf(sub)).to.equal("developing");
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
			expect(grade.custom.displayScore).to.equal("87");
			expect(grade.custom.bucket).to.equal("developing"); // bucket still recorded
		});

		it("Should accept a score of exactly 0.", async function () {
			const inst = instance({ assessment_instance_id: "num0", assessment_label: DELIV_ID });
			await new PrairieLearnAgent(fetcherFor([inst], scored("proficient", 0, "num0"))).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			// 0 is a real score, not "absent"; proficient would otherwise have mapped to 100
			expect(grade.score).to.equal(0);
			expect(grade.custom.displayScore).to.equal("0");
		});

		it("Should fall back to the bucket score when the field is absent.", async function () {
			const inst = instance({ assessment_instance_id: "numNone", assessment_label: DELIV_ID });
			await new PrairieLearnAgent(fetcherFor([inst], scored("developing", null, "numNone"))).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			expect(grade.score).to.equal(75); // BUCKET_SCORE.developing
			expect(grade.custom.displayScore).to.equal("developing");
		});

		it("Should ignore a negative score and fall back to the bucket.", async function () {
			const inst = instance({ assessment_instance_id: "numNeg", assessment_label: DELIV_ID });
			await new PrairieLearnAgent(fetcherFor([inst], scored("acquiring", -1, "numNeg"))).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			// negative is how graders signal "no score"; it must not become the grade
			expect(grade.score).to.equal(55); // BUCKET_SCORE.acquiring
			expect(grade.custom.displayScore).to.equal("acquiring");
		});

		it("Should never read results.score, which is the always-zero display value.", async function () {
			const subs = scored("proficient", null, "numIgnore");
			subs[0].feedback.results.score = 0.0533; // the value PrairieLearn shows the student

			const inst = instance({ assessment_instance_id: "numIgnore", assessment_label: DELIV_ID });
			await new PrairieLearnAgent(fetcherFor([inst], subs)).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			expect(grade.score).to.equal(100); // the bucket, not 0.0533
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
			expect(grade.custom.displayScore).to.equal("99");
			expect(grade.custom.bucket).to.equal("developing"); // the bucket of the winning attempt
		});

		it("Should rank by bucket when no submission carries a score.", async function () {
			const inst = instance({ assessment_instance_id: "numNoneRank", assessment_label: DELIV_ID });
			const mk = (bucket: string, id: string) => {
				const sub = JSON.parse(JSON.stringify(allBuckets[0]));
				sub.assessment_instance_id = "numNoneRank";
				sub.submission_id = id;
				sub.feedback.results.report.overall.bucket = bucket;
				sub.feedback.results.bucket = bucket;
				delete sub.feedback.results.report.overall.score;
				return sub;
			};
			const subs = [mk("beginning", "a"), mk("proficient", "b"), mk("acquiring", "c")];

			await new PrairieLearnAgent(fetcherFor([inst], subs)).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			// unchanged behaviour for a bucket-only deliverable
			expect(grade.custom.bucket).to.equal("proficient");
			expect(grade.score).to.equal(100);
			expect(grade.custom.displayScore).to.equal("proficient");
		});

		it("Should compare a scored attempt against an unscored one by bucket score.", async function () {
			const inst = instance({ assessment_instance_id: "numMixed", assessment_label: DELIV_ID });
			const mk = (bucket: string, score: number | null, id: string) => {
				const sub = JSON.parse(JSON.stringify(allBuckets[0]));
				sub.assessment_instance_id = "numMixed";
				sub.submission_id = id;
				sub.feedback.results.report.overall.bucket = bucket;
				sub.feedback.results.bucket = bucket;
				if (score === null) {
					delete sub.feedback.results.report.overall.score;
				} else {
					sub.feedback.results.report.overall.score = score;
				}
				return sub;
			};
			// a grader that starts reporting numbers mid-term leaves mixed history; the unscored
			// attempt still competes, using its bucket score (proficient = 100) as its value
			const subs = [mk("proficient", null, "a"), mk("developing", 80, "b")];

			await new PrairieLearnAgent(fetcherFor([inst], subs)).sync(TestHarness.ADMIN1.id);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			expect(grade.score).to.equal(100);
			expect(grade.custom.displayScore).to.equal("proficient"); // the winner had no number
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
		expect(grade.score).to.equal(55);
	});

	it("Should store one Result per submission, with the full feedback report.", async function () {
		const agent = new PrairieLearnAgent(fetcherFor([instance()], allBuckets));
		const summary = await agent.sync(TestHarness.ADMIN1.id);

		expect(summary.resultsWritten).to.equal(allBuckets.length);

		const results = await dc.getResults(DELIV_ID, "14492573");
		expect(results).to.have.length(allBuckets.length);

		const report = (results[0].output as any).report;
		expect(report).to.not.be.null;
		expect(report.overall.bucket).to.be.a("string");
		expect(report.findings).to.be.an("array"); // the whole document, not just the value
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

	it("Should throw on an unknown bucket rather than scoring it 0.", async function () {
		const bad = JSON.parse(JSON.stringify(allBuckets.slice(0, 1)));
		bad[0].feedback.results.report.overall.bucket = "mastery"; // a bucket we do not know
		bad[0].feedback.results.bucket = "mastery";

		let ex = null;
		try {
			await new PrairieLearnAgent(fetcherFor([instance()], bad)).sync(TestHarness.ADMIN1.id);
		} catch (err) {
			ex = err;
		}

		// defaulting to 0 would silently zero the strongest students, and because PrairieLearn shows
		// 0 to everyone anyway, nothing would look wrong
		expect(ex).to.not.be.null;
		expect(ex.message).to.contain("Unknown PrairieLearn bucket");
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

	it("Should skip staff attempts.", async function () {
		const staff = instance({ assessment_instance_id: "997", user_role: "Staff" });
		const summary = await new PrairieLearnAgent(fetcherFor([staff], allBuckets)).sync(TestHarness.ADMIN1.id);

		expect(summary.instancesSeen).to.equal(1);
		expect(summary.instancesSynced).to.equal(0);
		expect(summary.gradesWritten).to.equal(0);
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
			expect(grade.score).to.equal(100);
		});

		it("Should grade the best on-time attempt even when a later one scored higher.", async function () {
			// closes at 15:20:30, so only "beginning" (15:20) counts; proficient arrived later
			await setClose(T("15:20") + 30000);

			const summary = await new PrairieLearnAgent(fetcherFor([instance()], allBuckets)).sync(TestHarness.ADMIN1.id);
			expect(summary.submissionsAfterClose).to.equal(3);

			const grade = await new GradesController().getGrade(TestHarness.REALUSER1.id, DELIV_ID);
			// the student did reach proficient, but not before the deadline
			expect(grade.custom.bucket).to.equal("beginning");
			expect(grade.score).to.equal(0);
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
