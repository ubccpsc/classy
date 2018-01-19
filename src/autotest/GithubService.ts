import {Config} from "../Config";
import Log from "../util/Log";

import * as https from "https";

export interface IGithubMessage {
    /**
     * Commit where comment should be made (should be commitUrl)
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
     * @param commitUrl
     * @param feedback
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
                        "Authorization": "token " + Config.getInstance().getProp("githubToken")
                    }
                };

                const body: string = JSON.stringify({body: message.message});
                options.headers["Content-Length"] = Buffer.byteLength(body);

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
                req.end();
            } catch (err) {
                Log.error("GithubService::postMarkdownToGithub(..) - ERROR: " + err);
                reject(false);
            }
        });
    }
}
