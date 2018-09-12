import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

import {CommitTarget, ICommentEvent, IPushEvent} from "../../../common/types/AutoTestTypes";
import {ClassPortal, IClassPortal} from "../autotest/ClassPortal";

/**
 * Translator class to turn REST payloads into IPushEvent and ICommentEvents.
 */
export class GitHubUtil {

    /**
     * Identifies all deliverables mentioned in a string.
     * Deliverables _must_ be of the form #d1, #d1223, etc.
     * The '#' is required, the 'd' is required, and a number is required.
     *
     * @param message
     * @returns {string | null}
     */
    public static parseDeliverableFromComment(message: any): string | null {
        const matches = message.match("\\S*#d\\d+\\S*"); // \S*#d|a\d+\S*
        if (matches) {
            let deliv = matches.pop();
            deliv = deliv.replace('#', '');
            deliv = deliv.trim();
            // deliv = deliv.replace(/[^a-z0-9]/gi, ""); // replace all non-alphanumeric with empty string
            Log.trace("GitHubUtil::parseDeliverableFromComment() - input: " + message + "; output: " + deliv);
            return deliv;
        }
        return null;
    }

    public static parseSilentFromComment(message: any): boolean {
        if (message.indexOf('#silent') >= 0) {
            Log.trace("GitHubUtil::parseSilentFromComment() - input: " + message + "; silent: true");
            return true;
        }
        Log.trace("GitHubUtil::parseSilentFromComment() - input: " + message + "; silent: false");
        return false;
    }

    public static parseForceFromComment(message: any): boolean {
        if (message.indexOf('#force') >= 0) {
            Log.trace("GitHubUtil::parseForceFromComment() - input: " + message + "; force: true");
            return true;
        }
        Log.trace("GitHubUtil::parseForceFromComment() - input: " + message + "; force: false");
        return false;
    }

    /**
     * Throws exception if something goes wrong.
     *
     * @param payload
     * @returns {ICommentEvent}
     */
    public static async processComment(payload: any): Promise<CommitTarget> {
        try {
            const commitSHA = payload.comment.commit_id;
            let commitURL = payload.comment.html_url;  // this is the comment Url
            commitURL = commitURL.substr(0, commitURL.lastIndexOf("#")); // strip off the comment reference

            const postbackURL = payload.repository.commits_url.replace("{/sha}", "/" + commitSHA) + "/comments";

            // NEXT: need cloneURL
            const cloneURL = String(payload.repository.clone_url);
            const requestor = String(payload.comment.user.login); // .toLowerCase();
            const message = payload.comment.body;
            const delivId = GitHubUtil.parseDeliverableFromComment(message);

            const botName = "@" + Config.getInstance().getProp(ConfigKey.botName).toLowerCase();
            const botMentioned: boolean = message.toLowerCase().indexOf(botName) >= 0;

            const repoId = payload.repository.name;

            // const timestamp = new Date(payload.comment.updated_at).getTime(); // updated so they can't add requests to a past comment
            const timestamp = Date.now(); // set timestamp to the time the commit was made

            // need to get this from portal backend (this is a gitHubId, not a personId)
            const cp = new ClassPortal();
            const personResponse = await cp.getPersonId(requestor); // NOTE: this returns Person.id, id, not Person.gitHubId!

            const commentEvent: CommitTarget = {
                delivId,
                repoId,
                botMentioned,
                commitSHA,
                commitURL,
                postbackURL,
                cloneURL,
                personId: personResponse.personId,
                timestamp
            };
            Log.trace("GitHubUtil::processComment(..) - handling: " + JSON.stringify(commentEvent));
            return commentEvent;
        } catch (err) {
            Log.info("GitHubUtil::processComment(..) - ERROR parsing: " + err);
            Log.info("GitHubUtil::processComment(..) - ERROR payload: " + JSON.stringify(payload));
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
    public static async processPush(payload: any, portal: IClassPortal): Promise<CommitTarget | null> {
        try {
            // const team = GitHubUtil.getTeamOrProject(payload.repository.name);
            const repo = payload.repository.name;
            const projectURL = payload.repository.html_url;
            const cloneURL = payload.repository.clone_url;

            if (payload.deleted === true && payload.head_commit === null) {
                // commit deleted a branch, do nothing
                Log.info("GitHubUtil::processPush(..) - branch removed; URL: " + projectURL);
                return null;
            }

            // head commit is sometimes null on new branches
            const headCommitURL = payload.head_commit === null ?
                payload.repository.html_url + "/tree/" + String(payload.ref).replace("refs/heads/", "") :
                payload.head_commit.url;

            const commitURL = headCommitURL;

            const branch = payload.ref;
            let commitSHA = "";

            if (typeof payload.commits !== "undefined" && payload.commits.length > 0) {
                Log.info("GitHubUtil::processPush(..) - regular push; URL: " + headCommitURL);
                commitSHA = payload.commits[0].id;
            } else {
                // use this one when creating a new branch (may not have any commits)
                Log.info("GitHubUtil::processPush(..) - branch added; URL: " + headCommitURL);
                commitSHA = payload.head_commit.id;
            }

            const postbackURL = payload.repository.commits_url.replace("{/sha}", "/" + commitSHA) + "/comments";

            // this gives the timestamp of the last commit (which could be forged), not the time of the push
            // const timestamp = payload.repository.pushed_at * 1000;
            const timestamp = Date.now(); // it does not matter when the work was done, what matters is when it was submitted

            const delivIdTrans = await portal.getDefaultDeliverableId();

            if (delivIdTrans === null) {
                Log.warn("GitHubUtil::processComment() - no default deliverable for course");
                return null;
            }

            const pushEvent: CommitTarget = {
                delivId:      delivIdTrans.defaultDeliverable,
                repoId:       repo,
                botMentioned: false, // not explicitly invoked
                personId:     null, // not explicitly invoked
                cloneURL,
                commitSHA,
                commitURL,
                postbackURL,
                timestamp
            };
            Log.trace("GitHubUtil::processPush(..) - handling: " + pushEvent);
            return pushEvent;
        } catch (err) {
            Log.info("GitHubUtil::processPush(..) - ERROR parsing: " + err);
            Log.info("GitHubUtil::processPush(..) - ERROR payload: " + JSON.stringify(payload));
            return null;
        }
    }
}
