import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import Util from "@common/Util";

import { GitHubStatus, Repository, Team } from "../Types";
import { DatabaseController } from "./DatabaseController";
import { IGitHubActions } from "./GitHubActions";
import { TeamController } from "./TeamController";

export interface IGitHubController {
	/**
	 * This is a complex method that provisions an entire repository.
	 *
	 * Assumptions: a "staff" repo must also exist.
	 *
	 * @param {string} repoName
	 * @param {Team[]} teams
	 * @param {string} sourceRepo
	 * @param {boolean} shouldRelease whether the student team should be added to the repo
	 * @returns {Promise<boolean>}
	 */
	provisionRepository(repoName: string, teams: Team[], sourceRepo: string, shouldRelease: boolean): Promise<boolean>;

	createPullRequest(repo: Repository, prName: string): Promise<boolean>;

	updateBranchProtection(repo: Repository, rules: BranchRule[]): Promise<boolean>;

	getRepositoryUrl(repo: Repository): Promise<string>;

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

	constructor(gha: IGitHubActions) {
		this.gha = gha;
	}

	public async getRepositoryUrl(repo: Repository): Promise<string> {
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

	/**
	 * Creates the given repository on GitHub. Returns the Repository object when it is done (or null if it failed).
	 *
	 * Repository.URL should be set once the repo is created successfully
	 * (this is how we can track that the repo exists on GitHub).
	 *
	 * @param {string} repoName The name of the Repository
	 * @param {string} importUrl The repo it should be imported from (if null, no import should take place)
	 * @param {string} path The subset of the importUrl repo that should be added to the root of the new repo.
	 * If this is null, undefined, or "", the whole importUrl is imported.
	 * @returns {Promise<boolean>}
	 */
	public async createRepository(repoName: string, importUrl: string, path?: string): Promise<boolean> {
		Log.info("GitHubController::createRepository( " + repoName + ", ...) - start");

		// make sure repoName already exists in the database
		await this.checkDatabase(repoName, null);

		const config = Config.getInstance();
		const host = config.getProp(ConfigKey.publichostname);
		const WEBHOOKADDR = host + "/portal/githubWebhook";

		const startTime = Date.now();

		// const gh = GitHubActions.getInstance(true);

		Log.trace("GitHubController::createRepository( " + repoName + " ) - see if repo already exists on GitHub org");
		const repoVal = await this.gha.repoExists(repoName);
		if (repoVal === true) {
			// unable to create a repository if it already exists!
			Log.error(
				"GitHubController::createRepository( " +
					repoName +
					" ) - Error: Repository already exists " +
					"on GitHub; unable to create a new repository"
			);
			throw new Error("createRepository(..) failed; Repository " + repoName + " already exists on GitHub.");
		}

		try {
			// create the repository
			Log.trace("GitHubController::createRepository( " + repoName + " ) - create GitHub repo");
			const repoCreateVal = await this.gha.createRepo(repoName);
			Log.trace("GitHubController::createRepository( " + repoName + " ) - success; repo: " + repoCreateVal);
		} catch (err) {
			/* istanbul ignore next: braces needed for ignore */
			{
				Log.error("GitHubController::createRepository( " + repoName + " ) - create repo error: " + err);
				// repo creation failed; remove if needed (requires createRepo be permissive if already exists)
				const res = await this.gha.deleteRepo(repoName);
				Log.info("GitHubController::createRepository( " + repoName + " ) - repo removed: " + res);
				throw new Error("createRepository(..) failed; Repository " + repoName + " creation failed; ERROR: " + err.message);
			}
		}

		try {
			// still add staff team with push, just not students
			Log.trace("GitHubController::createRepository( " + repoName + " ) - add staff team to repo");
			// const staffTeamNumber = await this.tc.getTeamNumber(TeamController.STAFF_NAME);
			// Log.trace("GitHubController::createRepository(..) - staffTeamNumber: " + staffTeamNumber);
			// const staffAdd = await this.gha.addTeamToRepo(staffTeamNumber, repoName, "admin");
			const staffAdd = await this.gha.addTeamToRepo(TeamController.STAFF_NAME, repoName, "admin");
			Log.trace("GitHubController::createRepository(..) - team name: " + staffAdd.teamName);

			Log.trace("GitHubController::createRepository( " + repoName + " ) - add admin team to repo");
			// const adminTeamNumber = await this.tc.getTeamNumber(TeamController.ADMIN_NAME);
			// Log.trace("GitHubController::createRepository(..) - adminTeamNumber: " + adminTeamNumber);
			// const adminAdd = await this.gha.addTeamToRepo(adminTeamNumber, repoName, "admin");
			const adminAdd = await this.gha.addTeamToRepo(TeamController.ADMIN_NAME, repoName, "admin");
			Log.trace("GitHubController::createRepository(..) - team name: " + adminAdd.teamName);

			// add webhooks
			Log.trace("GitHubController::createRepository( " + repoName + " ) - add webhook");
			const createHook = await this.gha.addWebhook(repoName, WEBHOOKADDR);
			Log.trace("GitHubController::createRepository(..) - webhook successful: " + createHook);

			// perform import
			const c = Config.getInstance();
			const targetUrl = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/" + repoName;

			Log.trace("GitHubController::createRepository( " + repoName + " ) - importing project (slow)");
			let output;
			/* istanbul ignore if */
			if (typeof path !== "undefined") {
				output = await this.gha.importRepoFS(importUrl, targetUrl, path);
			} else {
				output = await this.gha.importRepoFS(importUrl, targetUrl);
			}
			Log.trace("GitHubController::createRepository( " + repoName + " ) - import complete; success: " + output);

			Log.trace(
				"GithubController::createRepository( " + repoName + " ) - successfully completed; " + "took: " + Util.took(startTime)
			);

			return true;
		} catch (err) {
			Log.error("GithubController::createRepository( " + repoName + " ) - ERROR: " + err);
			return false;
		}
	}

	/**
	 * Creates the given repository on GitHub. Returns the Repository object when it is done (or null if it failed).
	 *
	 * Repository.URL should be set once the repo is created successfully
	 * (this is how we can track that the repo exists on GitHub).
	 *
	 * @param {string} repoName The name of the Repository.
	 * @param {string} importUrl The repo it should be imported from (if null, no import will take place).
	 * @param {string} branchesToKeep The subset of the branches from the imported repo that should exist in the created repo.
	 * If undefined or [], all branches are retained.
	 * @returns {Promise<boolean>}
	 */
	public async createRepositoryFromTemplate(repoName: string, importUrl: string, branchesToKeep?: string[]): Promise<boolean> {
		Log.info("GitHubController::createRepositoryFromTemplate( " + repoName + ", ...) - start");

		// make sure repoName already exists in the database
		await this.checkDatabase(repoName, null);

		const config = Config.getInstance();
		const host = config.getProp(ConfigKey.publichostname);
		const WEBHOOKADDR = host + "/portal/githubWebhook";

		const startTime = Date.now();

		if (typeof branchesToKeep === "undefined") {
			branchesToKeep = [];
		}

		// const gh = GitHubActions.getInstance(true);

		Log.trace("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - see if repo already exists");
		const repoVal = await this.gha.repoExists(repoName);
		if (repoVal === true) {
			// unable to create a repository if it already exists!
			Log.error(
				"GitHubController::createRepositoryFromTemplate( " +
					repoName +
					" ) - Error: " +
					"Repository already exists; unable to create a new repository"
			);
			throw new Error("createRepositoryFromTemplate( " + repoName + " ) failed; " + "Repository " + repoName + " already exists.");
		}

		try {
			// create the repository
			Log.trace("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - create GitHub repo");
			const repoCreateVal = await this.gha.createRepo(repoName);
			Log.trace("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - success; " + "repo: " + repoCreateVal);
		} catch (err) {
			/* istanbul ignore next: braces needed for ignore */
			{
				Log.error("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - create repo error: " + err);
				// repo creation failed; remove if needed (requires createRepo be permissive if already exists)
				const res = await this.gha.deleteRepo(repoName);
				Log.info("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - repo removed: " + res);
				throw new Error("createRepository( " + repoName + " ) creation failed; ERROR: " + err.message);
			}
		}

		if (branchesToKeep.length > 0) {
			// TODO: remove any branches we do not need
		} else {
			Log.info("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - all branches included");
		}

		try {
			// still add staff team with push, just not students
			Log.trace("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - add staff team to repo");
			// const staffTeamNumber = await this.tc.getTeamNumber(TeamController.STAFF_NAME);
			// Log.trace("GitHubController::createRepository(..) - staffTeamNumber: " + staffTeamNumber);
			// const staffAdd = await this.gha.addTeamToRepo(staffTeamNumber, repoName, "admin");
			const staffAdd = await this.gha.addTeamToRepo(TeamController.STAFF_NAME, repoName, "admin");
			Log.trace("GitHubController::createRepositoryFromTemplate(..) - team name: " + staffAdd.teamName);

			Log.trace("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - add admin team to repo");
			// const adminTeamNumber = await this.tc.getTeamNumber(TeamController.ADMIN_NAME);
			// Log.trace("GitHubController::createRepository(..) - adminTeamNumber: " + adminTeamNumber);
			// const adminAdd = await this.gha.addTeamToRepo(adminTeamNumber, repoName, "admin");
			const adminAdd = await this.gha.addTeamToRepo(TeamController.ADMIN_NAME, repoName, "admin");
			Log.trace("GitHubController::createRepositoryFromTemplate(..) - team name: " + adminAdd.teamName);

			// add webhooks
			Log.trace("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - add webhook");
			const createHook = await this.gha.addWebhook(repoName, WEBHOOKADDR);
			Log.trace("GitHubController::createRepositoryFromTemplate(..) - webook successful: " + createHook);

			// perform import
			const c = Config.getInstance();
			const targetUrl = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/" + repoName;

			Log.trace("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - importing project (slow)");
			const output = await this.gha.importRepoFS(importUrl, targetUrl);
			Log.trace("GitHubController::createRepositoryFromTemplate( " + repoName + " ) - import complete; " + "success: " + output);

			Log.trace(
				"GithubController::createRepositoryFromTemplate( " +
					repoName +
					" ) - successfully completed; " +
					"took: " +
					Util.took(startTime)
			);

			return true;
		} catch (err) {
			Log.error("GithubController::createRepositoryFromTemplate( " + repoName + " ) - ERROR: " + err);
			return false;
		}
	}

	/**
	 * Releases a repository to a team.
	 *
	 * @param {Repository} repo The repository to be released. This must be in the datastore.
	 * @param {Team[]} teams The teams to be added. These must be in the datastore.
	 * @param {boolean} asCollaborators Whether the team members should be added as a collaborators
	 * or whether a GitHub team should be created for them.
	 * @returns {Promise<Repository | null>}
	 */
	public async releaseRepository(repo: Repository, teams: Team[], asCollaborators: boolean = false): Promise<boolean> {
		Log.info("GitHubController::releaseRepository( {" + repo.id + ", ...}, ...) - start");
		const start = Date.now();

		await this.checkDatabase(repo.id, null);

		// const gh = GitHubActions.getInstance(true);

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
					// keep track of team addition
					team.gitHubStatus = GitHubStatus.PROVISIONED_LINKED;
					// team.custom.githubAttached = true;
				} else {
					Log.error("GitHubController::releaseRepository(..) - ERROR adding team to repo: " + JSON.stringify(res));
					// team.custom.githubAttached = false;
					team.gitHubStatus = GitHubStatus.PROVISIONED_UNLINKED;
				}

				await this.dbc.writeTeam(team); // add new properties to the team
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

		Log.info("GitHubController::releaseRepository( " + repo.id + ", ... ) - done; took: " + Util.took(start));
		return true;
	}

