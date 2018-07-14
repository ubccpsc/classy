import restify = require('restify');
import * as rp from "request-promise-native";

import Config, {ConfigCourses, ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {CourseController} from "../../controllers/CourseController";
import {GitHubController} from "../../controllers/GitHubController";
import {ResultsController} from "../../controllers/ResultsController";
import {
    AutoTestAuthPayload,
    AutoTestConfigPayload,
    AutoTestDefaultDeliverablePayload,
    AutoTestGradeTransport,
    AutoTestResultPayload,
    AutoTestResultTransport,
    Payload,
} from "../../../../common/types/PortalTypes";
import {GradesController} from "../../controllers/GradesController";

/**
 * Just a large body of static methods for translating between restify and the remainder of the system.
 */
export class AutoTestRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.info('AutoTestRouteHandler::registerRoutes() - start');

        server.get('/at/defaultDeliverable', AutoTestRoutes.atDefaultDeliverable);
        server.get('/at/isStaff/:personId', AutoTestRoutes.atIsStaff);
        server.get('/at/container/:delivId', AutoTestRoutes.atContainerDetails);
        server.post('/at/grade/', AutoTestRoutes.atGrade);
        server.post('/at/result/', AutoTestRoutes.atPostResult);
        server.get('/at/result/:delivId/:repoId', AutoTestRoutes.atGetResult);
        server.post('/githubWebhook', AutoTestRoutes.githubWebhook); // forward GitHub Webhooks to AutoTest
    }

    public static atContainerDetails(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atContainerDetails(..) - /at/container/:delivId - start GET');

        let payload: AutoTestConfigPayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            Log.warn('AutoTestRouteHandler::atDefaultDeliverable(..) - Invalid Secret: ' + providedSecret);
            payload = {failure: {message: 'Invalid AutoTest Secret: ' + providedSecret, shouldLogout: true}};
            res.send(400, payload);
        } else {
            const delivId = req.params.delivId;
            const name = Config.getInstance().getProp(ConfigKey.name);

            Log.info('AutoTestRouteHandler::atContainerDetails(..) - name: ' + name + '; delivId: ' + delivId);

            // TODO: this is just a dummy implementation


            if ((name === ConfigCourses.sdmm || name === ConfigCourses.classytest) && delivId !== 'd9997') { // HACK: the && is terrible and is just for testing
                payload = {
                    success: {
                        dockerImage:        'secapstone-grader',
                        studentDelay:       60 * 60 * 12,
                        maxExecTime:        300,
                        regressionDelivIds: [],
                        custom:             {}
                    }
                };
                res.send(200, payload);
            } else {
                payload = {failure: {message: 'Could not retrieve container details', shouldLogout: false}};
                res.send(400, payload);
            }
        }
    }


    public static atDefaultDeliverable(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - /defaultDeliverable/:name - start GET');

        let payload: AutoTestDefaultDeliverablePayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            Log.warn('AutoTestRouteHandler::atDefaultDeliverable(..) - Invalid Secret: ' + providedSecret);
            payload = {failure: {message: 'Invalid AutoTest Secret: ' + providedSecret, shouldLogout: true}};
            res.send(400, payload);
        } else {

            const name = Config.getInstance().getProp(ConfigKey.name);
            Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - name: ' + name);
            
            if (name === ConfigCourses.classytest) { // for testing only
                payload = {success: {defaultDeliverable: 'd0'}};
                res.send(200, payload);
                return;
            }

            const cc = new CourseController(new GitHubController());
            cc.getCourse().then(function (course) {
                payload = {success: {defaultDeliverable: course.defaultDeliverableId}};
                res.send(200, payload);
            }).catch(function (err) {
                payload = {failure: {message: 'No default deliverable found.', shouldLogout: false}};
                res.send(400, payload);
            });
        }
    }


    public static atGrade(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atGrade(..) - start');

        let payload: Payload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            Log.warn('AutoTestRouteHandler::atGrade(..) - Invalid Secret: ' + providedSecret);
            payload = {failure: {message: 'Invalid AutoTest Secret: ' + providedSecret, shouldLogout: true}};
            res.send(400, payload);
        } else {
            const gradeRecord: AutoTestGradeTransport = req.body; // turn into json?

            const gc: GradesController = new GradesController();
            const validGradeRecord = gc.validateAutoTestGrade(gradeRecord);
            if (validGradeRecord !== null) {
                Log.error('AutoTestRouteHandler::atGrade(..) - valid body not provided: ' + validGradeRecord + '; body: ' + JSON.stringify(gradeRecord));
                res.send(400, {failure: {message: 'Invalid Grade Record: ' + validGradeRecord, shouldLogout: false}});
            } else {

                Log.info('AutoTestRouteHandler::atGrade(..) - repoId: ' + gradeRecord.repoId + '; delivId: ' + gradeRecord.delivId + '; body: ' + JSON.stringify(gradeRecord));
                let sc = new CourseController(new GitHubController());
                sc.handleNewAutoTestGrade(gradeRecord).then(function (success: any) {
                    payload = {success: {success: true}};
                    res.send(200, payload);
                }).catch(function (err) {
                    payload = {failure: {message: 'Failed to receive grade: ' + err, shouldLogout: false}};
                    res.send(400, payload);
                    Log.error('AutoTestRouteHandler::atGrade(..) - ERROR: ' + err);
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
            Log.warn('AutoTestRouteHandler::atPostResult(..) - Invalid Secret: ' + providedSecret);
            payload = {failure: {message: 'Invalid AutoTest Secret: ' + providedSecret, shouldLogout: true}};
            res.send(400, payload);
        } else {
            const resultRecord: AutoTestResultTransport = req.body;
            Log.trace('AutoTestRouteHandler::atPostResult(..) - body: ' + JSON.stringify(resultRecord));

            const rc = new ResultsController();
            const validResultRecord = rc.validateAutoTestResult(resultRecord);
            if (validResultRecord !== null) {
                Log.error('AutoTestRouteHandler::atPostResult(..) - valid body not provided: ' + validResultRecord + '; body: ' + JSON.stringify(resultRecord));
                res.send(400, {failure: {message: 'Invalid Result Record: ' + validResultRecord, shouldLogout: false}});
            } else {
                Log.warn('AutoTestRouteHandler::atPostResult(..) - valid result && valid secret');
                let rc = new ResultsController();
                rc.createResult(resultRecord).then(function (success) {
                    payload = {success: {message: 'Result received'}};
                    res.send(200, payload);
                }).catch(function (err) {
                    payload = {failure: {message: 'Error processing result: ' + err, shouldLogout: false}};
                    res.send(400, payload);
                    Log.error('AutoTestRouteHandler::atPostResult(..) - ERROR: ' + err);
                });
            }
        }
    }

    /**
     * TODO: this needs to be implemented.
     *
     * @param req
     * @param res
     * @param next
     */
    public static atIsStaff(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atIsStaff(..) - /isStaff/:personId - start GET');

        let payload: AutoTestAuthPayload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            Log.warn('AutoTestRouteHandler::atIsStaff(..) - Invalid Secret: ' + providedSecret);
            payload = {failure: {message: 'Invalid AutoTest Secret: ' + providedSecret, shouldLogout: true}};
            res.send(400, payload);
        } else {
            const personId = req.params.personId;

            Log.info('AutoTestRouteHandler::atIsStaff(..) - personId: ' + personId);

            // TODO: this is just a dummy implementation
            if (personId === 'rtholmes' || personId === 'nickbradley') {
                payload = {success: {personId: personId, isStaff: true, isAdmin: true}};
                res.send(200, payload);
            } else {
                payload = {success: {personId: personId, isStaff: false, isAdmin: false}};
                res.send(200, payload);
            }
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

        const url = Config.getInstance().getProp(ConfigKey.autotestUrl) + ':' + Config.getInstance().getProp(ConfigKey.autotestPort) + '/githubWebhook';
        const options = {
            uri:     url,
            method:  'POST',
            json:    true,
            headers: req.headers, // use GitHub's headers
            body:    webhookBody
        };

        return rp(options).then(function (succ) {
            Log.info('AutoTestRouteHandler::githubWebhook(..) - success: ' + JSON.stringify(succ));
            res.send(200, succ); // send interpretation back to GitHub
        }).catch(function (err) {
            Log.error('AutoTestRouteHandler::githubWebhook(..) - ERROR: ' + err);
            res.send(400, {error: err}); // respond no
        })
    }

    public static atGetResult(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atGetResult(..) - /at/result/:delivId/:repoId - start GET');

        let payload: AutoTestResultPayload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            Log.warn('AutoTestRouteHandler::atGetResult(..) - Invalid Secret: ' + providedSecret);
            payload = {failure: {message: 'Invalid AutoTest Secret: ' + providedSecret, shouldLogout: true}};
            res.send(400, payload);
        } else {
            const delivId = req.params.delivId;
            const repoId = req.params.repoId;

            Log.info('AutoTestRouteHandler::atGetResult(..) - delivId: ' + delivId + '; repoId: ' + repoId);

            let rc = new ResultsController();
            rc.getResult(delivId, repoId).then(function (result) {
                payload = {success: result};
                res.send(200, payload);
            }).catch(function (err) {
                payload = {failure: {message: err.message, shouldLogout: false}};
                res.send(400, payload);
            });
        }
    }

}
