import * as crypto from "crypto";
import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {Test} from "../../../../common/TestHarness";
import Util from "../../../../common/Util";
import {Factory} from "../Factory";

import {DatabaseController} from "./DatabaseController";
import {GitTeamTuple} from "./GitHubController";
import {TeamController} from "./TeamController";

// tslint:disable-next-line
const tmp = require('tmp-promise');
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
     * @param repoId The name of the repo. Must be unique within the organization.
     * @returns {Promise<string>} provisioned team URL
     */
    createRepo(repoId: string): Promise<string>;

    /**
     * Deletes a repo from the organization.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    deleteRepo(repoName: string): Promise<boolean>;

    /**
     * Checks if a repo exists or not. If the request fails for _ANY_ reason the failure will not
     * be reported, only that the repo does not exist.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    repoExists(repoName: string): Promise<boolean>;

    /**
     * Deletes a team.
     *
     * @param teamId
     */
    deleteTeam(teamId: number): Promise<boolean>;

    /**
     * Deletes a team.
     *
     * @param teamName
     */
    deleteTeamByName(teamName: string): Promise<boolean>;

    /**
     *
     * Gets all repos in an org.
     * This is just a subset of the return, but it is the subset we actually use:
     * @returns {Promise<{ id: number, name: string, url: string }[]>}
     */
    listRepos(): Promise<Array<{repoName: string, repoNumber: number, url: string}>>;

    /**
     * Gets all people in an org.
     *
     * @returns {Promise<{ id: number, type: string, url: string, name: string }[]>}
     * this is just a subset of the return, but it is the subset we actually use
     */
    listPeople(): Promise<Array<{githubId: string, personNumber: number, url: string}>>;

    /**
     * Lists the teams for the current org.
     *
     * NOTE: this is a slow operation (if there are many teams) so try not to do it too much!
     *
     * @returns {Promise<{id: number, name: string}[]>}
     */
    listTeams(): Promise<Array<{teamName: string, teamNumber: number}>>;

    /**
     * Lists the Github IDs of members for a teamName (e.g. students).
     *
     * @param {string} teamName
     * @returns {Promise<string[]>} // list of githubIds
     */
    listTeamMembers(teamName: string): Promise<string[]>;

    listWebhooks(repoName: string): Promise<Array<{}>>;

    updateWebhook(repoName: string, webhookEndpoint: string): Promise<boolean>;

    addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean>;

    /**
     * Creates a team for a groupName (e.g., cpsc310_team1).
     *
     * Returns the teamId (used by many other Github calls).
     *
     * @param teamName
     * @param permission 'admin', 'pull', 'push' // admin for staff, push for students
     * @returns {Promise<number>} team id
     */
    createTeam(teamName: string, permission: string): Promise<{teamName: string, githubTeamNumber: number, URL: string}>;

    /**
     * Add a list of Github members (their usernames) to a given team.
     *
     * @param teamName
     * @param githubTeamId
     * @param memberGithubIds: string[] // github usernames
     * @returns {Promise<GitTeamTuple>}
     */
    addMembersToTeam(teamName: string, memberGithubIds: string[]): Promise<GitTeamTuple>;

    /**
     * Removes a list of Github members (their usernames) from a given team.
     *
     * @param teamName
     * @param memberGithubIds: string[] // github usernames
     * @returns {Promise<GitTeamTuple>}
     */
    removeMembersFromTeam(teamName: string, memberGithubIds: string[]): Promise<GitTeamTuple>;

    /**
     * NOTE: needs the team Id (number), not the team name (string)!
     *
     * @param teamId
     * @param repoName
     * @param permission ('pull', 'push', 'admin')
     * @returns {Promise<GitTeamTuple>}
     */
    addTeamToRepo(teamId: number, repoName: string, permission: string): Promise<GitTeamTuple>;

    /**
     * Gets the internal number for a team.
     *
     * Returns -1 if the team does not exist.
     *
     * @param {string} teamName
     * @returns {Promise<number>}
     */
    getTeamNumber(teamName: string): Promise<number>;

    /**
     * Gets the list of users on a team.
     *
     * Returns [] if the team does not exist or nobody is on the team.
     *
     * @param {string} teamNumber
     * @returns {Promise<number>}
     */
    getTeamMembers(teamNumber: number): Promise<string[]>;

    isOnAdminTeam(userName: string): Promise<boolean>;

    isOnStaffTeam(userName: string): Promise<boolean>;

    isOnTeam(teamName: string, userName: string): Promise<boolean>;

    importRepoFS(importRepo: string, studentRepo: string, seedFilePath?: string): Promise<boolean>;

    addGithubAuthToken(url: string): string;

    // reportStdErr(stderr: any, prefix: string): void;

    /**
     * Adds a file with the data given, to the specified repository.
     * If force is set to true, will overwrite old files
     * @param {string} repoURL - name of repository
     * @param {string} fileName - name of file to write
     * @param {string} fileContent - the content of the file to write to repo
     * @param {boolean} force - allow for overwriting of old files
     * @returns {Promise<boolean>} - true if write was successful
     */
    writeFileToRepo(repoURL: string, fileName: string, fileContent: string, force?: boolean): Promise<boolean>;

    /**
     * Changes permissions for all teams for the given repository
     * @param {string} repoName
     * @param {string} permissionLevel - one of: 'push' 'pull'
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
     * Simulates a comment as if it were received by a webook (for silently invoking AutoTest)
     *
     * @param {string} projectName
     * @param {string} sha
     * @param {string} message
     * @returns {Promise<boolean>}
     */
    simulateWebookComment(projectName: string, sha: string, message: string): Promise<boolean>;

    /**
     * Returns a list of teamIds on a repo
     *
     * @param {string} repoId
     * @returns {{teamId: string}[]}
     */
    getTeamsOnRepo(repoId: string): Promise<GitTeamTuple[]>;

    getTeam(teamNumber: number): Promise<GitTeamTuple | null>;
}

export class GitHubActions implements IGitHubActions {

    private readonly apiPath: string | null = null;
    private readonly gitHubUserName: string | null = null;
    private readonly gitHubAuthToken: string | null = null;
    private readonly org: string | null = null;

    private PAUSE = 5000;
    private pageSize = 100; // public for testing; 100 is the max; 10 is good for tests

    private dc: DatabaseController = null;

