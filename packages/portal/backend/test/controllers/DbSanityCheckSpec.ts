import { expect } from "chai";
import "mocha";

import { AdminController } from "@backend/controllers/AdminController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { IGitHubActions } from "@backend/controllers/GitHubActions";
import { GitTeamTuple, IGitHubController } from "@backend/controllers/GitHubController";
import { RepoStatus, Repository, Team, TeamStatus } from "@backend/Types";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec"; // load first

/**
 * AdminController::dbSanityCheck, which reconciles the database against GitHub.
 *
 * This spec exists because the method stopped forcing the live client. It used to open with
 * `GitHubActions.getInstance(true)` before looking at its own dryRun flag, so there was no way to
 * exercise the most destructive operation Classy has: running it locally talked to the real org,
 * and running it with dryRun=false modified that org's records. It now uses the client its
 * controller was constructed with, which a test can supply.
 *
 * The property worth protecting is the dryRun contract. An admin is expected to run this with
 * dryRun=true first and read the warnings; if that pass writes anything, the safe rehearsal is not
 * safe, and the damage is to every repository and team record in the course at once.
 */
describe("AdminController::dbSanityCheck", function () {
	const dbc = DatabaseController.getInstance();

	/**
	 * Answers exactly what dbSanityCheck asks, as if the org were empty: no repo exists, no team
	 * has a number, nothing is attached. That is the state that makes the method want to rewrite
	 * every record, which is what these tests are checking it does (and does not) do.
	 */
	const emptyOrg = {
		repoExists: async (): Promise<boolean> => false,
		listWebhooks: async (): Promise<Array<{}>> => [],
		getTeam: async (): Promise<GitTeamTuple | null> => null,
		getTeamNumber: async (): Promise<number> => -1,
		getTeamsOnRepo: async (): Promise<GitTeamTuple[]> => [],
	} as unknown as IGitHubActions;

	function controllerFor(gha: IGitHubActions): AdminController {
		return new AdminController({ getActions: () => gha } as unknown as IGitHubController);
	}

	// a record that disagrees with GitHub in every way the first pass looks at
	async function makeStaleRepo(id: string): Promise<Repository> {
		const repo: Repository = {
			id: id,
			delivId: TestHarness.DELIVID0,
			teamIds: [],
			URL: "https://github.example/org/" + id,
			cloneURL: "https://github.example/org/" + id + ".git",
			gitHubStatus: RepoStatus.RELEASED,
			custom: {},
		};
		await dbc.writeRepository(repo);
		return repo;
	}

	async function makeStaleTeam(id: string): Promise<Team> {
		const team: Team = {
			id: id,
			delivId: TestHarness.DELIVID0,
			personIds: [],
			URL: "https://github.example/orgs/org/teams/" + id,
			githubId: 4242,
			gitHubStatus: TeamStatus.ATTACHED,
			custom: {},
		};
		await dbc.writeTeam(team);
		return team;
	}

	before(async function () {
		await TestHarness.suiteBefore("AdminController::dbSanityCheck");
		await TestHarness.prepareDeliverables();
	});

	after(function () {
		TestHarness.suiteAfter("AdminController::dbSanityCheck");
	});

	it("Should not write anything when dryRun is true.", async function () {
		const repo = await makeStaleRepo("sanityDryRunRepo");
		const team = await makeStaleTeam("sanityDryRunTeam");

		await controllerFor(emptyOrg).dbSanityCheck(true);

		const storedRepo = await dbc.getRepository(repo.id);
		expect(storedRepo.gitHubStatus, "dryRun must not repair the status").to.equal(RepoStatus.RELEASED);
		expect(storedRepo.URL, "dryRun must not null the URL").to.equal(repo.URL);
		expect(storedRepo.cloneURL, "dryRun must not null the cloneURL").to.equal(repo.cloneURL);

		const storedTeam = await dbc.getTeam(team.id);
		expect(storedTeam.gitHubStatus, "dryRun must not repair the team status").to.equal(TeamStatus.ATTACHED);
		expect(storedTeam.githubId, "dryRun must not null the githubId").to.equal(4242);
	});

	it("Should repair a repo that is absent on GitHub when dryRun is false.", async function () {
		const repo = await makeStaleRepo("sanityRepairRepo");

		await controllerFor(emptyOrg).dbSanityCheck(false);

		const stored = await dbc.getRepository(repo.id);
		expect(stored.gitHubStatus).to.equal(RepoStatus.NOT_CREATED);

		// URL and cloneURL are written together by createRepo, so they go stale together
		expect(stored.URL).to.equal(null);
		expect(stored.cloneURL).to.equal(null);
	});

	it("Should repair a team that is absent on GitHub when dryRun is false.", async function () {
		const team = await makeStaleTeam("sanityRepairTeam");

		await controllerFor(emptyOrg).dbSanityCheck(false);

		const stored = await dbc.getTeam(team.id);
		expect(stored.gitHubStatus).to.equal(TeamStatus.NOT_CREATED);
		expect(stored.githubId, "a team that does not exist must not keep a number").to.equal(null);
	});

	it("Should demote a repo that is RELEASED with no team attached on GitHub.", async function () {
		// the second pass: the repo exists, but nothing is attached to it, so RELEASED is a lie.
		// READY rather than NOT_CREATED, because the repo itself is fine.
		const repo = await makeStaleRepo("sanityDemoteRepo");
		const populatedOrg = {
			repoExists: async (): Promise<boolean> => true,
			listWebhooks: async (): Promise<Array<{}>> => [{ id: 1 }],
			getTeam: async (): Promise<GitTeamTuple | null> => null,
			getTeamNumber: async (): Promise<number> => -1,
			getTeamsOnRepo: async (): Promise<GitTeamTuple[]> => [],
		} as unknown as IGitHubActions;

		await controllerFor(populatedOrg).dbSanityCheck(false);

		const stored = await dbc.getRepository(repo.id);
		expect(stored.gitHubStatus).to.equal(RepoStatus.READY);
	});

	describe("a team attached on GitHub", function () {
		// the other half of the second pass: GitHub says a student team is on the repo, so the repo is
		// RELEASED and the team ATTACHED whatever the records claimed. This is the state a course is in
		// after releasing by hand, or after the release job was interrupted between GitHub and the
		// database.
		async function makeAttachedPair(suffix: string): Promise<{ repo: Repository; team: Team }> {
			const team: Team = {
				id: "sanityAttachedTeam" + suffix,
				delivId: TestHarness.DELIVID0,
				personIds: [],
				URL: "https://github.example/orgs/org/teams/sanityAttachedTeam" + suffix,
				githubId: 7000,
				gitHubStatus: TeamStatus.CREATED, // GitHub disagrees: it is attached
				custom: {},
			};
			await dbc.writeTeam(team);
			const repo: Repository = {
				id: "sanityAttachedRepo" + suffix,
				delivId: TestHarness.DELIVID0,
				teamIds: [team.id],
				URL: "https://github.example/org/sanityAttachedRepo" + suffix,
				cloneURL: null,
				gitHubStatus: RepoStatus.READY, // GitHub disagrees: a team is on it, so it is released
				custom: {},
			};
			await dbc.writeRepository(repo);
			return { repo, team };
		}

		function orgWith(repo: Repository, team: Team): IGitHubActions {
			const tuple: GitTeamTuple = { teamName: team.id, githubTeamNumber: team.githubId };
			return {
				repoExists: async (): Promise<boolean> => true,
				listWebhooks: async (): Promise<Array<{}>> => [{ id: 1 }],
				getTeam: async (): Promise<GitTeamTuple | null> => tuple,
				getTeamNumber: async (): Promise<number> => team.githubId,
				getTeamsOnRepo: async (repoId: string): Promise<GitTeamTuple[]> => (repoId === repo.id ? [tuple] : []),
			} as unknown as IGitHubActions;
		}

		it("Should mark the repo RELEASED and the team ATTACHED when dryRun is false.", async function () {
			const { repo, team } = await makeAttachedPair("A");

			await controllerFor(orgWith(repo, team)).dbSanityCheck(false);

			expect((await dbc.getRepository(repo.id)).gitHubStatus).to.equal(RepoStatus.RELEASED);
			const storedTeam = await dbc.getTeam(team.id);
			expect(storedTeam.gitHubStatus).to.equal(TeamStatus.ATTACHED);
			expect(storedTeam.githubId, "the cached team number was right and is kept").to.equal(7000);
		});

		it("Should only report the repair when dryRun is true.", async function () {
			const { repo, team } = await makeAttachedPair("B");

			await controllerFor(orgWith(repo, team)).dbSanityCheck(true);

			expect((await dbc.getRepository(repo.id)).gitHubStatus).to.equal(RepoStatus.READY);
			expect((await dbc.getTeam(team.id)).gitHubStatus).to.equal(TeamStatus.CREATED);
		});

		it("Should not detach a team that GitHub has on a repo while demoting ones it does not.", async function () {
			// both teams say ATTACHED; only one really is. The third pass demotes the other, and must
			// use what the second pass learned rather than demoting everything.
			const { repo, team } = await makeAttachedPair("C");
			const stray = await makeStaleTeam("sanityStrayTeamC"); // ATTACHED, but on no repo

			await controllerFor(orgWith(repo, team)).dbSanityCheck(false);

			expect((await dbc.getTeam(team.id)).gitHubStatus).to.equal(TeamStatus.ATTACHED);
			expect((await dbc.getTeam(stray.id)).gitHubStatus, "attached to nothing on GitHub").to.not.equal(TeamStatus.ATTACHED);
		});
	});
});
