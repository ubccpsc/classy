import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import Util from "@common/Util";

import { RepoStatus, Repository, Team, TeamStatus } from "../Types";
import { DatabaseController } from "./DatabaseController";
import { IGitHubActions } from "./GitHubActions";
import { ProvisionState } from "./ProvisionState";
import { TeamController } from "./TeamController";

export interface IGitHubController {
	/**
	 * This is a complex method that provisions an entire repository.
	 *
	 * Assumptions: a "staff" repo must also exist.
	 *
	 * This declaration used to take a fourth `shouldRelease` parameter that the implementation
	 * never had; nothing passed it, and releasing is a separate step (releaseRepository).
	 *
	 * @param {string} repoName
	 * @param {Team[]} teams
	 * @param {string} importUrl
	 * @returns {Promise<boolean>}
	 */
	provisionRepository(repoName: string, teams: Team[], importUrl: string): Promise<boolean>;

	updateBranchProtection(repo: Repository, rules: BranchRule[]): Promise<boolean>;

	getRepositoryUrl(repo: Repository): string;

	createIssues(repo: Repository, issues: Issue[]): Promise<boolean>;

	getTeamUrl(team: Team): Promise<string>;

	releaseRepository(repo: Repository, teams: Team[], asCollaborators?: boolean): Promise<boolean>;
}

export interface GitPersonTuple {
	githubId: string;
	githubPersonNumber: number;
	url: string;
}

export interface GitRepoTuple {
	repoName: string;
	githubRepoNumber: number;
	url: string;
}

export interface GitTeamTuple {
	teamName: string;
	githubTeamNumber: number;
}

export interface BranchRule {
	name: string;
	reviews: number;
}

export interface Issue {
	title: string;
	body: string;
	// assignees: string[];
}

export class GitHubController implements IGitHubController {
	private readonly dbc = DatabaseController.getInstance();
	// private readonly tc = new TeamController();

	private gha: IGitHubActions = null;

	public constructor(gha: IGitHubActions) {
		this.gha = gha;
	}

	public getRepositoryUrl(repo: Repository): string {
		Log.info("GitHubController::GetRepositoryUrl - start");
		const c = Config.getInstance();
		const ghHost = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/"; // valid .org use
		const url = ghHost + repo.id;
		Log.info("GitHubController::GetRepositoryUrl( " + repo.id + " ) - URL: " + url);
		return url;
	}

	public async getTeamUrl(team: Team): Promise<string> {
		const c = Config.getInstance();
		// GET /orgs/:org/teams/:team_slug
		const teamUrl = c.getProp(ConfigKey.githubHost) + "/orgs/" + c.getProp(ConfigKey.org) + "/teams/" + team.id;
		Log.info("GitHubController::getTeamUrl( " + team.id + " ) - URL: " + teamUrl);
		return teamUrl;
	}

