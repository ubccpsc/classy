// import * as sha256 from "fast-sha256";
import * as crypto from "crypto";
import * as Docker from "dockerode";
import * as restify from "restify";

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {CommitTarget} from "../../../common/types/ContainerTypes";
import Util from "../../../common/Util";

import {AutoTest} from "../autotest/AutoTest";
import {ClassPortal} from "../autotest/ClassPortal";
import {MongoDataStore} from "../autotest/DataStore";
import {EdXClassPortal} from "../edx/EdxClassPortal";
import {GitHubAutoTest} from "../github/GitHubAutoTest";
import {GitHubUtil} from "../github/GitHubUtil";

export default class RouteHandler {
    public static docker: Docker = null;
    public static autoTest: AutoTest = null;

    public static getDocker(): Docker {
        if (RouteHandler.docker === null) {
            if (Config.getInstance().getProp(ConfigKey.name) === "classytest") {
                // Running tests; don't need to connect to the Docker daemon
                this.docker = null;
            } else {
                // Connect to the Docker socket using defaults
                RouteHandler.docker = new Docker();
            }
        }

        return RouteHandler.docker;
    }

    public static getAutoTest(): AutoTest {
        if (RouteHandler.autoTest === null) {
            const dataStore = new MongoDataStore();
            const docker = RouteHandler.getDocker();
            let portal: ClassPortal;

            if (Config.getInstance().getProp(ConfigKey.name) === "sdmm") {
                portal = new EdXClassPortal();
            } else {
                portal = new ClassPortal();
            }

            RouteHandler.autoTest = new GitHubAutoTest(dataStore, portal, docker);
        }
        return RouteHandler.autoTest;
    }

    /**
     * Handles GitHub POSTs, currently:
     *  - commit_comment
     *  - push
     */
    public static postGithubHook(req: restify.Request, res: restify.Response, next: restify.Next) {
        const start = Date.now();
        const githubEvent: string = req.header("X-GitHub-Event");
        let githubSecret: string = req.header("X-Hub-Signature");

        if (typeof githubSecret === 'undefined') {
            githubSecret = null;
        }

        Log.info("RouteHandler::postGithubHook(..) - start; handling event: " + githubEvent + "; signature: " + githubSecret);
        const body = req.body;

        const handleError = function(msg: string) {
            Log.error("RouteHandler::postGithubHook() - failure; ERROR: " + msg + "; took: " + Util.took(start));
            res.json(400, "Failed to process commit.");
        };

        if (githubSecret !== null) {
            try {
                Log.info("RouteHandler::postGithubHook(..) - trying to compute webhook secrets");

                const atSecret = Config.getInstance().getProp(ConfigKey.autotestSecret);

                // for this library:
                // import * as sha256 from "fast-sha256";
                //
                // const secretKey = new Buffer(sha256.hash(atSecret)).toString('hex');
                //
                // Log.info("RouteHandler::postGithubHook(..) - key: " + secretKey + "; header: " + githubSecret);
                //
                // // different api, but same idea: https://gist.github.com/stigok/57d075c1cf2a609cb758898c0b202428
                // const h = new sha256.HMAC(sha256.hash(atSecret));
                // const digest = h.update(body).digest();
                // const computedSecret = new Buffer(digest).toString('hex');
                // Log.info("RouteHandler::postGithubHook(..) - computed 1: " + computedSecret);
                //
                // const bodyStr = JSON.stringify(body, null, 0);
                // const bodyArr = new Uint8Array(bodyStr.length);
                // for (let i = 0; i < bodyStr.length; i++) {
                //     bodyArr[i] = bodyStr.charCodeAt(i);
                // }
                //
                // // simpler than v3 below and with the same result
                // const digest2 = sha256.hmac(sha256.hash(atSecret), bodyArr);
                // const computedSecret2 = new Buffer(digest2).toString('hex');
                // Log.info("RouteHandler::postGithubHook(..) - computed 2: " + computedSecret2);
                //
                // const h3 = new sha256.HMAC(sha256.hash(atSecret));
                // const digest3 = h3.update(bodyArr).digest();
                // const computedSecret3 = new Buffer(digest3).toString('hex');
                // Log.info("RouteHandler::postGithubHook(..) - computed 3: " + computedSecret3);

                const key = crypto.createHash('sha1').update(atSecret, 'utf8').digest('hex');
                Log.info("RouteHandler::postGithubHook(..) - key: " + key); // should be same as webhook added key
                const computed4 = crypto.createHmac('sha256', key)
                    .update(JSON.stringify(body))
                    .digest('hex');
                Log.info("RouteHandler::postGithubHook(..) - key: " + key + "; computed 4: " + computed4);

                const computed5 = crypto.createHmac('sha1', atSecret)
                    .update(JSON.stringify(body))
                    .digest('hex');
                Log.info("RouteHandler::postGithubHook(..) - computed 5: " + computed5);

                // Log.info("RouteHandler::postGithubHook(..) - expected: " + expectedSecret + "; header: " +
                //     githubSecret + "; computed: " + computedSecret);

                // TODO: if githubSecret exists, check if it is right
                // https://developer.github.com/webhooks/securing/

            } catch (err) {
                Log.error("RouteHandler::postGithubHook(..) - ERROR computing HMAC: " + err.message);
            }
        } else {
            Log.info("RouteHandler::postGithubHook(..) - secret ignored (not present)");
        }

        if (githubEvent === 'ping') {
            // github test packet; use to let the webhooks know we are listening
            Log.info("RouteHandler::postGithubHook() - <200> pong.");
            res.json(200, "pong");
        } else {
            RouteHandler.handleWebhook(githubEvent, body).then(function(commitEvent) {
                if (commitEvent !== null) {
                    res.json(200, commitEvent); // report back our interpretation of the hook
                } else {
                    // handleError("Error handling webhook; event: " + githubEvent + "; body: " + JSON.stringify(body, null, 2));
                    handleError("Webhook not handled (if branch was deleted this is normal)");
                }
            }).catch(function(err) {
                Log.error("RouteHandler::postGithubHook() - ERROR: " + err);
                handleError(err);
            });
        }
        return next();
    }

