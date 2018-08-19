// import * as https from "https";
import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

export interface IGitHubMessage {
    /**
     * Commit where comment should be made (should be commitURL)
     */
    url: string;

    /**
     * Markdown format
     */
    message: string;
}

export interface IGitHubService {
    /**
     * Posts the feedback (in markdown) back to the github url.
     *
     * @param message
     */
    postMarkdownToGithub(message: IGitHubMessage): Promise<boolean>;
}

export class GitHubService implements IGitHubService {

    // this array is only to make testing easier
    public messages: IGitHubMessage[] = [];

    public postMarkdownToGithub(message: IGitHubMessage): Promise<boolean> {
        return new Promise<boolean>((fulfill, reject) => {
            try {
                Log.info("GitHubService::postMarkdownToGithub(..) - Posting markdown to url: " +
                    message.url + "; message: " + message.message);

                if (typeof message.url === "undefined" || message.url === null) {
                    Log.error("GitHubService::postMarkdownToGithub(..)  - message.url is required");
                    reject(false);
                }

                if (typeof message.message === "undefined" || message.message === null || message.message.length < 1) {
                    Log.error("GitHubService::postMarkdownToGithub(..)  - message.message is required");
                    reject(false);
                }

                /*
                const org = Config.getInstance().getProp(ConfigKey.org);
                const hostLength = message.url.indexOf(org);
                const path = 'repos/' + message.url.substr(hostLength);
                const host = Config.getInstance().getProp(ConfigKey.githubAPI);
                */

                const body: string = JSON.stringify({body: message.message});
                const options: any = {
                    method:  "POST",
                    headers: {
                        "Content-Type":  "application/json",
                        "User-Agent":    "UBC-AutoTest",
                        "Authorization": Config.getInstance().getProp(ConfigKey.githubBotToken)
                    },
                    body:    body
                };

                if (Config.getInstance().getProp(ConfigKey.postback) === true) {

                    Log.trace("GitHubService::postMarkdownToGithub(..) - request: " + JSON.stringify(options, null, 2));
                    // const url = host + '/' + path;
                    const url = message.url; // this url comes from postbackURL which uses the right API format
                    return rp(url, options).then(function(res) {
                        Log.trace("GitHubService::postMarkdownToGithub(..) - success"); // : " + res);
                        fulfill(true);
                    }).catch(function(err) {
                        Log.error("GitHubService::postMarkdownToGithub(..) - ERROR: " + err);
                        reject(false);
                    });

                } else {
                    Log.trace("GitHubService::postMarkdownToGithub(..) - send skipped (config.postback === false)");
                    this.messages.push(message);
                    fulfill(true);
                }
            } catch (err) {
                Log.error("GitHubService::postMarkdownToGithub(..) - ERROR: " + err);
                reject(false);
            }
        });
    }
}
