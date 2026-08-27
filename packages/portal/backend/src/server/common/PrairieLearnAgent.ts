import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GradesController } from "@backend/controllers/GradesController";
import { JobContext } from "@backend/controllers/JobController";
import { AuditLabel, Deliverable, Grade, JobWatermark, Person, Result } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import Util from "@common/Util";
import fetch, { RequestInit } from "node-fetch";

/**
 * The grading buckets, in ascending order. Index is rank; BUCKET_SCORE is the Classy grade.
 *
 * NOTE: the external grader deliberately returns ~0 to every student for every submission, so
 * PrairieLearn's own score / points / score_perc carry no information. The bucket is the grade.
 */
export const BUCKETS: string[] = ["beginning", "acquiring", "developing", "proficient"];

export const BUCKET_SCORE: { [bucket: string]: number } = {
	beginning: 0,
	acquiring: 55,
	developing: 75,
	proficient: 100,
};

/**
 * Just the parts of the PrairieLearn payloads this connector reads. These are not exhaustive; the
 * responses carry far more (see docs/developer/prairielearn-connector-plan.md).
 */
export interface PLAssessment {
	assessment_id: string;
	assessment_label: string; // e.g. "LA1"; this is the Classy delivId
	assessment_name: string; // the tid, e.g. "lecture/lec01"
	title: string;
}

export interface PLAssessmentInstance {
	assessment_instance_id: string;
	assessment_label: string;
	user_uid: string; // "<cwl>@ubc.ca"
	user_role: string; // "Student" | "Staff"
	modified_at: string; // the incremental key
}

export interface PLSubmission {
	submission_id: string;
	assessment_instance_id: string;
	date: string;
	feedback: any; // { succeeded, job_id, results: { report: { overall: { bucket } } } }
}

/**
 * The PrairieLearn sync's watermark row.
 *
 * `key` is the assessment_instance_id. The two extra fields are the change-detection axes; both must
 * match for an instance to be considered unchanged:
 *   modifiedAt      what PrairieLearn last reported for the instance
 *   closeTimestamp  the Deliverable.closeTimestamp it was evaluated against
 *
 * NOTE: closeTimestamp is part of change detection, not just a record. Extending or tightening a
 * deliverable's close date changes which submissions count but does NOT change PrairieLearn's
 * modified_at, so without it a deadline change would never be picked up and the affected grades
 * would silently never appear.
 */
export interface PrairieLearnWatermark extends JobWatermark {
	delivId: string;
	modifiedAt: string;
	closeTimestamp: number;
	submissionCount: number;
}

/**
 * What a sync run did; stored as Job.summary and rendered in the admin UI.
 */
export interface PLSyncSummary {
	instancesSeen: number;
	instancesSynced: number;
	instancesSkipped: number; // unchanged since the last sync
	gradesWritten: number;
	resultsWritten: number;
	deliverablesCreated: string[];
	submissionsAfterClose: number; // attempts made after the deliverable closed; see syncInstance()
	unmatchedUids: string[]; // see NOTE in resolvePeople(); a systematic mismatch shows up here
	cancelled: boolean;
}

/**
 * A minimal fetch, so specs can drive the whole agent without a network or a mocking library.
 *
 * NOTE: the repo declares neither nock nor sinon, and ClasslistAgentSpec sidesteps the problem by
 * never exercising fetchClasslist at all. Injecting the fetcher lets the sync logic be tested end to
 * end against captured fixtures instead.
 */
export type PLFetcher = (path: string) => Promise<any>;

export class PrairieLearnAgent {
	/**
	 * Whether to persist the student's submitted source alongside the grading report.
	 *
	 * Set to false to stop persisting student code. Reports are unaffected; only
	 * output.custom.submittedFiles is dropped. NOTE: this stops *new* writes only -- documents that
	 * already carry files keep them until a cleanup script removes them.
	 */
	private static readonly PERSIST_SUBMITTED_FILES = true;

	/**
	 * How many instances to fetch at once. PrairieLearn publishes no rate limits and none appear in
	 * its source, so this is deliberately modest.
	 */
	private static readonly CONCURRENCY = 8;

