import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";

import { JobController } from "./JobController";

/** One `kind@HH:MM` entry from JOB_SCHEDULE. */
export interface ScheduleEntry {
	kind: string;
	/** 0-23, in the schedule's time zone */
	hour: number;
	minute: number;
}

/**
 * Starts background jobs at fixed times of day, e.g. a PrairieLearn sync at 06:15 and 18:15.
 *
 * A scheduled run is started exactly the way pressing the job's button starts one, through
 * JobController.start(), so everything true of a run is true here: one at a time per kind (a time
 * that comes due while a run is in flight does not start a second), progress and cancellation on
 * the admin page, and the stale-job sweep. The requester is recorded as "scheduler".
 *
 * Configured in .env, and off unless set:
 *   JOB_SCHEDULE=prairielearn-sync@06:15,prairielearn-sync@18:15
 *   JOB_SCHEDULE_TZ=America/Vancouver
 *
 * NOTE: times are wall-clock times in JOB_SCHEDULE_TZ, not in the process's zone. The container runs
 * on UTC, so "06:15" would otherwise fire at 23:15 the evening before. Intl does the conversion, so
 * the times stay put across daylight saving changes.
 *
 * NOTE: a time that passes while the backend is down (a deploy at 06:15) is skipped, not made up on
 * startup. The jobs worth scheduling are incremental, so the next run covers the gap.
 */
export class JobScheduler {
	/** Well under a minute, so every minute is seen even when a tick runs late. */
	private static readonly TICK_MS = 15 * 1000;

	/** Job.requestedBy for a scheduled run; it is also what the job's audit record names. */
	public static readonly REQUESTER = "scheduler";

	private readonly jc: Pick<JobController, "start" | "isRegistered">;
	private readonly timeZone: string;
	private readonly entries: ScheduleEntry[] = [];
	/** null when the time zone is missing or invalid, which disables the schedule */
	private readonly format: Intl.DateTimeFormat | null = null;
	/** entry label -> the local date it last fired on, so each time fires once a day */
	private readonly lastFired: Map<string, string> = new Map();
	private timer: ReturnType<typeof setInterval> | null = null;

	/**
	 * @param jc the controller that runs the jobs
	 * @param schedule e.g. "prairielearn-sync@06:15,prairielearn-sync@18:15"; empty schedules nothing
	 * @param timeZone an IANA zone, e.g. "America/Vancouver"; required when anything is scheduled
	 */
	public constructor(jc: Pick<JobController, "start" | "isRegistered">, schedule: string, timeZone: string) {
		this.jc = jc;
		this.timeZone = (timeZone ?? "").trim();

		for (const raw of (schedule ?? "").split(",")) {
			const text = raw.trim();
			if (text === "") {
				continue;
			}
			const entry = JobScheduler.parse(text);
			if (entry === null) {
				Log.error("JobScheduler::<init> - ignoring '" + text + "' in JOB_SCHEDULE; expected kind@HH:MM, e.g. prairielearn-sync@06:15");
			} else if (jc.isRegistered(entry.kind) === false) {
				Log.error("JobScheduler::<init> - ignoring '" + text + "' in JOB_SCHEDULE; there is no job kind '" + entry.kind + "'");
			} else {
				this.entries.push(entry);
			}
		}
		if (this.entries.length === 0) {
			return;
		}

		if (this.timeZone === "") {
			Log.error("JobScheduler::<init> - JOB_SCHEDULE is set but JOB_SCHEDULE_TZ is not (e.g. America/Vancouver); nothing is scheduled");
			return;
		}
		try {
			this.format = new Intl.DateTimeFormat("en-CA", {
				timeZone: this.timeZone,
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23", // midnight is 00, never 24
			});
		} catch (err) {
			Log.error(
				"JobScheduler::<init> - JOB_SCHEDULE_TZ '" + this.timeZone + "' is not a time zone (" + err.message + "); nothing is scheduled"
			);
		}
	}

