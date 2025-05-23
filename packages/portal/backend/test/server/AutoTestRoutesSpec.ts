import { expect } from "chai";
import * as fs from "fs-extra";
import "mocha";
import * as restify from "restify";
import * as request from "supertest";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import { AutoTestAuthPayload, AutoTestConfigPayload, AutoTestGradeTransport, ClassyConfigurationPayload } from "@common/types/PortalTypes";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import BackendServer from "@backend/server/BackendServer";

// This seems silly, but just makes sure GlobalSpec runs first.
// It should be at the top of every test file.
// const loadFirst = require("../GlobalSpec");

describe("AutoTest Routes", function () {
	const TIMEOUT = 5000;

	let app: restify.Server = null;

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
			response = await request(app).post(url).send(body).set("token", Config.getInstance().getProp(ConfigKey.autotestSecret));
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
			response = await request(app).post(url).send(body).set("token", "BAD_TOKEN");
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
					expect(res).to.haveOwnProperty("status");
					expect(res.status).to.equal(500);
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
