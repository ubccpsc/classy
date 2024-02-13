import * as crypto from "crypto";
import * as Docker from "dockerode";
import * as http from "http";
import * as querystring from "querystring";
import * as restify from "restify";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {CommitTarget} from "@common/types/ContainerTypes";
import Util from "@common/Util";

import {AutoTest} from "../autotest/AutoTest";
import {ClassPortal} from "../autotest/ClassPortal";
import {MongoDataStore} from "../autotest/DataStore";
import {EdXClassPortal} from "../edx/EdxClassPortal";
import {GitHubAutoTest} from "../github/GitHubAutoTest";
import {GitHubUtil} from "../github/GitHubUtil";

export default class AutoTestRouteHandler {
    public static docker: Docker = null;
    public static autoTest: AutoTest = null;

    public static getDocker(): Docker {
        if (AutoTestRouteHandler.docker === null) {
            // NOTE: not sure what commenting this out will do in CI, but
            // seems right for local dev and will be fine in production

            // if (Config.getInstance().getProp(ConfigKey.name) === "classytest") {
            //     // Running tests; do not need to connect to the Docker daemon
            //     this.docker = null;
            // } else {
            // Connect to the Docker socket using defaults
            AutoTestRouteHandler.docker = new Docker();
            // }
        }

        return AutoTestRouteHandler.docker;
    }

    public static getAutoTest(): AutoTest {
        if (AutoTestRouteHandler.autoTest === null) {
            const dataStore = new MongoDataStore();
            const docker = AutoTestRouteHandler.getDocker();
            let portal: ClassPortal;

            if (Config.getInstance().getProp(ConfigKey.name) === "sdmm") {
                portal = new EdXClassPortal();
            } else {
                portal = new ClassPortal();
            }

            AutoTestRouteHandler.autoTest = new GitHubAutoTest(dataStore, portal, docker);
        }
        return AutoTestRouteHandler.autoTest;
    }

