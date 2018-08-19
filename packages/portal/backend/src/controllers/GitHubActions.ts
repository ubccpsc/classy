import * as rp from "request-promise-native";
import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {DatabaseController} from "./DatabaseController";
import {GitTeamTuple} from "./GitHubController";

// tslint:disable-next-line
const tmp = require('tmp-promise');

export class GitHubActions {

    private readonly apiPath: string | null = null;
    private readonly gitHubUserName: string | null = null;
    private readonly gitHubAuthToken: string | null = null;
    private readonly org: string | null = null;

    private DELAY_SEC = 1000;
    public PAGE_SIZE = 100; // public for testing; 100 is the max; 10 is good for tests

    private dc: DatabaseController = null;

    constructor() {
        // NOTE: this is not very controllable; these would be better as params
        this.org = Config.getInstance().getProp(ConfigKey.org);
        this.apiPath = Config.getInstance().getProp(ConfigKey.githubAPI);
        this.gitHubUserName = Config.getInstance().getProp(ConfigKey.githubBotName);
        this.gitHubAuthToken = Config.getInstance().getProp(ConfigKey.githubBotToken);
        this.dc = DatabaseController.getInstance();
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
        const ctx = this;

        Log.info("GitHubAction::createRepo( " + repoId + " ) - start");

        const repo = await this.dc.getRepository(repoId);
        if (repo === null) {
            Log.error("GitHubAction::createRepo(..) - unknown Repository object: " + repoId);
            throw new Error("GitHubAction::createRepo(..) - Repository not in datastore: " + repoId);
        }

        try {
            const uri = ctx.apiPath + '/orgs/' + ctx.org + '/repos';
            const options = {
                method:  'POST',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName,
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

            const body = await rp(options);
            const url = body.html_url;
            repo.URL = url; // only update this field in the existing Repository record
            repo.cloneURL = body.clone_url; // only update this field in the existing Repository record
            await this.dc.writeRepository(repo);

            Log.info("GitHubAction::createRepo(..) - success; URL: " + url + "; delaying to prep repo.");
            await ctx.delay(ctx.DELAY_SEC);

            return url;
        } catch (err) {
            Log.error("GitHubAction::createRepo(..) - ERROR: " + err);
            throw new Error("Repository not created");
        }
    }

    /**
     * Deletes a repo from the organization.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    public async deleteRepo(repoName: string): Promise<boolean> {
        // const ctx = this;
        Log.info("GitHubAction::deleteRepo( " + this.org + ", " + repoName + " ) - start");

        // first make sure the repo exists

        // return new Promise(function(fulfill, reject) {
        try {
            const repoExists = await this.repoExists(repoName); // .then(function(repoExists: boolean) {

            if (repoExists === true) {
                Log.info("GitHubAction::deleteRepo(..) - repo exists; deleting");

                const uri = this.apiPath + '/repos/' + this.org + '/' + repoName;
                Log.trace("GitHubAction::deleteRepo(..) - URI: " + uri);
                const options = {
                    method:  'DELETE',
                    uri:     uri,
                    headers: {
                        'Authorization': this.gitHubAuthToken,
                        'User-Agent':    this.gitHubUserName,
                        'Accept':        'application/json'
                    }
                };

                await rp(options); // .then(function() { // body: any
                Log.info("GitHubAction::deleteRepo(..) - success"); // body: " + body);
                // fulfill(true);
                //     }).catch(function(err: any) {
                //         Log.error("GitHubAction::deleteRepo(..) - ERROR: " + JSON.stringify(err));
                //         reject(err);
                //     });
                // } else {
                //     Log.info("GitHubAction::deleteRepo(..) - repo does not exists; not deleting");
                //     fulfill(false);
                // }
                return true;
            } else {
                Log.info("GitHubAction::deleteRepo(..) - repo does not exists; not deleting");
                return false;
            }
        } catch (err) {
            Log.error("GitHubAction::deleteRepo(..) - ERROR: " + JSON.stringify(err));
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
        const ctx = this;
        Log.info("GitHubAction::repoExists( " + ctx.org + ", " + repoName + " ) - start");

        // return new Promise(function(fulfill) {

        const uri = ctx.apiPath + '/repos/' + ctx.org + '/' + repoName;
        // Log.trace("GitHubAction::repoExists(..) - URI: " + uri);
        const options = {
            method:  'GET',
            uri:     uri,
            headers: {
                'Authorization': ctx.gitHubAuthToken,
                'User-Agent':    ctx.gitHubUserName,
                'Accept':        'application/json'
            }
        };

        try {
            await rp(options); // .then(function(); // body: any
            Log.trace("GitHubAction::repoExists(..) - true"); // body: " + body);
            // fulfill(true);
            return true;
        } catch (err) {
            Log.trace("GitHubAction::repoExists(..) - false");
            return false;
        }
        // }).catch(function() { // err: any
        //     // Log.trace("GitHubAction::repoExists(..) - ERROR: " + JSON.stringify(err));
        //     Log.trace("GitHubAction::repoExists(..) - false");
        //     fulfill(false);
        // });
        // });
    }

    /**
     * Deletes a team
     *
     * @param teamId
     */
    public deleteTeam(teamId: number): Promise<boolean> {
        const ctx = this;

        Log.info("GitHubAction::deleteTeam( " + ctx.org + ", " + teamId + " ) - start");
        return new Promise(function(fulfill) {

            const uri = ctx.apiPath + '/teams/' + teamId;
            // Log.trace("GitHubAction::deleteRepo(..) - URI: " + uri);
            const options = {
                method:  'DELETE',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName,
                    // 'Accept': 'application/json', // custom because this is a preview api
                    'Accept':        'application/vnd.github.hellcat-preview+json'
                }
            };

            rp(options).then(function() { // body: any
                Log.info("GitHubAction::deleteTeam(..) - success"); // body: " + body);
                fulfill(true);
            }).catch(function(err) { // err: any
                Log.error("GitHubAction::deleteTeam(..) - failed; ERROR: " + err);
                fulfill(false);
            });
        });
    }

