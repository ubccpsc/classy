import * as fs from "fs";
import * as restify from "restify";
import Log from "../util/Log";
import RouteHandler from "./RouteHandler";

/**
 * This configures the REST endpoints for the server.
 */
export default class Server {
    private rest: restify.Server;
    private port: number;

    // private config: IConfig; // for SSL params

    constructor() {
        // this.config = new AppConfig(); // for SSL params
    }

    /**
     * Stops the server. Again returns a promise so we know when the connections have
     * actually been fully closed and the port has been released.
     *
     * @returns {Promise<void>}
     */
    public async stop(): Promise<void> {
        Log.info("Server::close()");
        return new Promise<void>((resolve) => {
            this.rest.close(resolve);
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
     * Gets the port that was set on this instance of a server
     * @returns {number}
     */

    /*
    public getPort() {
        return this.port;
    }
    */

    /**
     * Starts the server. Returns a promise with a boolean value. Promises are used
     * here because starting the server takes some time and we want to know when it
     * is done (and if it worked).
     *
     * @returns {Promise<boolean>}
     */
    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {

                Log.info("Server::start() - start");

                /*
                that.rest = restify.createServer({
                    name:        "AutoTest",
                    key:         fs.readFileSync(that.config.getSSLKeyPath()).toString(),
                    certificate: fs.readFileSync(that.config.getSSLCertPath()).toString(),
                    ca:          fs.readFileSync(that.config.getSSLIntCertPath()).toString(),
                });
                */
                this.rest = restify.createServer({ // Non SSL version
                    name: "ContainerHost"
                });

                // support CORS
                this.rest.use(
                    function crossOrigin(req: any, res: any, next: any) {
                        res.header("Access-Control-Allow-Origin", "*");
                        res.header("Access-Control-Allow-Headers", "X-Requested-With");
                        return next();
                    }
                );

                // Worker pool endpoints
                // this.rest.get("/worker-pool/status");
                // this.rest.post("/worker-pool/task/grade", restify.plugins.bodyParser(), RouteHandler.postGradingTask);
                this.rest.put("/task/grade/:id", restify.plugins.bodyParser(), RouteHandler.putGradingTask);

                // Worker endpoints
                // this.rest.get("/worker/:id/status");
                // this.rest.put("/worker/:id/status");  // change stop a worker

                // Archive endpoints
                // this.rest.get("/archive/:id");

                // Return the test queue stats
                // that.rest.get("/queue", restify.bodyParser(), RouteHandler.queueStats);

                // GitHub Webhook endpoints

                // if (Config.getInstance().getProp("kind") === "ubc") {
                //     this.rest.post("/submit", restify.plugins.bodyParser(), RouteHandler.postGithubHook);
                // } else if (Config.getInstance().getProp("kind") === "edx") {
                //     Log.info("Server::start() - xqueue request received - start");
                //     this.rest.post("/", restify.plugins.bodyParser(), RouteHandler.postXQueue);
                // }



                this.rest.listen(this.port, () => {
                    Log.info("Server::start() - restify listening: " + this.rest.url);
                    resolve();
                });

                this.rest.on("error", (err: string) => {
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
