import { expect } from "chai";
import "mocha";
import * as os from "node:os";
import * as path from "node:path";

import AdmZip = require("adm-zip");

import * as fs from "fs-extra";

import "@common/GlobalSpec"; // load first

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { HandbackController } from "@backend/controllers/HandbackController";
import { AuditLabel } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import { TestHarness } from "@common/TestHarness";

describe("HandbackController", function () {
	const dc = DatabaseController.getInstance();
	const hc = new HandbackController();
	const DELIV = TestHarness.DELIVID1;
	let originalPersist: string;
	let tmp: string;

	before(async function () {
		await TestHarness.suiteBefore("HandbackController");
		await TestHarness.preparePeople();
		await TestHarness.prepareDeliverables();
		originalPersist = Config.getInstance().getProp(ConfigKey.persistDir);
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "handback-"));
		Config.getInstance().setProp(ConfigKey.persistDir, tmp);
		fs.ensureDirSync(HandbackController.rootDir());
	});

	after(function () {
		Config.getInstance().setProp(ConfigKey.persistDir, originalPersist);
		fs.removeSync(tmp);
		TestHarness.suiteAfter("HandbackController");
	});

	function zipWith(entries: { [name: string]: string | null }): string {
		const zip = new AdmZip();
		for (const name of Object.keys(entries)) {
			if (entries[name] === null) {
				zip.addFile(name, Buffer.alloc(0)); // a directory entry
			} else {
				zip.addFile(name, Buffer.from(entries[name]));
			}
		}
		const file = path.join(tmp, "upload-" + Date.now() + ".zip");
		zip.writeZip(file);
		return file;
	}

	it("Should reduce uploaded names to safe base names.", function () {
		expect(HandbackController.safeFileName("a1b2c.pdf")).to.equal("a1b2c.pdf");
		expect(HandbackController.safeFileName("marked/a1b2c.pdf"), "folder dropped").to.equal("a1b2c.pdf");
		expect(HandbackController.safeFileName("..\\..\\a1b2c.pdf"), "windows separators").to.equal("a1b2c.pdf");
		expect(HandbackController.safeFileName("../../etc/passwd"), "traversal").to.equal("passwd");
		expect(HandbackController.safeFileName("a b (1).pdf"), "spaces and brackets").to.equal("a_b__1_.pdf");
		expect(HandbackController.safeFileName(".hidden"), "leading dots").to.equal("hidden");
		expect(HandbackController.safeFileName("")).to.be.null;
		expect(HandbackController.safeFileName("...")).to.be.null;
		expect(HandbackController.safeFileName(undefined)).to.be.null;
	});

	it("Should read the CSID from the front of a file name.", function () {
		expect(HandbackController.csIdFromFileName("a1b2c.pdf")).to.equal("a1b2c");
		expect(HandbackController.csIdFromFileName("a1b2c_midterm.pdf")).to.equal("a1b2c");
		expect(HandbackController.csIdFromFileName("A1B2C-v2.pdf"), "case folded").to.equal("a1b2c");
		expect(HandbackController.csIdFromFileName("a1b2c.midterm.pdf"), "first dot ends it").to.equal("a1b2c");
		expect(HandbackController.csIdFromFileName("a1b2c")).to.equal("a1b2c");
	});

	it("Should store a zip of files for the students their names identify.", async function () {
		const zipPath = zipWith({
			[TestHarness.USER1.csId + ".pdf"]: "user1 midterm",
			["marked/" + TestHarness.USER2.csId.toUpperCase() + "_midterm.pdf"]: "user2 midterm",
			"nobody.pdf": "no such student",
			"__MACOSX/._junk.pdf": "finder noise",
			"marked/": null,
		});
		const summary = await hc.importZip(DELIV, zipPath, TestHarness.ADMIN1.id);

		expect(summary.stored.map((s) => s.csId)).to.have.members([TestHarness.USER1.csId, TestHarness.USER2.csId]);
		expect(summary.replaced).to.deep.equal([]);
		expect(summary.unmatched).to.deep.equal(["nobody.pdf"]);
		expect(summary.skipped).to.deep.equal(["__MACOSX/._junk.pdf"]);

		const user1 = await hc.getHandbacksForPerson(TestHarness.USER1.id);
		expect(user1).to.have.length(1);
		expect(user1[0].fileName).to.equal(TestHarness.USER1.csId + ".pdf");
		expect(user1[0].delivId).to.equal(DELIV);
		expect(user1[0].uploadedBy).to.equal(TestHarness.ADMIN1.id);
		expect(user1[0].size).to.equal("user1 midterm".length);
		expect(fs.readFileSync(HandbackController.pathFor(user1[0]), "utf8")).to.equal("user1 midterm");

		const user2 = await hc.getHandbacksForPerson(TestHarness.USER2.id);
		expect(user2).to.have.length(1);
		expect(user2[0].fileName, "folder dropped, case kept").to.equal(TestHarness.USER2.csId.toUpperCase() + "_midterm.pdf");

		const forDeliv = await hc.getHandbacksForDeliverable(DELIV);
		expect(forDeliv).to.have.length(2);
		expect(await hc.getHandbacksForDeliverable("noSuchDeliv")).to.deep.equal([]);

		// nothing was left behind by the import
		expect(fs.readdirSync(HandbackController.rootDir()).filter((n) => n.startsWith(".import-"))).to.deep.equal([]);

		const audits = await dc.getAudits(AuditLabel.HANDBACK_UPLOAD);
		expect(audits.length).to.be.greaterThan(0);
	});

	it("Should replace a file handed back again under the same name.", async function () {
		const zipPath = zipWith({ [TestHarness.USER1.csId + ".pdf"]: "user1 midterm, regraded" });
		const summary = await hc.importZip(DELIV, zipPath, TestHarness.ADMIN1.id);

		expect(summary.stored).to.have.length(1);
		expect(summary.replaced).to.deep.equal([TestHarness.USER1.csId + ".pdf"]);
		const user1 = await hc.getHandbacksForPerson(TestHarness.USER1.id);
		expect(user1, "still one record").to.have.length(1);
		expect(fs.readFileSync(HandbackController.pathFor(user1[0]), "utf8")).to.equal("user1 midterm, regraded");
	});

	it("Should store a single file for a named student, and refuse an unknown one.", async function () {
		const src = path.join(tmp, "single.txt");
		fs.writeFileSync(src, "code review");
		const summary = await hc.importSingle(
			DELIV,
			" " + TestHarness.USER1.csId.toUpperCase() + " ",
			"Code Review (final).txt",
			src,
			TestHarness.ADMIN1.id
		);
		expect(summary.stored).to.deep.equal([{ csId: TestHarness.USER1.csId, fileName: "Code_Review__final_.txt" }]);

		const user1 = await hc.getHandbacksForPerson(TestHarness.USER1.id);
		expect(user1.map((h) => h.fileName)).to.have.members([TestHarness.USER1.csId + ".pdf", "Code_Review__final_.txt"]);

		let ex: Error = null;
		try {
			await hc.importSingle(DELIV, "noSuchCsId", "x.txt", src, TestHarness.ADMIN1.id);
		} catch (err) {
			ex = err;
		}
		expect(ex?.message).to.contain("No student with CSID");
	});

	it("Should remove a handback from disk and from the database.", async function () {
		const before = await hc.getHandbacksForPerson(TestHarness.USER1.id);
		const target = before.find((h) => h.fileName === "Code_Review__final_.txt");
		expect(target).to.not.be.undefined;
		const file = HandbackController.pathFor(target);
		expect(fs.existsSync(file)).to.be.true;

		expect(await hc.remove(target, TestHarness.ADMIN1.id)).to.be.true;
		expect(fs.existsSync(file)).to.be.false;
		expect(await hc.getHandback(DELIV, TestHarness.USER1.id, target.fileName)).to.be.null;
		expect((await hc.getHandbacksForPerson(TestHarness.USER1.id)).map((h) => h.fileName)).to.deep.equal([TestHarness.USER1.csId + ".pdf"]);
	});

	it("Should give students and admins different download URLs, and a content type per extension.", function () {
		const hb = { personId: "p 1", delivId: "d1", fileName: "a b.pdf", size: 1, uploadedBy: "x", timestamp: 1 };
		expect(HandbackController.toTransport(hb, false).URL).to.equal("/portal/handback/d1/a%20b.pdf");
		expect(HandbackController.toTransport(hb, true).URL).to.equal("/portal/admin/handback/d1/p%201/a%20b.pdf");
		expect(HandbackController.contentType("x.PDF")).to.equal("application/pdf");
		expect(HandbackController.contentType("x.unknownext")).to.equal("application/octet-stream");
		expect(HandbackController.contentType("noext")).to.equal("application/octet-stream");
	});
});
