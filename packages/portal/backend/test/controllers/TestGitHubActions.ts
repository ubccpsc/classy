// do not use module imports (@common, @backend) in this file
import Log from "@common/Log";
import Config, { ConfigKey } from "@common/Config";
import { TestHarness } from "@common/TestHarness";

import { BranchRule, GitPersonTuple, GitRepoTuple, GitTeamTuple, Issue } from "@backend/controllers/GitHubController";
import { TeamController } from "@backend/controllers/TeamController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { GitHubActions, IGitHubActions } from "@backend/controllers/GitHubActions";

export class TestGitHubActions implements IGitHubActions {
	private teams: Map<string, GitTeamTuple> = new Map();

	public constructor() {
		Log.info("TestGitHubActions::<init> - start");
		this.teams.set(TeamController.STAFF_NAME, { teamName: TeamController.STAFF_NAME, githubTeamNumber: 1000 });
		this.teams.set(TeamController.ADMIN_NAME, { teamName: TeamController.ADMIN_NAME, githubTeamNumber: 1001 });
	}

	public listRepoBranches(repoId: string): Promise<string[]> {
		throw new Error("Method not implemented.");
	}

	public deleteBranches(repoId: string, branchesToKeep: string[]): Promise<boolean> {
		throw new Error("Method not implemented.");
	}

	public deleteBranch(repoId: string, branchToDelete: string): Promise<boolean> {
		throw new Error("Method not implemented.");
	}

	public renameBranch(repoId: string, oldName: string, newName: string): Promise<boolean> {
		throw new Error("Method not implemented.");
	}

	public async addMembersToTeam(teamName: string, members: string[]): Promise<GitTeamTuple> {
		Log.info("TestGitHubActions::addMembersToTeam(..)");
		return { teamName: teamName, githubTeamNumber: 1 };
	}

	public async removeMembersFromTeam(teamName: string, members: string[]): Promise<GitTeamTuple> {
		Log.info("TestGitHubActions::addMembersToTeam(..)");
		return { teamName: teamName, githubTeamNumber: 1 };
	}

	public async addTeamToRepo(teamName: string, repoName: string, permission: string): Promise<GitTeamTuple> {
		Log.info("TestGitHubActions::addTeamToRepo(..)");
		return { teamName: "team_" + repoName, githubTeamNumber: 1 };
	}

