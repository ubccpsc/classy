import Log from "@common/Log";
import { OnsButtonElement } from "onsenui";

import { UI } from "../util/UI";
import { AdminView } from "./AdminView";

/**
 * A button whose work runs as a background job rather than being
 * orchestrated by a series of frontend requests.
 */
export interface JobSection {
	kind: string; // the registered job kind (BackendServer)
	buttonId: string;
	statusId: string; // where the status block goes
	ran: string; // e.g. "Last synced"; prefixes the status line
	detail: (summary: any) => string; // renders the job's kind-specific summary

	cancelButtonId?: string; // only for jobs worth cancelling
	neverRun?: string; // shown before the first run; defaults to "Never run."
	confirmCancel?: string; // if set, confirmed with the user before the cancel is sent

	/**
	 * What to send as the job's params. Read when the button is pressed, so a selection made after
	 * the page loaded is picked up. Return null to abort the press (the section reports why itself).
	 */
	params?: () => any;

	/**
	 * Reported once, only for a successful run this page started.
	 */
	onFinished?: (summary: any) => void;

	/**
	 * Called when a job this page was *watching* reaches any terminal state, so a page whose content
	 * depends on the job (the provisioning lists) can refresh itself.
	 */
	onTerminal?: (job: any) => void;
}

/**
 * Starts background jobs and keeps their status blocks up to date.
 *
 * The work these buttons trigger used to run inside the request that started it, which the proxy
 * cuts off at 90s (`proxy_read_timeout`) *while the backend keeps working*. Now the button starts a
 * job and the page only watches it, so the work finishes whether or not this page stays open.
 */
export class JobRunner {
	private readonly remote: string;

	/**
	 * Job id, poll timer, and "did this page start it" per kind, for the jobs being watched.
	 */
	private readonly jobIds: { [kind: string]: string } = {};
	private readonly jobTimers: { [kind: string]: any } = {};
	private readonly jobsStartedHere: { [kind: string]: boolean } = {};

	public constructor(remote: string) {
		this.remote = remote;
	}

	/**
	 * Wires a section's buttons and shows what its last run did, so a stale or still-running job is
	 * visible on arrival rather than only after someone presses the button.
	 */
	public async init(section: JobSection): Promise<void> {
		this.wire(section);
		try {
			await this.refresh(section);
		} catch (err) {
			Log.warn("JobRunner::init( " + section.kind + " ) - ERROR: " + err.message);
		}
	}

	private wire(section: JobSection): void {
		const button = document.querySelector("#" + section.buttonId) as OnsButtonElement;
		if (button === null) {
			return; // course has customised its page and removed the button
		}

		button.onclick = (evt: any) => {
			evt.preventDefault();
			evt.stopPropagation(); // prevents list item expansion
			this.start(section).catch((err) => {
				Log.error("JobRunner::wire( " + section.kind + " ) - start ERROR: " + err.message);
			});
		};

		if (typeof section.cancelButtonId === "string") {
			const cancelButton = document.querySelector("#" + section.cancelButtonId) as OnsButtonElement;
			if (cancelButton !== null) {
				cancelButton.onclick = (evt: any) => {
					evt.preventDefault();
					evt.stopPropagation();
					this.cancel(section).catch((err) => {
						Log.error("JobRunner::wire( " + section.kind + " ) - cancel ERROR: " + err.message);
					});
				};
			}
		}
	}

	public async start(section: JobSection): Promise<void> {
		Log.info("JobRunner::start( " + section.kind + " ) - start");

		let params: any = {};
		if (typeof section.params === "function") {
			params = section.params();
			if (params === null) {
				return; // the section decided this press should not start anything
			}
		}

		const options: any = AdminView.getOptions();
		options.method = "post";
		options.body = JSON.stringify(params);

		const response = await fetch(this.remote + "/portal/admin/job/" + section.kind, options);
		const json = await response.json();

		if (typeof json.success === "undefined") {
			// NOTE: via showError, not json.failure.message. The backend can reject a request before
			// it reaches the route handler, and that response has no `failure` field at all.
			UI.showError(json);
			return;
		}

		// starting returns immediately; the work continues in the backend
		this.jobIds[section.kind] = json.success.id;
		this.jobsStartedHere[section.kind] = true;
		this.setStatus(section, "Starting...");
		this.poll(section);
	}

	public async cancel(section: JobSection): Promise<void> {
		const jobId = this.jobIds[section.kind];
		if (typeof jobId !== "string") {
			return;
		}

		if (typeof section.confirmCancel === "string" && confirm(section.confirmCancel) === false) {
			return;
		}
		Log.info("JobRunner::cancel( " + section.kind + " ) - cancelling: " + jobId);

		const options: any = AdminView.getOptions();
		options.method = "delete";
		await fetch(this.remote + "/portal/admin/job/" + jobId, options);

		// cooperative: the job stops at its next safe point, so the state change arrives by polling
		this.setStatus(section, "Cancelling; finishing the current item...");
	}

