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
        this.rest.get("/task/:id/notify", this.taskRoute.getTaskEvents.bind(this.taskRoute));
        this.rest.get("/task/:id/attachment/:path", this.taskRoute.getTaskAttachments.bind(this.taskRoute));
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

                // this.rest.put("/task/grade/:id", restify.plugins.bodyParser(),
                //     async (req: restify.Request, res: restify.Response, next: restify.Next) => {
                //         try {
                //             req.socket.setTimeout(0);  // don't close the connection
                //             const id = req.params.id;
                //             const input: ContainerInput = req.body;
                //             const uid: number = Number(process.env.UID);
                //             const token: string = process.env.GH_BOT_TOKEN.replace("token ", "");
                //
                //             // Add parameters to create the grading container. We'll be lazy and use the custom field.
                //             input.containerConfig.custom = {
                //                 "--env":      [
                //                     `ASSIGNMENT=${input.delivId}`,
                //                     `USER_UID=${uid}`
                //                 ],
                //                 "--volume":   [
                //                     `${process.env.GRADER_HOST_DIR}/${id}/assn:/assn`,
                //                     `${process.env.GRADER_HOST_DIR}/${id}/output:/output`
                //                 ],
                //                 "--network":  process.env.DOCKER_NET,
                //                 "--add-host": process.env.HOSTS_ALLOW,
                //                 "--user": uid
                //             };
                //
                //             // Inject the GitHub token into the cloneURL so we can clone the repo.
                //             input.target.cloneURL = input.target.cloneURL.replace("://", `://${token}@`);
                //
                //             const workspace: Workspace = new Workspace(process.env.GRADER_PERSIST_DIR + "/" + id, uid);
                //             const container: IDockerContainer = new DockerContainer(input.containerConfig.dockerImage);
                //             const repo: Repository = new Repository();
                //             const output: ContainerOutput = await new GradeTask(id, input, workspace, container, repo).execute();
                //             res.json(200, output);
                //         } catch (err) {
                //             Log.error("Failed to handle grading task: " + err);
                //             res.json(400, err);
                //         }
                //
                //         next();
                //     });

            } catch (err) {
                Log.error("Server::start() - ERROR: " + err);
                reject(err);
            }
        });
    }
}
