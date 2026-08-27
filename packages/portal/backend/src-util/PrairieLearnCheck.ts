import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { PLAssessmentInstance, PrairieLearnAgent } from "@backend/server/common/PrairieLearnAgent";
import Config, { ConfigKey } from "@common/Config";
import Log, { LogLevel } from "@common/Log";
import Util from "@common/Util";

/**
 * Read-only preflight for the PrairieLearn connector.
 *
 * This is the tool to run after rolling the course over to a new term, or whenever a sync is not
 * doing what you expect. It is READ-ONLY: it issues GETs against PrairieLearn and reads the Classy
 * database, but creates nothing, writes nothing, and deletes nothing. It is safe to run repeatedly
 * and safe to point at production.
 *
 * It answers the questions that actually go wrong in practice:
 *
 * 1) Is the connector configured at all?
 * 2) Does the token authenticate, and does it have access to THIS course instance?
 *    (401 vs 403 distinguishes "regenerate the token" from "wrong course instance".)
 * 3) Do the assessment labels look like usable Classy deliverable ids?
 * 4) Do PrairieLearn uids actually match Classy people? A systematic mismatch -- wrong join field,
 *    wrong uid domain -- looks exactly like "no students have submitted yet", so this is the check
 *    most worth running before a term starts.
 *
 * To run:
 * 1) set PRAIRIELEARN_* in .env
 * 2) build (src-util is not part of the main backend build):
 *      cd packages/portal/backend && ../../../node_modules/typescript/bin/tsc -p tsconfig.src-util.json
 * 3) run it (the @common/* path aliases need tsconfig-paths at runtime):
 *      cd packages/portal/backend
 *      TS_NODE_BASEURL=. node --require dotenv/config --require tsconfig-paths/register \
 *          src-util/PrairieLearnCheck.js
 */
export class PrairieLearnCheck {
	/**
	 * How many assessments to enumerate instances for. Enumerating all of them is ~25 requests and
	 * a few MB; a couple is enough to tell whether the uid join works.
	 */
	private readonly sampleAssessments: number = 2;

	public async run(): Promise<void> {
		Log.info("PrairieLearnCheck::run() - start");

		if (PrairieLearnAgent.isConfigured() === false) {
			Log.error("PrairieLearnCheck - NOT CONFIGURED: set PRAIRIELEARN_URL, PRAIRIELEARN_TOKEN, and");
			Log.error("PrairieLearnCheck - PRAIRIELEARN_COURSE_INSTANCE_ID in .env (all must be non-empty).");
			return;
		}

		const c = Config.getInstance();
		Log.info("PrairieLearnCheck - url: " + c.getProp(ConfigKey.prairieLearnUrl));
		Log.info("PrairieLearnCheck - courseInstanceId: " + c.getProp(ConfigKey.prairieLearnCourseInstanceId));
		// NOTE: never log the token itself, only that one is present
		Log.info("PrairieLearnCheck - token: present");

		const agent = new PrairieLearnAgent();

		// --- 1. connectivity + auth
		let assessments;
		try {
			const start = Date.now();
			assessments = await agent.fetchAssessments();
			Log.info("PrairieLearnCheck - CONNECTED; assessments: " + assessments.length + "; took: " + Util.took(start));
		} catch (err) {
			// the agent turns 401/403 into messages that name the actual fix
			Log.error("PrairieLearnCheck - FAILED: " + err.message);
			return;
		}

		if (assessments.length === 0) {
			Log.warn("PrairieLearnCheck - no assessments in this course instance; is the course instance id right?");
			return;
		}

		// --- 2. do the labels look like deliverable ids, and do they already exist?
		const dc = new DeliverablesController();
		const existing = await dc.getAllDeliverables();
		const existingIds = existing.map((d) => d.id);

		Log.info("PrairieLearnCheck - assessment labels (these become Classy deliverable ids):");
		let missing = 0;
		for (const a of assessments) {
			const known = existingIds.indexOf(a.assessment_label) >= 0;
			if (known === false) {
				missing++;
			}
			Log.info(
				"    " + a.assessment_label.padEnd(12) + (known ? "exists in Classy" : "WOULD BE CREATED") + "   (" + a.assessment_name + ")"
			);
		}
		if (missing > 0) {
			Log.warn("PrairieLearnCheck - " + missing + " deliverable(s) would be created by a sync.");
			Log.warn("PrairieLearnCheck - if the labels look wrong, fix them in PrairieLearn BEFORE syncing:");
			Log.warn("PrairieLearnCheck - the label is assessmentSet.abbreviation + assessment.number, and the");
			Log.warn("PrairieLearnCheck - agent creates deliverables but never renames or deletes them.");
		}

		// --- 3. does the uid join actually work?
		const people = await (agent as any).resolvePeople();
		Log.info("PrairieLearnCheck - people in Classy: " + people.size);

		const seen: PLAssessmentInstance[] = [];
		for (const a of assessments.slice(0, this.sampleAssessments)) {
			const instances = await agent.fetchInstances(a.assessment_id);
			for (const i of instances) {
				seen.push(i);
			}
		}
		Log.info("PrairieLearnCheck - sampled instances: " + seen.length + " (from " + this.sampleAssessments + " assessment(s))");

		let students = 0;
		let staff = 0;
		let matched = 0;
		const unmatched: string[] = [];
		for (const i of seen) {
			if (i.user_role === "Student") {
				students++;
			} else {
				staff++;
				continue; // staff attempts are never graded
			}
			const cwl = (agent as any).uidToCwl(i.user_uid);
			if (people.has(cwl) === true) {
				matched++;
			} else if (unmatched.indexOf(i.user_uid) === -1) {
				unmatched.push(i.user_uid);
			}
		}

		Log.info("PrairieLearnCheck - student instances: " + students + "; staff instances (ignored): " + staff);
		Log.info("PrairieLearnCheck - uid -> Classy person matched: " + matched + " of " + students);

		if (students === 0) {
			Log.warn("PrairieLearnCheck - no student attempts yet; the uid join could not be verified.");
			Log.warn("PrairieLearnCheck - re-run this once students have started, BEFORE relying on a sync.");
		} else if (unmatched.length > 0) {
			Log.error("PrairieLearnCheck - UNMATCHED uids (" + unmatched.length + " distinct), e.g.:");
			for (const u of unmatched.slice(0, 5)) {
				Log.error("    " + u);
			}
			Log.error("PrairieLearnCheck - a sync would silently write no grades for these students.");
			Log.error("PrairieLearnCheck - check PRAIRIELEARN_UID_DOMAIN, and that Person.githubId holds the CWL");
			Log.error("PrairieLearnCheck - (ClasslistAgent maps githubId from CWL for github.students.cs / github.ubc,");
			Log.error("PrairieLearnCheck - but from ACCT for github.ugrad.cs -- where that is true, nothing matches).");
		} else {
			Log.info("PrairieLearnCheck - all sampled student uids resolved to Classy people.");
		}

		Log.info("PrairieLearnCheck::run() - done; nothing was written.");
	}
}

const check = new PrairieLearnCheck();
const startTime = Date.now();
Log.Level = LogLevel.INFO;
check
	.run()
	.then(function () {
		Log.info("PrairieLearnCheck::run() - complete; took: " + Util.took(startTime));
		process.exit();
	})
	.catch(function (err) {
		Log.error("PrairieLearnCheck::run() - ERROR: " + err.message);
		process.exit();
	});
