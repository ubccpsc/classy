import * as https from "https";

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

export interface IGithubMessage {
    /**
     * Commit where comment should be made (should be commitURL)
     */
    url: string;

    /**
     * Markdown format
     */
    message: string;
}

export interface IGithubService {
    /**
     * Posts the feedback (in markdown) back to the github url.
     *
     * @param message
     */
    postMarkdownToGithub(message: IGithubMessage): Promise<boolean>;
}

export class GithubService implements IGithubService {

    // this array is only to make testing easier
    public messages: IGithubMessage[] = [];

    public postMarkdownToGithub(message: IGithubMessage): Promise<boolean> {
        return new Promise<boolean>((fulfill, reject) => {
            try {
                Log.info("GithubService::postMarkdownToGithub(..) - Posting markdown to url: " + message.url + "; message: " + message.message);

                if (typeof message.url === "undefined" || message.url === null) {
                    Log.error("GithubService::postMarkdownToGithub(..)  - message.url is required");
                    reject(false);
                }

                if (typeof message.message === "undefined" || message.message === null || message.message.length < 1) {
                    Log.error("GithubService::postMarkdownToGithub(..)  - message.message is required");
                    reject(false);
                }

                const noProtocolUrl = message.url.replace("https://", "");
                const host = noProtocolUrl.substr(0, noProtocolUrl.indexOf("/"));
                const path = noProtocolUrl.substr(host.length, noProtocolUrl.length);

                const options: any = {
                    host,
                    port:    443,
                    path,
                    method:  "POST",
                    headers: {
                        "Content-Type":  "application/json",
                        "User-Agent":    "UBC-CPSC310-AutoTest",
                        "Authorization": "token " + Config.getInstance().getProp(ConfigKey.githubOrgToken)
                    }
                };

                const body: string = JSON.stringify({body: message.message});
                options.headers["Content-Length"] = Buffer.byteLength(body);

                if (Config.getInstance().getProp(ConfigKey.postback) === true) {
                    Log.trace("GithubService::postMarkdownToGithub(..) - request: " + JSON.stringify(options, null, 2));
                    const req = https.request(options, (res: any) => {
                        Log.trace("GithubService::postMarkdownToGithub(..) - response received; status: " + res.statusCode);
                        if (res.statusCode < 300) {
                            // for debugging; if it works, track it in this array
                            this.messages.push(message);
                            fulfill(true);
                        } else {
                            reject(false);
                        }
                    });
                    req.on("error", (err: any) => {
                        Log.error("GithubService::postMarkdownToGithub(..) - failed; ERROR: " + err);
                        reject(false);
                    });
                    req.write(body);
                    // noinspection TypeScriptValidateJSTypes
                    req.end();
                } else {
                    Log.trace("GithubService::postMarkdownToGithub(..) - send skipped (config.postback === false)");
                    this.messages.push(message);
                    fulfill(true);
                }
            } catch (err) {
                Log.error("GithubService::postMarkdownToGithub(..) - ERROR: " + err);
                reject(false);
            }
        });
    }
}