	/**
	 * Result.input.target.ref is part of the key writeResult upserts on
	 * (delivId, repoId, commitSHA, ref). It MUST be stable across runs: if it varies, re-running
	 * creates duplicates instead of updating.
	 */
	private static readonly RESULT_REF = "prairielearn";

	/**
	 * The `kind` this agent's watermark rows are stored under, in the shared jobWatermarks
	 * collection. Matches the job kind registered in BackendServer.
	 */
	private static readonly WATERMARK_KIND = "prairielearn-sync";

	private readonly fetcher: PLFetcher;

	private db: DatabaseController = DatabaseController.getInstance();

	public constructor(fetcher?: PLFetcher) {
		this.fetcher = typeof fetcher === "undefined" ? this.defaultFetcher.bind(this) : fetcher;
	}

	/**
	 * Whether PrairieLearn is configured for this deployment.
	 *
	 * NOTE: uses hasProp, not getProp: getProp logs two ERROR lines for a missing key, so probing an
	 * optional feature with it would fill the log with false alarms. hasProp only tests for
	 * undefined, so a blank value in .env would pass it -- hence the emptiness check too.
	 *
	 * @returns {boolean}
	 */
	public static isConfigured(): boolean {
		const c = Config.getInstance();
		const required = [ConfigKey.prairieLearnUrl, ConfigKey.prairieLearnToken, ConfigKey.prairieLearnCourseInstanceId];
		for (const key of required) {
			if (c.hasProp(key) === false) {
				return false;
			}
			const val = c.getProp(key);
			if (val === null || String(val).trim() === "") {
				return false;
			}
		}
		return true;
	}

	public async fetchAssessments(): Promise<PLAssessment[]> {
		return (await this.fetcher("/assessments")) as PLAssessment[];
	}

	public async fetchInstances(assessmentId: string): Promise<PLAssessmentInstance[]> {
		return (await this.fetcher("/assessments/" + assessmentId + "/assessment_instances")) as PLAssessmentInstance[];
	}

	public async fetchSubmissions(assessmentInstanceId: string): Promise<PLSubmission[]> {
		return (await this.fetcher("/assessment_instances/" + assessmentInstanceId + "/submissions")) as PLSubmission[];
	}

	/**
	 * Pulls grades for every mapped assessment.
	 *
	 * @param requesterId Person.id, for the audit record
	 * @param ctx job context; progress and cancellation
	 * @returns {Promise<PLSyncSummary>}
	 */
	public async sync(requesterId: string, ctx?: JobContext): Promise<PLSyncSummary> {
		const start = Date.now();
		Log.info("PrairieLearnAgent::sync( " + requesterId + " ) - start");

		if (PrairieLearnAgent.isConfigured() === false) {
			throw new Error("PrairieLearn is not configured; set PRAIRIELEARN_* in .env");
		}

		const summary: PLSyncSummary = {
			instancesSeen: 0,
			instancesSynced: 0,
			instancesSkipped: 0,
			gradesWritten: 0,
			resultsWritten: 0,
			deliverablesCreated: [],
			submissionsAfterClose: 0,
			unmatchedUids: [],
			cancelled: false,
		};

		const assessments = await this.fetchAssessments();
		Log.info("PrairieLearnAgent::sync(..) - assessments: " + assessments.length);

		await this.ensureDeliverables(assessments, summary);

		// deliverables are needed during enumeration too: a changed close date makes an otherwise
		// unchanged instance eligible for resync
		const deliverables = await this.resolveDeliverables();

		// enumerate; this is the only place modified_at is exposed
		const pending: PLAssessmentInstance[] = [];
		for (const assessment of assessments) {
			const instances = await this.fetchInstances(assessment.assessment_id);
			for (const instance of instances) {
				summary.instancesSeen++;
				if (instance.user_role !== "Student") {
					continue; // staff attempts are not grades
				}
				const close = deliverables.get(instance.assessment_label)?.closeTimestamp ?? Number.MAX_SAFE_INTEGER;
				if ((await this.isUnchanged(instance, close)) === true) {
					summary.instancesSkipped++;
					continue;
				}
				pending.push(instance);
			}
		}
		Log.info("PrairieLearnAgent::sync(..) - instances to sync: " + pending.length + " of " + summary.instancesSeen);

		const people = await this.resolvePeople();

		let done = 0;
		await Util.processConcurrently(pending, PrairieLearnAgent.CONCURRENCY, async (instance: PLAssessmentInstance) => {
			// NOTE: checked BEFORE the unit of work starts, never part-way through it. Everything
			// already in flight completes; only the next instance is skipped.
			if (typeof ctx !== "undefined" && ctx.isCancelled() === true) {
				summary.cancelled = true;
				return false;
			}

			await this.syncInstance(instance, people, deliverables, summary, ctx);

			done++;
			if (typeof ctx !== "undefined" && done % 25 === 0) {
				await ctx.progress(done, pending.length, "syncing PrairieLearn submissions");
			}
			return true;
		});

		await this.db.writeAudit(
			AuditLabel.GRADE_ADMIN,
			requesterId,
			{},
			{},
			{
				source: "prairielearn",
				grades: summary.gradesWritten,
			}
		);

		Log.info(
			"PrairieLearnAgent::sync(..) - done; synced: " +
				summary.instancesSynced +
				"; grades: " +
				summary.gradesWritten +
				"; took: " +
				Util.took(start)
		);
		return summary;
	}

