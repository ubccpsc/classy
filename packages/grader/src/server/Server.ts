import * as restify from "restify";
import Log from "../../../common/Log";
import {TaskRoute} from "../routes/TaskRoute";

/**
 * This configures the REST endpoints for the server.
 */
export default class Server {
    private readonly rest: restify.Server;
    private readonly taskRoute: TaskRoute;

    constructor(name: string) {
        this.rest = restify.createServer({name});
        this.taskRoute = new TaskRoute();
        this.registerRoutes();
    }

    private registerRoutes(): void {
        this.rest.get("/task/notify", this.taskRoute.getTaskEvents.bind(this.taskRoute));
        this.rest.get("/task/:id/attachment/*", this.taskRoute.getTaskAttachments.bind(this.taskRoute));
        this.rest.post("/task", restify.plugins.bodyParser(), this.taskRoute.postTask.bind(this.taskRoute));
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
     * Starts the server. Returns a promise with a boolean value. Promises are used
     * here because starting the server takes some time and we want to know when it
     * is done (and if it worked).
     *
     * @returns {Promise<boolean>}
     */
    public start(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                Log.info("Server::start() - start");

                // support CORS
                this.rest.use(
                    function crossOrigin(req: any, res: any, next: any) {
                        res.header("Access-Control-Allow-Origin", "*");
                        res.header("Access-Control-Allow-Headers", "X-Requested-With");
                        return next();
                    }
                );

                this.rest.listen(port, () => {
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
