import * as crypto from "crypto";
import * as parseLinkHeader from "parse-link-header";
import fetch, {RequestInit} from "node-fetch";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import Util from "@common/Util";

import {Factory} from "../Factory";
import {DatabaseController} from "./DatabaseController";
import {BranchRule, GitPersonTuple, GitRepoTuple, GitTeamTuple, Issue} from "./GitHubController";
import {TeamController} from "./TeamController";

// tslint:disable-next-line
const tmp = require("tmp-promise");
tmp.setGracefulCleanup(); // cleanup files when done

export interface IGitHubActions {

    /**
     * Paging page size. For testing only.
     *
     * @param {number} size
     */
    setPageSize(size: number): void;

    /**
     * Creates a given repo and returns its URL. If the repo exists, return the URL for that repo.
     *
     * Also updates the Repository object in the datastore with the URL and cloneURL.
     *
     * @param repoName The name of the repo. Must be unique within the organization.
     * @returns {Promise<string>} provisioned repo URL
     */
    createRepo(repoName: string): Promise<string>;

    /**
     * Creates a repo from a template and returns its URL. If the repo exists, return the URL for that repo.
     *
     * @param repoName The name of the repo. Must be unique within the organization.
     * @param templateOwner The org/owner of the template repo.
     * @param templateRepo The name of the template repo. Must be readable by the bot user.
     */
    createRepoFromTemplate(repoName: string, templateOwner: string, templateRepo: string): Promise<string>;

    /**
     * Deletes a repo from the organization.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    deleteRepo(repoName: string): Promise<boolean>;

    /**
     * Checks if a repo exists or not. If the request fails for _ANY_ reason
     * the failure will not be reported, only that the repo does not exist.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    repoExists(repoName: string): Promise<boolean>;

    /**
     * Deletes a team.
     *
     * NOTE: this used to take a number, but GitHub deprecated this API:
     * https://developer.github.com/changes/2020-01-21-moving-the-team-api-endpoints/
     *
     * @param teamName string
     * @returns {Promise<boolean>}
     */
    deleteTeam(teamName: string): Promise<boolean>;

    /**
     * Gets all repos in an org.
     *
     * @returns {Promise<{GitRepoTuple}[]>}
     */
    listRepos(): Promise<GitRepoTuple[]>;

    /**
     * Gets all people in an org.
     *
     * @returns {Promise<GitPersonTuple[]>}
     * this is just a subset of the return, but it is the subset we actually use
     */
    listPeople(): Promise<GitPersonTuple[]>;

    /**
     * Lists the teams for the current org.
     *
     * NOTE: this is a slow operation (if there are many teams) so try not to do it too much!
     *
     * @returns {Promise<{GitTeamTuple}[]>}
     */
    listTeams(): Promise<GitTeamTuple[]>;

    /**
     * Lists the GitHub IDs of members for a teamName (e.g. students).
     *
     * @param {string} teamName
     * @returns {Promise<string[]>} // list of githubIds
     */
    listTeamMembers(teamName: string): Promise<string[]>;

    listWebhooks(repoName: string): Promise<Array<{}>>;

    updateWebhook(repoName: string, webhookEndpoint: string): Promise<boolean>;

    addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean>;

    /**
     * Creates a GitHub team (e.g., cpsc310_team1).
     *
     * @param teamName
     * @param permission "admin", "pull", "push" // admin for staff, push for students
     * @returns {Promise<GitTeamTuple>}
     */
    createTeam(teamName: string, permission: string): Promise<GitTeamTuple>;

    /**
     * Add a list of GitHub members (their usernames) to a given team.
     *
     * @param teamName
     * @param memberGithubIds github usernames
     * @returns {Promise<GitTeamTuple>}
     */
    addMembersToTeam(teamName: string, memberGithubIds: string[]): Promise<GitTeamTuple>;

    /**
     * Removes a list of GitHub members (their usernames) from a given team.
     *
     * @param teamName
     * @param memberGithubIds github usernames
     * @returns {Promise<GitTeamTuple>}
     */
    removeMembersFromTeam(teamName: string, memberGithubIds: string[]): Promise<GitTeamTuple>;

    /**
     * Add a team to a repo.
     *
     * @param {string} teamName
     * @param {string} repoName
     * @param permission ("pull", "push", "admin")
     * @returns {Promise<GitTeamTuple>}
     */
    addTeamToRepo(teamName: string, repoName: string, permission: string): Promise<GitTeamTuple>;

    /**
     * Gets the internal number for a team.
     *
     * Returns -1 if the team does not exist.
     *
     * @param teamName
     * @returns {Promise<number>}
     */
    getTeamNumber(teamName: string): Promise<number>;

    /**
     * Gets the list of users on a team.
     *
     * NOTE: this used to take a number, but GitHub changed the team API in 2020.
     * https://developer.github.com/changes/2020-01-21-moving-the-team-api-endpoints/
     *
     * Returns [] if the team does not exist or nobody is on the team.
     *
     * @param {string} teamName
     * @returns {Promise<string[]>}
     */
    getTeamMembers(teamName: string): Promise<string[]>;

    isOnAdminTeam(userName: string): Promise<boolean>;

    isOnStaffTeam(userName: string): Promise<boolean>;

    isOnTeam(teamName: string, userName: string): Promise<boolean>;

    importRepoFS(importRepo: string, studentRepo: string, seedFilePath?: string): Promise<boolean>;

    addGithubAuthToken(url: string): string;

    /**
     * Adds a file with the data given, to the specified repository.
     * If force is set to true, will overwrite old files.
     *
     * @param repoURL - name of repository
     * @param fileName - name of file to write
     * @param fileContent - the content of the file to write to repo
     * @param force - allow for overwriting of old files
     * @returns {Promise<boolean>} - true if write was successful
     */
    writeFileToRepo(repoURL: string, fileName: string, fileContent: string, force?: boolean): Promise<boolean>;

    /**
     * Changes permissions for all teams for the given repository.
     *
     * @param repoName
     * @param permissionLevel - one of: "push" "pull"
     * @returns {Promise<boolean>}
     */
    setRepoPermission(repoName: string, permissionLevel: string): Promise<boolean>;

    /**
     * Makes a comment on a commit.
     *
     * @param {string} url
     * @param {string} message any text would work, but markdown is best
     * @returns {Promise<boolean>}
     */
    makeComment(url: string, message: string): Promise<boolean>;

    /**
     * Simulates a comment as if it were received by a webhook (for silently invoking AutoTest).
     *
     * @param projectName
     * @param sha
     * @param message
     * @returns {Promise<boolean>}
     */
    simulateWebhookComment(projectName: string, sha: string, message: string): Promise<boolean>;

    /**
     * Returns a list of teams on a repo.
     *
     * @param  repoId
     * @returns {Promise<GitTeamTuple[]>}
     */
    getTeamsOnRepo(repoId: string): Promise<GitTeamTuple[]>;

    getTeamByName(teamName: string): Promise<GitTeamTuple | null>;

    getTeam(teamNumber: number): Promise<GitTeamTuple | null>;

    addBranchProtectionRule(repoId: string, rule: BranchRule): Promise<boolean>;

    makeIssue(repoId: string, issue: Issue): Promise<boolean>;

    /**
     * Lists the branches in a repo.
     *
     * This is used mainly to detect an incomplete provisioned repo (the repo may return with getRepo, but it will have no branches).
     *
     * @param repoId
     * @returns {Promise<string[]} If [], the repo may not be fully provisioned yet.
     */
    listRepoBranches(repoId: string): Promise<string[]>;

    /**
     * Deletes all branches in a repo except for the ones listed in branchesToKeep.
     *
     * @param repoId
     * @param branchesToKeep Must be an array of at least one branch name that already exists on the repo
     * @returns {Promise<boolean>} true if the only remaining branches are the ones listed in branchesToKeep
     */
    deleteBranches(repoId: string, branchesToKeep: string[]): Promise<boolean>;

    /**
     * Renames a branch in a repo.
     *
     * @param repoId
     * @param oldName This branch must exist.
     * @param newName
     * @returns {Promise<boolean>} true if the old branch existed and was successfully updated to the new name
     */
    renameBranch(repoId: string, oldName: string, newName: string): Promise<boolean>;
}

export class GitHubActions implements IGitHubActions {

    private readonly apiPath: string | null = null;
    private readonly gitHubUserName: string | null = null;
    private readonly gitHubAuthToken: string | null = null;
    private readonly org: string | null = null;

    // private LONG_PAUSE = 5000; // was deployed previously
    // private SHORT_PAUSE = 1000;

    /**
     * Page size for requests. Should be a constant, but using a
     * variable is handy for testing pagination.
     *
     * 100 is the GitHub maximum, and is the best value for production.
     * 10 or less is ignored, but this lower value is handy for testing.
     *
     * @private
     */
    private pageSize = 100;

    private dc: DatabaseController = null;

    private constructor() {
        Log.trace("GitHubActions::<init>");
        // NOTE: this is not very controllable; these would be better as params
        this.org = Config.getInstance().getProp(ConfigKey.org);
        this.apiPath = Config.getInstance().getProp(ConfigKey.githubAPI);
        this.gitHubUserName = Config.getInstance().getProp(ConfigKey.githubBotName);
        this.gitHubAuthToken = Config.getInstance().getProp(ConfigKey.githubBotToken);
        this.dc = DatabaseController.getInstance();
        Log.trace("GitHubActions::<init> - url: " + this.apiPath + "/" + this.org);
    }

    private static instance: IGitHubActions = null;

