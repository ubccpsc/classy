import {ICommentEvent, IPushEvent} from "../Types";
import Log from "../util/Log";

/**
 * Translator class to turn REST payloads into IPushEvent and ICommentEvents.
 */
export class GithubUtil {

    public static getTeamOrProject(repositoryName: string): string {
        // NOTE assume repository name is of the form: CS310-2016Fall/cpsc310project_team10
        const idx = repositoryName.lastIndexOf("_") + 1;
        const val = repositoryName.slice(idx);
        Log.trace("GithubUtil::getTeamOrProject() - input: " + repositoryName + "; output: " + val);
        return val;
    }

    /*
        public static parseDeliverable(fullRepoName: string): string | null {
            const deliverable = fullRepoName.match(/^[^_]+(?=_)/);
            if (deliverable) {
                const val = deliverable.pop();
                Log.trace("GithubUtil::parseDeliverable() - input: " + fullRepoName + "; output: " + val);
                return val;
            }
            return null;
        }
    */

    public static parseDeliverableFromComment(message: any): string | null {
        const matches = message.match("\\S*d\\d+\\S*");
        if (matches) {
            let deliv = matches.pop();
            deliv = deliv.replace(/[^a-z0-9]/gi, ""); // replace all non-alphanumeric with empty string
            Log.trace("GithubUtil::parseDeliverableFromComment() - input: " + message + "; output: " + deliv);
            return deliv;
        }
        return null;
    }

    /**
     * Throws exception if something goes wrong.
     *
     * @param payload
     * @returns {ICommentEvent}
     */
    public static processComment(payload: any): ICommentEvent {
        try {
            const commitSHA = payload.comment.commit_id;
            let commitURL = payload.comment.html_url;  // this is the comment Url
            commitURL = commitURL.substr(0, commitURL.lastIndexOf("#")); // strip off the comment reference

            const postbackURL = payload.repository.commits_url.replace("{/sha}", "/" + commitSHA) + "/comments";

            const projectUrl = payload.repository.html_url;
            const repoName = payload.repository.name;
            // that.deliverable = GithubUtil.parseDeliverable(payload.repository.name);
            const team = GithubUtil.getTeamOrProject(repoName);
            const requestor = String(payload.comment.user.login).toLowerCase();
            // that.user = String(payload.comment.user.login).toLowerCase();
            const orgName = payload.organization.login;
            // const commitCommentUrl = payload.comment.html_url;
            // that.repo = payload.repository.name;
            // const hook = Url.parse(payload.repository.commits_url.replace("{/sha}", "/" + this.commit) + "/comments");
            const message = payload.comment.body;
            const delivId = GithubUtil.parseDeliverableFromComment(message);

            // that.isRequest = payload.comment.body.toLowerCase().includes(this.config.getMentionTag());
            // that.isProcessed = true;
            const botMentioned: boolean = message.indexOf("@autobot") >= 0; // should not be hardcoded

            const timestamp = new Date(payload.comment.updated_at).getTime(); // updated so they can't add requests to a past comment

            const courseId: any = null; // not yet known
            // TODO: check all of these
            const commentEvent: ICommentEvent = {
                botMentioned,
                commitSHA,
                commitURL,
                postbackURL,
                userName: requestor,
                courseId,
                delivId,
                timestamp
            };

            return commentEvent;
        } catch (err) {
            Log.info("GithubUtil::processComment(..) - ERROR parsing: " + err);
            Log.info("GithubUtil::processComment(..) - ERROR payload: " + JSON.stringify(payload));
            return null;
        }
    }

    /**
     * Throw an exception if something goes wrong.
     *
     * Returns null for push operations we do not need to handle (like branch deletion).
     *
     * @param payload
     * @returns {IPushEvent}
     */
    public static processPush(payload: any): IPushEvent | null {
        try {
            // const team = GithubUtil.getTeamOrProject(payload.repository.name);
            const repo = payload.repository.name;
            const projectURL = payload.repository.html_url;
            const cloneURL = payload.repository.clone_url;

            if (payload.deleted === true && payload.head_commit === null) {
                // commit deleted a branch, do nothing
                Log.info("GithubUtil::processPush(..) - branch removed; URL: " + projectURL);
                return null;
            }

            // head commit is sometimes null on new branches
            const headCommitURL = payload.head_commit === null ? payload.repository.html_url + "/tree/" + String(payload.ref).replace("refs/heads/", "") : payload.head_commit.url;
            const commitURL = headCommitURL;

            const branch = payload.ref;
            let commitSHA = "";

            if (typeof payload.commits !== "undefined" && payload.commits.length > 0) {
                Log.info("GithubUtil::processPush(..) - regular push; URL: " + headCommitURL);
                commitSHA = payload.commits[0].id;
            } else {
                // use this one when creating a new branch (may not have any commits)
                Log.info("GithubUtil::processPush(..) - branch added; URL: " + headCommitURL);
                commitSHA = payload.head_commit.id;
            }

            const postbackURL = payload.repository.commits_url.replace("{/sha}", "/" + commitSHA) + "/comments";

            const user = String(payload.pusher.name).toLowerCase();
            const githubOrg = payload.repository.owner.name;
            // const commentHook = Url.parse(payload.repository.commits_url.replace("{/sha}", "/" + this._commit) + "/comments");
            const timestamp = payload.repository.pushed_at * 1000;
            const org = payload.repository.organization;

            const pushEvent: IPushEvent = {
                branch,
                repo,
                cloneURL,
                commitSHA,
                commitURL,
                org,
                projectURL,
                postbackURL,
                timestamp
            };
            return pushEvent;
        } catch (err) {
            Log.info("GithubUtil::processPush(..) - ERROR parsing: " + err);
            Log.info("GithubUtil::processPush(..) - ERROR payload: " + JSON.stringify(payload));
            return null;
        }
    }
}

/*
export class Commit {
    private commitString: string;

    constructor(commitString: string) {
        if (!Commit.isValid(commitString)) {
            throw new Error("Invalid commit string.");
        }
        this.commitString = commitString;
    }

    public static isValid(commitString: string): boolean {
        return /^[a-z0-9]{40}$/.test(commitString);
    }

    get short(): string {
        return this.commitString.substring(0, 7);
    }

    public toString(): string {
        return this.commitString;
    }
}
*/
