import restify = require('restify');
import Log from "../../../../common/Log";

import {Payload, StatusPayload} from "../../../../common/types/SDMMTypes";
import {AuthController} from "../controllers/AuthController";
import {GitHubActions} from "../controllers/GitHubActions";
import {GitHubController} from "../controllers/GitHubController";
import {CustomCourseController} from "./CustomCourseController";

import IREST from "../server/IREST";

export default class CustomCourseRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.trace('CustomCourseRoutes::registerRoutes() - start');

        server.post('/portal/sdmm/performAction/:action/', CustomCourseRoutes.performAction);
        server.post('/portal/sdmm/performAction/:action/:param', CustomCourseRoutes.performAction);
        server.get('/portal/sdmm/currentStatus', CustomCourseRoutes.getCurrentStatus);

        Log.trace('CustomCourseRoutes::registerRoutes() - done');
    }

    public static handleError(code: number, msg: string, res: any, next: any) {
        Log.error('CustomCourseRoutes::handleError(..) - ERROR: ' + msg);
        res.send(code, {failure: {message: msg, shouldLogout: false}});
        return next(false);
    }

    public static performAction(req: any, res: any, next: any) {
        Log.info('CustomCourseRoutes::performAction(..) - /performAction - start');
        const user = req.headers.user;
        const token = req.headers.token;

        const action = req.params.action;
        const param = req.params.param; // might not be set

        const ac = new AuthController();
        ac.isValid(user, token).then(function(isValid) {
            if (isValid === true) {
                const sc: CustomCourseController = new CustomCourseController(new GitHubController(GitHubActions.getInstance()));
                if (action === 'provisionD0') {
                    sc.provisionDeliverable("d0", [user]).then(function(provisionResult) {
                        Log.trace('CustomCourseRoutes::performAction(..) - sending 200; result: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function(err) {
                        return CustomCourseRoutes.handleError(400, err.message, res, next);
                        // return CustomCourseRoutes.handleError(400, "CustomCourseRoutes::performAction(..) d0 provision failed.",
                        //     res, next);
                    });
                } else if (action === 'provisionD1individual') {
                    sc.provisionDeliverable("d1", [user]).then(function(provisionResult) {
                        Log.info('CustomCourseRoutes::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function(err) {
                        // return CustomCourseRoutes.handleError(400, "CustomCourseRoutes::performAction(..) d1 indvdl provision failed.",
                        //     res, next);
                        return CustomCourseRoutes.handleError(400, err.message, res, next);
                    });
                } else if (action === 'provisionD1team') {
                    sc.provisionDeliverable("d1", [user, param]).then(function(provisionResult) {
                        Log.info('CustomCourseRoutes::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function(err) {
                        return CustomCourseRoutes.handleError(400, err.message, res, next);
                        // return CustomCourseRoutes.handleError(400, "CustomCourseRoutes::performAction(..) d1 team provision failed.",
                        //      res, next);
                    });
                } else if (action === 'patchD3') {
                    sc.provisionDeliverable('d3', [user]).then(function(provisionResult) {
                        Log.info('CustomCourseRoutes::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function(err) {
                        return CustomCourseRoutes.handleError(400, err.message, res, next);
                    });
                } else {
                    return CustomCourseRoutes.handleError(400, "CustomCourseRoutes::performAction(..) unknown action: "
                        + action, res, next);
                }
            } else {
                return CustomCourseRoutes.handleError(401, "Invalid login token. Please logout and try again.", res, next);
            }
        }).catch(function(err) {
            return CustomCourseRoutes.handleError(400, "CustomCourseRoutes::performAction(..) failed to perform action. ERROR: "
                + err.message, res, next);
        });
    }

    /**
     *
     * Return message: Payload.
     *
     * @param req
     * @param res
     * @param next
     */
    public static getCurrentStatus(req: any, res: any, next: any) {
        Log.trace('CustomCourseRoutes::getCurrentStatus(..) - /getCurrentStatus - start');
        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        ac.isValid(user, token).then(function(isValid) {
            if (isValid) {
                const sc: CustomCourseController = new CustomCourseController(new GitHubController(GitHubActions.getInstance()));
                sc.getStatus(user).then(function(status: StatusPayload) {
                    Log.info('CustomCourseRoutes::getCurrentStatus(..) - sending 200; user: ' + user);
                    Log.trace('CustomCourseRoutes::getCurrentStatus(..) - sending 200; user: ' + user + '; status: '
                        + JSON.stringify(status));
                    const ret: Payload = {success: status};
                    res.send(ret);
                }).catch(function(err) {
                    return CustomCourseRoutes.handleError(400, "CustomCourseRoutes::getCurrentStatus(..) - ERROR: "
                        + err.message, res, next);
                });
            } else {
                return CustomCourseRoutes.handleError(401, "Invalid login token. Please logout and try again.", res, next);
            }
        }).catch(function(err) {
            return CustomCourseRoutes.handleError(400, "CustomCourseRoutes::getCurrentStatus(..) - ERROR: " + err.message, res, next);
        });
    }

}