	// is this even used anymore? provisionRepository seems to use GHA directly?
	/**
	 * Provisions the given repository on GitHub.
	 *
	 * Returns true if successful and throws an error if not.
	 *
	 * @param {string} repoName The name of the Repository
	 * @param {string} importUrl The repo it should be imported from (if null, no import should take place)
	 * @param {string} path The subset of the importUrl repo that should be added to the root of the new repo.
	 * If this is null, undefined, or "", the whole importUrl is imported.
	 * @returns {Promise<boolean>}
	 */
	private async provisionRepositoryFromFS(repoName: string, importUrl: string, path?: string): Promise<boolean> {
		Log.info("GitHubController::provisionRepositoryFromFS( " + repoName + ", ...) - start");

		const startTime = Date.now();

		try {
			// create the repository
			Log.trace("GitHubController::provisionRepositoryFromFS( " + repoName + " ) - create GitHub repo");
			const repoCreateVal = await this.gha.createRepo(repoName);
			Log.trace("GitHubController::provisionRepositoryFromFS( " + repoName + " ) - success; repo: " + repoCreateVal);
		} catch (err) {
			/* istanbul ignore next: braces needed for ignore */
			{
				Log.error("GitHubController::provisionRepositoryFromFS( " + repoName + " ) - create repo error: " + err);
				// repo creation failed; remove if needed (requires createRepo be permissive if already exists)
				const res = await this.gha.deleteRepo(repoName);
				Log.info("GitHubController::provisionRepositoryFromFS( " + repoName + " ) - repo removed: " + res);
				throw new Error(
					"GitHubController::provisionRepositoryFromFS(..) failed; Repository " + repoName + " creation failed; ERROR: " + err.message
				);
			}
		}

		try {
			// perform import
			const c = Config.getInstance();
			const targetUrl = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/" + repoName;

			Log.trace("GitHubController::provisionRepositoryFromFS( " + repoName + " ) - importing project (slow)");
			let output;
			/* istanbul ignore if */
			if (typeof path !== "undefined") {
				output = await this.gha.importRepoFS(importUrl, targetUrl, path);
			} else {
				output = await this.gha.importRepoFS(importUrl, targetUrl);
			}
			Log.trace("GitHubController::provisionRepositoryFromFS( " + repoName + " ) - import complete; output: " + output);

			Log.trace(
				"GithubController::provisionRepositoryFromFS( " + repoName + " ) - successfully completed; " + "took: " + Util.took(startTime)
			);

			return true;
		} catch (err) {
			const msg = "GithubController::provisionRepositoryFromFS( " + repoName + " ) - ERROR: " + err;
			Log.error(msg);
			throw new Error(msg);
		}
	}

	/**
	 * Finalizes the creation of the repo:
	 *
	 * Attaches admin/staff teams.
	 * Configures webhooks.
	 * Ensures student teams are provisioned, but they are not attached.
	 *
	 * @param repoName
	 * @param teams
	 * @private
	 */
	/**
	 * Finalizes a repo and, if that works, records it as provisioned.
	 *
	 * NOTE: marking the record is deliberately here and not in GitHubActions::createRepo. A repo
	 * that exists on GitHub but has not been finalized has no webhook and no staff teams; calling
	 * that "provisioned" is what made a half-provisioned repo look finished to the admin UI.
	 *
	 * @param repoName
	 * @param teams
	 * @param resuming whether an earlier attempt already created this repo on GitHub
	 * @returns {Promise<boolean>}
	 */
	/**
	 * Adds the AutoTest webhook, without adding a second one when finalization is being re-run.
	 *
	 * NOTE: the existence check is skipped for a repo that was just created, which has no hooks; it
	 * would otherwise cost an extra API call per repo on the provisioning path.
	 */
	private async addWebhookOnce(repoName: string, endpoint: string, checkExisting: boolean): Promise<boolean> {
		if (checkExisting === true) {
			const hooks = await this.gha.listWebhooks(repoName);
			if (hooks.length > 0) {
				Log.info("GitHubController::addWebhookOnce( " + repoName + " ) - webhook already present; not adding another");
				return true;
			}
		}
		return await this.gha.addWebhook(repoName, endpoint);
	}

	private async finalizeAndMark(repoName: string, teams: Team[], resuming: boolean): Promise<boolean> {
		const finalizeSuccessful = await this.finalizeProvisionRepository(repoName, teams, resuming);
		if (finalizeSuccessful === false) {
			Log.warn("GitHubController::finalizeAndMark( " + repoName + " ) - finalization NOT successful");
			return false;
		}

		Log.info("GitHubController::finalizeAndMark( " + repoName + " ) - finalization successful");
		const repo = await this.dbc.getRepository(repoName);
		repo.URL = this.getRepositoryUrl(repo); // informational; the status below is what gets checked
		await this.dbc.writeRepository(repo);
		return await ProvisionState.setRepoStatus(repo, RepoStatus.READY, "finalized");
	}

