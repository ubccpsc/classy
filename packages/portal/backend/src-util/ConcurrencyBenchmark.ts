import Config, { ConfigKey } from "@common/Config";
import Log, { LogLevel } from "@common/Log";
import Util from "@common/Util";
import fetch, { RequestInit } from "node-fetch";

/**
 * Measures how much concurrency actually buys against the configured GitHub instance.
 *
 * This is READ-ONLY: it only issues GET /repos/{org}/{repo} against repos that already
 * exist in the org. It creates nothing, modifies nothing, and deletes nothing, so it is
 * safe to run repeatedly (unlike a full provisioning benchmark).
 *
 * The point is to inform AdminController.PROVISION_CONCURRENCY: run it and look for the
 * level where throughput stops improving, or where non-200 responses start appearing
 * (GitHub applies secondary rate limits to bursts of concurrent requests).
 *
 * NOTE: read latency is a lower bound on what provisioning sees. A provision is many calls,
 * several of them writes, so treat the shape of the curve as the signal, not the absolute
 * numbers.
 *
 * To run:
 * 1) have a .env configured for the org you want to measure (ORGTEST is used by default)
 * 2) build (src-util is not part of the main backend build):
 *      cd packages/portal/backend && ../../../node_modules/typescript/bin/tsc -p tsconfig.src-util.json
 * 3) run it (the @common/* path aliases need tsconfig-paths at runtime):
 *      cd packages/portal/backend
 *      TS_NODE_BASEURL=. node --require dotenv/config --require tsconfig-paths/register \
 *          src-util/ConcurrencyBenchmark.js
 */
export class ConcurrencyBenchmark {
	/**
	 * Concurrency levels to measure. 1 is the serial baseline.
	 */
	private readonly levels: number[] = [1, 2, 4, 8, 16];

	/**
	 * How many requests to issue at each level. Every level does the same amount of work,
	 * so the wall-clock times are directly comparable.
	 */
	private readonly requestCount: number = 24;

	/**
	 * Use the test org rather than the live course org; this is read-only, but there is no
	 * reason to point load at the org students are using.
	 */
	private readonly useTestOrg: boolean = true;

	private readonly org: string;
	private readonly apiPath: string;
	private readonly botName: string;
	private readonly botToken: string;

	public constructor() {
		const c = Config.getInstance();
		this.org = this.useTestOrg ? c.getProp(ConfigKey.testorg) : c.getProp(ConfigKey.org);
		this.apiPath = c.getProp(ConfigKey.githubAPI);
		this.botName = c.getProp(ConfigKey.githubBotName);
		this.botToken = c.getProp(ConfigKey.githubBotToken);
	}

	public async run(): Promise<void> {
		Log.info("ConcurrencyBenchmark::run() - start; org: " + this.org + "; api: " + this.apiPath);

		const repoNames = await this.listRepoNames();
		if (repoNames.length === 0) {
			Log.error("ConcurrencyBenchmark::run() - no repos found in org: " + this.org + "; nothing to measure");
			return;
		}
		Log.info("ConcurrencyBenchmark::run() - repos available: " + repoNames.length);

		// build the request list by cycling through the available repos so every level does
		// exactly the same work, even if the org has fewer repos than requestCount
		const targets: string[] = [];
		for (let i = 0; i < this.requestCount; i++) {
			targets.push(repoNames[i % repoNames.length]);
		}

		Log.info("ConcurrencyBenchmark::run() - warming up (first request pays TLS/DNS setup)");
		await this.getRepo(targets[0]);

		const rows: Array<{ level: number; ms: number; ok: number; failed: number; meanMs: number }> = [];

		for (const level of this.levels) {
			const latencies: number[] = [];
			let ok = 0;
			let failed = 0;

			const start = Date.now();
			await Util.processConcurrently(targets, level, async (repoName: string) => {
				const callStart = Date.now();
				const status = await this.getRepo(repoName);
				latencies.push(Date.now() - callStart);
				if (status === 200) {
					ok++;
				} else {
					failed++;
					Log.warn("ConcurrencyBenchmark - non-200 at concurrency " + level + "; repo: " + repoName + "; status: " + status);
				}
				return status;
			});
			const ms = Date.now() - start;

			let total = 0;
			for (const l of latencies) {
				total += l;
			}
			const meanMs = Math.round(total / latencies.length);
			rows.push({ level: level, ms: ms, ok: ok, failed: failed, meanMs: meanMs });
			Log.info(
				"ConcurrencyBenchmark - concurrency " +
					level +
					": " +
					ms +
					" ms; ok: " +
					ok +
					"; failed: " +
					failed +
					"; mean call: " +
					meanMs +
					" ms"
			);

			// let any secondary rate limit budget recover before the next level, so each
			// level is measured from a comparable starting state
			await Util.delay(2000);
		}

		this.report(rows);
	}

