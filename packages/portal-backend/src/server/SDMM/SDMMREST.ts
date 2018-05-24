import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {CourseController} from "../../controllers/CourseController";
import {GitHubController} from "../../controllers/GitHubController";

export default class SDMMREST implements IREST {

    public constructor() {

    }

    public registerRoutes(server: restify.Server) {
        Log.trace("SDMMREST::registerRoutes() - start");

        server.post('/performAction/:action/', SDMMREST.performAction);
        server.post('/performAction/:action/:param', SDMMREST.performAction);
    }

    public static performAction(req: any, res: any, next: any) {
        Log.info('SDMMREST::performAction(..) - /performAction - start');
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const action = req.params.action;
        const param = req.params.param; // might not be set

        // TODO: verify token

        let sc: CourseController = new CourseController(new GitHubController());

        if (action === 'provisionD0') {
            sc.provision(org, "d0", [user]).then(function (provisionResult) {
                Log.trace('RouteHandler::performAction(..) - sending 200; result: ' + JSON.stringify(provisionResult));
                res.send(provisionResult);
            }).catch(function (err) {
                Log.trace('RouteHandler::performAction(..) - sending 400');
                res.send(400, {failure: {message: 'Unable to provision d0 repository; please try again later.'}});
            });

        } else if (action === 'provisionD1individual') {
            sc.provision(org, "d1", [user]).then(function (provisionResult) {
                if (typeof provisionResult.success !== 'undefined') {
                    Log.info('RouteHandler::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                } else {
                    Log.info('RouteHandler::performAction(..) - sending 200; failure: ' + JSON.stringify(provisionResult));
                }

                res.send(provisionResult);
            }).catch(function (err) {
                Log.trace('RouteHandler::performAction(..) - sending 400');
                res.send(400, {failure: {message: 'Unable to provision d1 repository; please try again later.'}});
            });
        } else if (action === 'provisionD1team') {
            sc.provision(org, "d1", [user, param]).then(function (provisionResult) {
                if (typeof provisionResult.success !== 'undefined') {
                    Log.info('RouteHandler::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                } else {
                    Log.info('RouteHandler::performAction(..) - sending 200; failure: ' + JSON.stringify(provisionResult));
                }
                res.send(provisionResult);
            }).catch(function (err) {
                Log.trace('RouteHandler::performAction(..) - sending 400');
                res.send(400, {failure: {message: 'Unable to provision d1 repository; please try again later.'}});
            });

        } else {
            Log.trace('RouteHandler::performAction(..) - /performAction - unknown action: ' + action);
            res.send(404, {error: 'Unknown action'});
        }
    }
}
