import * as restify from "restify";
import Config, {ConfigKey} from "../../../common/Config";

import Log from "../../../common/Log";
import {CommitTarget} from "../../../common/types/AutoTestTypes";
import Util from "../../../common/Util";

import {AutoTest} from "../autotest/AutoTest";
import {ClassPortal} from "../autotest/ClassPortal";
import {MongoDataStore} from "../autotest/DataStore";
import {EdXClassPortal} from "../edx/EdxClassPortal";
import {GitHubAutoTest} from "../github/GitHubAutoTest";
import {GitHubService} from "../github/GitHubService";
import {GitHubUtil} from "../github/GitHubUtil";

export default class RouteHandler {

    public static autoTest: AutoTest = null;

    public static getAutoTest(): AutoTest {
        if (RouteHandler.autoTest === null) {

            if (Config.getInstance().getProp(ConfigKey.name) === "sdmm") {
                const data = new MongoDataStore();
                const portal = new EdXClassPortal();
                const gh = new GitHubService();
                RouteHandler.autoTest = new GitHubAutoTest(data, portal);
            } else {
                const data = new MongoDataStore();
                const portal = new ClassPortal();
                const gh = new GitHubService();
                RouteHandler.autoTest = new GitHubAutoTest(data, portal);
            }
        }
        return RouteHandler.autoTest;
    }

    /**
     * Handles GitHub POSTs, currently:
     *  - commit_comment
     *  - push
     */
    public static postGithubHook(req: restify.Request, res: restify.Response, next: restify.Next) {
        const start = Date.now();
        const githubEvent: string = req.header("X-GitHub-Event");
        Log.info("RoutHandler::postGithubHook(..) - start; handling event: " + githubEvent);
        const body = req.body;

        const handleError = function(msg: string) {
            Log.error("RouteHandler::postGithubHook() - failure; ERROR: " + msg + "; took: " + Util.took(start));
            res.json(400, "Failed to process commit.");
        };

        if (githubEvent === 'ping') {
            // github test packet; use to let the webhooks know we are listening
            Log.info("RouteHandler::postGithubHook() - <200> pong.");
            res.json(200, "pong");
        } else {
            RouteHandler.handleWebhook(githubEvent, body).then(function(commitEvent) {
                if (commitEvent !== null) {
                    res.json(200, commitEvent); // report back our interpretation of the hook
                } else {
                    // handleError("Error handling webhook; event: " + githubEvent + "; body: " + JSON.stringify(body, null, 2));
                    handleError("Webhook not handled (if branch was deleted this is normal)");
                }
            }).catch(function(err) {
                Log.error("RouteHandler::postGithubHook() - ERROR: " + err);
                handleError(err);
            });
        }
        return next();
    }

    private static async handleWebhook(event: string, body: string): Promise<CommitTarget> {

        // cast is unfortunate, but if we're listening to these routes it must be a github AT instance
        const at: GitHubAutoTest = RouteHandler.getAutoTest() as GitHubAutoTest;

        switch (event) {
            case "commit_comment":
                const commentEvent = await GitHubUtil.processComment(body);
                Log.trace("RouteHandler::handleWebhook() - comment request: " + JSON.stringify(commentEvent, null, 2));
                await at.handleCommentEvent(commentEvent);
                return commentEvent;
            case "push":
                const pushEvent = await GitHubUtil.processPush(body, new ClassPortal());
                Log.trace("RouteHandler::handleWebhook() - push request: " + JSON.stringify(pushEvent, null, 2));
                await at.handlePushEvent(pushEvent);
                return pushEvent;
            default:
                Log.error("RouteHandler::handleWebhook() - Unhandled GitHub event: " + event);
                throw new Error("Unhandled GitHub hook event: " + event);
        }
    }
}
