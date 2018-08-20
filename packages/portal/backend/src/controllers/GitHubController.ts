import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import Util from "../../../../common/Util";

import {Repository, Team} from "../Types";
import {GitHubActions} from "./GitHubActions";

export interface IGitHubController {
    /**
     * This is a complex method that provisions an entire repository.
     *
     * Assumptions: a 'staff' repo must also exist.
     *
     * @param {string} repoName
     * @param {Team[]} teams
     * @param {string} sourceRepo
     * @param {string} webhookAddress
     * @returns {Promise<boolean>}
     */
    provisionRepository(repoName: string, teams: Team[], sourceRepo: string, webhookAddress: string): Promise<boolean>;

    createPullRequest(repoName: string, prName: string): Promise<boolean>;

    getRepositoryUrl(repo: Repository): Promise<string>;

    getTeamUrl(team: Team): Promise<string>;
}

export interface GitTeamTuple {
    teamName: string;
    githubTeamNumber: number;
}

export class GitHubController implements IGitHubController {

    public async getRepositoryUrl(repo: Repository): Promise<string> {
        Log.info("GitHubController::GetRepositoryUrl - start");
        const c = Config.getInstance();
        const ghHost = c.getProp(ConfigKey.githubHost) + '/' + c.getProp(ConfigKey.org) + '/'; // valid .org use
        const url = ghHost + repo.id;
        Log.info("GitHubController::GetRepositoryUrl( " + repo.id + " ) - URL: " + url);
        return url;
    }

    public async getTeamUrl(team: Team): Promise<string> {
        const c = Config.getInstance();
        const teamUrl = c.getProp(ConfigKey.githubHost) + '/orgs/' + c.getProp(ConfigKey.org) + '/teams/' + team.id;
        Log.info("GitHubController::getTeamUrl( " + team.id + " ) - URL: " + teamUrl);
        return teamUrl;
    }

    /**
     * Creates the given repository on GitHub. Returns the Repository object when it is done (or null if it failed).
     *
     * Repository.URL should be set once the repo is created successfully
     * (this is how we can track that the repo exists on GitHub).
     *
     * @param {string} repoName: The name of the Repository
     * @param {string} importUrl: The repo it should be imported from (if null, no import should take place)
     * @param {string} path?: The subset of the importUrl repo that should be added to the root of the new repo.
     * If this is null, undefined, or '', the whole importUrl is imported.
     * @returns {Promise<boolean>}
     */
    public async createRepository(repoName: string, importUrl: string, path?: string): Promise<boolean> {
        const config = Config.getInstance();
        const host = config.getProp(ConfigKey.backendUrl);
        const port = config.getProp(ConfigKey.backendPort);
        const WEBHOOKADDR = host + ':' + port + '/portal/githubWebhook';

        Log.info("GitHubController::createRepository( " + repoName + ", ...) - start");
        // Log.info("GitHubController::createRepository(..) - ");
        const startTime = Date.now();
        try {
            const gh = new GitHubActions();

            try {
                Log.trace("GitHubController::createRepository(..) - see if repo already exists");
                const repoVal = await gh.repoExists(repoName);
                if (repoVal === true) {
                    // unable to create a repository if it already exists!
                    Log.error("GitHubController::createRepository(..) - Error: Repository already exists;" +
                        " unable to create a new repository");
                    return true;
                }
            } catch (err) {
                Log.error("GitHubController::createRepository(..) - Error: " + err);
                return false;
            }

            try {
                // create the repository
                Log.trace("GitHubController::createRepository() - create GitHub repo");
                const repoVal = await gh.createRepo(repoName);
                Log.trace('GHA::createRepository(..) - success; repo: ' + repoVal);
            } catch (err) {
                Log.error('GHA::createRepository(..) - create repo error: ' + err);
                // repo creation failed; remove if needed (requires createRepo be permissive if already exists)
                const res = await gh.deleteRepo(repoName);
                Log.info('GHA::createRepository(..) - repo removed: ' + res);

                return false;
            }

            // still add staff team with push, just not students
            Log.trace("GitHubController::createRepository() - add staff team to repo");
            const staffTeamNumber = await gh.getTeamNumber('staff');
            Log.trace('GHA::createRepository(..) - staffTeamNumber: ' + staffTeamNumber);
            const staffAdd = await gh.addTeamToRepo(staffTeamNumber, repoName, 'admin');
            Log.trace('GHA::createRepository(..) - team name: ' + staffAdd.teamName);

            // add webhooks
            Log.trace("GitHubController::createRepository() - add webhook");
            const createHook = await gh.addWebhook(repoName, WEBHOOKADDR);
            Log.trace('GHA::createRepository(..) - webook successful: ' + createHook);

            // perform import
            const c = Config.getInstance();
            const targetUrl = c.getProp(ConfigKey.githubHost) + '/' + c.getProp(ConfigKey.org) + '/' + repoName;

            Log.trace("GitHubController::createRepository() - importing project (slow)");
            let output;
            if (path) {
                output = await gh.importRepoFS(importUrl, targetUrl, path);
            } else {
                output = await gh.importRepoFS(importUrl, targetUrl);
            }
            Log.trace('GHA::createRepository(..) - import complete; success: ' + output);

            Log.trace('GithubController::createRepository(..) - successfully completed for: ' +
                repoName + '; took: ' + Util.took(startTime));

            return true;
        } catch (err) {
            Log.error('GithubController::createRepository(..) - ERROR: ' + err);
            return false;
        }
    }

