import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import Util from "../../../../common/Util";

import {Repository, Team} from "../Types";
import {DatabaseController} from "./DatabaseController";
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
     * @param {boolean} shouldRelease; whether the student team should be added to the repo
     * @returns {Promise<boolean>}
     */
    provisionRepository(repoName: string, teams: Team[], sourceRepo: string, shouldRelease: boolean): Promise<boolean>;

    createPullRequest(repoName: string, prName: string): Promise<boolean>;

    getRepositoryUrl(repo: Repository): Promise<string>;

    getTeamUrl(team: Team): Promise<string>;
}

export interface GitTeamTuple {
    teamName: string;
    githubTeamNumber: number;
}

export class GitHubController implements IGitHubController {

    private readonly dbc = DatabaseController.getInstance();

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
        const WEBHOOKADDR = host + '/portal/githubWebhook';

        Log.info("GitHubController::createRepository( " + repoName + ", ...) - start");
        // Log.info("GitHubController::createRepository(..) - ");
        const startTime = Date.now();

        const gh = new GitHubActions();

        Log.trace("GitHubController::createRepository(..) - see if repo already exists");
        const repoVal = await gh.repoExists(repoName);
        if (repoVal === true) {
            // unable to create a repository if it already exists!
            Log.error("GitHubController::createRepository(..) - Error: Repository already exists;" +
                " unable to create a new repository");
            throw new Error("createRepository(..) failed; Repository " + repoName + " already exists.");
        }

        try {
            // create the repository
            Log.trace("GitHubController::createRepository() - create GitHub repo");
            const repoCreateVal = await gh.createRepo(repoName);
            Log.trace('GitHubController::createRepository(..) - success; repo: ' + repoCreateVal);
        } catch (err) {
            Log.error('GitHubController::createRepository(..) - create repo error: ' + err);
            // repo creation failed; remove if needed (requires createRepo be permissive if already exists)
            const res = await gh.deleteRepo(repoName);
            Log.info('GitHubController::createRepository(..) - repo removed: ' + res);
            throw new Error("createRepository(..) failed; Repository " + repoName + " creation failed; ERROR: " + err.message);
        }

