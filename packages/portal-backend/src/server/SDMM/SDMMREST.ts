import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {GitHubController} from "../../controllers/GitHubController";

import {Payload, StatusPayload} from "../../../../common/types/SDMMTypes";
import {SDMMController} from "../../controllers/SDMM/SDMMController";
import {AuthController} from "../../controllers/AuthController";

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

        const action = req.params.action;
        const param = req.params.param; // might not be set

        const handleError = function (msg: string) {
            Log.error('SDMMREST::performAction(..)::handleError(..) - msg: ' + msg);
            const payload: Payload = {failure: {message: msg, shouldLogout: false}};
            res.send(400, payload);
        };

        const ac = new AuthController();
        ac.isValid(user, token).then(function (isValid) {
            if (isValid === true) {
                let sc: SDMMController = new SDMMController(new GitHubController());
                if (action === 'provisionD0') {
                    sc.provision("d0", [user]).then(function (provisionResult) {
                        Log.trace('SDMMREST::performAction(..) - sending 200; result: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function (err) {
                        Log.error('SDMMREST::performAction(..) - d0 provision failed');
                        handleError(err.message);
                    });
                } else if (action === 'provisionD1individual') {
                    sc.provision("d1", [user]).then(function (provisionResult) {
                        Log.info('SDMMREST::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function (err) {
                        Log.error('SDMMREST::performAction(..) - provisionD1individual failed');
                        handleError(err.message);
                    });
                } else if (action === 'provisionD1team') {
                    sc.provision("d1", [user, param]).then(function (provisionResult) {
                        Log.info('SDMMREST::performAction(..) - sending 200; success: ' + JSON.stringify(provisionResult));
                        res.send(provisionResult);
                    }).catch(function (err) {
                        Log.error('SDMMREST::performAction(..) - provisionD1team failed');
                        handleError(err.message);
                    });
                } else {
                    Log.error('SDMMREST::performAction(..) - /performAction - unknown action: ' + action);
                    handleError('Unable to perform action.');
                }
            } else {
                Log.error('SDMMREST::performAction(..) - /performAction - invalid login token');
                const payload: Payload = {failure: {message: 'Invalid login token. Please logout and try again.', shouldLogout: true}};
                res.send(403, payload);
            }
        }).catch(function (err) {
            Log.error('SDMMREST::performAction(..) - ERROR: ' + err);
            handleError('Failed to perform action.');
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

        const handleError = function (msg: string) {
            Log.error('SDMMREST::performAction(..)::getCurrentStatus(..) - msg: ' + msg);
            const payload: Payload = {failure: {message: msg, shouldLogout: false}};
            res.send(400, payload);
        };

        const ac = new AuthController();
        ac.isValid(user, token).then(function (isValid) {
            if (isValid) {
                let sc: SDMMController = new SDMMController(new GitHubController());
                sc.getStatus(user).then(function (status: StatusPayload) {
                    Log.info('SDMMREST::getCurrentStatus(..) - sending 200; user: ' + user);
                    Log.trace('SDMMREST::getCurrentStatus(..) - sending 200; user: ' + user + '; status: ' + JSON.stringify(status));
                    const ret: Payload = {success: status};
                    res.send(ret);
                }).catch(function (err) {
                    Log.error('SDMMREST::getCurrentStatus(..) - getStatus ERROR: ' + err);
                    handleError(err.message);
                });
            } else {
                Log.error('SDMMREST::getCurrentStatus(..) - invalid login token');
                const payload: Payload = {failure: {message: 'Invalid login token. Please logout and try again.', shouldLogout: true}};
                res.send(403, payload);
            }
        }).catch(function (err) {
            Log.error('SDMMREST::getCurrentStatus(..) - ERROR: ' + err);
            handleError('Failed to request status.');
        });
    }

}
