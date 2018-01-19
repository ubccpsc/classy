import * as https from "https";
import {Config} from "../Config";
import Log from "../util/Log";

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
    postMarkdownToGithub(message: IGithubMessage): void;
}

export class DummyGithubService implements IGithubService {

    public messages: IGithubMessage[] = [];

    public postMarkdownToGithub(message: IGithubMessage): Promise<number> {
        return new Promise<number>((fulfill, reject) => {
            Log.info("AutoTestHandler::postMarkdownToGithub(..) - Posting markdown to url: " + message.url + "; message: " + message.message);

            // for debugging
            this.messages.push(message);

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

            const req = https.request(options, (res) => {
                Log.trace("AutoTestHandler::postMarkdownToGithub(..) - success; status: " + res.statusCode);
                fulfill(res.statusCode);
            });
            req.on("error", (err) => {
                Log.error("AutoTestHandler::postMarkdownToGithub(..) - ERROR: " + err);
                reject(err);
            });
            req.write(body);
            req.end();
        });
    }
}