	/**
	 * Fetches and stores one assessment instance.
	 */
	private async syncInstance(
		instance: PLAssessmentInstance,
		people: Map<string, Person>,
		deliverables: Map<string, Deliverable>,
		summary: PLSyncSummary,
		ctx?: JobContext
	): Promise<void> {
		const cwl = this.uidToCwl(instance.user_uid);
		const person = people.get(cwl);
		if (typeof person === "undefined") {
			// NOTE: reported, never silently dropped. A systematic mismatch (wrong join field, wrong
			// uid domain) otherwise looks exactly like "no students have submitted yet".
			if (summary.unmatchedUids.indexOf(instance.user_uid) === -1) {
				summary.unmatchedUids.push(instance.user_uid);
			}
			return;
		}

		const deliv = deliverables.get(instance.assessment_label);
		const closeTimestamp = deliv?.closeTimestamp ?? Number.MAX_SAFE_INTEGER;

		const submissions = await this.fetchSubmissions(instance.assessment_instance_id);
		const graded = this.gradedSubmissions(submissions, ctx);

		// NOTE: every graded submission is stored as a Result, including late ones. The Results are
		// the analysis archive and should record what actually happened; only the *grade* is gated.
		for (const submission of graded) {
			await this.writeResultFor(instance, submission, person);
			summary.resultsWritten++;
		}

		// NOTE: gated on when the attempt was made, NOT on when the sync ran. Syncing late must not
		// change anyone's grade, and re-syncing must be idempotent -- both of which would break if
		// this compared against Date.now().
		const onTime = graded.filter((sub) => this.attemptedAt(sub) <= closeTimestamp);
		summary.submissionsAfterClose += graded.length - onTime.length;

		if (onTime.length === 0) {
			// nothing gradeable: either no usable submission at all, or everything arrived after the
			// deliverable closed. Record the watermark so we do not refetch, but write NO grade --
			// a missing grade is not a zero, and late work is not a zero either.
			//
			// NOTE: this does not *remove* a grade written by an earlier sync. If a close date is
			// tightened after grades exist, previously-synced grades stay; deleting them
			// automatically would be a destructive side effect of a routine sync.
			await this.markSynced(instance, closeTimestamp, graded.length);
			summary.instancesSynced++;
			return;
		}

		const best = this.bestSubmission(onTime);
		await this.writeGradeFor(instance, best.submission, best.bucket, person);
		summary.gradesWritten++;

		await this.markSynced(instance, closeTimestamp, graded.length);
		summary.instancesSynced++;
	}