    /**
     * Releases a repository to a team.
     *
     * @param {Repository} repo: The repository to be released.
     * @param {Team[]} teams: The teams to be added.
     * @param {boolean} asCollaborators: Whether the team members should be added as a collaborators
     * or whether a GitHub team should be created for them.
     * @returns {Promise<Repository | null>}
     */
    public async releaseRepository(repo: Repository,
                                   teams: Team[],
                                   asCollaborators: boolean = false): Promise<boolean> {
        Log.info("GitHubController::releaseRepository( {" + repo.id + ", ...}, ...) - start");

        const gh = new GitHubActions();

        for (const team of teams) {
            if (asCollaborators) {
                Log.info("GitHubController::releaseRepository(..) - releasing repository as " +
                    "individual collaborators");
                Log.error("GitHubController::releaseRepository(..) - ERROR: Not implemented");
                throw new Error("GitHubController - w/ collaborators NOT IMPLEMENTED");
            } else {
                // using GithubTeams
                // see if the team exists
                let teamNum = await gh.getTeamNumber(team.id);
                if (teamNum === -1) {
                    // did not find a team, create one first
                    Log.info("GitHubController::releaseRepository(..) - did not find team, creating");
                    const newTeam = await gh.createTeam(team.id, "push");
                    Log.info("GitHubController::releaseRepository(..) - created team " +
                        "with #: " + newTeam.githubTeamNumber);

                    teamNum = newTeam.githubTeamNumber;
                    // add the students to the team
                    const teamTuple: GitTeamTuple = await gh.addMembersToTeam(team.id, teamNum, team.personIds);
                    Log.info("GitHubController::releaseRepository(..) - added members to team");

                }
                // now, add the team to the repository
                const teamAdd = await gh.addTeamToRepo(teamNum, repo.id, "push");
                Log.info("GitHubController::releaseRepository(..) - added team (" + team.id + "" +
                    ") with push permissions to repository (" + repo.id + ")");
            }
        }

        Log.info("GitHubController::releaseRepository(..) - finish");
        return true;
    }

