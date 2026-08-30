import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { ProvisionAgent } from "@backend/server/common/ProvisionAgent";
import { GitHubStatus, Repository } from "@backend/Types";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec"; // load first

/**
 * The validation ProvisionAgent does before any GitHub call.
 *
 * NOTE: this matters more than it looks. A job's params come from the client -- the route only
 * checks that the caller is an admin -- and the work then runs in the background, where a bad
 * parameter would otherwise be discovered part way through creating repositories.
 *
 * No network: every case here is rejected before the agent reaches GitHub.
 */
describe("ProvisionAgent", function () {
	const dbc = DatabaseController.getInstance();
	const agent = new ProvisionAgent();

	const OTHER_DELIV_REPO = "provisionAgentSpecRepo";

	before(async function () {
		await TestHarness.suiteBefore("ProvisionAgent");
		await TestHarness.prepareDeliverables();

		// a repo that belongs to the project deliverable, used to check the cross-deliverable guard
		const repo: Repository = {
			id: OTHER_DELIV_REPO,
			delivId: TestHarness.DELIVIDPROJ,
			teamIds: [],
			URL: null,
			cloneURL: null,
			gitHubStatus: GitHubStatus.NOT_PROVISIONED,
			custom: {},
		};
		await dbc.writeRepository(repo);
	});

	after(function () {
		TestHarness.suiteAfter("ProvisionAgent");
	});

	async function messageFrom(work: Promise<any>): Promise<string> {
		try {
			await work;
		} catch (err) {
			return err.message;
		}
		return null;
	}

	it("Should reject a create with no repositories selected.", async function () {
		const msg = await messageFrom(agent.create(TestHarness.DELIVID0, [], TestHarness.ADMIN1.id));
		Log.test("message: " + msg);
		expect(msg).to.contain("No repositories");
	});

	it("Should reject a create for a repository that does not exist.", async function () {
		const msg = await messageFrom(agent.create(TestHarness.DELIVID0, ["noSuchRepo"], TestHarness.ADMIN1.id));
		Log.test("message: " + msg);
		expect(msg).to.contain("Unknown repository");
	});

	it("Should reject a create for a repository from another deliverable.", async function () {
		// the repo exists, but provisioning it under a different deliverable would import the wrong
		// starter code into it
		const msg = await messageFrom(agent.create(TestHarness.DELIVID0, [OTHER_DELIV_REPO], TestHarness.ADMIN1.id));
		Log.test("message: " + msg);
		expect(msg).to.contain("does not belong to");
	});

	it("Should reject a create for an unknown deliverable.", async function () {
		const msg = await messageFrom(agent.create("noSuchDeliverable", [OTHER_DELIV_REPO], TestHarness.ADMIN1.id));
		Log.test("message: " + msg);
		expect(msg).to.contain("Unknown deliverable");
	});

	it("Should reject a create for a deliverable that is not provisionable.", async function () {
		const msg = await messageFrom(agent.create(TestHarness.DELIVID1, [OTHER_DELIV_REPO], TestHarness.ADMIN1.id));
		Log.test("message: " + msg);
		expect(msg).to.contain("not provisionable");
	});

	it("Should reject a release with the same validation as a create.", async function () {
		// release takes the same params, so it must not be laxer about them
		expect(await messageFrom(agent.release(TestHarness.DELIVID0, [], TestHarness.ADMIN1.id))).to.contain("No repositories");
		expect(await messageFrom(agent.release(TestHarness.DELIVID0, ["noSuchRepo"], TestHarness.ADMIN1.id))).to.contain("Unknown repository");
		expect(await messageFrom(agent.release(TestHarness.DELIVID0, [OTHER_DELIV_REPO], TestHarness.ADMIN1.id))).to.contain(
			"does not belong to"
		);
	});
});
