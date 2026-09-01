import Log from "@common/Log";

/**
 * Thrown by a provisioning loop that has decided to stop before it has attempted everything.
 *
 * This carries the partial summary, so the job that was running can still report what it managed
 * to do. JobController stores `summary` from a rejected handler for exactly this case.
 */
export class ProvisionAbortedError extends Error {
	public readonly summary: any;

	public constructor(message: string, summary: any = null) {
		super(message);
		this.name = "ProvisionAbortedError";
		this.summary = summary;
	}
}

/**
 * Decides when to keep going and when to give up.
 *
 * Provisioning 450 repositories should not be all-or-nothing, and it should not grind through 449
 * doomed attempts either. A failure that is about **one repository** is recorded and the run
 * continues; a failure that is about **the connection to GitHub** stops the whole job, as does a
 * pattern of failures that says the run is not going to work.
 */
export class ProvisionFailurePolicy {
	/**
	 * Give up after this many failures if nothing has succeeded yet. A misconfigured deliverable (an
	 * unreachable importURL, a template repo that is not marked as a template) fails identically for
	 * every repository, and three attempts is enough to know that.
	 */
	public static readonly STARTUP_FAILURES = 3;

	/**
	 * How many results are needed before the failure rate means anything.
	 */
	public static readonly MIN_SAMPLE = 20;

	/**
	 * Give up above this failure rate. A run losing one repo in five is not a run with a few bad
	 * repos in it.
	 *
	 * This is a rate rather than a count of consecutive failures, deliberately. Repos are provisioned
	 * concurrently, so "consecutive" would be counted over completion order -- a property of
	 * scheduling rather than of the run, which would make this fire non-deterministically.
	 */
	public static readonly MAX_FAILURE_RATE = 0.2;

	private succeeded = 0;
	private failed = 0;
	private readonly label: string;

	public constructor(label: string) {
		this.label = label;
	}

	public recordSuccess(): void {
		this.succeeded++;
	}

	/**
	 * Records a failed item and decides whether the run should continue.
	 *
	 * @param err the failure, so a fatal one can stop the run immediately
	 * @returns {string | null} null to continue; a reason to stop
	 */
	public recordFailure(err: any): string | null {
		this.failed++;

		if (err?.fatal === true) {
			// this will happen to every other item too
			return "GitHub call failed fatally: " + (err?.message ?? String(err));
		}

		if (this.succeeded === 0 && this.failed >= ProvisionFailurePolicy.STARTUP_FAILURES) {
			return "the first " + this.failed + " attempts all failed";
		}

		const completed = this.succeeded + this.failed;
		if (completed >= ProvisionFailurePolicy.MIN_SAMPLE) {
			const rate = this.failed / completed;
			if (rate > ProvisionFailurePolicy.MAX_FAILURE_RATE) {
				return this.failed + " of " + completed + " failed (" + Math.round(rate * 100) + "%)";
			}
		}

		return null;
	}

	/**
	 * Stops the run, carrying whatever it managed to do.
	 */
	public abort(reason: string, summary: any = null): never {
		const msg = this.label + " stopped early: " + reason;
		Log.error("ProvisionFailurePolicy::abort() - " + msg);
		throw new ProvisionAbortedError(msg, summary);
	}
}
