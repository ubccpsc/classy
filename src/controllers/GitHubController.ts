import Log from "../util/Log";

import * as rp from "request-promise-native";
import {Config} from "../Config";
import {Repository, Team} from "../Types";

let tmp = require('tmp-promise');


export interface IGitHubController {
    /**
     * This is a complex method that provisions an entire repository.
     *
     * Assumptions: a 'staff' repo must also exist.
     *
     * @param {string} org
     * @param {string} repoName
     * @param {Team[]} teams
     * @param {string} sourceRepo
     * @param {string} webhookAddress
     * @returns {Promise<boolean>}
     */
    provisionRepository(org: string, repoName: string, teams: Team[], sourceRepo: string, webhookAddress: string): Promise<boolean>;

    createPullRequest(org: string, repoName: string, prName: string): Promise<boolean>;

    getRepositoryUrl(repo: Repository): Promise<string>;

    getTeamUrl(team: Team): Promise<string>;
}


export class TestGitHubController implements IGitHubController {
    public async getRepositoryUrl(repo: Repository): Promise<string> {
        return "TESTURL";
    }

    public async getTeamUrl(team: Team): Promise<string> {
        return "TESTURL";
    }

    public async provisionRepository(org: string, repoName: string, teams: Team[], sourceRepo: string, webhookAddress: string): Promise<boolean> {
        Log.error("TestGitHubController::provisionRepository(..) - NOT IMPLEMENTED");
        return true;
    }

    public async createPullRequest(org: string, repoName: string, prName: string): Promise<boolean> {
        Log.error("TestGitHubController::createPullRequest(..) - NOT IMPLEMENTED");
        return true;
    }
}

export class GitHubController implements IGitHubController {
    private gha = new GitHubActions();

    public async getRepositoryUrl(repo: Repository): Promise<string> {
        Log.error("GitHubController::getRepositoryUrl(..) - NOT IMPLEMENTED");
        return "TODO";
    }

    public async getTeamUrl(team: Team): Promise<string> {
        Log.error("GitHubController::getTeamUrl(..) - NOT IMPLEMENTED");
        // const url = this.gha.getTeamNumber()
        return "TODO";
    }

    public async provisionRepository(org: string, repoName: string, teams: Team[], sourceRepo: string, webhookAddress: string): Promise<boolean> {
        Log.error("GitHubController::provisionRepository(..) - NOT IMPLEMENTED");
        return false;
    }

    public async createPullRequest(org: string, repoName: string, prName: string): Promise<boolean> {
        Log.error("GitHubController::createPullRequest(..) - NOT IMPLEMENTED");
        return false;
    }
}

interface GitTeamTuple {
    teamName: string,
    githubTeamNumber: number
}

export class GitHubActions {

    private apiPath: string | null = null;
    private gitHubUserName: string | null = null;
    private gitHubAuthToken: string | null = null;

    private DELAY_SEC = 1000;

    constructor() {
        this.apiPath = Config.getInstance().getProp('githubAPI');
        this.gitHubUserName = Config.getInstance().getProp("githubTokenUser");
        this.gitHubAuthToken = Config.getInstance().getProp("githubToken");
    }

