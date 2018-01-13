import Log from "../Log";

export interface IGithubService {
    /**
     * Posts the feedback (in markdown) back to the github url.
     *
     * @param commitUrl
     * @param feedback
     */
    postMarkdownToGithub(commitUrl: string, feedback: string): void;
}

export class DummyGithubService implements IGithubService {

    public postMarkdownToGithub(commitUrl: string, feedback: string): void {
        Log.info("AutoTestHandler::postMarkdownToGithub(..) - Posting markdown to url: " + commitUrl);
        // this.githubMessages.push({commitUrl: commitUrl, feedback: feedback});
    }
}