    private constructor() {
        Log.trace("GitHubActions::<init>");
        // NOTE: this is not very controllable; these would be better as params
        this.org = Config.getInstance().getProp(ConfigKey.org);
        this.apiPath = Config.getInstance().getProp(ConfigKey.githubAPI);
        this.gitHubUserName = Config.getInstance().getProp(ConfigKey.githubBotName);
        this.gitHubAuthToken = Config.getInstance().getProp(ConfigKey.githubBotToken);
        this.dc = DatabaseController.getInstance();
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
        if (typeof forceReal === 'undefined') {
            forceReal = false;
        }

        // if we're on CI, still run the whole thing
        const ci = process.env.CI;
        if (typeof ci !== 'undefined' && Boolean(ci) === true) {
            forceReal = true;
        }

        // NOTE: this is bad form, but we want to make sure we always return the real thing in production
        // this detects the mocha testing environment
        const isInTest = typeof (global as any).it === 'function';
        if (isInTest === false) {
            // we're in prod, always return the real thing
            Log.trace("GitHubActions::getInstance(.. ) - prod; returning GitHubActions");
            return new GitHubActions();
        }

        if (forceReal === true) {
            Log.test("GitHubActions::getInstance( true ) - returning live GitHubActions");
            return new GitHubActions(); // don't need to cache this since it is backed by GitHub instead of an in-memory cache
        }

        if (GitHubActions.instance === null) {
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
     * @param repoId The name of the repo. Must be unique within the organization.
     * @returns {Promise<string>} provisioned team URL
     */
    public async createRepo(repoId: string): Promise<string> {
        const start = Date.now();
        try {
            Log.info("GitHubAction::createRepo( " + repoId + " ) - start");
            await GitHubActions.checkDatabase(repoId, null);

            const uri = this.apiPath + '/orgs/' + this.org + '/repos';
            const options = {
                method:  'POST',
                uri:     uri,
                headers: {
                    'Authorization': this.gitHubAuthToken,
                    'User-Agent':    this.gitHubUserName,
                    'Accept':        'application/json'
                },
                body:    {
                    name:          repoId,
                    // In Dev and Test, Github free Org Repos cannot be private.
                    private:       true,
                    has_issues:    true,
                    has_wiki:      false,
                    has_downloads: false,
                    auto_init:     false
                },
                json:    true
            };

            Log.info("GitHubAction::createRepo( " + repoId + " ) - making request");
            const body = await rp(options);
            Log.info("GitHubAction::createRepo( " + repoId + " ) - request complete");
            const url = body.html_url;

            Log.info("GitHubAction::createRepo( " + repoId + " ) - db start");
            const repo = await this.dc.getRepository(repoId);
            repo.URL = url; // only update this field in the existing Repository record
            repo.cloneURL = body.clone_url; // only update this field in the existing Repository record
            await this.dc.writeRepository(repo);
            Log.info("GitHubAction::createRepo( " + repoId + " ) - db done");

            Log.info("GitHubAction::createRepo(..) - success; URL: " + url + "; delaying to prep repo. Took: " + Util.took(start));
            await Util.delay(this.PAUSE);
            Log.info("GitHubAction::createRepo(..) - success; URL: " + url + "; delaying complete");

            return url;
        } catch (err) {
            Log.error("GitHubAction::createRepo(..) - ERROR: " + err);
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
                const uri = this.apiPath + '/repos/' + this.org + '/' + repoName;
                Log.trace("GitHubAction::deleteRepo( " + repoName + " ) - URI: " + uri);
                const options = {
                    method:  'DELETE',
                    uri:     uri,
                    headers: {
                        'Authorization': this.gitHubAuthToken,
                        'User-Agent':    this.gitHubUserName,
                        'Accept':        'application/json'
                    }
                };

                await rp(options);
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
        const uri = this.apiPath + '/repos/' + this.org + '/' + repoName;
        const options = {
            method:  'GET',
            uri:     uri,
            headers: {
                'Authorization': this.gitHubAuthToken,
                'User-Agent':    this.gitHubUserName,
                'Accept':        'application/json'
            }
        };

        try {
            await rp(options);
            Log.trace("GitHubAction::repoExists( " + repoName + " ) - true; took: " + Util.took(start));
            return true;
        } catch (err) {
            Log.trace("GitHubAction::repoExists( " + repoName + " ) - false; took: " + Util.took(start));
            return false;
        }
    }

    public async deleteTeamByName(teamName: string): Promise<boolean> {
        Log.info("GitHubAction::deleteTeamByName( " + this.org + ", " + teamName + " ) - start");
        const teamNum = await this.getTeamNumber(teamName); // be conservative, don't use TeamController on purpose
        if (teamNum >= 0) {
            return await this.deleteTeam(teamNum);
        }
        return false;
    }

    /**
     * Deletes a team from GitHub. Does _NOT_ modify the Team object in the database.
     *
     * NOTE: if you're deleting the 'admin', 'staff', or 'students' teams, you're doing something terribly wrong.
     *
     * @param teamId
     */
    public async deleteTeam(teamId: number): Promise<boolean> {

        try {
            const start = Date.now();
            Log.info("GitHubAction::deleteTeam( " + teamId + " ) - start");

            if (teamId === null) {
                throw new Error("GitHubAction::deleteTeam( null ) - null team requested");
            }

            if (teamId === -1) {
                Log.info("GitHubAction::deleteTeam( " + teamId + " ) - team does not exist, not deleting; took: " + Util.took(start));
                return false;
            }

            const uri = this.apiPath + '/teams/' + teamId;
            const options = {
                method:                  'DELETE',
                uri:                     uri,
                headers:                 {
                    'Authorization': this.gitHubAuthToken,
                    'User-Agent':    this.gitHubUserName,
                    // 'Accept': 'application/json', // custom because this is a preview api
                    'Accept':        'application/vnd.github.hellcat-preview+json'
                },
                resolveWithFullResponse: true,
                json:                    true
            };

            const response = await rp(options);
            // Log.info("GitHubAction::deleteTeam(..) - response: " + response);

            if (response.statusCode === 204) {
                Log.info("GitHubAction::deleteTeam(..) - success; took: " + Util.took(start));
                return true;
            } else {
                Log.info("GitHubAction::deleteTeam(..) - not deleted; code: " + response.statusCode + "; took: " + Util.took(start));
                return false;
            }

        } catch (err) {
            // just warn because 404 throws an error like this
            Log.warn("GitHubAction::deleteTeam(..) - failed; ERROR: " + err.message);
            return false;
        }
    }

    /**
     *
     * Gets all repos in an org.
     * This is just a subset of the return, but it is the subset we actually use:
     * @returns {Promise<{ id: number, name: string, url: string }[]>}
     */
    public async listRepos(): Promise<Array<{repoName: string, repoNumber: number, url: string}>> {
        Log.info("GitHubActions::listRepos(..) - start");
        const start = Date.now();

        // per_page max is 100; 10 is useful for testing pagination though
        const uri = this.apiPath + '/orgs/' + this.org + '/repos?per_page=' + this.pageSize;
        Log.trace("GitHubActions::listRepos(..) - URI: " + uri);
        const options = {
            method:                  'GET',
            uri:                     uri,
            headers:                 {
                'Authorization': this.gitHubAuthToken,
                'User-Agent':    this.gitHubUserName,
                'Accept':        'application/json'
            },
            resolveWithFullResponse: true,
            json:                    true
        };

        const raw: any = await this.handlePagination(options);

        const rows: Array<{repoName: string, repoNumber: number, url: string}> = [];
        for (const entry of raw) {
            const id = entry.id;
            const name = entry.name;
            const url = entry.html_url;
            rows.push({repoName: name, repoNumber: id, url: url});
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
    public async listPeople(): Promise<Array<{githubId: string, personNumber: number, url: string}>> {
        Log.info("GitHubActions::listPeople(..) - start");
        const start = Date.now();

        // GET /orgs/:org/members
        const uri = this.apiPath + '/orgs/' + this.org + '/members?per_page=' + this.pageSize;
        const options = {
            method:                  'GET',
            uri:                     uri,
            headers:                 {
                'Authorization': this.gitHubAuthToken,
                'User-Agent':    this.gitHubUserName,
                'Accept':        'application/json'
            },
            resolveWithFullResponse: true,
            json:                    true
        };

        const raw: any = await this.handlePagination(options);

        const rows: Array<{githubId: string, personNumber: number, url: string}> = [];
        for (const entry of raw) {
            const id = entry.id;
            const url = entry.html_url;
            const githubId = entry.login;
            rows.push({githubId: githubId, personNumber: id, url: url});
        }

        Log.info("GitHubActions::listPeople(..) - done; # people: " + rows.length + "; took: " + Util.took(start));
        return rows;
    }

    private async handlePagination(rpOptions: rp.RequestPromiseOptions): Promise<object[]> {
        Log.trace("GitHubActions::handlePagination(..) - start; PAGE_SIZE: " + this.pageSize);

        const start = Date.now();

        try {
            rpOptions.resolveWithFullResponse = true; // in case clients forget
            rpOptions.json = true; // in case clients forget

            const fullResponse = await rp(rpOptions as any); // rpOptions is the right type already

            // Log.trace("GitHubActions::handlePagination(..) - after initial request");

            let raw: any[] = [];
            const paginationPromises: any[] = [];
            if (typeof fullResponse.headers.link !== 'undefined') {
                // first save the responses from the first page:
                raw = fullResponse.body;

                let lastPage: number = -1;
                const linkText = fullResponse.headers.link;
                // Log.trace('GitHubActions::handlePagination(..) - linkText: ' + linkText);
                const linkParts = linkText.split(',');
                for (const p of linkParts) {
                    const pparts = p.split(';');
                    if (pparts[1].indexOf('last')) {
                        const pText = pparts[0].split('&page=')[1];
                        // Log.trace('GitHubActions::handlePagination(..) - last page pText:_' + pText + '_; p: ' + p);
                        lastPage = pText.match(/\d+/)[0];
                        // Log.trace('GitHubActions::handlePagination(..) - last page: ' + lastPage);
                    }
                }

                let pageBase = '';
                for (const p of linkParts) {
                    const pparts = p.split(';');
                    if (pparts[1].indexOf('next')) {
                        let pText = pparts[0].split('&page=')[0].trim();
                        // Log.trace('GitHubActions::handlePagination(..) - pt: ' + pText);
                        pText = pText.substring(1);
                        pText = pText + "&page=";
                        pageBase = pText;
                        // Log.trace('GitHubActions::handlePagination(..) - page base: ' + pageBase);
                    }
                }

                // Log.trace("GitHubActions::handlePagination(..) - handling pagination; # pages: " + lastPage);
                for (let i = 2; i <= lastPage; i++) {
                    const pageUri = pageBase + i;
                    // Log.trace('GitHubActions::handlePagination(..) - page to request: ' + pageUri);
                    (rpOptions as any).uri = pageUri; // not sure why this is needed
                    // NOTE: this needs to be slowed down to prevent DNS problems (issuing 10+ concurrent dns requests can be problematic)
                    await Util.delay(100);
                    paginationPromises.push(rp(rpOptions as any));
                }
            } else {
                // Log.trace("GitHubActions::handlePagination(..) - single page");
                raw = fullResponse.body;
                // don't put anything on the paginationPromise if it isn't paginated
            }

            // Log.trace("GitHubActions::handlePagination(..) - requesting all");
            // this block won't do anything if we just did the raw thing above (aka no pagination)
            const bodies: any[] = await Promise.all(paginationPromises);
            // Log.trace("GitHubActions::handlePagination(..) - requests complete");

            for (const body of bodies) {
                raw = raw.concat(body.body);
            }
            Log.trace("GitHubActions::handlePagination(..) - total count: " + raw.length + "; took: " + Util.took(start));

            return raw;
        } catch (err) {
            Log.error("GitHubActions::handlePagination(..) - ERROR: " + err.message);
            return [];
        }
    }

    /**
     * Lists the teams for the current org.
     *
     * NOTE: this is a slow operation (if there are many teams) so try not to do it too much!
     *
     * @returns {Promise<{id: number, name: string}[]>}
     */
    public async listTeams(): Promise<Array<{teamName: string, teamNumber: number}>> {
        // Log.info("GitHubActions::listTeams(..) - start");
        const start = Date.now();

        // per_page max is 100; 10 is useful for testing pagination though
        const uri = this.apiPath + '/orgs/' + this.org + '/teams?per_page=' + this.pageSize;
        Log.info("GitHubActions::listTeams(..) - start"); // uri: " + uri);
        const options = {
            method:                  'GET',
            uri:                     uri,
            headers:                 {
                'Authorization': this.gitHubAuthToken,
                'User-Agent':    this.gitHubUserName,
                // 'Accept':        'application/json',
                'Accept':        'application/vnd.github.hellcat-preview+json'
            },
            resolveWithFullResponse: true,
            json:                    true
        };

        const teamsRaw: any = await this.handlePagination(options);

        const teams: Array<{teamName: string, teamNumber: number}> = [];
        for (const team of teamsRaw) {
            const teamNumber = team.id;
            const teamName = team.name;
            teams.push({teamNumber: teamNumber, teamName: teamName});
        }

        Log.info("GitHubActions::listTeams(..) - done; # teams: " + teams.length + "; took: " + Util.took(start));
        return teams;
    }

    public async listWebhooks(repoName: string): Promise<Array<{}>> {
        Log.trace("GitHubAction::listWebhooks( " + this.org + ", " + repoName + " ) - start");
        const start = Date.now();
        // POST /repos/:owner/:repo/hooks
        const uri = this.apiPath + '/repos/' + this.org + '/' + repoName + '/hooks';
        const opts = {
            method:  'GET',
            uri:     uri,
            headers: {
                'Authorization': this.gitHubAuthToken,
                'User-Agent':    this.gitHubUserName
            },
            json:    true
        };

        const results = await rp(opts);
        Log.trace("GitHubAction::listWebhooks(..) - success; took: " + Util.took(start));
        return results;
    }

    public async addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
        Log.info("GitHubAction::addWebhook( " + repoName + ", " + webhookEndpoint + " ) - start");
        // Log.info("GitHubAction::addWebhook( .. ) - webhook: " + webhookEndpoint);

        let secret = Config.getInstance().getProp(ConfigKey.autotestSecret);
        secret = crypto.createHash('sha256').update(secret, 'utf8').digest('hex'); // webhook w/ sha256
        Log.info("GitHubAction::addWebhook( .. ) - secret: " + secret);
        const start = Date.now();

        // https://developer.github.com/webhooks/creating/
        // https://developer.github.com/v3/repos/hooks/#create-a-hook
        // POST /repos/:owner/:repo/hooks
        const uri = this.apiPath + '/repos/' + this.org + '/' + repoName + '/hooks';
        const opts = {
            method:  'POST',
            uri:     uri,
            headers: {
                'Authorization': this.gitHubAuthToken,
                'User-Agent':    this.gitHubUserName
            },
            body:    {
                name:   "web",
                active: true,
                events: ["commit_comment", "push"],
                config: {
                    url:          webhookEndpoint,
                    secret:       secret,
                    content_type: "json"
                }
            },
            json:    true
        };

        const results = await rp(opts);
        Log.info("GitHubAction::addWebhook(..) - success; took: " + Util.took(start));
        return true;
    }

    public async updateWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
        Log.info("GitHubAction::updateWebhook( " + repoName + ", " + webhookEndpoint + " ) - start");

        const existingWebhooks = await this.listWebhooks(repoName);

        if (existingWebhooks.length === 1) {

            const hookId = (existingWebhooks[0] as any).id;

            let secret = Config.getInstance().getProp(ConfigKey.autotestSecret);
            secret = crypto.createHash('sha256').update(secret, 'utf8').digest('hex'); // webhook w/ sha256
            Log.info("GitHubAction::updateWebhook( .. ) - secret: " + secret);
            const start = Date.now();

            // https://developer.github.com/webhooks/creating/
            // https://developer.github.com/v3/repos/hooks/#edit-a-hook
            // PATCH /repos/:owner/:repo/hooks/:hook_id
            const uri = this.apiPath + '/repos/' + this.org + '/' + repoName + '/hooks/' + hookId;
            const opts = {
                method:  'PATCH',
                uri:     uri,
                headers: {
                    'Authorization': this.gitHubAuthToken,
                    'User-Agent':    this.gitHubUserName
                },
                body:    {
                    name:   "web",
                    active: true,
                    events: ["commit_comment", "push"],
                    config: {
                        url:          webhookEndpoint,
                        secret:       secret,
                        content_type: "json"
                    }
                },
                json:    true
            };

            await rp(opts);
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
     * Returns the teamId (used by many other Github calls).
     *
     * @param teamName
     * @param permission 'admin', 'pull', 'push' // admin for staff, push for students
     * @returns {Promise<number>} team id
     */
    public async createTeam(teamName: string, permission: string): Promise<{teamName: string, githubTeamNumber: number, URL: string}> {

        Log.info("GitHubAction::teamCreate( " + this.org + ", " + teamName + ", " + permission + ", ... ) - start");
        const start = Date.now();
        try {
            await GitHubActions.checkDatabase(null, teamName);

            const teamNum = await this.getTeamNumber(teamName); // be conservative, don't use TeamController on purpose
            if (teamNum > 0) {
                Log.info("GitHubAction::teamCreate( " + teamName + ", ... ) - success; exists: " + teamNum);
                const config = Config.getInstance();
                const url = config.getProp(ConfigKey.githubHost) + "/orgs/" + config.getProp(ConfigKey.org) + "/teams/" + teamName;
                return {teamName: teamName, githubTeamNumber: teamNum, URL: url};
            } else {
                Log.info('GitHubAction::teamCreate( ' + teamName + ', ... ) - does not exist; creating');
                const uri = this.apiPath + '/orgs/' + this.org + '/teams';
                const options = {
                    method:  'POST',
                    uri:     uri,
                    headers: {
                        'Authorization': this.gitHubAuthToken,
                        'User-Agent':    this.gitHubUserName,
                        'Accept':        'application/json'
                    },
                    body:    {
                        name:       teamName,
                        permission: permission
                    },
                    json:    true
                };
                const body = await rp(options);
                const id = body.id;
                const config = Config.getInstance();
                const url = config.getProp(ConfigKey.githubHost) + "/orgs/" + config.getProp(ConfigKey.org) + "/teams/" + teamName;
                // TODO: simplify callees by setting Team.URL here and persisting it (like we do with createRepo)
                Log.info("GitHubAction::teamCreate(..) - success; new: " + id + "; took: " + Util.took(start));
                return {teamName: teamName, githubTeamNumber: id, URL: url};
            }
        } catch (err) {
            // explicitly log this failure
            Log.error("GitHubAction::teamCreate(..) - ERROR: " + err);
            throw err;
        }
    }

    /**
     * Add a set of Github members (their usernames) to a given team.
     *
     * @param teamName
     * @param githubTeamId
     * @param members: string[] // github usernames
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
                const emsg = "GitHubAction::addMembersToTeam( .. ) - githubId: " + member +
                    " is unknown; is this actually an id instead of a githubId?";
                Log.error(emsg);
                throw new Error(emsg);
            }
        }

        const promises: any = [];
        for (const member of members) {
            Log.info("GitHubAction::addMembersToTeam(..) - adding member: " + member);

            // PUT /teams/:id/memberships/:username
            const uri = this.apiPath + '/teams/' + teamNumber + '/memberships/' + member;
            Log.info("GitHubAction::addMembersToTeam(..) - uri: " + uri);
            const opts = {
                method:  'PUT',
                uri:     uri,
                headers: {
                    'Authorization': this.gitHubAuthToken,
                    'User-Agent':    this.gitHubUserName,
                    'Accept':        'application/json'
                },
                json:    true
            };
            promises.push(rp(opts));
        }

        const results = await Promise.all(promises);
        Log.info("GitHubAction::addMembersToTeam(..) - success; took: " + Util.took(start) + "; results:" + JSON.stringify(results));

        return {teamName: teamName, githubTeamNumber: teamNumber};
    }

    /**
     * Remove a set of Github members (their usernames) from a given team.
     *
     * @param teamName
     * @param githubTeamId
     * @param members: string[] // github usernames
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
            const uri = this.apiPath + '/teams/' + teamNumber + '/memberships/' + member;
            Log.info("GitHubAction::removeMembersFromTeam(..) - uri: " + uri);
            const opts = {
                method:  'DELETE',
                uri:     uri,
                headers: {
                    'Authorization': this.gitHubAuthToken,
                    'User-Agent':    this.gitHubUserName,
                    'Accept':        'application/json'
                },
                json:    true
            };
            promises.push(rp(opts));
        }

        const results = await Promise.all(promises);
        Log.info("GitHubAction::removeMembersFromTeam(..) - success; took: " + Util.took(start) + "; results:" + JSON.stringify(results));

        return {teamName: teamName, githubTeamNumber: teamNumber};
    }

    /**
     * NOTE: needs the team Id (number), not the team name (string)!
     *
     * @param teamId
     * @param repoName
     * @param permission ('pull', 'push', 'admin')
     * @returns {Promise<GitTeamTuple>}
     */
    public async addTeamToRepo(teamId: number, repoName: string, permission: string): Promise<GitTeamTuple> {

        Log.trace("GitHubAction::addTeamToRepo( " + teamId + ", " + repoName + " ) - start");
        const start = Date.now();
        try {
            const uri = this.apiPath + '/teams/' + teamId + '/repos/' + this.org + '/' + repoName;
            // Log.info("GitHubAction::addTeamToRepo(..) - URI: " + uri);
            const options = {
                method:  'PUT',
                uri:     uri,
                headers: {
                    'Authorization': this.gitHubAuthToken,
                    'User-Agent':    this.gitHubUserName,
                    'Accept':        'application/json'
                    // 'Accept':        'application/vnd.github.hellcat-preview+json'
                },
                body:    {
                    permission: permission
                },
                json:    true
            };

            await rp(options);
            Log.info("GitHubAction::addTeamToRepo(..) - success; team: " + teamId +
                "; repo: " + repoName + "; took: " + Util.took(start));
            return {githubTeamNumber: teamId, teamName: 'NOTSETHERE'};

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

            let teamId = -1;
            const teamList = await this.listTeams();
            for (const team of teamList) {
                if (team.teamName === teamName) {
                    teamId = team.teamNumber;
                }
            }

            if (teamId <= 0) {
                Log.info('GitHubAction::getTeamNumber(..) - WARN: Could not find team: ' + teamName + "; took: " + Util.took(start));
                return -1;
            } else {
                Log.info('GitHubAction::getTeamNumber(..) - Found team: ' + teamName +
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
     * @param {string} teamNumber
     * @returns {Promise<number>}
     */
    public async getTeamMembers(teamNumber: number): Promise<string[]> {
        Log.info("GitHubAction::getTeamMembers( " + teamNumber + " ) - start");

        if (teamNumber === null) {
            throw new Error("GitHubAction::getTeamMembers( null ) - null team requested");
        }

        const start = Date.now();
        try {
            const uri = this.apiPath + '/teams/' + teamNumber + '/members?per_page=' + this.pageSize;
            const options = {
                method:                  'GET',
                uri:                     uri,
                headers:                 {
                    'Authorization': this.gitHubAuthToken,
                    'User-Agent':    this.gitHubUserName,
                    'Accept':        'application/json'
                },
                resolveWithFullResponse: true,
                json:                    true
            };

            const teamMembersRaw: any = await this.handlePagination(options);

            const ids: string[] = [];
            for (const teamMember of teamMembersRaw) {
                ids.push(teamMember.login);
            }

            // NOTE: not sure how this will respond to paging if there are lots of members on the team
            // const body = await rp(options);
            //
            // const resp = JSON.parse(body);
            // const ids: string[] = [];
            // for (const result of resp) {
            //     ids.push(result.login);
            // }

            Log.info("GitHubAction::getTeamMembers(..) - success; # results: " + ids.length + "; took: " + Util.took(start));

            return ids;
        } catch (err) {
            Log.warn("GitHubAction::getTeamMembers(..) - ERROR: " + JSON.stringify(err));
            // just return empy [] rather than failing
            return [];
        }
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
        try {
            const uri = this.apiPath + '/teams/' + teamNumber;
            const options = {
                method:                  'GET',
                uri:                     uri,
                headers:                 {
                    'Authorization': this.gitHubAuthToken,
                    'User-Agent':    this.gitHubUserName,
                    'Accept':        'application/json'
                },
                json:                    true,
                resolveWithFullResponse: true
            };

            const response = await rp(options);

            const ret = {githubTeamNumber: response.body.id, teamName: response.body.name};
            Log.info("GitHubAction::getTeam( " + teamNumber + " ) - found: " + JSON.stringify(ret) + "; took: " + Util.took(start));
            return ret;

        } catch (err) {
            Log.warn("GitHubAction::getTeam( " + teamNumber + " ) - ERROR: " + err.message);
        }
        return null;
    }

    public async isOnAdminTeam(userName: string): Promise<boolean> {
        const isAdmin = await this.isOnTeam('admin', userName);
        Log.trace('GitHubAction::isOnAdminTeam( ' + userName + ' ) - result: ' + isAdmin);
        return isAdmin;
    }

    public async isOnStaffTeam(userName: string): Promise<boolean> {
        const isStaff = await this.isOnTeam('staff', userName);
        Log.trace('GitHubAction::isOnStaffTeam( ' + userName + ' ) - result: ' + isStaff);
        return isStaff;
    }

    public async isOnTeam(teamName: string, userName: string): Promise<boolean> {
        const gh = this;
        const start = Date.now();

        if (teamName !== 'staff' && teamName !== 'admin') {
            // sanity-check non admin/staff teams
            await GitHubActions.checkDatabase(null, teamName);
        }

        const tc = new TeamController();
        const teamNumber = await tc.getTeamNumber(teamName); // try to use cache

        // const teamNumber = await gh.getTeamNumber(teamName);

        const teamMembers = await gh.getTeamMembers(teamNumber);
        for (const member of teamMembers) {
            if (member === userName) {
                Log.info('GitHubAction::isOnTeam(..) - user: ' + userName +
                    ' IS on team: ' + teamName + '; took: ' + Util.took(start));
                return true;
            }
        }

        Log.info('GitHubAction::isOnTeam(..) - user: ' + userName +
            ' is NOT on team: ' + teamName + '; took: ' + Util.took(start));
        return false;
    }

    public async listTeamMembers(teamName: string): Promise<string[]> {
        Log.info('GitHubAction::listTeamMembers( ' + teamName + ' ) - start');

        const gh = this;
        const teamNumber = await new TeamController().getTeamNumber(teamName);
        const teamMembers = await gh.getTeamMembers(teamNumber);

        return teamMembers;
    }

    public async importRepoFS(importRepo: string, studentRepo: string, seedFilePath?: string): Promise<boolean> {
        Log.info('GitHubAction::importRepoFS( ' + importRepo + ', ' + studentRepo + ' ) - start');
        const that = this;
        const start = Date.now();

        // if we don't need to do this step, just skip it rather than crashing later on
        if (typeof importRepo === 'undefined' || typeof studentRepo === 'undefined' ||
            importRepo === null || studentRepo === null ||
            importRepo === '' || studentRepo === '') {
            Log.info('GitHubAction::importRepoFS(..) - FS import skipped; missing import or student repo');
            return true;
        }

        function addGithubAuthToken(url: string) {
            const startAppend = url.indexOf('//') + 2;
            const token = that.gitHubAuthToken;
            const authKey = token.substr(token.indexOf('token ') + 6) + '@';
            // creates "longokenstring@githuburi"
            return url.slice(0, startAppend) + authKey + url.slice(startAppend);
        }

        const exec = require('child-process-promise').exec;
        const cloneTempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
        const authedStudentRepo = addGithubAuthToken(studentRepo);
        const authedImportRepo = addGithubAuthToken(importRepo);
        // this was just a github-dev testing issue; we might need to consider using per-org import test targets or something
        // if (importRepo === 'https://github.com/SECapstone/capstone' || importRepo === 'https://github.com/SECapstone/bootstrap') {
        //     authedImportRepo = importRepo; // HACK: for testing
        // }

        if (seedFilePath) {
            const seedTempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
            // First clone to a temporary directory, then move only the required files
            return cloneRepo(seedTempDir.path).then(() => {
                return moveFiles(seedTempDir.path, seedFilePath, cloneTempDir.path)
                    .then(() => {
                        return enterRepoPath();
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
                        Log.info('GitHubAction::cloneRepo() seedPath - done; took: ' + Util.took(start));
                        seedTempDir.cleanup();
                        cloneTempDir.cleanup();
                        return Promise.resolve(true); // made it cleanly
                    }).catch((err: any) => {
                        /* istanbul ignore next */
                        Log.error('GitHubAction::cloneRepo() seedPath - ERROR: ' + err);
                        seedTempDir.cleanup();
                        cloneTempDir.cleanup();
                        return Promise.reject(err);
                    });
            });
        } else {
            return cloneRepo(cloneTempDir.path).then(() => {
                return enterRepoPath()
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
                        Log.info('GitHubAction::cloneRepo() - done; took: ' + Util.took(start));
                        cloneTempDir.cleanup();
                        return Promise.resolve(true); // made it cleanly
                    }).catch((err: any) => {
                        /* istanbul ignore next */
                        Log.error('GitHubAction::cloneRepo() - ERROR: ' + err);
                        cloneTempDir.cleanup();
                        return Promise.reject(err);
                    });
            });
        }

        function moveFiles(originPath: string, filesLocation: string, destPath: string) {
            Log.info('GitHubActions::importRepoFS(..)::moveFiles( ' + originPath + ', '
                + filesLocation + ', ' + destPath + ') - moving files');
            return exec(`cp -r ${originPath}/${filesLocation} ${destPath}`)
                .then(function(result: any) {
                    Log.info('GitHubActions::importRepoFS(..)::moveFiles(..) - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::importRepoFS(..)::moveFiles(..)');
                    that.reportStdErr(result.stderr, 'importRepoFS(..)::moveFiles(..)');
                });
        }

        function cloneRepo(repoPath: string) {
            Log.info('GitHubActions::importRepoFS(..)::cloneRepo() - cloning: ' + importRepo);
            return exec(`git clone -q ${authedImportRepo} ${repoPath}`)
                .then(function(result: any) {
                    Log.info('GitHubActions::importRepoFS(..)::cloneRepo() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::importRepoFS(..)::cloneRepo()');
                    that.reportStdErr(result.stderr, 'importRepoFS(..)::cloneRepo()');
                });
        }

        function enterRepoPath() {
            Log.info('GitHubActions::importRepoFS(..)::enterRepoPath() - entering: ' + cloneTempDir.path);
            return exec(`cd ${cloneTempDir.path}`)
                .then(function(result: any) {
                    Log.info('GitHubActions::importRepoFS(..)::enterRepoPath() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::importRepoFS(..)::enterRepoPath()');
                    that.reportStdErr(result.stderr, 'importRepoFS(..)::enterRepoPath()');
                });
        }

        function removeGitDir() {
            Log.info('GitHubActions::importRepoFS(..)::removeGitDir() - removing .git from cloned repo');
            return exec(`cd ${cloneTempDir.path} && rm -rf .git`)
                .then(function(result: any) {
                    Log.info('GitHubActions::importRepoFS(..)::removeGitDir() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::importRepoFS(..)::removeGitDir()');
                    that.reportStdErr(result.stderr, 'importRepoFS(..)::removeGitDir()');
                });
        }

        function initGitDir() {
            Log.info('GitHubActions::importRepoFS(..)::initGitDir() - start');
            return exec(`cd ${cloneTempDir.path} && git init -q`)
                .then(function(result: any) {
                    Log.info('GitHubActions::importRepoFS(..)::initGitDir() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::importRepoFS(..)::initGitDir()');
                    that.reportStdErr(result.stderr, 'importRepoFS(..)::initGitDir()');
                });
        }

        function changeGitRemote() {
            Log.info('GitHubActions::importRepoFS(..)::changeGitRemote() - start');
            const command = `cd ${cloneTempDir.path} && git remote add origin ${authedStudentRepo}.git && git fetch --all -q`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GitHubActions::importRepoFS(..)::changeGitRemote() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::importRepoFS(..)::changeGitRemote()');
                    that.reportStdErr(result.stderr, 'importRepoFS(..)::changeGitRemote()');
                });
        }

        function addFilesToRepo() {
            Log.info('GitHubActions::importRepoFS(..)::addFilesToRepo() - start');
            // tslint:disable-next-line
            const command = `cd ${cloneTempDir.path} && git config user.email "classy@cs.ubc.ca" && git config user.name "classy" && git add . && git commit -q -m "Starter files"`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GitHubActions::importRepoFS(..)::addFilesToRepo() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::importRepoFS(..)::addFilesToRepo()');
                    that.reportStdErr(result.stderr, 'importRepoFS(..)::addFilesToRepo()');
                });
        }

        function pushToNewRepo() {
            const pushStart = Date.now();
            Log.info('GitHubActions::importRepoFS(..)::pushToNewRepo() - start');
            const command = `cd ${cloneTempDir.path} && git push -q origin master`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GitHubActions::importRepoFS(..)::pushToNewRepo() - done; took: ' + Util.took(pushStart));
                    that.reportStdOut(result.stdout, 'GitHubActions::importRepoFS(..)::pushToNewRepo()');
                    that.reportStdErr(result.stderr, 'importRepoFS(..)::pushToNewRepo()');
                });
        }

        // not used and not tested; trying graceful cleanup instead
        // function removeTempPath() {
        //     Log.info('GitHubActions::importRepoFS(..)::removeTempPath() - start');
        //     const command = `rm -rf ${tempPath}`;
        //     return exec(command)
        //         .then(function(result: any) {
        //             Log.info('GitHubActions::importRepoFS(..)::removeTempPath() - done ');
        //             Log.trace('GitHubActions::importRepoFS(..)::removeTempPath() - stdout: ' + result.stdout);
        //             that.reportStdErr(result.stderr, 'importRepoFS(..)::removeTempPath()');
        //         });
        // }
    }

    public addGithubAuthToken(url: string) {
        const startAppend = url.indexOf('//') + 2;
        const token = this.gitHubAuthToken;
        const authKey = token.substr(token.indexOf('token ') + 6) + '@';
        // creates "longokenstring@githuburi"
        return url.slice(0, startAppend) + authKey + url.slice(startAppend);
    }

    private reportStdOut(stdout: any, prefix: string) {
        if (stdout) {
            Log.warn('GitHubActions::stdOut(..) - ' + prefix + ': ' + stdout);
        }
    }

    private reportStdErr(stderr: any, prefix: string) {
        if (stderr) {
            Log.warn('GitHubActions::stdErr(..) - ' + prefix + ': ' + stderr);
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

        if (typeof force === 'undefined') {
            force = false;
        }
        // TAKEN FROM importFS

        // generate temp path
        const exec = require('child-process-promise').exec;
        const tempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
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
            Log.info('GitHubActions::writeFileToRepo(..)::cloneRepo() - cloning: ' + repoURL);
            return exec(`git clone -q ${authedRepo} ${repoPath}`)
                .then(function(result: any) {
                    Log.info('GitHubActions::writeFileToRepo(..)::cloneRepo() - done; took: ' + Util.took(cloneStart));
                    that.reportStdOut(result.stdout, 'GitHubActions::writeFileToRepo(..)::cloneRepo()');
                    // if (result.stderr) {
                    //     Log.warn('GitHubActions::writeFileToRepo(..)::cloneRepo() - stderr: ' + result.stderr);
                    // }
                    that.reportStdErr(result.stderr, 'writeFileToRepo(..)::cloneRepo()');
                });
        }

        function enterRepoPath() {
            Log.info('GitHubActions::writeFileToRepo(..)::enterRepoPath() - entering: ' + tempPath);
            return exec(`cd ${tempPath}`)
                .then(function(result: any) {
                    Log.info('GitHubActions::writeFileToRepo(..)::enterRepoPath() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::writeFileToRepo(..)::enterRepoPath()');
                    that.reportStdErr(result.stderr, 'writeFileToRepo(..)::enterRepoPath()');
                });
        }

        function createNewFileForce() {
            Log.info('GitHubActions::writeFileToRepo(..)::createNewFileForce() - writing: ' + fileName);
            return exec(`cd ${tempPath} && if [ -f ${fileName} ]; then rm ${fileName};  fi; echo '${fileContent}' >> ${fileName};`)
                .then(function(result: any) {
                    Log.info('GitHubActions::writeFileToRepo(..)::createNewFileForce() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::writeFileToRepo(..)::createNewFileForce()');
                    that.reportStdErr(result.stderr, 'writeFileToRepo(..)::createNewFileForce()');
                });
        }

        function createNewFile() {
            Log.info('GitHubActions::writeFileToRepo(..)::createNewFile() - writing: ' + fileName);
            return exec(`cd ${tempPath} && if [ ! -f ${fileName} ]; then echo \"${fileContent}\" >> ${fileName};fi`)
                .then(function(result: any) {
                    Log.info('GitHubActions::writeFileToRepo(..)::createNewFile() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::writeFileToRepo(..)::createNewFile()');
                    that.reportStdErr(result.stderr, 'writeFileToRepo(..)::createNewFile()');
                });
        }

        function addFilesToRepo() {
            Log.info('GitHubActions::writeFileToRepo(..)::addFilesToRepo() - start');
            const command = `cd ${tempPath} && git add ${fileName}`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GitHubActions::writeFileToRepo(..)::addFilesToRepo() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::writeFileToRepo(..)::addFilesToRepo()');
                    that.reportStdErr(result.stderr, 'writeFileToRepo(..)::addFilesToRepo()');
                });
        }

