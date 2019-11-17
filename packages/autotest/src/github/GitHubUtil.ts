import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

import {CommitTarget} from "../../../common/types/ContainerTypes";
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
     * The '#' is required, the 'd' is required, and a number is required.
     *
     * @param message
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
            if (msg.indexOf('\n') > 0) {
                msg = msg.substr(0, msg.indexOf('\n'));
            }
        }

        Log.info("GitHubUtil::parseDeliverableFromComment(..) - ids: " + JSON.stringify(delivIds) +
            "; matches: " + JSON.stringify(matches) + " for msg: " + msg);

        let parsedDelivId = null;
        if (matches) {
            for (const delivId of delivIds) {
                for (let match of matches) {
                    if (parsedDelivId === null) {
                        match = match.replace('#', '');
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
            Log.info("GitHubUtil::parseDeliverableFromComment() - NO MATCH; input: " +
                msg + "; options: " + JSON.stringify(delivIds));
        } else {
            Log.trace("GitHubUtil::parseDeliverableFromComment() - input: " + msg + "; output: " + parsedDelivId);
        }
        return parsedDelivId;
    }

    public static parseCommandFromComment(message: any, cmd: string): boolean {
        if (message.indexOf(`#${cmd}`) >= 0) {
            Log.trace(`GitHubUtil::parseCommandFromComment() - input: ${message}; ${cmd}: true`);
            return true;
        }
        Log.trace(`GitHubUtil::parseCommandFromComment() - input: ${message}; ${cmd}: false`);
        return false;
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
     * @returns {ICommentEvent}
     */
    public static async processComment(payload: any): Promise<CommitTarget> {
        try {
            Log.info("GitHubUtil::processComment(..) - start");
            const commitSHA = payload.comment.commit_id;
            let commitURL = payload.comment.html_url;  // this is the comment Url
            commitURL = commitURL.substr(0, commitURL.lastIndexOf("#")); // strip off the comment reference

            const postbackURL = payload.repository.commits_url.replace("{/sha}", "/" + commitSHA) + "/comments";

            // NEXT: need cloneURL
            const cloneURL = String(payload.repository.clone_url);
            const requestor = String(payload.comment.user.login); // .toLowerCase();
            const message = payload.comment.body;

            Log.info("GitHubUtil::processComment(..) - 1");

            const cp = new ClassPortal();
            const config = await cp.getConfiguration();
            const delivId = GitHubUtil.parseDeliverableFromComment(message, config.deliverableIds);

            Log.info("GitHubUtil::processComment(..) - 2");

            const flags: string[] = [];
            for (const command of ['force', 'silent', 'check', 'schedule', 'unschedule']) {
                if (GitHubUtil.parseCommandFromComment(message, command)) {
                    flags.push(`#${command}`);
                }
            }

            const botName = "@" + Config.getInstance().getProp(ConfigKey.botName).toLowerCase();
            const botMentioned: boolean = message.toLowerCase().indexOf(botName) >= 0;

            const repoId = payload.repository.name;

            Log.info("GitHubUtil::processComment(..) - 3");

            // const timestamp = new Date(payload.comment.updated_at).getTime(); // updated so they can't add requests to a past comment
            const timestamp = Date.now(); // set timestamp to the time the commit was made

            // need to get this from portal backend (this is a gitHubId, not a personId)
            const personResponse = await cp.getPersonId(requestor); // NOTE: this returns Person.id, id, not Person.gitHubId!
            const personId = personResponse.personId;
            let kind = 'standard'; // if #check, set that here
            if (flags.indexOf("#check") >= 0) {
                kind = 'check';
            }

            Log.info("GitHubUtil::processComment(..) - 4");

            const commentEvent: CommitTarget = {
                delivId,
                repoId,
                botMentioned,
                commitSHA,
                commitURL,
                postbackURL,
                cloneURL,
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

            Log.info("GitHubUtil.processComment(..) - who: " + requestor + "; repoId: " +
                repoId + "; botMentioned: " + botMentioned + "; message: " + msg);
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
     * @param payload
     * @returns {IPushEvent}
     */
    public static async processPush(payload: any, portal: IClassPortal): Promise<CommitTarget | null> {
        try {
            Log.trace("GitHubUtil::processPush(..) - start");
            const repo = payload.repository.name;
            const projectURL = payload.repository.html_url;
            const cloneURL = payload.repository.clone_url;
            const ref = payload.ref;
            Log.info("GitHubUtil::processPush(..) - repo: " + repo + "; projectURL: " + projectURL + "; ref: " + ref);

            if (payload.deleted === true && payload.head_commit === null) {
                // commit deleted a branch, do nothing
                Log.info("GitHubUtil::processPush(..) - branch removed; no further processing - URL: " + projectURL);
                return null;
            }

            let commitURL = '';
            let commitSHA = '';

            if (typeof payload.commits !== "undefined" && payload.commits.length > 0) {
                commitSHA = payload.commits[payload.commits.length - 1].id;
                commitURL = payload.commits[payload.commits.length - 1].url;
                Log.info("GitHubUtil::processPush(..) - regular push; # commits: " + payload.commits.length + "; URL: " + commitURL);
            } else {
                // use this one when creating a new branch (may not have any commits)
                commitSHA = payload.head_commit.id;
                commitURL = payload.head_commit.url;
                Log.info("GitHubUtil::processPush(..) - branch added; URL: " + commitURL);
            }

            Log.info("GitHubUtil::processPush(..) - sha: " + commitSHA + "; commitURL: " + commitURL);
            const postbackURL = payload.repository.commits_url.replace("{/sha}", "/" + commitSHA) + "/comments";

            // this gives the timestamp of the last commit (which could be forged), not the time of the push
            // const timestamp = payload.repository.pushed_at * 1000;
            const timestamp = Date.now(); // it does not matter when the work was done, what matters is when it was submitted

            const backendConfig = await portal.getConfiguration();

            if (backendConfig === null) {
                Log.warn("GitHubUtil::processComment() - no default deliverable for course");
                return null;
            }

            const pushEvent: CommitTarget = {
                delivId:      backendConfig.defaultDeliverable,
                repoId:       repo,
                botMentioned: false, // not explicitly invoked
                personId:     null, // not explicitly requested
                kind:         'push',
                cloneURL,
                commitSHA,
                commitURL,
                postbackURL,
                timestamp,
                ref
            };

            Log.info("GitHubUtil::processPush(..) - done");
            Log.trace("GitHubUtil::processPush(..) - done; pushEvent:", pushEvent);
            return pushEvent;
        } catch (err) {
            Log.error("GitHubUtil::processPush(..) - ERROR parsing: " + err);
            Log.error("GitHubUtil::processPush(..) - ERROR payload: " + JSON.stringify(payload, null, 2));
            return null;
        }
    }

    public static async postMarkdownToGithub(message: IGitHubMessage): Promise<boolean> {
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

            // find a better short string for logging
            let loggingMessage = message.message;
            if (loggingMessage.indexOf('\n') > 0) {
                loggingMessage = loggingMessage.substr(0, loggingMessage.indexOf('\n'));
            }
            if (loggingMessage.length > 80) {
                loggingMessage = loggingMessage.substr(0, 80) + "...";
            }

            Log.info("GitHubUtil::postMarkdownToGithub(..) - Posting markdown to url: " +
                message.url + "; message: " + loggingMessage);

            const body: string = JSON.stringify({body: message.message});
            const options: any = {
                method:  "POST",
                headers: {
                    "Content-Type":  "application/json",
                    "User-Agent":    "UBC-AutoTest",
                    "Authorization": Config.getInstance().getProp(ConfigKey.githubBotToken)
                },
                body:    body
            };

            if (Config.getInstance().getProp(ConfigKey.postback) === true) {
                try {
                    await rp(message.url, options);
                    Log.info("GitHubUtil::postMarkdownToGithub(..) - success for url: " + message.url);
                } catch (err) {
                    Log.error("GitHubUtil::postMarkdownToGithub(..) - ERROR: " + err);
                    return false;
                }
            } else {
                Log.info("GitHubUtil::postMarkdownToGithub(..) - send skipped (config.postback === false) for url: " + message.url);
            }
        } catch (err) {
            Log.error("GitHubUtil::postMarkdownToGithub(..) - ERROR: " + err);
            return false;
        }
        return true;
    }
}