	/**
	 * When the attempt was made, from the submission itself.
	 *
	 * @param submission
	 * @returns {number} epoch ms; 0 if the date is unparseable, so a bad date is treated as very
	 * early rather than accidentally counting as on time
	 */
	private attemptedAt(submission: PLSubmission): number {
		const t = Date.parse(submission?.date);
		return Number.isNaN(t) ? 0 : t;
	}

	/**
	 * Submissions that actually carry a grading result.
	 *
	 * Skips submissions whose grading job did not succeed or that carry no report: those are pending
	 * or broken runs, NOT a score of "beginning".
	 */
	private gradedSubmissions(submissions: PLSubmission[], ctx?: JobContext): PLSubmission[] {
		const out: PLSubmission[] = [];
		for (const s of submissions) {
			const bucket = this.bucketOf(s);
			if (bucket === null) {
				continue;
			}
			out.push(s);
			void ctx; // reserved: per-submission reporting if this ever needs it
		}
		return out;
	}

	/**
	 * The bucket for a submission, or null if it has no usable result.
	 *
	 * NOTE: prefers report.overall.bucket over the duplicate at results.bucket. If they disagree the
	 * report and its envelope came from different grader versions, which is worth knowing about.
	 */
	public bucketOf(submission: PLSubmission): string | null {
		const feedback = submission?.feedback;
		if (typeof feedback === "undefined" || feedback === null || feedback.succeeded !== true) {
			return null;
		}
		const results = feedback.results;
		const bucket = results?.report?.overall?.bucket;
		if (typeof bucket !== "string" || bucket === "") {
			return null;
		}
		if (typeof results.bucket === "string" && results.bucket !== bucket) {
			Log.warn(
				"PrairieLearnAgent::bucketOf(..) - report/envelope bucket mismatch; submission: " +
					submission.submission_id +
					"; report: " +
					bucket +
					"; envelope: " +
					results.bucket
			);
		}
		return bucket;
	}

	/**
	 * The explicit numeric grade a submission reports, if it has one.
	 *
	 * NOTE: this is report.overall.score, NOT results.score. results.score is the value PrairieLearn
	 * shows the student and is deliberately pinned near zero (see the plan's bucket-encoding
	 * section), so it carries no grade information and must never be read as one.
	 *
	 * A grader that can state a real number does so here; graders that only bucket omit it, and the
	 * bucket score is used instead.
	 *
	 * @param submission
	 * @returns {number | null} null when absent, negative, or not a finite number
	 */
	public scoreOf(submission: PLSubmission): number | null {
		const raw = submission?.feedback?.results?.report?.overall?.score;
		if (typeof raw !== "number" || Number.isFinite(raw) === false) {
			return null;
		}
		// negative is how graders signal "no score here" (AutoTest uses -1 the same way)
		if (raw < 0) {
			return null;
		}
		return raw;
	}

	/**
	 * The score a submission counts as when ranking attempts against each other.
	 *
	 * Explicit report.overall.score when the grader reported one, otherwise the bucket's score.
	 * Because BUCKET_SCORE is strictly increasing across BUCKETS (0 / 55 / 75 / 100), ranking by
	 * this value is IDENTICAL to ranking by bucket when no submission carries an explicit score --
	 * so one rule covers both a bucket-only deliverable and one where the grader reports numbers.
	 *
	 * @param submission
	 * @returns {number} null only if the submission carries no usable bucket
	 */
	private effectiveScore(submission: PLSubmission): number | null {
		const bucket = this.bucketOf(submission);
		if (bucket === null) {
			return null;
		}
		if (BUCKETS.indexOf(bucket) === -1) {
			throw new Error("Unknown PrairieLearn bucket: " + bucket + "; submission: " + submission.submission_id);
		}
		const explicit = this.scoreOf(submission);
		return explicit === null ? BUCKET_SCORE[bucket] : explicit;
	}

