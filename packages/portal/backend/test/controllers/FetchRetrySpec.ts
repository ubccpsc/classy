import { expect } from "chai";
import * as http from "http";
import { AddressInfo } from "net";
import "mocha";

import { GitHubActions } from "@backend/controllers/GitHubActions";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec"; // load first

describe("GitHubActions.fetchWithRetry", function () {
	// Same loopback pattern as RepoExistsRetrySpec: a tiny HTTP server scripted per path, and the
	// config pointed at it for the duration. Every GitHub call in GitHubActions now goes through
	// fetchWithRetry, so this is the one place its policy is pinned down.
	let server: http.Server = null;
	let realApi: string = null;

	/** path -> the sequence of responses to serve; the last one repeats */
	let script: { [path: string]: Array<{ status: number; body?: string; headers?: { [k: string]: string } }> } = {};
	let requests: Array<{ method: string; url: string }> = [];

	before(async function () {
		await TestHarness.suiteBefore("GitHubActions.fetchWithRetry");

		server = http.createServer((req, res) => {
			req.resume();
			req.on("end", () => {
				requests.push({ method: req.method, url: req.url });
				const seq = script[req.url] ?? [{ status: 200, body: "{}" }];
				const step = seq.length > 1 ? seq.shift() : seq[0];
				res.writeHead(step.status, { "Content-Type": "application/json", ...(step.headers ?? {}) });
				res.end(step.body ?? "{}");
			});
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const port = (server.address() as AddressInfo).port;

		realApi = Config.getInstance().getProp(ConfigKey.githubAPI);
		Config.getInstance().setProp(ConfigKey.githubAPI, "http://127.0.0.1:" + port);
		Log.test("fetchWithRetry stub listening on 127.0.0.1:" + port);
	});

	after(async function () {
		Config.getInstance().setProp(ConfigKey.githubAPI, realApi);
		if (server !== null) {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
		TestHarness.suiteAfter("GitHubActions.fetchWithRetry");
	});

	beforeEach(function () {
		script = {};
		requests = [];
	});

	function fetchVia(path: string, options: any = {}): Promise<any> {
		// getInstance(true) is a fresh instance that reads the (stubbed) githubAPI
		const gha: any = GitHubActions.getInstance(true);
		return gha.fetchWithRetry(Config.getInstance().getProp(ConfigKey.githubAPI) + path, options);
	}

	it("Should retry a 429, honouring Retry-After, and return the eventual success.", async function () {
		script["/rl429"] = [
			{ status: 429, headers: { "retry-after": "1" } },
			{ status: 200, body: '{"ok":true}' },
		];

		const res = await fetchVia("/rl429");

		expect(res.status).to.equal(200);
		expect(requests.filter((r) => r.url === "/rl429")).to.have.lengthOf(2);
	}).timeout(10000);

	it("Should retry a 403 whose body names the rate limit, and leave the body readable.", async function () {
		// GitHub reports secondary limits as 403 with a message; detecting that consumes the body,
		// so fetchWithRetry must clone() before it looks. The caller still needs to read it.
		script["/rl403"] = [
			{ status: 403, body: '{"message":"API rate limit exceeded for installation"}', headers: { "retry-after": "1" } },
			{ status: 200, body: '{"ok":true}' },
		];

		const res = await fetchVia("/rl403");

		expect(res.status).to.equal(200);
		expect(await res.json()).to.deep.equal({ ok: true });
		expect(requests.filter((r) => r.url === "/rl403")).to.have.lengthOf(2);
	}).timeout(10000);

	it("Should NOT retry a 5xx on a POST, because the request may have taken effect.", async function () {
		// a second createRepo after an ambiguous 502 would double-create
		script["/post502"] = [{ status: 502, body: '{"message":"Bad Gateway"}' }];

		const res = await fetchVia("/post502", { method: "POST", body: "{}" });

		expect(res.status).to.equal(502);
		expect(requests.filter((r) => r.url === "/post502")).to.have.lengthOf(1);
	});

	it("Should NOT retry a 404, so repoExists(confirmAbsence) keeps its own meaning.", async function () {
		script["/missing"] = [{ status: 404, body: '{"message":"Not Found"}' }];

		const res = await fetchVia("/missing");

		expect(res.status).to.equal(404);
		expect(requests.filter((r) => r.url === "/missing")).to.have.lengthOf(1);
	});

	it("Should give up after three attempts and return the last response.", async function () {
		script["/always429"] = [{ status: 429, headers: { "retry-after": "1" } }];

		const res = await fetchVia("/always429");

		expect(res.status).to.equal(429);
		expect(requests.filter((r) => r.url === "/always429")).to.have.lengthOf(3);
	}).timeout(15000);
});
