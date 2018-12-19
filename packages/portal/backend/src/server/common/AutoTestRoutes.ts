import * as request from "request";
import * as rp from "request-promise-native";
import * as restify from 'restify';

import Config, {ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";
import {AutoTestResult} from "../../../../../common/types/AutoTestTypes";
import {
    AutoTestAuthPayload,
    AutoTestConfigPayload,
    AutoTestConfigTransport,
    AutoTestGradeTransport,
    AutoTestResultPayload,
    AutoTestResultTransport,
    ClassyConfigurationPayload,
    Payload
} from "../../../../../common/types/PortalTypes";
import {AdminController} from "../../controllers/AdminController";
import {AuthController} from "../../controllers/AuthController";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {GitHubActions} from "../../controllers/GitHubActions";
import {GitHubController} from "../../controllers/GitHubController";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {ResultsController} from "../../controllers/ResultsController";

import IREST from "../IREST";

/**
 * Just a large body of static methods for translating between restify and the remainder of the system.
 */
export class AutoTestRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.info('AutoTestRouteHandler::registerRoutes() - start');

        server.get('/portal/at', AutoTestRoutes.atConfiguration); // deprecates defaultDeliverable endpoint
        // server.get('/portal/at/defaultDeliverable', AutoTestRoutes.atDefaultDeliverable);
        server.get('/portal/at/isStaff/:githubId', AutoTestRoutes.atIsStaff);
        server.get('/portal/at/personId/:githubId', AutoTestRoutes.atPersonId);
        server.get('/portal/at/container/:delivId', AutoTestRoutes.atContainerDetails);

        server.post('/portal/at/grade/', AutoTestRoutes.atGrade);

        server.post('/portal/at/result/', AutoTestRoutes.atPostResult);
        server.get('/portal/at/result/:delivId/:repoId/:sha', AutoTestRoutes.atGetResult);

        server.post('/portal/githubWebhook', AutoTestRoutes.githubWebhook); // forward GitHub Webhooks to AutoTest

        // >SDMM HACK< This is a hack to allow current webhooks on EdX to continue to function
        server.post('/githubWebhook', AutoTestRoutes.githubWebhook); // forward GitHub Webhooks to AutoTest

        server.get('/portal/at/docker/images', AutoTestRoutes.getDockerImages);
        server.post('/portal/at/docker/image', AutoTestRoutes.postDockerImage);
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
                    const at: AutoTestConfigTransport = {
                        dockerImage:        deliv.autotest.dockerImage,
                        studentDelay:       deliv.autotest.studentDelay,
                        maxExecTime:        deliv.autotest.maxExecTime,
                        regressionDelivIds: deliv.autotest.regressionDelivIds,
                        custom:             deliv.autotest.custom,
                        openTimestamp:      deliv.openTimestamp,
                        closeTimestamp:     deliv.closeTimestamp
                    };
                    payload = {success: at};
                    res.send(200, payload);
                    return next(true);
                } else {
                    return AutoTestRoutes.handleError(400, 'Could not retrieve container details for delivId: ' + delivId, res, next);
                }
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'Could not retrieve container details.', res, next);
            });
        }
    }

    public static atConfiguration(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atConfiguration(..) - /at - start GET');

        let payload: ClassyConfigurationPayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {

            const name = Config.getInstance().getProp(ConfigKey.name);
            Log.info('AutoTestRouteHandler::atConfiguration(..) - name: ' + name);

            const cc = new AdminController(new GitHubController(GitHubActions.getInstance()));
            let defaultDeliverable: string | null = null;
            cc.getCourse().then(function(course) {
                defaultDeliverable = course.defaultDeliverableId;
                return cc.getDeliverables();
            }).then(function(deliverables) {
                const delivIds = [];
                for (const deliv of deliverables) {
                    delivIds.push(deliv.id);
                }
                payload = {success: {defaultDeliverable: defaultDeliverable, deliverableIds: delivIds}};
                res.send(200, payload);
                return next(true);
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'Error retrieving backend configuration.', res, next);
            });
        }
    }

    // public static atDefaultDeliverable(req: any, res: any, next: any) {
    //     Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - /defaultDeliverable/:name - start GET');
    //
    //     let payload: AutoTestDefaultDeliverablePayload;
    //     const providedSecret = req.headers.token;
    //     if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
    //         return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
    //     } else {
    //
    //         const name = Config.getInstance().getProp(ConfigKey.name);
    //         Log.info('AutoTestRouteHandler::atDefaultDeliverable(..) - name: ' + name);
    //
    //         const cc = Factory.getCourseController(new GitHubController(GitHubActions.getInstance()));
    //         cc.getCourse().then(function(course) {
    //             payload = {success: {defaultDeliverable: course.defaultDeliverableId}};
    //             res.send(200, payload);
    //             return next(true);
    //         }).catch(function(err) {
    //             return AutoTestRoutes.handleError(400, 'No default deliverable found. ', res, next);
    //         });
    //     }
    // }

    public static atGrade(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atGrade(..) - start');

        let payload: Payload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const gradeRecord: AutoTestGradeTransport = req.body;

            AutoTestRoutes.performPostGrade(gradeRecord).then(function(success: any) {
                if (success === true) {
                    payload = {success: {success: true}};
                    res.send(200, payload);
                } else {
                    return AutoTestRoutes.handleError(400, 'Failed to receive grade.', res, next);
                }
                return next(true);
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'Failed to receive grade; ERROR: ' + err.message, res, next);
            });
        }
    }

    private static async performPostGrade(grade: AutoTestGradeTransport): Promise<boolean> {
        const gc: GradesController = new GradesController();
        const validGradeRecord = gc.validateAutoTestGrade(grade);
        if (validGradeRecord !== null) {
            throw new Error('Invalid Grade Record: ' + validGradeRecord);
        } else {
            Log.info('AutoTestRouteHandler::atGrade(..) - repoId: ' + grade.repoId +
                '; delivId: ' + grade.delivId + '; body: ' + JSON.stringify(grade));
            const cc = new AdminController(new GitHubController(GitHubActions.getInstance()));
            const success = await cc.processNewAutoTestGrade(grade);
            return success;
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
            AutoTestRoutes.performPostResult(resultRecord).then(function() {
                payload = {success: {message: 'Result received'}};
                res.send(200, payload);
                return next(true);
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'Error processing result: ' + err.message, res, next);
            });
        }
    }

    private static async performPostResult(result: AutoTestResultTransport): Promise<boolean> {
        const rc = new ResultsController();
        const validResultRecord = rc.validateAutoTestResult(result);
        if (validResultRecord !== null) {
            throw new Error('Invalid Result Record: ' + validResultRecord);
        } else {
            Log.info('AutoTestRouteHandler::performPostResult(..) - valid result && valid secret; deliv: ' +
                result.delivId + '; repo: ' + result.repoId + "; sha: " + result.commitSHA);
            const dc = new DeliverablesController();
            const deliv = await dc.getDeliverable(result.delivId);
            // if results should only be saved during the marking range, use the first line; otherwise the second
            // if (deliv !== null && result.input.pushInfo.timestamp < deliv.closeTimestamp && deliv.gradesReleased === false) {
            // saving results is always open, but saving grades (in performPostGrades) probably won't be
            // NOTE: this allows AutoTest to request the cached results for later access which won't be possible if saving is prohibited
            if (deliv !== null) {
                const success = await rc.createResult(result);
                return success;
            } else {
                Log.info('AutoTestRouteHandler::performPostResult(..) - not accepting new results for delivId: ' + result.delivId +
                    '; deadline: ' + new Date(deliv.closeTimestamp) + "; result ts: " + new Date(result.input.target.timestamp));
                return false;
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

    public static atGetResult(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atGetResult(..) - /at/result/:delivId/:repoId - start GET');

        let payload: AutoTestResultPayload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const delivId = req.params.delivId;
            const repoId = req.params.repoId;
            const sha = req.params.sha;

            Log.info('AutoTestRouteHandler::atGetResult(..) - delivId: ' + delivId + '; repoId: ' + repoId + '; sha: ' + sha);

            const rc = new ResultsController();
            rc.getResult(delivId, repoId, sha).then(function(result: AutoTestResult) {
                if (result !== null) {
                    payload = {success: [result]};
                } else {
                    payload = {success: []};
                }
                res.send(200, payload);
                return next(true);
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'Error retrieving result record: ' + err.message, res, next);
            });
        }
    }

    /**
     * This route forwards GitHub webhooks from the public-facing backend to AutoTest's
     * endpoint (which is internal and protected).
     *
     * @param req
     * @param res
     * @param next
     */
    public static githubWebhook(req: any, res: any, next: any) {
        Log.trace('AutoTestRouteHandler::githubWebhook(..) - start');
        AutoTestRoutes.handleWebhook(req).then(function(succ) {
            Log.info('AutoTestRouteHandler::githubWebhook(..) - success');
            res.send(200, succ);
        }).catch(function(err) {
            Log.error('AutoTestRouteHandler::githubWebhook(..) - ERROR: ' + err.message);
            return AutoTestRoutes.handleError(400, 'Error processing webhook: ' + err.message, res, next);
        });
    }

    /**
     * Forwards Webhook to AutoTest if it is from a valid host. Returns the processed body to GitHub
     * so we can debug the contents in GitHub's webhook view, if needed.
     *
     * @param req
     * @returns {Promise<{}>}
     */
    private static async handleWebhook(req: any): Promise<{}> {
        const config = Config.getInstance();

        const atHost = config.getProp(ConfigKey.autotestUrl);
        const url = atHost + ':' + config.getProp(ConfigKey.autotestPort) + '/githubWebhook';
        const options = {
            uri:     url,
            method:  'POST',
            json:    true,
            headers: req.headers, // use GitHub's headers
            body:    req.body
        };

        const isValid: boolean = await AutoTestRoutes.isWebhookFromGitHub(req);
        if (isValid === true) {
            const success = await rp(options);
            Log.trace('AutoTestRouteHandler::handleWebhook(..) - success: ' + JSON.stringify(success));
            return success;
        } else {
            throw new Error("Webhook event did not originate from GitHub");
        }
    }

    /**
     * Helper function to check that a given request is from GitHub; this is a low-cost way to 'authenticate'
     * that a webhook at least originated on the right host.
     *
     * While 'remoteAddress' would be the right way to get the IP of the request, this turns out to be incorrect
     * becuase the Docker router actually forwards this result with an internal IP.
     *
     * @param req
     * @returns {Promise<boolean>}
     */
    private static isWebhookFromGitHub(req: any): Promise<boolean> {
        return new Promise(function(fulfill, reject) {
            const config = Config.getInstance();
            const start = Date.now();

            let remoteAddr = '';
            if (typeof req.headers['x-forwarded-for'] !== 'undefined') {
                // docker frontend will report .remoteAddress as internal (e.g., ::ffff:172.18.0.2) so we should use forwarded-for
                remoteAddr = req.headers['x-forwarded-for'];
                Log.trace('AutoTestRouteHandler::isWebhookFromGitHub(..) - start; x-forwarded from: ' + remoteAddr);
            } else {
                remoteAddr = req.connection.remoteAddress;
                Log.trace('AutoTestRouteHandler::isWebhookFromGitHub(..) - start; remoteAddress from: ' + remoteAddr);
            }

            // TODO: fix this
            return fulfill(true);

            // const ghAPI = config.getProp(ConfigKey.githubAPI);
            // if (ghAPI.indexOf('github.com') > 0) {
            //     Log.info('AutoTestRouteHandler::isWebhookFromGitHub(..) - accepted; host is github.com');
            //     return fulfill(true);
            // }
            //
            // dns.lookup(ghAPI, (err, expectedAddr) => {
            //     if (err) {
            //         Log.error('AutoTestRouteHandler::isWebhookFromGitHub(..) - ERROR: ' + err);
            //         return reject(err);
            //     }
            //
            //     // use indexOf here because address sometimes reports like: ::ffff:172.18.0.2
            //     if (expectedAddr !== null && remoteAddr.indexOf(expectedAddr) >= 0) {
            //         Log.info('AutoTestRouteHandler::isWebhookFromGitHub(..) - accepted; provided: ' +
            //             remoteAddr + '; expected: ' + expectedAddr + '; took: ' + Util.took(start));
            //         return fulfill(true);
            //     } else {
            //         const msg = 'Webhook did not originate from GitHub; request addr: ' +
            //             remoteAddr + ' !== expected addr: ' + expectedAddr;
            //         Log.error('AutoTestRouteHandler::isWebhookFromGitHub(..) - rejected: ' + msg);
            //         return reject(new Error(msg));
            //     }
            // });
        });
    }

    public static async getDockerImages(req: any, res: any, next: any) {
        try {
            const config = Config.getInstance();

            const atHost = config.getProp(ConfigKey.autotestUrl);
            const url = atHost + ':' + config.getProp(ConfigKey.autotestPort) + '/docker/images';
            const options = {
                uri:     url,
                method:  'GET',
                json:    true
            };
            const githubId = req.headers.user;
            const pc = new PersonController();
            const person = await pc.getGitHubPerson(githubId);
            const privileges =  await new AuthController().personPriviliged(person);
            if (privileges.isAdmin) {
                try {
                    const atResponse = await rp(options);
                    res.send(200, atResponse);
                } catch (err) {
                    Log.error("AutoTestRoutes::getDockerImages(..) - ERROR Sending request to AutoTest service. " + err);
                }
            } else {
                res.send(401);
            }
        } catch (err) {
            res.send(400);
        }
        return next();
    }

    public static async postDockerImage(req: any, res: any, next: any) {
        try {
            const config = Config.getInstance();

            const atHost = config.getProp(ConfigKey.autotestUrl);
            const url = atHost + ':' + config.getProp(ConfigKey.autotestPort) + '/docker/image';
            const options = {
                uri:     url,
                method:  'POST',
                json:    true,
                body: req.body
            };
            const githubId = req.headers.user;
            const pc = new PersonController();
            const person = await pc.getGitHubPerson(githubId);
            const privileges =  await new AuthController().personPriviliged(person);
            if (privileges.isAdmin) {
                try {
                    // Use native request library. See https://github.com/request/request-promise#api-in-detail.
                    request(options).pipe(res);
                } catch (err) {
                    Log.error("AutoTestRoutes::getDockerImages(..) - ERROR Sending request to AutoTest service. " + err);
                }
            } else {
                res.send(401);
            }
        } catch (err) {
            res.send(400);
        }
        return next();
    }
}