	/**
	 * Creates the repository on GitHub, from a template or by importing from a git URL.
	 *
	 * NOTE: this is only the GitHub side; the repo is not usable until finalization has attached the
	 * staff teams and the webhook (see finalizeProvisionRepository).
	 *
	 * @param repoName
	 * @param importUrl ownerName/templateName#branchName for a template, or a git URL
	 * @returns {Promise<boolean>} whether the repo now exists on GitHub with its content
	 */
	private async createOnGitHub(repoName: string, importUrl: string): Promise<boolean> {
		// The NOT_CREATED -> CREATED transition is performed here rather than in
		// GitHubActions::createRepo. That method records the URL, because it is the only code that
		// knows it, but a low-level API wrapper should not be deciding lifecycle: doing so is what
		// used to mark a repo provisioned before it had a webhook or any staff teams.
		let provisionSuccessful = false;
		const provisionWithTemplate = !(importUrl.startsWith("https://") || importUrl.startsWith("git@"));

		if (provisionWithTemplate) {
			Log.info("GitHubController::provisionRepository( " + repoName + " ) - provisioning from template; importURL: " + importUrl);

			if (importUrl.split("/").length !== 2) {
				const msg =
					"GitHubController::provisionRepository( " +
					repoName +
					" ) - importUrl must be ownerName/templateName#branchName for template import; was: " +
					importUrl;
				Log.error(msg);
				throw new Error(msg);
			}

			const templateOwner = importUrl.split("/")[0];
			let templateRepo = importUrl.split("/")[1];

			const branchesToKeep: string[] = [];
			if (templateRepo.indexOf("#") > 0) {
				// NOTE: split once and read both halves; reading the branch back off templateRepo
				// after reassigning it always yielded undefined, silently disabling branch pruning
				const templateParts = templateRepo.split("#");
				templateRepo = templateParts[0];
				const branchName = templateParts[1];
				if (typeof branchName === "string" && branchName.length > 0) {
					branchesToKeep.push(branchName);
				} else {
					Log.warn(
						"GitHubController::provisionRepository( " +
							repoName +
							" ) - importUrl has an empty branch after #; keeping all branches; was: " +
							importUrl
					);
				}
			}

			if (templateRepo.indexOf(".git") > 0) {
				// this is a git URL, not a org/repo pair
				const msg =
					"GitHubController::provisionRepository( " +
					repoName +
					" ) - importUrl must be ownerName/templateName#branchName for template import; was: " +
					importUrl;
				Log.error(msg);
				throw new Error(msg);
			}

			provisionSuccessful = await this.provisionRepositoryFromTemplate(repoName, templateOwner, templateRepo, branchesToKeep);
		} else {
			Log.info("GitHubController::provisionRepository( " + repoName + " ) - provisioning from FS; importURL: " + importUrl);

			// NOTE: path param not provided here (nor available); not used by 310 so this is ok for now
			provisionSuccessful = await this.provisionRepositoryFromFS(repoName, importUrl);
		}

		if (provisionSuccessful === true) {
			const repo = await this.dbc.getRepository(repoName);
			await ProvisionState.setRepoStatus(repo, RepoStatus.CREATED, "created on GitHub");
		}

		return provisionSuccessful;
	}

