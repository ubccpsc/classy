import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { GitHubController, GitTeamTuple } from "@backend/controllers/GitHubController";
import { GitHubStatus, Repository, Team } from "@backend/Types";
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
 * The failure mode this protects against is subtle. GitHubActions::createRepo writes the repo's URL
 * as soon as GitHub answers, so a repo can exist on GitHub while Classy has not finished setting it
 * up (no webhook, no staff teams). Calling that state "provisioned" is what used to make such repos
 * invisible to a retry: performProvision only provisions repos that are NOT_PROVISIONED.
 */
describe("GitHubController provisioning failures", function () {
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
	 * A team that cannot be created on GitHub makes finalization fail, which is the only part of
	 * provisioning that happens after the repo exists.
	 */
	class TeamCreationFailsActions extends RecordingActions {
		public async createTeam(teamName: string, _permission: string): Promise<GitTeamTuple> {
			Log.test("TeamCreationFailsActions::createTeam( " + teamName + " ) - failing on purpose");
			return { teamName: teamName, githubTeamNumber: -1 };
		}
	}

	before(async function () {
		await TestHarness.suiteBefore("GitHubController provisioning failures");
		await TestHarness.prepareDeliverables();

		const person = TestHarness.createPerson(TestHarness.USER1.id, TestHarness.USER1.csId, TestHarness.USER1.github, null);
		await dbc.writePerson(person);

		const team: Team = await TestHarness.createTeam(TEAM_ID, TestHarness.DELIVID0, [TestHarness.USER1.id]);
		await dbc.writeTeam(team);
	});

	after(function () {
		TestHarness.suiteAfter("GitHubController provisioning failures");
	});

	async function makeRepo(repoId: string): Promise<Repository> {
		const repo: Repository = {
			id: repoId,
			delivId: TestHarness.DELIVID0,
			teamIds: [TEAM_ID],
			URL: null,
			cloneURL: null,
			gitHubStatus: GitHubStatus.NOT_PROVISIONED,
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
		expect(after.gitHubStatus, "must stay retryable").to.equal(GitHubStatus.NOT_PROVISIONED);
		expect(after.URL, "the URL is what marks it as ours").to.not.be.null;
	});

	it("Should resume such a repo without adding a second webhook.", async function () {
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
		halfDone.gitHubStatus = GitHubStatus.NOT_PROVISIONED;
		await dbc.writeRepository(halfDone);
		const teamAgain = await dbc.getTeam(TEAM_ID);
		teamAgain.gitHubStatus = GitHubStatus.NOT_PROVISIONED;
		await dbc.writeTeam(teamAgain);

		// second pass: the repo already exists, so this resumes at finalization
		const second = await ghc.provisionRepository(REPO_RESUMED, [teamAgain], IMPORT_URL);
		expect(second, "resuming must finish the repo").to.be.true;

		// re-running finalization must not add a duplicate hook: every push would fire AutoTest twice
		expect(gha.addWebhookCalls, "the webhook must not be added again").to.equal(1);
		expect(gha.deleteRepoCalls, "resuming must not delete the repo").to.equal(0);

		const after = await dbc.getRepository(REPO_RESUMED);
		expect(after.gitHubStatus).to.equal(GitHubStatus.PROVISIONED_UNLINKED);
	});
});
