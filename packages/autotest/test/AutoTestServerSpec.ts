import { expect } from "chai";
import "mocha";
import AutoTestRouteHandler from "@autotest/server/AutoTestRouteHandler";
import AutoTestServer from "@autotest/server/AutoTestServer";
import { DatabaseController } from "@backend/controllers/DatabaseController";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import * as crypto from "crypto";
import type * as http from "http";
import request from "supertest";

describe("AutoTest AutoTestServer", function () {
	const TIMEOUT = 1000;
	let app: http.Server = null; // fastify exposes the raw Node server; supertest attaches to that
	let server: AutoTestServer = null;

	before(async () => {
		Log.test("AutoTestServerSpec::before - start");

		await TestHarness.suiteBefore("AutoTestServerSpec");
		await TestHarness.prepareAll();

		Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
		Config.getInstance().setProp(ConfigKey.name, Config.getInstance().getProp(ConfigKey.testname));

		DatabaseController.getInstance(); // invoke early
		// await db.clearData(); // nuke everything

		// NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
		server = new AutoTestServer();

		try {
			await server.start();
			Log.test("AutoTestServerSpec::before - server started");
			// Log.test("orgName: " + Test.ORGNAME);
			app = server.getServer();
		} catch (err) {
			Log.test("AutoTestServerSpec::before - server might already be started: " + err);
		}
		expect(app).to.not.be.null; // this is a terrible assert but need some indication (other than log output) that this failed.
	});

	async function createImage(opts: any) {
		Log.test("createImage(); start");

		let output = "";
		const streamParser = function (streamRes: any, callback: any) {
			streamRes.data = "";
			streamRes.on("data", function (chunk: any) {
				chunk = chunk.toString();
				Log.test("createImage(); chunk received: " + chunk);
				output = output + chunk;
			});
			streamRes.on("end", function () {
				Log.test("createImage(); done - data:\n" + output);
				callback(null, output, "text");
			});
		};

		Log.test("createImage(); requesting image creation");
		const url = "/docker/image";
		const res = await request(app).post(url).set("user", TestHarness.ADMIN1.github).parse(streamParser).send(opts);

		Log.test("createImage(); image creation requested");

		return { res: res, output: output };
	}

	it("Should report AutoTest status.", async function () {
		const res = await request(app).get("/status").set("user", TestHarness.ADMIN1.github);
		Log.test("/status -> " + res.status + "; body: " + JSON.stringify(res.body));

		expect(res.status).to.equal(200);

		// the payload is the queue status; assert it is a real object, not an empty 200
		expect(res.body).to.be.an("object");
		expect(Object.keys(res.body).length, "status payload was empty").to.be.greaterThan(0);
	});

	it("Should answer a GitHub ping webhook with pong.", async function () {
		// this is the handshake GitHub performs when a webhook is added; if it stops working the
		// hook is marked as failing on every repo, which is silent from the server side
		const res = await request(app)
			.post("/githubWebhook")
			.set("X-GitHub-Event", "ping")
			.set("Content-Type", "application/json")
			.send({ zen: "test ping" });
		Log.test("/githubWebhook ping -> " + res.status + "; text: " + res.text);

		expect(res.status).to.equal(200);
		expect(res.text, "ping did not produce a pong").to.contain("pong");
	});

	/**
	 * These two exercise the webhook signature check end-to-end, including the raw-body capture
	 * in AutoTestServer's content type parser.
	 */
	describe("GitHub webhook signature verification", function () {
		/**
		 * Signs a payload the way GitHub does: HMAC over the exact bytes sent.
		 */
		function sign(rawBody: string): string {
			const atSecret = Config.getInstance().getProp(ConfigKey.autotestSecret);
			const key = crypto.createHash("sha256").update(atSecret, "utf8").digest("hex");
			return "sha256=" + crypto.createHmac("sha256", key).update(rawBody, "utf8").digest("hex");
		}

		beforeEach(function () {
			// readonly is compile-time only; this is settable at runtime
			(AutoTestRouteHandler as any).ENFORCE_WEBHOOK_SIGNATURE = true;
		});

		afterEach(function () {
			(AutoTestRouteHandler as any).ENFORCE_WEBHOOK_SIGNATURE = false;
		});

		it("Should accept a correctly signed payload.", async function () {
			const rawBody = JSON.stringify({ zen: "signed ping" });

			const res = await request(app)
				.post("/githubWebhook")
				.set("X-GitHub-Event", "ping")
				.set("Content-Type", "application/json")
				.set("X-Hub-Signature-256", sign(rawBody))
				.send(rawBody);
			Log.test("signed webhook -> " + res.status + "; text: " + res.text);

			expect(res.status).to.equal(200);
			expect(res.text).to.contain("pong");
		});

		it("Should reject an unsigned or incorrectly signed payload when enforcing.", async function () {
			const rawBody = JSON.stringify({ zen: "unsigned ping" });

			let res = await request(app)
				.post("/githubWebhook")
				.set("X-GitHub-Event", "ping")
				.set("Content-Type", "application/json")
				.send(rawBody);
			Log.test("unsigned webhook -> " + res.status + "; text: " + res.text);
			expect(res.status).to.equal(400);

			// a well-formed signature over _different_ bytes must not verify either
			res = await request(app)
				.post("/githubWebhook")
				.set("X-GitHub-Event", "ping")
				.set("Content-Type", "application/json")
				.set("X-Hub-Signature-256", sign(JSON.stringify({ zen: "some other payload" })))
				.send(rawBody);
			Log.test("wrongly signed webhook -> " + res.status + "; text: " + res.text);
			expect(res.status).to.equal(400);
			expect(res.text).to.contain("Invalid payload signature");
		});
	});

	it("Should be able to list docker images.", async function () {
		let res: any;
		try {
			Log.test("requesting docker listing");
			const url = "/docker/images";
			res = await request(app).get(url).set("user", TestHarness.ADMIN1.github);
			Log.test("docker listing returned");
		} catch (err) {
			res = err;
		} finally {
			const body = res.body;
			Log.test("Docker images: " + JSON.stringify(body));
			expect(res.status).to.equal(200);
			expect(body).to.be.an("Array");
		}
	});

	it("Should successfully create a docker image.", async function () {
		// this will be slow the first time (~5 minutes), but fast thereafter (~5 seconds)
		// once docker has cached the image

		// this test cannot pass on CircleCI, and is for localhost testing only
		if (TestHarness.isCI() === true) {
			this.skip();
		}

		// valid opts
		const opts = {
			remote: "https://github.com/minidocks/base.git",
			tag: "grader",
			file: "Dockerfile",
		};

		let res;
		let output;
		try {
			const retVal = await createImage(opts);
			res = retVal.res;
			output = retVal.output;
		} catch (err) {
			Log.error("Error encountered", err.message);
			res = err;
		} finally {
			Log.test("Stream data: " + output);
			expect(res.status).to.equal(200);
			expect(output).to.contain("Successfully built");
		}
	}).timeout(TIMEOUT * 60 * 10);

	it("Should fail to create a docker image for a bad remote.", async function () {
		// this test cannot pass on CircleCI, but works great locally
		if (TestHarness.isCI() === true) {
			this.skip();
		}

		// invalid repo
		const opts = {
			remote: "https://github.com/INVALID/base.git",
			tag: "tagname",
			file: "Dockerfile",
		};

		let res;
		let output;
		try {
			const retVal = await createImage(opts);
			res = retVal.res;
			output = retVal.output;
		} catch (err) {
			Log.error("Error encountered", err.message);
			res = err;
		} finally {
			Log.test("Stream data: " + output);
			expect(res.status).to.equal(200);
			expect(res).to.haveOwnProperty("status");
			expect(output).to.contain("error fetching");
		}
	}).timeout(TIMEOUT * 10);

	// NOTE: the image-build endpoint streams, so its response is hijacked from the framework and
	// written to the raw socket. Validation therefore has to happen *before* the hijack -- once the
	// socket is taken over there is no way to send a normal error response. These pin that split:
	// a malformed request must still get a plain 400, not a truncated stream or a hung connection.

	it("Should reject an image build that is missing required parameters.", async function () {
		const cases = [
			{ missing: "remote", body: { tag: "tagname", file: "Dockerfile" } },
			{ missing: "tag", body: { remote: "https://github.com/minidocks/base.git", file: "Dockerfile" } },
			{ missing: "file", body: { remote: "https://github.com/minidocks/base.git", tag: "tagname" } },
		];

		for (const c of cases) {
			const res = await request(app).post("/docker/image").set("user", TestHarness.ADMIN1.github).send(c.body);
			Log.test("missing " + c.missing + " -> " + res.status + "; body: " + JSON.stringify(res.text));

			expect(res.status, "missing " + c.missing + " should be rejected").to.equal(400);
			expect(res.text, "error should name the missing parameter").to.contain(c.missing);
		}
	}).timeout(TIMEOUT);

	it("Should refuse to remove a docker image without the AutoTest secret.", async function () {
		// the secret is checked before the daemon is contacted, so this holds even where Docker
		// is unavailable; it is the only thing stopping an unauthenticated image deletion
		const res = await request(app).del("/docker/image/sometag").set("user", TestHarness.ADMIN1.github).set("token", "NOT_THE_SECRET");
		Log.test("remove with bad secret -> " + res.status + "; body: " + JSON.stringify(res.body));

		expect(res.status).to.equal(403);
		expect(res.body?.success).to.equal(false);
		expect(res.body?.message).to.contain("secret mismatch");
	}).timeout(TIMEOUT);

	it("Should report a removal request for a tag that matches no image.", async function () {
		const atSecret = Config.getInstance().getProp(ConfigKey.autotestSecret);
		const res = await request(app)
			.del("/docker/image/tagThatMatchesNothing" + Date.now())
			.set("user", TestHarness.ADMIN1.github)
			.set("token", atSecret);
		Log.test("remove unknown tag -> " + res.status + "; body: " + JSON.stringify(res.body));

		expect(res.status).to.equal(400);
		expect(res.body?.success).to.equal(false);
		expect(res.body?.message, "should say the tag is unknown").to.be.a("string");
	}).timeout(TIMEOUT);

	xit("Should be able to remove a docker image.", async function () {
		let res: any;
		try {
			// this test cannot pass on CircleCI (also not working locally though)
			if (TestHarness.isCI() === true) {
				this.skip();
			}

			Log.test("Requesting docker listing");
			const getUrl = '/docker/images?filters={"reference":["grader"]}';
			res = await request(app).get(getUrl).set("user", TestHarness.ADMIN1.github);
			const dockerListing = res.body;
			Log.test("Docker listing returned: " + JSON.stringify(dockerListing));
			expect(dockerListing.length).to.be.greaterThan(0);

			const imgId = dockerListing[0].Id;
			let delUrl = "/docker/image/";
			delUrl = delUrl + imgId;

			const atSecret = Config.getInstance().getProp(ConfigKey.autotestSecret);

			// NOTE: right now this test always fails because the image we have created has "dependent child images"
			res = await request(app).del(delUrl).set("user", TestHarness.ADMIN1.github).set("token", atSecret);
			Log.test("Docker image removed");
		} catch (err) {
			res = err;
		} finally {
			const body = res.body;
			Log.test("Docker image removal body: " + JSON.stringify(body));
			expect(res.status).to.equal(200);
			expect(body).to.be.an("Array");
		}
	});

	xit("Should fail to remove a docker image for an invalid user.", async function () {
		let res: any;
		// this test cannot pass on CircleCI, but works great locally
		if (TestHarness.isCI() === true) {
			this.skip();
		}

		try {
			Log.test("Requesting docker listing");
			const getUrl = '/docker/images?filters={"reference":["grader"]}';
			res = await request(app).get(getUrl).set("user", TestHarness.ADMIN1.github);
			const dockerListing = res.body;
			Log.test("Docker listing returned: " + JSON.stringify(dockerListing));
			expect(dockerListing.length).to.be.greaterThan(0);

			const imgId = dockerListing[0].Id;
			const delUrl = "/docker/image/" + imgId;
			res = await request(app).del(delUrl).set("user", TestHarness.USER1.github);
			Log.test("docker image should not removed (invalid user)");
		} catch (err) {
			res = err;
		} finally {
			const body = res.body;
			Log.test("Docker image removal body: " + JSON.stringify(body));
			expect(res.status).to.equal(403);
		}
	});
});