	private async finalizeProvisionRepository(repoName: string, teams: Team[], resuming: boolean = false): Promise<boolean> {
		const start = Date.now();
		Log.info("GitHubController::finalizeProvisionRepository( " + repoName + " ) - finalizing repo provisioning");

		const config = Config.getInstance();
		const host = config.getProp(ConfigKey.publichostname);
		const WEBHOOK_ADDRESS = host + "/portal/githubWebhook";

		try {
			// NOTE: these four calls do not depend on each other, so they are issued together
			Log.trace("GitHubController::finalizeProvisionRepository( " + repoName + " ) - add teams, webhook and settings");
			const [staffAdd, adminAdd, createHook, updateWorked] = await Promise.all([
				this.gha.addTeamToRepo(TeamController.STAFF_NAME, repoName, "admin"),
				this.gha.addTeamToRepo(TeamController.ADMIN_NAME, repoName, "admin"),
				this.addWebhookOnce(repoName, WEBHOOK_ADDRESS, resuming),
				this.gha.updateRepo(repoName),
			]);
			Log.trace("GitHubController::finalizeProvisionRepository(..) - staff team: " + staffAdd.teamName);
			Log.trace("GitHubController::finalizeProvisionRepository(..) - admin team: " + adminAdd.teamName);
			Log.trace("GitHubController::finalizeProvisionRepository(..) - webhook successful: " + createHook);
			Log.trace("GitHubController::finalizeProvisionRepository(..) - done repo settings: " + updateWorked);

			// NOTE: a repo without its webhook is not finished, whatever else worked: AutoTest never
			// hears about pushes to it, silently, for the whole term. This used to be a warning, which
			// was survivable when "provisioned" was vague, but RepoStatus.READY now means "webhook and
			// staff teams are attached" -- and dbSanityCheck uses the webhook as its test for exactly
			// that. Failing here leaves the repo CREATED, which is retryable.
			if (createHook === false) {
				Log.error("GitHubController::finalizeProvisionRepository( " + repoName + " ) - webhook NOT added; not finalized");
				return false;
			}

			// repo settings are cosmetic by comparison, so they stay a warning
			if (updateWorked === false) {
				Log.warn("GitHubController::finalizeProvisionRepository( " + repoName + " ) - repo settings NOT updated");
			}

			// ensure teams are provisioned; independent of each other, so run them together
			Log.trace("GitHubController::finalizeProvisionRepository( " + repoName + " ) - provisioning teams");
			const teamResults = await Promise.all(teams.map((team) => this.provisionTeam(team)));
			const allTeamsSuccessful = teamResults.every((success) => success === true);
			Log.trace("GitHubController::finalizeProvisionRepository( " + repoName + " ) - teams provisioned: " + allTeamsSuccessful);

			if (allTeamsSuccessful === false) {
				// NOTE: this used to return true regardless, so a repo whose teams all failed to
				// provision was still reported as fully provisioned
				Log.error("GithubController::finalizeProvisionRepository( " + repoName + " ) - one or more teams failed to provision");
			}

			Log.info(
				"GithubController::finalizeProvisionRepository( " +
					repoName +
					" ) - done; success: " +
					allTeamsSuccessful +
					"; took: " +
					Util.took(start)
			);

			return allTeamsSuccessful;
		} catch (err) {
			Log.error("GithubController::finalizeProvisionRepository( " + repoName + " ) - ERROR: " + err);
			return false;
		}
	}

