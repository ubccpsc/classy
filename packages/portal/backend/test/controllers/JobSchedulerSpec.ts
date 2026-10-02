import { expect } from "chai";
import "mocha";

import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import Util from "@common/Util";
import "@common/GlobalSpec";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { JobController } from "@backend/controllers/JobController";
import { JobScheduler } from "@backend/controllers/JobScheduler";
import { Job, JobState } from "@backend/Types";

/**
 * Tests for starting jobs at fixed times of day.
 *
 * NOTE: no real waiting. tick() takes the time as a parameter, so each case hands it the instants it
 * is about, and the timer that calls it in production is not involved.
 *
 * The instants are UTC, and the schedules are in America/Vancouver, which is UTC-7 on the October
 * dates used here: 06:15 local is 13:15Z on 2026-10-02. Only October is used for Vancouver because
 * its winter offset depends on the time-zone data Node ships (tz 2026c keeps it at UTC-7 all year;
 * older data has UTC-8), so the daylight saving case uses a zone whose rule has not changed.
 */
describe("JobScheduler", function () {
	const TZ = "America/Vancouver";
	const KINDS = ["prairielearn-sync", "user-sync"];

	/** A JobController stand-in that records what it was asked to start. */
	function fakeJobs(fails: (attempt: number) => boolean = () => false) {
		const calls: Array<{ kind: string; requestedBy: string }> = [];
		let attempts = 0;
		const jc = {
			isRegistered: (kind: string): boolean => KINDS.indexOf(kind) >= 0,
			start: async (kind: string, requestedBy: string): Promise<Job> => {
				attempts++;
				if (fails(attempts) === true) {
					throw new Error("could not start " + kind);
				}
				calls.push({ kind: kind, requestedBy: requestedBy });
				return { id: kind + "_" + calls.length } as Job;
			},
		};
		return { jc: jc, calls: calls };
	}

	const at = (iso: string): Date => new Date(iso);

	before(async function () {
		await TestHarness.suiteBefore("JobScheduler");
	});

	after(function () {
		TestHarness.suiteAfter("JobScheduler");
	});

	it("Should start a job at its time in the schedule's zone, not the server's.", async function () {
		const { jc, calls } = fakeJobs();
		const scheduler = new JobScheduler(jc, "prairielearn-sync@06:15", TZ);

		// 06:15 UTC is 23:15 the evening before in Vancouver
		expect(await scheduler.tick(at("2026-10-02T06:15:20Z"))).to.deep.equal([]);
		expect(await scheduler.tick(at("2026-10-02T13:15:20Z"))).to.deep.equal(["prairielearn-sync@06:15"]);
		expect(calls).to.deep.equal([{ kind: "prairielearn-sync", requestedBy: JobScheduler.REQUESTER }]);
	});

	it("Should keep the local time across a daylight saving change.", async function () {
		// London is UTC+1 until late October and UTC+0 after, so 06:15 local moves from 05:15Z to 06:15Z
		const { jc, calls } = fakeJobs();
		const scheduler = new JobScheduler(jc, "prairielearn-sync@06:15", "Europe/London");

		expect(await scheduler.tick(at("2026-10-02T05:15:20Z")), "06:15 in summer time").to.deep.equal(["prairielearn-sync@06:15"]);
		expect(await scheduler.tick(at("2026-12-01T05:15:20Z")), "05:15 in winter time").to.deep.equal([]);
		expect(await scheduler.tick(at("2026-12-01T06:15:20Z")), "06:15 in winter time").to.deep.equal(["prairielearn-sync@06:15"]);
		expect(calls.length).to.equal(2);
	});

	it("Should start each time once, however many ticks fall in its minute.", async function () {
		const { jc, calls } = fakeJobs();
		const scheduler = new JobScheduler(jc, "prairielearn-sync@06:15", TZ);

		for (const second of ["00", "15", "30", "59"]) {
			await scheduler.tick(at("2026-10-02T13:15:" + second + "Z"));
		}
		expect(calls.length, "once on the day").to.equal(1);

		await scheduler.tick(at("2026-10-03T13:15:05Z"));
		expect(calls.length, "and again the next day").to.equal(2);
	});

	it("Should start everything that is due, and nothing that is not.", async function () {
		const { jc, calls } = fakeJobs();
		const scheduler = new JobScheduler(jc, "prairielearn-sync@06:15, prairielearn-sync@18:15, user-sync@06:15", TZ);

		expect((await scheduler.tick(at("2026-10-02T13:15:10Z"))).sort(), "06:15").to.deep.equal([
			"prairielearn-sync@06:15",
			"user-sync@06:15",
		]);
		expect(await scheduler.tick(at("2026-10-02T19:00:10Z")), "noon").to.deep.equal([]);
		// 18:15 on Oct 2 in Vancouver is already Oct 3 in UTC
		expect(await scheduler.tick(at("2026-10-03T01:15:10Z")), "18:15").to.deep.equal(["prairielearn-sync@18:15"]);

		expect(calls.length).to.equal(3);
		for (const call of calls) {
			expect(call.requestedBy, "every scheduled run names the scheduler").to.equal(JobScheduler.REQUESTER);
		}
	});

	it("Should start a job scheduled at midnight.", async function () {
		const { jc } = fakeJobs();
		const scheduler = new JobScheduler(jc, "user-sync@00:00", TZ);

		expect(await scheduler.tick(at("2026-10-02T07:00:30Z"))).to.deep.equal(["user-sync@00:00"]);
	});

	it("Should ignore malformed entries and unknown kinds, keeping the rest.", async function () {
		const { jc } = fakeJobs();
		const scheduler = new JobScheduler(
			jc,
			"prairielearn-sync@6:15, nonsense, no-such-kind@07:00, user-sync@25:00, user-sync@07:60, prairielearn-sync@18:15,",
			TZ
		);

		expect(scheduler.isEnabled()).to.be.true;
		expect(scheduler.scheduled(), "a one-digit hour is fine; the rest are reported and dropped").to.deep.equal([
			"prairielearn-sync@06:15",
			"prairielearn-sync@18:15",
		]);
	});

	it("Should schedule nothing without a valid time zone.", async function () {
		// the container runs on UTC, so falling back to the process's zone would quietly fire hours off
		for (const tz of ["", "  ", "Mars/Olympus", undefined]) {
			const { jc, calls } = fakeJobs();
			const scheduler = new JobScheduler(jc, "prairielearn-sync@06:15", tz);

			expect(scheduler.isEnabled(), "time zone: " + tz).to.be.false;
			expect(scheduler.scheduled()).to.deep.equal([]);
			expect(await scheduler.tick(at("2026-10-02T13:15:20Z"))).to.deep.equal([]);
			expect(calls.length).to.equal(0);
		}
	});

	it("Should schedule nothing when JOB_SCHEDULE is unset or empty.", async function () {
		for (const schedule of [undefined, "", " , "]) {
			const { jc } = fakeJobs();
			const scheduler = new JobScheduler(jc, schedule, TZ);

			expect(scheduler.isEnabled()).to.be.false;
			scheduler.start(); // starts no timer
			scheduler.stop();
		}
	});

	it("Should keep going when a job cannot be started.", async function () {
		const { jc, calls } = fakeJobs((attempt) => attempt === 1);
		const scheduler = new JobScheduler(jc, "prairielearn-sync@06:15", TZ);

		expect(await scheduler.tick(at("2026-10-02T13:15:00Z")), "reported, not thrown").to.deep.equal([]);
		expect(await scheduler.tick(at("2026-10-02T13:15:30Z")), "and not retried every tick").to.deep.equal([]);
		expect(await scheduler.tick(at("2026-10-03T13:15:00Z")), "the next day starts normally").to.deep.equal(["prairielearn-sync@06:15"]);
		expect(calls.length).to.equal(1);
	});

	describe("with the real JobController", function () {
		const jc = JobController.getInstance();
		const dc = DatabaseController.getInstance();

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

		it("Should record a scheduled run as requested by the scheduler.", async function () {
			const kind = "test-scheduled-" + Date.now();
			jc.register(kind, async () => {
				return { ran: true };
			});
			const scheduler = new JobScheduler(jc, kind + "@06:15", TZ);

			expect(await scheduler.tick(at("2026-10-02T13:15:20Z"))).to.deep.equal([kind + "@06:15"]);

			const jobs = await dc.getJobs({ kind: kind });
			expect(jobs.length).to.equal(1);
			expect(jobs[0].requestedBy).to.equal(JobScheduler.REQUESTER);
			const done = await waitForState(jobs[0].id);
			expect(done.state).to.equal(JobState.SUCCEEDED);
			expect(done.summary).to.deep.equal({ ran: true });
		});

		it("Should never start a second run while one is in flight.", async function () {
			// e.g. a sync someone started by hand at 06:10 that is still going at 06:15
			const kind = "test-scheduled-busy-" + Date.now();
			let release: () => void = null;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			jc.register(kind, async () => {
				await gate;
				return null;
			});

			const manual = await jc.start(kind, TestHarness.ADMIN1.id);
			const scheduler = new JobScheduler(jc, kind + "@06:15", TZ);
			await scheduler.tick(at("2026-10-02T13:15:20Z"));

			const jobs = await dc.getJobs({ kind: kind });
			Log.test("JobScheduler - jobs of the kind after the scheduled time: " + jobs.length);
			expect(jobs.length, "the run in flight, and no second one").to.equal(1);
			expect(jobs[0].id).to.equal(manual.id);

			release();
			expect((await waitForState(manual.id)).state).to.equal(JobState.SUCCEEDED);
		});
	});
});