	/**
	 * The best attempt: highest effective score, i.e. the explicit numeric score wherever the grader
	 * set one for this deliverable and student, and the bucket score otherwise.
	 *
	 * NOTE: when a numeric score is present it OUTRANKS the bucket ordering -- a "developing" worth
	 * 99 beats a "proficient" worth 80. That is deliberate: a grader that reports a number is
	 * making a finer-grained statement than the bucket, and the number is what the student is being
	 * graded on. With no numbers anywhere the ranking is exactly bucket order.
	 *
	 * NOTE: PrairieLearn's own best_submission_per_variant cannot be used for any of this. It ranks
	 * by `s.score DESC, s.date DESC`, and because every score is ~0 the tiebreak falls through to
	 * date -- so "best" always equals "latest", and a student who peaked then regressed would be
	 * graded on their regression.
	 *
	 * @param submissions
	 * @returns {{bucket: string, submission: PLSubmission}} null if none are gradeable
	 * @throws if a submission carries a bucket we do not know. Defaulting an unknown bucket to 0
	 * would silently zero the strongest students, and since PrairieLearn shows 0 to everyone anyway
	 * nothing would look wrong.
	 */
	public bestSubmission(submissions: PLSubmission[]): { bucket: string; submission: PLSubmission } {
		let best: { bucket: string; submission: PLSubmission } = null;
		let bestScore = -1;

		for (const s of submissions) {
			const score = this.effectiveScore(s); // throws on an unknown bucket
			if (score === null) {
				continue;
			}
			// strictly greater, so the earliest attempt wins an exact tie and the result is stable
			if (best === null || score > bestScore) {
				best = { bucket: this.bucketOf(s), submission: s };
				bestScore = score;
			}
		}
		return best;
	}

	/**
	 * Creates a Deliverable for any assessment that does not have one.
	 *
	 * NOTE: create only. A renamed or deleted PrairieLearn assessment leaves an orphan deliverable,
	 * which is a far better outcome than silently destroying the grades attached to it.
	 */
	private async ensureDeliverables(assessments: PLAssessment[], summary: PLSyncSummary): Promise<void> {
		const dc = new DeliverablesController();
		for (const assessment of assessments) {
			const delivId = assessment.assessment_label;
			const existing = await dc.getDeliverable(delivId);
			if (existing !== null) {
				continue; // never overwrite; the course may have customised it
			}

			const deliv: Deliverable = {
				id: delivId,
				URL: this.assessmentUrl(assessment.assessment_id),
				openTimestamp: 0,
				closeTimestamp: Number.MAX_SAFE_INTEGER, // PrairieLearn owns the real dates
				gradesReleased: false, // never expose on creation
				visibleToStudents: false, // flip deliberately, not as a side effect of a sync
				rubric: {},
				custom: { prairieLearn: { assessmentId: assessment.assessment_id, assessmentName: assessment.assessment_name } },
				lateAutoTest: false,
				shouldAutoTest: false,
				autotest: { dockerImage: "", studentDelay: 0, maxExecTime: 0, regressionDelivIds: [], custom: {} },
				shouldProvision: false, // no repos are involved
				repoPrefix: null,
				teamPrefix: null,
				importURL: null,
				teamMinSize: 1,
				teamMaxSize: 1,
				teamSameLab: false,
				teamStudentsForm: false,
			};
			await dc.saveDeliverable(deliv);
			summary.deliverablesCreated.push(delivId);
			Log.info("PrairieLearnAgent::ensureDeliverables(..) - created deliverable: " + delivId);
		}
	}

	/**
	 * All people, keyed by the field PrairieLearn uids join against.
	 *
	 * NOTE: loaded once rather than per instance. PersonController.getGitHubPerson must NOT be used
	 * here: on a miss it calls GitHub (isOnAdminTeam + isOnStaffTeam) and creates a Person if they
	 * are staff, so a 9,900-instance sweep would make thousands of GitHub calls and silently create
	 * records.
	 *
	 * NOTE: the join field is deployment-specific. ClasslistAgent sets githubId from CWL for
	 * github.students.cs and github.ubc, but from ACCT for github.ugrad.cs -- where that is true,
	 * matching PrairieLearn uids against githubId matches nothing at all.
	 */
	/**
	 * Deliverables by id, loaded once so the close-date check does not hit the database per instance.
	 *
	 * @returns {Promise<Map<string, Deliverable>>}
	 */
	private async resolveDeliverables(): Promise<Map<string, Deliverable>> {
		const all = await new DeliverablesController().getAllDeliverables();
		const map = new Map<string, Deliverable>();
		for (const deliv of all) {
			map.set(deliv.id, deliv);
		}
		return map;
	}

