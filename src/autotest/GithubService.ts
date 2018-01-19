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

    public postMarkdownToGithub(message: IGithubMessage): void {
        Log.info("AutoTestHandler::postMarkdownToGithub(..) - Posting markdown to url: " + message.url + "; message: " + message.message);
        // this.githubMessages.push({commitUrl: commitUrl, feedback: feedback});
        this.messages.push(message);


        // let hookUrl = url.parse(hook);
        /*
        const reqOptions = {
            host:    hook.host,
            port:    443,
            path:    hook.path,
            method:  "POST",
            headers: {
                "Content-Type":  "application/json",
                "User-Agent":    "UBC-CPSC310-AutoTest",
                "Authorization": "token " + this.config.getGithubToken()
            }
        };

        // public async submit(msg: string): Promise<number> {
        const body: string = JSON.stringify({body: msg});
        this.reqOptions.headers["Content-Length"] = Buffer.byteLength(body);

        return new Promise<number>((fulfill, reject) => {
            const req = https.request(this.reqOptions, (res) => {
                // res.on('end', () => {
                //   fulfill(true)
                // });
                fulfill(res.statusCode);
            });
            req.on("error", (err) => {
                reject(err);
            });
            req.write(body);
            req.end();
        });

*/
    }

}
