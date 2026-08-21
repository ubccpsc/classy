import { expect } from "chai";
import "mocha";

import Log from "@common/Log";
import Util from "@common/Util";

// NOTE: deliberately does not import GlobalSpec; these tests need neither the database nor
// GitHub, so keeping them standalone means they can be run on their own during development.

/**
 * Tests for Util.processConcurrently, which is what bounds how many repos
 * AdminController::performProvision provisions at once.
 *
 * NOTE: the timing tests below use a simulated per-item delay rather than real GitHub calls.
 * They measure the scheduling behaviour (that work actually overlaps), not real-world latency;
 * real gains depend on GitHub response times and secondary rate limits.
 */
describe("UtilConcurrency", () => {
	/**
	 * Tracks how many workers are in flight at once so tests can assert the cap is respected.
	 */
	class ConcurrencyTracker {
		public maxInFlight = 0;
		private inFlight = 0;

		public enter(): void {
			this.inFlight++;
			if (this.inFlight > this.maxInFlight) {
				this.maxInFlight = this.inFlight;
			}
		}

		public exit(): void {
			this.inFlight--;
		}
	}

	it("Should return an empty array for empty or invalid input.", async () => {
		expect(await Util.processConcurrently([], 4, async () => 1)).to.deep.equal([]);
		expect(await Util.processConcurrently(null, 4, async () => 1)).to.deep.equal([]);
	});

	it("Should return results in input order, not completion order.", async () => {
		const items = [50, 10, 40, 20, 30, 5];

		// slower items finish later, so completion order differs from input order
		const results = await Util.processConcurrently(items, 3, async (ms: number) => {
			await Util.delay(ms);
			return ms * 2;
		});

		expect(results).to.deep.equal([100, 20, 80, 40, 60, 10]);
	});

	it("Should process every item exactly once.", async () => {
		const items = [];
		for (let i = 0; i < 25; i++) {
			items.push(i);
		}

		const seen: number[] = [];
		const results = await Util.processConcurrently(items, 4, async (item: number) => {
			await Util.delay(1);
			seen.push(item);
			return item;
		});

		expect(results).to.deep.equal(items);
		expect(seen.length).to.equal(items.length);
		expect(seen.sort((a, b) => a - b)).to.deep.equal(items);
	});

	it("Should never exceed the requested concurrency.", async () => {
		const items = [];
		for (let i = 0; i < 20; i++) {
			items.push(i);
		}

		for (const limit of [1, 2, 5]) {
			const tracker = new ConcurrencyTracker();
			await Util.processConcurrently(items, limit, async () => {
				tracker.enter();
				await Util.delay(5);
				tracker.exit();
				return true;
			});

			Log.test("UtilConcurrency - limit: " + limit + "; observed max in flight: " + tracker.maxInFlight);
			expect(tracker.maxInFlight).to.be.at.most(limit);
			expect(tracker.maxInFlight).to.equal(limit); // should actually saturate the pool
		}
	});

	it("Should treat concurrency values below 1 as serial.", async () => {
		const items = [1, 2, 3, 4];

		for (const limit of [0, -5]) {
			const tracker = new ConcurrencyTracker();
			await Util.processConcurrently(items, limit, async () => {
				tracker.enter();
				await Util.delay(5);
				tracker.exit();
				return true;
			});
			expect(tracker.maxInFlight).to.equal(1);
		}
	});

	it("Should stop scheduling new work after a failure, but drain what is in flight.", async () => {
		const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
		const started: number[] = [];
		const finished: number[] = [];

		let err: Error = null;
		try {
			await Util.processConcurrently(items, 3, async (item: number) => {
				started.push(item);
				await Util.delay(10);
				if (item === 1) {
					throw new Error("worker failed on item 1");
				}
				finished.push(item);
				return item;
			});
		} catch (e) {
			err = e;
		}

		expect(err).to.not.be.null;
		expect(err.message).to.equal("worker failed on item 1");

		// the failure stops further scheduling, so most items are never started
		Log.test("UtilConcurrency - started after failure: " + JSON.stringify(started));
		expect(started.length).to.be.lessThan(items.length);

		// everything that was already in flight alongside the failure still completed
		expect(finished).to.contain(0);
		expect(finished).to.contain(2);
	});

	it("Should overlap work: concurrent should be measurably faster than serial.", async () => {
		const ITEM_COUNT = 12;
		const ITEM_DELAY = 40; // ms of simulated GitHub latency per item
		const CONCURRENCY = 4;

		const items = [];
		for (let i = 0; i < ITEM_COUNT; i++) {
			items.push(i);
		}
		const worker = async () => {
			await Util.delay(ITEM_DELAY);
			return true;
		};

		const serialStart = Date.now();
		await Util.processConcurrently(items, 1, worker);
		const serialTime = Date.now() - serialStart;

		const concurrentStart = Date.now();
		await Util.processConcurrently(items, CONCURRENCY, worker);
		const concurrentTime = Date.now() - concurrentStart;

		const speedup = serialTime / concurrentTime;
		Log.test(
			"UtilConcurrency - " +
				ITEM_COUNT +
				" items @ " +
				ITEM_DELAY +
				"ms; serial: " +
				serialTime +
				"ms; concurrency " +
				CONCURRENCY +
				": " +
				concurrentTime +
				"ms; speedup: " +
				speedup.toFixed(2) +
				"x"
		);

		// ideal speedup is CONCURRENCY (4x); assert well below that so timer jitter and slow
		// CI machines do not make this flaky, while still failing if the work stops overlapping
		expect(concurrentTime).to.be.lessThan(serialTime);
		expect(speedup).to.be.greaterThan(2);
	}).timeout(30000);
});
