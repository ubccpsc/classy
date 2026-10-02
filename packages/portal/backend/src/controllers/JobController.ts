import Log from "@common/Log";
import Util from "@common/Util";

import { Job, JobState } from "../Types";
import { DatabaseController } from "./DatabaseController";

/**
 * Handed to a job handler so it can report progress and notice cancellation without knowing
 * anything about how jobs are stored.
 */
export interface JobContext {
	/**
	 * Whether cancellation has been requested.
	 *
	 * Handlers MUST check this *before starting each unit of work*, never mid-unit: the guarantee
	 * the framework makes is "stops soon", and the guarantee the handler makes is "leaves consistent,
	 * resumable state". For a sync that unit is one record; for provisioning it is one repository,
	 * which must never be abandoned half-created.
	 */
	isCancelled(): boolean;

	/**
	 * Report progress. Persisted, so the admin UI sees it while the job runs, and it survives the
	 * browser being closed.
	 */
	progress(done: number, total: number, message?: string): Promise<void>;

	/**
	 * Record a non-fatal problem. Bounded: see JobController.MAX_ERRORS.
	 */
	error(msg: string): Promise<void>;
}

export type JobHandler = (job: Job, ctx: JobContext) => Promise<any>;

/**
 * Runs long-lived work in the backend rather than in the browser.
 *
 * The proxy sets `proxy_read_timeout 90`, so any request that cannot finish inside 90s is cut off by
 * nginx *while the backend keeps working* -- the worst kind of failure, because the caller sees an
 * error while writes continue. Rather than have the client drive batches to stay under that ceiling,
 * a job runs here and records its progress in the database. Starting one returns immediately.
 *
 * Handlers register by kind, so this class knows nothing about the work itself.
 */
export class JobController {
	/**
	 * A job whose heartbeat is older than this is presumed dead: its process exited without being
	 * able to update its own state. With `restart: always` and routine redeploys this is normal,
	 * not exceptional.
	 *
	 * Not readonly so specs can shorten it; it should not be modified otherwise.
	 */
	private static STALE_MS = 5 * 60 * 1000;

	/**
	 * Cap on Job.errors. A handler iterating ~10,000 records could otherwise grow a single document
	 * without bound; the count is still reported, only the detail is truncated.
	 */
	private static MAX_ERRORS = 100;

	private static instance: JobController = null;

	private readonly handlers: Map<string, JobHandler> = new Map();

	/**
	 * Jobs running in *this* process, so cancellation does not need to poll the database. The
	 * backend is a single container (`container_name: portal`, no replicas), so a cancel request
	 * always lands in the same process as the job it is cancelling.
	 */
	private readonly running: Map<string, { cancelled: boolean }> = new Map();

	private db: DatabaseController = DatabaseController.getInstance();

	public static getInstance(): JobController {
		if (JobController.instance === null) {
			JobController.instance = new JobController();
		}
		return JobController.instance;
	}

	/**
	 * @param kind e.g. "prairielearn-sync"
	 * @param handler
	 * @returns {void}
	 */
	public register(kind: string, handler: JobHandler): void {
		Log.info("JobController::register( " + kind + " ) - start");
		this.handlers.set(kind, handler);
	}

	public isRegistered(kind: string): boolean {
		return this.handlers.has(kind);
	}

	/**
	 * Starts a job and returns as soon as it is recorded; the work continues in the background.
	 *
	 * Only one job per kind runs at a time. A second request returns the job already in flight
	 * rather than failing, so a double-clicked button is harmless.
	 *
	 * @param kind
	 * @param requestedBy Person.id, for audit
	 * @param params kind-specific input
	 * @returns {Promise<Job>} the new job, or the one already running for this kind
	 */
	public async start(kind: string, requestedBy: string, params: any = {}): Promise<Job> {
		Log.info("JobController::start( " + kind + ", " + requestedBy + " ) - start");

		if (this.handlers.has(kind) === false) {
			throw new Error("Unknown job kind: " + kind);
		}

		const current = await this.getRunning(kind);
		if (current !== null) {
			Log.info("JobController::start( " + kind + " ) - already running; returning job: " + current.id);
			return current;
		}

		const job: Job = {
			id: kind + "_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
			kind: kind,
			state: JobState.RUNNING,
			requestedBy: requestedBy,
			createdAt: Date.now(),
			startedAt: Date.now(),
			heartbeatAt: Date.now(),
			completedAt: null,
			cancelRequested: false,
			progress: { done: 0, total: 0, message: "starting" },
			summary: null,
			errors: [],
			params: params,
		};
		await this.db.writeJob(job);

		this.running.set(job.id, { cancelled: false });

		// This is deliberately not awaited. start() must return so the HTTP request can complete
		// before it times out. run() owns the job's lifecycle after this point
		void this.run(job);

		return job;
	}