    /**
     * Creates a given repo and returns its url. Will fail if the repo already exists.
     *
     * @param org
     * @param repoName
     * @returns {Promise<string>} provisioned team url
     */
    public createRepo(org: string, repoName: string): Promise<string> {
        let ctx = this;

        Log.info("GitHubAction::createRepo( " + repoName + " ) - start");
        return new Promise(function (fulfill, reject) {

            const uri = ctx.apiPath + '/orgs/' + org + '/repos';
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
                Log.info("GitHubAction::createRepo(..) - success; url: " + url + "; delaying to prep repo.");
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
     * @param org
     * @param repoName
     * @returns {Promise<boolean>}
     */
    public deleteRepo(org: string, repoName: string): Promise<boolean> {
        let ctx = this;

        Log.info("GitHubAction::deleteRepo(..) - start");
        return new Promise(function (fulfill, reject) {

            const uri = ctx.apiPath + '/repos/' + org + '/' + repoName;
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
                Log.info("GitHubAction::deleteRepo(..) - success; body: " + body);
                fulfill(true);
            }).catch(function (err: any) {
                Log.error("GitHubAction::deleteRepo(..) - ERROR: " + JSON.stringify(err));
                reject(err);
            });

        });
    }


    /**
     * Deletes a team
     *
     * @param org
     * @param teamId
     */
    public deleteTeam(org: string, teamId: number): Promise<boolean> {
        let ctx = this;

        Log.info("GitHubAction::deleteTeam(..) - start");
        return new Promise(function (fulfill, reject) {

            const uri = ctx.apiPath + '/teams/' + teamId;//+ org + '/' + repoName;
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
                Log.info("GitHubAction::deleteTeam(..) - success; body: " + body);
                fulfill(true);
            }).catch(function (err: any) {
                Log.error("GitHubAction::deleteTeam(..) - ERROR: " + JSON.stringify(err));
                reject(err);
            });

        });
    }

    /**
     *
     * @param {string} org
     * @returns {Promise<string>}
     */
    public listRepos(org: string): Promise<string> {
        let ctx = this;

        Log.info("GitHubAction::listRepos(..) - start");
        return new Promise(function (fulfill, reject) {

            // GET /orgs/:org/repos
            const uri = ctx.apiPath + '/orgs/' + org + '/repos';
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
                Log.info("GitHubAction::listRepos(..) - success; body: " + body);
                fulfill(JSON.parse(body));
            }).catch(function (err: any) {
                Log.error("GitHubAction::listRepos(..) - ERROR: " + JSON.stringify(err));
                reject(err);
            });

        });
    }

    /**
     *
     * @param {string} org
     * @returns {Promise<string>}
     */
    public listTeams(org: string): Promise<string> {
        let ctx = this;

        Log.info("GitHubAction::listTeams(..) - start");
        return new Promise(function (fulfill, reject) {

            // GET /orgs/:org/repos
            const uri = ctx.apiPath + '/orgs/' + org + '/teams';
            const options = {
                method:  'GET',
                uri:     uri,
                headers: {
                    'Authorization': ctx.gitHubAuthToken,
                    'User-Agent':    ctx.gitHubUserName,
                    'Accept':        'application/json'
                }
            };

            // NOTE: do not know how this will do with paging if there are lots of teams

            rp(options).then(function (body: any) {
                Log.info("GitHubAction::listTeams(..) - success; body: " + body);
                fulfill(JSON.parse(body));
            }).catch(function (err: any) {
                Log.error("GitHubAction::listTeams(..) - ERROR: " + JSON.stringify(err));
                reject(err);
            });

        });
    }


    public listWebhooks(org: string, repoName: string): Promise<{}> {
        let ctx = this;
        Log.info("GitHubAction::listWebhooks(..) - start");

        return new Promise(function (fulfill, reject) {

            // POST /repos/:owner/:repo/hooks
            const uri = ctx.apiPath + '/repos/' + org + '/' + repoName + '/hooks';
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

    public addWebhook(org: string, repoName: string, webhookEndpoint: string): Promise<boolean> {
        let ctx = this;
        Log.info("GitHubAction::addWebhook(..) - start");

        return new Promise(function (fulfill, reject) {

            // POST /repos/:owner/:repo/hooks
            const uri = ctx.apiPath + '/repos/' + org + '/' + repoName + '/hooks';
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
     * @param org
     * @param teamName
     * @param permission 'admin', 'pull', 'push' // admin for staff, push for students
     * @returns {Promise<number>} team id
     */
    public createTeam(org: string, teamName: string, permission: string): Promise<{ teamName: string, githubTeamNumber: number }> {
        let ctx = this;
        Log.info("GitHubAction::createTeam(..) - start");
        return new Promise(function (fulfill, reject) {

            const uri = ctx.apiPath + '/orgs/' + org + '/teams';
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
            rp(options).then(function (body: any) {
                let id = body.id;
                Log.info("GitHubAction::createTeam(..) - success: " + id);
                fulfill({teamName: teamName, githubTeamNumber: id});
            }).catch(function (err: any) {
                Log.error("GitHubAction::createTeam(..) - ERROR: " + err);
                reject(err);
            });
        });
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
        Log.info("GitHubAction::addMembersToTeam(..) - start; id: " + githubTeamId + "; members: " + JSON.stringify(members));

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
     * @param org
     * @param teamId
     * @param repoName
     * @param permission ('pull', 'push', 'admin')
     * @returns {Promise<GitTeamTuple>}
     */
    public addTeamToRepo(org: string, teamId: number, repoName: string, permission: string): Promise<GitTeamTuple> {
        let ctx = this;
        Log.info("GitHubAction::addTeamToRepo( " + teamId + ", " + repoName + " ) - start");
        return new Promise(function (fulfill, reject) {

            const uri = ctx.apiPath + '/teams/' + teamId + '/repos/' + org + '/' + repoName;
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

    public getTeamNumber(org: string, teamName: string): Promise<number> {
        Log.info("GitHubAction::getTeamNumber( " + teamName + " ) - start");
        let ctx = this;

        return new Promise(function (fulfill, reject) {
            let teamId = -1;
            ctx.listTeams(org).then(function (teamList: any) {
                for (const team of teamList) {
                    if (team.name === teamName) {
                        teamId = team.id;
                        Log.info("GitHubAction::getTeamNumber(..) - matched team: " + teamName + "; id: " + teamId);
                    }
                }

                if (teamId < 0) {
                    reject('GitHubAction::getTeamNumber(..) - ERROR: Could not find team: ' + teamName);
                } else {
                    fulfill(teamId);
                }
            }).catch(function (err) {
                Log.error("GitHubAction::getTeamNumber(..) - could not match team: " + teamName + "; ERROR: " + err);
                reject(err);
            });
        });
    }

    public async importRepoFS(org: string, importRepo: string, studentRepo: string): Promise<boolean> {
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
            let command = `pushd ${tempPath} && git push origin master`;
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

    private delay(ms: number): Promise<{}> {
        // logger.info("GitHubManager::delay( " + ms + ") - start");
        return new Promise(function (resolve) {
            let fire = new Date(new Date().getTime() + ms);
            Log.info("GitHubAction::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
            setTimeout(resolve, ms);
        });
    }
}