    private static async handleWebhook(event: string, body: string): Promise<CommitTarget> {

        // cast is unfortunate, but if we're listening to these routes it must be a github AT instance
        const at: GitHubAutoTest = RouteHandler.getAutoTest() as GitHubAutoTest;

        switch (event) {
            case "commit_comment":
                const commentEvent = await GitHubUtil.processComment(body);
                Log.trace("RouteHandler::handleWebhook() - comment request: " + JSON.stringify(commentEvent, null, 2));
                await at.handleCommentEvent(commentEvent);
                return commentEvent;
            case "push":
                const pushEvent = await GitHubUtil.processPush(body, new ClassPortal());
                Log.trace("RouteHandler::handleWebhook() - push request: " + JSON.stringify(pushEvent, null, 2));
                await at.handlePushEvent(pushEvent);
                return pushEvent;
            default:
                Log.error("RouteHandler::handleWebhook() - Unhandled GitHub event: " + event);
                throw new Error("Unhandled GitHub hook event: " + event);
        }
    }

    // public static getResource(req: restify.Request, res: restify.Response, next: restify.Next) {
    //     const path = Config.getInstance().getProp(ConfigKey.persistDir) + "/" + req.url.split("/resource/")[1];
    //     Log.info("RouteHandler::getResource(..) - start; fetching resource: " + path);
    //
    //     const rs = fs.createReadStream(path);
    //     rs.on("error", (err: any) => {
    //         if (err.code === "ENOENT") {
    //             Log.error("RouteHandler::getResource(..) - ERROR Requested resource does not exist: " + path);
    //             res.send(404, err.message);
    //         } else {
    //             Log.error("RouteHandler::getResource(..) - ERROR Reading requested resource: " + path);
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
            const docker = RouteHandler.getDocker();
            const filtersStr = req.query.filters;
            const options: any = {};
            if (filtersStr) {
                options["filters"] = JSON.parse(filtersStr);
            }
            Log.trace("RouteHandler::getDockerImages(..) - Calling Docker listImages(..) with options: " + JSON.stringify(options));
            const images = await docker.listImages(options);
            res.send(200, images);
        } catch (err) {
            Log.error("RouteHandler::getDockerImages(..) - ERROR Retrieving docker images: " + err.message);
            if (err.statusCode) {
                // Error from Docker daemon
                res.send(err.statusCode, err.message);
            } else {
                res.send(400, err.message);
            }
        }

        return next();
    }

    public static async postDockerImage(req: restify.Request, res: restify.Response, next: restify.Next) {
        const docker = RouteHandler.getDocker();
        const token = Config.getInstance().getProp(ConfigKey.githubDockerToken);
        try {
            const body = req.body;
            const remote = token ? body.remote.replace("https://", "https://" + token + "@") : body.remote;
            const tag = body.tag;
            const file = body.file;
            const stream = await docker.buildImage(null, {remote, t: tag, dockerfile: file});
            stream.on("error", (err: Error) => {
                Log.error("Error building image. " + err.message);
                res.send(500, "Error building image. " + err.message);
            });
            stream.on("end", () => {
                Log.info("Finished building image.");
            });
            stream.pipe(res);
        } catch (err) {
            Log.error("RouteHandler::postDockerImage(..) - ERROR Building docker image: " + err.message);
            res.send(err.statusCode, err.message);
        }

        return next();
    }
}
