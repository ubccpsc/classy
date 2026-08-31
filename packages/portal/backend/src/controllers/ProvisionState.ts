import Log from "@common/Log";

import { RepoStatus, Repository, Team, TeamStatus } from "../Types";
import { DatabaseController } from "./DatabaseController";

/**
 * The only place that moves a Repository or Team along its provisioning lifecycle.
 *
 * Before this existed the status was written from ten different places -- GitHubActions,
 * GitHubController, TeamController, AdminRoutes, and eight separate corrections inside
 * dbSanityCheck -- so nothing owned the question of which transitions were legal, and each fix in
 * this area was local to one call site. The tables below are the lifecycle; if a transition is not
 * in them it does not happen.
 *
 * An illegal transition is refused, not thrown. Throwing would collide with the provisioning
 * failure policy, where an exception means "this is fatal, stop the whole job"; a mislabelled record
 * is not that. Refusing leaves the record where it was, so the operation fails on its own terms (a
 * repo that never became READY simply is not released).
 */

/**
 * Repository lifecycle. NOT_CREATED -> CREATED -> READY -> RELEASED, plus the rollback that a failed
 * provision performs once it has deleted the repo from GitHub again.
 */
const REPO_TRANSITIONS: { [from: string]: RepoStatus[] } = {
	[RepoStatus.NOT_CREATED]: [RepoStatus.CREATED],
	[RepoStatus.CREATED]: [RepoStatus.READY, RepoStatus.NOT_CREATED],
	[RepoStatus.READY]: [RepoStatus.RELEASED, RepoStatus.NOT_CREATED],
	[RepoStatus.RELEASED]: [RepoStatus.NOT_CREATED],
};

/**
 * Team lifecycle. NOT_CREATED -> CREATED -> ATTACHED.
 */
const TEAM_TRANSITIONS: { [from: string]: TeamStatus[] } = {
	[TeamStatus.NOT_CREATED]: [TeamStatus.CREATED],
	[TeamStatus.CREATED]: [TeamStatus.ATTACHED, TeamStatus.NOT_CREATED],
	[TeamStatus.ATTACHED]: [TeamStatus.NOT_CREATED],
};

export class ProvisionState {
	/**
	 * Moves a repository to a new status and writes it.
	 *
	 * @param repo
	 * @param to
	 * @param why for the log; this is the only record of _why_ a repo changed status
	 * @returns {Promise<boolean>} false if the transition was refused (the record is untouched)
	 */
	public static async setRepoStatus(repo: Repository, to: RepoStatus, why: string): Promise<boolean> {
		const from = repo.gitHubStatus;

		if (from === to) {
			return true; // idempotent: finalizing an already-READY repo is not an error
		}

		const allowed = REPO_TRANSITIONS[from];
		if (typeof allowed === "undefined" || allowed.indexOf(to) < 0) {
			Log.error("ProvisionState::setRepoStatus( " + repo.id + " ) - REFUSED: " + from + " -> " + to + " (" + why + ")");
			return false;
		}

		Log.info("ProvisionState::setRepoStatus( " + repo.id + " ) - " + from + " -> " + to + " (" + why + ")");
		repo.gitHubStatus = to;
		await DatabaseController.getInstance().writeRepository(repo);
		return true;
	}

	public static async setTeamStatus(team: Team, to: TeamStatus, why: string): Promise<boolean> {
		const from = team.gitHubStatus;

		if (from === to) {
			return true;
		}

		const allowed = TEAM_TRANSITIONS[from];
		if (typeof allowed === "undefined" || allowed.indexOf(to) < 0) {
			Log.error("ProvisionState::setTeamStatus( " + team.id + " ) - REFUSED: " + from + " -> " + to + " (" + why + ")");
			return false;
		}

		Log.info("ProvisionState::setTeamStatus( " + team.id + " ) - " + from + " -> " + to + " (" + why + ")");
		team.gitHubStatus = to;
		await DatabaseController.getInstance().writeTeam(team);
		return true;
	}

	/**
	 * Sets a status without checking the transition, for reconciling a record against what GitHub
	 * actually has.
	 *
	 * NOTE: only AdminController::dbSanityCheck should use these. It is repairing rather than
	 * driving: the stored status may be wrong (or, after an upgrade, may not even be a value this
	 * version recognises), so there is no "from" worth validating.
	 */
	public static async repairRepoStatus(repo: Repository, to: RepoStatus, why: string): Promise<void> {
		if (repo.gitHubStatus === to) {
			return;
		}
		Log.warn("ProvisionState::repairRepoStatus( " + repo.id + " ) - " + repo.gitHubStatus + " -> " + to + " (" + why + ")");
		repo.gitHubStatus = to;
		// Not written here; dbSanityCheck writes once per record, and honours its dryRun flag.
	}

	public static async repairTeamStatus(team: Team, to: TeamStatus, why: string): Promise<void> {
		if (team.gitHubStatus === to) {
			return;
		}
		Log.warn("ProvisionState::repairTeamStatus( " + team.id + " ) - " + team.gitHubStatus + " -> " + to + " (" + why + ")");
		team.gitHubStatus = to;
	}
}
