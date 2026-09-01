import { expect } from "chai";
import * as fs from "fs-extra";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import BackendServer from "@backend/server/BackendServer";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import { AutoTestAuthPayload, AutoTestConfigPayload, AutoTestGradeTransport, ClassyConfigurationPayload } from "@common/types/PortalTypes";
import type * as http from "http";
import request from "supertest";

import { StubAutoTestService } from "./StubAutoTestService";

// This seems silly, but just makes sure GlobalSpec runs first.
// It should be at the top of every test file.
// const loadFirst = require("../GlobalSpec");

describe("AutoTest Routes", function () {
	const TIMEOUT = 5000;

	let app: http.Server = null; // fastify exposes the raw Node server; supertest attaches to that

	let server: BackendServer = null;
	before(async () => {
		Log.test("AutoTestRoutes::before - start");

		await TestHarness.suiteBefore("AutoTestRoutes");
		await TestHarness.prepareAll();

		Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
		Config.getInstance().setProp(ConfigKey.name, Config.getInstance().getProp(ConfigKey.testname));

		DatabaseController.getInstance(); // invoke early
		// await db.clearData(); // nuke everything

		// NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
		server = new BackendServer(false);

		try {
			await server.start();
			Log.test("AutoTestRoutes::before - server started");
			// Log.test("orgName: " + Test.ORGNAME);
			app = server.getServer();
		} catch (err) {
			Log.test("AutoTestRoutes::before - server might already be started: " + err);
		}
		expect(app).to.not.be.null; // this is a terrible assert but need some indication (other than log output) that this failed.
	});

	after(async function () {
		Log.test("AutoTestRoutes::after - start");
		TestHarness.suiteAfter("AutoTestRoutes");
		await server.stop();
	});

	describe("what the endpoints say when they cannot answer", function () {
		// NOTE: AutoTest is the only caller of these, and it has to be able to tell "no" from
		// "broken": a 404 for a student who is not in this course is normal, an error is not. Only
		// the happy paths were covered before.
		const token = Config.getInstance().getProp(ConfigKey.autotestSecret);

		it("Should 404 a GitHub id that is not a person in this course.", async function () {
			const response = await request(app).get("/portal/at/personId/userThatIsNotEnrolled").set("token", token);
			Log.test("unknown person -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(404);
			expect(response.body.failure.message).to.contain("userThatIsNotEnrolled");
		});

		it("Should answer a known GitHub id with its person id.", async function () {
			const response = await request(app)
				.get("/portal/at/personId/" + TestHarness.USER1.github)
				.set("token", token);
			Log.test("known person -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(200);
			expect(response.body.success.personId).to.equal(TestHarness.USER1.id);
		});

		it("Should return an empty result list rather than an error when there is no result.", async function () {
			// AutoTest asks about a commit it has not graded yet on every push; that is not a failure
			const url = "/portal/at/result/" + TestHarness.DELIVID0 + "/" + TestHarness.REPONAME1 + "/noSuchSha/" + encodeURIComponent("<ANY>");
			const response = await request(app).get(url).set("token", token);
			Log.test("missing result -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(200);
			expect(response.body.success).to.be.an("array").that.is.empty;
		});

		it("Should 400 container details for a deliverable that does not exist.", async function () {
			const response = await request(app).get("/portal/at/container/noSuchDeliverable").set("token", token);
			Log.test("unknown deliverable -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(400);
			expect(response.body.failure).to.not.be.undefined;
		});

		it("Should answer a push promotion request even when the push details are empty.", async function () {
			// NOTE: not an error. AutoTest asks this for every push, and the default course controller
			// answers "no" without inspecting the payload; only a course whose plugin throws would
			// produce the 400 branch, which is why that branch stays uncovered here.
			const response = await request(app).post("/portal/at/promotePush").send({}).set("token", token);
			Log.test("empty promotePush -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(200);
			expect(response.body.success.shouldPromote).to.be.false;
		});

		it("Should 400 a result that is not a valid result record.", async function () {
			// a malformed record must be refused rather than stored: everything downstream (grades,
			// the dashboard, AutoTest's own bookkeeping) reads these back
			const response = await request(app).post("/portal/at/result").send({ notA: "result" }).set("token", token);
			Log.test("malformed result -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(400);
			expect(response.body.failure).to.not.be.undefined;
		});
	});

	describe("the endpoints that proxy to AutoTest", function () {
		// NOTE: these handlers check the caller and then hand the request to the AutoTest service.
		// With nothing listening, only their failure paths can run, which is why they were the least
		// covered code in the backend. StubAutoTestService stands in for that service and points
		// Classy's config at itself, so this works the same on a dev machine and on CI.
		const stub = new StubAutoTestService();

		before(async function () {
			await stub.start();
		});

		after(async function () {
			await stub.stop();
		});

		beforeEach(function () {
			stub.reset();
		});

		it("Should not count the AutoTest health poll as a forwarded request.", async function () {
			// BackendServer::start polls GET /status on an un-awaited 500ms timer. Once this stub has
			// redirected autotestUrl/autotestPort, that poll arrives *here*, at whatever point in the
			// suite the timer happens to fire -- which used to be recorded as a phantom extra request
			// and fail whichever unrelated test was running at the time (seen in 2 of 4 full-suite
			// runs, on a different test each time).
			//
			// Driven directly rather than by waiting out the timer, so this is deterministic.
			const config = Config.getInstance();
			const url = config.getProp(ConfigKey.autotestUrl) + ":" + config.getProp(ConfigKey.autotestPort) + "/status";

			const before = stub.healthChecks;
			const response = await fetch(url, { method: "GET" });

			expect(response.status, "the poll is still answered").to.equal(200);

			// NOTE: greaterThan, not exactly +1. The background timer can fire during this test as
			// well, making it +2 -- asserting an exact count here would reintroduce exactly the
			// timing dependency this fix removes (it failed 2 of 5 runs before this was loosened).
			// The invariant that matters is the line below: polls never land in `requests`.
			expect(stub.healthChecks, "and counted as a health check").to.be.greaterThan(before);
			expect(stub.requests, "but never as a request the routes forwarded").to.have.lengthOf(0);
		});

		it("Should still record a real forwarded request after a health poll.", async function () {
			// the filter must not swallow traffic that matters
			const config = Config.getInstance();
			const url = config.getProp(ConfigKey.autotestUrl) + ":" + config.getProp(ConfigKey.autotestPort) + "/status";
			await fetch(url, { method: "GET" });

			stub.body = { deleted: true };
			const response = await request(app).delete("/portal/at/docker/image/d0-latest").set({ user: TestHarness.ADMIN1.github });

			expect(response.status).to.equal(200);
			const forwarded = stub.onlyRequest();
			expect(forwarded.url).to.equal("/docker/image/d0-latest");
		});

		it("Should refuse to list Docker images for a student.", async function () {
			// the Docker endpoints are admin-only, and nothing exercised that check
			const response = await request(app).get("/portal/at/docker/images").set({ user: TestHarness.USER1.github });
			Log.test("student list -> " + response.status);

			expect(response.status).to.equal(401);
			expect(stub.requests, "an unauthorized request must not reach AutoTest").to.have.lengthOf(0);
		});

		it("Should refuse to list Docker images for an unknown user.", async function () {
			const response = await request(app).get("/portal/at/docker/images").set({ user: "userThatDoesNotExist" });
			Log.test("unknown user list -> " + response.status);

			expect(response.status).to.equal(400);
			expect(stub.requests).to.have.lengthOf(0);
		});

		it("Should pass the image list through for an admin.", async function () {
			stub.body = [{ Id: "sha256:abc", RepoTags: ["d0:latest"] }];

			const response = await request(app).get("/portal/at/docker/images").set({ user: TestHarness.ADMIN1.github });
			Log.test("admin list -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(200);
			expect(response.body).to.deep.equal(stub.body); // the answer is AutoTest's, not the portal's
			expect(stub.onlyRequest().url, "the /portal/at prefix is stripped when forwarding").to.equal("/docker/images");
		});

		it("Should report a failure from the AutoTest service rather than a bad image list.", async function () {
			stub.status = 500;

			const response = await request(app).get("/portal/at/docker/images").set({ user: TestHarness.ADMIN1.github });
			Log.test("failing service -> " + response.status);

			expect(response.status).to.equal(500);
			expect(stub.requests, "it did try").to.have.lengthOf(1);
		});

		it("Should refuse to delete a Docker image for a student.", async function () {
			const response = await request(app).delete("/portal/at/docker/image/d0-latest").set({ user: TestHarness.USER1.github });
			Log.test("student delete -> " + response.status);

			expect(response.status).to.equal(401);
			expect(stub.requests, "a student must not be able to reach the delete endpoint").to.have.lengthOf(0);
		});

		it("Should forward an image deletion for an admin.", async function () {
			stub.body = { deleted: true };

			const response = await request(app).delete("/portal/at/docker/image/d0-latest").set({ user: TestHarness.ADMIN1.github });
			Log.test("admin delete -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(200);
			const forwarded = stub.onlyRequest();
			expect(forwarded.method).to.equal("DELETE");
			expect(forwarded.url).to.equal("/docker/image/d0-latest");
		});

		it("Should pass a deletion failure back with its status.", async function () {
			stub.status = 404;
			stub.body = { message: "no such image" };

			const response = await request(app).delete("/portal/at/docker/image/nosuchtag").set({ user: TestHarness.ADMIN1.github });
			Log.test("failed delete -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(404);
			expect(stub.requests).to.have.lengthOf(1);
		});

		it("Should hand a GitHub webhook to AutoTest.", async function () {
			// the portal is the address GitHub posts to; forwarding is all this route does
			stub.body = { queued: true };
			const payload = { action: "opened", repository: { name: "d0_team1" } };

			const response = await request(app).post("/portal/githubWebhook").send(payload);
			Log.test("webhook -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(200);
			const forwarded = stub.onlyRequest();
			expect(forwarded.method).to.equal("POST");
			expect(JSON.parse(forwarded.body), "the payload must arrive unchanged").to.deep.equal(payload);
		});

		it("Should report a webhook AutoTest would not accept.", async function () {
			stub.status = 400;
			stub.body = { message: "nope" };

			const response = await request(app).post("/portal/githubWebhook").send({ action: "opened" });
			Log.test("rejected webhook -> " + response.status);

			expect(response.status).to.equal(400);
			expect(stub.requests).to.have.lengthOf(1);
		});
	});

	it("Should reject an unauthorized backend detail request", async function () {
		let response = null;
		const url = "/portal/at";
		let body = null;
		try {
			response = await request(app).get(url).set("token", "INVALID");
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body).to.not.be.null;
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
	});

	it("Should respond to a valid backend detail request", async function () {
		let response = null;
		let body: ClassyConfigurationPayload;
		const url = "/portal/at";
		try {
			response = await request(app).get(url).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success.defaultDeliverable).to.not.be.undefined;
		expect(body.success.defaultDeliverable).to.equal(null);
		expect(body.success.deliverableIds).to.not.be.undefined;
		expect(body.success.deliverableIds).to.be.of.length(5);

		const dc = DatabaseController.getInstance();
		const cr = await dc.getCourseRecord();
		cr.defaultDeliverableId = TestHarness.DELIVID0;
		await dc.writeCourseRecord(cr);

		try {
			response = await request(app).get(url).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success.defaultDeliverable).to.not.be.undefined;
		expect(body.success.defaultDeliverable).to.equal(TestHarness.DELIVID0);
	}).timeout(TIMEOUT);

	it("Should reject an authorized result", async function () {
		let response = null;
		const url = "/portal/at/result";

		let body = null;
		try {
			response = await request(app).post(url).send(body).set("token", "INVALIDTOKEN");
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(response.body));
		expect(response.status).to.equal(400);
		expect(body).to.not.be.null;
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
	});

	it("Should accept a valid result payload", async function () {
		let response = null;
		const url = "/portal/at/result";
		const body = TestHarness.createResult(TestHarness.DELIVID0, TestHarness.REPONAME1, [TestHarness.USER1.id], 50);

		try {
			response = await request(app).post(url).send(body).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		expect(response).to.not.be.null;
		Log.test(response?.status + " -> " + JSON.stringify(response?.body));
		expect(response?.status).to.equal(200);
		expect(response?.body.success).to.not.be.undefined;
	}).timeout(TIMEOUT);

	it("Should reject an invalid result payload", async function () {
		let response = null;
		const url = "/portal/at/result";

		const body = {
			// : IAutoTestResult
			delivId: TestHarness.DELIVID0,
			repoId: TestHarness.REPONAME1,
			timestamp: 0,
			commitURL: "url",
			commitSHA: "sha",
			input: {},
			output: {},
		};

		delete body.delivId; // remove required field

		try {
			response = await request(app).post(url).send(body).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		expect(response).to.not.be.null;
		Log.test(response?.status + " -> " + JSON.stringify(response?.body));
		expect(response?.status).to.equal(400);
		expect(response?.body.success).to.be.undefined;
		expect(response?.body.failure).to.not.be.undefined;
	}).timeout(TIMEOUT);

	it("Should reject a feedbackDelay request with a bad secret", async function () {
		const url = "/portal/at/feedbackDelay";
		const body = { delivId: TestHarness.DELIVID0, personId: TestHarness.USER1.id, timestamp: Date.now() };

		const response = await request(app).post(url).send(body).set("token", "INVALID");
		Log.test("feedbackDelay bad secret: " + response.status + " -> " + JSON.stringify(response.body));

		expect(response.status).to.equal(400);
		expect(response.body?.success).to.be.undefined;
		expect(response.body?.failure).to.not.be.undefined;
	});

	it("Should report feedbackDelay as not implemented for the default course controller", async function () {
		// the default CourseController returns null here, which the route reports as 204 rather
		// than as an error; a course plugin that implements it returns 200 with the delay instead
		const url = "/portal/at/feedbackDelay";
		const body = { delivId: TestHarness.DELIVID0, personId: TestHarness.USER1.id, timestamp: Date.now() };

		const response = await request(app).post(url).send(body).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
		Log.test("feedbackDelay default: " + response.status + " -> " + JSON.stringify(response.body));

		// 204 is the "no opinion" answer; it must not be conflated with a failure
		expect(response.status).to.equal(204);
		expect(response.body?.failure).to.be.undefined;
	});

	it("Should not grant staff or admin rights to an unknown githubId", async function () {
		// isStaff is a permission question, so an unknown user is simply not staff (200/false)
		const unknown = "githubUserThatDoesNotExist_" + Date.now();
		const token = Config.getInstance().getProp(ConfigKey.autotestSecret);

		const staffRes = await request(app)
			.get("/portal/at/isStaff/" + unknown)
			.set("token", token);
		Log.test("isStaff unknown: " + staffRes.status + " -> " + JSON.stringify(staffRes.body));
		expect(staffRes.status).to.equal(200);
		expect(staffRes.body?.success?.isStaff, "unknown user was reported as staff").to.equal(false);
		expect(staffRes.body?.success?.isAdmin, "unknown user was reported as admin").to.equal(false);
	});

	it("Should 404 a personId lookup for an unknown githubId", async function () {
		const unknown = "githubUserThatDoesNotExist_" + Date.now();
		const token = Config.getInstance().getProp(ConfigKey.autotestSecret);

		const personRes = await request(app)
			.get("/portal/at/personId/" + unknown)
			.set("token", token);
		Log.test("personId unknown: " + personRes.status + " -> " + JSON.stringify(personRes.body));
		expect(personRes.status).to.equal(404);
		expect(personRes.body?.failure).to.not.be.undefined;
	});

	it("Should respond to a valid result request", async function () {
		let response = null;
		const ref = encodeURIComponent("refs/heads/main");
		const url = "/portal/at/result/" + TestHarness.DELIVID0 + "/" + TestHarness.REPONAME1 + "/sha/" + ref;
		let body = null;
		try {
			response = await request(app).get(url).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body?.success).to.not.be.undefined;
		expect(body?.failure).to.be.undefined;
	});

	it("Should reject an unauthorized result request", async function () {
		let response = null;
		const ref = encodeURIComponent("refs/heads/main");
		const url = "/portal/at/result/" + TestHarness.DELIVID0 + "/" + TestHarness.REPONAME1 + "/sha/" + ref;
		let body = null;
		try {
			response = await request(app).get(url).set("token", "INVALID");
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
	});

	it("Should accept a valid promotePush request", async function () {
		let response = null;
		const url = "/portal/at/promotePush";

		const input = TestHarness.createContainerInput();
		// input.delivId = TestHarness.DELIVID1;
		// input.target.delivId = TestHarness.DELIVID1;
		// input.target.repoId = TestHarness.DELIVIDPROJ;

		const body = JSON.stringify(input);

		try {
			response = await request(app)
				.post(url)
				.set("Content-Type", "application/json")
				.send(body)
				.set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response?.status + " -> " + JSON.stringify(response?.body));
		expect(response?.status).to.equal(200);
		expect(response?.body.success).to.not.be.undefined;
		expect(response?.body.success.shouldPromote).to.not.be.undefined;
		// this is not great, but the default controller always returns false
		expect(response?.body.success.shouldPromote).to.be.false;
	}).timeout(TIMEOUT);

	it("Should not accept an invalid promotePush request", async function () {
		let response = null;
		const url = "/portal/at/promotePush";

		const input = TestHarness.createContainerInput();
		const body = JSON.stringify(input);

		try {
			// NOTE: Content-Type is explicit because body is a pre-serialized string; supertest
			// would otherwise label it text/plain, which Fastify rejects with a 415. Restify parsed
			// whatever it was given. Real callers (ClassPortal) already send application/json.
			response = await request(app).post(url).set("Content-Type", "application/json").send(body).set("token", "BAD_TOKEN");
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response?.status + " -> " + JSON.stringify(response?.body));
		expect(response?.status).to.equal(400);
	}).timeout(TIMEOUT);

	it("Should reject an unauthorized isStaff request", async function () {
		let response = null;
		const url = "/portal/at/isStaff/rtholmes";
		let body = null;
		try {
			response = await request(app).get(url).set("token", "INVALID");
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
	});

	it("Should respond to a valid isStaff request for staff", async function () {
		let response = null;
		let body: AutoTestAuthPayload;
		const url = "/portal/at/isStaff/" + TestHarness.ADMINSTAFF1.github;
		try {
			response = await request(app).get(url).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.isStaff).to.not.be.undefined;
		expect(body.success.isStaff).to.be.true;
		expect(body.success.isAdmin).to.be.true;
	});

	it("Should respond to a valid isStaff request for non-staff", async function () {
		let response = null;
		let body: AutoTestAuthPayload;
		const url = "/portal/at/isStaff/INVALIDUSERNAME";
		try {
			response = await request(app).get(url).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.isStaff).to.not.be.undefined;
		expect(body.success.isAdmin).to.not.be.undefined;
		expect(body.success.isStaff).to.be.false;
		expect(body.success.isAdmin).to.be.false;
	}).timeout(TestHarness.TIMEOUT);

	it("Should reject an unauthorized personId request", async function () {
		let response = null;
		const url = "/portal/at/personId/rtholmes";
		let body = null;
		try {
			response = await request(app).get(url).set("token", "INVALID");
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
	});

	it("Should respond to a valid personId request", async function () {
		let response = null;
		let body: AutoTestAuthPayload;
		const url = "/portal/at/personId/" + TestHarness.USER1.github; // AutoTest only knows about githubId not personId
		try {
			response = await request(app).get(url).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.personId).to.not.be.undefined;
		expect(body.success.personId).to.be.an("string"); // TODO: check what it is?
	});

	it("Should reject an unauthorized container request", async function () {
		let response = null;
		const url = "/portal/at/container/d0";
		let body = null;
		try {
			response = await request(app).get(url).set("token", "INVALID");
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
	});

	it("Should respond to a valid container request for a deliverable", async function () {
		let response = null;
		const url = "/portal/at/container/d0";
		let body: AutoTestConfigPayload;
		try {
			response = await request(app).get(url).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.dockerImage).to.not.be.undefined;
		expect(body.success.studentDelay).to.not.be.undefined;
		expect(body.success.maxExecTime).to.not.be.undefined;
		expect(body.success.regressionDelivIds).to.not.be.undefined;
		expect(body.success.regressionDelivIds).to.be.an("array");
	});

	it("Should respond to an invalid container request", async function () {
		let response = null;
		const url = "/portal/at/container/d9997";
		let body: AutoTestConfigPayload;
		try {
			response = await request(app).get(url).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
		expect(body.failure.message).to.not.be.undefined;
	});

	it("Should reject an unauthorized grade request", async function () {
		let response = null;
		const url = "/portal/at/grade";
		let body = null;
		try {
			response = await request(app).post(url).send({}).set("token", "INVALID");
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
	});

	it("Should be able to receive a grade event", async function () {
		let response = null;

		const gradePayload: AutoTestGradeTransport = {
			delivId: TestHarness.DELIVID0,
			score: 51,
			repoId: TestHarness.REPONAME1,
			repoURL: "repoURL",
			urlName: "urlName",
			URL: "test URL from grade record",
			comment: "test comment from grade record",
			timestamp: new Date(1400000000000 + 1000).getTime(), // within the open window
			custom: {},
		};

		const url = "/portal/at/grade";
		try {
			response = await request(app)
				.post(url)
				.send(gradePayload)
				.set("Accept", "application/json")
				.set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response?.status + " -> " + JSON.stringify(response?.body));
		expect(response?.status).to.equal(200);
		expect(response?.body.success).to.not.be.undefined;
		expect(response?.body.success.success).to.be.true;
	});

	it("Should reject an invalid grade event", async function () {
		let response = null;

		const gradePayload: AutoTestGradeTransport = {
			delivId: TestHarness.DELIVID0,
			score: 51,
			repoId: TestHarness.REPONAME1,
			repoURL: "repoURL",
			urlName: "urlName",
			URL: "test URL from grade record",
			comment: "test comment from grade record",
			timestamp: Date.now(),
			custom: {},
		};

		delete gradePayload.score; // remove field

		const url = "/portal/at/grade";
		try {
			response = await request(app)
				.post(url)
				.send(gradePayload)
				.set("Accept", "application/json")
				.set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response?.status + " -> " + JSON.stringify(response?.body));
		expect(response?.status).to.equal(400);
		expect(response?.body.failure).to.not.be.undefined;
		expect(response?.body.failure.message).to.be.a("string");
	});

	// this will always fail locally now that we check the IP of the host
	it("Should be able to receive a Webhook event from GitHub, but fail gracefully.", async function () {
		// only run this test in CI
		if (TestHarness.isCI() === false) {
			return;
		}

		// NOTE: this is a terrible test; without the service running we get nothing
		let response = null;
		const body = fs.readJSONSync(__dirname + "/../../../../autotest/test/githubEvents/push_master-branch.json"); // __dirname
		const autotestUrl = Config.getInstance().getProp(ConfigKey.autotestUrl);

		const url = "/portal/githubWebhook";
		try {
			response = await request(app)
				.post(url)
				.send(body)
				.set("Accept", "application/json")
				.set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response?.status + " -> " + JSON.stringify(response.body));
		expect(response?.status).to.equal(400); // really should be 200, but AutoTest is not running so it will return this error
		const text = response.text;
		if (autotestUrl.indexOf("localhost") > -1) {
			expect(text.indexOf("ECONNREFUSED")).to.be.greaterThan(0); // at least make sure it fails for the right reason
		} else {
			expect(text.indexOf("ENOTFOUND")).to.be.greaterThan(0); // non-localhost autotest hostname name results in different error
		}
	});

	describe("Grading Image Docker Tasks (Portal side)", function () {
		// NOTE: these only test the Portal side of the grading image endpoints.
		// This is because AutoTest is not actually running here. Validating that
		// the endpoints are working correctly should be tested more completely
		// on the AutoTest side. This is specifically why success conditions are
		// not validated here.

		describe("GET /portal/at/docker/images", function () {
			const url = "/portal/at/docker/images";

			it("Should respond 401 if user is not an admin.", async function () {
				let res: any;

				try {
					res = await request(app).get(url).set("user", TestHarness.REALUSER1.github);
				} catch (err) {
					res = err;
				} finally {
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(401);
				}
			});
			it("Should respond 400 if the user is not in the request header.", async function () {
				let res: any;

				try {
					res = await request(app).get(url);
				} catch (err) {
					res = err;
				} finally {
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(400);
				}
			});
			it("Should respond 400 if the user is not a GitHub person.", async function () {
				let res: any;

				try {
					res = await request(app).get(url).set("user", "fakeUser123");
				} catch (err) {
					res = err;
				} finally {
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(400);
				}
			});
			it("Should respond 500 if forwarding the request to AutoTest fails.", async function () {
				this.timeout(15000);
				let res: any;

				try {
					res = await request(app).get(url).set("user", TestHarness.ADMIN1.github);
				} catch (err) {
					res = err;
				} finally {
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(500);
				}
			});
			// it("Should respond 400 if the user privileges cannot be determined.");
			// it("Should respond 400 if the AutoTest service is malformed.");
		});

		describe("POST /portal/at/docker/image", function () {
			const url = "/portal/at/docker/image";
			const body = {};

			it("Should respond 401 if user is not an admin.", async function () {
				let res: any;

				try {
					// Possibly NOT working as REALUSER1 is actually a fake user but test is still passing
					res = await request(app).post(url).set("user", TestHarness.REALUSER1.github).send(body);
				} catch (err) {
					res = err;
				} finally {
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(401);
				}
			});

			it("Should respond 400 if the user is not in the request header.", async function () {
				let res: any;

				try {
					res = await request(app).post(url).send(body);
				} catch (err) {
					res = err;
				} finally {
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(400);
				}
			});

			it("Should respond 400 if the user is not a GitHub person.", async function () {
				let res: any;

				try {
					res = await request(app).post(url).set("user", "fakeUser123").send(body);
				} catch (err) {
					res = err;
				} finally {
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(400);
				}
			});

			it("Should respond 500 if forwarding the request to AutoTest fails.", async function () {
				this.timeout(15000);
				let res: any;

				try {
					res = await request(app).post(url).set("user", TestHarness.ADMIN1.github).send(body);
				} catch (err) {
					res = err;
				} finally {
					Log.test("proxy failure -> " + res?.status + "; headers: " + JSON.stringify(res?.headers));
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(500);

					// NOTE: under restify this route wrote an empty keep-alive chunk (res.write(""))
					// before the forward completed, so a failure arrived with the transfer already
					// committed as chunked. Fastify does not commit the reply until the forward has
					// succeeded (reply.hijack() runs after the fetch resolves), so the failure path
					// is now a clean 500 rather than a half-written stream. The success path still
					// streams; the AutoTest side of that is covered by AutoTestServerSpec.
					// the admin UI reads this from the browser, so CORS has to survive the failure path
					expect(res.headers["access-control-allow-origin"]).to.equal("*");
				}
			});

			// This is only for debugging, to work, an AutoTest instance must be running
			// on the host (that is why this is skipped by default)
			it.skip("Should be able to create a grading image, if AT is running.", async function () {
				this.timeout(5 * 60 * 1000); // up to 5 mins
				let res: any;

				try {
					const validBody = {
						remote: "https://github.com/minidocks/base.git",
						tag: "tagname",
						file: "Dockerfile",
					};

					let parserData = "";
					const myParser = function (parserRes: any, callback: any) {
						parserRes.on("data", function (chunk: any) {
							Log.info("AutoTestRoutesSpec::myParser chunk; ts: " + Date.now() + "; chunk: " + chunk);
							parserData += chunk;
						});
						parserRes.on("end", function () {
							Log.info("AutoTestRoutesSpec::myParser done");
							callback(null, parserData);
						});
					};

					res = await request(app)
						.post(url)
						.set("user", TestHarness.ADMIN1.github)
						.set("connection", "keep-alive")
						.parse(myParser)
						.send(validBody);
				} catch (err) {
					res = err;
				} finally {
					Log.test("Response code: " + res.status);
					const finalBody = res.body;
					expect(res.status).to.equal(200);
					expect(finalBody.indexOf("Successfully tagged tagname:latest")).to.be.greaterThan(0);
				}
			});
		});
	});
});
