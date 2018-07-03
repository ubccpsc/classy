import * as restify from "restify";

import Log from "../../../common/Log";
import Util from "../../../common/Util";
import Config, {ConfigKey} from "../../../common/Config";

import {AutoTest} from "../autotest/AutoTest";
import {ClassPortal} from "../autotest/ClassPortal";
import {MongoDataStore} from "../autotest/DataStore";
import {GitHubService} from "../github/GithubService";
import {GitHubUtil} from "../github/GithubUtil";
import {GitHubAutoTest} from "../github/GithubAutoTest";
import {EdXClassPortal} from "../edx/EdxClassPortal";
import {ICommentEvent, IPushEvent} from "../Types";

export default class RouteHandler {

    public static autoTest: AutoTest = null;

    public static getAutoTest(): AutoTest {
        if (RouteHandler.autoTest === null) {

            if (Config.getInstance().getProp(ConfigKey.name) === "secapstone") {
                const data = new MongoDataStore();
                const portal = new EdXClassPortal();
                const gh = new GitHubService();
                RouteHandler.autoTest = new GitHubAutoTest(data, portal, gh);
            } else {
                const data = new MongoDataStore();
                const portal = new ClassPortal();
                const gh = new GitHubService();
                RouteHandler.autoTest = new GitHubAutoTest(data, portal, gh);
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

        // cast is unfortunate, but if we're listening to these routes it must be a github AT instance
        let at: GitHubAutoTest = <GitHubAutoTest>RouteHandler.getAutoTest();

        switch (githubEvent) {
            case "ping":
                // github test packet; use to let the webhooks know we are listening
                Log.info("RouteHandler::postGithubHook() - <200> pong.");
                res.json(200, "pong");
                break;
            case "commit_comment":
                try {
                    let commentEvent: ICommentEvent = null;
                    try {
                        commentEvent = GitHubUtil.processComment(body);
                        Log.info("RouteHandler::handleCommentEvent() - request: " + JSON.stringify(commentEvent, null, 2));
                    } catch (err) {
                        Log.error("RouteHandler::handleCommentEvent() - ERROR parsing payload; err: " + err.message + "; payload: " + JSON.stringify(body, null, 2));
                        throw new Error("Failed to parse comment event payload");
                    }
                    at.handleCommentEvent(commentEvent).then((result: boolean) => { // TODO: validate result properties; add an interface
                        Log.info("RouteHandler::commitComment() - success; result: " + result + "; took: " + Util.took(start));
                        res.json(200, commentEvent); // report back our interpretation of the hook
                    }).catch((err: any) => {
                        Log.error("RouteHandler::commitComment() - failure; ERROR: " + err + "; took: " + Util.took(start));
                        res.json(400, "Failed to process commit comment.");
                    });
                } catch (err) {
                    Log.error("RouteHandler::commitComment() - caught error; ERROR: " + err);
                    res.json(400, "Failed to process commit comment");
                }
                break;
            case "push":
                try {
                    let pushEvent: IPushEvent = null;
                    try {
                        pushEvent = GitHubUtil.processPush(body);
                        Log.info("RouteHandler::handlePushEvent() - request: " + JSON.stringify(pushEvent, null, 2));
                    } catch (err) {
                        Log.error("RouteHandler::handlePushEvent() - ERROR parsing payload; err: " + err.message + "; payload: " + JSON.stringify(body, null, 2));
                        throw new Error("Failed to parse push event payload");
                    }
                    at.handlePushEvent(pushEvent).then((result: boolean) => {
                        Log.info("RouteHandler::handlePushEvent() - success: " + result + "; took: " + Util.took(start));
                        res.json(200, pushEvent); // report back our interpretation of the hook
                    }).catch((err: any) => {
                        Log.error("RouteHandler::handlePushEvent() - error encountered; ERROR: " + err + "; took: " + Util.took(start));
                        res.json(400, "Failed to enqueue commit for testing.");
                    });
                } catch (err) {
                    Log.error("RouteHandler::handlePushEvent() - caught exception; ERROR: " + err);
                    res.json(400, "Failed to enqueue commit for testing.");
                }
                break;
            default:
                Log.warn("RouteHandler::postGithubHook() - Unhandled GitHub event: " + githubEvent);
                res.json(400, "Unhandled GitHub hook event: " + githubEvent);
        }
        return next();
    }

}