	/**
	 * Provisions the given repository on GitHub. Returns the Repository object when it is done (or null if it failed).
	 *
	 * Repository.URL should be set once the repo is created successfully
	 * (this is how we can track that the repo exists on GitHub).
	 *
	 * @param {string} repoName The name of the repository being provisioned.
	 * @param {string} templateOwner The org/owner of the template repo.
	 * @param {string} templateRepo The name of the template repo.
	 * @param {string[]} branchesToKeep The subset of the branches from the imported repo that should exist in the created repo.
	 * If undefined or [], all branches are retained.
	 * @returns {Promise<boolean>}
	 */
	private async provisionRepositoryFromTemplate(
		repoName: string,
		templateOwner: string,
		templateRepo: string,
		branchesToKeep?: string[]
	): Promise<boolean> {
		const start = Date.now();

		if (typeof branchesToKeep === "undefined") {
			branchesToKeep = [];
		}

		Log.info(
			"GitHubController::provisionRepositoryFromTemplate( " + repoName + ", ...) - start; branchesToKeep: " + JSON.stringify(branchesToKeep)
		);

		// make sure repoName already exists in the database
		await this.checkDatabase(repoName, null);

		try {
			// create the repository from template
			Log.trace("GitHubController::provisionRepositoryFromTemplate( " + repoName + " ) - create GitHub repo");

			const repoCreateVal = await this.gha.createRepoFromTemplate(repoName, templateOwner, templateRepo);
			Log.trace("GitHubController::provisionRepositoryFromTemplate( " + repoName + " ) - success; " + "repo: " + repoCreateVal);

			// prune branches if required
			if (branchesToKeep.length > 0) {
				// prune branches
				const branchRemovalSuccess = await this.gha.deleteBranches(repoName, branchesToKeep);
				Log.info("GitHubController::provisionRepository( " + repoName + " ) - branch removal success: " + branchRemovalSuccess);
			} else {
				Log.info("GitHubController::provisionRepositoryFromTemplate( " + repoName + " ) - all branches included");
			}

			// if there is only one branch left, make sure it is called main
			const finalBranches = await this.gha.listRepoBranches(repoName);
			if (finalBranches.length === 1) {
				if (finalBranches[0] !== "main") {
					Log.info(
						"GitHubController::provisionRepositoryFromTemplate( " + repoName + " ) - renaming branch: " + finalBranches[0] + " -> main"
					);
					await this.gha.renameBranch(repoName, finalBranches[0], "main");
				}
			}

			Log.info("GitHubController::provisionRepositoryFromTemplate( " + repoName + " ) - done; took: " + Util.took(start));
			return true;
		} catch (err) {
			/* istanbul ignore next: braces needed for ignore */
			{
				Log.error("GitHubController::provisionRepositoryFromTemplate( " + repoName + " ) - create repo error: " + err);
				// repo creation failed; remove if needed (requires createRepo be permissive if already exists)
				const res = await this.gha.deleteRepo(repoName);
				Log.info("GitHubController::provisionRepositoryFromTemplate( " + repoName + " ) - repo removed: " + res);
				throw new Error("GitHubController::provisionRepositoryFromTemplate( " + repoName + " ) creation failed; ERROR: " + err.message);
			}
		}
	}

	/**
	 * Releases a repository to a team.
	 *
	 * @param {Repository} repo The repository to be released. This must be in the datastore.
	 * @param {Team[]} teams The teams to be added. These must be in the datastore.
	 * @param {boolean} asCollaborators Whether the team members should be added as a collaborator.
	 * or whether a GitHub team should be created for them.
	 * @returns {Promise<Repository | null>}
	 */
	public async releaseRepository(repo: Repository, teams: Team[], asCollaborators: boolean = false): Promise<boolean> {
		Log.info("GitHubController::releaseRepository( {" + repo.id + ", ...}, ...) - start");
		const start = Date.now();

		await this.checkDatabase(repo.id, null);

		// const gh = GitHubActions.getInstance(true);

		// NOTE: every team has to be attached for the release to count. Marking the repo released
		// when one of them failed would tell the admin UI the students have access when they do not,
		// and performRelease would count it as a success.
		let allAttached = true;

		for (const team of teams) {
			if (asCollaborators) {
				Log.info("GitHubController::releaseRepository(..) - releasing repository as " + "individual collaborators");
				Log.error("GitHubController::releaseRepository(..) - ERROR: Not implemented");
				throw new Error("GitHubController - w/ collaborators NOT IMPLEMENTED");
			} else {
				await this.checkDatabase(null, team.id);

				// const teamNum = await this.tc.getTeamNumber(team.id);
				// const res = await this.gha.addTeamToRepo(teamNum, repo.id, "push");
				const res = await this.gha.addTeamToRepo(team.id, repo.id, "push");
				// now, add the team to the repository
				// const res = await this.gha.addTeamToRepo(team.id, repo.id, "push");
				if (res.githubTeamNumber > 0) {
					await ProvisionState.setTeamStatus(team, TeamStatus.ATTACHED, "added to " + repo.id);
				} else {
					// the team keeps whatever status it had; releasing again retries it
					Log.error("GitHubController::releaseRepository(..) - ERROR adding team to repo: " + JSON.stringify(res));
					allAttached = false;
				}
				Log.info(
					"GitHubController::releaseRepository(..) - " +
						" added team (" +
						team.id +
						" ) with push permissions to repository (" +
						repo.id +
						")"
				);
			}
		}

		if (allAttached === false) {
			// the repo keeps whatever status it had: it is provisioned, but not released. Releasing
			// again retries, since planRelease looks for exactly that state.
			Log.error("GitHubController::releaseRepository( " + repo.id + " ) - not released; a team could not be attached");
			return false;
		}

		await ProvisionState.setRepoStatus(repo, RepoStatus.RELEASED, "student teams attached");

		Log.info("GitHubController::releaseRepository( " + repo.id + ", ... ) - done; took: " + Util.took(start));
		return true;
	}