    /**
     * Makes sure the AutoTest server is started
     */
    public static getAutoTestStatus(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            Log.info("RouteHanlder::getAutoTestStatus(..) - start");

            // should load AutoTest, if it has not been loaded already
            // if it is loading for the first time the queue will tick itself
            const at: GitHubAutoTest = AutoTestRouteHandler.getAutoTest() as GitHubAutoTest;

            // tick the queue again, in case it was not being loaded for the first time
            // feels odd to tick on status, but it might as well be up-to-date
            // and tick is idempotent
            at.tick();

            // get the status
            const status = at.getStatus();

            Log.info("RouteHanlder::getAutoTestStatus(..) - done");
            res.send(200, status);
        } catch (err) {
            Log.info("RouteHanlder::getAutoTestStatus(..) - ERROR: " + err);
            res.send(400, "Failed to check AutoTest: " + err.message);
        }
        return next();
    }

    /**
     * Handles GitHub POST events:
     * - ping
     * - commit_comment
     * - push
     */
    public static postGithubHook(req: restify.Request, res: restify.Response, next: restify.Next) {
        const start = Date.now();
        const githubEvent: string = req.header("X-GitHub-Event");
        let githubSecret: string = req.header("X-Hub-Signature");

        // https://developer.github.com/webhooks/securing/
        if (typeof githubSecret === "undefined") {
            githubSecret = null;
        }

        Log.info("AutoTestRouteHandler::postGithubHook(..) - start; handling event: " + githubEvent);
        const body = req.body;

        const handleError = function (msg: string) {
            Log.error("AutoTestRouteHandler::postGithubHook() - failure; ERROR: " + msg + "; took: " + Util.took(start));
            return res.send(400, "Failed to process commit: " + msg);
        };

        let secretVerified = false;
        if (githubSecret !== null) {
            try {
                Log.trace("AutoTestRouteHandler::postGithubHook(..) - trying to compute webhook secrets");

                const atSecret = Config.getInstance().getProp(ConfigKey.autotestSecret);
                const key = crypto.createHash("sha256").update(atSecret, "utf8").digest("hex"); // secret w/ sha256
                // Log.info("AutoTestRouteHandler::postGithubHook(..) - key: " + key); // should be same as webhook added key

                const computed = "sha1=" + crypto.createHmac("sha1", key) // payload w/ sha1
                    .update(JSON.stringify(body))
                    .digest("hex");

                secretVerified = (githubSecret === computed);
                if (secretVerified === true) {
                    Log.trace("AutoTestRouteHandler::postGithubHook(..) - webhook secret verified: " + secretVerified +
                        "; took: " + Util.took(start));
                } else {
                    Log.warn("AutoTestRouteHandler::postGithubHook(..) - webhook secrets do not match");
                    Log.warn("AutoTestRouteHandler::postGithubHook(..) - GitHub header: " + githubSecret + "; computed: " + computed);
                }
            } catch (err) {
                Log.error("AutoTestRouteHandler::postGithubHook(..) - ERROR computing HMAC: " + err.message);
            }
        } else {
            Log.warn("AutoTestRouteHandler::postGithubHook(..) - secret ignored (not present)");
        }

        // leave this on for a while; would like to verify that this works so we can replace the hardcode below
        Log.info("AutoTestRouteHandler::postGithubHook(..) - hasSecret: " +
            (typeof githubSecret === "string") + "; secretVerified: " + secretVerified);

        secretVerified = true; // TODO: stop overwriting this
        if (secretVerified === true) {
            if (githubEvent === "ping") {
                // github test packet; use to let the webhooks know we are listening
                Log.info("AutoTestRouteHandler::postGithubHook() - <200> pong.");
                return res.send(200, "pong");
            } else {
                Log.trace("AutoTestRouteHandler::postGithubHook() - starting handle");
                AutoTestRouteHandler.handleWebhook(githubEvent, body).then(function (commitEvent) {
                    if (commitEvent !== null) {
                        Log.info("AutoTestRouteHandler::postGithubHook() - handle done; took: " + Util.took(start));
                        return res.send(200, commitEvent); // report back our interpretation of the hook
                    } else {
                        Log.info("AutoTestRouteHandler::postGithubHook() - handle done (branch deleted); took: " + Util.took(start));
                        return res.send(204, {}); // report back that nothing happened
                    }
                }).catch(function (err) {
                    Log.error("AutoTestRouteHandler::postGithubHook() - ERROR: " + err);
                    handleError(err);
                });
            }
        } else {
            handleError("Invalid payload signature.");
        }

        Log.trace("AutoTestRouteHandler::postGithubHook(..) - done handling event: " + githubEvent);
        // no next() call here; .then clause above will finish the response
    }

    private static async handleWebhook(event: string, body: string): Promise<CommitTarget> {
        // cast is unfortunate, but if we are listening to these routes it must be a GitHub AT instance
        const at: GitHubAutoTest = AutoTestRouteHandler.getAutoTest() as GitHubAutoTest;

        switch (event) {
            case "commit_comment":
                const commentEvent = await GitHubUtil.processComment(body);
                Log.trace("AutoTestRouteHandler::handleWebhook() - comment request: " + JSON.stringify(commentEvent, null, 2));
                await at.handleCommentEvent(commentEvent);
                return commentEvent;
            case "push":
                const pushEvent = await GitHubUtil.processPush(body, new ClassPortal());
                Log.trace("AutoTestRouteHandler::handleWebhook() - push request: " + JSON.stringify(pushEvent, null, 2));
                await at.handlePushEvent(pushEvent);
                return pushEvent;
            case "issue_comment":
                const prEvent = await GitHubUtil.processIssueComment(body);
                return prEvent;
            // no return for now, just fall through to error
            default:
                Log.error("AutoTestRouteHandler::handleWebhook() - Unhandled GitHub event: " + event);
                throw new Error("Unhandled GitHub hook event: " + event);
        }
    }

    // public static getResource(req: restify.Request, res: restify.Response, next: restify.Next) {
    //     const path = Config.getInstance().getProp(ConfigKey.persistDir) + "/" + req.url.split("/resource/")[1];
    //     Log.info("AutoTestRouteHandler::getResource(..) - start; fetching resource: " + path);
    //
    //     const rs = fs.createReadStream(path);
    //     rs.on("error", (err: any) => {
    //         if (err.code === "ENOENT") {
    //             Log.error("AutoTestRouteHandler::getResource(..) - ERROR Requested resource does not exist: " + path);
    //             res.send(404, err.message);
    //         } else {
    //             Log.error("AutoTestRouteHandler::getResource(..) - ERROR Reading requested resource: " + path);
    //             res.send(500, err.message);
    //         }
    //     });
    //     rs.on("end", () => {
    //         rs.close();
    //     });
    //     rs.pipe(res);
    //
    //     next();
    // }

    public static async getDockerImages(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            const docker = AutoTestRouteHandler.getDocker();
            const filtersStr = req.query.filters;
            const options: any = {};
            if (filtersStr) {
                options["filters"] = JSON.parse(filtersStr);
            }
            Log.info("AutoTestRouteHandler::getDockerImages(..) - start; options: " + JSON.stringify(options));
            const images = await docker.listImages(options);
            Log.trace("AutoTestRouteHandler::getDockerImages(..) - done; images: " + JSON.stringify(images));
            res.send(200, images);
        } catch (err) {
            Log.error("AutoTestRouteHandler::getDockerImages(..) - ERROR Retrieving docker images: " + err.message);
            if (err.statusCode) {
                // Error from Docker daemon
                res.send(err.statusCode, err.message);
            } else {
                res.send(400, err.message);
            }
        }
        next();
    }

    public static async postDockerImage(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.info("AutoTestRouteHandler::postDockerImage(..) - start");

        AutoTestRouteHandler.getDocker(); // make sure docker is configured

        try {
            if (typeof req.body.remote === "undefined") {
                throw new Error("remote parameter missing");
            }
            if (typeof req.body.tag === "undefined") {
                throw new Error("tag parameter missing");
            }
            if (typeof req.body.file === "undefined") {
                throw new Error("file parameter missing");
            }

            const start = Date.now();
            const handler = (stream: http.IncomingMessage) => {
                let heartbeat: NodeJS.Timer = null;
                stream.on("data", (chunk: any) => {
                    Log.trace("AutoTestRouteHandler::postDockerImage(..)::stream; chunk:" + chunk.toString());

                    clearInterval(heartbeat as any); // if a timer exists, cancel it
                    // start a new timer after every chunk to keep stream open
                    heartbeat = setInterval(function () {
                        Log.trace("AutoTestRouteHandler::postDockerImage(..)::stream; - sending heartbeat");
                        const dur = ((Date.now() - start) / 1000).toFixed(0);
                        stream.push('{"stream":"Working... (' + dur + ' seconds elapsed)\\n"}\n'); // send a heartbeat packet
                    }, 5000); // time between heartbeats

                });
                stream.on("end", (chunk: any) => {
                    Log.info("AutoTestRouteHandler::postDockerImage(..)::stream; end: Stream closed after building: " + tag);
                    clearInterval(heartbeat as any); // if a timer exists, cancel it
                    return next();
                });
                stream.on("error", (chunk: any) => {
                    Log.error("AutoTestRouteHandler::postDockerImage(..)::stream; Docker Stream ERROR: " + chunk);
                    clearInterval(heartbeat as any); // if a timer exists, cancel it
                    return next();
                });
                stream.pipe(res);
            };

            const body = req.body as any;
            const tag = body.tag;
            const file = body.file;
            let remote;

            if (Config.getInstance().hasProp(ConfigKey.githubDockerToken) === true) {
                // repo protected by the githubDockerToken from .env
                const token = Config.getInstance().getProp(ConfigKey.githubDockerToken);
                remote = token ? body.remote.replace("https://", "https://" + token + "@") : body.remote;
            } else {
                // public repo
                remote = body.remote;
            }

            const dockerOptions = {remote, t: tag, dockerfile: file};
            const reqParams = querystring.stringify(dockerOptions);
            const reqOptions = {
                socketPath: "/var/run/docker.sock",
                path: "/v1.24/build?" + reqParams,
                method: "POST"
            };

            Log.info("AutoTestRouteHandler::postDockerImage(..) - building tag: " + tag);
            Log.trace("AutoTestRouteHandler::postDockerImage(..) - making request with opts: " + JSON.stringify(reqOptions));
            const dockerReq = http.request(reqOptions, handler);
            dockerReq.end(0);
            Log.trace("AutoTestRouteHandler::postDockerImage(..) - request made");

            // write something to the response to keep it alive until the stream is emitting
            res.write(""); // NOTE: this is required, if odd
        } catch (err) {
            Log.error("AutoTestRouteHandler::postDockerImage(..) - ERROR Building docker image: " + err.message);
            return res.send(err.statusCode, err.message);
        }
        // next not here on purpose, must be in stream handler or socket will close early
    }

    public static async removeDockerImage(req: restify.Request, res: restify.Response, next: restify.Next) {
        let success = false;
        let errorMsg = "";

        try {
            const docker = AutoTestRouteHandler.getDocker();
            const tag = req.params.tag;
            Log.info("AutoTestRouteHandler::removeDockerImage(..) - start; tag: " + tag);

            if (tag === undefined || tag.length < 1) {
                throw new Error("Docker image tag not provided.");
            }

            const images = await docker.listImages({filters: {reference: ["grader"]}});
            Log.info("AutoTestRouteHandler::removeDockerImage(..) - # images: " + images.length);

            let imageDescription: Docker.ImageInfo = null;
            for (const img of images) {
                Log.info("AutoTestRouteHandler::removeDockerImage(..) - comparing tag: " + tag + " to image: " + img.Id);
                // tag often has extra details (sha256 etc)
                if (img.Id.indexOf(tag) >= 0) {
                    Log.info("AutoTestRouteHandler::removeDockerImage(..) - comparing tag: " + tag + " to image: " + img.Id + "; match!");
                    imageDescription = img;
                }
            }

            if (imageDescription !== null) {
                const image = docker.getImage(imageDescription.Id);
                Log.warn("AutoTestRouteHandler::removeDockerImage(..) - not removed; not implemented"); // for safety, remove when ready
                // const removeRes = await image.remove();
                // Log.info("AutoTestRouteHandler::removeDockerImage(..) - data returned: " + JSON.stringify(removeRes));
                success = true;
                Log.info("AutoTestRouteHandler::removeDockerImage(..) - done; success: " + success);
            } else {
                Log.warn("AutoTestRouteHandler::removeDockerImage(..) - tag does not map to active image");
                errorMsg = "Docker tag does not map to known image.";
                success = false;
            }

        } catch (err) {
            // NOTE: this seems to happen a lot due to dependent child images in the testing environment
            // it is unclear what happens with these in production
            Log.error("AutoTestRouteHandler::removeDockerImage(..) - ERROR Removing docker image: " + err.message);
            errorMsg = err.message;
        }

        if (success === true) {
            res.send(200, {success: success});
        } else {
            res.send(400, {success: false, message: errorMsg});
        }
        next();
    }
}