	private report(rows: Array<{ level: number; ms: number; ok: number; failed: number; meanMs: number }>): void {
		const baseline = rows[0];
		Log.info("");
		Log.info("=== ConcurrencyBenchmark results: " + this.requestCount + " x GET /repos/" + this.org + "/{repo} ===");
		Log.info("  concurrency |    total |  speedup | mean call | ok | failed");
		for (const r of rows) {
			const speedup = baseline.ms / r.ms;
			Log.info(
				"  " +
					String(r.level).padStart(11) +
					" | " +
					String(r.ms + " ms").padStart(8) +
					" | " +
					String(speedup.toFixed(2) + "x").padStart(8) +
					" | " +
					String(r.meanMs + " ms").padStart(9) +
					" | " +
					String(r.ok).padStart(2) +
					" | " +
					String(r.failed).padStart(6)
			);
		}
		Log.info("");
		Log.info("Reading this: pick the highest level where speedup is still climbing AND failed is 0.");
		Log.info("If mean call time rises sharply with concurrency, the server is queueing and more workers will not help.");
		Log.info("Any non-zero 'failed' at a level is a signal to stay below it.");
	}

	/**
	 * GET a single repo; returns the HTTP status (no body parsing, to keep the timing about the request).
	 */
	private async getRepo(repoName: string): Promise<number> {
		const uri = this.apiPath + "/repos/" + this.org + "/" + repoName;
		const options: RequestInit = {
			method: "GET",
			headers: {
				Authorization: this.botToken,
				"User-Agent": this.botName,
				Accept: "application/vnd.github+json",
			},
		};
		try {
			const response = await fetch(uri, options);
			return response.status;
		} catch (err) {
			Log.warn("ConcurrencyBenchmark::getRepo( " + repoName + " ) - ERROR: " + err.message);
			return -1;
		}
	}

	/**
	 * One page of repos is plenty; this only needs targets to read.
	 */
	private async listRepoNames(): Promise<string[]> {
		const uri = this.apiPath + "/orgs/" + this.org + "/repos?per_page=100";
		const options: RequestInit = {
			method: "GET",
			headers: {
				Authorization: this.botToken,
				"User-Agent": this.botName,
				Accept: "application/vnd.github+json",
			},
		};
		const response = await fetch(uri, options);
		if (response.status !== 200) {
			Log.error("ConcurrencyBenchmark::listRepoNames() - failed; status: " + response.status);
			return [];
		}
		const body = await response.json();
		const names: string[] = [];
		for (const entry of body) {
			names.push(entry.name);
		}
		return names;
	}
}

const bench = new ConcurrencyBenchmark();
const startTime = Date.now();
Log.Level = LogLevel.INFO;
bench
	.run()
	.then(function () {
		Log.info("ConcurrencyBenchmark::run() - complete; took: " + Util.took(startTime));
		process.exit();
	})
	.catch(function (err) {
		Log.error("ConcurrencyBenchmark::run() - ERROR: " + err.message);
		process.exit();
	});
