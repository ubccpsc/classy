import Log from "../Log";

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
    }
}
