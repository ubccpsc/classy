import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {GitHubController} from "../../controllers/GitHubController";

import {Payload, StatusPayload} from "../../../../common/types/SDMMTypes";
import {SDMMController} from "../../controllers/SDMM/SDMMController";

export default class SDMMREST implements IREST {

    public constructor() {
    }

    public registerRoutes(server: restify.Server) {
        Log.trace('SDMMREST::registerRoutes() - start');

        server.post('/sdmm/performAction/:action/', SDMMREST.performAction);
        server.post('/sdmm/performAction/:action/:param', SDMMREST.performAction);
        server.get('/sdmm/currentStatus', SDMMREST.getCurrentStatus);
    }

    public static performAction(req: any, res: any, next: any) {
        Log.info('SDMMREST::performAction(..) - /performAction - start');
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const action = req.params.action;
        const param = req.params.param; // might not be set

        // TODO: verify token

        let sc: SDMMController = new SDMMController(new GitHubController());

        if (action === 'provisionD0') {
            sc.provision("d0", [user]).then(function (provisionResult) {
                Log.trace('SDMMREST::performAction(..) - sending 200; result: ' + JSON.stringify(provisionResult));
                res.send(provisionResult);
            }).catch(function (err) {
                Log.trace('SDMMREST::performAction(..) - sending 400');
                res.send(400, {failure: {message: 'Unable to provision d0 repository; please try again later.'}});
            });

        } else if (action === 'provisionD1individual') {
            sc.provision("d1", [user]).then(function (provisionResult) {
                if (typeof provisionResult.success !== 'undefined') {
                    Log.info('SDMMREST::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                } else {
                    Log.info('SDMMREST::performAction(..) - sending 200; failure: ' + JSON.stringify(provisionResult));
                }

                res.send(provisionResult);
            }).catch(function (err) {
                Log.trace('SDMMREST::performAction(..) - sending 400');
                res.send(400, {failure: {message: 'Unable to provision d1 repository; please try again later.'}});
            });
        } else if (action === 'provisionD1team') {
            sc.provision("d1", [user, param]).then(function (provisionResult) {
                if (typeof provisionResult.success !== 'undefined') {
                    Log.info('SDMMREST::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                } else {
                    Log.info('SDMMREST::performAction(..) - sending 200; failure: ' + JSON.stringify(provisionResult));
                }
                res.send(provisionResult);
            }).catch(function (err) {
                Log.trace('SDMMREST::performAction(..) - sending 400');
                res.send(400, {failure: {message: 'Unable to provision d1 repository; please try again later.'}});
            });

        } else {
            Log.trace('SDMMREST::performAction(..) - /performAction - unknown action: ' + action);
            res.send(404, {error: 'Unknown action'});
        }
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

        // TODO: verify token

        // const org = Config.getInstance().getProp('org');

        let sc: SDMMController = new SDMMController(new GitHubController());
        sc.getStatus(user).then(function (status: StatusPayload) {
            Log.info('SDMMREST::getCurrentStatus(..) - sending 200; user: ' + user);
            Log.trace('SDMMREST::getCurrentStatus(..) - sending 200; user: ' + user + '; status: ' + JSON.stringify(status));
            const ret: Payload = {success: status};
            res.send(ret);
        }).catch(function (err) {
            Log.info('SDMMREST::getCurrentStatus(..) - sending 400');
            res.send(400, {failure: {message: err.message}});
        });
    }

}
