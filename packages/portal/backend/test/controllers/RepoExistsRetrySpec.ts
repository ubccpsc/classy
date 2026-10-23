import { expect } from "chai";
import "mocha";

import { GitHubActions, IGitHubActions } from "@backend/controllers/GitHubActions";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import * as http from "http";
import type { AddressInfo } from "net";

import "@common/GlobalSpec"; // load first

/**
 * repoExists( .., confirmAbsence ) against a stub that can answer 404 once.
 *
 * NOTE: no real GitHub. GitHubActions reads githubAPI from config when it is constructed, so
 * pointing that at a loopback server is enough to drive the real code path -- the same trick
 * StubAutoTestService and StubGitHubService use. That matters here because the behaviour under test
 * only appears when GitHub answers 404 for a repository that exists, which cannot be provoked
 * against the real service.
 */
describe("repoExists absence confirmation", function () {
	let server: http.Server = null;
	let realApi: string = null;

	/** repo name -> how many 404s to serve before admitting it exists; -1 means always 404. */
	let script: { [repo: string]: number } = {};
	let requests: string[] = [];

	before(async function () {
		await TestHarness.suiteBefore("repoExists absence confirmation");

		server = http.createServer((req, res) => {
			req.resume();
			req.on("end", () => {
				requests.push(req.url);
				const repo = req.url.substring(req.url.lastIndexOf("/") + 1);
				const remaining = typeof script[repo] === "undefined" ? 0 : script[repo];

				if (remaining !== 0) {
					if (remaining > 0) {
						script[repo] = remaining - 1;
					}
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ message: "Not Found" }));
					return;
				}
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ name: repo }));
			});
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const port = (server.address() as AddressInfo).port;

		realApi = Config.getInstance().getProp(ConfigKey.githubAPI);
		Config.getInstance().setProp(ConfigKey.githubAPI, "http://127.0.0.1:" + port);
		Log.test("repoExists stub listening on 127.0.0.1:" + port);
	});

	after(async function () {
		Config.getInstance().setProp(ConfigKey.githubAPI, realApi);
		if (server !== null) {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
		TestHarness.suiteAfter("repoExists absence confirmation");
	});

	beforeEach(function () {
		script = {};
		requests = [];
	});

	/** a live GitHubActions, constructed after the config was pointed at the stub */
	function actions(): IGitHubActions {
		// getInstance(true) returns a fresh non-cached instance, which is what reads githubAPI
		return GitHubActions.getInstance(true);
	}

	it("Should report a transient 404 as absent when not asked to confirm.", async function () {
		// the existing behaviour, and what the polling loops rely on: one question, one answer
		script.transientRepo = 1; // 404 once, then exists

		const exists = await actions().repoExists("transientRepo");

		expect(exists, "a single 404 is taken at face value").to.be.false;
		expect(requests.length, "and only one request is made").to.equal(1);
	});

	it("Should rescue a transient 404 when asked to confirm.", async function () {
		// CI builds 4281 and 4314 failed exactly here: a repo that had just served three webhook
		// operations answered 404, and addTeamToRepo threw "repo does not exist"
		script.transientRepo = 1;

		const exists = await actions().repoExists("transientRepo", true);

		expect(exists, "the second look finds the repo").to.be.true;
		expect(requests.length, "which costs exactly one extra request").to.equal(2);
	});

	it("Should still report a genuinely absent repo as absent.", async function () {
		script.goneRepo = -1; // 404 forever

		const exists = await actions().repoExists("goneRepo", true);

		expect(exists).to.be.false;
		expect(requests.length, "confirmation is a single retry, not a loop").to.equal(2);
	});

	it("Should not re-check when the repo is there the first time.", async function () {
		const exists = await actions().repoExists("presentRepo", true);

		expect(exists).to.be.true;
		expect(requests.length, "a 200 needs no confirmation").to.equal(1);
	});
});
