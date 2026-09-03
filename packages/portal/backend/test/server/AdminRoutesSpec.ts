// biome-ignore-all lint/style/noExcessiveLinesPerFile: one spec per admin route; splitting it would scatter shared fixture setup
import { expect } from "chai";
import "mocha";

import { AdminController } from "@backend/controllers/AdminController";
import { DatabaseController, QueryKind } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { JobController } from "@backend/controllers/JobController";
import BackendServer from "@backend/server/BackendServer";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import {
	AutoTestConfigTransport,
	AutoTestResultPayload,
	CourseTransport,
	CourseTransportPayload,
	DeliverableTransport,
	DeliverableTransportPayload,
	Payload,
	RepositoryPayload,
	StudentTransportPayload,
	TeamFormationTransport,
	TeamTransportPayload,
} from "@common/types/PortalTypes";
import Util from "@common/Util";
import type * as http from "http";
import request from "supertest";

import "./AuthRoutesSpec";
import { PersonKind, RepoStatus, TeamStatus } from "@backend/Types";

describe("Admin Routes", function () {
	let app: http.Server = null; // fastify exposes the raw Node server; supertest attaches to that
	let server: BackendServer = null;

	const userName = TestHarness.ADMIN1.id;
	let userToken: string;

	const TIMEOUT = 1000;

	before(async () => {
		Log.test("AdminRoutes::before - start");

		await TestHarness.suiteBefore("Admin Routes");

		// get data ready
		await TestHarness.prepareAll();

		try {
			// NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
			server = new BackendServer(false);

			await server.start();
			Log.test("AdminRoutes::before - server started");
			app = server.getServer();

			const dc: DatabaseController = DatabaseController.getInstance();
			const auth = await dc.getAuth(userName);

			Log.test("AdminRoutes::before - token set");
			userToken = auth.token;
		} catch (err) {
			Log.test("AdminRoutes::before - server might already be started: " + err);
		}
	});

	after(async () => {
		Log.test("AdminRoutes::after - start");
		await server.stop();
		await TestHarness.suiteAfter("Admin Routes");
	});

	it("Should be able to get a list of students", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/students";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		// should confirm body.success objects (at least one)
	}).timeout(TestHarness.TIMEOUT);

	it("Should be able to get a list of staff", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/staff";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		// should confirm body.success objects (at least one)
	}).timeout(TestHarness.TIMEOUT);

	it("Should be able to get a list of students with cookies for authentication", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/students";
		try {
			response = await request(app)
				.get(url)
				.set("Cookie", "token=" + userToken + "__" + userName);
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		// should confirm body.success objects (at least one)
	}).timeout(TestHarness.TIMEOUT);

	it("Should not be able to get a list of students if the requester is not privileged", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/students";
		try {
			response = await request(app).get(url).set({ user: TestHarness.USER1.id, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should not be able to get a list of students with bad cookies for auth", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/students";
		try {
			response = await request(app)
				.get(url)
				.set("Cookie", "token=BADTOKEN" + Date.now() + "__" + userName);
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should not be able to get a list of students without any auth data", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/students";
		try {
			response = await request(app).get(url);
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should be able to get a list of teams", async function () {
		let response = null;
		let body: TeamTransportPayload;
		const url = "/portal/admin/teams";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");

		// should confirm body.success objects (at least one)
	});

	it("Should not be able to get a list of teams if the requester is not privileged", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/teams";
		try {
			response = await request(app).get(url).set({ user: TestHarness.USER1.id, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should be able to get a list of grades", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/grades";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");

		// should confirm body.success objects (at least one)
	}).timeout(TestHarness.TIMEOUT);

	it("Should not be able to get a list of grades if the requester is not privileged", async function () {
		let response = null;
		let body: StudentTransportPayload;
		const url = "/portal/admin/grades";
		try {
			response = await request(app).get(url).set({ user: TestHarness.USER1.id, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should be able to get a list of graded results for a deliverable", async function () {
		let response = null;
		let body: StudentTransportPayload;

		const url = "/portal/admin/gradedResults/d0";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");

		// should confirm body.success objects (at least one)
	}).timeout(TestHarness.TIMEOUT);

	it("Should be able to get a list of the best graded results for a deliverable", async function () {
		let response = null;
		let body: StudentTransportPayload;

		const url = "/portal/admin/bestResults/d0";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");

		// should confirm body.success objects (at least one)
	}).timeout(TestHarness.TIMEOUT);

	it("Should be able to get a list of results", async function () {
		let response = null;
		let body: AutoTestResultPayload;
		const url = "/portal/admin/results/any/any";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		// expect(body.success).to.have.lengthOf(101);

		// should confirm body.success objects (at least one)
	});

	it("Should not be able to get a list of results if the requester is not privileged", async function () {
		let response = null;
		let body: AutoTestResultPayload;
		const url = "/portal/admin/results/any/any";
		try {
			response = await request(app).get(url).set({ user: TestHarness.USER1.id, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should be able to get a list of dashboard results", async function () {
		let response = null;
		let body: AutoTestResultPayload;
		const url = "/portal/admin/dashboard/any/any";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		// expect(body.success).to.have.lengthOf(101);

		// should confirm body.success objects (at least one)
	});

	it("Should not be able to get a list of dashboard results if the requester is not privileged", async function () {
		let response = null;
		let body: AutoTestResultPayload;
		const url = "/portal/admin/dashboard/any/any";
		try {
			response = await request(app).get(url).set({ user: TestHarness.USER1.id, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should be able to export the list of dashboard results", async function () {
		let response = null;
		let body: AutoTestResultPayload;
		const url = "/portal/admin/export/dashboard/any/any";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		// expect(body.success).to.have.lengthOf(101);

		// should confirm body.success objects (at least one)
	});

	it("Should not be able to export the list of dashboard results if the requester is not privileged", async function () {
		let response = null;
		let body: AutoTestResultPayload;
		const url = "/portal/admin/export/dashboard/any/any";
		try {
			response = await request(app).get(url).set({ user: TestHarness.USER1.id, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should be able to get a list of repositories", async function () {
		let response = null;
		let body: RepositoryPayload;
		const url = "/portal/admin/repositories";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		expect(body.success).to.have.lengthOf(2);

		// check one entry
		const entry = body.success[0];
		expect(entry.id).to.not.be.undefined;
		expect(entry.URL).to.not.be.undefined;
	});

	it("Should be able to get a list of deliverables", async function () {
		let response = null;
		let body: DeliverableTransportPayload;
		const url = "/portal/admin/deliverables";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		expect(body.success).to.have.lengthOf(5);

		const dc = new DeliverablesController();
		const actual = dc.validateDeliverableTransport(body.success[0]);
		expect(actual).to.be.null; // make sure at least one of the deliverables validates
	});

	it("Should be able to create a new deliverable", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/deliverable";
		try {
			const deliv = DeliverablesController.deliverableToTransport(TestHarness.createDeliverable("d" + new Date().getTime()));
			response = await request(app).post(url).send(deliv).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.be.an("string");
	});

	it("Should fail to create a new deliverable if the object is invalid", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/deliverable";
		try {
			const deliv = DeliverablesController.deliverableToTransport(TestHarness.createDeliverable("d" + new Date().getTime()));
			deliv.id = null; // make invalid

			response = await request(app).post(url).send(deliv).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.failure).to.not.be.undefined;
		expect(body.failure.message).to.be.an("string");
	});

	it("Should fail to create a new deliverable if the user is not an admin", async function () {
		// this test looks like overkill
		// but we want to have
		// 1) a valid user with valid tokens (who happens to be a student)
		// 2) a valid deliverable
		// and we _still_ want it all to fail

		const dc: DatabaseController = DatabaseController.getInstance();
		await dc.writeAuth({ personId: TestHarness.USER1.id, token: "testtoken" }); // create an auth record
		const auth = await dc.getAuth(TestHarness.USER1.id);
		const token = auth.token;

		let response = null;
		let body: Payload;
		const url = "/portal/admin/deliverable";
		try {
			const deliv = DeliverablesController.deliverableToTransport(TestHarness.createDeliverable("d" + new Date().getTime()));

			response = await request(app).post(url).send(deliv).set({ user: TestHarness.USER1.id, token: token });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body.failure).to.not.be.undefined;
		expect(body.failure.message).to.be.an("string");
	});

	it("Should be able to update a deliverable", async function () {
		let response = null;
		let body: Payload;
		const newTime = new Date().getTime();
		const dc = new DeliverablesController();
		const url = "/portal/admin/deliverable";
		try {
			const originalDelivs = await dc.getAllDeliverables();
			const d0 = originalDelivs[0];
			const at = d0.autotest as AutoTestConfigTransport;
			at.openTimestamp = d0.openTimestamp;
			at.closeTimestamp = d0.closeTimestamp;

			const deliv: DeliverableTransport = {
				id: d0.id,
				openTimestamp: d0.openTimestamp,
				closeTimestamp: d0.closeTimestamp,
				shouldProvision: d0.shouldProvision,
				importURL: d0.importURL,
				minTeamSize: d0.teamMinSize,
				maxTeamSize: d0.teamMaxSize,
				teamsSameLab: d0.teamSameLab,
				studentsFormTeams: d0.teamStudentsForm,
				onOpenAction: "",
				onCloseAction: "",
				repoPrefix: d0.repoPrefix,
				teamPrefix: d0.teamPrefix,
				visibleToStudents: d0.visibleToStudents,
				URL: d0.URL,
				gradesReleased: d0.gradesReleased,
				lateAutoTest: d0.lateAutoTest,
				shouldAutoTest: d0.shouldAutoTest,
				autoTest: at,
				rubric: d0.rubric,
				custom: d0.custom,
			};

			// make sure the times were not already the new time
			expect(deliv.openTimestamp).to.not.equal(newTime);
			expect(deliv.closeTimestamp).to.not.equal(newTime);

			// update the times
			deliv.openTimestamp = newTime;
			deliv.closeTimestamp = newTime;

			// send an update
			response = await request(app).post(url).send(deliv).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}

		// make sure the update did not fail
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.be.an("string");
		Log.test("update did not fail");

		// check that the new time was updated
		const allDelivs = await dc.getAllDeliverables();
		const d0updated = allDelivs[0];
		expect(d0updated.openTimestamp).to.equal(newTime);
		expect(d0updated.closeTimestamp).to.equal(newTime);
		Log.test("update did update the value");
	});

	it("Should be able to upload a new classlist", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/classlist";
		try {
			response = await request(app)
				.post(url)
				.attach("classlist", __dirname + "/../data/classlistValidFirst.csv")
				.set({
					user: userName,
					token: userToken,
				});
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			expect.fail("should not happen");
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("object");
		expect(body.success.classlist.length).to.equal(5);
	});

	it("Should fail to upload bad classlists", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/classlist";

		response = await request(app)
			.post(url)
			.attach("classlist", __dirname + "/../data/classlistInvalid.csv")
			.set({
				user: userName,
				token: userToken,
			});
		body = response.body;
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.failure).to.not.be.undefined;
		expect(body.failure.message).to.be.an("string"); // test column missing

		response = await request(app)
			.post(url)
			.attach("classlist", __dirname + "/../data/classlistEmpty.csv")
			.set({
				user: userName,
				token: userToken,
			});
		body = response.body;
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.failure).to.not.be.undefined;
		expect(body.failure.message).to.be.an("string"); // test no records found
		expect(body.failure.message).to.contain("no students");
	});

	it("Should be able to upload an updated classlist", async function () {
		const dc = DatabaseController.getInstance();
		let people = await dc.getPeople();
		const peopleLength = people.length;
		const person = await dc.getPerson("rthse2");
		person.githubId = "oldGithub";
		await dc.writePerson(person); // change the github

		let response = null;
		let body: Payload;
		const url = "/portal/admin/classlist";
		try {
			response = await request(app)
				.post(url)
				.attach("classlist", __dirname + "/../data/classlistValidUpdate.csv")
				.set({
					user: userName,
					token: userToken,
				});
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			expect.fail("should not happen");
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("object");
		expect(body.success.classlist.length).to.equal(5); // capture how many changed?

		people = await dc.getPeople();
		expect(peopleLength).to.equal(people.length); // no new people should have been added
		const newPerson = await dc.getPerson("rthse2");
		expect(person.githubId).to.not.equal(newPerson.githubId); // should have been updated
		expect(person.labId).to.not.equal(newPerson.labId); // should have been updated
		expect(person.studentNumber).to.equal(newPerson.studentNumber); // should be the same
	});

	it("Should 404 on PUT /portal/classlist; the route is disabled.", async function () {
		// Disabled in 26W1 (see GeneralRoutes.registerRoutes); the supported path for an API-driven
		// classlist pull is the isAdmin-guarded "classlist-update" job. This test asserts the route
		// stays gone: the old handler authorized callers with a regex over the client-supplied
		// x-forwarded-for header, which nginx appends to rather than replaces, so re-registering it
		// unchanged would reintroduce an unauthenticated classlist write.
		const response = await request(app).put("/portal/classlist").set("x-forwarded-for", "142.103.5.99");
		const body: Payload = response.body;

		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(404);
		expect(body).to.not.haveOwnProperty("success");
	});

	it("Should be able to upload a new grades with CSV", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/grades/csv/" + TestHarness.DELIVID1;
		try {
			response = await request(app)
				.post(url)
				.attach("gradelist", __dirname + "/../data/gradesValid.csv")
				.set({
					user: userName,
					token: userToken,
				});
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			expect.fail("should not happen");
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.be.an("string");
		expect(body.success.message).to.contain("3 grades");
	});

	it("Should fail to upload a bad grades CSV", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/grades/csv/" + TestHarness.DELIVID1;

		response = await request(app)
			.post(url)
			.attach("gradelist", __dirname + "/../data/gradesInvalid.csv")
			.set({
				user: userName,
				token: userToken,
			});
		body = response.body;
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.failure).to.not.be.undefined;
		expect(body.failure.message).to.be.an("string"); // test column missing
		expect(body.failure.message).to.contain("Grades upload unsuccessful");

		response = await request(app)
			.post(url)
			.attach("gradelist", __dirname + "/../data/gradesEmpty.csv")
			.set({
				user: userName,
				token: userToken,
			});
		body = response.body;
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.failure).to.not.be.undefined;
		expect(body.failure.message).to.be.an("string"); // test no records found
		expect(body.failure.message).to.contain("no grades");
	});

	it("Should be able to upload a new grades from prairielearn", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/grades/prairie";
		try {
			response = await request(app)
				.post(url)
				.attach("gradelist", __dirname + "/../data/prairieValid.csv")
				.set({
					user: userName,
					token: userToken,
				});
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			expect.fail("should not happen");
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.be.an("string");
		expect(body.success.message).to.contain("3 grades");
	});

	it("Should be able to get the course object", async function () {
		let response = null;
		let body: CourseTransportPayload;
		const url = "/portal/admin/course";
		try {
			response = await request(app).get(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("object");

		// TODO: check response properties
	});

	it("Should be able to update the course object", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/course";

		const newId = Date.now() + "id";

		const course: CourseTransport = {
			id: Config.getInstance().getProp(ConfigKey.testname),
			defaultDeliverableId: newId,
			custom: {},
		};
		response = await request(app).post(url).send(course).set({ user: userName, token: userToken });
		body = response.body;
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.be.an("string");

		// replace the defaultDeliverableId
		course.defaultDeliverableId = "d0";
		response = await request(app).post(url).send(course).set({ user: userName, token: userToken });
		body = response.body;
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
	});

	it("Should not be able to update the course object with invalid settings", async function () {
		let response = null;
		const url = "/portal/admin/course";

		const newId = Date.now() + "id";

		const course: any = {
			// id: "some id", // THIS IS A REQUIRED FIELD
			defaultDeliverableId: newId,
			custom: {},
		};
		response = await request(app).post(url).send(course).set({ user: userName, token: userToken });
		const body: Payload = response.body;
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
		expect(body.failure.message).to.be.an("string");
	});

	describe("Slow AdminRoute Tests", () => {
		beforeEach(function () {
			const exec = TestHarness.runSlowTest();

			if (exec) {
				Log.test("AdminRoutesSpec::slowTests - running: " + this.currentTest.title);
			} else {
				Log.test("AdminRoutesSpec::slowTests - skipping; will run on CI");
				this.skip();
			}
		});

		/**
		 * With hybrid tests sometimes we need to make sure the cached TestGitHubActions and
		 * live GitHubActions are consistently cleaned.
		 *
		 * @param {string[]} repoNames
		 * @param {string[]} teamNames
		 * @returns {Promise<void>}
		 */
		// second team/repo used only by the batch provisioning test
		const BATCH_TEAMNAME = "t_d0_" + TestHarness.GITHUB3.csId;
		const BATCH_REPONAME = "d0_" + TestHarness.GITHUB3.csId;

		async function clearAll(repoNames: string[], teamNames: string[]): Promise<void> {
			// sometimes we need to clear resources on both github and the cache
			Log.test("AdminRoutesSpec::clearAll() - start");
			const start = Date.now();

			const ghCache = GitHubActions.getInstance(false);
			const ghReal = GitHubActions.getInstance(true);
			// const tcCache = new TeamController(ghCache);
			// const tcReal = new TeamController(ghReal);

			for (const repoName of repoNames) {
				await ghCache.deleteRepo(repoName);
				await ghReal.deleteRepo(repoName);
			}

			for (const teamName of teamNames) {
				await ghCache.deleteTeam(teamName);
				await ghReal.deleteTeam(teamName);
			}

			Log.test("AdminRoutesSpec::clearAll() - done; took: " + Util.took(start));
		}

		/**
		 * Starts a job and waits for it to reach a terminal state.
		 *
		 * NOTE: starting a job returns as soon as it is recorded, not when the work is done -- that
		 * is the whole point of the job framework. Tests that care about the outcome have to poll,
		 * exactly as the admin UI does.
		 */
		async function runJob(kind: string, params: any, timeoutMs: number = TestHarness.TIMEOUTLONG - 5000): Promise<any> {
			const started = await request(app)
				.post("/portal/admin/job/" + kind)
				.send(params)
				.set({ user: userName, token: userToken });
			Log.test("runJob( " + kind + " ) - started: " + started.status + " -> " + JSON.stringify(started.body));
			expect(started.status).to.equal(200);
			expect(started.body.success.state).to.equal("RUNNING");

			const jobId = started.body.success.id;
			const deadline = Date.now() + timeoutMs;
			while (Date.now() < deadline) {
				const response = await request(app)
					.get("/portal/admin/job/" + jobId)
					.set({ user: userName, token: userToken });
				const job = response.body.success;
				if (job.state !== "RUNNING") {
					Log.test("runJob( " + kind + " ) - " + job.state + "; summary: " + JSON.stringify(job.summary));
					return job;
				}
				await Util.delay(250);
			}
			expect.fail("job did not finish in time: " + kind);
		}

		it("Should be able to list the provisioning state for a deliverable", async function () {
			let response = null;
			let body: RepositoryPayload;
			const url = "/portal/admin/provision/" + TestHarness.DELIVIDPROJ;
			try {
				response = await request(app).get(url).set({ user: userName, token: userToken });
				body = response.body;
			} catch (err) {
				Log.test("ERROR: " + err);
			}
			Log.test(response.status + " -> " + JSON.stringify(body));
			expect(response.status).to.equal(200);
			expect(body.success).to.not.be.undefined;
			expect(body.success).to.be.an("array");
			expect(body.success).to.have.lengthOf(0);

			// check one entry
			// const entry = body.success[0];
			// expect(entry.id).to.not.be.undefined;
			// expect(entry.URL).to.not.be.undefined;
		});

		// it("Should be able to perform provision", async function() {
		//     let response = null;
		//     let body: Payload;
		//     const url = "/portal/admin/provision/" + Test.DELIVIDPROJ + "/" + Test.REPONAME1;
		//     try {
		//         response = await request(app).post(url).send({}).set({user: userName, token: userToken});
		//         body = response.body;
		//     } catch (err) {
		//         Log.test("ERROR: " + err);
		//     }
		//     Log.test(response.status + " -> " + JSON.stringify(body));
		//     expect(response.status).to.equal(200);
		//     expect(body.success).to.not.be.undefined;
		//     expect(body.success).to.be.an("array");
		//     expect(body.success[0].id).to.equal(Test.REPONAME1);
		// }).timeout(TIMEOUT * 30);

		it("Should be able to get a release plan for a deliverable", async function () {
			let response = null;
			let body: RepositoryPayload;
			const url = "/portal/admin/release/" + TestHarness.DELIVIDPROJ;
			try {
				response = await request(app).get(url).set({ user: userName, token: userToken });
				body = response.body;
			} catch (err) {
				Log.test("ERROR: " + err);
			}
			Log.test(response.status + " -> " + JSON.stringify(body));
			expect(response.status).to.equal(200);
			expect(body.success).to.not.be.undefined;
			expect(body.success).to.be.an("array");
			expect(body.success).to.have.lengthOf(0);

			// check one entry
			// const entry = body.success[0];
			// expect(entry.id).to.not.be.undefined;
			// expect(entry.URL).to.not.be.undefined;
		});

		// it("Should be able to perform release", async function() {
		//     let response = null;
		//     let body: Payload;
		//     const url = "/portal/admin/release/" + Test.REPONAME1;
		//     try {
		//         response = await request(app).post(url).send({}).set({user: userName, token: userToken});
		//         body = response.body;
		//     } catch (err) {
		//         Log.test("ERROR: " + err);
		//     }
		//     Log.test(response.status + " -> " + JSON.stringify(body));
		//     expect(response.status).to.equal(200);
		//     expect(body.success).to.not.be.undefined;
		//     expect(body.success).to.be.an("array");
		//     expect(body.success.length).to.equal(0); // NOTE: this is terrible, something should be being released
		// }).timeout(TIMEOUT * 30);

		it("Should be able to start a withdraw task", async function () {
			// This is tricky because the live github data will have a different team id than we"re using locally

			// NOTE: marking withdrawn students used to be POST /portal/admin/withdraw; it is now the
			// "student-withdraw" job, so this returns as soon as the job is recorded rather than when
			// the withdraw finishes. Whether the work itself succeeds depends on live GitHub data.
			let response = null;
			let body: Payload;
			const url = "/portal/admin/job/student-withdraw";
			try {
				response = await request(app).post(url).send({}).set({ user: userName, token: userToken });
				body = response.body;
			} catch (err) {
				Log.test("ERROR: " + err);
			}
			Log.test(response.status + " -> " + JSON.stringify(body));
			expect(response.status).to.equal(200);
			expect(body.success).to.not.be.undefined;
			expect(body.success.kind).to.equal("student-withdraw");
			expect(body.success.state).to.equal("RUNNING");
		}).timeout(TIMEOUT * 10);

		it("Should be able to sanity check a database", async function () {
			let response = null;
			let body: Payload;
			const url = "/portal/admin/checkDatabase/true";
			try {
				response = await request(app).post(url).send({}).set({ user: userName, token: userToken });
				body = response.body;
			} catch (err) {
				Log.test("ERROR: " + err);
			}
			Log.test(response.status + " -> " + JSON.stringify(body));
			expect(response.status).to.equal(200);
			expect(body.success).to.not.be.undefined;
			expect(body.success.message).to.be.an("string");
		}).timeout(TIMEOUT * 10);

		it("Should be able to prepare and provision a deliverable", async function () {
			const dbc = DatabaseController.getInstance();
			await dbc.clearData();

			await clearAll([TestHarness.REPONAMEREAL], []);

			await TestHarness.prepareAllReal(); // create a valid set of users and teams

			// the GET only reads now: nothing has been prepared, so there is nothing to list
			const url = "/portal/admin/provision/" + TestHarness.DELIVID0;
			let response = await request(app).get(url).set({ user: userName, token: userToken });
			Log.test("before prepare: " + response.status + " -> " + JSON.stringify(response.body));
			expect(response.status).to.equal(200);
			expect(response.body.success).to.be.an("array");
			expect(response.body.success).to.have.lengthOf(0);

			// preparing is what creates the Team and Repository records
			const prepared = await runJob("provision-prepare", { delivId: TestHarness.DELIVID0, formSingle: false });
			expect(prepared.state).to.equal("SUCCEEDED");
			expect(prepared.summary.delivId).to.equal(TestHarness.DELIVID0);
			expect(prepared.summary.repos).to.be.greaterThan(0);

			response = await request(app).get(url).set({ user: userName, token: userToken });
			Log.test("after prepare: " + response.status + " -> " + JSON.stringify(response.body));
			const planned: string[] = (response.body.success as any[]).map((repo) => repo.id);
			expect(planned.length).to.be.greaterThan(0);
			expect(planned).to.contain(TestHarness.REPONAMEREAL);

			// and creating is what reaches GitHub; a subset, as the admin UI sends
			const created = await runJob("provision-create", {
				delivId: TestHarness.DELIVID0,
				repoIds: [TestHarness.REPONAMEREAL],
			});
			expect(created.state).to.equal("SUCCEEDED");
			expect(created.summary.provisioned).to.equal(1);
			expect(created.summary.failed).to.have.lengthOf(0);

			const gh = GitHubActions.getInstance(true);
			expect(await gh.repoExists(TestHarness.REPONAMEREAL), "repo not created").to.be.true;
		}).timeout(TestHarness.TIMEOUTLONG);

		it("Should be able to provision several repos in one job", async function () {
			// NOTE: it matters that all the repos go into a single job: that is what lets
			// performProvision run them with bounded concurrency (PROVISION_CONCURRENCY). The UI
			// used to send one request per repo, which made that batching a no-op.
			const dbc = DatabaseController.getInstance();
			await dbc.clearData();

			await clearAll([TestHarness.REPONAMEREAL, BATCH_REPONAME], [TestHarness.TEAMNAMEREAL, BATCH_TEAMNAME]);
			await TestHarness.prepareAllReal(); // users + one team

			// a second team, so the plan yields more than one repo and the batch is a real batch
			const p3 = TestHarness.createPerson(TestHarness.GITHUB3.id, TestHarness.GITHUB3.csId, TestHarness.GITHUB3.github, PersonKind.STUDENT);
			await dbc.writePerson(p3);
			const team2 = await TestHarness.createTeam(BATCH_TEAMNAME, TestHarness.DELIVID0, [TestHarness.GITHUB3.id]);
			await dbc.writeTeam(team2);

			const url = "/portal/admin/provision/" + TestHarness.DELIVID0;

			// preparing creates the Repository records the create job then refers to by id
			const prepared = await runJob("provision-prepare", { delivId: TestHarness.DELIVID0, formSingle: false });
			expect(prepared.state).to.equal("SUCCEEDED");

			const response = await request(app).get(url).set({ user: userName, token: userToken });
			Log.test("prepared: " + response.status + " -> " + JSON.stringify(response.body));
			expect(response.status).to.equal(200);
			const repoIds: string[] = (response.body.success as any[]).map((r) => r.id);
			expect(repoIds.length, "need >1 planned repo for this to exercise batching").to.be.greaterThan(1);

			// clean up
			await clearAll(repoIds, []);

			// all of them, in ONE job
			const created = await runJob("provision-create", { delivId: TestHarness.DELIVID0, repoIds: repoIds });
			expect(created.state).to.equal("SUCCEEDED");
			expect(created.summary.provisioned).to.equal(repoIds.length);
			expect(created.summary.failed).to.have.lengthOf(0);

			// and they exist on GitHub, not just in the response
			const gh = GitHubActions.getInstance(true);
			for (const repoId of repoIds) {
				expect(await gh.repoExists(repoId), "repo not created: " + repoId).to.be.true;
			}

			// NOTE: deliberately NOT cleaning up here. The release tests below expect
			// REPONAMEREAL to still be provisioned, and clearing exactly these repos at the
			// start of this test is what makes it order-independent anyway.
		}).timeout(TestHarness.TIMEOUTLONG);

		it("Should reject a provisioning job that is not authorized", async function () {
			const response = await request(app)
				.post("/portal/admin/job/provision-create")
				.send({ delivId: TestHarness.DELIVID0, repoIds: [TestHarness.REPONAMEREAL] })
				.set({ user: userName, token: TestHarness.FAKETOKEN });
			Log.test("bad token: " + response.status + " -> " + JSON.stringify(response.body));
			expect(response.status).to.equal(401);
			expect(response.body.success).to.be.undefined;
			expect(response.body.failure).to.not.be.undefined;
		});

		it("Should fail a provisioning job with invalid params", async function () {
			// NOTE: params are validated inside the job, not by the route: starting always succeeds
			// (the request must return before the work begins), so bad input surfaces as a FAILED
			// job with a message, which is what the admin UI renders in the status line.

			// no repos requested
			let job = await runJob("provision-create", { delivId: TestHarness.DELIVID0, repoIds: [] });
			expect(job.state).to.equal("FAILED");
			expect(job.errors[0]).to.contain("No repositories");

			// a repo that is not in the datastore
			job = await runJob("provision-create", {
				delivId: TestHarness.DELIVID0,
				repoIds: ["REPO_THAT_DOES_NOT_EXIST_" + Date.now()],
			});
			expect(job.state).to.equal("FAILED");
			expect(job.errors[0]).to.contain("Unknown repository");

			// invalid deliverable
			job = await runJob("provision-create", { delivId: "FAKEDELIVERABLE", repoIds: [TestHarness.REPONAMEREAL] });
			expect(job.state).to.equal("FAILED");
			expect(job.errors[0]).to.contain("Unknown deliverable");

			// a deliverable that is not provisionable
			job = await runJob("provision-create", { delivId: TestHarness.DELIVID1, repoIds: [TestHarness.REPONAMEREAL] });
			expect(job.state).to.equal("FAILED");
			expect(job.errors[0]).to.contain("not provisionable");
		}).timeout(TestHarness.TIMEOUTLONG);

		it("Should be able to release a deliverable", async function () {
			const released = await runJob("provision-release", {
				delivId: TestHarness.DELIVID0,
				repoIds: [TestHarness.REPONAMEREAL],
			});
			Log.test("release: " + released.state + " -> " + JSON.stringify(released.summary));

			expect(released.state).to.equal("SUCCEEDED");
			expect(released.summary.released).to.equal(1);
			expect(released.summary.failed).to.have.lengthOf(0);
		}).timeout(TestHarness.TIMEOUTLONG);

		it("Should fail a release job with invalid params", async function () {
			const unauthorized = await request(app)
				.post("/portal/admin/job/provision-release")
				.send({ delivId: TestHarness.DELIVID0, repoIds: [TestHarness.REPONAMEREAL] })
				.set({ user: userName, token: TestHarness.FAKETOKEN });
			Log.test("bad token: " + unauthorized.status);
			expect(unauthorized.status).to.equal(401);

			// a repo that is not in the datastore; see the note on provisioning params above
			const job = await runJob("provision-release", { delivId: TestHarness.DELIVID0, repoIds: ["repoId"] });
			expect(job.state).to.equal("FAILED");
			expect(job.errors[0]).to.contain("Unknown repository");
		}).timeout(TestHarness.TIMEOUTLONG);
	});

	it("Should be able to create a team for a deliverable.", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/team";
		let ex = null;
		try {
			// create 2 people in an individual deliverable (should be allowed for admin)
			const team: TeamFormationTransport = {
				delivId: TestHarness.DELIVID0,
				githubIds: [TestHarness.USER5.github, TestHarness.USER6.github],
			};

			response = await request(app).post(url).send(team).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success).to.be.an("array");
		expect(body.success.length).to.equal(1);
	});

	it("Should fail to create a team for a deliverable if something is invalid", async function () {
		let response = null;
		let body: Payload;
		const url = "/portal/admin/team";
		let ex = null;
		const team: TeamFormationTransport = {
			delivId: TestHarness.DELIVID0,
			githubIds: [TestHarness.USER5.github, TestHarness.USER6.github],
		};
		try {
			// already on team
			response = await request(app).post(url).send(team).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;

		try {
			// invalid deliv
			team.delivId = "INVALIDDELIVID" + Date.now();
			response = await request(app).post(url).send(team).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;

		try {
			// invalid user
			team.delivId = TestHarness.DELIVID0;
			team.githubIds = ["INVALIDUSERNAME" + Date.now()];
			response = await request(app).post(url).send(team).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	}).timeout(TestHarness.TIMEOUT);

	/**
	 * Team membership tests
	 */

	it("Should be able to add a member to a team.", async function () {
		let response = null;
		let body: Payload;
		// server.post("/portal/admin/team/:teamId/members/:memberId", AdminRoutes.isAdmin, AdminRoutes.teamAddMember);
		const url = "/portal/admin/team/" + TestHarness.TEAMNAME1 + "/members/" + TestHarness.REALUSER1.github;
		let ex = null;
		try {
			response = await request(app).post(url).send().set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.not.be.undefined;
		expect(body.success.message).to.contain(TestHarness.REALUSER1.github);
	});

	it("Should be able to remove a member from a team.", async function () {
		let response = null;
		let body: Payload;
		// server.post("/portal/admin/team/:teamId/members/:memberId", AdminRoutes.isAdmin, AdminRoutes.teamAddMember);
		const url = "/portal/admin/team/" + TestHarness.TEAMNAME1 + "/members/" + TestHarness.REALUSER1.github;
		let ex = null;
		try {
			response = await request(app).del(url).send().set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.not.be.undefined;
		expect(body.success.message).to.not.contain(TestHarness.REALUSER1.github);
	});

	it("Should not be able to remove a person who is not already a member from a team.", async function () {
		let response = null;
		let body: Payload;
		// server.post("/portal/admin/team/:teamId/members/:memberId", AdminRoutes.isAdmin, AdminRoutes.teamAddMember);
		const url = "/portal/admin/team/" + TestHarness.TEAMNAME1 + "/members/" + TestHarness.REALUSER3.github;
		let ex = null;
		try {
			response = await request(app).del(url).send().set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should not be able to remove a member from a team that does not exist.", async function () {
		let response = null;
		let body: Payload;
		// server.post("/portal/admin/team/:teamId/members/:memberId", AdminRoutes.isAdmin, AdminRoutes.teamAddMember);
		const url = "/portal/admin/team/" + TestHarness.TEAMNAME1 + "/members/" + "INVALIDPERSON";
		let ex = null;
		try {
			response = await request(app).del(url).send().set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should not be able to remove an invalid member from a team.", async function () {
		let response = null;
		let body: Payload;
		// server.post("/portal/admin/team/:teamId/members/:memberId", AdminRoutes.isAdmin, AdminRoutes.teamAddMember);
		const url = "/portal/admin/team/" + "INVALIDTEAMNAME" + "/members/" + TestHarness.REALUSER1.github;
		let ex = null;
		try {
			response = await request(app).del(url).send().set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(ex).to.be.null;
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should be able to delete a deliverable", async function () {
		const url = "/portal/admin/deliverable/" + TestHarness.DELIVID0;
		let response = null;
		let body: Payload;
		let ex = null;
		try {
			response = await request(app).del(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.be.an("string");
		expect(ex).to.be.null;
	});

	// NOTE: admin routes accept credentials either as user/token headers or from a cookie -- the
	// cookie path is what makes attachment links work in the browser. Its branches were unexecuted,
	// and cookie parsing is exactly the sort of thing a REST-layer swap re-implements.

	it("Should authenticate an admin from a token cookie.", async function () {
		// the frontend stores "<token>__<user>"; Firefox dislikes multiple cookies, hence the join
		const response = await request(app)
			.get("/portal/admin/deliverables")
			.set("Cookie", "token=" + userToken + "__" + userName);
		const body: Payload = response.body;
		Log.test("cookie auth: " + response.status + " -> " + JSON.stringify(body).substring(0, 120));

		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
	});

	it("Should reject a token cookie that carries no user.", async function () {
		// a single-part cookie yields a token but no user; partial credentials must not authenticate
		const response = await request(app)
			.get("/portal/admin/deliverables")
			.set("Cookie", "token=" + userToken);
		const body: Payload = response.body;
		Log.test("partial cookie: " + response.status + " -> " + JSON.stringify(body));

		expect(response.status).to.equal(401);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
	});

	it("Should reject a cookie that has no token at all.", async function () {
		const response = await request(app).get("/portal/admin/deliverables").set("Cookie", "somethingElse=value");
		const body: Payload = response.body;
		Log.test("cookie without token: " + response.status + " -> " + JSON.stringify(body));

		expect(response.status).to.equal(401);
		expect(body.failure).to.not.be.undefined;
	});

	it("Should delete a deliverable and attribute the audit record to the caller", async function () {
		const dbc = DatabaseController.getInstance();
		const delivId = "delivToDelete_" + Date.now();

		const deliv = TestHarness.getDeliverable(delivId);
		await dbc.writeDeliverable(deliv);
		expect(await dbc.getDeliverable(delivId), "fixture deliverable was not written").to.not.be.null;

		const response = await request(app)
			.del("/portal/admin/deliverable/" + delivId)
			.set({ user: userName, token: userToken });
		const body: Payload = response.body;
		Log.test("delete deliverable: " + response.status + " -> " + JSON.stringify(body));

		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;

		// the path param actually reached the handler
		expect(await dbc.getDeliverable(delivId), "deliverable still present after delete").to.be.null;

		// and the audit trail names who did it, rather than undefined
		const audits = await dbc.readRecords("audit", QueryKind.SLOW, false, {});
		const mine = audits.filter((a: any) => a?.before?.id === delivId);
		expect(mine.length, "no audit record written for the delete").to.be.greaterThan(0);
		expect(mine[0].personId, "audit record did not record the acting user").to.equal(userName);
	}).timeout(TestHarness.TIMEOUT);

	it("Should fail to delete a deliverable if appropriate", async function () {
		const url = "/portal/admin/deliverable/";
		let response = null;
		let body: Payload;
		let ex = null;
		try {
			// delivId does not exist
			response = await request(app)
				.del(url + Date.now())
				.set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
		expect(ex).to.be.null;

		response = null;
		body = null;
		ex = null;
		try {
			// token is invalid
			response = await request(app)
				.del(url + TestHarness.DELIVIDPROJ)
				.set({
					user: userName,
					token: TestHarness.FAKETOKEN,
				});
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body).to.not.be.null;
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
		expect(ex).to.be.null;
	});

	it("Should be able to delete a repository", async function () {
		const url = "/portal/admin/repository/" + TestHarness.REPONAME1;
		let response = null;
		let body: Payload;
		let ex = null;
		try {
			response = await request(app).del(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.be.an("string");
		expect(ex).to.be.null;

		const team = await DatabaseController.getInstance().getTeam(TestHarness.TEAMNAME1);
		Log.test("Team: " + JSON.stringify(team));
		// expect(team.custom.githubAttached).to.be.false; // not attached
		expect(team.gitHubStatus).to.equal(TeamStatus.CREATED); // team still exists but is unlinked
	}).timeout(TestHarness.TIMEOUT);

	it("Should be able to delete a repository whose team record no longer exists", async function () {
		// A repo can outlive the teams it references (e.g., the team was deleted separately).
		// Unlinking used to dereference the missing team and fail the whole delete with a 400.
		const dbc = DatabaseController.getInstance();
		const repo = await dbc.getRepository(TestHarness.REPONAME2);
		repo.teamIds = ["team_that_does_not_exist_" + Date.now()];
		await dbc.writeRepository(repo);

		const url = "/portal/admin/repository/" + TestHarness.REPONAME2;
		let response = null;
		let body: Payload;
		try {
			response = await request(app).del(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;

		// the repo record should be gone, despite the dangling team reference
		const deleted = await dbc.getRepository(TestHarness.REPONAME2);
		expect(deleted).to.be.null;
	}).timeout(TestHarness.TIMEOUT);

	it("Should fail to delete a repository if appropriate", async function () {
		const url = "/portal/admin/repository/";
		let response = null;
		let body: Payload;
		let ex = null;
		try {
			// delivId does not exist
			response = await request(app)
				.del(url + Date.now())
				.set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
		expect(ex).to.be.null;

		response = null;
		body = null;
		ex = null;
		try {
			// token is invalid
			response = await request(app)
				.del(url + TestHarness.REPONAME1)
				.set({
					user: userName,
					token: TestHarness.FAKETOKEN,
				});
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body).to.not.be.null;
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
		expect(ex).to.be.null;
	});

	it("Should be able to delete a team", async function () {
		const url = "/portal/admin/team/" + TestHarness.TEAMNAME1;
		let response = null;
		let body: Payload;
		let ex = null;
		try {
			response = await request(app).del(url).set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(200);
		expect(body.success).to.not.be.undefined;
		expect(body.success.message).to.be.an("string");
		expect(ex).to.be.null;
	});

	it("Should fail to delete a team if appropriate", async function () {
		const url = "/portal/admin/team/";
		let response = null;
		let body: Payload;
		let ex = null;
		try {
			// delivId does not exist
			response = await request(app)
				.del(url + Date.now())
				.set({ user: userName, token: userToken });
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(400);
		expect(body.success).to.be.undefined;
		expect(body.failure).to.not.be.undefined;
		expect(ex).to.be.null;

		response = null;
		body = null;
		ex = null;
		try {
			// token is invalid
			response = await request(app)
				.del(url + TestHarness.TEAMNAME1)
				.set({
					user: userName,
					token: TestHarness.FAKETOKEN,
				});
			body = response.body;
		} catch (err) {
			Log.test("ERROR: " + err);
			ex = err;
		}
		Log.test(response.status + " -> " + JSON.stringify(body));
		expect(response.status).to.equal(401);
		expect(body).to.not.be.null;
		expect(body?.success).to.be.undefined;
		expect(body?.failure).to.not.be.undefined;
		expect(ex).to.be.null;
	});

	it("Should reject a provisioning or release listing for a deliverable that cannot be provisioned", async function () {
		// NOTE: both of these only read now (the writing half is the "provision-prepare" job), so the
		// only way they fail is a deliverable that does not exist or is not provisionable.
		let response = await request(app).get("/portal/admin/provision/FAKEDELIVERABLE").set({ user: userName, token: userToken });
		Log.test("unknown deliverable (provision): " + response.status + " -> " + JSON.stringify(response.body));
		expect(response.status).to.equal(400);
		expect(response.body.failure.message).to.contain("FAKEDELIVERABLE");

		// DELIVID1 exists but has shouldProvision false
		response = await request(app)
			.get("/portal/admin/provision/" + TestHarness.DELIVID1)
			.set({ user: userName, token: userToken });
		Log.test("non-provisionable (provision): " + response.status + " -> " + JSON.stringify(response.body));
		expect(response.status).to.equal(400);

		response = await request(app).get("/portal/admin/release/FAKEDELIVERABLE").set({ user: userName, token: userToken });
		Log.test("unknown deliverable (release): " + response.status + " -> " + JSON.stringify(response.body));
		expect(response.status).to.equal(400);
		expect(response.body.failure).to.not.be.undefined;
	});

	it("Should list repositories that are ready to be released", async function () {
		// NOTE: the release plan is only non-empty once repos exist and have been provisioned, so the
		// other release test only ever sees an empty list -- and never checks the shape of what comes
		// back. This seeds that state directly (no GitHub involved) so the transport the admin UI
		// reads is actually exercised.
		//
		// It builds its own deliverable and student rather than reusing the shared fixtures: earlier
		// tests in this file delete deliverables, so nothing here can assume they still exist.
		const dbc = DatabaseController.getInstance();

		const delivId = "releasePlanSpecDeliv";
		const deliv = TestHarness.createDeliverable(delivId);
		deliv.shouldProvision = true;
		deliv.teamMinSize = 1;
		deliv.teamMaxSize = 1; // so a singleton team can be formed for one student
		await dbc.writeDeliverable(deliv);

		const person = TestHarness.createPerson("releasePlanSpecPerson", "releasePlanSpecPerson", "releasePlanSpecGithub", PersonKind.STUDENT);
		await dbc.writePerson(person);

		const ac = new AdminController(new GitHubController(GitHubActions.getInstance(true)));
		const planned = await ac.prepareProvision(deliv, true); // creates the Team and Repository records
		expect(planned.length, "setup: preparing must plan at least one repo").to.be.greaterThan(0);

		// mark one repo and its team as provisioned-but-not-yet-attached, which is what planRelease
		// looks for
		const repo = await dbc.getRepository(planned[0].id);
		repo.gitHubStatus = RepoStatus.READY;
		repo.URL = "https://example.com/" + repo.id;
		await dbc.writeRepository(repo);
		for (const teamId of repo.teamIds) {
			const team = await dbc.getTeam(teamId);
			team.gitHubStatus = TeamStatus.CREATED;
			await dbc.writeTeam(team);
		}

		const response = await request(app)
			.get("/portal/admin/release/" + delivId)
			.set({ user: userName, token: userToken });
		Log.test("release plan: " + response.status + " -> " + JSON.stringify(response.body));

		expect(response.status).to.equal(200);
		expect(response.body.success).to.be.an("array");
		const entry = (response.body.success as any[]).find((r) => r.id === repo.id);
		expect(entry, "the provisioned repo must be in the release plan").to.not.be.undefined;
		expect(entry.delivId).to.equal(delivId);
		expect(entry.gitHubStatus).to.equal("READY"); // finalized, not yet released
		expect(entry.URL).to.equal(repo.URL);
	}).timeout(TestHarness.TIMEOUTLONG);

	it("Should NOT be able to start a classlist update if not authorized as admin", async function () {
		// NOTE: updating from the Classlist API used to be PUT /portal/admin/classlist. It is now
		// the "classlist-update" job, because for a large class the API call plus the per-student
		// writes can outlast the proxy's 90s read timeout.
		const response = await request(app).post("/portal/admin/job/classlist-update").send({});
		Log.test("unauthorized classlist job start -> " + response.status + "; body: " + JSON.stringify(response.body));

		expect(response.status).to.equal(401);
		expect(response.body).to.haveOwnProperty("failure");
	});

	// /**
	//  * PATCH TESTS
	//  */
	//
	// it.only("Should be able to list patches", async function () {
	//
	//     let response = null;
	//     let body: Payload;
	//
	//     const url = "/portal/admin/listPatches";
	//     try {
	//         response = await request(app).get(url).send().set({user: userName, token: userToken});
	//         body = response.body;
	//     } catch (err) {
	//         Log.test("ERROR: " + err);
	//     }
	//     Log.test(response.status + " -> " + JSON.stringify(body));
	//     expect(response.status).to.equal(200);
	//     expect(body.success).to.not.be.undefined;
	//     expect(body.success.message).to.be.an("string");
	// });
	//
	it("Should return a Classy failure payload when a body-less request is sent.", async function () {
		// NOTE: the admin UI sends requests with AdminView.getOptions(), which sets
		// Content-Type: application/json but often attaches NO body. Fastify's default JSON parser
		// rejects that with its own error shape ({statusCode, code, error, message}), which has no
		// `failure` field -- so the client crashed on body.failure.message. Restify accepted it.
		//
		// The 400 below therefore has to come from the handler (an unknown job kind), not from the
		// parser: reaching the handler at all is what proves the empty body was accepted.
		const response = await request(app)
			.post("/portal/admin/job/noSuchKind")
			.set({ user: userName, token: userToken, "Content-Type": "application/json" });

		Log.test("body-less POST -> " + response.status + "; body: " + JSON.stringify(response.body));

		expect(response.status).to.equal(400);
		expect(response.body.failure, "error response must carry a Classy failure payload").to.not.be.undefined;
		expect(response.body.failure.message).to.contain("Unknown job kind");
	});

	describe("Background jobs", function () {
		/**
		 * A synthetic kind, so these exercise the routes rather than any real handler.
		 */
		const KIND = "route-test-job";

		before(function () {
			JobController.getInstance().register(KIND, async () => {
				return { ok: true };
			});
		});

		it("Should reject an unauthenticated job start.", async function () {
			const response = await request(app)
				.post("/portal/admin/job/" + KIND)
				.send({});
			Log.test("unauthenticated job start -> " + response.status);
			expect(response.status).to.equal(401);
		});

		it("Should start a job and return it immediately.", async function () {
			const response = await request(app)
				.post("/portal/admin/job/" + KIND)
				.send({ some: "param" })
				.set({ user: userName, token: userToken });
			Log.test("job start -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(200);
			const job = response.body.success;
			expect(job.id).to.be.a("string");
			expect(job.kind).to.equal(KIND);
			// the request must not wait for the work: a real sync runs far past the 90s proxy timeout
			expect(job.state).to.equal("RUNNING");
			expect(job.requestedBy).to.equal(userName); // audit
			expect(job.params.some).to.equal("param");
		});

		it("Should have registered the kinds the admin UI starts.", async function () {
			// these are registered by BackendServer::start(); without them the buttons 400
			const jc = JobController.getInstance();
			expect(jc.isRegistered("classlist-update"), "classlist-update").to.be.true;
			expect(jc.isRegistered("student-withdraw"), "student-withdraw").to.be.true;
			expect(jc.isRegistered("prairielearn-sync"), "prairielearn-sync").to.be.true;
			expect(jc.isRegistered("provision-prepare"), "provision-prepare").to.be.true;
			expect(jc.isRegistered("provision-create"), "provision-create").to.be.true;
			expect(jc.isRegistered("provision-release"), "provision-release").to.be.true;
		});

		it("Should reject an unknown job kind.", async function () {
			const response = await request(app).post("/portal/admin/job/noSuchKind").send({}).set({ user: userName, token: userToken });
			Log.test("unknown kind -> " + response.status + "; body: " + JSON.stringify(response.body));

			expect(response.status).to.equal(400);
			expect(response.body.failure.message).to.contain("Unknown job kind");
		});

		it("Should retrieve a job by id.", async function () {
			const created = await request(app)
				.post("/portal/admin/job/" + KIND)
				.send({})
				.set({ user: userName, token: userToken });
			const id = created.body.success.id;

			const response = await request(app)
				.get("/portal/admin/job/" + id)
				.set({ user: userName, token: userToken });
			expect(response.status).to.equal(200);
			expect(response.body.success.id).to.equal(id);
		});

		it("Should 404 an unknown job id.", async function () {
			const response = await request(app).get("/portal/admin/job/noSuchJob").set({ user: userName, token: userToken });
			expect(response.status).to.equal(404);
		});

		it("Should list jobs, newest first.", async function () {
			const response = await request(app).get("/portal/admin/jobs").set({ user: userName, token: userToken });
			Log.test("job list -> " + response.status + "; count: " + (response.body.success || []).length);

			expect(response.status).to.equal(200);
			expect(response.body.success).to.be.an("array");
			expect(response.body.success.length).to.be.greaterThan(0);
		});

		it("Should accept a cancellation request.", async function () {
			const created = await request(app)
				.post("/portal/admin/job/" + KIND)
				.send({})
				.set({ user: userName, token: userToken });
			const id = created.body.success.id;

			const response = await request(app)
				.delete("/portal/admin/job/" + id)
				.set({ user: userName, token: userToken });
			Log.test("job cancel -> " + response.status);

			// cancellation is cooperative: this returns before the job has actually stopped
			expect(response.status).to.equal(200);
		});

		it("Should 404 cancelling an unknown job.", async function () {
			const response = await request(app).delete("/portal/admin/job/noSuchJob").set({ user: userName, token: userToken });
			expect(response.status).to.equal(404);
		});
	});

	// server.get("/portal/admin/listPatches", AdminRoutes.isAdmin, AdminRoutes.listPatches);
	// server.post("/portal/admin/patchRepo/:repo/:patch/:root", AdminRoutes.isAdmin, AdminRoutes.patchRepo);
	// server.get("/portal/admin/patchSource", AdminRoutes.isAdmin, AdminRoutes.patchSource);
	// server.post("/portal/admin/updatePatches", AdminRoutes.isAdmin, AdminRoutes.updatePatches);
});