	/**
	 * Polls a running job. Cheap (one document read), and stops as soon as the job is terminal.
	 */
	private poll(section: JobSection): void {
		if (typeof this.jobTimers[section.kind] !== "undefined") {
			clearInterval(this.jobTimers[section.kind]);
		}
		this.jobTimers[section.kind] = setInterval(() => {
			this.refresh(section).catch((err) => {
				Log.warn("JobRunner::poll( " + section.kind + " ) - ERROR: " + err.message);
			});
		}, 2000);
	}

	public async refresh(section: JobSection): Promise<void> {
		const jobId = this.jobIds[section.kind];
		const url =
			typeof jobId === "string" ? this.remote + "/portal/admin/job/" + jobId : this.remote + "/portal/admin/jobs?kind=" + section.kind;

		const response = await fetch(url, AdminView.getOptions());
		const json = await response.json();
		if (typeof json.success === "undefined") {
			return;
		}

		const job = Array.isArray(json.success) ? json.success[0] : json.success;
		if (typeof job === "undefined" || job === null) {
			this.setStatus(section, section.neverRun ?? "Never run.");
			return;
		}
		this.jobIds[section.kind] = job.id;

		const running = job.state === "RUNNING";
		const button = document.querySelector("#" + section.buttonId) as OnsButtonElement;
		if (button !== null) {
			button.disabled = running;
		}
		if (typeof section.cancelButtonId === "string") {
			const cancelButton = document.querySelector("#" + section.cancelButtonId) as HTMLElement;
			if (cancelButton !== null) {
				cancelButton.style.display = running ? "" : "none";
			}
		}

		// Adopt a job this page did not start. It is running either because it was already going
		// when the page loaded, or because another admin started it; either way nothing has set a
		// timer for it, so without this the status block renders once and then sits there stale
		// until someone reloads. The guard matters: refresh() is what the timer calls, so polling
		// unconditionally would tear down and rebuild the interval on every tick.
		if (running === true && typeof this.jobTimers[section.kind] === "undefined") {
			Log.info("JobRunner::refresh( " + section.kind + " ) - adopting running job: " + job.id);
			this.poll(section);
		}

		// a job that was being watched has just finished: report it, once
		if (running === false && typeof this.jobTimers[section.kind] !== "undefined") {
			clearInterval(this.jobTimers[section.kind]);
			delete this.jobTimers[section.kind];

			if (this.jobsStartedHere[section.kind] === true) {
				delete this.jobsStartedHere[section.kind];
				if (job.state === "SUCCEEDED" && job.summary !== null && typeof section.onFinished === "function") {
					section.onFinished(job.summary);
				} else if (job.state !== "SUCCEEDED") {
					UI.showAlert(JobRunner.describeFailure(job));
				}
			}

			if (typeof section.onTerminal === "function") {
				section.onTerminal(job);
			}
		}

		this.setStatus(section, JobRunner.describe(job, section));
	}

	/**
	 * Whether a job of this kind is currently being watched as running.
	 */
	public isRunning(section: JobSection): boolean {
		return typeof this.jobTimers[section.kind] !== "undefined";
	}

	/**
	 * A description of a job run, for the status block under its button: when it ran and how it
	 * ended on the first line, what it did on the second.
	 */
	private static describe(job: any, section: JobSection): string {
		const when = job.completedAt ?? job.startedAt ?? job.createdAt;
		const stamp = new Date(when).toLocaleString();

		if (job.state === "RUNNING") {
			const progress = job.progress ?? { done: 0, total: 0, message: "" };
			const counts = progress.total > 0 ? progress.done + " of " + progress.total : "";
			const message = progress.message ? (counts === "" ? "" : " ") + "(" + progress.message + ")" : "";
			return JobRunner.twoLines("Running since " + stamp + ".", counts + message);
		}

		let detail = "";
		if (job.summary !== null && typeof job.summary !== "undefined") {
			detail = section.detail(job.summary);
		}
		if (job.errors?.length > 0) {
			// the message matters here: "no students were processed" is the usual failure
			if (detail !== "") {
				detail += " ";
			}
			detail += "<b>" + job.errors[0] + "</b>";
			if (job.errors.length > 1) {
				detail += " (and " + (job.errors.length - 1) + " more)";
			}
		}

		return JobRunner.twoLines(section.ran + " " + stamp + " (" + job.state.toLowerCase() + ").", detail);
	}

	private static twoLines(first: string, second: string): string {
		if (second === "") {
			return "<div>" + first + "</div>";
		}
		return "<div>" + first + "</div><div>" + second + "</div>";
	}

	private static describeFailure(job: any): string {
		if (job.errors?.length > 0) {
			return job.errors[0];
		}
		return "Job " + job.state.toLowerCase() + ".";
	}

	private setStatus(section: JobSection, html: string): void {
		const el = document.querySelector("#" + section.statusId) as HTMLElement;
		if (el !== null) {
			el.innerHTML = html;
		}
	}
}
