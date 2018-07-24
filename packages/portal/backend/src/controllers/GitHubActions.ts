import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {GitTeamTuple} from "./GitHubController";

const tmp = require('tmp-promise');

export class GitHubActions {

    private readonly apiPath: string | null = null;
    private readonly gitHubUserName: string | null = null;
    private readonly gitHubAuthToken: string | null = null;
    private readonly org: string | null = null;

    private DELAY_SEC = 1000;
    public PAGE_SIZE = 100; // public for testing; 100 is the max; 10 is good for tests

    constructor() {
        // NOTE: this is not very controllable; these would be better as params
        this.org = Config.getInstance().getProp(ConfigKey.org);
        this.apiPath = Config.getInstance().getProp(ConfigKey.githubAPI);
        this.gitHubUserName = Config.getInstance().getProp(ConfigKey.githubBotName);
        this.gitHubAuthToken = Config.getInstance().getProp(ConfigKey.githubBotToken);
    }

    /**
     * Creates a given repo and returns its URL. If the repo exists, return the URL for that repo.
     *
     * @param repoName
     * @returns {Promise<string>} provisioned team URL
     */
    public createRepo(repoName: string): Promise<string> {
        let ctx = this;

        Log.info("GitHubAction::createRepo( " + ctx.org + ", " + repoName + " ) - start");
        return new Promise(function (fulfill, reject) {

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
                    name:          repoName,
                    // In Dev and Test, Github free Org Repos cannot be private.
                    private:       true,
                    has_issues:    true,
                    has_wiki:      false,
                    has_downloads: false,
                    auto_init:     false
                },
                json:    true
            };
            let url: string | null = null;
            rp(options).then(function (body: any) {
                // body.html_url;
                // body.name;
                // body.id;
                url = body.html_url;
                Log.info("GitHubAction::createRepo(..) - success; URL: " + url + "; delaying to prep repo.");
                return ctx.delay(ctx.DELAY_SEC);
            }).then(function () {
                Log.info("GitHubAction::createRepo(..) - repo created: " + repoName);
                fulfill(url);
            }).catch(function (err: any) {
                Log.error("GitHubAction::createRepo(..) - ERROR: " + JSON.stringify(err));
                reject(err);
            });

        });
    }

    /**
     * Deletes a repo from the organization.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    public deleteRepo(repoName: string): Promise<boolean> {
        let ctx = this;
        Log.info("GitHubAction::deleteRepo( " + ctx.org + ", " + repoName + " ) - start");

        // first make sure the repo exists

        return new Promise(function (fulfill, reject) {

            ctx.repoExists(repoName).then(function (repoExists: boolean) {

                if (repoExists === true) {
                    Log.info("GitHubAction::deleteRepo(..) - repo exists; deleting");

                    const uri = ctx.apiPath + '/repos/' + ctx.org + '/' + repoName;
                    Log.trace("GitHubAction::deleteRepo(..) - URI: " + uri);
                    const options = {
                        method:  'DELETE',
                        uri:     uri,
                        headers: {
                            'Authorization': ctx.gitHubAuthToken,
                            'User-Agent':    ctx.gitHubUserName,
                            'Accept':        'application/json'
                        }
                    };

                    rp(options).then(function (body: any) {
                        Log.info("GitHubAction::deleteRepo(..) - success"); // body: " + body);
                        fulfill(true);
                    }).catch(function (err: any) {
                        Log.error("GitHubAction::deleteRepo(..) - ERROR: " + JSON.stringify(err));
                        reject(err);
                    });
                } else {
                    Log.info("GitHubAction::deleteRepo(..) - repo does not exists; not deleting");
                    fulfill(false);
                }
            }).catch(function (err) {
                Log.error("GitHubAction::deleteRepo(..) - ERROR: " + JSON.stringify(err));
                reject(err);
            });


        });
    }

    /**
     * Checks if a repo exists or not. If the request fails for _ANY_ reason the failure will not
     * be reported, only that the repo does not exist.
     *
     * @param repoName
     * @returns {Promise<boolean>}
     */
    public repoExists(repoName: string): Promise<boolean> {
        let ctx = this;
        Log.info("GitHubAction::repoExists( " + ctx.org + ", " + repoName + " ) - start");

        return new Promise(function (fulfill) {

            const uri = ctx.apiPath + '/repos/' + ctx.org + '/' + repoName;
            Log.trace("GitHubAction::repoExists(..) - URI: " + uri);
            const options = {
                method:  'GET',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName,
                    'Accept':        'application/json'
                }
            };

            rp(options).then(function (body: any) {
                Log.info("GitHubAction::repoExists(..) - true"); // body: " + body);
                fulfill(true);
            }).catch(function () { // err: any
                // Log.trace("GitHubAction::repoExists(..) - ERROR: " + JSON.stringify(err));
                Log.info("GitHubAction::repoExists(..) - false");
                fulfill(false);
            });
        });
    }


    /**
     * Deletes a team
     *
     * @param teamId
     */
    public deleteTeam(teamId: number): Promise<boolean> {
        let ctx = this;

        Log.info("GitHubAction::deleteTeam( " + ctx.org + ", " + teamId + " ) - start");
        return new Promise(function (fulfill) {

            const uri = ctx.apiPath + '/teams/' + teamId;
            Log.trace("GitHubAction::deleteRepo(..) - URI: " + uri);
            const options = {
                method:  'DELETE',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName,
                    'Accept':        'application/vnd.github.hellcat-preview+json' // 'application/json', // custom because this is a preview api
                }
            };

            rp(options).then(function (body: any) {
                Log.info("GitHubAction::deleteTeam(..) - success"); // body: " + body);
                fulfill(true);
            }).catch(function (err) { // err: any
                Log.error("GitHubAction::deleteTeam(..) - failed; ERROR: " + err);
                fulfill(false);
            });
        });
    }

    /**
     *
     * Gets all repos in an org.
     *
     * @returns {Promise<{ id: number, name: string, url: string }[]>} // this is just a subset of the return, but it is the subset we actually use
     */
    public async listRepos(): Promise<{ id: number, name: string, url: string }[]> {
        const ctx = this;


        Log.info("GitHubManager::listRepos(..) - start");

        // GET /orgs/:org/repos
        const uri = ctx.apiPath + '/orgs/' + ctx.org + '/repos?per_page=' + ctx.PAGE_SIZE; // per_page max is 100; 10 is useful for testing pagination though
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

        let rows: { id: number, name: string, url: string }[] = [];
        for (const entry of raw) {
            const id = entry.id;
            const name = entry.name;
            const url = entry.url;
            rows.push({id: id, name: name, url: url});
        }

        return rows;
    }


    public async handlePagination(rpOptions: rp.RequestPromiseOptions): Promise<object[]> {
        Log.info("GitHubActions::handlePagination(..) - start");

        rpOptions.resolveWithFullResponse = true; // in case clients forget
        rpOptions.json = true; // in case clients forget

        const fullResponse = await rp(<any>rpOptions); // rpOptions is the right type already

        let raw: any[] = [];
        let paginationPromises: any[] = [];
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
                (<any>rpOptions).uri = pageUri; // not sure why this is needed
                await this.delay(100); // NOTE: this needs to be slowed down to prevent DNS problems (issuing 10+ concurrent dns requests can be problematic)
                paginationPromises.push(rp(<any>rpOptions));
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
    public async listTeams(): Promise<{ id: number, name: string }[]> {
        Log.info("GitHubManager::listTeams(..) - start");
        const ctx = this;
        const uri = ctx.apiPath + '/orgs/' + ctx.org + '/teams?per_page=' + ctx.PAGE_SIZE; // per_page max is 100; 10 is useful for testing pagination though
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

        let teams: { id: number, name: string }[] = [];
        for (const team of teamsRaw) {
            const id = team.id;
            const name = team.name;
            teams.push({id: id, name: name});
        }

        return teams;
    }


    public listWebhooks(repoName: string): Promise<{}> {
        let ctx = this;
        Log.info("GitHubAction::listWebhooks( " + ctx.org + ", " + repoName + " ) - start");

        return new Promise(function (fulfill, reject) {

            // POST /repos/:owner/:repo/hooks
            const uri = ctx.apiPath + '/repos/' + ctx.org + '/' + repoName + '/hooks';
            let opts = {
                method:  'GET',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName
                },
                json:    true
            };

            rp(opts).then(function (results: any) {
                Log.info("GitHubAction::listWebhooks(..) - success: " + results);
                fulfill(results);
            }).catch(function (err: any) {
                Log.error("GitHubAction::listWebhooks(..) - ERROR: " + err);
                reject(err);
            });
        });
    }

    public addWebhook(repoName: string, webhookEndpoint: string): Promise<boolean> {
        let ctx = this;
        Log.info("GitHubAction::addWebhook( " + ctx.org + ", " + repoName + ", " + webhookEndpoint + " ) - start");

        return new Promise(function (fulfill, reject) {

            // POST /repos/:owner/:repo/hooks
            const uri = ctx.apiPath + '/repos/' + ctx.org + '/' + repoName + '/hooks';
            let opts = {
                method:  'POST',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName
                },
                body:    {
                    "name":   "web",
                    "active": true,
                    "events": ["commit_comment", "push"],
                    "config": {
                        "url":          webhookEndpoint,
                        "content_type": "json"
                    }
                },
                json:    true
            };

            rp(opts).then(function (results: any) {
                Log.info("GitHubAction::addWebhook(..) - success: " + results);
                fulfill(true);
            }).catch(function (err: any) {
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
    public async createTeam(teamName: string, permission: string): Promise<{ teamName: string, githubTeamNumber: number }> {
        let ctx = this;
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
                let id = body.id;
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
        let ctx = this;
        Log.info("GitHubAction::addMembersToTeam( " + teamName + ", ... ) - start; id: " + githubTeamId + "; members: " + JSON.stringify(members));

        return new Promise(function (fulfill, reject) {
            let promises: any = [];
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

            Promise.all(promises).then(function (results: any) {
                Log.info("GitHubAction::addMembersToTeam(..) - success: " + JSON.stringify(results));
                fulfill({teamName: teamName, githubTeamNumber: githubTeamId});
            }).catch(function (err: any) {
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
        let ctx = this;
        Log.info("GitHubAction::addTeamToRepo( " + teamId + ", " + repoName + " ) - start");
        return new Promise(function (fulfill, reject) {

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

            rp(options).then(function () { // body
                Log.info("GitHubAction::addTeamToRepo(..) - success; team: " + teamId + "; repo: " + repoName);
                fulfill({githubTeamNumber: teamId, teamName: 'NOTSETHERE'});
            }).catch(function (err: any) {
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
        let ctx = this;
        Log.info("GitHubAction::getTeamNumber( " + teamName + " ) - start");

        return new Promise(function (fulfill, reject) {
            let teamId = -1;
            ctx.listTeams().then(function (teamList: any) {
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
            }).catch(function (err) {
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
        let ctx = this;

        Log.info("GitHubAction::getTeamMembers( " +  teamNumber + " ) - start");
        return new Promise(function (fulfill) {

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
            rp(options).then(function (body: any) {
                Log.info("GitHubAction::getTeamMembers(..) - success"); //  body: " + body);
                let resp = JSON.parse(body);
                let ids: string[] = [];
                for (const result of resp) {
                    ids.push(result.login)
                }

                fulfill(ids);
            }).catch(function (err: any) {
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
        let gh = this;

        let teamNumber = await gh.getTeamNumber(teamName);
        if (teamNumber < 0) {
            Log.warn('GitHubAction::isOnTeam(..) - team: ' + teamName + ' does not exist for org: ' + gh.org);
            return false;
        }

        let teamMembers = await gh.getTeamMembers(teamNumber);
        for (const member of teamMembers) {
            if (member === userName) {
                Log.info('GitHubAction::isOnTeam(..) - user: ' + userName + ' IS on team: ' + teamName + ' for org: ' + gh.org);
                return true;
            }
        }

        Log.info('GitHubAction::isOnTeam(..) - user: ' + userName + ' is NOT on team: ' + teamName + ' for org: ' + gh.org);
        return false;
    }

    public async importRepoFS(importRepo: string, studentRepo: string): Promise<boolean> {
        Log.info('GitHubAction::importRepoFS( ' + importRepo + ', ' + studentRepo + ' ) - start');
        const that = this;

        function addGithubAuthToken(url: string) {
            let start_append = url.indexOf('//') + 2;
            let token = that.gitHubAuthToken;
            let authKey = token.substr(token.indexOf('token ') + 6) + '@';
            // creates "longokenstring@githuburi"
            return url.slice(0, start_append) + authKey + url.slice(start_append);
        }

        const exec = require('child-process-promise').exec;
        const tempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
        const tempPath = tempDir.path;
        const authedStudentRepo = addGithubAuthToken(studentRepo);
        const authedImportRepo = addGithubAuthToken(importRepo);

        return cloneRepo().then(() => {
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

        function cloneRepo() {
            Log.info('GithubManager::importRepoFS(..)::cloneRepo() - cloning: ' + importRepo);
            return exec(`git clone ${authedImportRepo} ${tempPath}`)
                .then(function (result: any) {
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
                .then(function (result: any) {
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
                .then(function (result: any) {
                    Log.info('GithubManager::importRepoFS(..)::removeGitDir() - done:');
                    console.log('GithubManager::importRepoFS(..)::removeGitDir() - stdout: ', result.stdout);
                    console.log('GithubManager::importRepoFS(..)::removeGitDir() - stderr: ', result.stderr);
                });
        }

        function initGitDir() {
            Log.info('GithubManager::importRepoFS(..)::initGitDir() - start');
            return exec(`cd ${tempPath} && git init`)
                .then(function (result: any) {
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
                .then(function (result: any) {
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
                .then(function (result: any) {
                    Log.info('GithubManager::importRepoFS(..)::addFilesToRepo() - done:');
                    Log.trace('GithubManager::importRepoFS(..)::addFilesToRepo() - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::addFilesToRepo() - stderr: ' + result.stderr);
                    }
                });
        }

        function pushToNewRepo() {
            Log.info('GithubManager::importRepoFS(..)::pushToNewRepo() - start');
            let command = `cd ${tempPath} && git push origin master`;
            return exec(command)
                .then(function (result: any) {
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
        return new Promise(function (resolve) {
            let fire = new Date(new Date().getTime() + ms);
            Log.info("GitHubAction::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
            setTimeout(resolve, ms);
        });
    }

    /**
     * Changes permissions for all teams for the given repository
     * @param {string} repoName
     * @param {string} permissionLevel - one of: 'push' 'pull'
     * @returns {Promise<boolean>}
     */
    public setRepoPermission(repoName: string, permissionLevel: string): Promise<boolean> {
        let ctx = this;
        Log.info("GithubAction::setRepoPermission( " + repoName + ", " + permissionLevel + " ) - start");

        return new Promise(function (fulfill, reject) {
            // Check if permissionLevel is one of: {push, pull}
            // We don't want to be able to grant a team admin access!
            if (permissionLevel !== "pull" && permissionLevel !== "push") {
                Log.error("GitHubAction::setRepoPermission(..) - ERROR, Invalid permissionLevel: " + permissionLevel);
                reject(false);
            }
            // Make sure the repo exists
            ctx.repoExists(repoName).then(function (repoExists: boolean) {
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
                    rp(teamOptions).then(function (responseData: any) {
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

                                rp(permissionOptions).then(function () {
                                    Log.info("GitHubAction::setRepoPermission(..) - changed team: " + team.id + " permissions");
                                }).catch(function (err) {
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
            }).catch(function (err) {
                // If we get an error; something went wrong
                Log.error("GitHubAction::setRepoPermission(..) - ERROR: " + JSON.stringify(err));
                reject(err);
            });
        });
    }

}
