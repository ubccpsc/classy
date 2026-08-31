import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { ProvisionState } from "@backend/controllers/ProvisionState";
import { RepoStatus, Repository, Team, TeamStatus } from "@backend/Types";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec"; // load first

/**
 * The provisioning lifecycle, in one place.
 *
 * NOTE: no GitHub and no controllers -- these are the transition rules themselves. They matter
 * because the status is the only thing anything branches on now: performProvision picks up
 * NOT_CREATED and CREATED repos, release only touches READY ones, and the admin UI builds its lists
 * from the same values. A wrong transition is therefore not cosmetic.
 */
describe("ProvisionState", function () {
	const dbc = DatabaseController.getInstance();

	before(async function () {
		await TestHarness.suiteBefore("ProvisionState");
		await TestHarness.prepareDeliverables();
	});

	after(function () {
		TestHarness.suiteAfter("ProvisionState");
	});

	async function makeRepo(status: RepoStatus): Promise<Repository> {
		const repo: Repository = {
			id: "provisionStateSpecRepo_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
			delivId: TestHarness.DELIVID0,
			teamIds: [],
			URL: null,
			cloneURL: null,
			gitHubStatus: status,
			custom: {},
		};
		await dbc.writeRepository(repo);
		return repo;
	}

	async function makeTeam(status: TeamStatus): Promise<Team> {
		const team: Team = {
			id: "provisionStateSpecTeam_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
			delivId: TestHarness.DELIVID0,
			personIds: [],
			URL: null,
			githubId: null,
			gitHubStatus: status,
			custom: {},
		};
		await dbc.writeTeam(team);
		return team;
	}

	describe("repositories", function () {
		const legal: Array<[RepoStatus, RepoStatus]> = [
			[RepoStatus.NOT_CREATED, RepoStatus.CREATED],
			[RepoStatus.CREATED, RepoStatus.READY],
			[RepoStatus.READY, RepoStatus.RELEASED],
			[RepoStatus.CREATED, RepoStatus.NOT_CREATED], // provisioning failed; the repo was deleted again
			[RepoStatus.READY, RepoStatus.NOT_CREATED], // the repo was deleted
			[RepoStatus.RELEASED, RepoStatus.NOT_CREATED],
		];

		for (const [from, to] of legal) {
			it("Should allow " + from + " -> " + to + ".", async function () {
				const repo = await makeRepo(from);
				expect(await ProvisionState.setRepoStatus(repo, to, "spec")).to.be.true;

				const after = await dbc.getRepository(repo.id);
				expect(after.gitHubStatus, "the change must be persisted, not just local").to.equal(to);
			});
		}

		const illegal: Array<[RepoStatus, RepoStatus]> = [
			[RepoStatus.NOT_CREATED, RepoStatus.READY], // skips creation
			[RepoStatus.NOT_CREATED, RepoStatus.RELEASED], // skips everything
			[RepoStatus.CREATED, RepoStatus.RELEASED], // never finalized, so it cannot be released
			[RepoStatus.RELEASED, RepoStatus.READY], // releasing is not undone by Classy
		];

		for (const [from, to] of illegal) {
			it("Should refuse " + from + " -> " + to + ".", async function () {
				const repo = await makeRepo(from);
				expect(await ProvisionState.setRepoStatus(repo, to, "spec")).to.be.false;

				// NOTE: refused, not thrown. A throw means "fatal, stop the job" to the provisioning
				// loops; a mislabelled record is not that. The record keeps its previous status, so
				// the operation fails on its own terms.
				const after = await dbc.getRepository(repo.id);
				expect(after.gitHubStatus, "a refused transition must not be written").to.equal(from);
			});
		}

		it("Should treat a repeated transition as a no-op.", async function () {
			const repo = await makeRepo(RepoStatus.READY);
			expect(await ProvisionState.setRepoStatus(repo, RepoStatus.READY, "spec")).to.be.true;
			expect((await dbc.getRepository(repo.id)).gitHubStatus).to.equal(RepoStatus.READY);
		});
	});

	describe("teams", function () {
		it("Should allow NOT_CREATED -> CREATED -> ATTACHED.", async function () {
			const team = await makeTeam(TeamStatus.NOT_CREATED);
			expect(await ProvisionState.setTeamStatus(team, TeamStatus.CREATED, "spec")).to.be.true;
			expect(await ProvisionState.setTeamStatus(team, TeamStatus.ATTACHED, "spec")).to.be.true;
			expect((await dbc.getTeam(team.id)).gitHubStatus).to.equal(TeamStatus.ATTACHED);
		});

		it("Should refuse NOT_CREATED -> ATTACHED.", async function () {
			const team = await makeTeam(TeamStatus.NOT_CREATED);
			expect(await ProvisionState.setTeamStatus(team, TeamStatus.ATTACHED, "spec")).to.be.false;
			expect((await dbc.getTeam(team.id)).gitHubStatus).to.equal(TeamStatus.NOT_CREATED);
		});
	});

	describe("repair", function () {
		it("Should set any status, because it is reconciling with GitHub.", async function () {
			// NOTE: dbSanityCheck derives the status from what GitHub actually has, so there is no
			// "from" worth validating -- the stored value may be wrong, or may not even be a value
			// this version of Classy recognises (a record written before the vocabulary changed).
			const repo = await makeRepo(RepoStatus.NOT_CREATED);
			await ProvisionState.repairRepoStatus(repo, RepoStatus.RELEASED, "spec");
			expect(repo.gitHubStatus).to.equal(RepoStatus.RELEASED);

			// and it does not write: dbSanityCheck writes once per record, honouring its dryRun flag
			const stored = await dbc.getRepository(repo.id);
			expect(stored.gitHubStatus, "repair must leave the write to its caller").to.equal(RepoStatus.NOT_CREATED);
		});

		it("Should normalize a record written by an older version of Classy.", async function () {
			// the upgrade path: no read shim, so an unrecognised legacy value simply gets replaced
			const repo = await makeRepo("PROVISIONED_UNLINKED" as any);
			Log.test("legacy status: " + repo.gitHubStatus);

			await ProvisionState.repairRepoStatus(repo, RepoStatus.READY, "spec");
			expect(repo.gitHubStatus).to.equal(RepoStatus.READY);
		});
	});
});