    /**
     *
     * Gets all repos in an org.
     * This is just a subset of the return, but it is the subset we actually use:
     * @returns {Promise<{ id: number, name: string, url: string }[]>}
     */
    public async listRepos(): Promise<Array<{id: number, name: string, url: string}>> {
        const ctx = this;
        Log.info("GitHubManager::listRepos(..) - start");

        // per_page max is 100; 10 is useful for testing pagination though
        const uri = ctx.apiPath + '/orgs/' + ctx.org + '/repos?per_page=' + ctx.PAGE_SIZE;
        const options = {
            method:                  'GET',
            uri:                     uri,
            headers:                 {
                'Authorization': ctx.gitHubAuthToken,
                'User-Agent':    ctx.gitHubUserName,
                'Accept':        'application/json'
            },
            resolveWithFullResponse: true,
            json:                    true
        };

        const raw: any = await ctx.handlePagination(options);

        const rows: Array<{id: number, name: string, url: string}> = [];
        for (const entry of raw) {
            const id = entry.id;
            const name = entry.name;
            const url = entry.url;
            rows.push({id: id, name: name, url: url});
        }

        return rows;
    }

    /**
     * Gets all people in an org.
     *
     * @returns {Promise<{ id: number, type: string, url: string, name: string }[]>}
     * this is just a subset of the return, but it is the subset we actually use
     */
    public async listPeople(): Promise<Array<{id: number, type: string, url: string, name: string}>> {
        const ctx = this;

        Log.info("GitHubManager::listRepos(..) - start");

        // GET /orgs/:org/members
        const uri = ctx.apiPath + '/orgs/' + ctx.org + '/members'; // per_page max is 100; 10 is useful for testing pagination though
        const options = {
            method:                  'GET',
            uri:                     uri,
            headers:                 {
                'Authorization': ctx.gitHubAuthToken,
                'User-Agent':    ctx.gitHubUserName,
                'Accept':        'application/json'
            },
            resolveWithFullResponse: true,
            json:                    true
        };

        const raw: any = await ctx.handlePagination(options);

        const rows: Array<{id: number, type: string, url: string, name: string}> = [];
        for (const entry of raw) {
            const id = entry.id;
            const type = entry.type;
            const url = entry.url;
            const name = entry.login;
            rows.push({id: id, type: type, url: url, name: name});
        }

        return rows;
    }

