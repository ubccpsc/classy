import fetch, {RequestInit} from "node-fetch";

import Config, {ConfigKey} from "@common/Config";
import {CommitTarget} from "@common/types/ContainerTypes";
import Log from "@common/Log";
import {AutoTestAuthTransport} from "@common/types/PortalTypes";
import Util from "@common/Util";

import {ClassPortal, IClassPortal} from "../autotest/ClassPortal";

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

/**
 * Translator class to turn REST payloads into IPushEvent and ICommentEvents.
 */
export class GitHubUtil {

    /**
     * Identifies all deliverables mentioned in a string.
     * Deliverables _must_ be of the form #d1, #d1223, etc.
     * The "#" is required, the "d" is required, and a number is required.
     *
     * @param message
     * @param {string[]} delivIds
     * @returns {string | null}
     */
    public static parseDeliverableFromComment(message: any, delivIds: string[]): string | null {
        // const matches = message.match("\\S*#d\\d+\\S*"); // just deliverables
        // from https://stackoverflow.com/a/25693471
        const regexp = /(\s|^)\#\w\w+\b/gm;
        const matches = message.match(regexp);

        let msg = message;
        if (msg.length > 40) {
            msg = msg.substr(0, 40) + "...";
            if (msg.indexOf("\n") > 0) {
                msg = msg.substr(0, msg.indexOf("\n"));
            }
        }

        Log.trace("GitHubUtil::parseDeliverableFromComment(..) - ids: " + JSON.stringify(delivIds) +
            "; matches: " + JSON.stringify(matches) + " for msg: " + msg);

        let parsedDelivId = null;
        if (matches) {
            for (const delivId of delivIds) {
                for (let match of matches) {
                    if (parsedDelivId === null) {
                        match = match.replace("#", "");
                        match = match.trim();
                        if (match === delivId) {
                            // present in message and valid
                            parsedDelivId = match;
                        }
                    }
                }
            }
        }

        if (parsedDelivId === null) {
            Log.trace("GitHubUtil::parseDeliverableFromComment() - NO MATCH; input: " +
                msg + "; options: " + JSON.stringify(delivIds));
        } else {
            Log.trace("GitHubUtil::parseDeliverableFromComment() - input: " + msg + "; output: " + parsedDelivId);
        }
        return parsedDelivId;
    }