	private async resolvePeople(): Promise<Map<string, Person>> {
		const people = await this.db.getPeople();
		const map = new Map<string, Person>();
		for (const person of people) {
			if (typeof person.githubId === "string") {
				map.set(person.githubId.toLowerCase(), person);
			}
		}
		Log.info("PrairieLearnAgent::resolvePeople() - people: " + map.size);
		return map;
	}

	private uidToCwl(uid: string): string {
		if (typeof uid !== "string") {
			return "";
		}
		const domain = Config.getInstance().hasProp(ConfigKey.prairieLearnUidDomain)
			? Config.getInstance().getProp(ConfigKey.prairieLearnUidDomain)
			: "@ubc.ca";
		const idx = uid.indexOf(domain);
		return (idx > 0 ? uid.substring(0, idx) : uid).toLowerCase();
	}

	private async writeGradeFor(instance: PLAssessmentInstance, submission: PLSubmission, bucket: string, person: Person): Promise<void> {
		// prefer an explicit numeric grade when the grader reports one; otherwise map the bucket
		const explicit = this.scoreOf(submission);
		const score = explicit === null ? BUCKET_SCORE[bucket] : explicit;

		const grade: Grade = {
			personId: person.id, // the stable csId, not the join field
			delivId: instance.assessment_label,
			score: score,
			comment: "",
			timestamp: Date.now(),
			urlName: instance.assessment_label,
			URL: this.instanceUrl(instance.assessment_instance_id),
			custom: {
				bucket: bucket,
				// NOTE: score stays numeric and displayScore carries the bucket. Both the admin grade
				// sheet (AdminGradesTab) and the student view (AbstractStudentView) prefer
				// custom.displayScore over score.toFixed(2), so the sheet reads "proficient" rather
				// than "100.00" while everything numeric still works.
				//
				// Making score itself a string would break more than it looks: CourseController's
				// "last highest" check (newGrade.score >= existingGrade.score) would compare
				// lexicographically, and the buckets do not sort alphabetically in rank order --
				// "acquiring" < "beginning" as text, but beginning(0) < acquiring(55) by rank -- so a
				// student improving from beginning to acquiring would look like a decrease and be
				// silently rejected.
				// show the number when there is one, otherwise the bucket name
				displayScore: explicit === null ? bucket : String(explicit),
				source: "prairielearn",
				assessmentInstanceId: instance.assessment_instance_id,
				submissionId: submission.submission_id,
			},
		};
		await new GradesController().saveGrade(grade);
	}

	private async writeResultFor(instance: PLAssessmentInstance, submission: PLSubmission, person: Person): Promise<void> {
		const feedback = JSON.parse(JSON.stringify(submission.feedback));

		const custom: any = {};
		if (PrairieLearnAgent.PERSIST_SUBMITTED_FILES === true) {
			custom.submittedFiles = (submission as any)?.submitted_answer?._files ?? [];
		}

		// NOTE: the Result fields are deliberately repurposed; PrairieLearn has no repos or commits.
		// repoId is the assessment instance, commitSHA the submission id, and ref a fixed string --
		// together they are the key writeResult upserts on, so re-running is idempotent.
		const result: Result = {
			delivId: instance.assessment_label,
			repoId: instance.assessment_instance_id,
			commitURL: this.instanceUrl(instance.assessment_instance_id),
			commitSHA: submission.submission_id,
			people: [person.id],
			input: {
				target: {
					delivId: instance.assessment_label,
					repoId: instance.assessment_instance_id,
					botMentioned: false,
					adminRequest: false,
					shouldPromote: false,
					personId: person.id,
					kind: "prairielearn",
					cloneURL: null,
					commitSHA: submission.submission_id,
					commitURL: this.instanceUrl(instance.assessment_instance_id),
					postbackURL: null,
					timestamp: Date.parse(submission.date),
					ref: PrairieLearnAgent.RESULT_REF,
				},
				containerConfig: null,
			} as any,
			output: {
				timestamp: Date.parse(submission.date),
				report: feedback?.results?.report ?? null,
				postbackOnComplete: false,
				state: "SUCCESS",
				custom: custom,
				graderTaskId: String(feedback?.job_id ?? ""),
			} as any,
		} as Result;

		await this.db.writeResult(result);
	}

