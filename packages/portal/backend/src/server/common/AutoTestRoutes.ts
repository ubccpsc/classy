import * as rp from "request-promise-native";
import * as restify from 'restify';

import Config, {ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";

import {
    AutoTestAuthPayload,
    AutoTestConfigPayload,
    AutoTestDefaultDeliverablePayload,
    AutoTestGradeTransport,
    AutoTestResultPayload,
    AutoTestResultTransport,
    Payload
} from "../../../../../common/types/PortalTypes";
import {AuthController} from "../../controllers/AuthController";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {GitHubActions} from "../../controllers/GitHubActions";
import {GitHubController} from "../../controllers/GitHubController";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {ResultsController} from "../../controllers/ResultsController";
import {Factory} from "../../Factory";

import IREST from "../IREST";

/**
 * Just a large body of static methods for translating between restify and the remainder of the system.
 */
export class AutoTestRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.info('AutoTestRouteHandler::registerRoutes() - start');

        server.get('/portal/at/defaultDeliverable', AutoTestRoutes.atDefaultDeliverable);
        server.get('/portal/at/isStaff/:githubId', AutoTestRoutes.atIsStaff);
        server.get('/portal/at/personId/:githubId', AutoTestRoutes.atPersonId);
        server.get('/portal/at/container/:delivId', AutoTestRoutes.atContainerDetails);

        server.post('/portal/at/grade/', AutoTestRoutes.atGrade);

        server.post('/portal/at/result/', AutoTestRoutes.atPostResult);
        server.get('/portal/at/result/:delivId/:repoId', AutoTestRoutes.atGetResult);

        server.post('/portal/githubWebhook', AutoTestRoutes.githubWebhook); // forward GitHub Webhooks to AutoTest

        // >SDMM HACK< This is a hack to allow current webhooks on EdX to continue to function
        server.post('/githubWebhook', AutoTestRoutes.githubWebhook); // forward GitHub Webhooks to AutoTest
    }

    public static handleError(code: number, msg: string, res: any, next: any) {
        Log.error('AutoTestRoutes::handleError(..) - ERROR: ' + msg);
        res.send(code, {failure: {message: msg, shouldLogout: false}});
        return next(false);
    }

    public static atContainerDetails(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atContainerDetails(..) - /at/container/:delivId - start GET');

        let payload: AutoTestConfigPayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const delivId = req.params.delivId;
            const name = Config.getInstance().getProp(ConfigKey.name);

            Log.info('AutoTestRouteHandler::atContainerDetails(..) - name: ' + name + '; delivId: ' + delivId);

            const dc = new DeliverablesController();
            dc.getDeliverable(delivId).then(function(deliv) {
                if (deliv !== null) {
                    payload = {success: deliv.autotest};
                    res.send(200, payload);
                    return next(true);
                } else {
                    return AutoTestRoutes.handleError(400, 'Could not retrieve container details.', res, next);
                }
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'Could not retrieve container details.', res, next);
            });
        }
    }

    public static atDefaultDeliverable(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - /defaultDeliverable/:name - start GET');

        let payload: AutoTestDefaultDeliverablePayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {

            const name = Config.getInstance().getProp(ConfigKey.name);
            Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - name: ' + name);

            const cc = Factory.getCourseController(new GitHubController(GitHubActions.getInstance()));
            cc.getCourse().then(function(course) {
                payload = {success: {defaultDeliverable: course.defaultDeliverableId}};
                res.send(200, payload);
                return next(true);
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'No default deliverable found. ', res, next);
            });
        }
    }

    public static atGrade(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atGrade(..) - start');

        let payload: Payload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const gradeRecord: AutoTestGradeTransport = req.body; // turn into json?

            const gc: GradesController = new GradesController();
            const validGradeRecord = gc.validateAutoTestGrade(gradeRecord);
            if (validGradeRecord !== null) {
                return AutoTestRoutes.handleError(400, 'Invalid Grade Record: ' + validGradeRecord, res, next);
            } else {
                Log.info('AutoTestRouteHandler::atGrade(..) - repoId: ' + gradeRecord.repoId +
                    '; delivId: ' + gradeRecord.delivId + '; body: ' + JSON.stringify(gradeRecord));
                const cc = Factory.getCourseController(new GitHubController(GitHubActions.getInstance()));
                cc.processNewAutoTestGrade(gradeRecord).then(function(success: any) {
                    payload = {success: {success: true}};
                    res.send(200, payload);
                    return next(true);
                }).catch(function(err) {
                    return AutoTestRoutes.handleError(400, 'Failed to receive grade; ERROR: ' + err.message, res, next);
                });
            }
        }
    }

    /**
     * Receives the container result from AutoTest and persists it in the database.
     * While the AutoTest container could write the DB directly, this assumes that it
     * is always running on the same host (which we hope to change in the future) and
     * this also gives us a chance to validate the result record before writing it
     * which can be especially helpful especially in terms of debugging.
     *
     * @param req
     * @param res
     * @param next
     */
    public static atPostResult(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atPostResult(..) - start');

        let payload: Payload = null;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const resultRecord: AutoTestResultTransport = req.body;
            // Log.trace('AutoTestRouteHandler::atPostResult(..) - body: ' + JSON.stringify(resultRecord));

            const rc = new ResultsController();
            const validResultRecord = rc.validateAutoTestResult(resultRecord);
            if (validResultRecord !== null) {
                return AutoTestRoutes.handleError(400, 'Invalid Result Record: ' + validResultRecord, res, next);
            } else {
                Log.info('AutoTestRouteHandler::atPostResult(..) - valid result && valid secret; deliv: ' +
                    resultRecord.delivId + '; repo: ' + resultRecord.repoId);
                rc.createResult(resultRecord).then(function(success) {
                    payload = {success: {message: 'Result received'}};
                    res.send(200, payload);
                    return next(true);
                }).catch(function(err) {
                    return AutoTestRoutes.handleError(400, 'Error processing result: ' + err.message, res, next);
                });
            }
        }
    }

    /**
     * Returns whether a githubId is an admin/staff.
     *
     * @param req
     * @param res
     * @param next
     */
    public static async atIsStaff(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atIsStaff(..) - /isStaff/:githubId - start');

        let payload: AutoTestAuthPayload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const githubId = req.params.githubId;

            // Log.info('AutoTestRouteHandler::atIsStaff(..) - personId: ' + githubId);

            const pc = new PersonController();
            const person = await pc.getGitHubPerson(githubId);
            if (person !== null) {
                const ac = new AuthController();
                const priv = await ac.personPriviliged(person);
                payload = {success: {personId: person.githubId, isStaff: priv.isStaff, isAdmin: priv.isAdmin}};
                Log.info('AutoTestRouteHandler::atIsStaff(..) - /isStaff/:githubId - result: ' + JSON.stringify(payload));
                res.send(200, payload);
                return next(true);
            } else {
                payload = {success: {personId: githubId, isStaff: false, isAdmin: false}};
                Log.info('AutoTestRouteHandler::atIsStaff(..) - /isStaff/:githubId - unknown person; result: ' +
                    JSON.stringify(payload));
                res.send(200, payload);
                return next(true);
            }
        }
    }

    public static atPersonId(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atPersonId(..) - /isStaff/:githubId - start GET');

        let payload: Payload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const githubId = req.params.githubId;

            const pc = new PersonController();
            pc.getGitHubPerson(githubId).then(function(person) {
                if (person !== null) {
                    Log.info('AutoTestRouteHandler::atPersonId(..) - personId: ' + person.id + '; githubId: ' + githubId);
                    payload = {success: {personId: person.id}}; // PersonTransportPayload
                    res.send(200, payload);
                    return next(true);
                } else {
                    return AutoTestRoutes.handleError(404, 'Invalid person id: ' + githubId, res, next);
                }
            }).catch(function(err) {
                return AutoTestRoutes.handleError(404, 'Invalid person id: ' + githubId, res, next);
            });
        }
    }

    /**
     * This route forwards GitHub webhooks from the public-facing backend to AutoTest's
     * endpoint (which can be internal and protected).
     *
     * @param req
     * @param res
     * @param next
     */
    public static githubWebhook(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::githubWebhook(..) - start');
        const webhookBody: any = req.body;

        // TODO: is there any way to verify this actually came from GitHub?

        const atHost = Config.getInstance().getProp(ConfigKey.autotestUrl);
        const url = atHost + ':' + Config.getInstance().getProp(ConfigKey.autotestPort) + '/githubWebhook';
        const options = {
            uri:     url,
            method:  'POST',
            json:    true,
            headers: req.headers, // use GitHub's headers
            body:    webhookBody
        };

        return rp(options).then(function(succ) {
            Log.info('AutoTestRouteHandler::githubWebhook(..) - success: ' + JSON.stringify(succ));
            res.send(200, succ); // send interpretation back to GitHub
            next();
        }).catch(function(err) {
            return AutoTestRoutes.handleError(400, 'Error processing webhook: ' + err.message, res, next);
        });
    }

    public static atGetResult(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atGetResult(..) - /at/result/:delivId/:repoId - start GET');

        let payload: AutoTestResultPayload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const delivId = req.params.delivId;
            const repoId = req.params.repoId;

            Log.info('AutoTestRouteHandler::atGetResult(..) - delivId: ' + delivId + '; repoId: ' + repoId);

            const rc = new ResultsController();
            rc.getResult(delivId, repoId).then(function(result) {
                payload = {success: [result]};
                res.send(200, payload);
                return next(true);
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'Error retrieving result record: ' + err.message, res, next);
            });
        }
    }
}
