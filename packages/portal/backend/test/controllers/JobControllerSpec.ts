import { expect } from "chai";
import "mocha";

import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import Util from "@common/Util";
import "@common/GlobalSpec";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { JobContext, JobController } from "@backend/controllers/JobController";
import { Job, JobState } from "@backend/Types";

/**
 * Tests for the background job framework.
 *
 * NOTE: these deliberately register synthetic job kinds rather than exercising a real one. The
 * framework will outlive this connector (provisioning is expected to migrate onto it), so its
 * contract is pinned down here, independently of any handler.
 *
 * NOTE: no real sleeps and no wall-clock waits beyond short polls. Where staleness matters the
 * threshold is shortened rather than the test being slowed down.
 */
describe("JobController", function () {
	const jc = JobController.getInstance();
	const dc = DatabaseController.getInstance();

	/**
	 * Waits for a job to reach a terminal state. Jobs run in the background by design, so a spec
	 * that asserts an outcome has to wait for one; this bounds that wait rather than sleeping a
	 * fixed amount.
	 */
	async function waitForState(jobId: string, timeoutMs = 5000): Promise<Job> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const job = await dc.getJob(jobId);
			if (job !== null && job.state !== JobState.RUNNING) {
				return job;
			}
			await Util.delay(10);
		}
		throw new Error("job did not reach a terminal state within " + timeoutMs + "ms");
	}

	before(async () => {
		await TestHarness.suiteBefore("JobController");
		await TestHarness.prepareAll();
	});

	after(async () => {
		TestHarness.suiteAfter("JobController");
	});

	it("Should reject an unknown job kind.", async function () {
		let ex = null;
		try {
			await jc.start("noSuchKind_" + Date.now(), TestHarness.ADMIN1.id);
		} catch (err) {
			ex = err;
		}
		expect(ex).to.not.be.null;
		expect(ex.message).to.contain("Unknown job kind");
	});

	it("Should run a handler to completion and record its summary.", async function () {
		const kind = "test-succeed-" + Date.now();
		jc.register(kind, async () => {
			return { widgets: 3 };
		});

		const started = await jc.start(kind, TestHarness.ADMIN1.id, { some: "param" });
		expect(started.state).to.equal(JobState.RUNNING);
		expect(started.requestedBy).to.equal(TestHarness.ADMIN1.id); // audit
		expect(started.params.some).to.equal("param");

		const done = await waitForState(started.id);
		expect(done.state).to.equal(JobState.SUCCEEDED);
		expect(done.completedAt).to.not.be.null;
		expect(done.summary.widgets).to.equal(3);
		expect(done.errors).to.have.length(0);
	});

	it("Should record a throwing handler as FAILED, not INTERRUPTED.", async function () {
		const kind = "test-throw-" + Date.now();
		jc.register(kind, async () => {
			throw new Error("handler exploded");
		});

		const started = await jc.start(kind, TestHarness.ADMIN1.id);
		const done = await waitForState(started.id);

		// FAILED means the handler is suspect; INTERRUPTED means the process died. Do not conflate.
		expect(done.state).to.equal(JobState.FAILED);
		expect(done.errors.join(" ")).to.contain("handler exploded");
	});

	it("Should persist progress while the job is still running.", async function () {
		const kind = "test-progress-" + Date.now();
		let release: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		jc.register(kind, async (_job: Job, ctx: JobContext) => {
			await ctx.progress(2, 10, "halfway-ish");
			await gate; // hold the job open so the assertions below observe a RUNNING job
			return null;
		});

		const started = await jc.start(kind, TestHarness.ADMIN1.id);

		let observed: Job = null;
		for (let i = 0; i < 200; i++) {
			observed = await dc.getJob(started.id);
			if (observed !== null && observed.progress.done === 2) {
				break;
			}
			await Util.delay(10);
		}

		expect(observed.state).to.equal(JobState.RUNNING);
		expect(observed.progress.done).to.equal(2);
		expect(observed.progress.total).to.equal(10);
		expect(observed.progress.message).to.equal("halfway-ish");
		expect(observed.heartbeatAt).to.not.be.null; // progress doubles as proof of life

		release();
		await waitForState(started.id);
	});

	it("Should only run one job per kind, returning the in-flight job to a second caller.", async function () {
		const kind = "test-single-" + Date.now();
		let runs = 0;
		let release: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		jc.register(kind, async () => {
			runs++;
			await gate;
			return null;
		});

		const first = await jc.start(kind, TestHarness.ADMIN1.id);
		const second = await jc.start(kind, TestHarness.ADMIN1.id);

		// a double-clicked button must not start a second sweep
		expect(second.id).to.equal(first.id);

		release();
		await waitForState(first.id);
		expect(runs).to.equal(1);
	});

	it("Should cancel between work items, never mid-item.", async function () {
		const kind = "test-cancel-" + Date.now();
		const started: number[] = [];
		const finished: number[] = [];

		jc.register(kind, async (_job: Job, ctx: JobContext) => {
			for (let i = 0; i < 20; i++) {
				// the contract: check BEFORE starting a unit of work, never part-way through one
				if (ctx.isCancelled() === true) {
					break;
				}
				started.push(i);
				await Util.delay(5);
				finished.push(i); // if cancellation could interrupt an item, this would lag started
			}
			return { started: started.length };
		});

		const job = await jc.start(kind, TestHarness.ADMIN1.id);
		await Util.delay(20); // let a few items run
		await jc.cancel(job.id);

		const done = await waitForState(job.id);

		expect(done.state).to.equal(JobState.CANCELLED);
		expect(done.cancelRequested).to.be.true;

		// stopped early...
		Log.test("JobController - items started: " + started.length + " of 20");
		expect(started.length).to.be.lessThan(20);
		// ...and every item that was started was also completed: nothing abandoned half-done.
		// This is the guarantee provisioning depends on -- a repo must never be left inconsistent.
		expect(finished).to.deep.equal(started);
	});

	it("Should not let cancellation rewrite a job that already finished.", async function () {
		const kind = "test-cancel-late-" + Date.now();
		jc.register(kind, async () => {
			return null;
		});

		const job = await jc.start(kind, TestHarness.ADMIN1.id);
		const done = await waitForState(job.id);
		expect(done.state).to.equal(JobState.SUCCEEDED);

		await jc.cancel(job.id);

		const after = await dc.getJob(job.id);
		expect(after.state).to.equal(JobState.SUCCEEDED); // still succeeded
	});

	it("Should return null when cancelling an unknown job.", async function () {
		const res = await jc.cancel("noSuchJob_" + Date.now());
		expect(res).to.be.null;
	});

	it("Should sweep a RUNNING job with a stale heartbeat to INTERRUPTED.", async function () {
		// a job whose process died: RUNNING in the database, but nothing is actually running it
		const orphan: Job = {
			id: "orphan_" + Date.now(),
			kind: "test-orphan",
			state: JobState.RUNNING,
			requestedBy: TestHarness.ADMIN1.id,
			createdAt: Date.now() - 60 * 60 * 1000,
			startedAt: Date.now() - 60 * 60 * 1000,
			heartbeatAt: Date.now() - 60 * 60 * 1000, // an hour ago
			completedAt: null,
			cancelRequested: false,
			progress: { done: 5, total: 100, message: "was running" },
			summary: null,
			errors: [],
			params: {},
		};
		await dc.writeJob(orphan);

		const swept = await jc.sweepInterrupted();
		Log.test("JobController - jobs swept: " + swept);
		expect(swept).to.be.greaterThan(0);

		const after = await dc.getJob(orphan.id);
		expect(after.state).to.equal(JobState.INTERRUPTED);
		expect(after.completedAt).to.not.be.null;
		expect(after.progress.done).to.equal(5); // partial progress is retained, not reset
	});

	it("Should leave a RUNNING job with a fresh heartbeat alone.", async function () {
		const fresh: Job = {
			id: "fresh_" + Date.now(),
			kind: "test-fresh",
			state: JobState.RUNNING,
			requestedBy: TestHarness.ADMIN1.id,
			createdAt: Date.now(),
			startedAt: Date.now(),
			heartbeatAt: Date.now(),
			completedAt: null,
			cancelRequested: false,
			progress: { done: 0, total: 0, message: "" },
			summary: null,
			errors: [],
			params: {},
		};
		await dc.writeJob(fresh);

		await jc.sweepInterrupted();

		const after = await dc.getJob(fresh.id);
		expect(after.state).to.equal(JobState.RUNNING); // untouched
	});

	it("Should let a new job start once a stale one has been swept.", async function () {
		const kind = "test-unblock-" + Date.now();
		jc.register(kind, async () => {
			return null;
		});

		// a dead job of this kind would otherwise block the kind forever
		const orphan: Job = {
			id: "orphan_unblock_" + Date.now(),
			kind: kind,
			state: JobState.RUNNING,
			requestedBy: TestHarness.ADMIN1.id,
			createdAt: Date.now() - 60 * 60 * 1000,
			startedAt: Date.now() - 60 * 60 * 1000,
			heartbeatAt: Date.now() - 60 * 60 * 1000,
			completedAt: null,
			cancelRequested: false,
			progress: { done: 0, total: 0, message: "" },
			summary: null,
			errors: [],
			params: {},
		};
		await dc.writeJob(orphan);

		const started = await jc.start(kind, TestHarness.ADMIN1.id);
		expect(started.id).to.not.equal(orphan.id); // a genuinely new job, not the corpse

		const done = await waitForState(started.id);
		expect(done.state).to.equal(JobState.SUCCEEDED);

		const swept = await dc.getJob(orphan.id);
		expect(swept.state).to.equal(JobState.INTERRUPTED);
	});

	it("Should bound the errors array.", async function () {
		const kind = "test-errors-" + Date.now();
		jc.register(kind, async (_job: Job, ctx: JobContext) => {
			// a handler iterating thousands of records could otherwise grow one document without bound
			for (let i = 0; i < 150; i++) {
				await ctx.error("problem " + i);
			}
			return null;
		});

		const started = await jc.start(kind, TestHarness.ADMIN1.id);
		const done = await waitForState(started.id, 20000);

		Log.test("JobController - errors recorded: " + done.errors.length + " of 150 reported");
		expect(done.errors.length).to.be.lessThan(150);
		expect(done.errors[done.errors.length - 1]).to.contain("suppressed");
	}).timeout(30000);
});