	public async addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
		Log.info("TestGitHubActions::addWebhook(..)");
		if (typeof this.webHookState[repoName] === "undefined") {
			this.webHookState[repoName] = [];
		}
		this.webHookState[repoName] = webhookEndpoint;
		return true;
	}

	private repos: any = {};

	public async createRepo(repoName: string): Promise<string> {
		Log.info("TestGitHubActions::createRepo( " + repoName + " ) - start");
		await GitHubActions.checkDatabase(repoName, null);

		if (typeof this.repos[repoName] === "undefined") {
			Log.info("TestGitHubActions::createRepo( " + repoName + " ) - created");
			const c = Config.getInstance();
			this.repos[repoName] = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/" + repoName;
		}
		Log.info("TestGitHubActions::createRepo( " + repoName + " ) - repos: " + JSON.stringify(this.repos));
		return this.repos[repoName];
	}

	public async createRepoFromTemplate(repoName: string, templateOwner: string, templateRepo: string): Promise<string> {
		Log.info("TestGitHubActions::createRepoFromTemplate( " + repoName + ", " + templateOwner + ", " + templateRepo + " ) - start");
		await GitHubActions.checkDatabase(repoName, null);

		if (typeof this.repos[repoName] === "undefined") {
			Log.info("TestGitHubActions::createRepoFromTemplate( " + repoName + " ) - created");
			const c = Config.getInstance();
			this.repos[repoName] = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/" + repoName;
		}
		Log.info("TestGitHubActions::createRepoFromTemplate( " + repoName + " ) - repos: " + JSON.stringify(this.repos));
		return this.repos[repoName];
	}

	public async updateRepo(repoName: string): Promise<boolean> {
		if (typeof this.repos[repoName] !== "undefined") {
			Log.info("TestGitHubActions::updateRepo( " + repoName + " ) - exists");
			return true;
		}
		Log.info("TestGitHubActions::updateRepo( " + repoName + " ) - does not exist");
		return false;
	}

	// public async createTeam(teamName: string, permission: string): Promise<{ teamName: string; githubTeamNumber: number; URL: string }> {
	public async createTeam(teamName: string, permission: string): Promise<GitTeamTuple> {
		// if (typeof this.teams[teamName] === "undefined") {
		if (this.teams.has(teamName) === false) {
			// const c = Config.getInstance();
			// const url = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/teams/" + teamName;
			// this.teams[teamName] = {teamName: teamName, githubTeamNumber: Date.now(), URL: url};
			this.teams.set(teamName, { teamName: teamName, githubTeamNumber: Date.now() });
		}
		Log.info(
			"TestGitHubActions::teamCreate( " +
				teamName +
				" ) - created; exists: " +
				this.teams.has(teamName) +
				"; records: " +
				JSON.stringify(this.teams)
		);

		return this.teams.get(teamName);
	}

	public async deleteRepo(repoName: string): Promise<boolean> {
		Log.info("TestGitHubActions::deleteRepo( " + repoName + " )");
		// if (repoName === Test.INVALIDREPONAME) {
		//     return false;
		// }
		// const repoExists = await this.repoExists(repoName);
		// if (repoExists === false){
		//     Log.info("TestGitHubActions::deleteRepo( " + repoName + " ) - false; does not exist");
		//     return false;
		// }

		if (typeof this.repos[repoName] !== "undefined") {
			Log.info("TestGitHubActions::deleteRepo( " + repoName + " ) - true; deleted");
			delete this.repos[repoName];
			return true;
		}

		Log.info("TestGitHubActions::deleteRepo( " + repoName + " ) - false; does not exist");
		return false;
	}

	public async deleteTeam(teamNameToDelete: string): Promise<boolean> {
		Log.info("TestGitHubActions::deleteTeam( " + teamNameToDelete + " )");
		for (const teamName of Object.keys(this.teams)) {
			// const team = this.teams[teamName];
			const team = this.teams.get(teamName);
			if (team.teamName === teamNameToDelete) {
				Log.info("TestGitHubActions::deleteTeam( " + teamNameToDelete + " ) - deleting team name: " + team.teamName);
				// delete this.teams[teamName];
				this.teams.delete(teamName);
				return true;
			}
		}

		Log.info("TestGitHubActions::deleteTeam( " + teamNameToDelete + " ); not deleted");
		return false;
	}

	public async getTeamMembers(teamName: string): Promise<string[]> {
		Log.info("TestGitHubActions::getTeamMembers( " + teamName + " )");
		if (teamName === null || teamName.length < 1) {
			return [];
		}
		return [TestHarness.REALBOTNAME1, TestHarness.REALUSERNAME, TestHarness.ADMIN1.github];
	}

	public async getTeamNumber(teamName: string): Promise<number> {
		if (teamName === "students") {
			// return a value that works for testing and for the live environment
			// this is the team number for the students team in the classytest org on github.com
			return 2941733;
		}
		// if (typeof this.teams[teamName] !== "undefined") {
		if (this.teams.has(teamName) === true) {
			const num = this.teams.get(teamName).githubTeamNumber;
			Log.info("TestGitHubActions::getTeamNumber( " + teamName + " ) - returning: " + num);
			return Number(num);
		}
		Log.info("TestGitHubActions::getTeamNumber( " + teamName + " ) - returning: -1; other records: " + JSON.stringify(this.teams));
		return -1;
	}

	public async getTeamByName(teamName: string): Promise<GitTeamTuple | null> {
		for (const name of this.teams.keys()) {
			const team = this.teams.get(name);
			if (team.teamName === teamName) {
				return { githubTeamNumber: team.githubTeamNumber, teamName: team.teamName };
			}
		}
		return null;
	}

	public async getTeam(teamNumber: number): Promise<GitTeamTuple | null> {
		for (const teamName of this.teams.keys()) {
			const team = this.teams.get(teamName);
			if (team.githubTeamNumber === teamNumber) {
				return { githubTeamNumber: teamNumber, teamName: team.teamName };
			}
		}
		return null;
	}

	public async importRepoFS(importRepo: string, studentRepo: string, seedFilePath?: string): Promise<boolean> {
		Log.info("TestGitHubActions::importRepoFS( " + importRepo + ", ... ) - start");

		return true;
	}

	public async isOnAdminTeam(userName: string): Promise<boolean> {
		if (userName === TestHarness.ADMIN1.github || userName === TestHarness.ADMINSTAFF1.github) {
			Log.info("TestGitHubActions::isOnAdminTeam( " + userName + " ) - true");
			return true;
		}
		Log.info("TestGitHubActions::isOnAdminTeam( " + userName + " ) - false");
		return false;
	}

	public async isOnStaffTeam(userName: string): Promise<boolean> {
		if (userName === TestHarness.STAFF1.github || userName === TestHarness.ADMINSTAFF1.github) {
			Log.info("TestGitHubActions::isOnStaffTeam( " + userName + " ) - true");
			return true;
		}
		Log.info("TestGitHubActions::isOnStaffTeam( " + userName + " ) - false");
		return false;
	}

	public async isOnTeam(teamName: string, userName: string): Promise<boolean> {
		Log.info("TestGitHubActions::isOnTeam( t: " + teamName + ", u: " + userName + " )");
		return true;
	}

	public async listTeamMembers(teamName: string): Promise<string[]> {
		Log.info("TestGitHubActions::listTeamMembers( " + teamName + " )");

		const db: DatabaseController = DatabaseController.getInstance();

		const teamRecord = await db.getTeam(teamName);
		if (teamRecord === null) {
			const teamMembers: string[] = [];

			const allPeople = await db.getPeople();
			for (const person of allPeople) {
				teamMembers.push(person.githubId);
			}

			return teamMembers;
		} else {
			return teamRecord.personIds;
		}
	}

	public async listPeople(): Promise<GitPersonTuple[]> {
		Log.info("TestGitHubActions::listPeople(..)");
		const people: GitPersonTuple[] = [];

		const start = Date.now();
		people.push({ githubPersonNumber: start, url: "URL", githubId: TestHarness.REALBOTNAME1 });
		people.push({ githubPersonNumber: start - 5, url: "URL", githubId: TestHarness.REALUSERNAME });
		people.push({ githubPersonNumber: start - 15, url: "URL", githubId: TestHarness.REALBOTNAME1 });
		people.push({ githubPersonNumber: start - 15, url: "URL", githubId: TestHarness.REALUSER1.github });
		people.push({ githubPersonNumber: start - 15, url: "URL", githubId: TestHarness.REALUSER2.github });
		people.push({ githubPersonNumber: start - 15, url: "URL", githubId: TestHarness.ADMIN1.github });
		people.push({ githubPersonNumber: start - 25, url: "URL", githubId: TestHarness.USER1.github });
		people.push({ githubPersonNumber: start - 35, url: "URL", githubId: TestHarness.USER2.github });
		people.push({ githubPersonNumber: start - 45, url: "URL", githubId: TestHarness.USER3.github });
		people.push({ githubPersonNumber: start - 55, url: "URL", githubId: TestHarness.USER4.github });

		return people;
	}

	public async listRepos(): Promise<GitRepoTuple[]> {
		Log.info("TestGitHubActions::listRepos(..)");
		const ret: GitRepoTuple[] = [];
		for (const name of Object.keys(this.repos)) {
			const repo = this.repos[name];
			ret.push({ githubRepoNumber: Date.now(), repoName: name, url: repo });
		}
		Log.info("TestGitHubActions::listRepos(..) - #: " + ret.length + "; content: " + JSON.stringify(ret));
		return ret;
	}

	/**
	 * Returns the team tuples from the cache.
	 *
	 */
	public async listTeams(): Promise<GitTeamTuple[]> {
		Log.info("TestGitHubActions::listTeams(..)");
		const ret = [];
		for (const name of Object.keys(this.teams)) {
			const t = this.teams.get(name);
			ret.push({ githubTeamNumber: t.githubTeamNumber, teamName: t.teamName });
		}
		Log.info("TestGitHubActions::listTeams(..) - #: " + ret.length + "; content: " + JSON.stringify(ret));
		return ret;
	}

	private webHookState: any = {};

	public async listWebhooks(repoName: string): Promise<Array<{}>> {
		Log.info("TestGitHubActions::listWebhooks()");
		if (typeof this.webHookState[repoName] === "undefined") {
			return [];
		}
		return this.webHookState[repoName];
	}

	public async updateWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
		Log.info("TestGitHubActions::updateWebhook()");
		if (typeof this.webHookState[repoName] === "undefined") {
			return false;
		}

		this.webHookState[repoName] = webhookEndpoint;

		return true;
	}

	public async repoExists(repoName: string): Promise<boolean> {
		Log.info("TestGitHubActions::repoExists( " + repoName + " )");
		// if (repoName === Test.INVALIDREPONAME) {
		//     return false;
		// }
		// return true;
		if (typeof this.repos[repoName] !== "undefined") {
			Log.info("TestGitHubActions::repoExists( " + repoName + " ) - exists");
			return true;
		}
		Log.info("TestGitHubActions::repoExists( " + repoName + " ) - does not exist");
		return false;
	}

	public async setRepoPermission(repoName: string, permissionLevel: string): Promise<boolean> {
		Log.info("TestGitHubActions::setRepoPermission( " + repoName + ", " + permissionLevel + " )");
		if (repoName === TestHarness.INVALIDREPONAME) {
			return false;
		}
		if (permissionLevel === "admin") {
			return false;
		}
		return true;
	}

	public async writeFileToRepo(repoURL: string, fileName: string, fileContent: string, force?: boolean): Promise<boolean> {
		Log.info("TestGitHubActions::writeFileToRepo(..)");
		if (repoURL === "invalidurl.com") {
			return false;
		}
		return true;
	}

	public addGithubAuthToken(url: string): string {
		Log.info("TestGitHubActions::addGithubAuthToken(..)");
		return url;
	}

	public setPageSize(size: number): void {
		Log.info("TestGitHubActions::setPageSize(..)");
		return;
	}

	public makeComment(url: string, message: string): Promise<boolean> {
		Log.info("TestGitHubActions::makeComment(..)");
		return;
	}

	public simulateWebhookComment(projectName: string, sha: string, message: string): Promise<boolean> {
		Log.info("TestGitHubActions::simulateWebhookComment(..)");
		return;
	}

	public getTeamsOnRepo(repoId: string): Promise<GitTeamTuple[]> {
		return;
	}

	public async addBranchProtectionRule(repoId: string, rule: BranchRule): Promise<boolean> {
		return true;
	}

	public async makeIssue(repoId: string, issue: Issue): Promise<boolean> {
		return true;
	}
}
