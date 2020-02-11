import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import Util from "../../../common/Util";
import {GitHubActions} from "../src/controllers/GitHubActions";
import {TeamController} from "../src/controllers/TeamController";

/**
 * DANGER: You almost certainly do not use this file.
 *
 * This is an executable for munging GitHub orgs and the classy backend database. It will
 * delete database objects _AND_ their corresponding Github pieces resulting in unrecoverable
 * data loss.
 *
 * I'd really recommend closing this file now. Doing the wrong thing will ruin your
 * _whole_ day. And that's probably underestimating things.
 */
export class GitHubCleaner {

    private gha = GitHubActions.getInstance(true);
    private tc = new TeamController();

    private DRY_RUN = true;

    constructor() {
        Log.info("GitHubCleaner::<init> - start");
        const config = Config.getInstance();

        Log.warn("GitHubCleaner::<init> - ORGNAME: " + config.getProp(ConfigKey.org));

        if (config.getProp(ConfigKey.org) !== config.getProp(ConfigKey.testorg)) {
            Log.error("GitHubCleaner::<init> - org is not the test org. You probably REALLY REALLY do not want to do this");
            this.DRY_RUN = true; // force back to dry run
        }
    }

    public async run(): Promise<void> {

        await this.cleanTeams();
        await this.cleanRepositories();
    }

    private async cleanTeams(): Promise<void> {
        Log.info("GitHubCleaner::cleanTeams() - start");

        const TEAMS_TO_KEEP = ['admin', 'staff', 'testrunners', 'students'];
        TEAMS_TO_KEEP.push(TeamController.ADMIN_NAME, TeamController.STAFF_NAME);
        const teams = await this.gha.listTeams();
        const teamsToRemove = [];
        for (const team of teams) {
            if (TEAMS_TO_KEEP.indexOf(team.teamName) >= 0) {
                Log.info("GitHubCleaner::cleanTeams() - team to KEEP: " + team.teamName);
            } else {
                Log.info("GitHubCleaner::cleanTeams() - team to CLEAN: " + team.teamName);
                teamsToRemove.push(team);
            }
        }

        if (this.DRY_RUN === false) {
            Log.info("GitHubCleaner::cleanTeams() - DRY_RUN === false");
            for (const team of teamsToRemove) {
                Log.info("GitHubCleaner::cleanTeams() - removing: " + team.teamName);
                const teamNum = await this.tc.getTeamNumber(team.teamName); // await this.gha.getTeamNumber(team.teamName);
                await this.gha.deleteTeam(teamNum);
                Log.info("GitHubCleaner::cleanTeams() - done removing: " + team.teamName);
            }
        }

        Log.info("GitHubCleaner::cleanTeams() - done");
    }

    private async cleanRepositories(): Promise<void> {
        Log.info("GitHubCleaner::cleanRepositories() - start");

        const REPOS_TO_KEEP = ['PostTestDoNotDelete', 'PostTestDoNotDelete1'];

        const reposToRemove = [];
        const repos = await this.gha.listRepos();
        for (const repo of repos) {
            if (REPOS_TO_KEEP.indexOf(repo.repoName) >= 0) {
                Log.info("GitHubCleaner::cleanRepositories() - repo to KEEP: " + repo.repoName);
            } else {
                Log.info("GitHubCleaner::cleanRepositories() - repo to CLEAN: " + repo.repoName);
                reposToRemove.push(repo);
            }
        }

        if (this.DRY_RUN === false) {
            Log.info("GitHubCleaner::cleanRepositories() - DRY_RUN === false");
            for (const repo of reposToRemove) {
                Log.info("GitHubCleaner::cleanRepositories() - removing: " + repo.repoName);
                await this.gha.deleteRepo(repo.repoName);
                Log.info("GitHubCleaner::cleanRepositories() - done removing: " + repo.repoName);
            }
        }

        Log.info("GitHubCleaner::cleanRepositories() - done");
    }

}

const ghc = new GitHubCleaner();
const start = Date.now();
ghc.run().then(function() {
    Log.info("GitHubCleaner::validate() - complete; took: " + Util.took(start));
}).catch(function(err) {
    Log.error("GitHubCleaner::validate() - ERROR: " + err.message);
    process.exit();
});