	/**
	 * Requests cancellation. Cooperative: the handler stops at its next safe point, so this returns
	 * before the job has actually stopped.
	 *
	 * @param jobId
	 * @returns {Promise<Job | null>} the job, or null if unknown
	 */
	public async cancel(jobId: string): Promise<Job | null> {
		Log.info("JobController::cancel( " + jobId + " ) - start");

		const job = await this.db.getJob(jobId);
		if (job === null) {
			return null;
		}
		if (job.state !== JobState.RUNNING) {
			// already finished; cancelling must not rewrite a terminal state
			Log.info("JobController::cancel( " + jobId + " ) - job is " + job.state + "; ignoring");
			return job;
		}

		job.cancelRequested = true;
		await this.db.writeJob(job);

		const local = this.running.get(jobId);
		if (typeof local !== "undefined") {
			local.cancelled = true; // what the handler actually observes
		}

		return job;
	}

	/**
	 * The currently running job for a kind, if any.
	 *
	 * NOTE: a job whose heartbeat has gone stale is not running -- its process died. It is swept to
	 * INTERRUPTED here rather than being reported as in flight, otherwise one unlucky deploy would
	 * block that kind forever.
	 *
	 * @param kind
	 * @returns {Promise<Job | null>}
	 */
	public async getRunning(kind: string): Promise<Job | null> {
		const jobs = await this.db.getJobs({ kind: kind, state: JobState.RUNNING });
		for (const job of jobs) {
			if ((await this.sweepIfDead(job)) === false) {
				return job;
			}
		}
		return null;
	}

	/**
	 * Jobs matching a query, newest first, as the admin UI should see them.
	 *
	 * NOTE: the admin page disables a job's button while this says the job is RUNNING, so it has to
	 * apply the same rule as start(). It used to read the database directly, which reported a dead
	 * job as RUNNING; that disabled the one button whose press would have swept it, and the kind
	 * stayed blocked until the next restart.
	 *
	 * @param query as for DatabaseController.getJobs
	 * @returns {Promise<Job[]>}
	 */
	public async getJobs(query: {} = {}): Promise<Job[]> {
		const jobs = await this.db.getJobs(query);
		for (const job of jobs) {
			await this.sweepIfDead(job);
		}
		return jobs;
	}

	/**
	 * One job, as the admin UI should see it; see getJobs. This is what the page polls while a job
	 * runs, so a job that dies while someone is watching is reported as such.
	 *
	 * @param jobId
	 * @returns {Promise<Job | null>} the job, or null if unknown
	 */
	public async getJob(jobId: string): Promise<Job | null> {
		const job = await this.db.getJob(jobId);
		if (job !== null) {
			await this.sweepIfDead(job);
		}
		return job;
	}

	/**
	 * Marks any job left RUNNING by a process that is no longer alive as INTERRUPTED.
	 *
	 * Called on startup: with `restart: always`, a deploy or crash during a long job leaves its
	 * record claiming to be RUNNING forever, which would block that kind from ever starting again.
	 *
	 * @returns {Promise<number>} how many jobs were swept
	 */
	public async sweepInterrupted(): Promise<number> {
		Log.info("JobController::sweepInterrupted() - start");

		const jobs = await this.db.getJobs({ state: JobState.RUNNING }, 1000);
		let count = 0;
		for (const job of jobs) {
			if ((await this.sweepIfDead(job)) === true) {
				count++;
			}
		}
		Log.info("JobController::sweepInterrupted() - done; swept: " + count);
		return count;
	}

