import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {GitTeamTuple} from "../GitHubController";

const tmp = require('tmp-promise');

export class GitHubActions {

    private readonly apiPath: string | null = null;
    private readonly gitHubUserName: string | null = null;
    private readonly gitHubAuthToken: string | null = null;
    private readonly org: string | null = null;

    private DELAY_SEC = 1000;

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
                        Log.info("GitHubAction::deleteRepo(..) - success; body: " + body);
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
                Log.info("GitHubAction::repoExists(..) - true; body: " + body);
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
                    'Accept':        'application/json'
                }
            };

            rp(options).then(function (body: any) {
                Log.info("GitHubAction::deleteTeam(..) - success; body: " + body);
                fulfill(true);
            }).catch(function () { // err: any
                Log.error("GitHubAction::deleteTeam(..) - failed");
                fulfill(false);
            });
        });
    }

    /**
     *
     * @returns {Promise<string>}
     */
    public listRepos(): Promise<string> {
        let ctx = this;

        Log.info("GitHubAction::listRepos( " + ctx.org + " ) - start");
        return new Promise(function (fulfill, reject) {

            // GET /orgs/:org/repos
            const uri = ctx.apiPath + '/orgs/' + ctx.org + '/repos';
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
     * Lists the teams for the current org.
     * @returns {Promise<string>}
     */
    public listTeams(): Promise<string> {
        let ctx = this;

        Log.info("GitHubAction::listTeams( " + ctx.org + " ) - start");
        return new Promise(function (fulfill, reject) {

            // GET /orgs/:org/repos
            const uri = ctx.apiPath + '/orgs/' + ctx.org + '/teams';
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
                Log.error("GitHubAction::listTeams(..) - ERROR: " + JSON.stringify(err) + '\n; for URI: ' + uri);
                reject(err);
            });

        });
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
            const theTeamExists = await this.getTeamNumber(teamName) >= 0;
            Log.info('teamexstsvalue: ' + theTeamExists);
            if (theTeamExists === true) {
                const teamNumber = await this.getTeamNumber(teamName);
                return {teamName: teamName, githubTeamNumber: teamNumber};
            } else {
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
                Log.info("GitHubAction::createTeam(..) - success: " + id);
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
        Log.info("GitHubAction::getTeamNumber( " + ctx.org + ", " + teamName + " ) - start");

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
                    Log.warn('GitHubAction::getTeamNumber(..) - WARN: Could not find team: ' + teamName);
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

        Log.info("GitHubAction::getTeamMembers( " + ctx.org + ", " + teamNumber + " ) - start");
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

            // NOTE: not sure how this will respond to paging if there are lots of teams
            rp(options).then(function (body: any) {
                Log.info("GitHubAction::getTeamMembers(..) - success; body: " + body);
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
        Log.trace('GitHubController::isOnAdminTeam( ' + userName + ' ) - result: ' + isAdmin);
        return isAdmin;
    }

    public async isOnStaffTeam(userName: string): Promise<boolean> {
        const isStaff = await this.isOnTeam('staff', userName);
        Log.trace('GitHubController::isOnStaffTeam( ' + userName + ' ) - result: ' + isStaff);
        return isStaff;
    }

    private async isOnTeam(teamName: string, userName: string): Promise<boolean> {
        let gh = this;

        let teamNumber = await gh.getTeamNumber(teamName);
        if (teamNumber < 0) {
            Log.warn('GitHubController::isOnTeam(..) - team: ' + teamName + ' does not exist for org: ' + gh.org);
            return false;
        }

        let teamMembers = await gh.getTeamMembers(teamNumber);
        for (const member of teamMembers) {
            if (member === userName) {
                Log.info('GitHubController::isOnTeam(..) - user: ' + userName + ' IS on team: ' + teamName + ' for org: ' + gh.org);
                return true;
            }
        }

        Log.info('GitHubController::isOnTeam(..) - user: ' + userName + ' is NOT on team: ' + teamName + ' for org: ' + gh.org);
        return false;
    }

    public async importRepoFS(importRepo: string, studentRepo: string, seedFilePath?: string): Promise<boolean> {
        Log.info('GitHubAction::importRepoFS( ' + importRepo + ', ' + studentRepo + ' ) - start');
        const that = this;

        function addGithubAuthToken(url: string) {
            let start_append = url.indexOf('//') + 2;
            let token = that.gitHubAuthToken;
            // let token = that.gitHubUserName;

            let authKey = token.substr(token.indexOf('token ') + 6) + '@';
            // let authKey = token + '@';
            // creates "longokenstring@githuburi"
            return url.slice(0, start_append) + authKey + url.slice(start_append);
        }

        const exec = require('child-process-promise').exec;
        const tempDir = await tmp.dir({dir: '/tmp', unsafeCleanup: true});
        const tempPath = tempDir.path;
        const authedStudentRepo = addGithubAuthToken(studentRepo);
        const authedImportRepo = addGithubAuthToken(importRepo);

        if(seedFilePath) {
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
                .then(function (result: any) {
                    Log.info('GithubManager::importRepoFS(..)::moveFiles(..) - done');
                    Log.trace('GithubManager::importRepoFS(..)::moveFiles(..) - stdout: ' + result.stdout);
                    if (result.stderr) {
                        Log.warn('GithubManager::importRepoFS(..)::moveFiles(..) - stderr: ' + result.stderr);
                    }
                });
        }

        function cloneRepo(path: string) {
            Log.info('GithubManager::importRepoFS(..)::cloneRepo() - cloning: ' + importRepo);
            return exec(`git clone ${authedImportRepo} ${path}`)
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

    private delay(ms: number): Promise<{}> {
        // logger.info("GitHubManager::delay( " + ms + ") - start");
        return new Promise(function (resolve) {
            let fire = new Date(new Date().getTime() + ms);
            Log.info("GitHubAction::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
            setTimeout(resolve, ms);
        });
    }

}
