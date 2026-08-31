import { expect } from "chai";
import "mocha";
import fetch, { RequestInit } from "node-fetch";

import "@common/GlobalSpec"; // load first

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { GitHubActions, IGitHubActions } from "@backend/controllers/GitHubActions";
import { RepoStatus, Repository, Team, TeamStatus } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import Util from "@common/Util";

/**
 * Stress / concurrency suite for a GitHub Enterprise instance.
 *
 * WHAT THIS IS FOR
 * Classy provisions courses by issuing a lot of concurrent requests at GHE. This suite answers
 * three questions that the normal test suite cannot:
 *
 *   1. Correctness under concurrency: do concurrent writes race, drop updates, or corrupt state?
 *   2. Capacity: at what concurrency does GHE stop giving us throughput, or start refusing?
 *   3. Error surface: what does GHE actually return when pushed (status codes, rate-limit headers)?
 *
 * WHY IT IS OFF BY DEFAULT
 * Unlike the rest of the suite, this creates and deletes a lot of real repos and teams. It is
 * slow, it puts real load on the server, and a failure here is usually a statement about the
 * GHE instance rather than about Classy. Run it deliberately -- e.g., when qualifying a new GHE
 * version -- not on every build.
 *
 * HOW TO RUN
 *   cd packages/portal/backend
 *   GH_STRESS=true TS_NODE_BASEURL=. node --require dotenv/config --require tsconfig-paths/register \
 *       ./node_modules/.bin/mocha --timeout 3000000 --exit test/controllers/GitHubStressSpec.js
 *
 * Tuning (all optional):
 *   GH_STRESS_SCALE=6            how many objects per concurrent batch
 *   GH_STRESS_LEVELS=1,2,4,8     concurrency levels to measure
 *   GH_STRESS_TEMPLATE=true      also measure template-based repo creation (much slower, but it
 *                                is what provisioning actually does)
 *
 * SAFETY
 * Everything is created under a fixed name prefix and the suite refuses to run unless the
 * configured org is the *test* org. Cleanup sweeps the prefix both before and after, so a
 * crashed run does not leak objects into the next one.
 */