	/**
	 * Provisions the repository and teams on GitHub. Teams are _not_ attached to the
	 * repository.
	 *
	 * Returns true if successful, false if already provisioned.
	 * Throws an Error if a provisioning is attempted but fails.
	 *
	 * @param repoName
	 * @param teams
	 * @param importUrl
	 */
	public async provisionRepository(repoName: string, teams: Team[], importUrl: string): Promise<boolean> {
		Log.info("GitHubController::provisionRepository( " + repoName + ", ...) - start");

		const start = Date.now();

		// ensure repo already exists in db
		// (outside try to allow throw)
		await this.checkDatabase(repoName, null);

		const isRepoProvisioned = await this.gha.repoExists(repoName);
		Log.info("GitHubController::provisionRepository( " + repoName + " ) - isProvisioned: " + isRepoProvisioned);

		// tracks whether the repo exists on GitHub (and may already hold imported content);
		// if it does, the failure path below must not delete it
		let repoCreated = false;
		let resuming = false;

		if (isRepoProvisioned === true) {
			// CREATED means Classy made this repo and never finished finalizing it (no webhook, no
			// staff teams). Resume there rather than refusing: refusing left such a repo unusable,
			// with no way to fix it from the admin UI.
			const existing = await this.dbc.getRepository(repoName);
			const unfinished = existing !== null && existing.gitHubStatus === RepoStatus.CREATED;

			if (unfinished === true) {
				Log.warn("GitHubController::provisionRepository( " + repoName + " ) - exists but was never finalized; resuming");
				repoCreated = true;
				resuming = true;
			} else {
				// this is fatal, we cannot provision a repo that already exists
				Log.warn("GitHubController::provisionRepository( " + repoName + " ) - repo already exists on GitHub; provisioning failed");
				return false;
			}
		}

		try {
			if (resuming === false) {
				const provisionSuccessful = await this.createOnGitHub(repoName, importUrl);
				if (provisionSuccessful === true) {
					Log.info("GitHubController::provisionRepository( " + repoName + " ) - provisioning successful");
					repoCreated = true; // the repo now exists on GitHub, with its imported content
				} else {
					Log.warn("GitHubController::provisionRepository( " + repoName + " ) - provisioning NOT successful");
				}
			}

			if (repoCreated === true) {
				// attach admin/staff teams, add webhooks, provision student teams (but do not attach them)
				if ((await this.finalizeAndMark(repoName, teams, resuming)) === true) {
					Log.info("GitHubController::provisionRepository( " + repoName + " ) - provisioned; took: " + Util.took(start));
					return true;
				}
			}
		} catch (err) {
			// if we encounter an exception, something critical must have failed above
			// and we should consider the repo to not be provisioned
			Log.error("GitHubController::provisionRepository( " + repoName + " ) - ERROR: " + err);
		}

		// get here if true hasn't been returned or an exception has been thrown
		if (repoCreated === true) {
			// NOTE: the repo was created and may already contain imported student content, so it is
			// NOT deleted here; finalization (teams / webhooks / settings) is what failed and that
			// is recoverable by re-running finalization, whereas deleting the repo is not.
			Log.error("GitHubController::provisionRepository( " + repoName + " ) - created but not finalized; repo left in place for retry");
			throw new Error("GitHubController::provisionRepository( " + repoName + " ) failed; repo created but finalization failed");
		}

		// repo creation failed; remove if needed (requires createRepo be permissive if already exists)
		// try to unprovision the repo, just so we can try again in the future
		const res = await this.gha.deleteRepo(repoName);
		Log.info("GitHubController::provisionRepository( " + repoName + " ) - repo removed: " + res);

		// and put the Repository record back the way it was. GitHubActions::createRepo writes URL and
		// cloneURL as soon as GitHub answers, so a failure after that point (an import that cannot
		// reach the source repo, say) would otherwise leave a record pointing at a repo that no
		// longer exists -- and, since a URL now means "we created this on GitHub", would look like a
		// repo waiting to be finalized rather than one waiting to be created.
		await this.markNotProvisioned(repoName);

		throw new Error("GitHubController::provisionRepository( " + repoName + " ) failed; failed to create repo");
	}

