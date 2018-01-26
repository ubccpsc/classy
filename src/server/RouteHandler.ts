import * as restify from "restify";
import {AutoTest} from "../autotest/AutoTest";
import {DummyClassPortal} from "../autotest/ClassPortal";
import {DummyDataStore} from "../autotest/DataStore";
import {GithubService} from "../autotest/GithubService";
import {GithubUtil} from "../util/GithubUtil";
import Log from "../util/Log";
import Util from "../util/Util";

export default class RouteHandler {

    public static autoTest: AutoTest = null;

    public static getAutoTest(): AutoTest {
        if (RouteHandler.autoTest === null) {

            // TODO: create these in server?
            const data = new DummyDataStore();
            const portal = new DummyClassPortal();
            const gh = new GithubService();
            const courseId = "310";

            RouteHandler.autoTest = new AutoTest(courseId, data, portal, gh);
        }
        return RouteHandler.autoTest;
    }

    /**
     *  Get the number of jobs currently waiting or paused in the queue.
     */

    /*
    public static queueStats(req: restify.Request, res: restify.Response, next: restify.Next) {
      Log.info('RouteHandler::queueStats() - <RCV> Queue stats.');
      try {
        let serverPort: number = RequestHelper.parseServerPort(req);
        let currentCourseNum = RequestHelper.parseCourseNum(serverPort);
        let controller: TestJobController = TestJobController.getInstance(currentCourseNum);
        controller.getStats().then(stats => {
          let lenExpQueue: number = stats[1].waiting + stats[1].paused;
          Log.info('RouteHandler::queueStats() - <200> Number of waiting or paused express jobs: ' + lenExpQueue + '.');
          res.json(200, {body: stats});
        }).catch(err => {
          Log.error('RouteHandler::queueStats() - <400> ERROR getting stats: ' + err);
          res.json(400, {error: err});
        });
      } catch(err) {
        Log.error('RouteHandler::queueStats() - <400> ERROR getting stats: ' + err);
        res.json(400, {error: err});
      }
      return next();
    }
  */

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
        // let team: string = "";
        // const serverPort = RouteHandler.parseServerPort(req);
        // const currentCourseNum = RouteHandler.parseCourseNum(serverPort);

        try {
            // const name: string = body.repository.name;
            // team = name.substring(name.indexOf("_") + 1);
        } catch (err) {
            Log.error("RoutHandler::postGithubHook(..) - ERROR extracting repo name: " + err);
        }
        // Log.info("RouteHandler::postGithubHook() - <RVD> X-GitHub-Event " + githubEvent + ".");

        // enumerate GitHub event
        switch (githubEvent) {
            case "ping":
                // github test packet

                Log.info("RouteHandler::postGithubHook() - <200> pong.");
                res.json(200, "pong");
                break;

            case "commit_comment":
                try {
                    // const controller: CommitCommentController = new CommitCommentController(currentCourseNum);
                    // use body
                    const payload: any = body; // JSON.parse(JSON.stringify(body));
                    // Log.info("RouteHandler::handleCommentEvent() - start");

                    let commentEvent;
                    try {
                        commentEvent = GithubUtil.processComment(payload);
                    } catch (err) {
                        Log.error("RouteHandler::handleCommentEvent() - ERROR parsing payload; err: " + err.message + "; payload: " + JSON.stringify(payload, null, 2));
                        throw new Error("Failed to parse comment event payload");
                    }

                    Log.info("RouteHandler::handleCommentEvent() - request: " + JSON.stringify(commentEvent, null, 2));
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
                    const payload = body;

                    // Log.info("RouteHandler::handlePushtEvent() - start");

                    let pushEvent;
                    try {
                        pushEvent = GithubUtil.processPush(payload);
                    } catch (err) {
                        Log.error("RouteHandler::handlePushEvent() - ERROR parsing payload; err: " + err.message + "; payload: " + JSON.stringify(payload, null, 2));
                        throw new Error("Failed to parse push event payload");
                    }

                    Log.info("RouteHandler::handlePushEvent() - request: " + JSON.stringify(pushEvent, null, 2));
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

    /**
     * Handles ResultRecord objects sent from container
     *  - req should container ResultRecord container with payload
     */
    /*
      public static resultSubmission(req: restify.Request, res: restify.Response, next: restify.Next) {
      let body = req.body;
      let serverPort = RequestHelper.parseServerPort(req);
      let currentCourseNum = RequestHelper.parseCourseNum(serverPort);
      let controller: ResultRecordController = new ResultRecordController(currentCourseNum, req.body)
      let resultPayload: ResultPayload = req.body as ResultPayload;
      controller.store()
        .then((result) => {
          Log.info('RouteHandler::resultSubmission() SUCCESS Saved result ' + resultPayload.response.commit + ' for ' +
            resultPayload.response.committer);
          res.json(202, { response: result });
          //
          return next();
        })
        .catch((err) => {
          Log.error('RouteHandler::resultSubmission() ERROR saving ResultRecord' + resultPayload.response.commit + ' for ' +
            resultPayload.response.commitUrl);
          res.json(500, { response: err });
          return next();
        });
    }
  */

    /**
     * Handles StaticHtml Zip files that are sent and included
     * @return object response with success status and HTML static link or error message
     */
    /*
public static staticHtml(req: restify.Request, res: restify.Response, next: restify.Next) {
  let body = req.body;
  let serverPort = RequestHelper.parseServerPort(req);
  let currentCourseNum = RequestHelper.parseCourseNum(serverPort);
  let controller: StaticHtmlController = new StaticHtmlController(req.body);
  controller.extractZipToDir()
    .then((confirmation) => {
      res.json(202, { response: { htmlStaticPath: confirmation } });
      //
      return next();
    })
    .catch((err) => {
      res.json(500, { response: { error: err } });
      return next();
    });
}
*/
}