        function commitFilesToRepo() {
            Log.info('GitHubActions::writeFileToRepo(..)::commitFilesToRepo() - start');
            const command = `cd ${tempPath} && git commit -q -m "Update ${fileName}"`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GitHubActions::writeFileToRepo(..)::commitFilesToRepo() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::writeFileToRepo(..)::commitFilesToRepo()');
                    that.reportStdErr(result.stderr, 'writeFileToRepo(..)::commitFilesToRepo()');
                });
        }

        function pushToRepo() {
            Log.info('GitHubActions::writeFileToRepo(..)::pushToRepo() - start');
            const command = `cd ${tempPath} && git push -q`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GitHubActions::writeFileToRepo(..)::pushToNewRepo() - done');
                    that.reportStdOut(result.stdout, 'GitHubActions::writeFileToRepo(..)::pushToNewRepo()');
                    that.reportStdErr(result.stderr, 'writeFileToRepo(..)::pushToNewRepo()');
                });
        }

    }

    /**
     * Changes permissions for all teams for the given repository
     * @param {string} repoName
     * @param {string} permissionLevel - one of: 'push' 'pull'
     * @returns {Promise<boolean>}
     */
    public async setRepoPermission(repoName: string, permissionLevel: string): Promise<boolean> {
        Log.info("GithubAction::setRepoPermission( " + repoName + ", " + permissionLevel + " ) - start");

        try {
            // Check if permissionLevel is one of: {push, pull}
            // We don't want to be able to grant a team admin access!
            if (permissionLevel !== "pull" && permissionLevel !== "push") {
                const msg = "GitHubAction::setRepoPermission(..) - ERROR, Invalid permissionLevel: " + permissionLevel;
                Log.error(msg);
                throw new Error(msg);
            }

            // Make sure the repo exists
            // tslint:disable-next-line:no-floating-promises
            const repoExists = await this.repoExists(repoName);
            if (repoExists) {
                Log.info("GitHubAction::setRepoPermission(..) - repo exists");
                Log.info("GitHubAction::setRepoPermission(..) - getting teams associated with repo");
                const teamsUri = this.apiPath + '/repos/' + this.org + '/' + repoName + '/teams';
                Log.trace("GitHubAction::setRepoPermission(..) - URI: " + teamsUri);
                const teamOptions = {
                    method:  'GET',
                    uri:     teamsUri,
                    headers: {
                        'Authorization': this.gitHubAuthToken,
                        'User-Agent':    this.gitHubUserName,
                        'Accept':        'application/json'
                    },
                    json:    true
                };

                // Change each team's permission
                // tslint:disable-next-line:no-floating-promises
                const responseData = await rp(teamOptions); // .then(function(responseData: any) {
                Log.info("GitHubAction::setRepoPermission(..) - setting permission for teams on repo");
                for (const team of responseData) {
                    // Don't change teams that have admin permission
                    if (team.permission !== "admin") {
                        Log.info("GitHubAction::setRepoPermission(..) - set team: " + team.name + " to " + permissionLevel);
                        const permissionUri = this.apiPath + '/teams/' + team.id + '/repos/' + this.org + '/' + repoName;
                        Log.trace("GitHubAction::setRepoPermission(..) - URI: " + permissionUri);
                        const permissionOptions = {
                            method:  'PUT',
                            uri:     permissionUri,
                            headers: {
                                'Authorization': this.gitHubAuthToken,
                                'User-Agent':    this.gitHubUserName,
                                'Accept':        'application/json'
                            },
                            body:    {
                                permission: permissionLevel
                            },
                            json:    true
                        };

                        await rp(permissionOptions); // TODO: evaluate statusCode from this call
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
                if (typeof repo.custom === 'undefined' || repo.custom === null || typeof repo.custom !== 'object') {
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
                if (typeof team.custom === 'undefined' || team.custom === null || typeof team.custom !== 'object') {
                    const msg = "Team: " + teamName + " has a non-object .custom property";
                    Log.error("GitHubActions::checkDatabase() - team ERROR: " + msg);
                    throw new Error(msg);
                }
            }
        }
        Log.trace("GitHubActions::checkDatabase( repo:_" + repoName + "_, team:_" + teamName + "_) - exists");
        return true;
    }

    public async simulateWebookComment(projectName: string, sha: string, message: string): Promise<boolean> {
        try {
            if (typeof projectName === "undefined" || projectName === null) {
                Log.error("GitHubActions::simulateWebookComment(..)  - url is required");
                return Promise.resolve(false);
            }

            if (typeof sha === "undefined" || sha === null) {
                Log.error("GitHubActions::simulateWebookComment(..)  - sha is required");
                return Promise.resolve(false);
            }

            if (typeof message === "undefined" || message === null) {
                Log.error("GitHubActions::simulateWebookComment(..)  - message is required");
                return Promise.resolve(false);
            }

            // find a better short string for logging
            let messageToPrint = message;
            if (messageToPrint.indexOf('\n') > 0) {
                messageToPrint = messageToPrint.substr(0, messageToPrint.indexOf('\n'));
            }
            if (messageToPrint.length > 80) {
                messageToPrint = messageToPrint.substr(0, 80) + "...";
            }

            Log.info("GitHubActions::simulateWebookComment(..) - Simulating comment to project: " +
                projectName + "; sha: " + sha + "; message: " + messageToPrint);

            const c = Config.getInstance();
            // const repoUrl = "https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/project_r2d2_c3p0";
            const repoUrl = c.getProp(ConfigKey.githubHost) + '/' + c.getProp(ConfigKey.org) + '/' + projectName;
            // const apiUrl= "https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2018W-T1/project_r2d2_c3p0";
            const apiUrl = c.getProp(ConfigKey.githubAPI) + '/api/v3/repos/' + c.getProp(ConfigKey.org) + '/' + projectName;

            const body = {
                comment:    {
                    commit_id: sha, // 82ldl2731c665c364ad979c9135688d1c206462c
                    // tslint:disable-next-line
                    html_url:  repoUrl + "/commit/" + sha + "#fooWillBeStripped", // https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/project_r2d2_c3p0/commit/82ldl2731c665c364ad979c9135688d1c206462c#commitcomment-285811"
                    user:      {
                        login: Config.getInstance().getProp(ConfigKey.botName) // userId // autobot
                    },
                    body:      message
                },
                repository: {
                    // tslint:disable-next-line
                    commits_url: apiUrl + '/commits{/sha}', // https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2018W-T1/project_r2d2_c3p0/commits{/sha}
                    clone_url:   repoUrl + ".git", // https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/project_r2d2_c3p0.git
                    name:        projectName
                }
            };

            const urlToSend = Config.getInstance().getProp(ConfigKey.publichostname) + '/portal/githubWebhook';
            Log.info("GitHubService::simulateWebookComment(..) - url: " + urlToSend + "; body: " + JSON.stringify(body));

            const options: any = {
                method:  "POST",
                headers: {
                    "Content-Type":   "application/json",
                    "User-Agent":     "UBC-AutoTest",
                    "X-GitHub-Event": "commit_comment",
                    "Authorization":  Config.getInstance().getProp(ConfigKey.githubBotToken) // TODO: support auth from github
                },
                json:    true,
                body:    body
            };

            if (Config.getInstance().getProp(ConfigKey.postback) === true) {

                // Log.trace("GitHubService::postMarkdownToGithub(..) - request: " + JSON.stringify(options, null, 2));
                // const url = url; // this url comes from postbackURL which uses the right API format
                try {
                    const res = await rp(urlToSend, options); // .then(function(res) {
                    Log.trace("GitHubService::simulateWebookComment(..) - success"); // : " + res);
                    return Promise.resolve(true);
                } catch (err) {
                    Log.error("GitHubService::simulateWebookComment(..) - ERROR: " + err);
                    return Promise.resolve(false);
                }

            } else {
                Log.trace("GitHubService::simulateWebookComment(..) - send skipped (config.postback === false)");
                return Promise.resolve(true);
            }
        } catch (err) {
            Log.error("GitHubService::simulateWebookComment(..) - ERROR: " + err);
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
            if (messageToPrint.indexOf('\n') > 0) {
                messageToPrint = messageToPrint.substr(0, messageToPrint.indexOf('\n'));
            }
            if (messageToPrint.length > 80) {
                messageToPrint = messageToPrint.substr(0, 80) + "...";
            }

            Log.info("GitHubActions::makeComment(..) - Posting markdown to url: " +
                url + "; message: " + messageToPrint);

            const body = {body: message};
            const options: any = {
                method:                  "POST",
                headers:                 {
                    "Content-Type":  "application/json",
                    "User-Agent":    "UBC-AutoTest",
                    "Authorization": Config.getInstance().getProp(ConfigKey.githubBotToken)
                },
                body:                    body,
                resolveWithFullResponse: true,
                json:                    true
            };

            Log.trace("GitHubService::makeComment(..) - url: " + url);

            if (Config.getInstance().getProp(ConfigKey.postback) === true) {
                try {
                    const res = await rp(url, options);
                    if (res.statusCode === 201) {
                        Log.trace("GitHubService::makeComment(..) - success");
                        return Promise.resolve(true);
                    } else {
                        Log.trace("GitHubService::makeComment(..) - failed; code: " + res.statusCode);
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
        Log.trace('GitHubActions::getTeamsOnRepo( ' + repoId + ' ) - start');
        const start = Date.now();
        const uri = this.apiPath + '/repos/' + this.org + '/' + repoId + '/teams';
        const options = {
            method:  'GET',
            uri:     uri,
            headers: {
                'Authorization': this.gitHubAuthToken,
                'User-Agent':    this.gitHubUserName,
                'Accept':        'application/json'
            },
            json:    true
        };

        try {
            const results = await rp(options);
            Log.trace("GitHubAction::repoExists( " + repoId + " ) - true; took: " + Util.took(start));

            const toReturn: GitTeamTuple[] = [];
            for (const result of results) {
                toReturn.push({teamName: result.name, githubTeamNumber: result.id});
            }

            return toReturn;
        } catch (err) {
            Log.trace("GitHubAction::repoExists( " + repoId + " ) - false; took: " + Util.took(start));
            return [];
        }
    }
}

/* istanbul ignore next */

// tslint:disable-next-line
export class TestGitHubActions implements IGitHubActions {

    public constructor() {
        Log.info("TestGitHubActions::<init> - start");
    }

    public async addMembersToTeam(teamName: string, members: string[]): Promise<GitTeamTuple> {
        Log.info("TestGitHubActions::addMembersToTeam(..)");
        return {teamName: teamName, githubTeamNumber: 1};
    }

    public async removeMembersFromTeam(teamName: string, members: string[]): Promise<GitTeamTuple> {
        Log.info("TestGitHubActions::addMembersToTeam(..)");
        return {teamName: teamName, githubTeamNumber: 1};
    }

    public async addTeamToRepo(teamId: number, repoName: string, permission: string): Promise<GitTeamTuple> {
        Log.info("TestGitHubActions::addTeamToRepo(..)");
        return {teamName: 'team_' + repoName, githubTeamNumber: teamId};
    }

    public async addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
        Log.info("TestGitHubActions::addWebhook(..)");
        if (typeof this.webHookState[repoName] === 'undefined') {
            this.webHookState[repoName] = [];
        }
        this.webHookState[repoName] = webhookEndpoint;
        return true;
    }

    private repos: any = {};

    public async createRepo(repoId: string): Promise<string> {
        Log.info("TestGitHubActions::createRepo( " + repoId + " ) - start");
        await GitHubActions.checkDatabase(repoId, null);

        if (typeof this.repos[repoId] === 'undefined') {
            Log.info("TestGitHubActions::createRepo( " + repoId + " ) - created");
            const c = Config.getInstance();
            this.repos[repoId] = c.getProp(ConfigKey.githubHost) + '/' + c.getProp(ConfigKey.org) + '/' + repoId;
        }
        Log.info("TestGitHubActions::createRepo( " + repoId + " ) - repos: " + JSON.stringify(this.repos));
        return this.repos[repoId];
    }

    public async createTeam(teamName: string, permission: string): Promise<{teamName: string; githubTeamNumber: number; URL: string}> {
        if (typeof this.teams[teamName] === 'undefined') {
            const c = Config.getInstance();
            const url = c.getProp(ConfigKey.githubHost) + '/' + c.getProp(ConfigKey.org) + '/teams/' + teamName;
            this.teams[teamName] = {teamName: teamName, githubTeamNumber: Date.now(), URL: 'teamURL'};
        }
        Log.info("TestGitHubActions::teamCreate( " + teamName + " ) - created; exists: " +
            (typeof this.teams[teamName] !== 'undefined') + "; records: " + JSON.stringify(this.teams));

        return this.teams[teamName];
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

        if (typeof this.repos[repoName] !== 'undefined') {
            Log.info("TestGitHubActions::deleteRepo( " + repoName + " ) - true; deleted");
            delete this.repos[repoName];
            return true;
        }

        Log.info("TestGitHubActions::deleteRepo( " + repoName + " ) - false; does not exist");
        return false;
    }

    public async deleteTeamByName(teamName: string): Promise<boolean> {
        for (const name of Object.keys(this.teams)) {
            if (name === teamName) {
                delete this.teams[teamName];
                return true;
            }
        }
        return false;
    }

    public async deleteTeam(teamId: number): Promise<boolean> {
        Log.info("TestGitHubActions::deleteTeam( " + teamId + " )");
        for (const teamName of Object.keys(this.teams)) {
            const team = this.teams[teamName];
            if (team.githubTeamNumber === teamId) {
                Log.info("TestGitHubActions::deleteTeam( " + teamId + " ) - deleting team name: " + team.id);
                delete this.teams[teamName];
                return true;
            }
        }

        Log.info("TestGitHubActions::deleteTeam( " + teamId + " ); not deleted");
        return false;
    }

    public async getTeamMembers(teamNumber: number): Promise<string[]> {
        Log.info("TestGitHubActions::getTeamMembers( " + teamNumber + " )");
        if (teamNumber < 0) {
            return [];
        }
        return [Test.REALBOTNAME1, Test.REALUSERNAME, Test.ADMIN1.github];
    }

    public async getTeamNumber(teamName: string): Promise<number> {
        if (teamName === 'students') {
            // return a value that works for testing and for the live environment
            // this is the team number for the students team in the classytest org on github.com
            return 2941733;
        }
        if (typeof this.teams[teamName] !== 'undefined') {
            const num = this.teams[teamName].githubTeamNumber;
            Log.info("TestGitHubActions::getTeamNumber( " + teamName + " ) - returning: " + num);
            return Number(num);
        }
        Log.info("TestGitHubActions::getTeamNumber( " + teamName + " ) - returning: -1; other records: " + JSON.stringify(this.teams));
        return -1;
    }

    public async getTeam(teamNumber: number): Promise<GitTeamTuple | null> {
        for (const team of this.teams) {
            if (team.githubTeamNumber === teamNumber) {
                return {githubTeamNumber: teamNumber, teamName: team.id};
            }
        }
        return null;
    }

    public async importRepoFS(importRepo: string, studentRepo: string, seedFilePath?: string): Promise<boolean> {
        Log.info("TestGitHubActions::importRepoFS( " + importRepo + ", ... ) - start");

        return true;
    }

    public async isOnAdminTeam(userName: string): Promise<boolean> {
        if (userName === Test.ADMIN1.github || userName === Test.ADMIN1.github) {
            Log.info("TestGitHubActions::isOnAdminTeam( " + userName + " ) - true");
            return true;
        }
        Log.info("TestGitHubActions::isOnAdminTeam( " + userName + " ) - false");
        return false;
    }

    public async isOnStaffTeam(userName: string): Promise<boolean> {
        if (userName === Test.STAFF1.github || userName === Test.ADMIN1.github) {
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

    public async listPeople(): Promise<Array<{githubId: string, personNumber: number, url: string}>> {
        Log.info("TestGitHubActions::listPeople(..)");
        const people = [];

        const start = Date.now();
        people.push({personNumber: start, url: 'URL', githubId: Test.REALBOTNAME1});
        people.push({personNumber: start - 5, url: 'URL', githubId: Test.REALUSERNAME});
        people.push({personNumber: start - 15, url: 'URL', githubId: Test.REALBOTNAME1});
        people.push({personNumber: start - 15, url: 'URL', githubId: Test.REALUSER1.github});
        people.push({personNumber: start - 15, url: 'URL', githubId: Test.REALUSER2.github});
        people.push({personNumber: start - 15, url: 'URL', githubId: Test.ADMIN1.github});
        people.push({personNumber: start - 25, url: 'URL', githubId: Test.USER1.github});
        people.push({personNumber: start - 35, url: 'URL', githubId: Test.USER2.github});
        people.push({personNumber: start - 45, url: 'URL', githubId: Test.USER3.github});
        people.push({personNumber: start - 55, url: 'URL', githubId: Test.USER4.github});

        return people;
    }

    public async listRepos(): Promise<Array<{repoName: string, repoNumber: number, url: string}>> {
        Log.info("TestGitHubActions::listRepos(..)");
        const ret = [];
        for (const name of Object.keys(this.repos)) {
            const repo = this.repos[name];
            ret.push({repoNumber: Date.now(), repoName: name, url: repo});
        }
        Log.info("TestGitHubActions::listRepos(..) - #: " + ret.length + "; content: " + JSON.stringify(ret));
        return ret;
    }

    private teams: any = {
        staff: {id: 'staff', teamName: 'staff', githubTeamNumber: '1000'},
        admin: {id: 'admin', teamName: 'admin', githubTeamNumber: '1001'}
    };

    // TODO: use a private teams map to keep track of teams
    public async listTeams(): Promise<Array<{teamName: string, teamNumber: number}>> {
        Log.info("TestGitHubActions::listTeams(..)");
        // return [{teamNumber: Date.now(), teamName: Test.TEAMNAME1}];
        const ret = [];
        for (const name of Object.keys(this.teams)) {
            const teamNum = this.teams[name].githubTeamNumber;
            const teamName = this.teams[name].teamName;
            ret.push({teamNumber: teamNum, teamName: teamName});
        }
        Log.info("TestGitHubActions::listTeams(..) - #: " + ret.length + "; content: " + JSON.stringify(ret));
        return ret;
    }

    private webHookState: any = {};

    public async listWebhooks(repoName: string): Promise<Array<{}>> {
        Log.info("TestGitHubActions::listWebhooks()");
        if (typeof this.webHookState[repoName] === 'undefined') {
            return [];
        }
        return this.webHookState[repoName];
    }

    public async updateWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
        Log.info("TestGitHubActions::updateWebhook()");
        if (typeof this.webHookState[repoName] === 'undefined') {
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
        if (typeof this.repos[repoName] !== 'undefined') {
            Log.info("TestGitHubActions::repoExists( " + repoName + " ) - exists");
            return true;
        }
        Log.info("TestGitHubActions::repoExists( " + repoName + " ) - does not exist");
        return false;
    }

    public async setRepoPermission(repoName: string, permissionLevel: string): Promise<boolean> {
        Log.info("TestGitHubActions::setRepoPermission( " + repoName + ", " + permissionLevel + " )");
        if (repoName === Test.INVALIDREPONAME) {
            return false;
        }
        if (permissionLevel === "admin") {
            return false;
        }
        return true;
    }

    public async writeFileToRepo(repoURL: string, fileName: string, fileContent: string, force?: boolean): Promise<boolean> {
        Log.info("TestGitHubActions::writeFileToRepo(..)");
        if (repoURL === 'invalidurl.com') {
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

    public simulateWebookComment(projectName: string, sha: string, message: string): Promise<boolean> {
        Log.info("TestGitHubActions::simulateWebookComment(..)");
        return;
    }

    public getTeamsOnRepo(repoId: string): Promise<GitTeamTuple[]> {
        return;
    }

}
