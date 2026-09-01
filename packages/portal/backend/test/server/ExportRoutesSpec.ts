import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import BackendServer from "@backend/server/BackendServer";
import { ExportRoutes } from "@backend/server/common/ExportRoutes";
import { AuditLabel, Grade, PersonKind } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import type * as http from "http";
import request from "supertest";

describe("Export Routes", function () {
	let app: http.Server = null;
	let server: BackendServer = null;

	const PREFIX = ExportRoutes.PREFIX;

	// fabricated for this suite; not a credential for anything
	const TOKEN_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
	const TOKEN_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
	const CONSUMER_A = "elms";
	const CONSUMER_B = "dashboard";

	const RELEASED = "exportReleased";
	const UNRELEASED = "exportUnreleased";

	const SNUM1 = "12345678";
	const SNUM2 = "87654321";
	const SNUM_STAFF = "55555555";

	// deliberately multi-line, with the metacharacters an AutoTest comment actually contains
	const MARKDOWN =
		'## AutoTest\n\n42/45 passed.\n\n- `Tide.merge` — mutates its argument\n\n```\nInsightError: "bad" \\ query\n```\n\nSee [the handbook](https://ubccpsc.github.io/310/).';

	let originalTokens: string;

	async function makeGrade(personId: string, delivId: string, score: number, comment: string, custom: any): Promise<void> {
		const grade: Grade = {
			personId: personId,
			delivId: delivId,
			score: score,
			comment: comment,
			timestamp: 1787900000000,
			urlName: "commit",
			URL: "https://github.example/commit/abc123",
			custom: custom,
		};
		await DatabaseController.getInstance().writeGrade(grade);
	}

	before(async () => {
		Log.test("ExportRoutes::before - start");

		await TestHarness.suiteBefore("Export Routes");
		await TestHarness.prepareAll();

		const dc = DatabaseController.getInstance();

		// two deliverables, differing only in whether their grades are released
		const released = TestHarness.createDeliverable(RELEASED);
		released.gradesReleased = true;
		await dc.writeDeliverable(released);

		const unreleased = TestHarness.createDeliverable(UNRELEASED);
		unreleased.gradesReleased = false;
		await dc.writeDeliverable(unreleased);

		// TestHarness people have no student number, and the export needs one
		const user1 = await dc.getPerson(TestHarness.USER1.id);
		(user1 as any).studentNumber = SNUM1;
		await dc.writePerson(user1);

		// USER2 has withdrawn, and must still be exported
		const user2 = await dc.getPerson(TestHarness.USER2.id);
		(user2 as any).studentNumber = SNUM2;
		user2.kind = PersonKind.WITHDRAWN;
		await dc.writePerson(user2);

		// staff accumulate grades from testing; they must never be exported
		const staff = await dc.getPerson(TestHarness.STAFF1.id);
		(staff as any).studentNumber = SNUM_STAFF;
		await dc.writePerson(staff);

		await makeGrade(TestHarness.USER1.id, RELEASED, 88, MARKDOWN, {});
		await makeGrade(TestHarness.USER2.id, RELEASED, 70, "**Developing.**", { displayScore: "DEVELOPING" });
		await makeGrade(TestHarness.STAFF1.id, RELEASED, 100, "staff test run", {});
		// USER3 is deliberately left ungraded on RELEASED

		await makeGrade(TestHarness.USER1.id, UNRELEASED, 50, "not for release", {});

		originalTokens = Config.getInstance().getProp(ConfigKey.apiTokens);
		Config.getInstance().setProp(ConfigKey.apiTokens, CONSUMER_A + ":" + TOKEN_A + "," + CONSUMER_B + ":" + TOKEN_B);

		server = new BackendServer(false);
		try {
			await server.start();
			Log.test("ExportRoutes::before - server started");
			app = server.getServer();
		} catch (err) {
			Log.test("ExportRoutes::before - server might already be started: " + err);
		}
	});

	after(async function () {
		Log.test("ExportRoutes::after - start");
		Config.getInstance().setProp(ConfigKey.apiTokens, originalTokens);
		await server.stop();
		await TestHarness.suiteAfter("Export Routes");
	});

	describe("authentication", function () {
		it("Should reject a request with no Authorization header.", async function () {
			const response = await request(app).get(PREFIX + "/grades/" + RELEASED);

			expect(response.status).to.equal(401);
			expect(response.body.error.code).to.equal("INVALID_TOKEN");
			expect(response.body.grades, "a rejected request must not carry grades").to.be.undefined;
		});

		it("Should reject a token sent with the wrong scheme.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Token " + TOKEN_A);

			expect(response.status).to.equal(401);
			expect(response.body.error.code).to.equal("INVALID_TOKEN");
		});

		it("Should reject a malformed Authorization header.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer");

			expect(response.status).to.equal(401);
			expect(response.body.error.code).to.equal("INVALID_TOKEN");
		});

		it("Should reject an unknown token.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + "c".repeat(TOKEN_A.length));

			expect(response.status).to.equal(401);
			expect(response.body.error.code).to.equal("INVALID_TOKEN");
		});

		it("Should reject a token that is a prefix of a configured token.", async function () {
			// guards the length check in tokensMatch: a truncated token must not pass
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A.slice(0, 8));

			expect(response.status).to.equal(401);
			expect(response.body.error.code).to.equal("INVALID_TOKEN");
		});

		it("Should reject every token when none are configured.", async function () {
			// unset, not empty-string: this is the normal state for a course that does not use the
			// export, and it is the case where a missing guard throws rather than refusing
			Config.getInstance().setProp(ConfigKey.apiTokens, undefined);
			try {
				const response = await request(app)
					.get(PREFIX + "/grades/" + RELEASED)
					.set("Authorization", "Bearer " + TOKEN_A);

				// an unconfigured export is off, not open
				expect(response.status).to.equal(401);
				expect(response.body.error.code).to.equal("INVALID_TOKEN");
			} finally {
				Config.getInstance().setProp(ConfigKey.apiTokens, CONSUMER_A + ":" + TOKEN_A + "," + CONSUMER_B + ":" + TOKEN_B);
			}
		});

		it("Should not echo the provided token back to the caller.", async function () {
			const provided = "dddddddddddddddddddddddddddddddd";
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + provided);

			expect(response.status).to.equal(401);
			expect(JSON.stringify(response.body)).to.not.contain(provided);
		});
	});

	describe("ping", function () {
		it("Should answer a ping with a valid token.", async function () {
			const response = await request(app)
				.get(PREFIX + "/ping")
				.set("Authorization", "Bearer " + TOKEN_A);

			expect(response.status).to.equal(200);
			expect(response.body.ok).to.equal(true);
			expect(response.body.service).to.equal("classy");
		});

		it("Should reject a ping with no token.", async function () {
			const response = await request(app).get(PREFIX + "/ping");

			expect(response.status).to.equal(401);
			expect(response.body.error.code).to.equal("INVALID_TOKEN");
		});

		it("Should not audit a ping.", async function () {
			const before = await DatabaseController.getInstance().getAudits(AuditLabel.GRADE_EXPORT, 1000);
			await request(app)
				.get(PREFIX + "/ping")
				.set("Authorization", "Bearer " + TOKEN_A);
			const after = await DatabaseController.getInstance().getAudits(AuditLabel.GRADE_EXPORT, 1000);

			expect(after.length).to.equal(before.length);
		});
	});

	describe("errors", function () {
		it("Should 404 an unknown deliverable.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/thisDelivDoesNotExist")
				.set("Authorization", "Bearer " + TOKEN_A);

			expect(response.status).to.equal(404);
			expect(response.body.error.code).to.equal("UNKNOWN_DELIVERABLE");
			expect(response.body.error.message).to.be.a("string");
		});

		it("Should 409 a deliverable whose grades are not released, without leaking them.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + UNRELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			expect(response.status).to.equal(409);
			expect(response.body.error.code).to.equal("GRADES_NOT_RELEASED");

			// the gate must not leak the thing it is gating
			expect(response.body.grades).to.be.undefined;
			expect(JSON.stringify(response.body)).to.not.contain("not for release");
			expect(JSON.stringify(response.body)).to.not.contain(SNUM1);
		});
	});

	describe("grades", function () {
		it("Should return the envelope the spec describes.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			expect(response.status).to.equal(200);
			expect(response.body.assessment).to.equal(RELEASED);
			expect(response.body.max).to.equal(100);
			expect(response.body.grades).to.be.an("array");

			// ISO-8601 with a Z, as published
			expect(response.body.generated_at).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it("Should return one row per graded student, and exclude staff.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			expect(response.status).to.equal(200);

			const snums = response.body.grades.map((g: any) => g.snum);
			expect(snums).to.have.members([SNUM1, SNUM2]);

			// staff grades come from testing and must never leave Classy
			expect(snums).to.not.contain(SNUM_STAFF);

			// USER3 has no grade for this deliverable, so has no row
			expect(response.body.grades.length).to.equal(2);
		});

		it("Should include a withdrawn student who has a grade.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			const withdrawn = response.body.grades.find((g: any) => g.snum === SNUM2);
			expect(withdrawn, "a withdrawn student's grade still exists").to.not.be.undefined;
			expect(withdrawn.score).to.equal(70);
		});

		it("Should send snum as a string, and cwl alongside it.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			const row = response.body.grades.find((g: any) => g.snum === SNUM1);
			expect(row.snum).to.be.a("string");
			expect(row.cwl).to.equal(TestHarness.USER1.github);
		});

		it("Should not send names.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			const body = JSON.stringify(response.body);
			expect(body).to.not.contain("first_" + TestHarness.USER1.id);
			expect(body).to.not.contain("last_" + TestHarness.USER1.id);
		});

		it("Should round-trip Markdown feedback unchanged.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			const row = response.body.grades.find((g: any) => g.snum === SNUM1);

			// byte-for-byte: the newlines, backticks, quotes and backslash all survive JSON transport
			expect(row.feedback).to.equal(MARKDOWN);
			expect(row.feedback).to.contain("\n");
		});

		it("Should send display_score only when the grade has one.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			const banded = response.body.grades.find((g: any) => g.snum === SNUM2);
			expect(banded.display_score).to.equal("DEVELOPING");
			expect(banded.score, "the numeric score stays, for staff-facing views").to.equal(70);

			const plain = response.body.grades.find((g: any) => g.snum === SNUM1);
			// absent, not null, so a consumer can branch on presence
			expect(plain).to.not.have.property("display_score");
		});

		it("Should carry the grade timestamp and URL.", async function () {
			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);

			const row = response.body.grades.find((g: any) => g.snum === SNUM1);
			expect(row.timestamp).to.equal(1787900000000);
			expect(row.url).to.equal("https://github.example/commit/abc123");
		});
	});

	describe("auditing", function () {
		it("Should write exactly one audit record naming the consumer that pulled.", async function () {
			const dc = DatabaseController.getInstance();
			const before = await dc.getAudits(AuditLabel.GRADE_EXPORT, 1000);

			const response = await request(app)
				.get(PREFIX + "/grades/" + RELEASED)
				.set("Authorization", "Bearer " + TOKEN_B);
			expect(response.status).to.equal(200);

			const after = await dc.getAudits(AuditLabel.GRADE_EXPORT, 1000);
			expect(after.length).to.equal(before.length + 1);

			// personId is the consumer name here; there is no person in this flow
			const record = after[0];
			expect(record.personId).to.equal(CONSUMER_B);
			expect(record.personId).to.not.equal(CONSUMER_A);
			expect((record.custom as any).delivId).to.equal(RELEASED);
			expect((record.custom as any).count).to.equal(2);
		});

		it("Should not audit a refused pull.", async function () {
			const dc = DatabaseController.getInstance();
			const before = await dc.getAudits(AuditLabel.GRADE_EXPORT, 1000);

			await request(app)
				.get(PREFIX + "/grades/" + UNRELEASED)
				.set("Authorization", "Bearer " + TOKEN_A);
			await request(app)
				.get(PREFIX + "/grades/nope")
				.set("Authorization", "Bearer " + TOKEN_A);
			await request(app).get(PREFIX + "/grades/" + RELEASED);

			const after = await dc.getAudits(AuditLabel.GRADE_EXPORT, 1000);
			expect(after.length).to.equal(before.length);
		});
	});
});