	public async provisionRepository(repoName: string, teams: Team[], importUrl: string): Promise<boolean> {
		Log.info("GitHubController::provisionRepository( " + repoName + ", ...) - start");
		const dbc = DatabaseController.getInstance();

		const start = Date.now();

		if (teams.length < 1 || teams.length > 1) {
			Log.warn("GitHubController::provisionRepository(..) - only the first team will be added to the repo");
		}

		Log.info("GitHubController::provisionRepository( " + repoName + " ) - checking to see if repo already exists");
		let repo = await dbc.getRepository(repoName);
		if (repo === null) {
			// repo object should be in datastore before we try to provision it
			throw new Error("GitHubController::provisionRepository( " + repoName + " ) - repo does not exist in datastore (but should)");
		}

		const repoExists = await this.gha.repoExists(repoName);
		Log.info("GitHubController::provisionRepository( " + repoName + " ) - repo exists: " + repoExists);
		if (repoExists === true) {
			// this is fatal, we cannot provision a repo that already exists
			Log.error("GitHubController::provisionRepository( " + repoName + " ) - repo already exists on GitHub; provisioning failed");
			throw new Error("provisionRepository( " + repoName + " ) failed; Repository " + repoName + " already exists.");
		}

		let repoVal;
		try {
			// create a repo
			Log.info("GitHubController::provisionRepository( " + repoName + " ) - creating GitHub repo");
			// this is the create and import w/ fs flow
			// repoVal = await this.gha.createRepo(repoName); // only creates repo, contents are added later

			// this is the create and import w/ template flow
			// this string munging feels unfortunate, but the data is all there and should always be structured this way
			// if there is a problem, fail fast
			let importOwner = "";
			let importRepo = "";
			const importBranchesToKeep = [];
			try {
				importOwner = importUrl.split("/")[3];
				importRepo = importUrl.split("/")[4];
				// remove branch from the end of the repo name
				if (importRepo.includes("#")) {
					importRepo = importRepo.split("#")[0];
				}
				// remove .git from the end of the repo name
				if (importRepo.endsWith(".git")) {
					importRepo = importRepo.substring(0, importRepo.length - 4);
				}

				if (importUrl.includes("#")) {
					// if a branch is specified in the import URL, we need to keep only it
					const splitUrl = importUrl.split("#");
					importBranchesToKeep.push(splitUrl[1]);
				}

				// fail if problem encountered
				if (importOwner.length < 1) {
					throw new Error("Owner name is empty");
				}
				if (importRepo.length < 1) {
					throw new Error("Repo name is empty");
				}
				if (importBranchesToKeep.length > 0 && importBranchesToKeep[0].length < 1) {
					throw new Error("Invalid branches to keep: " + JSON.stringify(importBranchesToKeep));
				}
			} catch (err) {
				Log.error(
					"GitHubController::provisionRepository( " +
						repoName +
						" ) - error parsing import URL: " +
						importUrl +
						"; err: " +
						err.message
				);
				throw new Error("provisionRepository( " + repoName + " ) creating repo failed; ERROR: " + err.message);
			}

			Log.info(
				"GitHubController::provisionRepository( " +
					repoName +
					" ) - importing: " +
					importOwner +
					"/" +
					importRepo +
					"; branchesToKeep: " +
					JSON.stringify(importBranchesToKeep)
			);

			repoVal = await this.gha.createRepoFromTemplate(repoName, importOwner, importRepo); // creates repo and imports contents

			if (importBranchesToKeep.length > 0) {
				// prune branches
				const branchRemovalSuccess = await this.gha.deleteBranches(repoName, importBranchesToKeep);
				Log.info("GitHubController::provisionRepository( " + repoName + " ) - branch removal success: " + branchRemovalSuccess);

				// rename branches
				// since we are only keeping one branch, make sure it is renamed to main
				if (importBranchesToKeep[0] !== "main") {
					const branchRenameSuccess = await this.gha.renameBranch(repoName, importBranchesToKeep[0], "main");
					Log.info("GitHubController::provisionRepository( " + repoName + " ) - branch rename success: " + branchRenameSuccess);
				}
			} else {
				Log.info("GitHubController::provisionRepository( " + repoName + " ) - no branch specified; all branches kept");
			}

			Log.trace("GitHubController::provisionRepository( " + repoName + " ) - updating repo");
			// since we moved to template provisioning, we need to update the repo to make sure the settings are correct
			const updateWorked = await this.gha.updateRepo(repoName);
			Log.trace("GitHubController::provisionRepository( " + repoName + " ) - repo updated: " + updateWorked);

			Log.info("GitHubController::provisionRepository( " + repoName + " ) - GitHub repo created");

			// we consider the repo to be provisioned once the whole flow is done
			// callers of this method should instead set the URL field
			repo = await dbc.getRepository(repoName);
			repo.custom.githubCreated = true;
			await dbc.writeRepository(repo);

			Log.info("GitHubController::provisionRepository( " + repoName + " ) - val: " + repoVal);
		} catch (err) {
			/* istanbul ignore next: braces needed for ignore */
			{
				Log.error("GitHubController::provisionRepository( " + repoName + " ) - create repo ERROR: " + err);
				// repo creation failed; remove if needed (requires createRepo be permissive if already exists)
				const res = await this.gha.deleteRepo(repoName);
				Log.info("GitHubController::provisionRepository( " + repoName + " ) - repo removed: " + res);
				throw new Error("provisionRepository( " + repoName + " ) failed; failed to create repo; ERROR: " + err.message);
			}
		}

		const tc = new TeamController();
		try {
			let teamValue = null;
			try {
				Log.info("GitHubController::provisionRepository() - create GitHub team(s): " + JSON.stringify(teams));
				for (const team of teams) {
					Log.trace("GitHubController::provisionRepository() - team: " + JSON.stringify(team));
					const dbT = await dbc.getTeam(team.id);
					if (dbT === null) {
						throw new Error(
							"GitHubController::provisionRepository( " +
								repoName +
								" ) - " +
								"team does not exist in datastore (but should): " +
								team.id
						);
					}
					Log.trace("GitHubController::provisionRepository() - dbT: " + JSON.stringify(dbT));

					const teamNum = await tc.getTeamNumber(team.id);
					Log.trace("GitHubController::provisionRepository() - dbT team Number: " + teamNum);
					if (team.URL !== null && teamNum !== null) {
						// already exists
						Log.warn(
							"GitHubController::provisionRepository( " +
								repoName +
								" ) - team already exists: " +
								teamValue.teamName +
								"; assuming team members on github are correct."
						);
					} else {
						teamValue = await this.gha.createTeam(team.id, "push");
						Log.info("GitHubController::provisionRepository( " + repoName + " ) - teamCreate: " + teamValue.teamName);

						if (teamValue.githubTeamNumber > 0) {
							// worked

							// team.URL = teamValue.URL;
							team.URL = await this.getTeamUrl(team);
							team.githubId = teamValue.githubTeamNumber;
							team.gitHubStatus = GitHubStatus.PROVISIONED_UNLINKED;
							// team.custom.githubAttached = false; // attaching happens in release
							await dbc.writeTeam(team);
						}

						Log.info("GitHubController::provisionRepository( " + repoName + " ) - add members to GitHub team: " + team.id);

						// convert personIds to githubIds
						const memberGithubIds: string[] = [];
						for (const personId of team.personIds) {
							const person = await this.dbc.getPerson(personId);
							memberGithubIds.push(person.githubId);
						}

						const addMembers = await this.gha.addMembersToTeam(teamValue.teamName, memberGithubIds);
						Log.info("GitHubController::provisionRepository( " + repoName + " ) - addMembers: " + addMembers.teamName);
					}
				}
			} catch (err) {
				Log.warn("GitHubController::provisionRepository() - create team ERROR: " + err);
				// swallow these errors and keep going
			}

			// add staff team to repo
			Log.trace("GitHubController::provisionRepository() - add staff team to repo");
			const staffAdd = await this.gha.addTeamToRepo(TeamController.STAFF_NAME, repoName, "admin");
			Log.trace("GitHubController::provisionRepository(..) - team name: " + staffAdd.teamName);

			// add admin team to repo
			Log.trace("GitHubController::provisionRepository() - add admin team to repo");
			const adminAdd = await this.gha.addTeamToRepo(TeamController.ADMIN_NAME, repoName, "admin");
			Log.trace("GitHubController::provisionRepository(..) - team name: " + adminAdd.teamName);

			// add webhooks to repo
			const host = Config.getInstance().getProp(ConfigKey.publichostname);
			const WEBHOOKADDR = host + "/portal/githubWebhook";
			Log.trace("GitHubController::provisionRepository() - add webhook to: " + WEBHOOKADDR);
			const createHook = await this.gha.addWebhook(repoName, WEBHOOKADDR);
			Log.trace("GitHubController::provisionRepository(..) - webhook successful: " + createHook);

			// this was the import from fs flow which is not needed if we are using import from template instead
			// perform import
			// const c = Config.getInstance();
			// const targetUrl = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/" + repoName;
			// Log.trace("GitHubController::provisionRepository() - importing project (slow)");
			// const output = await this.gha.importRepoFS(importUrl, targetUrl);
			// Log.trace("GitHubController::provisionRepository(..) - import complete; success: " + output);

			Log.trace(
				"GitHubController::provisionRepository(..) - successfully completed for: " + repoName + "; took: " + Util.took(start)
			);

			return true;
		} catch (err) {
			Log.error("GitHubController::provisionRepository(..) - ERROR: " + err);
		}
		return false;
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
	 * Calls the patch tool
	 * @param {Repository} repo Repo to be patched
	 * @param {string} prName Name of the patch to apply
	 * @param {boolean} dryrun Whether to do a practice patch
	 *        i.e.: if dryrun is false  -> patch is applied to repo
	 *              elif dryrun is true -> patch is not applied,
	 *                   but otherwise will behave as if it was
	 * @param {boolean} root
	 */
	public async createPullRequest(repo: Repository, prName: string, dryrun: boolean = false, root: boolean = false): Promise<boolean> {
		Log.info(`GitHubController::createPullRequest(..) - Repo: (${repo.id}) start`);
		throw new Error("Not implemented"); // code below used to work but depended on service that no longer exists
		// // if (repo.cloneURL === null || repo.cloneURL === undefined) {
		// //     Log.error(`GitHubController::createPullRequest(..) - ${repo.id} did not have a valid cloneURL associated with it.`);
		// //     return false;
		// // }
		//
		// const baseUrl: string = Config.getInstance().getProp(ConfigKey.patchToolUrl);
		// const patchUrl: string = `${baseUrl}/autopatch`;
		// const updateUrl: string = `${baseUrl}/update`;
		// const qs: string = Util.getQueryStr({
		//     patch_id: prName, github_url: `${repo.URL}.git`, dryrun: String(dryrun), from_beginning: String(root)
		// });
		//
		// const options: RequestInit = {
		//     method: "POST",
		//     agent: new http.Agent()
		// };
		//
		// let result;
		//
		// try {
		//     await fetch(patchUrl + qs, options);
		//     Log.info("GitHubController::createPullRequest(..) - Patch applied successfully");
		//     return true;
		// } catch (err) {
		//     result = err;
		// }
		//
		// switch (result.statusCode) {
		//     case 424:
		//         Log.info(`GitHubController::createPullRequest(..) - ${prName} was not found by the patchtool. Updating patches.`);
		//         try {
		//             await fetch(updateUrl, options);
		//             Log.info(`GitHubController::createPullRequest(..) - Patches updated successfully. Retrying.`);
		//             await fetch(patchUrl + qs, {...options});
		//             Log.info("GitHubController::createPullRequest(..) - Patch applied successfully on second attempt");
		//             return true;
		//         } catch (err) {
		//             Log.error("GitHubController::createPullRequest(..) - Patch failed on second attempt. "+
		//                 "Message from patchtool server:" + result.message);
		//             return false;
		//         }
		//     case 500:
		//         Log.error(
		//             `GitHubController::createPullRequest(..) - patchtool internal error. " +
		//             "Message from patchtool server: ${result.message}`
		//         );
		//         return false;
		//     default:
		//         Log.error(
		//             `GitHubController::createPullRequest(..) - was not able to make a connection to patchtool. Error: ${result.message}`
		//         );
		//         return false;
		// }
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

// /* istanbul ignore next */
//
// // tslint:disable-next-line
// export class TestGitHubController implements IGitHubController {
//
//     public async getRepositoryUrl(repo: Repository): Promise<string> {
//         Log.warn("TestGitHubController::getRepositoryUrl(..) - TEST");
//         return "TestGithubController_URL";
//     }
//
//     public async getTeamUrl(team: Team): Promise<string> {
//         Log.warn("TestGitHubController::getTeamUrl(..) - TEST");
//         // const URL = this.gha.getTeamNumber()
//         return "TestGithubController_TeamName";
//     }
//
//     public async provisionRepository(repoName: string,
//                                      teams: Team[],
//                                      sourceRepo: string): Promise<boolean> {
//         Log.warn("TestGitHubController::provisionRepository(..) - TEST");
//         return true;
//     }
//
//     public async createPullRequest(repo: Repository, prName: string): Promise<boolean> {
//         Log.warn("TestGitHubController::createPullRequest(..) - TEST");
//         return true;
//     }
//
//     public async updateBranchProtection(repo: Repository, rules: BranchRule[]): Promise<boolean> {
//         Log.warn("TestGitHubController::updateBranchProtection(..) - TEST");
//         return true;
//     }
//
//     public async createIssues(repo: Repository, issues: Issue[]): Promise<boolean> {
//         Log.warn("TestGitHubController::createIssues(..) - TEST");
//         return true;
//     }
//
//     public async releaseRepository(repo: Repository,
//                                    teams: Team[],
//                                    asCollaborators: boolean = false): Promise<boolean> {
//         Log.warn("TestGitHubController::releaseRepository(..) - TEST");
//         return true;
//     }
// }