        try {
            // still add staff team with push, just not students
            Log.trace("GitHubController::createRepository() - add staff team to repo");
            const staffTeamNumber = await gh.getTeamNumber('staff');
            Log.trace('GitHubController::createRepository(..) - staffTeamNumber: ' + staffTeamNumber);
            const staffAdd = await gh.addTeamToRepo(staffTeamNumber, repoName, 'admin');
            Log.trace('GitHubController::createRepository(..) - team name: ' + staffAdd.teamName);

            // add webhooks
            Log.trace("GitHubController::createRepository() - add webhook");
            const createHook = await gh.addWebhook(repoName, WEBHOOKADDR);
            Log.trace('GitHubController::createRepository(..) - webook successful: ' + createHook);

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
            Log.trace('GitHubController::createRepository(..) - import complete; success: ' + output);

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
     * @param {Repository} repo: The repository to be released. This must be in the datastore.
     * @param {Team[]} teams: The teams to be added. These must be in the datastore.
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
                    // TODO: check to see if Team exists in database; if not, fail
                    // (aka team objects must exist before they are provisioned)

                    // did not find a team, create one first
                    Log.info("GitHubController::releaseRepository(..) - did not find team, creating");
                    const newTeam = await gh.createTeam(team.id, "push");
                    Log.info("GitHubController::releaseRepository(..) - created team " +
                        "with #: " + newTeam.githubTeamNumber);

                    teamNum = newTeam.githubTeamNumber;
                    // add the students to the team
                    // const teamTuple: GitTeamTuple =
                    await gh.addMembersToTeam(team.id, teamNum, team.personIds);
                    Log.info("GitHubController::releaseRepository(..) - added members to team");
                    // TODO: this is what should really be happening here:
                    // const msg = "release failed; Team: \" + team.id + \" has not been created on GitHub";
                    // Log.error("GitHubController::releaseRepository(..) - "+msg);
                    // throw new Error("relaseRepository(..) failed; Team " + team.id + " should already exist on GitHub");
                }
                // now, add the team to the repository
                // const teamAdd =
                const res = await gh.addTeamToRepo(teamNum, repo.id, "push");
                if (res.githubTeamNumber > 0) {

                    // keep track of team addition
                    team.custom.githubAttached = true;
                    await this.dbc.writeTeam(team);
                }
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
                                     shouldRelease: boolean): Promise<boolean> {
        Log.info("GitHubController::provisionRepository( " + repoName + ", ...) - start");
        const dbc = DatabaseController.getInstance();

        const start = Date.now();

        if (teams.length < 1 || teams.length > 1) {
            Log.warn("GitHubController::provisionRepository(..) - only the first team will be added to the repo");
        }

        Log.trace("GitHubController::provisionRepository() - see if repo already exists");
        const gh = new GitHubActions();
        const repoExists = await gh.repoExists(repoName);
        Log.trace('GitHubController::provisionRepository(..) - repo exists: ' + repoExists);
        if (repoExists === true) {
            // this is fatal, we can't provision a repo that already exists
            Log.error("GitHubController::provisionRepository() - repo already exists on GitHub ( " +
                repoName + " ); provisioning failed");
            throw new Error("provisionRepository(..) failed; Repository " + repoName + " already exists.");
            // return false;
        }

        try {
            // create a repo
            Log.trace("GitHubController::provisionRepository() - create GitHub repo");
            const repoVal = await gh.createRepo(repoName);

            const repo = await dbc.getRepository(repoName);
            // NOTE: this isn't done here on purpose: we consider the repo to be provisioned once the whole flow is done
            // callers of this method should instead set the URL field
            // repo.URL = repoVal;
            repo.custom.githubCreated = true;
            await dbc.writeRepository(repo);

            Log.trace('GitHubController::provisionRepository(..) - repo: ' + repoVal);
        } catch (err) {
            Log.error('GitHubController::provisionRepository(..) - create repo error: ' + err);
            // repo creation failed; remove if needed (requires createRepo be permissive if already exists)
            const res = await gh.deleteRepo(repoName);
            Log.info('GitHubController::provisionRepository(..) - repo removed: ' + res);
            throw new Error("provisionRepository(..) failed; failed to creat repo; ERROR: " + err.message);
        }

        try {
            let teamValue = null;
            try {
                Log.trace("GitHubController::provisionRepository() - create GitHub team");
                for (const team of teams) {
                    teamValue = await gh.createTeam(team.id, 'push');
                    Log.trace('GitHubController::provisionRepository(..) createTeam: ' + teamValue.teamName);

                    if (teamValue.githubTeamNumber > 0) {
                        // worked
                        team.URL = teamValue.URL;
                        await dbc.writeTeam(team);
                    }

                    Log.trace("GitHubController::provisionRepository() - add members to GitHub team");
                    const addMembers = await gh.addMembersToTeam(teamValue.teamName, teamValue.githubTeamNumber, team.personIds);
                    Log.trace('GitHubController::provisionRepository(..) - addMembers: ' + addMembers.teamName);

                    if (shouldRelease === true) {
                        Log.trace("GitHubController::provisionRepository() - add team: " + teamValue.teamName + " to repo");
                        const teamAdd = await gh.addTeamToRepo(teamValue.githubTeamNumber, repoName, 'push');

                        if (teamAdd.githubTeamNumber > 0) {
                            // keep track of team addition
                            team.custom.githubAttached = true;
                            await dbc.writeTeam(team);
                        }

                        Log.trace('GitHubController::provisionRepository(..) - team name: ' + teamAdd.teamName);
                    } else {
                        // keep track of fact that team wasn't added to repo
                        team.custom.githubAttached = false;
                        await dbc.writeTeam(team);

                        Log.trace("GitHubController::provisionRepository() - team: " +
                            teamValue.teamName + " NOT added to repo (shouldRelease === false)");
                    }
                }
            } catch (err) {
                Log.warn("GitHubController::provisionRepository() - create team ERROR: " + err);
                // swallow these errors and keep going
            }

            Log.trace("GitHubController::provisionRepository() - add staff team to repo");
            const staffTeamNumber = await gh.getTeamNumber('staff');
            Log.trace('GitHubController::provisionRepository(..) - staffTeamNumber: ' + staffTeamNumber);
            const staffAdd = await gh.addTeamToRepo(staffTeamNumber, repoName, 'admin');
            Log.trace('GitHubController::provisionRepository(..) - team name: ' + staffAdd.teamName);

            // add webhooks
            const host = Config.getInstance().getProp(ConfigKey.backendUrl);
            const WEBHOOKADDR = host + '/portal/githubWebhook';
            Log.trace("GitHubController::provisionRepository() - add webhook to: " + WEBHOOKADDR);
            const createHook = await gh.addWebhook(repoName, WEBHOOKADDR);
            Log.trace('GitHubController::provisionRepository(..) - webook successful: ' + createHook);

            // perform import
            const c = Config.getInstance();
            const targetUrl = c.getProp(ConfigKey.githubHost) + '/' + c.getProp(ConfigKey.org) + '/' + repoName;

            Log.trace("GitHubController::provisionRepository() - importing project (slow)");
            const output = await gh.importRepoFS(importUrl, targetUrl);
            Log.trace('GitHubController::provisionRepository(..) - import complete; success: ' + output);

            Log.trace('GitHubController::provisionRepository(..) - successfully completed for: ' +
                repoName + '; took: ' + Util.took(start));

            return true;
        } catch (err) {
            Log.error('GitHubController::provisionRepository(..) - ERROR: ' + err);
        }
        return false;
    }

    public async createPullRequest(repoName: string, prName: string): Promise<boolean> {
        Log.error("GitHubController::createPullRequest(..) - NOT IMPLEMENTED");
        throw new Error("NOT IMPLEMENTED");
    }
}

/* istanbul ignore next */

// noinspection TsLint
export class TestGitHubController implements IGitHubController {

    public async getRepositoryUrl(repo: Repository): Promise<string> {
        Log.warn("TestGitHubController::getRepositoryUrl(..) - TEST");
        return "TestGithubController_URL";
    }

    public async getTeamUrl(team: Team): Promise<string> {
        Log.warn("TestGitHubController::getTeamUrl(..) - TEST");
        // const URL = this.gha.getTeamNumber()
        return "TestGithubController_TeamName";
    }

    public async provisionRepository(repoName: string,
                                     teams: Team[],
                                     sourceRepo: string): Promise<boolean> {
        Log.warn("TestGitHubController::provisionRepository(..) - TEST");
        return true;
    }

    public async createPullRequest(repoName: string, prName: string): Promise<boolean> {
        Log.warn("TestGitHubController::createPullRequest(..) - TEST");
        return true;
    }
}
