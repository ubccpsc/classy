import { expect } from "chai";
import "mocha";
import * as os from "node:os";
import * as path from "node:path";

import AdmZip = require("adm-zip");

import * as fs from "fs-extra";
import type * as http from "http";
import request from "supertest";

import "@common/GlobalSpec"; // load first

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { HandbackController } from "@backend/controllers/HandbackController";
import BackendServer from "@backend/server/BackendServer";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

/**
 * The access rules are the point of these tests: a student gets exactly their own files, an admin
 * gets anyone's, and the student is always taken from who is asking rather than from the URL.
 */
describe("Handback Routes", function () {
	const dc = DatabaseController.getInstance();
	const DELIV = TestHarness.DELIVID1;
	const VIEW_AS = "x-classy-view-as";
	const USER1_FILE = TestHarness.USER1.csId + ".pdf";
	const USER2_FILE = TestHarness.USER2.csId + "_midterm.pdf";
	let app: http.Server = null;
	let server: BackendServer = null;
	let originalPersist: string;
	let tmp: string;
	let admin: { user: string; token: string };
	let user1: { user: string; token: string };
	let user2: { user: string; token: string };

	async function authFor(personId: string): Promise<{ user: string; token: string }> {
		let auth = await dc.getAuth(personId);
		if (auth === null) {
			await dc.writeAuth({ personId: personId, token: "handbackSpecToken_" + personId });
			auth = await dc.getAuth(personId);
		}
		return { user: auth.personId, token: auth.token };
	}

	before(async function () {
		await TestHarness.suiteBefore("Handback Routes");
		await TestHarness.prepareAll();
		originalPersist = Config.getInstance().getProp(ConfigKey.persistDir);
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "handback-routes-"));
		Config.getInstance().setProp(ConfigKey.persistDir, tmp);

		server = new BackendServer(false);
		await server.start();
		app = server.getServer();

		admin = await authFor(TestHarness.ADMIN1.id);
		user1 = await authFor(TestHarness.USER1.id);
		user2 = await authFor(TestHarness.USER2.id);
	});

	after(async function () {
		await server.stop();
		Config.getInstance().setProp(ConfigKey.persistDir, originalPersist);
		fs.removeSync(tmp);
		TestHarness.suiteAfter("Handback Routes");
	});

	/**
	 * supertest only collects the body as text for text content types; a PDF download has to be
	 * gathered by hand, so these come back with a Buffer body.
	 */
	function download(url: string, headers: { [header: string]: string }): request.Test {
		return request(app)
			.get(url)
			.set(headers)
			.buffer(true)
			.parse(function (res: any, cb: any) {
				const chunks: Buffer[] = [];
				res.on("data", (chunk: Buffer) => chunks.push(chunk));
				res.on("end", () => cb(null, Buffer.concat(chunks)));
			});
	}

	function zipOf(entries: { [name: string]: string }): string {
		const zip = new AdmZip();
		for (const name of Object.keys(entries)) {
			zip.addFile(name, Buffer.from(entries[name]));
		}
		const file = path.join(tmp, "upload-" + Date.now() + ".zip");
		zip.writeZip(file);
		return file;
	}

	it("Should let an admin hand back a zip of files named by CSID.", async function () {
		const zipPath = zipOf({ [USER1_FILE]: "user1 midterm", [USER2_FILE]: "user2 midterm", "stranger.pdf": "nobody" });
		const response = await request(app)
			.post("/portal/admin/handback/" + DELIV)
			.attach("handback", zipPath)
			.set(admin);
		Log.test("upload -> " + response.status + "; " + JSON.stringify(response.body));

		expect(response.status).to.equal(200);
		expect(response.body.success.stored).to.have.length(2);
		expect(response.body.success.unmatched).to.deep.equal(["stranger.pdf"]);
	});

	it("Should refuse an upload for an unknown deliverable, a non-zip without a CSID, and a non-admin.", async function () {
		const zipPath = zipOf({ [USER1_FILE]: "x" });
		const unknownDeliv = await request(app).post("/portal/admin/handback/noSuchDeliv").attach("handback", zipPath).set(admin);
		expect(unknownDeliv.status).to.equal(400);

		const single = path.join(tmp, "single.txt");
		fs.writeFileSync(single, "one file");
		const noCsId = await request(app)
			.post("/portal/admin/handback/" + DELIV)
			.attach("handback", single)
			.set(admin);
		expect(noCsId.status).to.equal(400);
		expect(noCsId.body.failure.message).to.contain("csId");

		const student = await request(app)
			.post("/portal/admin/handback/" + DELIV)
			.attach("handback", zipPath)
			.set(user1);
		expect(student.status, "students cannot upload").to.equal(401);
	});

	it("Should let an admin hand back a single file to a named student.", async function () {
		const single = path.join(tmp, "review.txt");
		fs.writeFileSync(single, "code review for user1");
		const response = await request(app)
			.post("/portal/admin/handback/" + DELIV + "?csId=" + TestHarness.USER1.csId)
			.attach("handback", single)
			.set(admin);
		expect(response.status).to.equal(200);
		expect(response.body.success.stored).to.deep.equal([{ csId: TestHarness.USER1.csId, fileName: "review.txt" }]);

		const unknown = await request(app)
			.post("/portal/admin/handback/" + DELIV + "?csId=noSuchCsId")
			.attach("handback", single)
			.set(admin);
		expect(unknown.status).to.equal(400);
		expect(unknown.body.failure.message).to.contain("No student with CSID");
	});

	it("Should list and serve a student only their own files.", async function () {
		const list1 = await request(app).get("/portal/handbacks").set(user1);
		expect(list1.status).to.equal(200);
		expect(list1.body.success.map((h: any) => h.fileName)).to.have.members([USER1_FILE, "review.txt"]);
		for (const hb of list1.body.success) {
			expect(hb.personId).to.equal(TestHarness.USER1.id);
			expect(hb.URL, "student URLs never name the student").to.equal("/portal/handback/" + DELIV + "/" + hb.fileName);
		}

		const list2 = await request(app).get("/portal/handbacks").set(user2);
		expect(list2.body.success.map((h: any) => h.fileName)).to.deep.equal([USER2_FILE]);

		const own = await download("/portal/handback/" + DELIV + "/" + USER1_FILE, user1);
		expect(own.status).to.equal(200);
		expect(own.headers["content-type"]).to.equal("application/pdf");
		expect(own.headers["content-disposition"]).to.equal('attachment; filename="' + USER1_FILE + '"');
		expect(own.body.toString()).to.equal("user1 midterm");

		// user2 asking for user1's file name gets nothing: the file is looked up under user2
		const other = await request(app)
			.get("/portal/handback/" + DELIV + "/" + USER1_FILE)
			.set(user2);
		expect(other.status).to.equal(404);
		expect(other.headers["content-type"]).to.contain("text/html");
		expect(other.text).to.contain("File not found");
		expect(other.text).to.not.contain(tmp);
	});

	it("Should serve a download from the cookie token, as a plain link does.", async function () {
		const response = await download("/portal/handback/" + DELIV + "/" + USER1_FILE, { Cookie: "token=" + user1.token + "__" + user1.user });
		expect(response.status).to.equal(200);
		expect(response.body.toString()).to.equal("user1 midterm");
	});

	it("Should refuse the listing and the download without credentials.", async function () {
		expect((await request(app).get("/portal/handbacks")).status).to.not.equal(200);
		const dl = await request(app)
			.get("/portal/handback/" + DELIV + "/" + USER1_FILE)
			.set({ user: user1.user, token: "wrong" });
		expect(dl.status).to.equal(401);
	});

	it("Should show an admin viewing as a student that student's files.", async function () {
		const response = await request(app).get("/portal/handbacks").set(admin).set(VIEW_AS, TestHarness.USER2.id);
		expect(response.status).to.equal(200);
		expect(response.body.success.map((h: any) => h.fileName)).to.deep.equal([USER2_FILE]);

		const dl = await download("/portal/handback/" + DELIV + "/" + USER2_FILE, { ...admin, [VIEW_AS]: TestHarness.USER2.id });
		expect(dl.status).to.equal(200);
		expect(dl.body.toString()).to.equal("user2 midterm");
	});

	it("Should let an admin list, download and remove anyone's file, and no one else.", async function () {
		const list = await request(app)
			.get("/portal/admin/handbacks/" + DELIV)
			.set(admin);
		expect(list.status).to.equal(200);
		expect(list.body.success).to.have.length(3);
		const user2File = list.body.success.find((h: any) => h.personId === TestHarness.USER2.id);
		expect(user2File.URL).to.equal("/portal/admin/handback/" + DELIV + "/" + TestHarness.USER2.id + "/" + USER2_FILE);

		const dl = await download(user2File.URL, admin);
		expect(dl.status).to.equal(200);
		expect(dl.body.toString()).to.equal("user2 midterm");

		expect(
			(
				await request(app)
					.get("/portal/admin/handbacks/" + DELIV)
					.set(user1)
			).status
		).to.equal(401);
		expect((await request(app).get(user2File.URL).set(user1)).status).to.equal(401);
		expect((await request(app).delete(user2File.URL).set(user1)).status).to.equal(401);

		const del = await request(app).delete(user2File.URL).set(admin);
		expect(del.status).to.equal(200);
		expect((await request(app).delete(user2File.URL).set(admin)).status, "already gone").to.equal(404);

		const gone = await request(app)
			.get("/portal/handback/" + DELIV + "/" + USER2_FILE)
			.set(user2);
		expect(gone.status).to.equal(404);
		const onDisk = HandbackController.pathFor({ delivId: DELIV, personId: TestHarness.USER2.id, fileName: USER2_FILE });
		expect(fs.existsSync(onDisk)).to.be.false;
		expect((await request(app).get("/portal/handbacks").set(user2)).body.success).to.deep.equal([]);
	});
});