    public static getInstance(forceReal?: boolean): IGitHubActions {

        // Sometimes we will want to run against the full live GitHub suite
        // const override = true; // NOTE: should be commented out for commits; runs full GitHub suite
        // const override = true; // NOTE: should NOT be commented out for commits

        if (Factory.OVERRIDE === true) { // poor form to have a dependency into test code here
            Log.trace("GitHubActions::getInstance(..) - forcing real (OVERRIDE == true)");
            forceReal = true;
        }
        if (typeof forceReal === "undefined") {
            forceReal = false;
        }

        // if we"re on CI, still run the whole thing
        const ci = process.env.CI;
        if (typeof ci !== "undefined" && Util.toBoolean(ci) === true) {
            forceReal = true;
        }

        // NOTE: this is bad form, but we want to make sure we always return the real thing in production
        // this detects the mocha testing environment
        const isInTest = typeof (global as any).it === "function";
        if (isInTest === false) {
            // we"re in prod, always return the real thing
            Log.trace("GitHubActions::getInstance(.. ) - prod; returning GitHubActions");
            return new GitHubActions();
        }

        if (forceReal === true) {
            Log.test("GitHubActions::getInstance( true ) - returning live GitHubActions");
            return new GitHubActions(); // do not need to cache this since it is backed by GitHub instead of an in-memory cache
        }

        if (GitHubActions.instance === null) {
            // TODO: having this test dependency in prod code is poor
            const {TestGitHubActions} = require("../../test/controllers/TestGitHubActions");
            GitHubActions.instance = new TestGitHubActions();
        }

        Log.test("GitHubActions::getInstance() - returning cached TestGitHubActions");
        return GitHubActions.instance;
    }

    public setPageSize(size: number) {
        this.pageSize = size;
    }

    /**
     * Creates a given repo and returns its URL. If the repo exists, return the URL for that repo.
     *
     * Also updates the Repository object in the datastore with the URL and cloneURL.
     *
     * @param repoName The name of the repo. Must be unique within the organization.
     * @returns {Promise<string>} provisioned team URL
     */
    public async createRepo(repoName: string): Promise<string> {
        const start = Date.now();
        try {
            Log.info("GitHubAction::createRepo( " + repoName + " ) - start");
            await GitHubActions.checkDatabase(repoName, null);

            const uri = this.apiPath + "/orgs/" + this.org + "/repos";
            const options: RequestInit = {
                method: "POST",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    name: repoName,
                    // In Dev and Test, Github free Org Repos cannot be private.
                    private: true,
                    has_issues: true,
                    has_wiki: false,
                    has_downloads: false,
                    // squash merging does not use ff causing branch problems in autotest
                    allow_squash_merge: false,
                    // rebase merging does not use ff causing branch problems in autotest
                    allow_rebase_merge: false,
                    merge_commit_title: "PR_TITLE",
                    merge_commit_message: "PR_BODY",
                    auto_init: false
                })
            };

            Log.info("GitHubAction::createRepo( " + repoName + " ) - making request");
            const response = await fetch(uri, options);
            const body = await response.json();
            Log.info("GitHubAction::createRepo( " + repoName + " ) - request complete");
            const url = body.html_url;

            Log.trace("GitHubAction::createRepo( " + repoName + " ) - db start");
            const repo = await this.dc.getRepository(repoName);
            repo.URL = url; // only update this field in the existing Repository record
            repo.cloneURL = body.clone_url; // only update this field in the existing Repository record
            await this.dc.writeRepository(repo);
            Log.trace("GitHubAction::createRepo( " + repoName + " ) - db done");

            Log.info("GitHubAction::createRepo(..) - success; URL: " + url + "; took: " + Util.took(start));

            // would prefer to avoid this long pause
            // try a more dynamic approach below; this works for template repos, but has not been verified for normal repos
            // await Util.delay(this.LONG_PAUSE);

            // listing branches is not sufficient because they are often [] for an initial repo
            // whether listing teams is sufficient has not been tested in prod yet (23W2)
            let doesNotExist = true;
            let existCount = 0; // only try 10 times to avoid spinning forever
            while (doesNotExist && existCount < 10) {
                Log.info("GitHubAction::createRepo(..) - checking if repo is ready");
                const repoData = await this.getTeamsOnRepo(repoName);
                Log.info("GitHubAction::createRepo(..) - repoData: " + JSON.stringify(repoData));
                if (repoData !== null) {
                    Log.info("GitHubAction::createRepo(..) - repo is ready");
                    doesNotExist = false;
                } else {
                    Log.info("GitHubAction::createRepo(..) - repo is NOT ready");
                    existCount++;
                    await Util.delay(250); // wait a bit longer
                }
            }

            Log.info("GitHubAction::createRepo(..) - success; URL: " + url + "; total creation took: " + Util.took(start));