	/**
	 * Rolls a Repository record back to its pre-provisioning state.
	 *
	 * NOTE: never throws. This runs on a path that is already failing, and the caller's error is the
	 * one worth reporting; a database problem here is logged instead of replacing it.
	 */
	private async markNotProvisioned(repoName: string): Promise<void> {
		try {
			const repo = await this.dbc.getRepository(repoName);
			if (repo === null) {
				return;
			}
			repo.URL = null;
			repo.cloneURL = null;
			await this.dbc.writeRepository(repo);
			await ProvisionState.setRepoStatus(repo, RepoStatus.NOT_CREATED, "deleted from GitHub after a failed provision");
		} catch (err) {
			Log.error("GitHubController::markNotProvisioned( " + repoName + " ) - ERROR: " + err.message);
		}
	}

	private async provisionTeam(team: Team): Promise<boolean> {
		const tc = new TeamController();

		try {
			// ensure team is in DB as expected
			await this.checkDatabase(null, team.id);

			Log.trace("GitHubController::provisionTeam( " + team.id + " ) - start; team: " + JSON.stringify(team));

			const teamNum = await tc.getTeamNumber(team.id);
			Log.trace("GitHubController::provisionTeam( " + team.id + " ) - dbT team Number: " + teamNum);
			if (team.gitHubStatus === TeamStatus.ATTACHED || team.gitHubStatus === TeamStatus.CREATED) {
				// already exists
				Log.warn("GitHubController::provisionTeam( " + team.id + " ) - " + "- team already provisioned: " + JSON.stringify(team));
				return true;
			} else {
				const teamValue = await this.gha.createTeam(team.id, "push");

				if (teamValue.githubTeamNumber > 0) {
					// worked
					Log.info("GitHubController::provisionTeam( " + team.id + " ) - team created: " + JSON.stringify(teamValue));
					team.URL = await this.getTeamUrl(team); // informational
					team.githubId = teamValue.githubTeamNumber;
					await this.dbc.writeTeam(team);
					await ProvisionState.setTeamStatus(team, TeamStatus.CREATED, "created on GitHub");
				} else {
					// never observed in practice, but logged just in case
					Log.error("GitHubController::provisionTeam( " + team.id + " ) - team NOT created: " + JSON.stringify(teamValue));
					return false;
				}

				Log.info("GitHubController::provisionTeam( " + team.id + " ) - adding members to GitHub team");
				// convert personIds to githubIds
				const memberGithubIds: string[] = [];
				for (const personId of team.personIds) {
					const person = await this.dbc.getPerson(personId);
					memberGithubIds.push(person.githubId);
				}

				const addMembers = await this.gha.addMembersToTeam(teamValue.teamName, memberGithubIds);
				// should probably check for success here
				Log.info("GitHubController::provisionTeam( " + team.id + " ) - addMembers: " + addMembers.teamName);
			}
		} catch (err) {
			// NOTE: this used to swallow the error and return true, which made every team
			// provisioning failure invisible to the caller
			Log.error("GitHubController::provisionTeam( " + team.id + " ) - create team ERROR: " + err);
			return false;
		}
		return true;
	}