	/**
	 * Whether this instance has already been synced at its current modified_at.
	 */
	private async isUnchanged(instance: PLAssessmentInstance, closeTimestamp: number): Promise<boolean> {
		const existing = await this.db.getJobWatermark<PrairieLearnWatermark>(
			PrairieLearnAgent.WATERMARK_KIND,
			instance.assessment_instance_id
		);
		if (existing === null) {
			return false;
		}
		// NOTE: both must match. A deadline change alters which submissions count while leaving
		// PrairieLearn's modified_at untouched, so comparing modified_at alone would skip the
		// instance forever and the corrected grade would never appear.
		return existing.modifiedAt === instance.modified_at && existing.closeTimestamp === closeTimestamp;
	}

	/**
	 * NOTE: records the modified_at observed during enumeration, NOT one re-read at fetch time. If a
	 * student submits between enumerate and fetch we will have stored the newer data against the
	 * older watermark, so the next run re-syncs the instance: wasteful, but it never misses a change.
	 * Recording a fetch-time value would open a window where a concurrent submission is skipped.
	 */
	private async markSynced(instance: PLAssessmentInstance, closeTimestamp: number, submissionCount: number): Promise<void> {
		const mark: PrairieLearnWatermark = {
			kind: PrairieLearnAgent.WATERMARK_KIND,
			key: instance.assessment_instance_id,
			delivId: instance.assessment_label,
			modifiedAt: instance.modified_at,
			closeTimestamp: closeTimestamp,
			syncedAt: Date.now(),
			submissionCount: submissionCount,
		};
		await this.db.writeJobWatermark(mark);
	}

	private instanceUrl(assessmentInstanceId: string): string {
		const base = Config.getInstance().getProp(ConfigKey.prairieLearnUrl);
		const ci = Config.getInstance().getProp(ConfigKey.prairieLearnCourseInstanceId);
		return base + "/pl/course_instance/" + ci + "/assessment_instance/" + assessmentInstanceId;
	}

	private assessmentUrl(assessmentId: string): string {
		const base = Config.getInstance().getProp(ConfigKey.prairieLearnUrl);
		const ci = Config.getInstance().getProp(ConfigKey.prairieLearnCourseInstanceId);
		return base + "/pl/course_instance/" + ci + "/instructor/assessment/" + assessmentId;
	}

	/**
	 * The real network fetcher. Untested by design, as fetchClasslist is: it contains no logic, and
	 * exercising it would need either a live PrairieLearn or a mocking library the repo does not have.
	 */
	private async defaultFetcher(path: string): Promise<any> {
		const c = Config.getInstance();
		const url =
			c.getProp(ConfigKey.prairieLearnUrl) + "/pl/api/v1/course_instances/" + c.getProp(ConfigKey.prairieLearnCourseInstanceId) + path;

		const options: RequestInit = {
			method: "GET",
			headers: {
				// NOTE: a credential. Never log this header or the URL with it attached.
				"Private-Token": c.getProp(ConfigKey.prairieLearnToken),
			},
		};

		Log.trace("PrairieLearnAgent::defaultFetcher( " + path + " ) - requesting");
		const res = await fetch(url, options);
		if (res.status === 401) {
			throw new Error("PrairieLearn rejected the token (401); regenerate PRAIRIELEARN_TOKEN");
		}
		if (res.status === 403) {
			throw new Error("PrairieLearn denied access (403); check PRAIRIELEARN_COURSE_INSTANCE_ID");
		}
		if (res.ok === false) {
			throw new Error("PrairieLearn request failed; status: " + res.status + "; path: " + path);
		}
		return await res.json();
	}
}