	/**
	 * The scheduler for this deployment's .env.
	 *
	 * @param jc
	 * @returns {JobScheduler}
	 */
	public static fromConfig(jc: Pick<JobController, "start" | "isRegistered">): JobScheduler {
		const config = Config.getInstance();
		// hasProp first: getProp logs an error for an unset key, and both of these are optional
		const schedule = config.hasProp(ConfigKey.jobSchedule) ? config.getProp(ConfigKey.jobSchedule) : "";
		const timeZone = config.hasProp(ConfigKey.jobScheduleTz) ? config.getProp(ConfigKey.jobScheduleTz) : "";
		return new JobScheduler(jc, schedule, timeZone);
	}

	public isEnabled(): boolean {
		return this.entries.length > 0 && this.format !== null;
	}

	/** What is scheduled, as kind@HH:MM; empty when disabled. */
	public scheduled(): string[] {
		return this.isEnabled() ? this.entries.map((entry) => JobScheduler.label(entry)) : [];
	}

	public start(): void {
		if (this.isEnabled() === false) {
			Log.info("JobScheduler::start() - nothing scheduled");
			return;
		}
		this.stop();
		this.timer = setInterval(() => {
			// tick() handles its own errors, so this never rejects
			void this.tick(new Date());
		}, JobScheduler.TICK_MS);
		this.timer.unref(); // the server keeps the process alive; this timer should not
		Log.info("JobScheduler::start() - scheduled (" + this.timeZone + "): " + this.scheduled().join(", "));
	}

	public stop(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	/**
	 * Starts every entry that is due at `now` and has not already started today.
	 *
	 * Public so specs can drive it with a fixed clock rather than waiting for real minutes to pass.
	 *
	 * @param now
	 * @returns {Promise<string[]>} the entries whose job was started, as kind@HH:MM
	 */
	public async tick(now: Date = new Date()): Promise<string[]> {
		if (this.isEnabled() === false) {
			return [];
		}

		const local = this.localTime(now);
		const started: string[] = [];
		for (const entry of this.entries) {
			const label = JobScheduler.label(entry);
			if (entry.hour !== local.hour || entry.minute !== local.minute || this.lastFired.get(label) === local.date) {
				continue;
			}
			// recorded before starting: a start that fails is reported once, not retried every tick
			this.lastFired.set(label, local.date);
			try {
				const job = await this.jc.start(entry.kind, JobScheduler.REQUESTER, {});
				Log.info("JobScheduler::tick() - " + label + " (" + this.timeZone + ") is due; job: " + job.id);
				started.push(label);
			} catch (err) {
				Log.error("JobScheduler::tick() - " + label + " is due but could not be started: " + err.message);
			}
		}
		return started;
	}

	/** The date and time `now` reads on a wall clock in the schedule's zone. */
	private localTime(now: Date): { date: string; hour: number; minute: number } {
		const parts: { [type: string]: string } = {};
		for (const part of this.format.formatToParts(now)) {
			parts[part.type] = part.value;
		}
		return { date: parts.year + "-" + parts.month + "-" + parts.day, hour: Number(parts.hour), minute: Number(parts.minute) };
	}

	/**
	 * @param text e.g. "prairielearn-sync@06:15"; a one-digit hour is accepted
	 * @returns {ScheduleEntry | null} null if malformed
	 */
	private static parse(text: string): ScheduleEntry | null {
		const match = /^([^@\s]+)@(\d{1,2}):(\d{2})$/.exec(text);
		if (match === null) {
			return null;
		}
		const hour = Number(match[2]);
		const minute = Number(match[3]);
		if (hour > 23 || minute > 59) {
			return null;
		}
		return { kind: match[1], hour: hour, minute: minute };
	}

	private static label(entry: ScheduleEntry): string {
		return entry.kind + "@" + String(entry.hour).padStart(2, "0") + ":" + String(entry.minute).padStart(2, "0");
	}
}