            return url;
        } catch (err) {
            Log.error("GitHubAction::createRepo(..) - ERROR: " + err);
            throw new Error("Repository not created; " + err.message);
        }
    }

    /**
     * Creates a repo from a template and returns its URL. If the repo exists, return the URL for that repo.
     * The template repo _must_ have a branch for this to work (essentially it cannot be a completely empty repo).
     * If you want a completely empty repo, just use createRepo instead.
     *
     * @param repoName
     * @param templateOwner The org / owner of the template repo
     * @param templateRepo The repo to use as a template. (both owner (org) and repo name are required)
     * @returns {Promise<string>} provisioned repo URL
     */
    public async createRepoFromTemplate(repoName: string, templateOwner: string, templateRepo: string): Promise<string> {
        const start = Date.now();
        try {
            Log.info("GitHubAction::createRepoFromTemplate( " + repoName + ", " + templateOwner + ", " + templateRepo + " ) - start");
            await GitHubActions.checkDatabase(repoName, null);

            const uri = this.apiPath + "/repos/" + templateOwner + "/" + templateRepo + "/generate";
            // const uri = this.apiPath + "/orgs/" + this.org + "/repos/" + templateOwner + "/" + templateRepo + "/generate";
            const options: RequestInit = {
                method: "POST",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28"
                },
                body: JSON.stringify({
                    include_all_branches: true, // include all branches, will be post-processed after creation
                    owner: this.org,
                    name: repoName,
                    // In Dev and Test, Github free Org Repos cannot be private.
                    private: true
                })
            };

            Log.info("GitHubAction::createRepoFromTemplate( " + repoName + " ) - making request");
            Log.trace("GitHubAction::createRepoFromTemplate( " + repoName + " ) - URL: " + uri + "; options: " + JSON.stringify(options));
            const response = await fetch(uri, options);
            const body = await response.json();
            Log.info("GitHubAction::createRepoFromTemplate( " + repoName + " ) - request complete");
            Log.trace("GitHubAction::createRepoFromTemplate( " + repoName + " ) - request complete; body: " + JSON.stringify(body));
            if (typeof body.html_url === "undefined" || body.html_url.length < 5) {
                Log.error("GitHubAction::createRepoFromTemplate( " + repoName + " ) - repo not created; ERROR: " + JSON.stringify(body));
                throw new Error("Is the import repo (" + templateOwner + "/" + templateRepo +
                    ") configured in GitHub as a template repository?");
            }
            const url = body.html_url;

            Log.trace("GitHubAction::createRepoFromTemplate( " + repoName + " ) - db start");
            const repo = await this.dc.getRepository(repoName);
            repo.URL = url; // only update this field in the existing Repository record
            repo.cloneURL = body.clone_url; // only update this field in the existing Repository record
            await this.dc.writeRepository(repo);
            Log.trace("GitHubAction::createRepoFromTemplate( " + repoName + " ) - db done");
            Log.info("GitHubAction::createRepoFromTemplate(..) - success; URL: " + url + "; took: " + Util.took(start));

            let doesNotExist = true;
            let existCount = 0; // only try 10 times to avoid spinning forever
            while (doesNotExist && existCount < 10) {
                Log.info("GitHubAction::createRepoFromTemplate(..) - checking if repo is ready");
                const repoBranches = await this.listRepoBranches(repoName);
                if (repoBranches !== null && repoBranches.length > 0) {
                    Log.info("GitHubAction::createRepoFromTemplate(..) - repo is ready");
                    doesNotExist = false;
                } else {
                    Log.info("GitHubAction::createRepoFromTemplate(..) - repo is NOT ready");
                    existCount++;
                    await Util.delay(250); // wait a bit longer
                }
            }

            Log.info("GitHubAction::createRepoFromTemplate(..) - success; URL: " + url + "; total creation took: " + Util.took(start));

            return url;
        } catch (err) {
            Log.error("GitHubAction::createRepoFromTemplate(..) - ERROR: " + err);
            throw new Error("Repository not created; " + err.message);
        }
    }

    /**
     * Deletes a repo from the organization.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    public async deleteRepo(repoName: string): Promise<boolean> {
        Log.info("GitHubAction::deleteRepo( " + this.org + ", " + repoName + " ) - start");
        const start = Date.now();

        try {
            // first make sure the repo exists
            const repoExists = await this.repoExists(repoName);

            if (repoExists === true) {
                const uri = this.apiPath + "/repos/" + this.org + "/" + repoName;
                Log.trace("GitHubAction::deleteRepo( " + repoName + " ) - URI: " + uri);
                const options: RequestInit = {
                    method: "DELETE",
                    headers: {
                        "Authorization": this.gitHubAuthToken,
                        "User-Agent": this.gitHubUserName,
                        "Accept": "application/json"
                    }
                };

                await fetch(uri, options);
                Log.info("GitHubAction::deleteRepo( " + repoName + " ) - successfully deleted; took: " + Util.took(start));
                return true;
            } else {
                Log.info("GitHubAction::deleteRepo( " + repoName + " ) - repo does not exist, not deleting; took: " + Util.took(start));
                return false;
            }
        } catch (err) {
            // jut warn because 404 throws an error
            Log.warn("GitHubAction::deleteRepo(..) - ERROR: " + err.message);
            return false;
        }
    }

    /**
     * Checks if a repo exists or not. If the request fails for _ANY_ reason the failure will not
     * be reported, only that the repo does not exist.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    public async repoExists(repoName: string): Promise<boolean> {

        const start = Date.now();
        const uri = this.apiPath + "/repos/" + this.org + "/" + repoName;
        const options: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/json"
            }
        };

        const res = await fetch(uri, options);
        if (res.status === 404) {
            Log.trace("GitHubAction::repoExists( " + repoName + " ) - false; took: " + Util.took(start));
            return false;
        }
        Log.trace("GitHubAction::repoExists( " + repoName + " ) - true; took: " + Util.took(start));
        return true;
    }

    /**
     * Deletes a team from GitHub. Does _NOT_ modify the Team object in the database.
     * NOTE: this used to take a teamId: number, but GitHub deprecated this API:
     * https://developer.github.com/changes/2020-01-21-moving-the-team-api-endpoints/
     *
     * NOTE: if you are deleting the "admin", "staff", or "students" teams, you are doing something terribly wrong.
     *
     * @param teamName name of the team to delete
     */
    public async deleteTeam(teamName: string): Promise<boolean> {

        try {
            const start = Date.now();
            Log.info("GitHubAction::deleteTeam( " + teamName + " ) - start");

            if (teamName === null) {
                throw new Error("GitHubAction::deleteTeam( null ) - null team requested");
            }

            if (teamName === null || teamName.length < 1) {
                Log.info("GitHubAction::deleteTeam( " + teamName + " ) - team does not exist, not deleting; took: " + Util.took(start));
                return false;
            }

            // DELETE /orgs/:org/teams/:team_slug
            const uri = this.apiPath + "/orgs/" + this.org + "/teams/" + teamName;
            const options: RequestInit = {
                method: "DELETE",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    "Accept": "application/vnd.github.hellcat-preview+json"
                }
            };

            const response = await fetch(uri, options);
            // Log.info("GitHubAction::deleteTeam(..) - response: " + response);

            if (response.status === 204) {
                Log.info("GitHubAction::deleteTeam(..) - success; took: " + Util.took(start));
                return true;
            } else {
                Log.info("GitHubAction::deleteTeam(..) - not deleted; code: " + response.status + "; took: " + Util.took(start));
                return false;
            }

        } catch (err) {
            // just warn because 404 throws an error like this
            Log.warn("GitHubAction::deleteTeam(..) - failed; ERROR: " + err.message);
            return false;
        }
    }

    /**
     * Gets all repos in an org.
     * This is just a subset of the return, but it is the subset we actually use:
     * @returns {Promise<GitRepoTuple[]}
     */
    public async listRepos(): Promise<GitRepoTuple[]> {
        Log.info("GitHubActions::listRepos(..) - start");
        const start = Date.now();

        // per_page max is 100; 10 is useful for testing pagination though
        const uri = this.apiPath + "/orgs/" + this.org + "/repos?per_page=" + this.pageSize;
        Log.trace("GitHubActions::listRepos(..) - URI: " + uri);
        const options: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/json"
            }
        };

        const raw: any = await this.handlePagination(uri, options);

        const rows: GitRepoTuple[] = [];
        for (const entry of raw) {
            const id = entry.id;
            const name = entry.name;
            const url = entry.html_url;
            rows.push({repoName: name, githubRepoNumber: id, url: url});
        }

        Log.info("GitHubActions::listRepos(..) - done; # repos: " + rows.length + "; took: " + Util.took(start));

        return rows;
    }

    /**
     * Gets all people in an org.
     *
     * @returns {Promise<{ id: number, type: string, url: string, name: string }[]>}
     * this is just a subset of the return, but it is the subset we actually use
     */
    public async listPeople(): Promise<GitPersonTuple[]> {
        Log.info("GitHubActions::listPeople(..) - start");
        const start = Date.now();

        // GET /orgs/:org/members
        const uri = this.apiPath + "/orgs/" + this.org + "/members?per_page=" + this.pageSize;
        const options: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/json"
            }
        };

        const raw: any = await this.handlePagination(uri, options);

        const rows: GitPersonTuple[] = [];
        for (const entry of raw) {
            const id = entry.id;
            const url = entry.html_url;
            const githubId = entry.login;
            rows.push({githubId: githubId, githubPersonNumber: id, url: url});
        }

        Log.info("GitHubActions::listPeople(..) - done; # people: " + rows.length + "; took: " + Util.took(start));
        return rows;
    }

    private async handlePagination(uri: string, options: RequestInit): Promise<object[]> {
        Log.trace("GitHubActions::handlePagination(..) - start; PAGE_SIZE: " + this.pageSize);
        const start = Date.now();

        try {
            Log.trace("GitHubActions::handlePagination(..) - requesting: " + uri);
            let response = await fetch(uri, options);
            let body = await response.json();
            let results: any[] = body; // save the first page of values

            if (response.headers.has("link") === false) {
                // single page, save the results and keep going
                Log.trace("GitHubActions::handlePagination(..) - single page");
            } else {
                Log.trace("GitHubActions::handlePagination(..) - multiple pages");

                let linkText = response.headers.get("link");
                Log.trace("GitHubActions::handlePagination(..) - outer linkText: " + linkText);
                let links = parseLinkHeader(linkText);
                Log.trace("GitHubActions::handlePagination(..) - outer parsed Links: " + JSON.stringify(links));

                // when on the last page links.last will not be present
                while (typeof links.last !== "undefined") {
                    // process current body
                    uri = links.next.url;
                    Log.trace("GitHubActions::handlePagination(..) - requesting: " + uri);

                    // NOTE: this needs to be slowed down to prevent DNS problems
                    // (issuing 10+ concurrent dns requests can be problematic)
                    await Util.delay(100);

                    response = await fetch(uri, options);
                    body = await response.json();
                    results = results.concat(body); // append subsequent pages of values to the first page

                    linkText = response.headers.get("link");
                    Log.trace("GitHubActions::handlePagination(..) - inner linkText: " + linkText);
                    links = parseLinkHeader(linkText);
                    Log.trace("GitHubActions::handlePagination(..) - parsed Links: " + JSON.stringify(links));
                }
            }

            if (typeof (results as any).message !== "undefined" &&
                (results as any).message === "Bad credentials") {
                // This is an odd place for this check, but seems like
                // a good canary for uncovering credential problems
                Log.error("GitHubActions::handlePagination(..) - Bad Credentials encountered");
                Log.error("GitHubActions::handlePagination(..) - .env GH_BOT_TOKEN is incorrect"); // probably
                return [];
            }

            Log.trace("GitHubActions::handlePagination(..) - done; elements: " + results.length + "; took: " + Util.took(start));
            return results;
        } catch (err) {
            Log.error("GitHubActions::handlePagination(..) - ERROR: " + err.message);
            return [];
        }
    }

    /**
     * Lists the teams for the current org.
     *
     * NOTE: this is a slow operation (if there are many teams)
     * so try not to do it too often!
     *
     * @returns {Promise<{id: number, name: string}[]>}
     */
    public async listTeams(): Promise<GitTeamTuple[]> {
        // Log.trace("GitHubActions::listTeams(..) - start");
        const start = Date.now();

        // per_page max is 100
        const uri = this.apiPath + "/orgs/" + this.org + "/teams?per_page=" + this.pageSize;
        Log.info("GitHubActions::listTeams(..) - start"); // uri: " + uri);
        const options: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/vnd.github.hellcat-preview+json"
            }
        };

        const teamsRaw: any = await this.handlePagination(uri, options);

        const teams: GitTeamTuple[] = [];
        for (const team of teamsRaw) {
            const teamNumber = team.id;
            const teamName = team.name;
            teams.push({githubTeamNumber: teamNumber, teamName: teamName});
        }

        Log.info("GitHubActions::listTeams(..) - done; # teams: " + teams.length + "; took: " + Util.took(start));
        return teams;
    }

    public async listWebhooks(repoName: string): Promise<Array<{}>> {
        Log.trace("GitHubAction::listWebhooks( " + this.org + ", " + repoName + " ) - start");
        const start = Date.now();
        // POST /repos/:owner/:repo/hooks
        const uri = this.apiPath + "/repos/" + this.org + "/" + repoName + "/hooks";
        const opts: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName
            }
        };

        const response = await fetch(uri, opts);
        Log.trace("GitHubAction::listWebhooks(..) - success; took: " + Util.took(start));
        return response.json();
    }

    public async addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
        Log.info("GitHubAction::addWebhook( " + repoName + ", " + webhookEndpoint + " ) - start");

        let secret = Config.getInstance().getProp(ConfigKey.autotestSecret);
        secret = crypto.createHash("sha256").update(secret, "utf8").digest("hex"); // webhook w/ sha256
        Log.info("GitHubAction::addWebhook( .. ) - secret: " + secret);
        const start = Date.now();

        // https://developer.github.com/webhooks/creating/
        // https://developer.github.com/v3/repos/hooks/#create-a-hook
        // POST /repos/:owner/:repo/hooks
        const uri = this.apiPath + "/repos/" + this.org + "/" + repoName + "/hooks";
        const opts: RequestInit = {
            method: "POST",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName
            },
            body: JSON.stringify({
                name: "web",
                active: true,
                events: ["commit_comment", "push", "issue_comment"],
                config: {
                    url: webhookEndpoint,
                    secret: secret,
                    content_type: "json"
                }
            })
        };

        await fetch(uri, opts);
        Log.info("GitHubAction::addWebhook(..) - success; took: " + Util.took(start));
        return true;
    }

    public async updateWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
        Log.info("GitHubAction::updateWebhook( " + repoName + ", " + webhookEndpoint + " ) - start");

        const existingWebhooks = await this.listWebhooks(repoName);
        if (existingWebhooks.length === 1) {
            const hookId = (existingWebhooks[0] as any).id;

            let secret = Config.getInstance().getProp(ConfigKey.autotestSecret);
            secret = crypto.createHash("sha256").update(secret, "utf8").digest("hex"); // webhook w/ sha256
            Log.info("GitHubAction::updateWebhook( .. ) - secret: " + secret);
            const start = Date.now();

            // https://developer.github.com/webhooks/creating/
            // https://developer.github.com/v3/repos/hooks/#edit-a-hook
            // PATCH /repos/:owner/:repo/hooks/:hook_id
            const uri = this.apiPath + "/repos/" + this.org + "/" + repoName + "/hooks/" + hookId;
            const opts: RequestInit = {
                method: "PATCH",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName
                },
                body: JSON.stringify({
                    name: "web",
                    active: true,
                    events: ["commit_comment", "push", "issue_comment"],
                    config: {
                        url: webhookEndpoint,
                        secret: secret,
                        content_type: "json"
                    }
                })
            };

            await fetch(uri, opts);
            Log.info("GitHubAction::updateWebhook(..) - success; took: " + Util.took(start));
            return true;
        } else {
            Log.error("GitHubAction::updateWebhook( " + repoName + ", " + webhookEndpoint + " ) - Invalid number of existing webhooks: " +
                JSON.stringify(existingWebhooks));
        }
        return false;
    }

    /**
     * Creates a team for a groupName (e.g., cpsc310_team1).
     *
     * Returns a team tuple.
     *
     * @param teamName
     * @param permission "admin", "pull", "push" // admin for staff, push for students
     * @returns {Promise<GitTeamTuple>} team tuple
     */
    public async createTeam(teamName: string, permission: string): Promise<GitTeamTuple> {
        Log.info("GitHubAction::teamCreate( " + this.org + ", " + teamName + ", " + permission + ", ... ) - start");
        if (permission !== "push" && permission !== "pull" && permission !== "admin") {
            throw new Error("GitHubAction::teamCreate(..) - invalid permission: " + permission);
        }

        const start = Date.now();
        try {
            await GitHubActions.checkDatabase(null, teamName);

            const team = await this.getTeamByName(teamName); // be conservative, do not use TeamController on purpose
            if (team !== null) {
                Log.info("GitHubAction::teamCreate( " + teamName + ", ... ) - already exists; returning");
                return {teamName: teamName, githubTeamNumber: team.githubTeamNumber};
            } else {
                Log.info("GitHubAction::teamCreate( " + teamName + ", ... ) - does not exist; creating");
                const uri = this.apiPath + "/orgs/" + this.org + "/teams";
                const options: RequestInit = {
                    method: "POST",
                    headers: {
                        "Authorization": this.gitHubAuthToken,
                        "User-Agent": this.gitHubUserName,
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        name: teamName,
                        permission: permission
                    })
                };
                const response = await fetch(uri, options);
                const body = await response.json();
                Log.info("GitHubAction::teamCreate(..) - success; new: " + body.id + "; took: " + Util.took(start));

                // remove default token provider/maintainer from team
                await this.removeMembersFromTeam(teamName,
                    [Config.getInstance().getProp(ConfigKey.githubBotName)]);

                return {teamName: teamName, githubTeamNumber: body.id};
            }
        } catch (err) {
            // explicitly log this failure
            Log.error("GitHubAction::teamCreate(..) - ERROR: " + err);
            throw err;
        }
    }

    /**
     * Add a set of GitHub members (their usernames) to a given team.
     *
     * @param teamName
     * @param members GitHub usernames to add to the team
     * @returns {Promise<GitTeamTuple>}
     */
    public async addMembersToTeam(teamName: string, members: string[]): Promise<GitTeamTuple> {
        Log.info("GitHubAction::addMembersToTeam( " + teamName + ", ..) - start; teamName: " + teamName +
            "; members: " + JSON.stringify(members));
        const start = Date.now();

        const tc = new TeamController();
        const teamNumber = await tc.getTeamNumber(teamName); // try to use cache

        // sanity check (members should be githubIds, not other ids)
        for (const member of members) {
            const person = this.dc.getGitHubPerson(member);
            if (person === null) {
                const errMsg = "GitHubAction::addMembersToTeam( .. ) - githubId: " + member +
                    " is unknown; is this actually an id instead of a githubId?";
                Log.error(errMsg);
                throw new Error(errMsg);
            }
        }

        const promises: any = [];
        for (const member of members) {
            Log.info("GitHubAction::addMembersToTeam(..) - adding member: " + member);

            // PUT /teams/:id/memberships/:username
            const uri = this.apiPath + "/teams/" + teamNumber + "/memberships/" + member;
            Log.info("GitHubAction::addMembersToTeam(..) - uri: " + uri);
            const opts: RequestInit = {
                method: "PUT",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    "Accept": "application/json"
                }
            };
            promises.push(fetch(uri, opts));
        }

        const results = await Promise.all(promises);
        Log.info("GitHubAction::addMembersToTeam(..) - success; took: " + Util.took(start) + "; results:" + JSON.stringify(results));

        return {teamName: teamName, githubTeamNumber: teamNumber};
    }

    /**
     * Remove a set of GitHub members (their usernames) from a given team.
     *
     * @param teamName
     * @param members GitHub usernames to remove from the team
     * @returns {Promise<GitTeamTuple>}
     */
    public async removeMembersFromTeam(teamName: string, members: string[]): Promise<GitTeamTuple> {
        Log.info("GitHubAction::removeMembersFromTeam( " + teamName + ", ..) - start; teamName: " + teamName
            + "; members: " + JSON.stringify(members));
        const start = Date.now();

        const tc = new TeamController();
        const teamNumber = await tc.getTeamNumber(teamName); // try to use cache

        // sanity check (members should be githubIds, not other ids)
        for (const member of members) {
            const person = this.dc.getGitHubPerson(member);
            if (person === null) {
                const emsg = "GitHubAction::removeMembersFromTeam( .. ) - githubId: " + member +
                    " is unknown; is this actually an id instead of a githubId?";
                Log.error(emsg);
                throw new Error(emsg);
            }
        }

        const promises: any = [];
        for (const member of members) {
            Log.info("GitHubAction::removeMembersFromTeam(..) - removing member: " + member);

            // DELETE /teams/:id/memberships/:username
            const uri = this.apiPath + "/teams/" + teamNumber + "/memberships/" + member;
            Log.info("GitHubAction::removeMembersFromTeam(..) - uri: " + uri);
            const opts: RequestInit = {
                method: "DELETE",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    "Accept": "application/json"
                }
            };
            promises.push(fetch(uri, opts));
        }

        const results = await Promise.all(promises);
        Log.info("GitHubAction::removeMembersFromTeam(..) - success; took: " + Util.took(start) + "; results:" + JSON.stringify(results));

        return {teamName: teamName, githubTeamNumber: teamNumber};
    }

    /**
     * NOTE: needs the team teamId (number), not the team name (string)!
     *
     * @param {string} teamName
     * @param repoName
     * @param permission ("pull", "push", "admin")
     * @returns {Promise<GitTeamTuple>}
     */
    public async addTeamToRepo(teamName: string, repoName: string, permission: string): Promise<GitTeamTuple> {
        Log.trace("GitHubAction::addTeamToRepo( " + teamName + ", " + repoName + " ) - start");
        if (permission !== "push" && permission !== "pull" && permission !== "admin") {
            throw new Error("GitHubAction::addTeamToRepo(..) - invalid permission: " + permission);
        }

        const start = Date.now();
        try {
            const team = await this.getTeamByName(teamName);
            if (team === null) {
                throw new Error("GitHubAction::addTeamToRepo(..) - team does not exist: " + teamName);
            }

            const repoExists = await this.repoExists(repoName);
            if (repoExists === false) {
                throw new Error("GitHubAction::addTeamToRepo(..) - repo does not exist: " + repoName);
            }

            // with teamId:
            // PUT /teams/:team_id/repos/:owner/:repo (OLD)
            // const uri = this.apiPath + "/teams/" + teamId + "/repos/" + this.org + "/" + repoName;

            // with teamName: DOES NOT WORK in v3
            // PUT /orgs/:org/teams/:team_slug/repos/:owner/:repo (NEW)
            // const teamName = await this.getTeam(teamId);
            const uri = this.apiPath + "/orgs/" + this.org + "/teams/" + teamName + "/repos/" + this.org + "/" + repoName;
            Log.trace("GitHubAction::addTeamToRepo(..) - uri: " + uri);
            const options: RequestInit = {
                method: "PUT",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    // "Accept": "application/json"
                    "Accept": "application/vnd.github+json"
                },
                body: JSON.stringify({
                    permission: permission
                })
            };

            const response = await fetch(uri, options);
            if (!response.ok) {
                throw new Error(response.statusText);
            }

            Log.info("GitHubAction::addTeamToRepo(..) - success; team: " + teamName +
                "; repo: " + repoName + "; took: " + Util.took(start));

            // const teamId = await this.getTeamNumber(teamName);
            return {githubTeamNumber: team.githubTeamNumber, teamName: "NOTSETHERE"}; // TODO: why NOTSETHERE?
        } catch (err) {
            Log.error("GitHubAction::addTeamToRepo(..) - ERROR: " + err);
            throw err;
        }
    }

    /**
     * Gets the internal number for a team.
     *
     * Returns -1 if the team does not exist.
     *
     * NOTE: most clients will want to use TeamController::getTeamNumber instead.
     *
     * @param {string} teamName
     * @returns {Promise<number>}
     */
    public async getTeamNumber(teamName: string): Promise<number> {
        Log.info("GitHubAction::getTeamNumber( " + teamName + " ) - start");
        const start = Date.now();
        try {

            // NOTE: this cannot use TeamController::getTeamNumber because that causes an infinite loop
            const team = await this.getTeamByName(teamName);
            let teamId = -1;
            if (team !== null) {
                teamId = team.githubTeamNumber;
            }

            if (teamId <= 0) {
                Log.info("GitHubAction::getTeamNumber(..) - WARN: Could not find team: " + teamName + "; took: " + Util.took(start));
                return -1;
            } else {
                Log.info("GitHubAction::getTeamNumber(..) - Found team: " + teamName +
                    "; teamId: " + teamId + "; took: " + Util.took(start));
                return teamId;
            }
        } catch (err) {
            Log.warn("GitHubAction::getTeamNumber(..) - could not match team: " + teamName + "; ERROR: " + err);
            return -1;
        }
    }

    /**
     * Gets the list of users on a team.
     *
     * Returns [] if the team does not exist or nobody is on the team.
     *
     * @param {string} teamName
     * @returns {Promise<string[]>}
     */
    public async getTeamMembers(teamName: string): Promise<string[]> {
        Log.trace("GitHubAction::getTeamMembers( " + teamName + " ) - start");

        if (teamName === null) {
            throw new Error("GitHubAction::getTeamMembers( null ) - null team requested");
        }

        const start = Date.now();
        try {
            // /orgs/{org}/teams/{team_slug}/members
            const uri = this.apiPath + "/orgs/" + this.org + "/teams/" + teamName + "/members";
            const options: RequestInit = {
                method: "GET",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    "Accept": "application/vnd.github+json"
                }
            };

            const teamMembersRaw: any = await this.handlePagination(uri, options);
            const ids: string[] = [];
            for (const teamMember of teamMembersRaw) {
                ids.push(teamMember.login);
            }

            Log.trace("GitHubAction::getTeamMembers( " + teamName + " ) - done; # results: " +
                ids.length + "; took: " + Util.took(start));

            return ids;
        } catch (err) {
            Log.warn("GitHubAction::getTeamMembers(..) - ERROR: " + JSON.stringify(err));
            // just return empty [] rather than failing
            return [];
        }
    }

    /**
     * Gets the team associated with the team name.
     *
     * Returns null if the team does not exist.
     *
     * @param {string} teamName
     * @returns {Promise<number>}
     */
    public async getTeamByName(teamName: string): Promise<GitTeamTuple | null> {

        if (teamName === null) {
            throw new Error("GitHubAction::getTeamByName( null ) - null team requested");
        }

        const start = Date.now();
        // /orgs/{org}/teams/{team_slug}
        const uri = this.apiPath + "/orgs/" + this.org + "/teams/" + teamName;
        const options: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/json"
            }
        };

        const response = await fetch(uri, options);

        if (response.status === 404) {
            Log.warn("GitHubAction::getTeam( " + teamName + " ) - team does not exist; status: " + response.status);
            return null;
        }

        const body = await response.json();
        const ret = {githubTeamNumber: body.id, teamName: body.name};
        Log.info("GitHubAction::getTeam( " + teamName + " ) - found: " + JSON.stringify(ret) + "; took: " + Util.took(start));
        return ret;
    }

    /**
     * Gets the team associated with the team number.
     *
     * Returns null if the team does not exist.
     *
     * @param {string} teamNumber
     * @returns {Promise<number>}
     */
    public async getTeam(teamNumber: number): Promise<GitTeamTuple | null> {
        Log.info("GitHubAction::getTeam( " + teamNumber + " ) - start");

        if (teamNumber === null) {
            throw new Error("GitHubAction::getTeam( null ) - null team requested");
        }

        const start = Date.now();
        const uri = this.apiPath + "/teams/" + teamNumber;
        const options: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/json"
            }
        };

        const response = await fetch(uri, options);

        if (response.status === 404) {
            Log.warn("GitHubAction::getTeam( " + teamNumber + " ) - ERROR: Github Team " + response.status);
            return null;
        }

        const body = await response.json();
        const ret = {githubTeamNumber: body.id, teamName: body.name};
        Log.info("GitHubAction::getTeam( " + teamNumber + " ) - found: " + JSON.stringify(ret) + "; took: " + Util.took(start));
        return ret;
    }

    public async isOnAdminTeam(userName: string): Promise<boolean> {
        const isAdmin = await this.isOnTeam(TeamController.ADMIN_NAME, userName);
        Log.trace("GitHubAction::isOnAdminTeam( " + userName + " ) - result: " + isAdmin);
        return isAdmin;
    }

    public async isOnStaffTeam(userName: string): Promise<boolean> {
        const isStaff = await this.isOnTeam(TeamController.STAFF_NAME, userName);
        Log.trace("GitHubAction::isOnStaffTeam( " + userName + " ) - result: " + isStaff);
        return isStaff;
    }

    public async isOnTeam(teamName: string, userName: string): Promise<boolean> {
        const gh = this;
        const start = Date.now();

        if (teamName !== TeamController.STAFF_NAME && teamName !== TeamController.ADMIN_NAME) {
            // sanity-check non admin/staff teams
            await GitHubActions.checkDatabase(null, teamName);
        }

        const teamMembers = await gh.getTeamMembers(teamName);
        for (const member of teamMembers) {
            if (member === userName) {
                Log.info("GitHubAction::isOnTeam( " + userName + " ) - IS on team: " + teamName + "; took: " + Util.took(start));
                return true;
            }
        }

        // only info by default if you are _on_ a team
        Log.trace("GitHubAction::isOnTeam( " + userName + " ) - is NOT on team: " + teamName + "; took: " + Util.took(start));
        return false;
    }

    public async listTeamMembers(teamName: string): Promise<string[]> {
        Log.info("GitHubAction::listTeamMembers( " + teamName + " ) - start");

        const gh = this;
        const teamMembers = await gh.getTeamMembers(teamName);

        return teamMembers;
    }

    public async listRepoBranches(repoId: string): Promise<string[]> {
        const start = Date.now();
        const repoExists = await this.repoExists(repoId); // ensure the repo exists
        if (repoExists === false) {
            Log.error("GitHubAction::listRepoBranches(..) - failed; repo does not exist");
            return null;
        }

        // get branches
        // GET /repos/{owner}/{repo}/branches
        const listUri = this.apiPath + "/repos/" + this.org + "/" + repoId + "/branches";
        Log.info("GitHubAction::listRepoBranches(..) - list branch uri: " + listUri);
        const listOptions: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
        };

        const listResp = await fetch(listUri, listOptions);
        Log.trace("GitHubAction::listRepoBranches(..) - list response code: " + listResp.status); // 201 success
        const listRespBody = await listResp.json();

        if (listResp.status !== 200) {
            Log.warn("GitHubAction::listRepoBranches(..) - failed to list branches for repo; response: " + JSON.stringify(listRespBody));
            return null;
        }

        Log.trace("GitHubAction::listRepoBranches(..) - branch list: " + JSON.stringify(listRespBody));

        const branches: string[] = [];
        for (const githubBranch of listRespBody) {
            branches.push(githubBranch.name);
        }
        Log.trace("GitHubAction::listRepoBranches(..) - branches: " + JSON.stringify(branches) + "; took: " + Util.took(start));
        return branches;
    }

    public async deleteBranches(repoId: string, branchesToKeep: string[]): Promise<boolean> {
        const start = Date.now();

        const repoExists = await this.repoExists(repoId); // ensure the repo exists
        if (repoExists === false) {
            Log.error("GitHubAction::deleteBranches(..) - failed; repo does not exist");
            return false;
        }

        // get branches
        // GET /repos/{owner}/{repo}/branches
        const listUri = this.apiPath + "/repos/" + this.org + "/" + repoId + "/branches";
        Log.info("GitHubAction::deleteBranches(..) - list branch uri: " + listUri);
        const listOptions: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
        };

        const listResp = await fetch(listUri, listOptions);
        Log.trace("GitHubAction::deleteBranches(..) - list response code: " + listResp.status); // 201 success
        const listRespBody = await listResp.json();

        if (listResp.status !== 200) {
            Log.warn("GitHubAction::deleteBranches(..) - failed to list branches for repo; response: " + JSON.stringify(listRespBody));
            return false;
        }

        Log.trace("GitHubAction::deleteBranches(..) - branch list: " + JSON.stringify(listRespBody));

        const branchesToKeepThatExist: string[] = [];
        const branchesToDelete: string[] = [];
        for (const githubBranch of listRespBody) {
            if (branchesToKeep.indexOf(githubBranch.name) < 0) {
                branchesToDelete.push(githubBranch.name);
            } else {
                branchesToKeepThatExist.push(githubBranch.name);
            }
        }
        Log.info("GitHubAction::deleteBranches(..) - branches to delete: " + JSON.stringify(branchesToDelete));

        // make sure there will be at least one branch left on the repo
        // requires a real branchToKeep or that all of the existing branches are not in branchesToKeep
        if (branchesToKeepThatExist.length < 1) {
            Log.error("GitHubAction::deleteBranches(..) - none of the branchesToKeep actually exist (one must remain)");
            return false;
        }

        // delete branches we do not want
        let deleteSucceeded = true;
        for (const branch of branchesToDelete) {
            // DELETE /repos/{owner}/{repo}/git/refs/{ref}
            const delUri = this.apiPath + "/repos/" + this.org + "/" + repoId + "/git/refs/" + "heads/" + branch;
            Log.info("GitHubAction::deleteBranches(..) - delete branch uri: " + delUri);

            const delOptions: RequestInit = {
                method: "DELETE",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28"
                }
            };

            const deleteResp = await fetch(delUri, delOptions);
            Log.trace("GitHubAction::deleteBranches(..) - delete response code: " + deleteResp.status);

            if (deleteResp.status !== 204) {
                const delRespBody = await deleteResp.json();
                Log.warn("GitHubAction::deleteBranches(..) - failed to delete branch for repo; response: " + JSON.stringify(delRespBody));
                deleteSucceeded = false;
            } else {
                Log.info("GitHubAction::deleteBranches(..) - successfully deleted branch: " + branch + " from repo: " + repoId);
            }
        }

        Log.info("GitHubAction::deleteBranches(..) - done; success: " + deleteSucceeded + "; took: " + Util.took(start));
        return deleteSucceeded;
    }

    public async renameBranch(repoId: string, oldName: string, newName: string): Promise<boolean> {
        Log.info("GitHubAction::renameBranch( " + repoId + ", " + oldName + ", " + newName + " ) - start");

        const repoExists = await this.repoExists(repoId); // ensure the repo exists
        if (repoExists === false) {
            Log.error("GitHubAction::renameBranch(..) - failed; repo does not exist");
            return false;
        }

        const start = Date.now();
        // /repos/{owner}/{repo}/branches/{branch}/rename
        const uri = this.apiPath + "/repos/" + this.org + "/" + repoId + "/branches/" + oldName + "/rename";
        Log.info("GitHubAction::renameBranch(..) - uri: " + uri);
        const options: RequestInit = {
            method: "POST",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            },
            body: JSON.stringify({
                new_name: newName
            })
        };

        const response = await fetch(uri, options);
        Log.trace("GitHubAction::renameBranch(..) - response code: " + response.status); // 201 success

        if (response.status === 201) {
            Log.info("GitHubAction::renameBranch(..) - success; took: " + Util.took(start));
            return true;
        } else {
            const body = await response.json();
            Log.warn("GitHubAction::renameBranch(..) - failed; response: " + JSON.stringify(body));
            return false;
        }
    }

    public async importRepoFS(importRepo: string, studentRepo: string, seedFilePath?: string): Promise<boolean> {
        Log.info("GitHubAction::importRepoFS( " + importRepo + ", " + studentRepo + " ) - start");
        const that = this;
        const start = Date.now();

        // if we do not need to do this step, just skip it rather than crashing later on
        if (typeof importRepo === "undefined" || typeof studentRepo === "undefined" ||
            importRepo === null || studentRepo === null ||
            importRepo === "" || studentRepo === "") {
            Log.info("GitHubAction::importRepoFS(..) - FS import skipped; missing import or student repo");
            return true;
        }

        function addGithubAuthToken(url: string) {
            try {
                [url] = url.split(".git");
                const startAppend = url.indexOf("//") + 2;
                const token = that.gitHubAuthToken;
                const authKey = token.substr(token.indexOf("token ") + 6) + "@";
                // creates "longokenstring@githuburi"
                return url.slice(0, startAppend) + authKey + url.slice(startAppend);
            } catch (err) {
                Log.error("GitHubActions::importRepoFS(..)::addGithubAuthToken() - Unexpected error", err);
                return "";
            }
        }

        function getImportBranch(url: string): string {
            try {
                const [cloneUrl, specifiers] = url.split("#");
                const [branch, path] = (specifiers || "").split(":");
                return branch;
            } catch (err) {
                Log.error("GitHubActions::importRepoFS(..)::getImportBranch() - Unexpected error", err);
                return "";
            }
        }

        function getPath(url: string): string {
            try {
                const [cloneUrl, specifiers] = url.split(".git");
                const [branch, pathSpecifier] = (specifiers || "").split(":");
                let path = pathSpecifier || "";
                path = path.startsWith("/") ? path.slice(1) : path;
                path = path.endsWith("/") ? path.slice(0, -1) : path;
                return path;
            } catch (err) {
                Log.error("GitHubActions::importRepoFS(..)::getPath() - Unexpected error", err);
                return "";
            }
        }

        function selectPath(dirPath: string, filePath: string): string {
            let finalPath = filePath;
            if (dirPath && filePath) {
                finalPath = `${dirPath}/${filePath}`;
            } else if (dirPath) {
                finalPath = `${dirPath}/*`;
            }
            return finalPath;
        }

        const exec = require("child-process-promise").exec;
        const cloneTempDir = await tmp.dir({dir: "/tmp", unsafeCleanup: true});
        const authedStudentRepo = addGithubAuthToken(studentRepo);
        const authedImportRepo = addGithubAuthToken(importRepo);
        const importBranch = getImportBranch(importRepo);
        const urlPath = getPath(importRepo);
        const importPath = selectPath(urlPath, seedFilePath);
        // this was just a github-dev testing issue; we might need to consider using per-org import test targets or something
        // if (importRepo === "https://github.com/SECapstone/capstone" || importRepo === "https://github.com/SECapstone/bootstrap") {
        //     authedImportRepo = importRepo; // HACK: for testing
        // }

        if (typeof importPath === "string" && importPath !== "") {
            const seedTempDir = await tmp.dir({dir: "/tmp", unsafeCleanup: true});
            // First clone to a temporary directory, then move only the required files
            return cloneRepo(seedTempDir.path).then(() => {
                return checkout(seedTempDir.path, importBranch)
                    .then(() => {
                        return moveFiles(seedTempDir.path, importPath, cloneTempDir.path);
                    }).then(() => {
                        return removeGitDir();
                    }).then(() => {
                        return initGitDir();
                    }).then(() => {
                        return changeGitRemote();
                    }).then(() => {
                        return addFilesToRepo();
                    }).then(() => {
                        return pushToNewRepo();
                    }).then(() => {
                        Log.info("GitHubAction::cloneRepo() seedPath - done; took: " + Util.took(start));
                        seedTempDir.cleanup();
                        cloneTempDir.cleanup();
                        return Promise.resolve(true); // made it cleanly
                    }).catch((err: any) => {
                        /* istanbul ignore next */
                        Log.error("GitHubAction::cloneRepo() seedPath - ERROR: " + err);
                        seedTempDir.cleanup();
                        cloneTempDir.cleanup();
                        return Promise.reject(err);
                    });
            });
        } else {
            return cloneRepo(cloneTempDir.path).then(() => {
                return checkout(cloneTempDir.path, importBranch)
                    .then(() => {
                        return removeGitDir();
                    }).then(() => {
                        return initGitDir();
                    }).then(() => {
                        return changeGitRemote();
                    }).then(() => {
                        return addFilesToRepo();
                    }).then(() => {
                        return pushToNewRepo();
                    }).then(() => {
                        Log.info("GitHubAction::cloneRepo() - done; took: " + Util.took(start));
                        cloneTempDir.cleanup();
                        return Promise.resolve(true); // made it cleanly
                    }).catch((err: any) => {
                        /* istanbul ignore next */
                        Log.error("GitHubAction::cloneRepo() - ERROR: " + err);
                        cloneTempDir.cleanup();
                        return Promise.reject(err);
                    });
            });
        }

        function moveFiles(originPath: string, filesLocation: string, destPath: string) {
            Log.info("GitHubActions::importRepoFS(..)::moveFiles( " + originPath + ", "
                + filesLocation + ", " + destPath + ") - moving files");
            return exec(`cp -r ${originPath}/${filesLocation} ${destPath}`)
                .then(function (result: any) {
                    Log.info("GitHubActions::importRepoFS(..)::moveFiles(..) - done");
                    that.reportStdOut(result.stdout, "GitHubActions::importRepoFS(..)::moveFiles(..)");
                    that.reportStdErr(result.stderr, "importRepoFS(..)::moveFiles(..)");
                });
        }

        function cloneRepo(repoPath: string) {
            Log.info("GitHubActions::importRepoFS(..)::cloneRepo() - cloning: " + importRepo);
            return exec(`git clone -q ${authedImportRepo} ${repoPath}`)
                .then(function (result: any) {
                    Log.info("GitHubActions::importRepoFS(..)::cloneRepo() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::importRepoFS(..)::cloneRepo()");
                    that.reportStdErr(result.stderr, "importRepoFS(..)::cloneRepo()");
                });
        }

        function checkout(repoPath: string, branch: string) {
            if (typeof branch === "string" && branch !== "") {
                Log.info(`GitHubActions::importRepoFS(..)::checkout() - Checking out "${branch}"`);
                return exec(`cd ${repoPath} && git checkout ${branch}`)
                    .then(function (result: any) {
                        Log.info("GitHubActions::importRepoFS(..)::checkout() - done");
                        that.reportStdOut(result.stdout, "GitHubActions::importRepoFS(..)::checkout()");
                        that.reportStdErr(result.stderr, "importRepoFS(..)::checkout()");
                    });
            } else {
                Log.info(`GitHubActions::importRepoFS(..)::checkout() - Using default branch`);
                return Promise.resolve();
            }
        }

        function removeGitDir() {
            Log.info("GitHubActions::importRepoFS(..)::removeGitDir() - removing .git from cloned repo");
            return exec(`cd ${cloneTempDir.path} && rm -rf .git`)
                .then(function (result: any) {
                    Log.info("GitHubActions::importRepoFS(..)::removeGitDir() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::importRepoFS(..)::removeGitDir()");
                    that.reportStdErr(result.stderr, "importRepoFS(..)::removeGitDir()");
                });
        }

        function initGitDir() {
            Log.info("GitHubActions::importRepoFS(..)::initGitDir() - start");
            return exec(`cd ${cloneTempDir.path} && git init -q && git branch -m main`)
                .then(function (result: any) {
                    Log.info("GitHubActions::importRepoFS(..)::initGitDir() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::importRepoFS(..)::initGitDir()");
                    that.reportStdErr(result.stderr, "importRepoFS(..)::initGitDir()");
                });
        }

        function changeGitRemote() {
            Log.info("GitHubActions::importRepoFS(..)::changeGitRemote() - start");
            const command = `cd ${cloneTempDir.path} && git remote add origin ${authedStudentRepo}.git && git fetch --all -q`;
            return exec(command)
                .then(function (result: any) {
                    Log.info("GitHubActions::importRepoFS(..)::changeGitRemote() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::importRepoFS(..)::changeGitRemote()");
                    that.reportStdErr(result.stderr, "importRepoFS(..)::changeGitRemote()");
                });
        }

        function addFilesToRepo() {
            Log.info("GitHubActions::importRepoFS(..)::addFilesToRepo() - start");
            // tslint:disable-next-line
            const command = `cd ${cloneTempDir.path} && git config user.email "classy@cs.ubc.ca" && git config user.name "classy" && git add . && git commit -q -m "Starter files"`;
            return exec(command)
                .then(function (result: any) {
                    Log.info("GitHubActions::importRepoFS(..)::addFilesToRepo() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::importRepoFS(..)::addFilesToRepo()");
                    that.reportStdErr(result.stderr, "importRepoFS(..)::addFilesToRepo()");
                });
        }

        function pushToNewRepo() {
            const pushStart = Date.now();
            Log.info("GitHubActions::importRepoFS(..)::pushToNewRepo() - start");
            const command = `cd ${cloneTempDir.path} && git push -q origin main`;
            return exec(command)
                .then(function (result: any) {
                    Log.info("GitHubActions::importRepoFS(..)::pushToNewRepo() - done; took: " + Util.took(pushStart));
                    that.reportStdOut(result.stdout, "GitHubActions::importRepoFS(..)::pushToNewRepo()");
                    that.reportStdErr(result.stderr, "importRepoFS(..)::pushToNewRepo()");
                });
        }

        // not used and not tested; trying graceful cleanup instead
        // function removeTempPath() {
        //     Log.info("GitHubActions::importRepoFS(..)::removeTempPath() - start");
        //     const command = `rm -rf ${tempPath}`;
        //     return exec(command)
        //         .then(function(result: any) {
        //             Log.info("GitHubActions::importRepoFS(..)::removeTempPath() - done ");
        //             Log.trace("GitHubActions::importRepoFS(..)::removeTempPath() - stdout: " + result.stdout);
        //             that.reportStdErr(result.stderr, "importRepoFS(..)::removeTempPath()");
        //         });
        // }
    }

    public addGithubAuthToken(url: string) {
        const startAppend = url.indexOf("//") + 2;
        const token = this.gitHubAuthToken;
        const authKey = token.substring(token.indexOf("token ") + 6) + "@";
        // creates "longokenstring@githuburi"
        return url.slice(0, startAppend) + authKey + url.slice(startAppend);
    }

    private reportStdOut(stdout: any, prefix: string) {
        if (stdout) {
            Log.warn("GitHubActions::stdOut(..) - " + prefix + ": " + stdout);
        }
    }

    private reportStdErr(stderr: any, prefix: string) {
        if (stderr) {
            Log.warn("GitHubActions::stdErr(..) - " + prefix + ": " + stderr);
        }
    }

    /**
     * Adds a file with the data given, to the specified repository.
     * If force is set to true, will overwrite old files
     * @param {string} repoURL - name of repository
     * @param {string} fileName - name of file to write
     * @param {string} fileContent - the content of the file to write to repo
     * @param {boolean} force - allow for overwriting of old files
     * @returns {Promise<boolean>} - true if write was successful
     */
    public async writeFileToRepo(repoURL: string, fileName: string, fileContent: string, force?: boolean): Promise<boolean> {
        Log.info("GithubAction::writeFileToRepo( " + repoURL + " , " + fileName + "" +
            " , " + fileContent + " , " + force + " ) - start");
        const that = this;

        if (typeof force === "undefined") {
            force = false;
        }
        // TAKEN FROM importFS

        // generate temp path
        const exec = require("child-process-promise").exec;
        const tempDir = await tmp.dir({dir: "/tmp", unsafeCleanup: true});
        const tempPath = tempDir.path;
        const authedRepo = this.addGithubAuthToken(repoURL);

        // clone repository
        try {
            await cloneRepo(tempPath);
            await enterRepoPath();
            if (force) {
                await createNewFileForce();
            } else {
                await createNewFile();
            }
            await addFilesToRepo();
            try {
                await commitFilesToRepo();
            } catch (err) {
                Log.warn("GithubActions::writeFileToRepo(..) - No file differences; " +
                    "Did not write file to repo");
                // this only fails when the files have not changed,
                return true;    // we technically "wrote" the file still
            }
            await pushToRepo();
        } catch (err) {
            Log.error("GithubActions::writeFileToRepo(..) - Error: " + err);
            return false;
        }

        return true;

        function cloneRepo(repoPath: string) {
            const cloneStart = Date.now();
            Log.info("GitHubActions::writeFileToRepo(..)::cloneRepo() - cloning: " + repoURL);
            return exec(`git clone -q ${authedRepo} ${repoPath}`)
                .then(function (result: any) {
                    Log.info("GitHubActions::writeFileToRepo(..)::cloneRepo() - done; took: " + Util.took(cloneStart));
                    that.reportStdOut(result.stdout, "GitHubActions::writeFileToRepo(..)::cloneRepo()");
                    // if (result.stderr) {
                    //     Log.warn("GitHubActions::writeFileToRepo(..)::cloneRepo() - stderr: " + result.stderr);
                    // }
                    that.reportStdErr(result.stderr, "writeFileToRepo(..)::cloneRepo()");
                });
        }

        function enterRepoPath() {
            Log.info("GitHubActions::writeFileToRepo(..)::enterRepoPath() - entering: " + tempPath);
            return exec(`cd ${tempPath}`)
                .then(function (result: any) {
                    Log.info("GitHubActions::writeFileToRepo(..)::enterRepoPath() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::writeFileToRepo(..)::enterRepoPath()");
                    that.reportStdErr(result.stderr, "writeFileToRepo(..)::enterRepoPath()");
                });
        }

        function createNewFileForce() {
            Log.info("GitHubActions::writeFileToRepo(..)::createNewFileForce() - writing: " + fileName);
            return exec(`cd ${tempPath} && if [ -f ${fileName} ]; then rm ${fileName};  fi; echo "${fileContent}" >> ${fileName};`)
                .then(function (result: any) {
                    Log.info("GitHubActions::writeFileToRepo(..)::createNewFileForce() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::writeFileToRepo(..)::createNewFileForce()");
                    that.reportStdErr(result.stderr, "writeFileToRepo(..)::createNewFileForce()");
                });
        }

        function createNewFile() {
            Log.info("GitHubActions::writeFileToRepo(..)::createNewFile() - writing: " + fileName);
            return exec(`cd ${tempPath} && if [ ! -f ${fileName} ]; then echo \"${fileContent}\" >> ${fileName};fi`)
                .then(function (result: any) {
                    Log.info("GitHubActions::writeFileToRepo(..)::createNewFile() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::writeFileToRepo(..)::createNewFile()");
                    that.reportStdErr(result.stderr, "writeFileToRepo(..)::createNewFile()");
                });
        }

        function addFilesToRepo() {
            Log.info("GitHubActions::writeFileToRepo(..)::addFilesToRepo() - start");
            const command = `cd ${tempPath} && git add ${fileName}`;
            return exec(command)
                .then(function (result: any) {
                    Log.info("GitHubActions::writeFileToRepo(..)::addFilesToRepo() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::writeFileToRepo(..)::addFilesToRepo()");
                    that.reportStdErr(result.stderr, "writeFileToRepo(..)::addFilesToRepo()");
                });
        }

        function commitFilesToRepo() {
            Log.info("GitHubActions::writeFileToRepo(..)::commitFilesToRepo() - start");
            const command = `cd ${tempPath} && git commit -q -m "Update ${fileName}"`;
            return exec(command)
                .then(function (result: any) {
                    Log.info("GitHubActions::writeFileToRepo(..)::commitFilesToRepo() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::writeFileToRepo(..)::commitFilesToRepo()");
                    that.reportStdErr(result.stderr, "writeFileToRepo(..)::commitFilesToRepo()");
                });
        }

        function pushToRepo() {
            Log.info("GitHubActions::writeFileToRepo(..)::pushToRepo() - start");
            const command = `cd ${tempPath} && git push -q`;
            return exec(command)
                .then(function (result: any) {
                    Log.info("GitHubActions::writeFileToRepo(..)::pushToNewRepo() - done");
                    that.reportStdOut(result.stdout, "GitHubActions::writeFileToRepo(..)::pushToNewRepo()");
                    that.reportStdErr(result.stderr, "writeFileToRepo(..)::pushToNewRepo()");
                });
        }

    }

    /**
     * Changes permissions for all teams for the given repository
     * @param {string} repoName
     * @param {string} permission - one of: "push" "pull"
     * @returns {Promise<boolean>}
     */
    public async setRepoPermission(repoName: string, permission: string): Promise<boolean> {
        Log.info("GithubAction::setRepoPermission( " + repoName + ", " + permission + " ) - start");

        try {
            // Check if permission is one of: {push, pull}
            // We do not want to be able to grant a team admin access!
            if (permission !== "pull" && permission !== "push") {
                const msg = "GitHubAction::setRepoPermission(..) - ERROR, Invalid permission: " + permission;
                Log.error(msg);
                throw new Error(msg);
            }

            // Make sure the repo exists
            // tslint:disable-next-line:no-floating-promises
            const repoExists = await this.repoExists(repoName);
            if (repoExists) {
                Log.info("GitHubAction::setRepoPermission(..) - repo exists");
                Log.info("GitHubAction::setRepoPermission(..) - getting teams associated with repo");
                const teamsUri = this.apiPath + "/repos/" + this.org + "/" + repoName + "/teams";
                Log.trace("GitHubAction::setRepoPermission(..) - URI: " + teamsUri);
                const teamOptions: RequestInit = {
                    method: "GET",
                    headers: {
                        "Authorization": this.gitHubAuthToken,
                        "User-Agent": this.gitHubUserName,
                        "Accept": "application/json"
                    }
                };

                // Change each team"s permission
                // tslint:disable-next-line:no-floating-promises
                const response = await fetch(teamsUri, teamOptions); // .then(function(responseData: any) {
                const body = await response.json();
                Log.info("GitHubAction::setRepoPermission(..) - setting permission for teams on repo");
                for (const team of body) {
                    // Do not change teams that have admin permission
                    if (team.permission !== "admin") {
                        Log.info("GitHubAction::setRepoPermission(..) - set team: " + team.name + " to " + permission);
                        const permissionUri = this.apiPath + "/teams/" + team.id + "/repos/" + this.org + "/" + repoName;
                        Log.trace("GitHubAction::setRepoPermission(..) - URI: " + permissionUri);
                        const permissionOptions: RequestInit = {
                            method: "PUT",
                            headers: {
                                "Authorization": this.gitHubAuthToken,
                                "User-Agent": this.gitHubUserName,
                                "Accept": "application/json"
                            },
                            body: JSON.stringify({
                                permission: permission
                            })
                        };

                        await fetch(permissionUri, permissionOptions); // TODO: evaluate statusCode from this call
                        Log.info("GitHubAction::setRepoPermission(..) - changed team: " + team.id + " permissions");
                    }
                }
                return true;
            } else {
                Log.info("GitHubAction::setRepoPermission(..) - repo does not exist; unable to revoke push");
                return false;
            }
        } catch (err) {
            // If we get an error; something went wrong
            Log.error("GitHubAction::setRepoPermission(..) - ERROR: " + err.message);
            throw err;
        }
    }

    /**
     * Adds a single branch protection rule to a repo
     * @param repoId
     * @param rule
     */
    public async addBranchProtectionRule(repoId: string, rule: BranchRule): Promise<boolean> {
        // TODO this code has no unit tests
        Log.info("GitHubAction::addBranchProtectionRule(..) - start; repo:", repoId, "; branch:", rule.name);
        const start = Date.now();
        try {
            const uri = `${this.apiPath}/repos/${this.org}/${repoId}/branches/${rule.name}/protection`;
            const body = JSON.stringify({
                required_status_checks: null,
                enforce_admins: null,
                required_pull_request_reviews: {
                    dismissal_restrictions: {},
                    dismiss_stale_reviews: true,
                    require_code_owner_reviews: false,
                    required_approving_review_count: rule.reviews
                },
                restrictions: null
            });
            const options: RequestInit = {
                method: "PUT",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    // TODO this API is being used in a beta state. Get off the beta!
                    // https://developer.github.com/enterprise/2.19/v3/repos/branches/#update-branch-protection
                    "Accept": "application/vnd.github.luke-cage-preview+json"
                },
                body
            };
            await fetch(uri, options);
            Log.info("GitHubAction::addBranchProtectionRule(", repoId, ",", rule.name, ") - Success! took: ", Util.took(start));
            return true;
        } catch (err) {
            Log.warn("GitHubAction::addBranchProtectionRule(", repoId, ",", rule.name, ") - ERROR:", err.message);
        }
        return false;
    }

    /**
     * Creates a new issue on the specified repo
     * @param repoId
     * @param issue
     */
    public async makeIssue(repoId: string, issue: Issue): Promise<boolean> {
        Log.info("GitHubAction::makeIssue(..) - start; repo:", repoId, "; issue:", issue.title);
        const start = Date.now();
        try {
            const uri = `${this.apiPath}/repos/${this.org}/${repoId}/issues`;
            const body = JSON.stringify({
                title: issue.title,
                body: issue.body,
            });
            const options: RequestInit = {
                method: "POST",
                headers: {
                    "Authorization": this.gitHubAuthToken,
                    "User-Agent": this.gitHubUserName,
                    "Accept": "application/json"
                },
                body
            };
            await fetch(uri, options);
            Log.info("GitHubAction::makeIssue(", repoId, ",", issue.title, ") - Success! took: ", Util.took(start));
            return true;
        } catch (err) {
            Log.warn("GitHubAction::makeIssue(", repoId, ",", issue.title, ") - ERROR:", err.message);
        }
        return false;
    }

    /* istanbul ignore next */
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
    public static async checkDatabase(repoName: string | null, teamName: string | null): Promise<boolean> {
        Log.trace("GitHubActions::checkDatabase( repo:_" + repoName + "_, team:_" + teamName + "_) - start");
        const dbc = DatabaseController.getInstance();
        if (repoName !== null) {
            const repo = await dbc.getRepository(repoName);
            if (repo === null) {
                const msg = "Repository: " + repoName +
                    " does not exist in datastore; make sure you add it before calling this operation";
                Log.error("GitHubActions::checkDatabase() - repo ERROR: " + msg);
                throw new Error(msg);
            } else {
                // ensure custom property is there
                if (typeof repo.custom === "undefined" || repo.custom === null || typeof repo.custom !== "object") {
                    const msg = "Repository: " + repoName + " has a non-object .custom property";
                    Log.error("GitHubActions::checkDatabase() - repo ERROR: " + msg);
                    throw new Error(msg);
                }
            }
        }

        if (teamName !== null) {
            const team = await dbc.getTeam(teamName);
            if (team === null) {
                const msg = "Team: " + teamName +
                    " does not exist in datastore; make sure you add it before calling this operation";
                Log.error("GitHubActions::checkDatabase() - team ERROR: " + msg);
                throw new Error(msg);
            } else {
                // ensure custom property is there
                if (typeof team.custom === "undefined" || team.custom === null || typeof team.custom !== "object") {
                    const msg = "Team: " + teamName + " has a non-object .custom property";
                    Log.error("GitHubActions::checkDatabase() - team ERROR: " + msg);
                    throw new Error(msg);
                }
            }
        }
        Log.trace("GitHubActions::checkDatabase( repo:_" + repoName + "_, team:_" + teamName + "_) - exists");
        return true;
    }

    public async simulateWebhookComment(projectName: string, sha: string, message: string): Promise<boolean> {
        try {
            if (typeof projectName === "undefined" || projectName === null) {
                Log.error("GitHubActions::simulateWebhookComment(..)  - url is required");
                return Promise.resolve(false);
            }

            if (typeof sha === "undefined" || sha === null) {
                Log.error("GitHubActions::simulateWebhookComment(..)  - sha is required");
                return Promise.resolve(false);
            }

            if (typeof message === "undefined" || message === null) {
                Log.error("GitHubActions::simulateWebhookComment(..)  - message is required");
                return Promise.resolve(false);
            }

            // find a better short string for logging
            let messageToPrint = message;
            if (messageToPrint.indexOf("\n") > 0) {
                messageToPrint = messageToPrint.substring(0, messageToPrint.indexOf("\n"));
            }
            if (messageToPrint.length > 80) {
                messageToPrint = messageToPrint.substring(0, 80) + "...";
            }

            Log.info("GitHubActions::simulateWebhookComment(..) - Simulating comment to project: " +
                projectName + "; sha: " + sha + "; message: " + messageToPrint);

            const c = Config.getInstance();
            // const repoUrl = "https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/project_r2d2_c3p0";
            const repoUrl = c.getProp(ConfigKey.githubHost) + "/" + c.getProp(ConfigKey.org) + "/" + projectName;
            // const apiUrl= "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2018W-T1/project_r2d2_c3p0";
            const apiUrl = c.getProp(ConfigKey.githubAPI) + "/api/v3/repos/" + c.getProp(ConfigKey.org) + "/" + projectName;

            const body = {
                comment: {
                    commit_id: sha,
                    // tslint:disable-next-line
                    html_url: repoUrl + "/commit/" + sha + "#fooWillBeStripped", // https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/project_r2d2_c3p0/commit/82ldl2731c665c364ad979c9135688d1c206462c#commitcomment-285811"
                    user: {
                        login: Config.getInstance().getProp(ConfigKey.botName) // userId // autobot
                    },
                    body: message
                },
                repository: {
                    // tslint:disable-next-line
                    commits_url: apiUrl + "/commits{/sha}", // https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2018W-T1/project_r2d2_c3p0/commits{/sha}
                    clone_url: repoUrl + ".git", // https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/project_r2d2_c3p0.git
                    name: projectName
                }
            };

            const urlToSend = Config.getInstance().getProp(ConfigKey.publichostname) + "/portal/githubWebhook";
            Log.info("GitHubService::simulateWebhookComment(..) - url: " + urlToSend + "; body: " + JSON.stringify(body));

            const options: RequestInit = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "UBC-AutoTest",
                    "X-GitHub-Event": "commit_comment",
                    "Authorization": Config.getInstance().getProp(ConfigKey.githubBotToken) // TODO: support auth from github
                },
                body: JSON.stringify(body)
            };

            if (Config.getInstance().getProp(ConfigKey.postback) === true) {
                try {
                    await fetch(urlToSend, options); // NOTE: should we check return?
                    Log.trace("GitHubService::simulateWebhookComment(..) - success"); // : " + res);
                    return Promise.resolve(true);
                } catch (err) {
                    Log.error("GitHubService::simulateWebhookComment(..) - ERROR: " + err);
                    return Promise.resolve(false);
                }

            } else {
                Log.trace("GitHubService::simulateWebhookComment(..) - send skipped (config.postback === false)");
                return Promise.resolve(true);
            }
        } catch (err) {
            Log.error("GitHubService::simulateWebhookComment(..) - ERROR: " + err);
            return Promise.resolve(false);
        }
    }

    public async makeComment(url: string, message: string): Promise<boolean> {
        try {
            if (typeof url === "undefined" || url === null) {
                Log.error("GitHubActions::makeComment(..)  - message.url is required");
                return Promise.resolve(false);
            }

            if (typeof message === "undefined" || message === null || message.length < 1) {
                Log.error("GitHubActions::makeComment(..)  - message.message is required");
                return Promise.resolve(false);
            }

            // find a better short string for logging
            let messageToPrint = message;
            if (messageToPrint.indexOf("\n") > 0) {
                messageToPrint = messageToPrint.substring(0, messageToPrint.indexOf("\n"));
            }
            if (messageToPrint.length > 80) {
                messageToPrint = messageToPrint.substring(0, 80) + "...";
            }

            Log.info("GitHubActions::makeComment(..) - Posting markdown to url: " +
                url + "; message: " + messageToPrint);

            const body = {body: message};
            const options: RequestInit = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "UBC-AutoTest",
                    "Authorization": Config.getInstance().getProp(ConfigKey.githubBotToken)
                },
                body: JSON.stringify(body)
            };

            Log.trace("GitHubService::makeComment(..) - url: " + url);

            if (Config.getInstance().getProp(ConfigKey.postback) === true) {
                try {
                    const res = await fetch(url, options);
                    if (res.status === 201) {
                        Log.trace("GitHubService::makeComment(..) - success");
                        return Promise.resolve(true);
                    } else {
                        Log.trace("GitHubService::makeComment(..) - failed; code: " + res.status);
                        return Promise.resolve(false);
                    }
                } catch (err) {
                    Log.error("GitHubService::makeComment(..) - ERROR: " + err);
                    return Promise.resolve(false);
                }

            } else {
                Log.trace("GitHubService::makeComment(..) - send skipped (config.postback === false)");
                return Promise.resolve(true);
            }
        } catch (err) {
            Log.error("GitHubService::makeComment(..) - ERROR: " + err);
            return Promise.resolve(false);
        }
    }

    public async getTeamsOnRepo(repoId: string): Promise<GitTeamTuple[]> {
        // GET /repos/:owner/:repo/teams
        Log.trace("GitHubActions::getTeamsOnRepo( " + repoId + " ) - start");
        const start = Date.now();
        const uri = this.apiPath + "/repos/" + this.org + "/" + repoId + "/teams";
        const options: RequestInit = {
            method: "GET",
            headers: {
                "Authorization": this.gitHubAuthToken,
                "User-Agent": this.gitHubUserName,
                "Accept": "application/json"
            }
        };

        try {
            const response = await fetch(uri, options);
            const results = await response.json();
            Log.trace("GitHubAction::getTeamsOnRepo( " + repoId + " ) - response received");

            const toReturn: GitTeamTuple[] = [];
            for (const result of results) {
                toReturn.push({teamName: result.name, githubTeamNumber: result.id});
            }

            Log.trace("GitHubAction::getTeamsOnRepo( " + repoId + " ) - done; # teams: " + toReturn.length + "; took: " + Util.took(start));
            return toReturn;
        } catch (err) {
            Log.trace("GitHubAction::getTeamsOnRepo( " + repoId + " ) - failed; took: " + Util.took(start));
            return [];
        }
    }
}