    public static parseCommandsFromComment(message: string): string[] {
        return [...new Set(message.match(/#[a-zA-Z0-9]+/g) || [])];
    }

    /**
     *
     * Processes a comment on a commit. Sent by GitHub.
     *
     * https://developer.github.com/v3/activity/events/types/#commitcommentevent
     *
     * Throws exception if something goes wrong.
     *
     * @param payload
     * @returns {Promise<CommitTarget>}
     */
    public static async processComment(payload: any): Promise<CommitTarget> {
        try {
            Log.trace("GitHubUtil::processComment(..) - start");
            const start = Date.now();

            const commitSHA = payload.comment.commit_id;
            let commitURL = payload.comment.html_url;  // this is the comment Url
            commitURL = commitURL.substr(0, commitURL.lastIndexOf("#")); // strip off the comment reference

            const postbackURL = payload.repository.commits_url.replace("{/sha}", "/" + commitSHA) + "/comments";

            // NEXT: need cloneURL
            const cloneURL = String(payload.repository.clone_url);
            let orgId;
            try {
                orgId = payload.repository.full_name.substr(0,
                    payload.repository.full_name.lastIndexOf(payload.repository.name) - 1);
                Log.info("GitHubUtil::processComment(..) - full_name: " + payload.repository.full_name +
                    "; name: " + payload.repository.name + "; org: " + orgId);
            } catch (err) {
                Log.warn("GitHubUtil::processComment(..) - failed to parse org: " + err);
            }
            const requester = String(payload.comment.user.login); // .toLowerCase();
            const message = payload.comment.body;

            Log.trace("GitHubUtil::processComment(..) - 1");

            const cp = new ClassPortal();
            const config = await cp.getConfiguration();
            const delivId = GitHubUtil.parseDeliverableFromComment(message, config.deliverableIds);

            Log.trace("GitHubUtil::processComment(..) - 2");

            const flags: string[] = GitHubUtil.parseCommandsFromComment(message);

            const botName = "@" + Config.getInstance().getProp(ConfigKey.botName).toLowerCase();
            const botMentioned: boolean = message.toLowerCase().indexOf(botName) >= 0;

            const repoId = payload.repository.name;

            Log.trace("GitHubUtil::processComment(..) - 3");

            // const timestamp = new Date(payload.comment.updated_at).getTime(); // updated so they can"t add requests to a past comment
            const timestamp = Date.now(); // set timestamp to the time the commit was made

            // need to get this from portal backend (this is a gitHubId, not a personId)
            const personResponse = await cp.getPersonId(requester); // NOTE: this returns Person.id, id, not Person.gitHubId!
            const personId = personResponse.personId;

            let adminRequest = false;
            const authLevel: AutoTestAuthTransport = await cp.isStaff(personId);
            if (authLevel.isStaff === true || authLevel.isAdmin === true) {
                adminRequest = true;
            }

            let kind = "standard"; // if #check, set that here
            if (flags.indexOf("#check") >= 0) {
                kind = "check";
            }

            Log.trace("GitHubUtil::processComment(..) - 4");

            const commentEvent: CommitTarget = {
                delivId,
                repoId,
                orgId,
                botMentioned,
                commitSHA,
                commitURL,
                postbackURL,
                cloneURL,
                adminRequest,
                personId,
                kind,
                timestamp,
                flags
            };

            let msg = message;
            if (msg.length > 40) {
                msg = msg.substr(0, 40) + "...";
                if (msg.indexOf("\n") > 0) {
                    msg = msg.substring(0, msg.indexOf("\n"));
                }
            }

            Log.info("GitHubUtil.processComment(..) - done; who: " + requester + "; repoId: " +
                repoId + "; botMentioned: " + botMentioned + "; message: " + msg + "; took: " + Util.took(start));
            Log.trace("GitHubUtil::processComment(..) - done; commentEvent:", commentEvent);

            // Log.trace("GitHubUtil::processComment(..) - handling: " + JSON.stringify(commentEvent, null, 2));
            return commentEvent;
        } catch (err) {
            Log.error("GitHubUtil::processComment(..) - ERROR parsing: " + err);
            Log.error("GitHubUtil::processComment(..) - ERROR payload: ", payload);
            return null;
        }
    }

    /**
     *
     * Processes a push event. Sent by GitHub.
     *
     * https://developer.github.com/v3/activity/events/types/#pushevent
     *
     * Throw an exception if something goes wrong.
     *
     * Returns null for push operations we do not need to handle (like branch deletion).
     *
     * @param {any} payload
     * @param {IClassPortal} portal
     * @returns {CommitTarget | null} null for pushes that should be ignored
     */
    public static async processPush(payload: any, portal: IClassPortal): Promise<CommitTarget | null> {
        try {
            Log.trace("GitHubUtil::processPush(..) - start");
            const start = Date.now();

            const repo = payload.repository.name;
            const projectURL = payload.repository.html_url;
            const cloneURL = payload.repository.clone_url;
            const ref = payload.ref;

            const cp = new ClassPortal();
            const pusher = await cp.getPersonId(payload.pusher.name);
            let org;
            try {
                org = payload.repository.full_name.substr(0,
                    payload.repository.full_name.lastIndexOf(payload.repository.name) - 1);
                Log.info("GitHubUtil::processPush(..) - full_name: " + payload.repository.full_name +
                    "; org: " + org + "; name: " + payload.repository.name);
            } catch (err) {
                Log.warn("GitHubUtil::processPush(..) - failed to parse org: " + err);
            }

            Log.info("GitHubUtil::processPush(..) - processing - repo: " + repo + "; ref: " + ref);

            if (payload.deleted === true && payload.head_commit === null) {
                // commit deleted a branch, do nothing
                Log.info("GitHubUtil::processPush(..) - branch removed; no further processing - URL: " + projectURL);
                return null;
            }

            let commitURL = "";
            let commitSHA = "";

            if (typeof payload.commits !== "undefined" && payload.commits.length > 0) {
                commitSHA = payload.commits[payload.commits.length - 1].id;
                commitURL = payload.commits[payload.commits.length - 1].url;
                Log.info("GitHubUtil::processPush(..) - regular push; repo: " + repo + "; # commits: " + payload.commits.length);
            } else {
                // use this one when creating a new branch (may not have any commits)
                commitSHA = payload.head_commit.id;
                commitURL = payload.head_commit.url;
                Log.info("GitHubUtil::processPush(..) - branch added; repo: " + repo);
            }

            Log.trace("GitHubUtil::processPush(..) - repo: " + repo + "; sha: " + commitSHA);
            const postbackURL = payload.repository.commits_url.replace("{/sha}", "/" + commitSHA) + "/comments";

            // this gives the timestamp of the last commit (which could be forged), not the time of the push
            // const timestamp = payload.repository.pushed_at * 1000;
            const timestamp = Date.now(); // it does not matter when the work was done, what matters is when it was submitted

            const backendConfig = await portal.getConfiguration();

            if (backendConfig === null) {
                Log.warn("GitHubUtil::processComment() - no default deliverable for course");
                return null;
            }

            let isAdmin = false;
            if (pusher?.personId) {
                // see if this pusher is an admin so their requests can be prioritized
                // (many admin scripts cause push events, and we do not want these
                // to be put on the low priority queue)
                const perms = await cp.isStaff(pusher.personId);
                if (perms.isStaff === true || perms.isAdmin === true) {
                    isAdmin = true;
                }
            }

            const pushEvent: CommitTarget = {
                delivId: backendConfig.defaultDeliverable,
                repoId: repo,
                orgId: org,
                botMentioned: false, // not explicitly invoked
                adminRequest: isAdmin, // let us prioritize admin pushes
                personId: pusher?.personId ?? null,
                kind: "push",
                cloneURL,
                commitSHA,
                commitURL,
                postbackURL,
                timestamp,
                ref
            };

            Log.info("GitHubUtil::processPush(..) - done; repo: " + repo +
                "; SHA: " + Util.shaHuman(commitSHA) + "; took: " + Util.took(start));
            Log.trace("GitHubUtil::processPush(..) - done; pushEvent:", pushEvent);
            return pushEvent;
        } catch (err) {
            Log.error("GitHubUtil::processPush(..) - ERROR parsing: " + err);
            Log.error("GitHubUtil::processPush(..) - ERROR payload: " + JSON.stringify(payload, null, 2));
            return null;
        }
    }

    public static async postMarkdownToGithub(message: IGitHubMessage): Promise<boolean> {
        const start = Date.now();
        try {
            // sanity checking
            if (message === null) {
                Log.error("GitHubUtil::postMarkdownToGithub(..)  - message is required");
                return false;
            }
            if (typeof message.url === "undefined" || message.url === null) {
                Log.error("GitHubUtil::postMarkdownToGithub(..)  - message.url is required");
                return false;
            }
            if (typeof message.message === "undefined" || message.message === null || message.message.length < 1) {
                Log.error("GitHubUtil::postMarkdownToGithub(..)  - message.message is required");
                return false;
            }

            try {
                // find a better short string for logging
                let loggingMessage = message.message;
                if (loggingMessage.indexOf("\n") > 0) {
                    loggingMessage = loggingMessage.substr(0, loggingMessage.indexOf("\n"));
                }
                if (loggingMessage.length > 80) {
                    loggingMessage = loggingMessage.substr(0, 80) + "...";
                }

                const sha = GitHubUtil.commitURLtoSHA(message.url);
                const repo = GitHubUtil.commitURLtoRepoName(message.url);
                Log.info("GitHubUtil::postMarkdownToGithub(..) - Posting markdown for repo: " +
                    repo + "; sha: " + sha + "; message: " + loggingMessage);

            } catch (err) {
                Log.error("GitHubUtil::postMarkdownToGithub(..) - ERROR: " + err.message);
            }

            const body: string = JSON.stringify({body: message.message});
            const options: RequestInit = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "UBC-AutoTest",
                    "Authorization": Config.getInstance().getProp(ConfigKey.githubBotToken)
                },
                body: body
            };

            if (Config.getInstance().getProp(ConfigKey.postback) === true) {
                try {
                    await fetch(message.url, options);
                    Log.info("GitHubUtil::postMarkdownToGithub(..) - posted; took: " + Util.took(start));
                } catch (err) {
                    Log.error("GitHubUtil::postMarkdownToGithub(..) - ERROR: " + err);
                    return false;
                }
            } else {
                Log.info("GitHubUtil::postMarkdownToGithub(..) - send skipped (config.AUTOTEST_POSTBACK === false)");
            }
        } catch (err) {
            Log.error("GitHubUtil::postMarkdownToGithub(..) - ERROR: " + err);
            return false;
        }
        return true;
    }

    /**
     * Returns the repo name from a full commit url.
     * If the parse does not work, the URL itself is returned again.
     *
     * Should work on URLs like:
     * https://github.students.cs.ubc.ca/CPSC310-2022W-T1/project_team094/commit/47046cae35a31083761788d9fce80e85ca77f6d5
     * https://github.students.cs.ubc.ca/CPSC310-2022W-T1/project_team094/commits/47046cae35a31083761788d9fce80e85ca77f6d5/comments
     *
     * @param string
     */
    public static commitURLtoRepoName(commitURL: string): string {
        try {
            if (commitURL.indexOf("/commit") > 0) {
                let repo = commitURL;
                repo = repo.substring(repo.lastIndexOf("/", repo.indexOf("/commit") - 1) + 1, repo.indexOf("/commit"));
                return repo;
            }
        } catch (err) {
            // ignored
        }
        return commitURL;
    }

    /**
     * Returns the repo name from a full commit url.
     * If the parse does not work, the URL itself is returned again.
     *
     * Should work on URLs like:
     * https://github.students.cs.ubc.ca/CPSC310-2022W-T1/project_team094/commits/47046cae35a31083761788d9fce80e85ca77f6d5/comments
     *
     * @param string
     */
    public static commitURLtoSHA(commitURL: string): string {
        try {
            if (commitURL.indexOf("commits/") > 0 && commitURL.indexOf("/comments") > 0) {
                let sha = commitURL;
                sha = sha.substring(sha.indexOf("/commits/") + 9, sha.indexOf("/comments"));
                sha = Util.shaHuman(sha);
                return sha;
            }
        } catch (err) {
            // ignored
        }
        return commitURL;
    }
}
