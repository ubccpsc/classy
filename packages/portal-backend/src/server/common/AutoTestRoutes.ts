import restify = require('restify');
import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {
    AutoTestAuthPayload,
    AutoTestConfigPayload,
    AutoTestDefaultDeliverablePayload,
    AutoTestGradeTransport
} from "../../../../common/types/PortalTypes";

import {IContainerOutput} from "../../../../autotest/src/Types";

import IREST from "../IREST";
import {CourseController} from "../../controllers/CourseController";
import {GitHubController} from "../../controllers/GitHubController";
import {ResultsController} from "../../controllers/ResultsController";

/**
 * Just a large body of static methods for translating between restify and the remainder of the system.
 */
export class AutoTestRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.info('AutoTestRouteHandler::registerRoutes() - start');

        server.get('/at/defaultDeliverable', AutoTestRoutes.atDefaultDeliverable); // /:org
        server.get('/at/isStaff/:personId', AutoTestRoutes.atIsStaff);
        server.get('/at/container/:delivId', AutoTestRoutes.atContainerDetails);
        server.post('/at/grade/', AutoTestRoutes.atGradeResult); // was: /grade/:org/:repoId/:delivId
        server.post('/at/result/', AutoTestRoutes.atResult);
        server.post('/githubWebhook', AutoTestRoutes.githubWebhook); // forward GitHub Webhooks to AutoTest
    }

    public static atContainerDetails(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atContainerDetails(..) - /at/container/:delivId - start GET');

        // TODO: verify secret

        const delivId = req.params.delivId;

        Log.info('AutoTestRouteHandler::atContainerDetails(..) - delivId: ' + delivId);

        // TODO: this is just a dummy implementation
        let payload: AutoTestConfigPayload;
        const org = Config.getInstance().getProp(ConfigKey.org);
        if ((org === 'secapstone' || org === 'classytest') && delivId !== 'd9997') { // HACK: the && is terrible and is just for testing
            payload = {success: {dockerImage: 'secapstone-grader', studentDelay: 60 * 60 * 12, maxExecTime: 300, regressionDelivIds: []}};
            res.send(200, payload);
        } else {
            payload = {failure: {message: 'Could not retrieve container details', shouldLogout: false}};
            res.send(400, payload);
        }
    }


    public static atDefaultDeliverable(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - /defaultDeliverable/:org - start GET');

        // TODO: verify secret

        // const org = req.params.org;
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - org: ' + org);

        // TODO: this is just a dummy implementation

        let payload: AutoTestDefaultDeliverablePayload;
        if (org === 'secapstone' || org === 'classytest') {
            payload = {success: {defaultDeliverable: 'd0'}};
            res.send(200, payload);
        } else {
            payload = {failure: {message: 'No default deliverable found.', shouldLogout: false}};
            res.send(400, payload);
        }
    }


    public static atGradeResult(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atGradeResult(..) - start');

        // TODO: verify admin secret

        const gradeRecord: AutoTestGradeTransport = req.body; // turn into json?

        Log.info('AutoTestRouteHandler::atGradeResult(..) - repoId: ' + gradeRecord.repoId + '; delivId: ' + gradeRecord.delivId + '; body: ' + JSON.stringify(gradeRecord));

        let sc = new CourseController(new GitHubController());
        sc.handleNewAutoTestGrade(gradeRecord).then(function (success: any) {
            res.send(200, {success: {success: true}}); // respond
        }).catch(function (err) {
            res.send(400, {failure: {message: 'Failed to receive grade: ' + err}}); // respond true, they can't do anything anyways
            Log.error('AutoTestRouteHandler::atGradeResult(..) - ERROR: ' + err);
        });
    }

    public static atResult(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atResult(..) - start');

        // TODO: verify admin secret

        const org = Config.getInstance().getProp(ConfigKey.org);
        const resultRecord: IContainerOutput = req.body;

        Log.info('AutoTestRouteHandler::atResult(..) - org: ' + org + '; body: ' + JSON.stringify(resultRecord));
        let rc = new ResultsController();
        rc.createResult(resultRecord).then(function (success) {
            res.send({success: true}); // respond
        }).catch(function (err) {
            res.send({success: true}); // respond true, they can't do anything anyways
            Log.error('AutoTestRouteHandler::atResult(..) - ERROR: ' + err);
        });
    }

    /**
     * TODO: this needs to be implemented.
     *
     * @param req
     * @param res
     * @param next
     */
    public static atIsStaff(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atIsStaff(..) - /isStaff/:org/:personId - start GET');

        // TODO: verify secret
        const org = Config.getInstance().getProp(ConfigKey.org);
        const personId = req.params.personId;

        Log.info('AutoTestRouteHandler::atIsStaff(..) - org: ' + org + '; personId: ' + personId);

        let payload: AutoTestAuthPayload;
        // TODO: this is just a dummy implementation
        if (personId === 'rtholmes' || personId === 'nickbradley') {
            payload = {success: {personId: personId, isStaff: true, isAdmin: true}};
            res.send(200, payload);
        } else {
            payload = {success: {personId: personId, isStaff: false, isAdmin: false}};
            res.send(200, payload);
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

}
