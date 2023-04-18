import fetch, {RequestInit} from "node-fetch";
import * as restify from "restify";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {AutoTestResult} from "@common/types/AutoTestTypes";
import {
    AutoTestAuthPayload,
    AutoTestConfigPayload,
    AutoTestConfigTransport,
    AutoTestGradeTransport,
    AutoTestResultPayload,
    AutoTestResultTransport,
    AutoTestStatus,
    ClassyConfigurationPayload,
    Payload
} from "@common/types/PortalTypes";
import Util from "@common/Util";
import {CommitTarget} from "@common/types/ContainerTypes";

import {AdminController} from "@backend/controllers/AdminController";
import {AuthController} from "@backend/controllers/AuthController";
import {DeliverablesController} from "@backend/controllers/DeliverablesController";
import {GitHubActions} from "@backend/controllers/GitHubActions";
import {GitHubController} from "@backend/controllers/GitHubController";
import {GradesController} from "@backend/controllers/GradesController";
import {PersonController} from "@backend/controllers/PersonController";
import {ResultsController} from "@backend/controllers/ResultsController";
import {Factory} from "@backend/Factory";
import IREST from "@backend/server/IREST";

/**
 * Handle the REST interactions initiated by AutoTest
 * to be served by the Classy backend.
 */
export class AutoTestRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.info("AutoTestRoutes::registerRoutes() - start");

        server.get("/portal/at", AutoTestRoutes.atConfiguration); // deprecates defaultDeliverable endpoint
        server.get("/portal/at/isStaff/:githubId", AutoTestRoutes.atIsStaff);
        server.get("/portal/at/personId/:githubId", AutoTestRoutes.atPersonId);
        server.get("/portal/at/container/:delivId", AutoTestRoutes.atContainerDetails);

        server.post("/portal/at/grade", AutoTestRoutes.atGrade);

        server.post("/portal/at/result", AutoTestRoutes.atPostResult);
        server.get("/portal/at/result/:delivId/:repoId/:sha/:ref", AutoTestRoutes.atGetResult);

        server.post("/portal/at/promotePush", AutoTestRoutes.atShouldPromotePush);

        // The next three endpoints are not in the right place as they represent
        // requests that do not arise from AutoTest.

        // Receives GitHub webhook events (commit/push events) and forwards them to AutoTest
        server.post("/portal/githubWebhook", AutoTestRoutes.githubWebhook);

        // Receives Grading Image admin events, and forwards them to AutoTest
        server.get("/portal/at/docker/images", AutoTestRoutes.getDockerImages);
        server.post("/portal/at/docker/image", AutoTestRoutes.postDockerImage);
    }

    public static handleError(code: number, msg: string, res: any, next: any) {
        if (code < 400) {
            // these are not errors
            Log.info("AutoTestRoutes::handleError(..) - code: " + code + "; WARN: " + msg);
        } else {
            Log.error("AutoTestRoutes::handleError(..) - code: " + code + "; ERROR: " + msg);
        }

        res.send(code, {failure: {message: msg, shouldLogout: false}});
        return next(false);
    }

    public static atContainerDetails(req: any, res: any, next: any) {
        Log.trace("AutoTestRoutes::atContainerDetails(..) - /at/container/:delivId - start GET");
        const start = Date.now();

        let payload: AutoTestConfigPayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, "Invalid AutoTest Secret: " + providedSecret, res, next);
        } else {
            const delivId = req.params.delivId;
            const name = Config.getInstance().getProp(ConfigKey.name);

            Log.trace("AutoTestRoutes::atContainerDetails(..) - name: " + name + "; delivId: " + delivId);

            const dc = new DeliverablesController();
            dc.getDeliverable(delivId).then(function (deliv) {
                if (deliv !== null) {
                    const at: AutoTestConfigTransport = {
                        dockerImage: deliv.autotest.dockerImage,
                        studentDelay: deliv.autotest.studentDelay,
                        maxExecTime: deliv.autotest.maxExecTime,
                        regressionDelivIds: deliv.autotest.regressionDelivIds,
                        custom: deliv.autotest.custom,
                        openTimestamp: deliv.openTimestamp,
                        closeTimestamp: deliv.closeTimestamp,
                        lateAutoTest: deliv.lateAutoTest
                    };
                    payload = {success: at};
                    Log.trace("AutoTestRoutes::atContainerDetails(..) - /at/container/:delivId - done; " +
                        "took: " + Util.took(start));
                    res.send(200, payload);
                    return next(true);
                } else {
                    // This is more like a warning; if a deliverable is not configured this is going to happen
                    return AutoTestRoutes.handleError(400,
                        "Could not retrieve container details for delivId: " + delivId, res, next);
                }
            }).catch(function () { // err
                return AutoTestRoutes.handleError(400, "Could not retrieve container details.", res, next);
            });
        }
    }

    public static atConfiguration(req: any, res: any, next: any) {
        Log.trace("AutoTestRoutes::atConfiguration(..) - /at - start");
        const start = Date.now();

        let payload: ClassyConfigurationPayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, "Invalid AutoTest Secret: " + providedSecret, res, next);
        } else {

            const name = Config.getInstance().getProp(ConfigKey.name);
            Log.trace("AutoTestRoutes::atConfiguration(..) - name: " + name + "; took: " + Util.took(start));

            const cc = new AdminController(new GitHubController(GitHubActions.getInstance()));
            let defaultDeliverable: string | null = null;
            Log.trace("AutoTestRoutes::atConfiguration(..) - cc; took: " + Util.took(start));

            cc.getCourse().then(function (course) {
                defaultDeliverable = course.defaultDeliverableId;
                Log.trace("AutoTestRoutes::atConfiguration(..) - default: " + defaultDeliverable +
                    "; took: " + Util.took(start));
                return cc.getDeliverables();
            }).then(function (deliverables) {
                const delivIds = [];
                for (const deliv of deliverables) {
                    delivIds.push(deliv.id);
                }
                payload = {success: {defaultDeliverable: defaultDeliverable, deliverableIds: delivIds}};

                Log.trace("AutoTestRoutes::atConfiguration(..) - /at - done; took: " + Util.took(start));
                res.send(200, payload);
                return next(true);
            }).catch(function () { // err
                return AutoTestRoutes.handleError(400, "Error retrieving backend configuration.", res, next);
            });
        }
    }

    public static atGrade(req: any, res: any, next: any) {
        Log.trace("AutoTestRoutes::atGrade(..) - start");
        const start = Date.now();

        let payload: Payload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, "Invalid AutoTest Secret: " + providedSecret, res, next);
        } else {
            const gradeRecord: AutoTestGradeTransport = req.body;

            AutoTestRoutes.performPostGrade(gradeRecord).then(function (saved: any) {
                payload = {success: {success: saved}};
                Log.trace("AutoTestRoutes::atGrade(..) - done; took: " + Util.took(start));
                res.send(200, payload);
                return next(true);
            }).catch(function (err) {
                return AutoTestRoutes.handleError(400, "Failed to receive grade; ERROR: " + err.message, res, next);
            });
        }
    }

    private static async performPostGrade(grade: AutoTestGradeTransport): Promise<boolean> {
        const gc: GradesController = new GradesController();
        const validGradeRecord = gc.validateAutoTestGrade(grade);
        if (validGradeRecord !== null) {
            throw new Error("Invalid Grade Record: " + validGradeRecord);
        } else {
            Log.info("AutoTestRoutes::atGrade(..) - deliv: " + grade.delivId +
                "; repo: " + grade.repoId + "; grade: " + grade.score);
            // Log.trace("AutoTestRoutes::atGrade(..) - repoId: " + grade.repoId +
            //     "; delivId: " + grade.delivId + "; body: " + JSON.stringify(grade));
            const cc = new AdminController(new GitHubController(GitHubActions.getInstance()));
            return await cc.processNewAutoTestGrade(grade);
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
        Log.trace("AutoTestRoutes::atPostResult(..) - start");
        const start = Date.now();

        let payload: Payload = null;

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, "Invalid AutoTest Secret: " + providedSecret, res, next);
        } else {
            const resultRecord: AutoTestResultTransport = req.body;
            // Log.trace("AutoTestRoutes::atPostResult(..) - body: " + JSON.stringify(resultRecord));
            AutoTestRoutes.performPostResult(resultRecord).then(function () {
                payload = {success: {message: "Result received"}};
                Log.trace("AutoTestRoutes::atPostResult(..) - done; took: " + Util.took(start));
                res.send(200, payload);
                return next(true);
            }).catch(function (err) {
                return AutoTestRoutes.handleError(400, "Error processing result: " + err.message, res, next);
            });
        }
    }

    private static async performPostResult(result: AutoTestResultTransport): Promise<boolean> {
        const rc = new ResultsController();
        const validResultRecord = rc.validateAutoTestResult(result);
        if (validResultRecord !== null) {
            throw new Error("Invalid Result Record: " + validResultRecord);
        } else {
            Log.info("AutoTestRoutes::performPostResult(..) - valid result && valid secret; deliv: " +
                result.delivId + "; repo: " + result.repoId + "; SHA: " + Util.shaHuman(result.commitSHA));
            const dc = new DeliverablesController();
            const deliv = await dc.getDeliverable(result.delivId);
            // if results should only be saved during the marking range, use the first line; otherwise the second
            // if (deliv !== null && result.input.pushInfo.timestamp < deliv.closeTimestamp && deliv.gradesReleased === false) {
            // saving results is always open, but saving grades (in performPostGrades) probably will not be
            // NOTE: this allows AutoTest to request the cached results for later access which will not be possible if saving is prohibited
            if (deliv !== null) {
                const success = await rc.createResult(result);
                Log.info("AutoTestRoutes::performPostResult(..) - done; valid result && valid secret; deliv: " +
                    result.delivId + "; repo: " + result.repoId + "; SHA: " +
                    Util.shaHuman(result.commitSHA) + "; success: " + success);
                return success;
            } else {
                Log.info("AutoTestRoutes::performPostResult(..) - not accepting new results for deliv: " +
                    result.delivId + "; result ts: " + new Date(result.input.target.timestamp));
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
        Log.trace("AutoTestRoutes::atIsStaff(..) - /isStaff/:githubId - start");
        const start = Date.now();

        let payload: AutoTestAuthPayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, "Invalid AutoTest Secret: " + providedSecret, res, next);
        } else {
            const githubId = req.params.githubId;

            // Log.info("AutoTestRoutes::atIsStaff(..) - personId: " + githubId);
            const pc = new PersonController();
            const person = await pc.getGitHubPerson(githubId);
            if (person !== null) {
                const ac = new AuthController();
                const priv = await ac.personPrivileged(person);
                payload = {success: {personId: person.githubId, isStaff: priv.isStaff, isAdmin: priv.isAdmin}};
                Log.trace("AutoTestRoutes::atIsStaff(..) - /isStaff/:githubId - done: " +
                    JSON.stringify(payload) + "; took: " + Util.took(start));
                res.send(200, payload);
                return next(true);
            } else {
                payload = {success: {personId: githubId, isStaff: false, isAdmin: false}};
                Log.trace("AutoTestRoutes::atIsStaff(..) - /isStaff/:githubId - unknown person; result: " +
                    JSON.stringify(payload));
                res.send(200, payload);
                return next(true);
            }
        }
    }

    public static atPersonId(req: any, res: any, next: any) {
        Log.trace("AutoTestRoutes::atPersonId(..) - /isStaff/:githubId - start GET");
        const start = Date.now();

        let payload: Payload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, "Invalid AutoTest Secret: " + providedSecret, res, next);
        } else {
            const githubId = req.params.githubId;

            const pc = new PersonController();
            pc.getGitHubPerson(githubId).then(function (person) {
                if (person !== null) {
                    Log.info("AutoTestRoutes::atPersonId(..) - person: " +
                        person.id + "; github: " + githubId + "; took: " + Util.took(start));
                    payload = {success: {personId: person.id}}; // PersonTransportPayload
                    res.send(200, payload);
                    return next(true);
                } else {
                    return AutoTestRoutes.handleError(404, "Invalid person id: " + githubId, res, next);
                }
            }).catch(function () { // err
                return AutoTestRoutes.handleError(404, "Invalid person id: " + githubId, res, next);
            });
        }
    }

    public static atGetResult(req: any, res: any, next: any) {
        Log.trace("AutoTestRoutes::atGetResult(..) - /at/result/:delivId/:repoId/:sha/:ref - start GET");

        let payload: AutoTestResultPayload;
        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, "Invalid AutoTest Secret: " + providedSecret, res, next);
        } else {
            const delivId = req.params.delivId;
            const repoId = req.params.repoId;
            const sha = req.params.sha;
            let ref = req.params.ref;
            ref = decodeURIComponent(ref);
            if (ref === "<ANY>") {
                // ref not specified
                ref = null;
            }

            Log.trace("AutoTestRoutes::atGetResult(..) - deliv: " + delivId + "; repo: " + repoId +
                "; SHA: " + Util.shaHuman(sha) + "; ref: " + ref);

            const rc = new ResultsController();
            rc.getResult(delivId, repoId, sha, ref).then(function (result: AutoTestResult) {
                if (result !== null) {
                    payload = {success: [result]};
                } else {
                    payload = {success: []};
                }
                res.send(200, payload);
                return next(true);
            }).catch(function (err) {
                return AutoTestRoutes.handleError(400, "Error retrieving result record: " + err.message, res, next);
            });
        }
    }

    public static async atShouldPromotePush(req: any, res: any, next: any) {
        Log.info("AutoTestRoutes::atShouldPromotePush(..) - start");
        const start = Date.now();

        const providedSecret = req.headers.token;
        if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
            return AutoTestRoutes.handleError(400, `Invalid AutoTest Secret: ${providedSecret}`, res, next);
        } else {
            try {
                const info: CommitTarget = req.body;
                const courseController = await Factory.getCourseController();
                const shouldPromote = await courseController.shouldPrioritizePushEvent(info);
                Log.info("AutoTestRoutes::atShouldPromotePush(..) - done; shouldPromote: " + shouldPromote +
                    "; took: " + Util.took(start));
                const payload: Payload = {success: {shouldPromote}};
                res.send(200, payload);
                return next(true);
            } catch (err) {
                return AutoTestRoutes.handleError(400, "Failed to find push promotion details", res, next);
            }
        }
    }

    /**
     * This route forwards GitHub webhooks from the public-facing backend
     * to the AutoTest endpoint (which is internal and protected).
     *
     * @param req
     * @param res
     * @param next
     */
    public static githubWebhook(req: any, res: any, next: any) {
        Log.info("AutoTestRoutes::githubWebhook(..) - start");
        const start = Date.now();

        AutoTestRoutes.handleWebhook(req).then(function (succ) {
            Log.info("AutoTestRoutes::githubWebhook(..) - done; took: " + Util.took(start));
            res.send(200, succ);
        }).catch(function (err) {
            /* istanbul ignore next: braces needed for ignore (only reachable when deployed) */
            {
                Log.error("AutoTestRoutes::githubWebhook(..) - ERROR: " + err.message + "; took: " + Util.took(start));
                if (err.message && err.message.indexOf("hang up") >= 0) {
                    Log.error("AutoTestRoutes::githubWebhook(..) - ERROR: handling hangup; ending response");
                    return res.end();
                } else {
                    return AutoTestRoutes.handleError(400, "Error processing webhook: " + err.message, res, next);
                }
            }
        });
    }

    /**
     * Forwards Webhook to AutoTest if it is from a valid host. Returns the processed body
     * to GitHub, so we can debug the contents in the GitHub webhook view, if needed.
     *
     * @param req
     * @returns {Promise<{}>}
     */
    private static async handleWebhook(req: any): Promise<{}> {
        Log.trace("AutoTestRoutes::handleWebhook(..) - start");
        const start = Date.now();

        const headers = JSON.stringify(req.headers);
        const config = Config.getInstance();
        const atHost = config.getProp(ConfigKey.autotestUrl);
        const url = atHost + ":" + config.getProp(ConfigKey.autotestPort) + "/githubWebhook";
        const options: RequestInit = {
            method: "POST",
            headers: JSON.parse(headers), // use GitHub headers
            body: JSON.stringify(req.body)
        };
        const res = await fetch(url, options);
        /* istanbul ignore next: braces needed for ignore (not reachable except when deployed) */
        {
            if (res.ok) {
                Log.trace("AutoTestRoutes::handleWebhook(..) - success: " + JSON.stringify(res.ok));
                Log.trace("AutoTestRoutes::handleWebhook(..) - done; took: " + Util.took(start));
                return res.ok;
            } else {
                const err = await res.json();
                const msg = "AutoTestRoutes::handleWebhook(..) - ERROR: " + JSON.stringify(err);
                throw new Error(msg);
            }
        }
    }

    public static async getDockerImages(req: any, res: any, next: any) {
        Log.trace("AutoTestRoutes::getDockerImages(..) - start");
        try {
            const config = Config.getInstance();

            const githubId = req.headers.user;
            const pc = new PersonController();
            const person = await pc.getGitHubPerson(githubId);
            const privileges = await new AuthController().personPrivileged(person);

            if (typeof githubId === "undefined" || person === null) {
                throw new Error("Valid user parameter not provided");
            }

            if (!privileges.isAdmin) {
                Log.warn("AutoTestRoutes::getDockerImages(..) - AUTHORIZATION FAILURE " +
                    githubId + " is not an admin.");
                return res.send(401);
            }

            try {
                const atHost = config.getProp(ConfigKey.autotestUrl);
                const url = atHost + ":" +
                    config.getProp(ConfigKey.autotestPort) +
                    req.href().replace("/portal/at", "");
                const options: RequestInit = {
                    method: "GET"
                };

                Log.trace("AutoTestRoutes::getDockerImages(..) - requesting; options: " + JSON.stringify(options));
                const atResponse = await fetch(url, options);
                Log.trace("AutoTestRoutes::getDockerImages(..) - done; isOk: " + atResponse.ok);

                if (!atResponse.ok) {
                    throw new Error("AutoTestRoutes::getDockerImages(..) - ERROR sending request to AutoTest service;" +
                        " status: " + res.status);
                }

                const body = await atResponse.json();
                res.send(200, body);
            } catch (err) {
                Log.error("AutoTestRoutes::getDockerImages(..) - ERROR Sending request to AutoTest service. " + err);
                // TODO: this suggests a backend configuration problem and should be exposed to the user
                res.send(500);
            }
        } catch (err) {
            Log.error("AutoTestRoutes::getDockerImages(..) - ERROR " + err);
            res.send(400);
        }
        // return next();
    }

    public static async postDockerImage(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.trace("AutoTestRoutes::postDockerImage(..) - start");
        try {
            const githubId = req.headers.user as string;
            const pc = new PersonController();
            const person = await pc.getGitHubPerson(githubId);
            const privileges = await new AuthController().personPrivileged(person);

            if (typeof githubId === "undefined" || person === null) {
                throw new Error("Valid user parameter not provided");
            }

            const headers = JSON.stringify(req.headers);
            const options: RequestInit = {
                method: "POST",
                body: JSON.stringify(req.body),
                headers: JSON.parse(headers)
            };

            if (!privileges.isAdmin) {
                Log.warn("AutoTestRoutes::postDockerImage(..) - AUTHORIZATION FAILURE " +
                    githubId + " is not an admin.");
                return res.send(401);
            }

            const config = Config.getInstance();
            const atHost = config.getProp(ConfigKey.autotestUrl);
            const url = atHost + ":" + config.getProp(ConfigKey.autotestPort) + "/docker/image";

            // Request native replaced with fetch. See https://github.com/node-fetch/node-fetch#streams
            try {
                Log.trace("AutoTestRoutes::postDockerImage(..) - requesting; opts: " + JSON.stringify(options));
                const atResponse = await fetch(url, options);

                res.write(""); // keep alive
                // seems odd to pipe _and_ do the writing below,
                // but the pipe closes the connection while the
                // writes seem to be required to actually send the data
                atResponse.body.pipe(res);

                try {
                    for await (const myChunk of atResponse.body) {
                        Log.trace("AutoTestRoutes::postDockerImage(..) - myChunk: " + myChunk.toString());
                        // This was a red herring, moving pipe up was enough
                        // res.write(myChunk.toString());
                    }
                    Log.trace("AutoTestRoutes::postDockerImage(..) - closing");
                } catch (err) {
                    Log.error("AutoTestRoutes::postDockerImage(..) - myChunk ERROR: " + err);
                }

                Log.trace("AutoTestRoutes::postDockerImage(..) - responded code: " + atResponse.status);

                if (!atResponse.ok) {
                    throw Error(
                        "AutoTestRoutes::postDockerImage(..) - ERROR Forwarding body to AutoTest service, code: "
                        + atResponse.status);
                }
                Log.trace("AutoTestRoutes::postDockerImage(..) - before pipe");
                // atResponse.body.pipe(res);
                Log.trace("AutoTestRoutes::postDockerImage(..) - after pipe");
                // Need this line to keep the connection to the browser
                // alive until the stream has responded
                // res.write(""); // keep alive

                Log.trace("AutoTestRoutes::postDockerImage(..) - after write");
            } catch (err) {
                Log.error(
                    "AutoTestRoutes::postDockerImage(..) - ERROR Receiving response from AutoTest service. " + err);
                return res.send(500);
            }
        } catch (err) {
            Log.error("AutoTestRoutes::postDockerImage(..) - ERROR " + err);
            return res.send(400);
        }
        // return next();
    }

    /**
     * This is not actually a route, but calls the AutoTest backend
     * to get the current size of all queues. It has the side effect
     * of making sure the AutoTest server has started running.
     */
    public static async checkATStatus(): Promise<AutoTestStatus> {
        Log.info("AutoTestRoutes::checkATStatus(..) - start");
        const start = Date.now();

        const config = Config.getInstance();
        const atHost = config.getProp(ConfigKey.autotestUrl);
        const url = atHost + ":" + config.getProp(ConfigKey.autotestPort) + "/status";
        const options: RequestInit = {
            method: "GET"
        };
        const res = await fetch(url, options);
        /* istanbul ignore next: braces needed for ignore (not reachable except when deployed) */
        {
            if (res.ok) {
                Log.trace("AutoTestRoutes::checkATStatus(..) - success: " + JSON.stringify(res.ok));
                Log.trace("AutoTestRoutes::checkATStatus(..) - done; took: " + Util.took(start));
                const result = await res.json();
                Log.info("AutoTestRoutes::checkATStatus(..) - done; # jobs: " + result.executing +
                    "; # exp: " + result.exp + "; # std: " + result.std + "; # low: " + result.low);
                return result;
            } else {
                const err = await res.json();
                const msg = "AutoTestRoutes::checkATStatus(..) - ERROR: " + JSON.stringify(err);
                Log.error(msg);
                throw new Error(msg);
            }
        }
    }
}