    public async provisionRepository(repoName: string,
                                     teams: Team[],
                                     importUrl: string,
                                     webhookAddress: string): Promise<boolean> {
        Log.info("GitHubController::provisionRepository( " + repoName + ", ...) - start");
        const start = Date.now();
        try {
            const gh = new GitHubActions();

            if (teams.length < 1 || teams.length > 1) {
                Log.warn("GitHubController::provisionRepository(..) - only the first team will be added to the repo");
            }

            try {
                Log.trace("GitHubController::provisionRepository() - see if repo already exists");
                const repoVal = await gh.repoExists(repoName);
                Log.trace('GHA::provisionRepository(..) - repo exists: ' + repoVal);
                if (repoVal === true) {
                    // this is fatal, we can't provision a repo that already exists
                    Log.error("GitHubController::provisionRepository() - repo already exists; provisioning failed");
                    return false;
                }
            } catch (err) {
                Log.error("GitHubController::provisionRepository() - repo already exists; ERROR: " + err);
                return false;
            }

            try {
                // create a repo
                Log.trace("GitHubController::provisionRepository() - create GitHub repo");
                const repoVal = await gh.createRepo(repoName);
                Log.trace('GHA::provisionRepository(..) - repo: ' + repoVal);
                // expect(repoVal).to.equal('https://github.com/SECapstone/' + Test.REPONAME1);
            } catch (err) {
                Log.error('GHA::provisionRepository(..) - create repo error: ' + err);
                // repo creation failed; remove if needed (requires createRepo be permissive if already exists)
                const res = await gh.deleteRepo(repoName);
                Log.info('GHA::provisionRepository(..) - repo removed: ' + res);
                return false;
            }

            let teamValue = null;
            try {
                Log.trace("GitHubController::provisionRepository() - create GitHub team");
                for (const team of teams) {
                    teamValue = await gh.createTeam(team.id, 'push');
                    Log.trace('GHA::provisionRepository(..) createTeam: ' + teamValue.teamName);

                    Log.trace("GitHubController::provisionRepository() - add members to GitHub team");
                    const addMembers = await gh.addMembersToTeam(teamValue.teamName, teamValue.githubTeamNumber, team.personIds);
                    Log.trace('GHA::provisionRepository(..) - addMembers: ' + addMembers.teamName);

                    Log.trace("GitHubController::provisionRepository() - add team to repo");
                    const teamAdd = await gh.addTeamToRepo(teamValue.githubTeamNumber, repoName, 'push');
                    Log.trace('GHA::provisionRepository(..) - team name: ' + teamAdd.teamName);
                }
            } catch (err) {
                Log.error("GitHubController::provisionRepository() - create team ERROR: " + err);
            }

            Log.trace("GitHubController::provisionRepository() - add staff team to repo");
            const staffTeamNumber = await gh.getTeamNumber('staff');
            Log.trace('GHA::provisionRepository(..) - staffTeamNumber: ' + staffTeamNumber);
            const staffAdd = await gh.addTeamToRepo(staffTeamNumber, repoName, 'admin');
            Log.trace('GHA::provisionRepository(..) - team name: ' + staffAdd.teamName);

            // add webhooks
            Log.trace("GitHubController::provisionRepository() - add webhook");
            const createHook = await gh.addWebhook(repoName, webhookAddress);
            Log.trace('GHA::provisionRepository(..) - webook successful: ' + createHook);

            // perform import
            const c = Config.getInstance();
            const targetUrl = c.getProp(ConfigKey.githubHost) + '/' + c.getProp(ConfigKey.org) + '/' + repoName;

            Log.trace("GitHubController::provisionRepository() - importing project (slow)");
            const output = await gh.importRepoFS(importUrl, targetUrl);
            Log.trace('GHA::provisionRepository(..) - import complete; success: ' + output);

            Log.trace('GHA::provisionRepository(..) - successfully completed for: ' +
                repoName + '; took: ' + Util.took(start));
            return true;
        } catch (err) {
            Log.error('GitHubController::provisionRepository(..) - ERROR: ' + err);
        }
        return false;
    }

    public async createPullRequest(repoName: string, prName: string): Promise<boolean> {
        Log.error("GitHubController::createPullRequest(..) - NOT IMPLEMENTED");
        return false;
    }
}

export class TestGitHubController implements IGitHubController {

    public async getRepositoryUrl(repo: Repository): Promise<string> {
        Log.error("TestGitHubController::getRepositoryUrl(..) - NOT IMPLEMENTED");
        return "TODO";
    }

    public async getTeamUrl(team: Team): Promise<string> {
        Log.error("TestGitHubController::getTeamUrl(..) - NOT IMPLEMENTED");
        // const URL = this.gha.getTeamNumber()
        return "TODO";
    }

    public async provisionRepository(repoName: string,
                                     teams: Team[],
                                     sourceRepo: string,
                                     webhookAddress: string): Promise<boolean> {
        Log.error("TestGitHubController::provisionRepository(..) - NOT IMPLEMENTED");
        return true;
    }

    public async createPullRequest(repoName: string, prName: string): Promise<boolean> {
        Log.error("TestGitHubController::createPullRequest(..) - NOT IMPLEMENTED");
        return true;
    }
}
