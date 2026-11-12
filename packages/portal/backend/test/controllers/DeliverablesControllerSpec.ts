import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubController } from "@backend/controllers/GitHubController";
import { Deliverable } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import { TestHarness } from "@common/TestHarness";
import { DeliverableTransport } from "@common/types/PortalTypes";

import "@common/GlobalSpec"; // load first
import "./DatabaseControllerSpec"; // run first

describe("DeliverablesController", () => {
	let dc: DeliverablesController;

	let DELIV1: Deliverable = null; // delivs are complex so just use one for the whole suite

	before(async () => {
		await TestHarness.suiteBefore("DeliverablesController");
		DELIV1 = TestHarness.createDeliverable(TestHarness.DELIVID1);
	});

	beforeEach(() => {
		dc = new DeliverablesController();
	});

	after(() => {
		TestHarness.suiteAfter("DeliverablesController");
	});

	it("Should be able to get all deliverables, even if there are none.", async () => {
		const delivs = await dc.getAllDeliverables();
		expect(delivs).to.have.lengthOf(0);
	});

	it("Should be able to save a deliverable.", async () => {
		let delivs = await dc.getAllDeliverables();
		expect(delivs).to.have.lengthOf(0);

		const valid = await dc.saveDeliverable(DELIV1);
		expect(valid).to.not.be.null;
		delivs = await dc.getAllDeliverables();
		expect(delivs).to.have.lengthOf(1);
		expect(delivs[0].id).to.equal(DELIV1.id);
	});

	it("Should update an existing deliverable.", async () => {
		let delivs = await dc.getAllDeliverables();
		expect(delivs).to.have.lengthOf(1);

		const deliv2: Deliverable = Object.assign({}, DELIV1);
		deliv2.gradesReleased = true;
		deliv2.teamMinSize = 4;

		const valid = await dc.saveDeliverable(deliv2);
		expect(valid).to.not.be.null;
		delivs = await dc.getAllDeliverables();
		expect(delivs).to.have.lengthOf(1);
		expect(delivs[0].gradesReleased).to.be.true;
		expect(delivs[0].teamMinSize).to.equal(4);
	});

	it("Should be able to get a specific deliverable.", async () => {
		const deliv = await dc.getDeliverable(TestHarness.DELIVID1);
		expect(deliv).to.not.be.null;
		expect(deliv.id).to.equal(TestHarness.DELIVID1);
	});

	it("Should be able to invalidate bad deliverables.", async () => {
		let deliv = await dc.validateDeliverableTransport(undefined);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		deliv = await dc.validateDeliverableTransport(null);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");

		deliv = await dc.validateDeliverableTransport({ id: "a" } as DeliverableTransport);
		expect(deliv).to.not.be.null;
		expect(deliv).to.be.an("string");
	});

	it("Should accept an empty Import URL and reject a malformed one.", async () => {
		const base = { id: "d1validate" } as DeliverableTransport;

		// empty is allowed: the bootstrap repo may not exist when the deliverable is created
		expect(dc.validateDeliverableTransport({ ...base, importURL: null })).to.be.null;
		expect(dc.validateDeliverableTransport({ ...base, importURL: "" })).to.be.null;
		expect(dc.validateDeliverableTransport({ ...base, importURL: "   " })).to.be.null;

		// both accepted forms
		expect(dc.validateDeliverableTransport({ ...base, importURL: "https://github.test/org/bootstrap.git" })).to.be.null;
		expect(dc.validateDeliverableTransport({ ...base, importURL: "https://github.test/org/bootstrap.git#main:dir" })).to.be.null;
		expect(dc.validateDeliverableTransport({ ...base, importURL: "org/template" })).to.be.null;
		expect(dc.validateDeliverableTransport({ ...base, importURL: "org/template#main" })).to.be.null;

		// neither a git URL nor owner/repo
		for (const bad of ["bootstrap", "org/", "/template", "org/sub/template", "org/template.git", "github.test/org/bootstrap.git"]) {
			const msg = dc.validateDeliverableTransport({ ...base, importURL: bad });
			expect(msg, bad).to.be.a("string");
			expect(msg, bad).to.contain("Import URL");
		}
		expect(dc.validateDeliverableTransport({ ...base, importURL: " org/template" })).to.contain("whitespace");
	});

	it("Should reject an SSH Import URL and suggest the HTTPS one.", async () => {
		// Classy clones over HTTPS with the bot token; the portal image has no ssh client, so these
		// only ever failed at clone time, once per repository
		const base = { id: "d1validate" } as DeliverableTransport;

		const scp = dc.validateDeliverableTransport({ ...base, importURL: "git@github.test:org/bootstrap.git" });
		expect(scp).to.contain("SSH address");
		expect(scp).to.contain("https://github.test/org/bootstrap.git");

		const withBranch = dc.validateDeliverableTransport({ ...base, importURL: "git@github.test:org/bootstrap.git#main:dir" });
		expect(withBranch, "the branch specifier is kept").to.contain("https://github.test/org/bootstrap.git#main:dir");

		const ssh = dc.validateDeliverableTransport({ ...base, importURL: "ssh://git@github.test:22/org/bootstrap.git" });
		expect(ssh).to.contain("SSH address");
		expect(ssh).to.contain("https://github.test/org/bootstrap.git");

		expect(GitHubController.httpsEquivalent("git@"), "nothing to suggest").to.be.null;
		expect(dc.validateDeliverableTransport({ ...base, importURL: "git@" })).to.contain("SSH address");
	});

	it("Should summarise a provisioning failure without the token or the wrappers.", async () => {
		const token = Config.getInstance().getProp(ConfigKey.githubBotToken).replace("token ", "");
		const err = new Error(
			"GithubController::provisionRepositoryFromFS( r1 ) - ERROR: Error: ChildProcessError: Command failed: git clone -q https://" +
				token +
				"@github.test/org/bootstrap /tmp/x\nerror: cannot run ssh: No such file or directory\nfatal: unable to fork\n `git clone` (exited with error code 128)"
		);
		const cause = GitHubController.summarizeCause(err);
		expect(cause).to.equal("; cause: error: cannot run ssh: No such file or directory; fatal: unable to fork");

		// no git-marked lines: the first line, minus the nested "- ERROR: Error:" prefixes, and never the token
		const plain = GitHubController.summarizeCause(
			new Error("A::b( r1 ) - ERROR: Error: C::d() - ERROR: Error: clone of https://" + token + "@h/x failed")
		);
		expect(plain.startsWith("; cause: clone of https://")).to.be.true;
		if (token.length >= 8) {
			expect(plain).to.not.contain(token);
		}

		expect(GitHubController.summarizeCause(new Error(""))).to.equal("");
		expect(GitHubController.summarizeCause(undefined)).to.equal("");
		expect(GitHubController.summarizeCause(new Error("x".repeat(500))).length).to.be.lessThan(270);
	});

	// this test should be last
	it("Should enforce minimum constraint on student delay in deliverables when saving.", async () => {
		const db = DatabaseController.getInstance();

		const allPeople = await db.getPeople();
		for (const p of allPeople) {
			await db.deletePerson(p);
		}

		let deliv = await dc.getDeliverable(TestHarness.DELIVID1);
		expect(deliv).to.not.be.null;

		deliv.autotest.studentDelay = 60; // 1 minute
		const valid = await dc.saveDeliverable(deliv);
		expect(valid).to.not.be.null;

		deliv = await dc.getDeliverable(TestHarness.DELIVID1);
		expect(deliv).to.not.be.null;
		expect(deliv.autotest.studentDelay).to.be.greaterThan(120);
	});

	it("Should enforce custom entered minimum delay between grade requests", async () => {
		DatabaseController.getInstance();
		let deliv = await dc.getDeliverable(TestHarness.DELIVID1);
		expect(deliv).to.not.be.null;
		deliv.autotest.studentDelay = 901; // 15 minutes, 1 second

		const valid = await dc.saveDeliverable(deliv);
		expect(valid).to.not.be.null;

		deliv = await dc.getDeliverable(TestHarness.DELIVID1);
		expect(deliv).to.not.be.null;
		expect(deliv.autotest.studentDelay).to.be.equal(901);
	});
});
