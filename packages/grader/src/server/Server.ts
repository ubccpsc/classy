import * as restify from "restify";
import Log from "../../../common/Log";
import {IContainerInput, IContainerOutput} from "../../../common/types/AutoTestTypes";
import {GradeTask} from "../task/GradeTask";
import {DockerContainer, IDockerContainer} from "../docker/DockerContainer";
import {Repository} from "../git/Repository";
import {Workspace} from "../storage/Workspace";

/**
 * This configures the REST endpoints for the server.
 */
export default class Server {
    private readonly rest: restify.Server;
    private readonly port: number;

    constructor(port: number, name: string) {
        this.rest = restify.createServer({ name });
        this.port = port;
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
    public start(): Promise<void> {
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

                this.rest.listen(this.port, () => {
                    Log.info("Server::start() - restify listening: " + this.rest.url);
                    resolve();
                });

                this.rest.on("error", (err: string) => {
                    // catches errors in restify start; unusual syntax due to internal node not using normal exceptions here
                    Log.info("Server::start() - restify ERROR: " + err);
                    reject(err);
                });

                // TODO add endpoint for serving static files

                this.rest.put("/task/grade/:id", restify.plugins.bodyParser(),
                    async (req: restify.Request, res: restify.Response, next: restify.Next) => {
                    try {
                        req.socket.setTimeout(0);  // don't close the connection
                        const id = req.params.id;
                        const input: IContainerInput = req.body;
                        const uid: number = Number(process.env.UID);
                        const token: string = process.env.GH_BOT_TOKEN.replace("token ", "");

                        // Add parameters to create the grading container. We'll be lazy and use the custom field.
                        input.containerConfig.custom = {
                            "--env": [
                                `ASSIGNMENT=${input.delivId}`,
                                `USER_UID=${uid}`
                            ],
                            "--volume": [
                                `${process.env.GRADER_HOST_DIR}/${id}/assn:/assn`,
                                `${process.env.GRADER_HOST_DIR}/${id}/output:/output`
                            ],
                            "--network": process.env.DOCKER_NET
                        };

                        // Inject the GitHub token into the cloneURL so we can clone the repo.
                        input.pushInfo.cloneURL = input.pushInfo.cloneURL.replace("://", `://${token}@`);

                        const workspace: Workspace = new Workspace(process.env.GRADER_PERSIST_DIR + "/" + id, uid);
                        const container: IDockerContainer = new DockerContainer(input.containerConfig.dockerImage);
                        const repo: Repository = new Repository();
                        const output: IContainerOutput = await new GradeTask(input, workspace, container, repo).execute();
                        res.json(200, output);
                    } catch (err) {
                        Log.error("Failed to handle grading task: " + err);
                        res.json(400, err);
                    }

                    next();
                });


            } catch (err) {
                Log.error("Server::start() - ERROR: " + err);
                reject(err);
            }
        });
    }
}
