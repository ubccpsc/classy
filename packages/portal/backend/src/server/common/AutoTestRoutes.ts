import fetch, {RequestInit} from "node-fetch";
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
import Util from "../../../../../common/Util";
import {AdminController} from "../../controllers/AdminController";
import {AuthController} from "../../controllers/AuthController";

import {CommitTarget} from "../../../../../common/types/ContainerTypes";
import {DatabaseController} from "../../controllers/DatabaseController";
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

        server.get('/portal/at', AutoTestRoutes.atConfiguration); // deprecates defaultDeliverable endpoint
        // server.get('/portal/at/defaultDeliverable', AutoTestRoutes.atDefaultDeliverable);
        server.get('/portal/at/isStaff/:githubId', AutoTestRoutes.atIsStaff);
        server.get('/portal/at/personId/:githubId', AutoTestRoutes.atPersonId);
        server.get('/portal/at/container/:delivId', AutoTestRoutes.atContainerDetails);

        server.post('/portal/at/grade', AutoTestRoutes.atGrade);

        server.post('/portal/at/result', AutoTestRoutes.atPostResult);
        server.get('/portal/at/result/:delivId/:repoId/:sha', AutoTestRoutes.atGetResult);

        server.post('/portal/githubWebhook', AutoTestRoutes.githubWebhook); // forward GitHub Webhooks to AutoTest

        server.get('/portal/at/docker/images', AutoTestRoutes.getDockerImages);
        server.post('/portal/at/docker/image', AutoTestRoutes.postDockerImage);

        server.post('/portal/at/promotePush', AutoTestRoutes.atShouldPromotePush);
    }

    public static handleError(code: number, msg: string, res: any, next: any) {
        Log.error('AutoTestRoutes::handleError(..) - ERROR: ' + msg);
        res.send(code, {failure: {message: msg, shouldLogout: false}});
        return next(false);
    }

    public static atContainerDetails(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atContainerDetails(..) - /at/container/:delivId - start GET');
        const start = Date.now();

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
                        closeTimestamp:     deliv.closeTimestamp,
                        lateAutoTest:       deliv.lateAutoTest
                    };
                    payload = {success: at};
                    Log.info('AutoTestRouteHandler::atContainerDetails(..) - /at/container/:delivId - done; took: ' + Util.took(start));
                    res.send(200, payload);
                    return next(true);
                } else {
                    // This is more like a warning; if a deliverable isn't configured this is going to happen
                    return AutoTestRoutes.handleError(400, 'Could not retrieve container details for delivId: ' + delivId, res, next);
                }
            }).catch(function(err) {
                return AutoTestRoutes.handleError(400, 'Could not retrieve container details.', res, next);
            });
        }
    }

    public static atConfiguration(req: any, res: any, next: any) {
        Log.info('AutoTestRouteHandler::atConfiguration(..) - /at - start');
        const start = Date.now();

        let payload: ClassyConfigurationPayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {

            const name = Config.getInstance().getProp(ConfigKey.name);
            Log.info('AutoTestRouteHandler::atConfiguration(..) - name: ' + name + '; took: ' + Util.took(start));

            const cc = new AdminController(new GitHubController(GitHubActions.getInstance()));
            let defaultDeliverable: string | null = null;
            Log.info('AutoTestRouteHandler::atConfiguration(..) - cc; took: ' + Util.took(start));

            cc.getCourse().then(function(course) {
                defaultDeliverable = course.defaultDeliverableId;
                Log.info('AutoTestRouteHandler::atConfiguration(..) - default: ' + defaultDeliverable + '; took: ' + Util.took(start));
                return cc.getDeliverables();
            }).then(function(deliverables) {
                const delivIds = [];
                for (const deliv of deliverables) {
                    delivIds.push(deliv.id);
                }
                payload = {success: {defaultDeliverable: defaultDeliverable, deliverableIds: delivIds}};

                Log.info('AutoTestRouteHandler::atConfiguration(..) - /at - done; took: ' + Util.took(start));
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
        const start = Date.now();

        let payload: Payload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const gradeRecord: AutoTestGradeTransport = req.body;

            AutoTestRoutes.performPostGrade(gradeRecord).then(function(saved: any) {
                payload = {success: {success: saved}};
                Log.info('AutoTestRouteHandler::atGrade(..) - done; took: ' + Util.took(start));
                res.send(200, payload);
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
        const start = Date.now();

        let payload: Payload = null;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const resultRecord: AutoTestResultTransport = req.body;
            // Log.trace('AutoTestRouteHandler::atPostResult(..) - body: ' + JSON.stringify(resultRecord));
            AutoTestRoutes.performPostResult(resultRecord).then(function() {
                payload = {success: {message: 'Result received'}};
                Log.info('AutoTestRouteHandler::atPostResult(..) - done; took: ' + Util.took(start));
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
        const start = Date.now();

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
                Log.info('AutoTestRouteHandler::atIsStaff(..) - /isStaff/:githubId - done: ' +
                    JSON.stringify(payload) + "; took: " + Util.took(start));
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
        const start = Date.now();

        let payload: Payload;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, 'Invalid AutoTest Secret: ' + providedSecret, res, next);
        } else {
            const githubId = req.params.githubId;

            const pc = new PersonController();
            pc.getGitHubPerson(githubId).then(function(person) {
                if (person !== null) {
                    Log.info('AutoTestRouteHandler::atPersonId(..) - personId: ' +
                        person.id + '; githubId: ' + githubId + "; took: " + Util.took(start));
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

    public static async atShouldPromotePush(req: any, res: any, next: any) {
        Log.info("AutoTestRoutes::atShouldPromotePush(..) - start");

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, `Invalid AutoTest Secret: ${providedSecret}`, res, next);
        } else {
            try {
                const info: CommitTarget = req.body;
                const courseController = await Factory.getCourseController();
                const shouldPromote = await courseController.shouldPrioritizePushEvent(info);
                const payload: Payload = {success: {shouldPromote}};
                res.send(200, payload);
                return next(true);
            } catch (err) {
                return AutoTestRoutes.handleError(400, `Failed to find push promotion details`, res, next);
            }
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
        const start = Date.now();

        AutoTestRoutes.handleWebhook(req).then(function(succ) {
            Log.info('AutoTestRouteHandler::githubWebhook(..) - success; took: ' + Util.took(start));
            res.send(200, succ);
        }).catch(function(err) {
            Log.error('AutoTestRouteHandler::githubWebhook(..) - ERROR: ' + err.message + "; took: " + Util.took(start));
            if (err.message && err.message.indexOf("hang up") >= 0) {
                Log.error('AutoTestRouteHandler::githubWebhook(..) - ERROR: handling hangup; ending response');
                return res.end();
            } else {
                return AutoTestRoutes.handleError(400, 'Error processing webhook: ' + err.message, res, next);
            }
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
        const headers = JSON.stringify(req.headers);
        const atHost = config.getProp(ConfigKey.autotestUrl);
        const url = atHost + ':' + config.getProp(ConfigKey.autotestPort) + '/githubWebhook';
        const options: RequestInit = {
            method:  'POST',
            headers: JSON.parse(headers), // use GitHub's headers
            body:    JSON.stringify(req.body)
        };
        const res = await fetch(url, options);
        if (res.ok) {
            Log.trace('AutoTestRouteHandler::handleWebhook(..) - success: ' + JSON.stringify(res.ok));
            return res.ok;
        }
        const err = await res.json();
        throw new Error('AutoTestRouteHandler::handleWebhook(..) - ERROR: ' + JSON.stringify(err.message));
    }

    public static async getDockerImages(req: any, res: any, next: any) {
        try {
            const config = Config.getInstance();

            const atHost = config.getProp(ConfigKey.autotestUrl);
            const url = atHost + ':' + config.getProp(ConfigKey.autotestPort) + req.href().replace("/portal/at", "");
            const options: RequestInit = {
                method: 'GET'
            };
            const githubId = req.headers.user;
            const pc = new PersonController();
            const person = await pc.getGitHubPerson(githubId);
            const privileges = await new AuthController().personPriviliged(person);

            if (!privileges.isAdmin) {
                Log.warn("AutoTestRoutes::getDockerImages(..) - AUTHORIZATION FAILURE " + githubId + " is not an admin.");
                return res.send(401);
            }

            try {
                const atResponse = await fetch(url, options);
                const body = await atResponse.json();
                if (atResponse.ok) {
                    return res.send(200, body);
                }
                throw new Error("AutoTestRoutes::getDockerImages(..) - ERROR sending request to AutoTest service, status: "
                    + res.status);
            } catch (err) {
                Log.error("AutoTestRoutes::getDockerImages(..) - ERROR Sending request to AutoTest service. " + err);
                res.send(500);
            }
        } catch (err) {
            Log.error("AutoTestRoutes::getDockerImages(..) - ERROR " + err);
            res.send(400);
        }
        return next();
    }

    public static async postDockerImage(req: any, res: any, next: any) {
        try {
            const config = Config.getInstance();
            const atHost = config.getProp(ConfigKey.autotestUrl);
            const url = atHost + ':' + config.getProp(ConfigKey.autotestPort) + '/docker/image';
            const githubId = req.headers.user;
            const pc = new PersonController();
            const person = await pc.getGitHubPerson(githubId);
            const privileges = await new AuthController().personPriviliged(person);
            const headers = JSON.stringify(req.headers);
            const options: RequestInit = {
                method: 'POST',
                body:   JSON.stringify(req.body),
                headers: JSON.parse(headers)
            };

            if (!privileges.isAdmin) {
                Log.warn("AutoTestRoutes::getDockerImages(..) - AUTHORIZATION FAILURE " + githubId + " is not an admin.");
                return res.send(401);
            }

            // Request native replaced with fetch. See https://github.com/node-fetch/node-fetch#streams
            fetch(url, options)
                .then(async (response) => {
                    if (!response.ok) {
                        throw Error('AutoTestRoutes::getDockerImages(..) - ERROR Fowarding body to AutoTest service, code: '
                            + response.status);
                    }
                    response.body.pipe(res);
                })
                .catch((err) => {
                    Log.error("AutoTestRoutes::getDockerImages(..) - ERROR Recieving response from AutoTest service. " + err);
                    res.send(500);
                });
        } catch (err) {
            Log.error("AutoTestRoutes::getDockerImages(..) - ERROR " + err);
            res.send(400);
        }
        return next();
    }
}
