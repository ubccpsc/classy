import Log from "../Log";
import {ICommentEvent, IPushEvent} from "../Types";

export class GithubUtil {

    public static getTeamOrProject(repositoryName: string): string {
        // NOTE assume repository name is of the form: CS310-2016Fall/cpsc310project_team10
        const idx = repositoryName.lastIndexOf("_") + 1;
        const val = repositoryName.slice(idx);
        Log.trace("GithubUtil::getTeamOrProject() - input: " + repositoryName + "; output: " + val);
        return val;
    }

    public static parseDeliverable(fullRepoName: string): string | null {
        const deliverable = fullRepoName.match(/^[^_]+(?=_)/);
        if (deliverable) {
            const val = deliverable.pop();
            Log.trace("GithubUtil::parseDeliverable() - input: " + fullRepoName + "; output: " + val);
            return val;
        }
        return null;
    }

    public static parseDeliverableFromComment(message: any): string | null {
        // if a deliverable is specified, say it here
        return null;
    }

    /**
     * Throws exception if something goes wrong.
     *
     * @param payload
     * @returns {ICommentEvent}
     */
    public static processComment(payload: any): ICommentEvent {
        const commitId = payload.comment.commit_id;
        let commitUrl = payload.comment.html_url;  // this is the comment Url
        commitUrl = commitUrl.substr(0, commitUrl.lastIndexOf("#")); // strip off the comment reference
        const projectUrl = payload.html_url;
        const repoName = payload.repository.name;
        // that.deliverable = GithubUtil.parseDeliverable(payload.repository.name);
        team = GithubUtil.getTeamOrProject(repoName);
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

        // TODO: check all of these
        const commentEvent: ICommentEvent = {
            // branch:     branch,
            repo:      repoName,
            commit:    commitId,
            commitUrl,
            projectUrl,
            userName:  requestor,
            courseId:  null, // not yet known
            delivId,
            timestamp: new Date().getTime() // just create this based on the current time
        };

        return commentEvent;
    }

    /**
     * Throw an exception if something goes wrong.
     *
     * @param payload
     * @returns {IPushEvent}
     */
    public static processPush(payload: any): IPushEvent {
        // TODO: validate result properties; add an interface

        const team = GithubUtil.getTeamOrProject(payload.repository.name);
        const repo = payload.repository.name;
        const projectUrl = payload.repository.html_url;
        // head commit is sometimes null on new branches
        const headCommitUrl = payload.head_commit === null ? payload.repository.html_url + "/tree/" + String(payload.ref).replace("refs/heads/", "") : payload.head_commit.url;
        const commitUrl = headCommitUrl;

        let commit = "";
        if (typeof payload.commits !== "undefined" && payload.commits.length > 0) {
            commit = payload.commits[0].id;
        } // is this right?

        const user = String(payload.pusher.name).toLowerCase();
        // const deliverable = GithubUtil.parseDeliverable(payload.repository.name);
        // const commit = new Commit(payload.after);
        const githubOrg = payload.repository.owner.name;
        // const commentHook = Url.parse(payload.repository.commits_url.replace("{/sha}", "/" + this._commit) + "/comments");
        const ref = payload.ref;
        const timestamp = payload.repository.pushed_at * 1000;

        // const controller: PushController = new PushController(currentCourseNum);
        const pushEvent: IPushEvent = {
            branch: "TBDTBD",
            repo,
            commit,
            commitUrl,
            projectUrl,
            timestamp
        };
        return pushEvent;
    }
}

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
