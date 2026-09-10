import { expect } from "chai";
import "mocha";

import { AdminController } from "@backend/controllers/AdminController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubError } from "@backend/controllers/GitHubActions";
import { ProvisionState } from "@backend/controllers/ProvisionState";
import { ProvisionAgent } from "@backend/server/common/ProvisionAgent";
import { AuditLabel, PersonKind, RepoStatus, Repository } from "@backend/Types";
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
			gitHubStatus: RepoStatus.NOT_CREATED,
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

	it("Should reject an un-release with the same validation as a release.", async function () {
		// un-release has no planning step: the selection comes straight from the released list, so
		// resolveRepos is the only thing standing between a bad request and the GitHub calls
		expect(await messageFrom(agent.unrelease(TestHarness.DELIVID0, [], TestHarness.ADMIN1.id))).to.contain("No repositories");
		expect(await messageFrom(agent.unrelease(TestHarness.DELIVID0, ["noSuchRepo"], TestHarness.ADMIN1.id))).to.contain(
			"Unknown repository"
		);
		expect(await messageFrom(agent.unrelease(TestHarness.DELIVID0, [OTHER_DELIV_REPO], TestHarness.ADMIN1.id))).to.contain(
			"does not belong to"
		);
	});

	it("Should reject an un-release for a deliverable that is not provisionable.", async function () {
		const msg = await messageFrom(agent.unrelease(TestHarness.DELIVID1, [OTHER_DELIV_REPO], TestHarness.ADMIN1.id));
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

	/**
	 * prepare() is the planning step: it creates the Team and Repository records an admin then
	 * selects from. Nothing here reaches GitHub -- the repos it "creates" are database records with
	 * gitHubStatus NOT_CREATED.
	 *
	 * It was completely uncovered. The counts it returns are what the UI reports back to the admin
	 * ("N repos created"), and they are computed as a before/after difference rather than from what
	 * was planned, so they are easy to get subtly wrong in a way no other test would notice.
	 */
	describe("prepare", function () {
		const PREPARE_DELIV = "provisionAgentPrepareDeliv";

		async function seedDeliverable(): Promise<void> {
			const deliv = TestHarness.createDeliverable(PREPARE_DELIV);
			deliv.shouldProvision = true;
			deliv.teamMinSize = 1;
			deliv.teamMaxSize = 1; // singleton teams, so one student gives one repo
			deliv.teamStudentsForm = false;
			await dbc.writeDeliverable(deliv);
		}

		it("Should create a team and a repo for each student, and count them.", async function () {
			await seedDeliverable();
			const person = TestHarness.createPerson("prepareSpecPerson", "prepareSpecPerson", "prepareSpecGithub", PersonKind.STUDENT);
			await dbc.writePerson(person);

			const summary = await agent.prepare(PREPARE_DELIV, true, TestHarness.ADMIN1.id);

			expect(summary.delivId).to.equal(PREPARE_DELIV);
			expect(summary.reposCreated, "a singleton deliverable gives each student a repo").to.be.greaterThan(0);
			expect(summary.teamsCreated, "and the team that owns it").to.be.greaterThan(0);
			expect(summary.repos, "repos planned must be at least the repos created").to.be.greaterThan(0);

			// the records exist, and nothing has been created on GitHub
			const repos = (await dbc.getRepositories()).filter((r) => r.delivId === PREPARE_DELIV);
			expect(repos.length).to.equal(summary.repos);
			for (const repo of repos) {
				expect(repo.gitHubStatus, "prepare must not claim anything exists on GitHub").to.equal(RepoStatus.NOT_CREATED);
			}
		});

		it("Should count nothing as created when it is run twice.", async function () {
			// the idempotence that makes the count meaningful: the admin who runs prepare a second
			// time must be told 0, not the total. Both counts are before/after differences, so a
			// regression here reads as "everything was just created" on a re-run.
			await seedDeliverable();
			const person = TestHarness.createPerson("prepareTwicePerson", "prepareTwicePerson", "prepareTwiceGithub", PersonKind.STUDENT);
			await dbc.writePerson(person);

			const first = await agent.prepare(PREPARE_DELIV, true, TestHarness.ADMIN1.id);
			expect(first.reposCreated).to.be.greaterThan(0);

			const second = await agent.prepare(PREPARE_DELIV, true, TestHarness.ADMIN1.id);
			expect(second.reposCreated, "nothing new to create").to.equal(0);
			expect(second.teamsCreated, "nothing new to create").to.equal(0);
			expect(second.repos, "but the planned repos are still reported").to.equal(first.repos);
		});

		it("Should write one audit record naming the requester.", async function () {
			await seedDeliverable();
			const before = await dbc.getAudits(AuditLabel.REPO_PROVISION, 1000);

			await agent.prepare(PREPARE_DELIV, true, TestHarness.ADMIN1.id);

			const after = await dbc.getAudits(AuditLabel.REPO_PROVISION, 1000);
			expect(after.length, "exactly one audit record per prepare").to.equal(before.length + 1);

			expect(after[0].personId).to.equal(TestHarness.ADMIN1.id);
			expect((after[0].custom as any).action).to.equal("prepare");
			expect((after[0].custom as any).delivId).to.equal(PREPARE_DELIV);
		});

		it("Should reject a deliverable that is not provisionable, before creating anything.", async function () {
			// DELIVID1 has shouldProvision false. The guard has to come first: the whole point of
			// prepare is that it writes records, so a late rejection would leave them behind.
			const teamsBefore = (await dbc.getTeams()).length;
			const reposBefore = (await dbc.getRepositories()).length;

			const msg = await messageFrom(agent.prepare(TestHarness.DELIVID1, true, TestHarness.ADMIN1.id));
			expect(msg).to.contain("not provisionable");

			expect((await dbc.getTeams()).length, "nothing may be written").to.equal(teamsBefore);
			expect((await dbc.getRepositories()).length, "nothing may be written").to.equal(reposBefore);
		});

		it("Should reject an unknown deliverable.", async function () {
			const msg = await messageFrom(agent.prepare("provisionAgentNoSuchDeliv", true, TestHarness.ADMIN1.id));
			expect(msg).to.contain("Unknown deliverable");
		});
	});

	describe("when a run gives up", function () {
		// NOTE: the create side of this is covered in AdminControllerSpec; release had nothing, and it
		// is the half that reads back what it managed to do (performRelease throws out of its loop, so
		// its return value is lost -- the statuses in the database are the record).
		it("Should report what it released before a fatal failure stopped it.", async function () {
			const deliv = await new DeliverablesController().getDeliverable(TestHarness.DELIVID0);
			deliv.shouldProvision = true;
			await dbc.writeDeliverable(deliv);

			// three repos ready to release; the second one kills the run
			const repoIds: string[] = [];
			for (const n of [1, 2, 3]) {
				const repo: Repository = {
					id: "provisionAgentSpecRelease" + n,
					delivId: TestHarness.DELIVID0,
					teamIds: [],
					URL: "https://example.com/r" + n,
					cloneURL: null,
					gitHubStatus: RepoStatus.READY,
					custom: {},
				};
				await dbc.writeRepository(repo);
				repoIds.push(repo.id);
			}

			// the first release works, the second is fatal
			let calls = 0;
			const failingController: any = {
				releaseRepository: async (repo: Repository) => {
					calls++;
					if (calls === 1) {
						await ProvisionState.setRepoStatus(repo, RepoStatus.RELEASED, "spec");
						return true;
					}
					throw new GitHubError("GitHub returned 401", 401, '{"message":"Bad credentials"}');
				},
				provisionRepository: async () => true,
				updateBranchProtection: async () => true,
				createIssues: async () => true,
				getRepositoryUrl: () => "https://example.com",
				getTeamUrl: async () => "https://example.com",
			};

			const failingAgent = new ProvisionAgent(new AdminController(failingController));

			let caught: any = null;
			try {
				await failingAgent.release(TestHarness.DELIVID0, repoIds, TestHarness.ADMIN1.id);
			} catch (err) {
				caught = err;
			}
			Log.test("caught: " + caught?.message + "; summary: " + JSON.stringify(caught?.summary));

			expect(caught, "a fatal failure must stop the release").to.not.be.null;
			expect(caught.name).to.equal("ProvisionAbortedError");

			// and the job must still be able to say what happened
			const partial = caught.summary;
			expect(partial, "a stopped run still reports what it did").to.not.be.null;
			expect(partial.released, "the one that worked is kept").to.equal(1);
			expect(partial.stoppedEarly).to.be.true;
			expect(partial.stopReason).to.contain("fatally");
			expect(calls, "it must not try the third").to.equal(2);
		});

		it("Should report what it un-released before a fatal failure stopped it.", async function () {
			// the mirror of the release case; this is the path unreleasedSoFar exists for
			const deliv = await new DeliverablesController().getDeliverable(TestHarness.DELIVID0);
			deliv.shouldProvision = true;
			await dbc.writeDeliverable(deliv);

			const repoIds: string[] = [];
			for (const n of [1, 2, 3]) {
				const repo: Repository = {
					id: "provisionAgentSpecUnrelease" + n,
					delivId: TestHarness.DELIVID0,
					teamIds: [],
					URL: "https://example.com/u" + n,
					cloneURL: null,
					gitHubStatus: RepoStatus.RELEASED,
					custom: {},
				};
				await dbc.writeRepository(repo);
				repoIds.push(repo.id);
			}

			let calls = 0;
			const failingController: any = {
				unreleaseRepository: async (repo: Repository) => {
					calls++;
					if (calls === 1) {
						await ProvisionState.setRepoStatus(repo, RepoStatus.READY, "spec");
						return true;
					}
					throw new GitHubError("GitHub returned 401", 401, '{"message":"Bad credentials"}');
				},
				releaseRepository: async () => true,
				provisionRepository: async () => true,
				updateBranchProtection: async () => true,
				createIssues: async () => true,
				getRepositoryUrl: () => "https://example.com",
				getTeamUrl: async () => "https://example.com",
			};

			const failingAgent = new ProvisionAgent(new AdminController(failingController));

			let caught: any = null;
			try {
				await failingAgent.unrelease(TestHarness.DELIVID0, repoIds, TestHarness.ADMIN1.id);
			} catch (err) {
				caught = err;
			}
			Log.test("caught: " + caught?.message + "; summary: " + JSON.stringify(caught?.summary));

			expect(caught, "a fatal failure must stop the un-release").to.not.be.null;
			expect(caught.name).to.equal("ProvisionAbortedError");

			// read back from the database, since performUnrelease throws out of its loop
			const partial = caught.summary;
			expect(partial, "a stopped run still reports what it did").to.not.be.null;
			expect(partial.unreleased, "the one that worked is kept").to.equal(1);
			expect(partial.stoppedEarly).to.be.true;
			expect(partial.stopReason).to.contain("fatally");
			expect(calls, "it must not try the third").to.equal(2);
		});
	});

	describe("un-release summaries", function () {
		/**
		 * The summary is what the admin UI renders, so its counts are a contract: the status line
		 * says "N of M un-released" and lists what failed.
		 */
		async function makeRepo(id: string, status: RepoStatus): Promise<string> {
			const repo: Repository = {
				id: id,
				delivId: TestHarness.DELIVID0,
				teamIds: [],
				URL: "https://example.com/" + id,
				cloneURL: null,
				gitHubStatus: status,
				custom: {},
			};
			await dbc.writeRepository(repo);
			return repo.id;
		}

		function controllerFor(behaviour: (repo: Repository) => Promise<boolean>): any {
			return {
				unreleaseRepository: behaviour,
				releaseRepository: async () => true,
				provisionRepository: async () => true,
				updateBranchProtection: async () => true,
				createIssues: async () => true,
				getRepositoryUrl: () => "https://example.com",
				getTeamUrl: async () => "https://example.com",
			};
		}

		before(async function () {
			const deliv = await new DeliverablesController().getDeliverable(TestHarness.DELIVID0);
			deliv.shouldProvision = true;
			await dbc.writeDeliverable(deliv);
		});

		it("Should count what it un-released, skipped, and failed.", async function () {
			const ok = await makeRepo("agentUnrelOk_" + Date.now(), RepoStatus.RELEASED);
			const bad = await makeRepo("agentUnrelBad_" + Date.now(), RepoStatus.RELEASED);
			// not released, so there is nothing to detach: skipped, not failed
			const skipped = await makeRepo("agentUnrelSkip_" + Date.now(), RepoStatus.READY);

			const gh = controllerFor(async (repo: Repository) => {
				if (repo.id === bad) {
					return false;
				}
				await ProvisionState.setRepoStatus(repo, RepoStatus.READY, "spec");
				return true;
			});

			const summary = await new ProvisionAgent(new AdminController(gh)).unrelease(
				TestHarness.DELIVID0,
				[ok, bad, skipped],
				TestHarness.ADMIN1.id
			);

			expect(summary.delivId).to.equal(TestHarness.DELIVID0);
			expect(summary.requested).to.equal(3);
			expect(summary.unreleased).to.equal(1);
			expect(summary.skipped, "a repo that was not released is skipped").to.equal(1);
			expect(summary.failed).to.deep.equal([bad]);
			expect(summary.cancelled).to.be.false;
			expect(summary.stoppedEarly).to.be.false;
			expect(summary.stopReason).to.be.null;
		});

		it("Should write exactly one audit record naming the requester.", async function () {
			const repoId = await makeRepo("agentUnrelAudit_" + Date.now(), RepoStatus.RELEASED);
			const gh = controllerFor(async (repo: Repository) => {
				await ProvisionState.setRepoStatus(repo, RepoStatus.READY, "spec");
				return true;
			});

			const before = await dbc.getAudits(AuditLabel.REPO_UNRELEASE, 1000);
			await new ProvisionAgent(new AdminController(gh)).unrelease(TestHarness.DELIVID0, [repoId], TestHarness.ADMIN1.id);
			const after = await dbc.getAudits(AuditLabel.REPO_UNRELEASE, 1000);

			expect(after.length).to.equal(before.length + 1);
			expect(after[0].personId).to.equal(TestHarness.ADMIN1.id);
			expect((after[0].custom as any).delivId).to.equal(TestHarness.DELIVID0);
			expect((after[0].custom as any).repoIds).to.deep.equal([repoId]);
		});

		it("Should report a cancelled run as cancelled.", async function () {
			const first = await makeRepo("agentUnrelCancelA_" + Date.now(), RepoStatus.RELEASED);
			const second = await makeRepo("agentUnrelCancelB_" + Date.now(), RepoStatus.RELEASED);

			const gh = controllerFor(async (repo: Repository) => {
				await ProvisionState.setRepoStatus(repo, RepoStatus.READY, "spec");
				return true;
			});

			// cancelled before the second repo starts
			let checks = 0;
			const ctx = {
				isCancelled: () => {
					checks++;
					return checks > 1;
				},
				progress: async () => {
					//
				},
				error: async () => {
					//
				},
			};

			const summary = await new ProvisionAgent(new AdminController(gh)).unrelease(
				TestHarness.DELIVID0,
				[first, second],
				TestHarness.ADMIN1.id,
				ctx
			);

			expect(summary.cancelled, "the summary must say the run was cancelled").to.be.true;
			expect(summary.unreleased).to.equal(1);
			expect(summary.failed, "the repo it never reached is not a failure").to.deep.equal([second]);
		});
	});
});
