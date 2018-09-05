import restify = require('restify');
import Log from "../../../../../common/Log";

import {Payload, StatusPayload} from "../../../../../common/types/SDMMTypes";
import {AuthController} from "../../controllers/AuthController";
import {GitHubActions} from "../../controllers/GitHubActions";
import {GitHubController} from "../../controllers/GitHubController";
import {SDMMController} from "../../controllers/SDMM/SDMMController";

import IREST from "../IREST";

export default class SDMMREST implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.trace('SDMMREST::registerRoutes() - start');

        server.post('/portal/sdmm/performAction/:action/', SDMMREST.performAction);
        server.post('/portal/sdmm/performAction/:action/:param', SDMMREST.performAction);
        server.get('/portal/sdmm/currentStatus', SDMMREST.getCurrentStatus);
    }

    public static handleError(code: number, msg: string, res: any, next: any) {
        Log.error('SDMMREST::handleError(..) - ERROR: ' + msg);
        res.send(code, {failure: {message: msg, shouldLogout: false}});
        return next(false);
    }

    public static performAction(req: any, res: any, next: any) {
        Log.info('SDMMREST::performAction(..) - /performAction - start');
        const user = req.headers.user;
        const token = req.headers.token;

        const action = req.params.action;
        const param = req.params.param; // might not be set

        const ac = new AuthController();
        ac.isValid(user, token).then(function(isValid) {
            if (isValid === true) {
                const sc: SDMMController = new SDMMController(new GitHubController(GitHubActions.getInstance()));
                if (action === 'provisionD0') {
                    sc.provisionDeliverable("d0", [user]).then(function(provisionResult) {
                        Log.trace('SDMMREST::performAction(..) - sending 200; result: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function(err) {
                        return SDMMREST.handleError(400, err.message, res, next);
                        // return SDMMREST.handleError(400, "SDMMREST::performAction(..) d0 provision failed.", res, next);
                    });
                } else if (action === 'provisionD1individual') {
                    sc.provisionDeliverable("d1", [user]).then(function(provisionResult) {
                        Log.info('SDMMREST::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function(err) {
                        // return SDMMREST.handleError(400, "SDMMREST::performAction(..) d1 individual provision failed.", res, next);
                        return SDMMREST.handleError(400, err.message, res, next);
                    });
                } else if (action === 'provisionD1team') {
                    sc.provisionDeliverable("d1", [user, param]).then(function(provisionResult) {
                        Log.info('SDMMREST::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function(err) {
                        return SDMMREST.handleError(400, err.message, res, next);
                        // return SDMMREST.handleError(400, "SDMMREST::performAction(..) d1 team provision failed.", res, next);
                    });
                } else {
                    return SDMMREST.handleError(400, "SDMMREST::performAction(..) unknown action: " + action, res, next);
                }
            } else {
                return SDMMREST.handleError(401, "Invalid login token. Please logout and try again.", res, next);
            }
        }).catch(function(err) {
            return SDMMREST.handleError(400, "SDMMREST::performAction(..) failed to perform action. ERROR: " + err.message, res, next);
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
        Log.trace('SDMMREST::getCurrentStatus(..) - /getCurrentStatus - start');
        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        ac.isValid(user, token).then(function(isValid) {
            if (isValid) {
                const sc: SDMMController = new SDMMController(new GitHubController(GitHubActions.getInstance()));
                sc.getStatus(user).then(function(status: StatusPayload) {
                    Log.info('SDMMREST::getCurrentStatus(..) - sending 200; user: ' + user);
                    Log.trace('SDMMREST::getCurrentStatus(..) - sending 200; user: ' + user + '; status: ' + JSON.stringify(status));
                    const ret: Payload = {success: status};
                    res.send(ret);
                }).catch(function(err) {
                    return SDMMREST.handleError(400, "SDMMREST::getCurrentStatus(..) - ERROR: " + err.message, res, next);
                });
            } else {
                return SDMMREST.handleError(401, "Invalid login token. Please logout and try again.", res, next);
            }
        }).catch(function(err) {
            return SDMMREST.handleError(400, "SDMMREST::getCurrentStatus(..) - ERROR: " + err.message, res, next);
        });
    }

}
