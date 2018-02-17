import * as restify from "restify";

import {AutoTest} from "../autotest/AutoTest";
import {ClassPortal} from "../autotest/ClassPortal";
import {MongoDataStore} from "../autotest/DataStore";
import {GithubService} from "../autotest/GithubService";
import {GithubUtil} from "../util/GithubUtil";
import Log from "../util/Log";
import Util from "../util/Util";
import {Config} from "../Config";

export default class RouteHandler {

    public static autoTest: AutoTest = null;

    public static getAutoTest(): AutoTest {
        if (RouteHandler.autoTest === null) {

            if (Config.getInstance().getProp("kind") === "ubc") {
                const data = new MongoDataStore();
                const portal = new ClassPortal();
                const gh = new GithubService();
                const courseId = Config.getInstance().getProp('name');
                RouteHandler.autoTest = new AutoTest(courseId, data, portal, gh);
            } else if (Config.getInstance().getProp("kind") === "edx") {
                const data = new MongoDataStore();
                const portal = new ClassPortal(); // TODO: change to edxPortal
                const gh = new GithubService();
                const courseId = Config.getInstance().getProp('name');
                RouteHandler.autoTest = new AutoTest(courseId, data, portal, gh);
            } else {
                Log.error("RouteHandler::getAutoTest() - ERROR; kind not supported");
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

        switch (githubEvent) {
            case "ping":
                // github test packet; use to let the webhooks know we are listening
                Log.info("RouteHandler::postGithubHook() - <200> pong.");
                res.json(200, "pong");
                break;
            case "commit_comment":
                try {
                    let commentEvent = null;
                    try {
                        commentEvent = GithubUtil.processComment(body);
                        Log.info("RouteHandler::handleCommentEvent() - request: " + JSON.stringify(commentEvent, null, 2));
                    } catch (err) {
                        Log.error("RouteHandler::handleCommentEvent() - ERROR parsing payload; err: " + err.message + "; payload: " + JSON.stringify(body, null, 2));
                        throw new Error("Failed to parse comment event payload");
                    }
                    RouteHandler.getAutoTest().handleCommentEvent(commentEvent).then((result: boolean) => { // TODO: validate result properties; add an interface
                        Log.info("RouteHandler::commitComment() - success; result: " + result + "; took: " + Util.took(start));
                        res.json(200, {});
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
                    let pushEvent = null;
                    try {
                        pushEvent = GithubUtil.processPush(body);
                        Log.info("RouteHandler::handlePushEvent() - request: " + JSON.stringify(pushEvent, null, 2));
                    } catch (err) {
                        Log.error("RouteHandler::handlePushEvent() - ERROR parsing payload; err: " + err.message + "; payload: " + JSON.stringify(body, null, 2));
                        throw new Error("Failed to parse push event payload");
                    }
                    RouteHandler.getAutoTest().handlePushEvent(pushEvent).then((result: boolean) => {
                        Log.info("RouteHandler::handlePushEvent() - success: " + result + "; took: " + Util.took(start));
                        res.json(202, {body: "Commit has been queued"});
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
        }
        return next();
    }

    /**
     * Handles GitHub POSTs, currently:
     *  - commit_comment
     *  - push
     */
    public static postXQueue(req: restify.Request, res: restify.Response, next: restify.Next) {
        const start = Date.now();
        // const githubEvent: string = req.header("X-GitHub-Event");
        const body = req.body;
        Log.info("RoutHandler::handleXQueue(..) - start; body: " + body);

        try {
            const xqueueBody = body.xqueue_body;
            const name = xqueueBody.grader_payload;
            const studentResponse = xqueueBody.student_response;

            // DO IT
            const correct = "CORR";
            const score = "SCORE";
            const message = "MESSAGE";

            res.json(200, {"correct": correct, "score": score, "msg": message});
        } catch (err) {
            Log.error("RouteHandler::handleXQueue(..) - ERROR: " + err);
            res.json(400, "Error encountered: " + err);
        }
        return next();
    }

    /*
    protected static parseServerPort(req: restify.Request): number {
        const serverPort = Number(req.headers.host.toString().split(":")[1]);
        Log.trace("RoutHandler::parseServerPort(..) - port: " + serverPort);
        return serverPort;
    }

    protected static parseCourseNum(portNum: number): number {
        // not sure what is happening here
        const courseNum = Number(parseInt(portNum.toString().substring(1), 10));
        Log.trace("RoutHandler::parseCourseNum(..) - port: " + courseNum);
        return courseNum;
    }
    */
}
