import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { GitHubController, GitTeamTuple } from "@backend/controllers/GitHubController";
import { RepoStatus, Repository, Team, TeamStatus } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec"; // load first
import { TestGitHubActions } from "./TestGitHubActions";

/**
 * What provisioning leaves behind when it does not finish.
 *
 * NOTE: no network. These drive GitHubController with TestGitHubActions subclasses, because the
 * cases worth pinning are the ones that are hard to produce against real GitHub: a repo that is
 * created and then fails during finalization, and a finalization that runs a second time.
 *
 * The failure mode this protects against is subtle: a repo can exist on GitHub while Classy has not
 * finished setting it up (no webhook, no staff teams). That is RepoStatus.CREATED, and it is the
 * state the previous three-value vocabulary had no name for -- which is what used to make such repos
 * invisible to a retry.
 */
describe("GitHubController provisioning paths", function () {
	const dbc = DatabaseController.getInstance();

	const REPO_FINALIZE_FAILS = "ghcProvisionSpecFinalizeFails";
	const REPO_RESUMED = "ghcProvisionSpecResumed";
	const TEAM_ID = "ghcProvisionSpecTeam";
	const IMPORT_URL = "https://example.com/seed.git";

	/**
	 * Mirrors the one database write the real createRepo makes that the test double does not: the
	 * URL is what later marks the repo as "created by us".
	 */
	class RecordingActions extends TestGitHubActions {
		public addWebhookCalls = 0;
		public deleteRepoCalls = 0;

		public async createRepo(repoName: string): Promise<string> {
			const url = await super.createRepo(repoName);
			const repo = await DatabaseController.getInstance().getRepository(repoName);
			repo.URL = url;
			repo.cloneURL = url + ".git";
			await DatabaseController.getInstance().writeRepository(repo);
			return url;
		}

		public async addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
			this.addWebhookCalls++;
			return await super.addWebhook(repoName, webhookEndpoint);
		}

		public async deleteRepo(repoName: string): Promise<boolean> {
			this.deleteRepoCalls++;
			return await super.deleteRepo(repoName);
		}
	}

	/**
	 * The branch operations the template import needs. TestGitHubActions throws for these, because
	 * nothing exercised them before.
	 */
	class TemplateActions extends RecordingActions {
		public deleteBranchesCalls: string[][] = [];
		public renames: string[] = [];
		public branches: string[] = ["main"];

		public async listRepoBranches(_repoId: string): Promise<string[]> {
			return this.branches;
		}

		public async deleteBranches(_repoId: string, branchesToKeep: string[]): Promise<boolean> {
			this.deleteBranchesCalls.push(branchesToKeep);
			this.branches = branchesToKeep;
			return true;
		}

		public async renameBranch(_repoId: string, oldName: string, newName: string): Promise<boolean> {
			this.renames.push(oldName + "->" + newName);
			this.branches = [newName];
			return true;
		}
	}

	/**
	 * A team that cannot be created on GitHub makes finalization fail, which is the only part of
	 * provisioning that happens after the repo exists.
	 */
	class TeamCreationFailsActions extends RecordingActions {
		public async createTeam(teamName: string, _permission: string): Promise<GitTeamTuple> {
			Log.test("TeamCreationFailsActions::createTeam( " + teamName + " ) - failing on purpose");
			return { teamName: teamName, githubTeamNumber: -1 };
		}
	}

	/**
	 * Adding the team to the repo is the one step release depends on.
	 */
	class TeamAttachFailsActions extends RecordingActions {
		public async addTeamToRepo(teamName: string, _repoName: string, _permission: string): Promise<GitTeamTuple> {
			return { teamName: teamName, githubTeamNumber: -1 };
		}
	}

	/**
	 * A repo GitHub will not accept a webhook for.
	 */
	class WebhookFailsActions extends RecordingActions {
		public async addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
			await super.addWebhook(repoName, webhookEndpoint); // still counted
			return false;
		}
	}

	before(async function () {
		await TestHarness.suiteBefore("GitHubController provisioning paths");
		await TestHarness.prepareDeliverables();

		const person = TestHarness.createPerson(TestHarness.USER1.id, TestHarness.USER1.csId, TestHarness.USER1.github, null);
		await dbc.writePerson(person);

		const team: Team = await TestHarness.createTeam(TEAM_ID, TestHarness.DELIVID0, [TestHarness.USER1.id]);
		await dbc.writeTeam(team);
	});

	after(function () {
		TestHarness.suiteAfter("GitHubController provisioning paths");
	});

	async function makeRepo(repoId: string): Promise<Repository> {
		const repo: Repository = {
			id: repoId,
			delivId: TestHarness.DELIVID0,
			teamIds: [TEAM_ID],
			URL: null,
			cloneURL: null,
			gitHubStatus: RepoStatus.NOT_CREATED,
			custom: {},
		};
		await dbc.writeRepository(repo);
		return repo;
	}

	it("Should leave a repo that fails finalization resumable, and keep it on GitHub.", async function () {
		await makeRepo(REPO_FINALIZE_FAILS);
		const team = await dbc.getTeam(TEAM_ID);

		const gha = new TeamCreationFailsActions();
		const ghc = new GitHubController(gha);

		let message: string = null;
		try {
			await ghc.provisionRepository(REPO_FINALIZE_FAILS, [team], IMPORT_URL);
		} catch (err) {
			message = err.message;
		}
		Log.test("message: " + message);
		expect(message, "finalization failure must be reported").to.contain("finalization failed");

		// the repo may already hold imported content, so it must NOT be deleted
		expect(gha.deleteRepoCalls, "a created repo must not be deleted").to.equal(0);
		expect(await gha.repoExists(REPO_FINALIZE_FAILS), "the repo must still exist on GitHub").to.be.true;

		// and the record must say "created by us, not finished": a URL, but still provisionable
		const after = await dbc.getRepository(REPO_FINALIZE_FAILS);
		expect(after.gitHubStatus, "must stay retryable").to.equal(RepoStatus.CREATED);
		expect(after.URL, "informational, but it should still be recorded").to.not.be.null;
	});

	it("Should prune a template import to the requested branch and rename it to main.", async function () {
		// NOTE: this is how CPSC 310 provisions: importURL is "owner/template#branch". The parsing
		// of that string had a bug that silently disabled pruning, and the rename that follows it was
		// never exercised at all.
		const repoId = "ghcProvisionSpecTemplateBranch";
		await makeRepo(repoId);
		const team = await dbc.getTeam(TEAM_ID);

		const gha = new TemplateActions();
		gha.branches = ["starter", "solution"]; // what the template repo carries
		const ghc = new GitHubController(gha);

		const provisioned = await ghc.provisionRepository(repoId, [team], "someOwner/someTemplate#starter");
		expect(provisioned).to.be.true;

		expect(gha.deleteBranchesCalls, "the requested branch must be the only one kept").to.deep.equal([["starter"]]);
		expect(gha.renames, "a single remaining branch must end up called main").to.deep.equal(["starter->main"]);

		const after = await dbc.getRepository(repoId);
		expect(after.gitHubStatus).to.equal(RepoStatus.READY);
	});

	it("Should keep every branch when the template import names none.", async function () {
		const repoId = "ghcProvisionSpecTemplateAll";
		await makeRepo(repoId);
		const team = await dbc.getTeam(TEAM_ID);

		const gha = new TemplateActions();
		gha.branches = ["main", "extra"];
		const ghc = new GitHubController(gha);

		expect(await ghc.provisionRepository(repoId, [team], "someOwner/someTemplate")).to.be.true;

		expect(gha.deleteBranchesCalls, "nothing should be pruned").to.have.lengthOf(0);
		expect(gha.renames, "more than one branch remains, so nothing is renamed").to.have.lengthOf(0);
	});

	it("Should create nothing when the template importURL is malformed.", async function () {
		// an importURL that is neither a git URL nor owner/template is a deliverable configuration
		// mistake; it must not leave a half-made repo behind
		for (const importUrl of ["notatemplate", "someOwner/someTemplate.git"]) {
			const repoId = "ghcProvisionSpecBadImport" + importUrl.length;
			await makeRepo(repoId);
			const team = await dbc.getTeam(TEAM_ID);

			const gha = new TemplateActions();
			const ghc = new GitHubController(gha);

			let message: string = null;
			try {
				await ghc.provisionRepository(repoId, [team], importUrl);
			} catch (err) {
				message = err.message;
			}
			Log.test(importUrl + " -> " + message);
			expect(message, "a malformed importURL must fail the provision").to.not.be.null;

			const after = await dbc.getRepository(repoId);
			expect(after.gitHubStatus, "and must leave the repo provisionable").to.equal(RepoStatus.NOT_CREATED);
			expect(after.URL).to.be.null;
		}
	});

	it("Should report a failed release rather than marking the repo released.", async function () {
		// NOTE: this used to return true and mark the repo PROVISIONED_LINKED even though the team
		// was never attached, so the admin UI showed the students had access when they did not, and
		// performRelease counted it as a success.
		const repoId = "ghcProvisionSpecReleaseFails";
		await makeRepo(repoId);
		const repo = await dbc.getRepository(repoId);
		repo.gitHubStatus = RepoStatus.READY; // provisioned, awaiting release
		await dbc.writeRepository(repo);

		const team = await dbc.getTeam(TEAM_ID);
		team.gitHubStatus = TeamStatus.CREATED;
		await dbc.writeTeam(team);

		const ghc = new GitHubController(new TeamAttachFailsActions());
		const released = await ghc.releaseRepository(repo, [team], false);
		expect(released, "a release that could not attach its team is not a release").to.be.false;

		const afterTeam = await dbc.getTeam(TEAM_ID);
		expect(afterTeam.gitHubStatus, "the team must not claim to be linked").to.equal(TeamStatus.CREATED);

		// and the repo stays releasable, so pressing Release again retries it
		const afterRepo = await dbc.getRepository(repoId);
		expect(afterRepo.gitHubStatus).to.equal(RepoStatus.READY);
	});

	it("Should refuse to configure a repo GitHub does not have.", async function () {
		const missing: Repository = {
			id: "ghcProvisionSpecMissingRepo",
			delivId: TestHarness.DELIVID0,
			teamIds: [],
			URL: null,
			cloneURL: null,
			gitHubStatus: RepoStatus.NOT_CREATED,
			custom: {},
		};
		const ghc = new GitHubController(new RecordingActions());

		let message: string = null;
		try {
			await ghc.updateBranchProtection(missing, []);
		} catch (err) {
			message = err.message;
		}
		expect(message).to.contain(missing.id);

		message = null;
		try {
			await ghc.createIssues(missing, []);
		} catch (err) {
			message = err.message;
		}
		expect(message).to.contain(missing.id);
	});

	describe("webhooks", function () {
		const config = Config.getInstance();
		let realHost: string;

		beforeEach(function () {
			realHost = config.getProp(ConfigKey.publichostname);
		});

		afterEach(function () {
			config.setProp(ConfigKey.publichostname, realHost);
		});

		it("Should recognize which deployments GitHub can reach.", function () {
			// GitHub refuses a hook it cannot reach, so this decides whether a missing webhook is a
			// failure or simply impossible here
			expect(GitHubController.webhooksSupported("https://classy.cs.ubc.ca/portal/githubWebhook")).to.be.true;
			expect(GitHubController.webhooksSupported("https://localhost/portal/githubWebhook")).to.be.false;
			expect(GitHubController.webhooksSupported("https://localhost:3000/portal/githubWebhook")).to.be.false;
			expect(GitHubController.webhooksSupported("http://127.0.0.1:3000/portal/githubWebhook")).to.be.false;
			expect(GitHubController.webhooksSupported("https://192.168.1.10/portal/githubWebhook")).to.be.false;
			expect(GitHubController.webhooksSupported("https://10.0.0.4/portal/githubWebhook")).to.be.false;
			expect(GitHubController.webhooksSupported("")).to.be.false;
		});

		it("Should not call a repo READY when its webhook could not be added.", async function () {
			// NOTE: a repo without its webhook is not finished, whatever else worked: AutoTest never
			// hears about pushes to it, silently, for the whole term. This used to be a warning, so
			// such a repo was marked provisioned and nothing ever revisited it.
			config.setProp(ConfigKey.publichostname, "https://classy.example.com"); // a host GitHub could reach

			const repoId = "ghcProvisionSpecNoWebhook";
			await makeRepo(repoId);
			const team = await dbc.getTeam(TEAM_ID);

			const gha = new WebhookFailsActions();
			const ghc = new GitHubController(gha);

			let message: string = null;
			try {
				await ghc.provisionRepository(repoId, [team], IMPORT_URL);
			} catch (err) {
				message = err.message;
			}
			Log.test("message: " + message);
			expect(message, "a repo with no webhook is not provisioned").to.contain("finalization failed");

			// it stays CREATED: the repo is on GitHub and must not be deleted, but provisioning it
			// again retries the webhook
			const after = await dbc.getRepository(repoId);
			expect(after.gitHubStatus).to.equal(RepoStatus.CREATED);
			expect(gha.deleteRepoCalls, "the repo must be kept").to.equal(0);
		});

		it("Should resume such a repo without adding a second webhook.", async function () {
			config.setProp(ConfigKey.publichostname, "https://classy.example.com"); // a host GitHub could reach
			await makeRepo(REPO_RESUMED);
			const team = await dbc.getTeam(TEAM_ID);

			const gha = new RecordingActions();
			const ghc = new GitHubController(gha);

			// first pass: a normal provision, which adds the webhook
			const first = await ghc.provisionRepository(REPO_RESUMED, [team], IMPORT_URL);
			expect(first, "setup: the first provision must succeed").to.be.true;
			expect(gha.addWebhookCalls).to.equal(1);

			// put the record back into the state a finalization failure leaves behind
			const halfDone = await dbc.getRepository(REPO_RESUMED);
			halfDone.gitHubStatus = RepoStatus.CREATED;
			await dbc.writeRepository(halfDone);
			const teamAgain = await dbc.getTeam(TEAM_ID);
			teamAgain.gitHubStatus = TeamStatus.NOT_CREATED;
			await dbc.writeTeam(teamAgain);

			// second pass: the repo already exists, so this resumes at finalization
			const second = await ghc.provisionRepository(REPO_RESUMED, [teamAgain], IMPORT_URL);
			expect(second, "resuming must finish the repo").to.be.true;

			// re-running finalization must not add a duplicate hook: every push would fire AutoTest twice
			expect(gha.addWebhookCalls, "the webhook must not be added again").to.equal(1);
			expect(gha.deleteRepoCalls, "resuming must not delete the repo").to.equal(0);

			const after = await dbc.getRepository(REPO_RESUMED);
			expect(after.gitHubStatus).to.equal(RepoStatus.READY);
		});

		it("Should still provision where GitHub cannot deliver webhooks at all.", async function () {
			// dev and CI deployments are not reachable from GitHub, which rejects the hook with a 422
			// every time. Provisioning must not be held to a requirement the environment makes
			// impossible -- it would just fail every repo, forever.
			config.setProp(ConfigKey.publichostname, "https://localhost:3000");

			const repoId = "ghcProvisionSpecLocalhostWebhook";
			await makeRepo(repoId);
			const team = await dbc.getTeam(TEAM_ID);

			const gha = new WebhookFailsActions();
			const ghc = new GitHubController(gha);

			expect(await ghc.provisionRepository(repoId, [team], IMPORT_URL), "provisioning must still work").to.be.true;
			expect(gha.addWebhookCalls, "and must not waste a call GitHub will reject").to.equal(0);

			const after = await dbc.getRepository(repoId);
			expect(after.gitHubStatus).to.equal(RepoStatus.READY);
		});
	});
});
