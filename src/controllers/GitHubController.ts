import Log from "../util/Log";

import * as rp from "request-promise-native";
import {Config} from "../Config";

export class GitHubController {


    public createD0repository(org: string, personId: string) {

    }

    public createD1repository(org: string, teamId: string) {
        // check that the team exists
        // make sure any team members have d0 grade > 60
        // make sure any team members do not already have d1 repos
    }

    public createD3pr(org: string, repoId: string) {

    }


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
     * @param repoName
     * @returns {Promise<{}>}
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


    public listRepos(org: string): Promise<string> {
        let ctx = this;

        Log.info("GitHubAction::listRepos(..) - start");
        return new Promise(function (fulfill, reject) {

            // GET /orgs/:org/repos
            let uri = ctx.apiPath + '/orgs/' + org + '/repos';
            var options = {
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


    private delay(ms: number): Promise<{}> {
        // logger.info("GitHubManager::delay( " + ms + ") - start");
        return new Promise(function (resolve, reject) {
            let fire = new Date(new Date().getTime() + ms);
            Log.info("GitHubManager::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
            setTimeout(resolve, ms);
        });
    }
}