    public async handlePagination(rpOptions: rp.RequestPromiseOptions): Promise<object[]> {
        Log.info("GitHubActions::handlePagination(..) - start");

        rpOptions.resolveWithFullResponse = true; // in case clients forget
        rpOptions.json = true; // in case clients forget

        const fullResponse = await rp(rpOptions as any); // rpOptions is the right type already

        let raw: any[] = [];
        const paginationPromises: any[] = [];
        if (typeof fullResponse.headers.link !== 'undefined') {
            // first save the responses from the first page:
            raw = fullResponse.body;

            let lastPage: number = -1;
            const linkText = fullResponse.headers.link;
            const linkParts = linkText.split(',');
            for (const p of linkParts) {
                const pparts = p.split(';');
                if (pparts[1].indexOf('last')) {
                    const pText = pparts[0].split('&page=')[1];
                    lastPage = pText.match(/\d+/)[0];
                    // Log.trace('last page: ' + lastPage);
                }
            }

            let pageBase = '';
            for (const p of linkParts) {
                const pparts = p.split(';');
                if (pparts[1].indexOf('next')) {
                    let pText = pparts[0].split('&page=')[0].trim();
                    // Log.trace('pt: ' + pText);
                    pText = pText.substring(1);
                    pText = pText + "&page=";
                    pageBase = pText;
                    // Log.trace('page base: ' + pageBase);
                }
            }

            Log.trace("GitHubManager::handlePagination(..) - handling pagination; #pages: " + lastPage);
            for (let i = 2; i <= lastPage; i++) {
                const pageUri = pageBase + i;
                // Log.trace('page to request: ' + page);
                (rpOptions as any).uri = pageUri; // not sure why this is needed
                // NOTE: this needs to be slowed down to prevent DNS problems (issuing 10+ concurrent dns requests can be problematic)
                await this.delay(100);
                paginationPromises.push(rp(rpOptions as any));
            }
        } else {
            Log.trace("GitHubManager::handlePagination(..) - single page");
            raw = fullResponse.body;
            // don't put anything on the paginationPromise if it isn't paginated
        }

        // this block won't do anything if we just did the raw thing above (aka no pagination)
        const bodies: any[] = await Promise.all(paginationPromises);
        for (const body of bodies) {
            raw = raw.concat(body.body);
        }
        Log.trace("GitHubManager::handlePagination(..) - total count: " + raw.length);

        return raw;
    }

    /**
     * Lists the teams for the current org.
     *
     * NOTE: this is a slow operation (if there are many teams) so try not to do it too much!
     *
     * @returns {Promise<{id: number, name: string}[]>}
     */
    public async listTeams(): Promise<Array<{id: number, name: string}>> {
        Log.info("GitHubManager::listTeams(..) - start");
        const ctx = this;
        // per_page max is 100; 10 is useful for testing pagination though
        const uri = ctx.apiPath + '/orgs/' + ctx.org + '/teams?per_page=' + ctx.PAGE_SIZE;
        const options = {
            method:                  'GET',
            uri:                     uri,
            headers:                 {
                'Authorization': ctx.gitHubAuthToken,
                'User-Agent':    ctx.gitHubUserName,
                'Accept':        'application/json'
            },
            resolveWithFullResponse: true,
            json:                    true
        };

        const teamsRaw: any = await ctx.handlePagination(options);

        const teams: Array<{id: number, name: string}> = [];
        for (const team of teamsRaw) {
            const id = team.id;
            const name = team.name;
            teams.push({id: id, name: name});
        }

        return teams;
    }