describe("GitHubStress", function () {
	/**
	 * Every object this suite creates starts with this. Cleanup deletes anything matching,
	 * so it must be distinctive enough that it can never collide with real course repos.
	 */
	const PREFIX = "classystress_";

	const ENABLED = process.env.GH_STRESS === "true";
	const SCALE = Number(process.env.GH_STRESS_SCALE || 6);
	const LEVELS: number[] = (process.env.GH_STRESS_LEVELS || "1,2,4,8")
		.split(",")
		.map((s) => Number(s.trim()))
		.filter((n) => isNaN(n) === false && n > 0);
	const RUN_TEMPLATE = process.env.GH_STRESS_TEMPLATE === "true";

	const TIMEOUT = 1000 * 60 * 30; // these are long-running by nature

	let gh: IGitHubActions;
	let dbc: DatabaseController;
	const OLDORG = Config.getInstance().getProp(ConfigKey.org);

	/**
	 * One recorded HTTP outcome. Collected so the suite can report what GHE actually did,
	 * rather than only whether our wrapper returned true.
	 */
	interface CallOutcome {
		label: string;
		status: number;
		ms: number;
		rateLimitRemaining: string | null;
		retryAfter: string | null;
		secondaryLimit: boolean;
	}

	const outcomes: CallOutcome[] = [];

	/**
	 * Issues a request directly (not through GitHubActions) so status codes and rate-limit
	 * headers stay visible. GitHubActions deliberately swallows most of this -- repoExists
	 * returns true for any non-404, for instance -- which is exactly what we must not do here.
	 */
	async function probe(label: string, method: string, path: string, body?: object): Promise<CallOutcome> {
		const c = Config.getInstance();
		const options: RequestInit = {
			method: method,
			headers: {
				Authorization: c.getProp(ConfigKey.githubBotToken),
				"User-Agent": c.getProp(ConfigKey.githubBotName),
				Accept: "application/vnd.github+json",
			},
		};
		if (typeof body !== "undefined") {
			options.body = JSON.stringify(body);
		}

		const start = Date.now();
		let status = -1;
		let remaining: string | null = null;
		let retryAfter: string | null = null;
		let secondary = false;
		try {
			const response = await fetch(c.getProp(ConfigKey.githubAPI) + path, options);
			status = response.status;
			remaining = response.headers.get("x-ratelimit-remaining");
			retryAfter = response.headers.get("retry-after");
			if (status === 403 || status === 429) {
				const text = await response.text();
				secondary = text.indexOf("secondary rate limit") >= 0 || text.indexOf("abuse") >= 0;
				Log.warn("GitHubStress::probe( " + label + " ) - " + status + "; body: " + text.substring(0, 200));
			}
		} catch (err) {
			Log.warn("GitHubStress::probe( " + label + " ) - ERROR: " + err.message);
		}

		const outcome: CallOutcome = {
			label: label,
			status: status,
			ms: Date.now() - start,
			rateLimitRemaining: remaining,
			retryAfter: retryAfter,
			secondaryLimit: secondary,
		};
		outcomes.push(outcome);
		return outcome;
	}

	function repoName(i: number): string {
		return PREFIX + "repo_" + i;
	}

	function teamName(i: number): string {
		return PREFIX + "team_" + i;
	}

	/**
	 * GitHubActions::checkDatabase requires the repo/team to exist in the datastore before it
	 * will touch GitHub, so seed minimal records.
	 */
	async function seedRepoRecord(name: string): Promise<void> {
		const repo: Repository = {
			id: name,
			delivId: TestHarness.DELIVID0,
			teamIds: [],
			URL: null,
			cloneURL: null,
			gitHubStatus: RepoStatus.NOT_CREATED,
			custom: {},
		};
		await dbc.writeRepository(repo);
	}

	async function seedTeamRecord(name: string): Promise<void> {
		const team: Team = {
			id: name,
			delivId: TestHarness.DELIVID0,
			personIds: [],
			URL: null,
			gitHubStatus: TeamStatus.NOT_CREATED,
			githubId: null,
			custom: {},
		};
		await dbc.writeTeam(team);
	}

	/**
	 * Deletes every repo and team matching PREFIX. Runs before and after so a crashed run
	 * cannot poison the next one.
	 */
	async function sweep(): Promise<void> {
		const org = Config.getInstance().getProp(ConfigKey.org);
		// hard safety gate: never sweep anything but the test org
		expect(org).to.equal(Config.getInstance().getProp(ConfigKey.testorg));

		Log.test("GitHubStress::sweep() - start; org: " + org);
		const repos = await gh.listRepos();
		const staleRepos = repos.filter((r) => r.repoName.startsWith(PREFIX));
		const teams = await gh.listTeams();
		const staleTeams = teams.filter((t) => t.teamName.startsWith(PREFIX));
		Log.test("GitHubStress::sweep() - stale repos: " + staleRepos.length + "; stale teams: " + staleTeams.length);

		await Util.processConcurrently(staleRepos, 4, async (r) => gh.deleteRepo(r.repoName));
		await Util.processConcurrently(staleTeams, 4, async (t) => gh.deleteTeam(t.teamName));
		Log.test("GitHubStress::sweep() - done");
	}

	/**
	 * Runs `worker` over `count` items at each concurrency level and reports the shape of the
	 * curve. Timing is reported, never asserted: absolute numbers depend on the server, but a
	 * failed request or a collapse in throughput is a real signal.
	 */
	async function measure(
		name: string,
		levels: number[],
		count: number,
		worker: (index: number, level: number) => Promise<boolean>,
		betweenLevels?: () => Promise<void>
	): Promise<void> {
		const rows: Array<{ level: number; ms: number; ok: number; failed: number }> = [];

		for (const level of levels) {
			const items: number[] = [];
			for (let i = 0; i < count; i++) {
				items.push(i);
			}

			let ok = 0;
			let failed = 0;
			const start = Date.now();
			await Util.processConcurrently(items, level, async (i: number) => {
				let success = false;
				try {
					success = await worker(i, level);
				} catch (err) {
					Log.warn("GitHubStress::measure( " + name + " ) - worker threw at level " + level + ": " + err.message);
				}
				if (success === true) {
					ok++;
				} else {
					failed++;
				}
				return success;
			});
			const ms = Date.now() - start;
			rows.push({ level: level, ms: ms, ok: ok, failed: failed });
			Log.test("GitHubStress[" + name + "] - concurrency " + level + ": " + ms + " ms; ok: " + ok + "; failed: " + failed);

			if (typeof betweenLevels !== "undefined") {
				await betweenLevels();
			}
			await Util.delay(2000); // let any secondary-limit budget recover between levels
		}

		Log.test("");
		Log.test("=== " + name + " (" + count + " ops per level) ===");
		Log.test("  concurrency |    total |  speedup | ok | failed");
		for (const r of rows) {
			const speedup = rows[0].ms / r.ms;
			Log.test(
				"  " +
					String(r.level).padStart(11) +
					" | " +
					String(r.ms + " ms").padStart(8) +
					" | " +
					String(speedup.toFixed(2) + "x").padStart(8) +
					" | " +
					String(r.ok).padStart(2) +
					" | " +
					String(r.failed).padStart(6)
			);
		}
		Log.test("");

		// the timing is informational, but losing operations is not
		for (const r of rows) {
			expect(r.failed, name + " had failures at concurrency " + r.level).to.equal(0);
		}
	}

	before(async function () {
		this.timeout(TIMEOUT);
		if (ENABLED === false) {
			return;
		}

		Log.test("GitHubStressSpec::before() - forcing testorg");
		Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
		await TestHarness.suiteBefore("GitHubStressSpec");

		gh = GitHubActions.getInstance(true);
		dbc = DatabaseController.getInstance();
		await TestHarness.prepareDeliverables();

		Log.test("GitHubStressSpec::before() - scale: " + SCALE + "; levels: " + JSON.stringify(LEVELS));
		await sweep();
	});

	after(async function () {
		this.timeout(TIMEOUT);
		if (ENABLED === true) {
			await sweep();

			// report the error surface once, at the end, across everything the suite issued
			const bad = outcomes.filter((o) => o.status >= 400 || o.status < 0);
			const secondary = outcomes.filter((o) => o.secondaryLimit === true);
			Log.test("");
			Log.test("=== GitHubStress error surface ===");
			Log.test("  probed calls: " + outcomes.length + "; non-2xx/failed: " + bad.length + "; secondary limits: " + secondary.length);
			const seen: { [status: string]: number } = {};
			for (const o of outcomes) {
				seen[String(o.status)] = (seen[String(o.status)] || 0) + 1;
			}
			for (const status of Object.keys(seen)) {
				Log.test("    status " + status + ": " + seen[status]);
			}
			const lastRemaining = outcomes.filter((o) => o.rateLimitRemaining !== null).pop();
			if (typeof lastRemaining !== "undefined") {
				Log.test("  x-ratelimit-remaining (last seen): " + lastRemaining.rateLimitRemaining);
			}
			Log.test("");

			// only restore config if we actually changed it; a disabled run must be fully inert
			Config.getInstance().setProp(ConfigKey.org, OLDORG);
			TestHarness.suiteAfter("GitHubStressSpec");
		}
	});

	beforeEach(function () {
		if (ENABLED === false) {
			// NOTE: deliberately NOT gated on TestHarness.runSlowTest(); this must stay off in CI
			// and only run when someone explicitly asks for it.
			Log.test("GitHubStressSpec - skipping (set GH_STRESS=true to enable)");
			this.skip();
		}
	});

	// ----------------------------------------------------------------------------------
	// 1. Capacity: how much concurrency does this GHE instance actually reward?
	// ----------------------------------------------------------------------------------

	it("Should measure read throughput across concurrency levels.", async function () {
		const org = Config.getInstance().getProp(ConfigKey.org);
		const repos = await gh.listRepos();
		expect(repos.length, "test org has no repos to read").to.be.greaterThan(0);

		await measure("reads (GET /repos)", LEVELS, SCALE * 4, async (i: number) => {
			const target = repos[i % repos.length].repoName;
			const outcome = await probe("read", "GET", "/repos/" + org + "/" + target);
			return outcome.status === 200;
		});
	}).timeout(TIMEOUT);

	it("Should measure write throughput (repo create/delete) across concurrency levels.", async function () {
		await measure(
			"writes (create repo)",
			LEVELS,
			SCALE,
			async (i: number) => {
				const name = repoName(i);
				await seedRepoRecord(name);
				const url = await gh.createRepo(name);
				return typeof url === "string" && url.length > 0;
			},
			async () => {
				// each level must start from a clean slate, since createRepo fails on an existing repo
				await sweep();
			}
		);
	}).timeout(TIMEOUT);

	it("Should measure template-based repo creation (what provisioning actually does).", async function () {
		if (RUN_TEMPLATE === false) {
			Log.test("GitHubStress - template measurement skipped (set GH_STRESS_TEMPLATE=true)");
			this.skip();
			return;
		}

		const org = Config.getInstance().getProp(ConfigKey.org);
		await measure(
			"writes (create repo from template)",
			LEVELS,
			SCALE,
			async (i: number) => {
				const name = repoName(i);
				await seedRepoRecord(name);
				const url = await gh.createRepoFromTemplate(name, org, TestHarness.REPONAMEREAL_TESTINGSAMPLE);
				return typeof url === "string" && url.length > 0;
			},
			async () => {
				await sweep();
			}
		);
	}).timeout(TIMEOUT);

	// ----------------------------------------------------------------------------------
	// 2. Correctness: do concurrent writes race?
	// ----------------------------------------------------------------------------------

	it("Should create distinct repos concurrently without losing or duplicating any.", async function () {
		await sweep();

		const names: string[] = [];
		for (let i = 0; i < SCALE; i++) {
			names.push(repoName(i));
			await seedRepoRecord(repoName(i));
		}

		const urls = await Util.processConcurrently(names, SCALE, async (name: string) => gh.createRepo(name));

		// every call returned a distinct URL
		const unique = new Set(urls);
		expect(unique.size, "concurrent createRepo returned duplicate URLs: " + JSON.stringify(urls)).to.equal(names.length);

		// and GitHub agrees every one of them exists
		const exists = await Util.processConcurrently(names, SCALE, async (name: string) => gh.repoExists(name));
		for (let i = 0; i < names.length; i++) {
			expect(exists[i], "repo missing after concurrent create: " + names[i]).to.be.true;
		}

		// and the datastore was updated for each one (this is the write that races, not GitHub)
		for (const name of names) {
			const record = await dbc.getRepository(name);
			expect(record, "no db record for " + name).to.not.be.null;
			expect(record.URL, "db URL not set for " + name).to.not.be.null;
			// createRepo records the URL but not the status: the repo exists on GitHub with no
			// webhook and no staff teams, which is GitHubController's job to finish
			expect(record.gitHubStatus, "createRepo must not change status: " + name).to.equal(RepoStatus.NOT_CREATED);
		}
	}).timeout(TIMEOUT);

	it("Should handle two concurrent creates of the SAME repo without corrupting state.", async function () {
		await sweep();

		const name = repoName(0);
		await seedRepoRecord(name);

		// both calls target one name; whatever GHE does, we must not end up with a broken record
		const results = await Promise.all([
			gh.createRepo(name).catch((err) => "ERROR: " + err.message),
			gh.createRepo(name).catch((err) => "ERROR: " + err.message),
		]);
		Log.test("GitHubStress - same-name concurrent create results: " + JSON.stringify(results));

		const succeeded = results.filter((r) => typeof r === "string" && r.startsWith("ERROR") === false);
		expect(succeeded.length, "expected at least one create to succeed").to.be.greaterThan(0);

		expect(await gh.repoExists(name)).to.be.true;
		const record = await dbc.getRepository(name);
		expect(record.URL, "db URL left null after racing creates").to.not.be.null;
	}).timeout(TIMEOUT);

	it("Should not lose members when they are added to one team concurrently.", async function () {
		await sweep();

		const name = teamName(0);
		await seedTeamRecord(name);
		await gh.createTeam(name, "push");

		// classic lost-update shape: independent writers, one shared object
		const members = [TestHarness.GITHUB1.github, TestHarness.GITHUB2.github, TestHarness.GITHUB3.github];
		await Util.processConcurrently(members, members.length, async (member: string) => gh.addMembersToTeam(name, [member]));

		const after = await gh.getTeamMembers(name);
		Log.test("GitHubStress - team members after concurrent add: " + JSON.stringify(after));
		for (const member of members) {
			expect(after, "member lost in concurrent add: " + member).to.contain(member);
		}
	}).timeout(TIMEOUT);

	it("Should not lose teams when several are attached to one repo concurrently.", async function () {
		await sweep();

		const repo = repoName(0);
		await seedRepoRecord(repo);
		await gh.createRepo(repo);

		const names: string[] = [];
		for (let i = 0; i < 3; i++) {
			names.push(teamName(i));
			await seedTeamRecord(teamName(i));
			await gh.createTeam(teamName(i), "push");
		}

		await Util.processConcurrently(names, names.length, async (name: string) => gh.addTeamToRepo(name, repo, "push"));

		const onRepo = await gh.getTeamsOnRepo(repo);
		const attached = onRepo.map((t) => t.teamName);
		Log.test("GitHubStress - teams on repo after concurrent attach: " + JSON.stringify(attached));
		for (const name of names) {
			expect(attached, "team lost in concurrent attach: " + name).to.contain(name);
		}
	}).timeout(TIMEOUT);

	it("Should report the same repo state to concurrent readers while it is being written.", async function () {
		await sweep();

		const repo = repoName(0);
		await seedRepoRecord(repo);
		await gh.createRepo(repo);

		// hammer reads while a write is in flight; looking for transient 404s/500s on a repo
		// that definitely exists, which is what makes provisioning readiness checks flaky
		const reads: Array<Promise<boolean>> = [];
		const writePromise = gh.updateRepo(repo);
		for (let i = 0; i < SCALE * 4; i++) {
			reads.push(gh.repoExists(repo));
		}
		const readResults = await Promise.all(reads);
		await writePromise;

		const missing = readResults.filter((r) => r === false).length;
		expect(missing, "repoExists reported false for a repo that exists, during a concurrent write").to.equal(0);
	}).timeout(TIMEOUT);
});