	public async updateBranchProtection(repo: Repository, rules: BranchRule[]): Promise<boolean> {
		if (repo === null) {
			throw new Error("GitHubController::updateBranchProtection(..) - null repo");
		}

		Log.info("GitHubController::updateBranchProtection(", repo.id, ", ...) - start");
		if (!(await this.gha.repoExists(repo.id))) {
			throw new Error("GitHubController::updateBranchProtection() - " + repo.id + " did not exist");
		}
		const successes = await Promise.all(rules.map((r) => this.gha.addBranchProtectionRule(repo.id, r)));
		const allSuccess = successes.reduce((a, b) => a && b, true);
		Log.info("GitHubController::updateBranchProtection(", repo.id, ") - All rules added successfully:", allSuccess);
		return allSuccess;
	}

	public async createIssues(repo: Repository, issues: Issue[]): Promise<boolean> {
		if (repo === null) {
			throw new Error("GitHubController::createIssues(..) - null repo");
		}

		Log.info("GitHubController::createIssues(", repo.id, ", ...) - start");
		if (!(await this.gha.repoExists(repo.id))) {
			throw new Error("GitHubController::createIssues() - " + repo.id + " did not exist");
		}
		const successes = await Promise.all(issues.map((issue) => this.gha.makeIssue(repo.id, issue)));
		const allSuccess = successes.every((success) => success === true);
		Log.info("GitHubController::createIssues(", repo.id, ") - All issues created successfully:", allSuccess);
		return allSuccess;
	}

	/**
	 * Checks to make sure the repoName or teamName (or both, if specified) are in the database.
	 *
	 * This is like an assertion that should be picked up by tests, although it should never
	 * happen in production (if our suite is any good).
	 *
	 * NOTE: ASYNC FUNCTION!
	 *
	 * @param {string | null} repoName
	 * @param {string | null} teamName
	 * @returns {Promise<boolean>}
	 */
	private async checkDatabase(repoName: string | null, teamName: string | null): Promise<boolean> {
		Log.trace("GitHubController::checkDatabase( repo:_" + repoName + "_, team:_" + teamName + "_) - start");
		const dbc = DatabaseController.getInstance();
		if (repoName !== null) {
			const repo = await dbc.getRepository(repoName);
			if (repo === null) {
				const msg = "Repository: " + repoName + " does not exist in datastore; make sure you add it before calling this operation";
				Log.error("GitHubController::checkDatabase() - repo ERROR: " + msg);
				throw new Error(msg);
			} else {
				// ensure custom property is there
				/* istanbul ignore if */
				if (typeof repo.custom === "undefined" || repo.custom === null || typeof repo.custom !== "object") {
					const msg = "Repository: " + repoName + " has a non-object .custom property";
					Log.error("GitHubController::checkDatabase() - repo ERROR: " + msg);
					throw new Error(msg);
				}
			}
		}

		if (teamName !== null) {
			const team = await dbc.getTeam(teamName);
			if (team === null) {
				const msg = "Team: " + teamName + " does not exist in datastore; make sure you add it before calling this operation";
				Log.error("GitHubController::checkDatabase() - team ERROR: " + msg);
				throw new Error(msg);
			} else {
				// ensure custom property is there
				/* istanbul ignore if */
				if (typeof team.custom === "undefined" || team.custom === null || typeof team.custom !== "object") {
					const msg = "Team: " + teamName + " has a non-object .custom property";
					Log.error("GitHubController::checkDatabase() - team ERROR: " + msg);
					throw new Error(msg);
				}
			}
		}
		Log.trace("GitHubController::checkDatabase( repo:_" + repoName + "_, team:_" + teamName + "_) - exists");
		return true;
	}
}
