import * as restify from "restify";

import Config from "../../../common/Config";
import Log from "../../../common/Log";

import RouteHandler from "./RouteHandler";

/**
 * This configures the endpoints for the AutoTest REST server.
 */
export default class Server {
    private rest: restify.Server;
    private port: number;

    constructor() {
        Config.getInstance(); // for SSL params
    }

    /**
     * Stops the server. Returns a promise so we know when the connections have
     * actually been fully closed and the port has been released.
     *
     * @returns {Promise<boolean>}
     */
    public async stop(): Promise<boolean> {
        Log.info("Server::close()");
        const that = this;
        return new Promise<boolean>(function(fulfill) {
            that.rest.close(function() {
                fulfill(true);
            });
        });
    }

    /**
     * Sets the port on this instance of a server
     * @returns {void}
     */
    public setPort(portNum: number) {
        Log.info("Server::setPort()");
        this.port = portNum;
    }

    /**
     * Starts the server. Returns a promise with a boolean value. Promises are used
     * here because starting the server takes some time and we want to know when it
     * is done (and if it worked).
     *
     * @returns {Promise<boolean>}
     */
    public start(): Promise<boolean> {
        const that = this;
        return new Promise(function(fulfill, reject) {
            try {
                Log.info("Server::start() - start");

                that.rest = restify.createServer({
                    name: "AutoTest"
                    // key:         fs.readFileSync(Config.getInstance().getProp(ConfigKey.sslKeyPath)),
                    // certificate: fs.readFileSync(Config.getInstance().getProp(ConfigKey.sslCertPath))
                });

                // support CORS
                that.rest.use(
                    function crossOrigin(req: any, res: any, next: any) {
                        res.header("Access-Control-Allow-Origin", "*");
                        res.header("Access-Control-Allow-Headers", "X-Requested-With");
                        return next();
                    });

                // Return the test queue stats
                // that.rest.get("/queue", restify.bodyParser(), RouteHandler.queueStats);

                // GitHub Webhook endpoint
                that.rest.post("/githubWebhook", restify.plugins.bodyParser(), RouteHandler.postGithubHook);

                // Resource endpoint
                that.rest.get("/resource/:name", restify.plugins.bodyParser(), RouteHandler.getResource);

                that.rest.listen(that.port, function() {
                    Log.info("Server::start() - restify listening: " + that.rest.url);
                    fulfill(true);
                });

                that.rest.on("error", function(err: string) {
                    // catches errors in restify start; unusual syntax due to internal node not using normal exceptions here
                    Log.info("Server::start() - restify ERROR: " + err);
                    reject(err);
                });

            } catch (err) {
                Log.error("Server::start() - ERROR: " + err);
                reject(err);
            }
        });
    }
}