    public listWebhooks(repoName: string): Promise<{}> {
        const ctx = this;
        Log.info("GitHubAction::listWebhooks( " + ctx.org + ", " + repoName + " ) - start");

        return new Promise(function(fulfill, reject) {

            // POST /repos/:owner/:repo/hooks
            const uri = ctx.apiPath + '/repos/' + ctx.org + '/' + repoName + '/hooks';
            const opts = {
                method:  'GET',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName
                },
                json:    true
            };

            rp(opts).then(function(results: any) {
                Log.info("GitHubAction::listWebhooks(..) - success: " + results);
                fulfill(results);
            }).catch(function(err: any) {
                Log.error("GitHubAction::listWebhooks(..) - ERROR: " + err);
                reject(err);
            });
        });
    }

    public addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
        const ctx = this;
        Log.info("GitHubAction::addWebhook( " + ctx.org + ", " + repoName + ", " + webhookEndpoint + " ) - start");

        return new Promise(function(fulfill, reject) {

            // POST /repos/:owner/:repo/hooks
            const uri = ctx.apiPath + '/repos/' + ctx.org + '/' + repoName + '/hooks';
            const opts = {
                method:  'POST',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName
                },
                body:    {
                    name:   "web",
                    active: true,
                    events: ["commit_comment", "push"],
                    config: {
                        url:          webhookEndpoint,
                        content_type: "json"
                    }
                },
                json:    true
            };

            rp(opts).then(function(results: any) {
                Log.info("GitHubAction::addWebhook(..) - success: " + results);
                fulfill(true);
            }).catch(function(err: any) {
                Log.error("GitHubAction::addWebhook(..) - ERROR: " + err);
                reject(err);
            });
        });
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
    public async createTeam(teamName: string, permission: string): Promise<{teamName: string, githubTeamNumber: number}> {
        const ctx = this;
        Log.info("GitHubAction::createTeam( " + ctx.org + ", " + teamName + ", " + permission + ", ... ) - start");

        try {
            const teamNum = await this.getTeamNumber(teamName);
            if (teamNum > 0) {
                Log.info("GitHubAction::createTeam( " + teamName + ", ... ) - success; exists: " + teamNum);
                return {teamName: teamName, githubTeamNumber: teamNum};
            } else {
                Log.info('GitHubAction::createTeam( ' + teamName + ', ... ) - does not exist; creating');
                const uri = ctx.apiPath + '/orgs/' + ctx.org + '/teams';
                const options = {
                    method:  'POST',
                    uri:     uri,
                    headers: {
                        'Authorization': ctx.gitHubAuthToken,
                        'User-Agent':    ctx.gitHubUserName,
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
                Log.info("GitHubAction::createTeam(..) - success; new: " + id);
                return {teamName: teamName, githubTeamNumber: id};
            }
        } catch (err) {
            Log.error("GitHubAction::createTeam(..) - ERROR: " + err);
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
    public addMembersToTeam(teamName: string, githubTeamId: number, members: string[]): Promise<GitTeamTuple> {
        const ctx = this;
        Log.info("GitHubAction::addMembersToTeam( " + teamName + ", ... ) - start; id: " +
            githubTeamId + "; members: " + JSON.stringify(members));

        return new Promise(function(fulfill, reject) {
            const promises: any = [];
            for (const member of members) {
                Log.info("GitHubAction::addMembersToTeam(..) - adding member: " + member);

                // PUT /teams/:id/memberships/:username
                const uri = ctx.apiPath + '/teams/' + githubTeamId + '/memberships/' + member;
                const opts = {
                    method:  'PUT',
                    uri:     uri,
                    headers: {
                        'Authorization': ctx.gitHubAuthToken,
                        'User-Agent':    ctx.gitHubUserName,
                        'Accept':        'application/json'
                    },
                    json:    true
                };
                promises.push(rp(opts));
            }

            Promise.all(promises).then(function(results: any) {
                Log.info("GitHubAction::addMembersToTeam(..) - success: " + JSON.stringify(results));
                fulfill({teamName: teamName, githubTeamNumber: githubTeamId});
            }).catch(function(err: any) {
                Log.error("GitHubAction::addMembersToTeam(..) - ERROR: " + err);
                reject(err);
            });
        });
    }

    /**
     * NOTE: needs the team Id (number), not the team name (string)!
     *
     * @param teamId
     * @param repoName
     * @param permission ('pull', 'push', 'admin')
     * @returns {Promise<GitTeamTuple>}
     */
    public addTeamToRepo(teamId: number, repoName: string, permission: string): Promise<GitTeamTuple> {
        const ctx = this;
        Log.info("GitHubAction::addTeamToRepo( " + teamId + ", " + repoName + " ) - start");
        return new Promise(function(fulfill, reject) {

            const uri = ctx.apiPath + '/teams/' + teamId + '/repos/' + ctx.org + '/' + repoName;
            const options = {
                method:  'PUT',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName,
                    'Accept':        'application/json'
                },
                body:    {
                    permission: permission
                },
                json:    true
            };

            rp(options).then(function() { // body
                Log.info("GitHubAction::addTeamToRepo(..) - success; team: " + teamId + "; repo: " + repoName);
                fulfill({githubTeamNumber: teamId, teamName: 'NOTSETHERE'});
            }).catch(function(err: any) {
                Log.error("GitHubAction::addTeamToRepo(..) - ERROR: " + err);
                reject(err);
            });
        });
    }

    /**
     * Gets the internal number for a team.
     *
     * Returns -1 if the team does not exist. Will throw an error
     * if some other configuration problem is encountered.
     *
     * @param {string} teamName
     * @returns {Promise<number>}
     */
    public getTeamNumber(teamName: string): Promise<number> {
        const ctx = this;
        Log.info("GitHubAction::getTeamNumber( " + teamName + " ) - start");

        return new Promise(function(fulfill, reject) {
            let teamId = -1;
            ctx.listTeams().then(function(teamList: any) {
                for (const team of teamList) {
                    if (team.name === teamName) {
                        teamId = team.id;
                        Log.info("GitHubAction::getTeamNumber(..) - matched team: " + teamName + "; id: " + teamId);
                    }
                }

                if (teamId < 0) {
                    // reject('GitHubAction::getTeamNumber(..) - ERROR: Could not find team: ' + teamName);
                    Log.info('GitHubAction::getTeamNumber(..) - WARN: Could not find team: ' + teamName);
                    fulfill(-1);
                } else {
                    fulfill(teamId);
                }
            }).catch(function(err) {
                Log.error("GitHubAction::getTeamNumber(..) - could not match team: " + teamName + "; ERROR: " + err);
                reject(err);
            });
        });
    }

    /**
     * Gets the list of users on a team.
     *
     * Returns [] if the team does not exist or nobody is on the team.
     * Will throw an error if some other configuration problem is encountered.
     *
     * @param {string} teamNumber
     * @returns {Promise<number>}
     */
    public getTeamMembers(teamNumber: number): Promise<string[]> {
        const ctx = this;

        Log.info("GitHubAction::getTeamMembers( " + teamNumber + " ) - start");
        return new Promise(function(fulfill) {

            const uri = ctx.apiPath + '/teams/' + teamNumber + '/members';
            const options = {
                method:  'GET',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName,
                    'Accept':        'application/json'
                }
            };

            // NOTE: not sure how this will respond to paging if there are lots of members on the team
            rp(options).then(function(body: any) {
                Log.info("GitHubAction::getTeamMembers(..) - success"); //  body: " + body);
                const resp = JSON.parse(body);
                const ids: string[] = [];
                for (const result of resp) {
                    ids.push(result.login);
                }

                fulfill(ids);
            }).catch(function(err: any) {
                Log.warn("GitHubAction::getTeamMembers(..) - ERROR: " + JSON.stringify(err));
                // just return empy [] rather than failing
                fulfill([]);
            });
        });
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

    private async isOnTeam(teamName: string, userName: string): Promise<boolean> {
        const gh = this;

        const teamNumber = await gh.getTeamNumber(teamName);
        if (teamNumber < 0) {
            Log.warn('GitHubAction::isOnTeam(..) - team: ' + teamName + ' does not exist for org: ' + gh.org);
            return false;
        }

        const teamMembers = await gh.getTeamMembers(teamNumber);
        for (const member of teamMembers) {
            if (member === userName) {
                Log.info('GitHubAction::isOnTeam(..) - user: ' + userName + ' IS on team: ' + teamName + ' for org: ' + gh.org);
                return true;
            }
        }

        Log.info('GitHubAction::isOnTeam(..) - user: ' + userName + ' is NOT on team: ' + teamName + ' for org: ' + gh.org);
        return false;
    }

    public async importRepoFS(importRepo: string, studentRepo: string, seedFilePath?: string): Promise<boolean> {
        Log.info('GitHubAction::importRepoFS( ' + importRepo + ', ' + studentRepo + ' ) - start');
        const that = this;

        function addGithubAuthToken(url: string) {
            const startAppend = url.indexOf('//') + 2;
            const token = that.gitHubAuthToken;
            const authKey = token.substr(token.indexOf('token ') + 6) + '@';
            // creates "longokenstring@githuburi"
            return url.slice(0, startAppend) + authKey + url.slice(startAppend);
        }

        const exec = require('child-process-promise').exec;
        const tempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
        const tempPath = tempDir.path;
        const authedStudentRepo = addGithubAuthToken(studentRepo);
        const authedImportRepo = addGithubAuthToken(importRepo);

        if (seedFilePath) {
            const tempDir2 = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
            const tempPath2 = tempDir2.path;
            // First clone to a temporary directory
            // then move only the required files
            // then proceed as normal
            return cloneRepo(tempPath2).then(() => {
                return moveFiles(tempPath2, seedFilePath, tempPath)
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
                        return Promise.resolve(true); // made it cleanly
                    }).catch((err: any) => {
                        Log.error('GitHubAction::cloneRepo() - ERROR: ' + err);
                        return Promise.reject(err);
                    });
            });
        } else {
            return cloneRepo(tempPath).then(() => {
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
                        return Promise.resolve(true); // made it cleanly
                    }).catch((err: any) => {
                        Log.error('GitHubAction::cloneRepo() - ERROR: ' + err);
                        return Promise.reject(err);
                    });
            });
        }

        function moveFiles(originPath: string, filesLocation: string, destPath: string) {
            Log.info('GithubManager::importRepoFS(..)::moveFiles( ' + originPath + ', '
                + filesLocation + ', ' + destPath + ') - moving files');
            return exec(`cp -r ${originPath}/${filesLocation} ${destPath}`)
                .then(function(result: any) {
                    Log.info('GithubManager::importRepoFS(..)::moveFiles(..) - done');
                    Log.trace('GithubManager::importRepoFS(..)::moveFiles(..) - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::moveFiles(..) - stderr: ' + result.stderr);
                    }
                });
        }

        function cloneRepo(repoPath: string) {
            Log.info('GithubManager::importRepoFS(..)::cloneRepo() - cloning: ' + importRepo);
            return exec(`git clone ${authedImportRepo} ${repoPath}`)
                .then(function(result: any) {
                    Log.info('GithubManager::importRepoFS(..)::cloneRepo() - done:');
                    Log.trace('GithubManager::importRepoFS(..)::cloneRepo() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::cloneRepo() - stderr: ' + result.stderr);
                    }
                });
        }

        function enterRepoPath() {
            Log.info('GithubManager::importRepoFS(..)::enterRepoPath() - entering: ' + tempPath);
            return exec(`cd ${tempPath}`)
                .then(function(result: any) {
                    Log.info('GithubManager::importRepoFS(..)::enterRepoPath() - done:');
                    Log.trace('GithubManager::importRepoFS(..)::enterRepoPath() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::enterRepoPath() - stderr: ' + result.stderr);
                    }
                });
        }

        function removeGitDir() {
            Log.info('GithubManager::importRepoFS(..)::removeGitDir() - removing .git from cloned repo');
            return exec(`cd ${tempPath} && rm -rf .git`)
                .then(function(result: any) {
                    Log.info('GithubManager::importRepoFS(..)::removeGitDir() - done:');
                    Log.trace('GithubManager::importRepoFS(..)::removeGitDir() - stdout: ' + result.stdout);
                    Log.trace('GithubManager::importRepoFS(..)::removeGitDir() - stderr: ' + result.stderr);
                });
        }

        function initGitDir() {
            Log.info('GithubManager::importRepoFS(..)::initGitDir() - start');
            return exec(`cd ${tempPath} && git init`)
                .then(function(result: any) {
                    Log.info('GithubManager::importRepoFS(..)::initGitDir() - done:');
                    Log.trace('GithubManager::importRepoFS(..)::initGitDir() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::initGitDir() - stderr: ' + result.stderr);
                    }
                });
        }

        function changeGitRemote() {
            Log.info('GithubManager::importRepoFS(..)::changeGitRemote() - start');
            const command = `cd ${tempPath} && git remote add origin ${authedStudentRepo}.git && git fetch --all`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GithubManager::importRepoFS(..)::changeGitRemote() - done:');
                    Log.trace('GithubManager::importRepoFS(..)::changeGitRemote() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::changeGitRemote() - stderr: ' + result.stderr);
                    }
                });
        }

        function addFilesToRepo() {
            Log.info('GithubManager::importRepoFS(..)::addFilesToRepo() - start');
            const command = `cd ${tempPath} && git add . && git commit -m "Starter files"`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GithubManager::importRepoFS(..)::addFilesToRepo() - done:');
                    Log.trace('GithubManager::importRepoFS(..)::addFilesToRepo() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::addFilesToRepo() - stderr: ' + result.stderr);
                    }
                });
        }

        function pushToNewRepo() {
            Log.info('GithubManager::importRepoFS(..)::pushToNewRepo() - start');
            const command = `cd ${tempPath} && git push origin master`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GithubManager::importRepoFS(..)::pushToNewRepo() - done: ');
                    Log.trace('GithubManager::importRepoFS(..)::pushToNewRepo() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::pushToNewRepo() - stderr: ' + result.stderr);
                    }
                });
        }
    }

    // just a useful delay function for when we need to wait for GH to do something
    // or we want a test to be able to slow itself down
    public delay(ms: number): Promise<{}> {
        // logger.info("GitHubManager::delay( " + ms + ") - start");
        return new Promise(function(resolve) {
            const fire = new Date(new Date().getTime() + ms);
            Log.info("GitHubAction::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
            setTimeout(resolve, ms);
        });
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
    public async writeFileToRepo(repoURL: string, fileName: string, fileContent: string, force: boolean = false): Promise<boolean> {
        Log.info("GithubAction::writeFileToRepo( " + repoURL + " , " + fileName + "" +
            " , " + fileContent + " , " + force + " ) - start");
        const that = this;

        // TAKEN FROM importFS ----
        function addGithubAuthToken(url: string) {
            const startAppend = url.indexOf('//') + 2;
            const token = that.gitHubAuthToken;
            const authKey = token.substr(token.indexOf('token ') + 6) + '@';
            // creates "longokenstring@githuburi"
            return url.slice(0, startAppend) + authKey + url.slice(startAppend);
        }

        // generate temp path
        const exec = require('child-process-promise').exec;
        const tempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
        const tempPath = tempDir.path;
        const authedRepo = addGithubAuthToken(repoURL);

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
            await commitFilesToRepo();
            await pushToRepo();
        } catch (err) {
            Log.error("GithubActions::writeFileToRepo(..) - Error: " + err);
            return false;
        }

        return true;

        function cloneRepo(repoPath: string) {
            Log.info('GithubManager::writeFileToRepo(..)::cloneRepo() - cloning: ' + repoURL);
            return exec(`git clone ${authedRepo} ${repoPath}`)
                .then(function(result: any) {
                    Log.info('GithubManager::writeFileToRepo(..)::cloneRepo() - done:');
                    Log.trace('GithubManager::writeFileToRepo(..)::cloneRepo() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::writeFileToRepo(..)::cloneRepo() - stderr: ' + result.stderr);
                    }
                });
        }

        function enterRepoPath() {
            Log.info('GithubManager::writeFileToRepo(..)::enterRepoPath() - entering: ' + tempPath);
            return exec(`cd ${tempPath}`)
                .then(function(result: any) {
                    Log.info('GithubManager::writeFileToRepo(..)::enterRepoPath() - done:');
                    Log.trace('GithubManager::writeFileToRepo(..)::enterRepoPath() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::writeFileToRepo(..)::enterRepoPath() - stderr: ' + result.stderr);
                    }
                });
        }

        function createNewFileForce() {
            Log.info('GithubManager::writeFileToRepo(..)::createNewFileForce() - writing: ' + fileName);
            return exec(`cd ${tempPath} && if [ -f ${fileName} ]; then rm ${fileName};  fi; echo '${fileContent}' >> ${fileName};`)
                .then(function(result: any) {
                    Log.info('GithubManager::writeFileToRepo(..)::createNewFileForce() - done:');
                    Log.trace('GithubManager::writeFileToRepo(..)::createNewFileForce() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::writeFileToRepo(..)::createNewFileForce() - stderr: ' + result.stderr);
                    }
                });
        }

        function createNewFile() {
            Log.info('GithubManager::writeFileToRepo(..)::createNewFile() - writing: ' + fileName);
            return exec(`cd ${tempPath} && if [ ! -f ${fileName} ]; then echo \"${fileContent}\" >> ${fileName};fi`)
                .then(function(result: any) {
                    Log.info('GithubManager::writeFileToRepo(..)::createNewFile() - done:');
                    Log.trace('GithubManager::writeFileToRepo(..)::createNewFile() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::writeFileToRepo(..)::createNewFile() - stderr: ' + result.stderr);
                    }
                });
        }

        function addFilesToRepo() {
            Log.info('GithubManager::writeFileToRepo(..)::addFilesToRepo() - start');
            const command = `cd ${tempPath} && git add ${fileName}`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GithubManager::writeFileToRepo(..)::addFilesToRepo() - done:');
                    Log.trace('GithubManager::writeFileToRepo(..)::addFilesToRepo() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::writeFileToRepo(..)::addFilesToRepo() - stderr: ' + result.stderr);
                    }
                });
        }

        function commitFilesToRepo() {
            Log.info('GithubManager::writeFileToRepo(..)::commitFilesToRepo() - start');
            const command = `cd ${tempPath} && git commit -m "Update ${fileName}"`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GithubManager::writeFileToRepo(..)::commitFilesToRepo() - done:');
                    Log.trace('GithubManager::writeFileToRepo(..)::commitFilesToRepo() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::writeFileToRepo(..)::commitFilesToRepo() - stderr: ' + result.stderr);
                    }
                });
        }

        function pushToRepo() {
            Log.info('GithubManager::writeFileToRepo(..)::pushToRepo() - start');
            const command = `cd ${tempPath} && git push`;
            return exec(command)
                .then(function(result: any) {
                    Log.info('GithubManager::writeFileToRepo(..)::pushToNewRepo() - done: ');
                    Log.trace('GithubManager::writeFileToRepo(..)::pushToNewRepo() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::writeFileToRepo(..)::pushToNewRepo() - stderr: ' + result.stderr);
                    }
                });
        }

    }

    /**
     * Changes permissions for all teams for the given repository
     * @param {string} repoName
     * @param {string} permissionLevel - one of: 'push' 'pull'
     * @returns {Promise<boolean>}
     */
    public setRepoPermission(repoName: string, permissionLevel: string): Promise<boolean> {
        const ctx = this;
        Log.info("GithubAction::setRepoPermission( " + repoName + ", " + permissionLevel + " ) - start");

        return new Promise(function(fulfill, reject) {
            // Check if permissionLevel is one of: {push, pull}
            // We don't want to be able to grant a team admin access!
            if (permissionLevel !== "pull" && permissionLevel !== "push") {
                Log.error("GitHubAction::setRepoPermission(..) - ERROR, Invalid permissionLevel: " + permissionLevel);
                reject(false);
            }

            // Make sure the repo exists
            // tslint:disable-next-line:no-floating-promises
            ctx.repoExists(repoName).then(function(repoExists: boolean) {
                if (repoExists) {
                    Log.info("GitHubAction::setRepoPermission(..) - repo exists");
                    Log.info("GitHubAction::setRepoPermission(..) - getting teams associated with repo");
                    const teamsUri = ctx.apiPath + '/repos/' + ctx.org + '/' + repoName + '/teams';
                    Log.trace("GitHubAction::setRepoPermission(..) - URI: " + teamsUri);
                    const teamOptions = {
                        method:  'GET',
                        uri:     teamsUri,
                        headers: {
                            'Authorization': ctx.gitHubAuthToken,
                            'User-Agent':    ctx.gitHubUserName,
                            'Accept':        'application/json'
                        },
                        json:    true
                    };

                    // Change each team's permission
                    // tslint:disable-next-line:no-floating-promises
                    rp(teamOptions).then(function(responseData: any) {
                        Log.info("GitHubAction::setRepoPermission(..) - setting permission for teams on repo");
                        for (const team of responseData) {
                            // Don't change teams that have admin permission
                            if (team.permission !== "admin") {
                                Log.info("GitHubAction::setRepoPermission(..) - set team: " + team.name + " to " + permissionLevel);
                                const permissionUri = ctx.apiPath + '/teams/' + team.id + '/repos/' + ctx.org + '/' + repoName;
                                Log.trace("GitHubAction::setRepoPermission(..) - URI: " + permissionUri);
                                const permissionOptions = {
                                    method:  'PUT',
                                    uri:     permissionUri,
                                    headers: {
                                        'Authorization': ctx.gitHubAuthToken,
                                        'User-Agent':    ctx.gitHubUserName,
                                        'Accept':        'application/json'
                                    },
                                    body:    {
                                        permission: permissionLevel
                                    },
                                    json:    true
                                };

                                rp(permissionOptions).then(function() {
                                    Log.info("GitHubAction::setRepoPermission(..) - changed team: " + team.id + " permissions");
                                }).catch(function(err) {
                                    Log.error("GitHubAction::setRepoPermission(..) - ERROR: " + err);
                                    fulfill(false);
                                });
                            }
                        }
                    });
                    fulfill(true);
                } else {
                    Log.info("GitHubAction::setRepoPermission(..) - repo does not exists; unable to revoke push");
                    fulfill(false);
                }
            }).catch(function(err) {
                // If we get an error; something went wrong
                Log.error("GitHubAction::setRepoPermission(..) - ERROR: " + JSON.stringify(err));
                reject(err);
            });
        });
    }

}