	/**
	 * Whether a job claims to be RUNNING but its process is gone.
	 *
	 * A job running in *this* process is alive however long it has been since it reported progress,
	 * so it is never dead. That matters now that the admin page's polling sweeps too: a handler that
	 * went quiet for longer than STALE_MS would otherwise be marked INTERRUPTED while it carried on,
	 * its button re-enabled, and the next press would start a second run alongside it.
	 */
	private isDead(job: Job): boolean {
		if (job.state !== JobState.RUNNING || this.running.has(job.id) === true) {
			return false;
		}
		const beat = job.heartbeatAt === null ? job.createdAt : job.heartbeatAt;
		return Date.now() - beat > JobController.STALE_MS;
	}

	/**
	 * Sweeps a dead job to INTERRUPTED. The job is updated in place, so the caller's copy reports the
	 * new state too.
	 *
	 * @returns {Promise<boolean>} whether the job was swept
	 */
	private async sweepIfDead(job: Job): Promise<boolean> {
		if (this.isDead(job) === false) {
			return false;
		}
		await this.interrupt(job);
		return true;
	}

	private async interrupt(job: Job): Promise<void> {
		Log.warn("JobController::interrupt( " + job.id + " ) - stale heartbeat; marking INTERRUPTED");
		job.state = JobState.INTERRUPTED;
		job.completedAt = Date.now();
		job.progress.message = "interrupted; the process running this job exited";
		await this.db.writeJob(job);
		this.running.delete(job.id);
	}

	/**
	 * Runs the handler and records the outcome. Never throws: a job's failure is data, not an
	 * exception, because nobody is awaiting this.
	 */
	private async run(job: Job): Promise<void> {
		const start = Date.now();
		Log.info("JobController::run( " + job.id + " ) - start");

		const handler = this.handlers.get(job.kind);
		const ctx = this.makeContext(job);

		try {
			const summary = await handler(job, ctx);

			const local = this.running.get(job.id);
			const cancelled = typeof local !== "undefined" && local.cancelled === true;

			const current = await this.reload(job);
			current.state = cancelled ? JobState.CANCELLED : JobState.SUCCEEDED;
			current.summary = typeof summary === "undefined" ? null : summary;
			current.completedAt = Date.now();
			current.heartbeatAt = Date.now();
			await this.db.writeJob(current);

			Log.info("JobController::run( " + job.id + " ) - " + current.state + "; took: " + Util.took(start));
		} catch (err) {
			const current = await this.reload(job);
			current.state = JobState.FAILED;
			current.completedAt = Date.now();
			current.heartbeatAt = Date.now();
			// A handler that gives up part way can attach what it managed to do, so a failed
			// job can still report "37 of 450 provisioned" rather than just an error string
			current.summary = typeof err?.summary === "undefined" ? null : err.summary;
			current.errors = JobController.appendError(current.errors, err?.message ?? String(err));
			await this.db.writeJob(current);

			Log.error("JobController::run( " + job.id + " ) - FAILED: " + err?.message + "; took: " + Util.took(start));
		} finally {
			this.running.delete(job.id);
		}
	}

	private makeContext(job: Job): JobContext {
		const self = this;
		return {
			isCancelled(): boolean {
				const local = self.running.get(job.id);
				return typeof local !== "undefined" && local.cancelled === true;
			},

			async progress(done: number, total: number, message = ""): Promise<void> {
				const current = await self.reload(job);
				current.progress = { done: done, total: total, message: message };
				current.heartbeatAt = Date.now(); // progress is also proof of life
				await self.db.writeJob(current);
			},

			async error(msg: string): Promise<void> {
				Log.warn("JobController::error( " + job.id + " ) - " + msg);
				const current = await self.reload(job);
				current.errors = JobController.appendError(current.errors, msg);
				current.heartbeatAt = Date.now();
				await self.db.writeJob(current);
			},
		};
	}

	/**
	 * Re-reads the job before mutating it, so a progress update does not clobber a concurrent
	 * cancellation (or vice versa) by writing back a stale copy.
	 */
	private async reload(job: Job): Promise<Job> {
		const current = await this.db.getJob(job.id);
		return current === null ? job : current;
	}

	private static appendError(errors: string[], msg: string): string[] {
		const list = Array.isArray(errors) ? errors : [];
		if (list.length < JobController.MAX_ERRORS) {
			list.push(msg);
		} else if (list.length === JobController.MAX_ERRORS) {
			list.push("... further errors suppressed (limit " + JobController.MAX_ERRORS + ")");
		}
		return list;
	}
}
