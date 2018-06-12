import * as rp from "request-promise-native";

import Config from "../../../../common/Config";
import Log from "../../../../common/Log";

import {AuthController} from "../../controllers/AuthController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {PersonController} from "../../controllers/PersonController";
import {CourseController} from "../../controllers/CourseController";
import {GradePayload} from "../../../../common/types/SDMMTypes";
import {GitHubController} from "../../controllers/GitHubController";
import IREST from "../IREST";
import restify = require('restify');

/**
 * Just a large body of static methods for translating between restify and the remainder of the system.
 */
export class AutoTestRouteHandler implements IREST {

    private static dc = DatabaseController.getInstance();
    private static pc = new PersonController();
    private static ac = new AuthController();

    public registerRoutes(server: restify.Server) {
        Log.info("AutoTestRouteHandler::registerRoutes() - start");

        server.get('/defaultDeliverable/:org', AutoTestRouteHandler.atDefaultDeliverable);
        server.get('/isStaff/:org/:personId', AutoTestRouteHandler.atIsStaff);
        server.get('/container/:org/:delivId', AutoTestRouteHandler.atContainerDetails);
        server.post('/grade/:org/:repoId/:delivId', AutoTestRouteHandler.atGradeResult);
        server.post('/githubWebhook', AutoTestRouteHandler.githubWebhook); // forward GitHub Webhooks to AutoTest
    }

    // that.rest.get('/container/:org/:delivId', RouteHandler.atContainerDetails);
    public static atContainerDetails(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atContainerDetails(..) - /container/:org/:delivId - start GET');
        // const user = req.headers.user;
        // const token = req.headers.token;

        // TODO: verify secret

        const org = req.params.org;
        const delivId = req.params.delivId;

        Log.info('AutoTestRouteHandler::atContainerDetails(..) - org: ' + org + '; delivId: ' + delivId);

        // TODO: this is just a dummy implementation

        if (org === 'secapstone' || org === 'secapstonetest') {
            res.send({dockerImage: 'secapstone-grader', studentDelay: 60 * 60 * 12, maxExecTime: 300, regressionDelivIds: []});
        } else {
            res.send(400, {message: 'Invalid org: ' + org});
        }


        /*
                let sc: SDDMController = new SDDMController(new GitHubController());
                sc.getStatus(org, user).then(function (status) {
                    Log.trace('RouteHandler::getCurrentStatus(..) - sending 200; user: ' + user + '; status: ' + status);
                    res.send({user: user, status: status});
                }).catch(function (err) {
                    Log.trace('RouteHandler::getCurrentStatus(..) - sending 400');
                    res.send(400, {error: err});
                });
        */
    }


    public static atDefaultDeliverable(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - /defaultDeliverable/:org - start GET');
        // const user = req.headers.user;
        // const token = req.headers.token;

        // TODO: verify secret

        const org = req.params.org;

        Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - org: ' + org);

        // TODO: this is just a dummy implementation

        if (org === 'secapstone' || org === 'secapstonetest') {
            res.send({delivId: 'd0'});
        } else {
            res.send(400, {error: 'unknown course'});
        }

        /*
                let sc: SDDMController = new SDDMController(new GitHubController());
                sc.getStatus(org, user).then(function (status) {
                    Log.trace('RouteHandler::getCurrentStatus(..) - sending 200; user: ' + user + '; status: ' + status);
                    res.send({user: user, status: status});
                }).catch(function (err) {
                    Log.trace('RouteHandler::getCurrentStatus(..) - sending 400');
                    res.send(400, {error: err});
                });
        */
    }


    public static atGradeResult(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atGradeResult(..) - start');
        // const user = req.headers.user;
        // const token = req.headers.token;

        // TODO: verify admin secret

        const org = req.params.org;
        const repoId = req.params.repoId;
        const delivId = req.params.delivId;

        const gradeRecord: GradePayload = req.body; // turn into json?

        Log.info('AutoTestRouteHandler::atGradeResult(..) - org: ' + org + '; repoId: ' + repoId + '; delivId: ' + delivId + '; body: ' + JSON.stringify(gradeRecord));

        let sc = new CourseController(new GitHubController());
        sc.handleNewGrade(repoId, delivId, gradeRecord).then(function (success) {
            res.send({success: true}); // respond
        }).catch(function (err) {
            res.send({success: true}); // respond true, they can't do anything anyways
            Log.error('AutoTestRouteHandler::atGradeResult(..) - ERROR: ' + err);
        });

        /*
                let sc: SDDMController = new SDDMController(new GitHubController());
                sc.getStatus(org, user).then(function (status) {
                    Log.trace('RouteHandler::getCurrentStatus(..) - sending 200; user: ' + user + '; status: ' + status);
                    res.send({user: user, status: status});
                }).catch(function (err) {
                    Log.trace('RouteHandler::getCurrentStatus(..) - sending 400');
                    res.send(400, {error: err});
                });
        */
    }

    /**
     * TODO: this needs to be implemented.
     *
     * @param req
     * @param res
     * @param next
     */
    public static atIsStaff(req: any, res: any, next: any) {
        Log.info('RouteHandler::atIsStaff(..) - /isStaff/:org/:personId - start GET');
        // const user = req.headers.user;
        // const token = req.headers.token;

        // TODO: verify secret
        const org = req.params.org;
        const personId = req.params.personId;

        Log.info('RouteHandler::atIsStaff(..) - org: ' + org + '; personId: ' + personId);

        // TODO: this is just a dummy implementation
        if (personId === 'rtholmes' || personId === 'nickbradley') {
            res.send({org: org, personId: personId, isStaff: true});
        } else {
            res.send({org: org, personId: personId, isStaff: false});
        }

        /*
                let sc: SDDMController = new SDDMController(new GitHubController());
                sc.getStatus(org, user).then(function (status) {
                    Log.trace('RouteHandler::getCurrentStatus(..) - sending 200; user: ' + user + '; status: ' + status);
                    res.send({user: user, status: status});
                }).catch(function (err) {
                    Log.trace('RouteHandler::getCurrentStatus(..) - sending 400');
                    res.send(400, {error: err});
                });
        */
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
        Log.info('RouteHandler::githubWebhook(..) - start');
        const webhookBody: any = req.body;
        // Log.info('RouteHandler::githubWebhook(..) - body: ' + JSON.stringify(webhookBody));

        const url = Config.getInstance().getProp('autotestUrl') + ':' + Config.getInstance().getProp('autotestPort') + '/githubWebhook';
        const options = {
            uri:     url,
            method:  'POST',
            json:    true,
            headers: req.headers, // use GitHub's headers
            body:    webhookBody
        };

        return rp(options).then(function (succ) {
            Log.info('RouteHandler::githubWebhook(..) - success: ' + JSON.stringify(succ));
            res.send(200, succ); // send interpretation back to GitHub
        }).catch(function (err) {
            Log.error('RouteHandler::githubWebhook(..) - ERROR: ' + err);
            res.send(400, {error: err}); // respond no
        })
    }

}
