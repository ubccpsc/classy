import { exec } from "child_process";
import * as fs from "fs-extra";
import {Socket} from "net";
import {DockerContainer, IDockerContainer} from "../docker/DockerContainer";
import {Repository} from "../git/Repository";
import {ContainerFirewall, IContainerFirewall} from "../network/ContainerFirewall";
import {FirewallController} from "../network/FirewallController";
import {ISocketServer} from "../server/SocketServer";
import {IAssignment, IContainerOutput, IDockerContainerOptions, IGradeContainer, IGradeReport, IGradeTask, IHostEnv} from "../Types";
import Log from "../util/Log";

export interface IGradeWorker {
    execute(): Promise<IContainerOutput>;
}

export class GradeWorker implements IGradeWorker {
    private readonly workspace: string;
    private readonly assnId: string;
    private readonly assnSrc: IAssignment;
    private readonly cntr: IGradeContainer;
    private readonly ss: ISocketServer;
    private readonly host: IHostEnv;

    constructor(workspace: string, task: IGradeTask, ss: ISocketServer, host: IHostEnv) {
        this.workspace = workspace;
        this.assnId = task.assnId;
        this.assnSrc = task.assn;
        this.cntr = task.container;
        this.ss = ss;
        this.host = host;
    }

    public async execute(): Promise<IContainerOutput> {
        let out: IContainerOutput = {
            commitUrl: this.assnSrc.url,
            timestamp: Date.now(),
            report: null,
            feedback: "",
            postbackOnComplete: false,
            custom: {},
            attachments: [],
            state: "SUCCESS"
        };

        try {
            await this.preRun();
            out = await this.runContainer(out);
            await this.postRun();
        } catch (err) {
            Log.warn(`GradeWorker::execute() - ERROR Processing ${this.assnSrc.commit}. ${err}`);
            out.feedback = "Error running container.";
            out.state = "FAIL";
        }

        return out;
    }

    protected async prepareRepo(url: string, dir: string, ref?: string): Promise<Repository> {
        const repo: Repository = new Repository(dir);
        await repo.clone(url);
        if (typeof ref !== "undefined") {
            await repo.checkout(ref);
        }
        return repo;
    }

    protected async runContainer(out: IContainerOutput): Promise<IContainerOutput> {
        const cntr: IDockerContainer = new DockerContainer(this.cntr.image);
        let cntrFirewall: IContainerFirewall;
        let socket: Socket;
        let state: string;

        try {
            // TODO This is a total hack: "/data" is what the host directory is bound to in this container. See the
            // docker-compose file.
            const hostVol: string = this.host.mount + this.workspace.replace("/data", "");
            const containerOptions: IDockerContainerOptions = {
                "--env": [`ASSIGNMENT=${this.assnId}`, `USER_UID=${this.host.uid}`, `HOST_NAME=${this.host.name}`, `HOST_PORT=${this.host.port}`],
                "--volume": [`${hostVol}/assn:/assn`, `${hostVol}/output:/output`],
                "--network": this.host.net,
            };
            await cntr.create(containerOptions);
            await cntr.start();
            const [, cntrAddr] = await cntr.inspect("{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}");

            Log.info(`Container ${cntr.id.substring(0, 7)} started with IP ${cntrAddr}`);

            // Handle messages from the container if it ever sends a message but don't block waiting
            const fwId: string = cntr.id.substring(0, 7);
            cntrFirewall = new ContainerFirewall(fwId, cntrAddr, new FirewallController());

            Log.info("Register container socket listener");
            this.ss.getSocket(cntrAddr).then((sock) => {
                socket = sock;
                socket.on("data", async (data: string) => {
                    const response = await this.handleContainerMessage(data, cntrFirewall);
                    socket.write(response);
                    // socket.end();
                });
            });

            Log.info("Register timeout");
            // Set a timer to kill the container if it doesn't finish in the time alloted
            let didFinish = false;
            let didTimeout = false;
            if (this.cntr.timeout > 0) {
                setTimeout(async () => {
                    if (!didFinish) {
                        didTimeout = true;
                        await cntr.stop();
                    }
                }, this.cntr.timeout);
            }

            const [, cmdOut] = await cntr.wait();
            const cntrCode = Number(cmdOut);
            Log.info("Container done with code " + cntrCode);
            didFinish = true;
            if (didTimeout) {
                state = "TIMEOUT";
            }
            let [, log] = await cntr.logs();
            if (typeof this.cntr.logSize !== "undefined") {
                log = log.substring(0, this.cntr.logSize);
            }
            fs.writeFile(`${this.workspace}/stdio.txt`, log);

            try {
                if (state === "TIMEOUT") {
                    out.feedback = "Container did not complete in the allotted time.";
                    out.postbackOnComplete = true;
                    out.state = "TIMEOUT";
                } else {
                    const report: IGradeReport = await fs.readJson(`${this.workspace}/output/report.json`);
                    out.report = report;
                    out.feedback = report.feedback;
                    out.postbackOnComplete = cntrCode !== 0;
                    out.state = "SUCCESS";
                }
            } catch (err) {
                Log.warn(`RouteHandler::postGradingTask(..) - ERROR Reading grade report. ${err}`);
                out.feedback = "Failed to read grade report.";
                out.state = "INVALID_REPORT";
            }
        } catch (err) {
            Log.warn(`RouteHandler::postGradingTask(..) - ERROR Processing commit ${this.assnSrc.commit}. ${err}`);
            out.feedback = "Error running container.";
            out.state = "FAIL";
        } finally {
            if (typeof socket !== "undefined") {
                socket.end();
            }
            cntr.remove();
            try {
                cntrFirewall.delete();
            } catch (err) {
                // ignore: container did not request any exceptions so no firewall chain was created
            }
        }

        return out;
    }

    protected async preRun(): Promise<void> {
        Log.info(`GradeWorker::preRun() - Start`);
        const assnUrl = this.assnSrc.url.replace("://", `://${this.assnSrc.token}@`);
        const assnDir = `${this.workspace}/assn`;
        const assnRef = this.assnSrc.commit;

        await fs.mkdirp(`${this.workspace}/output`);
        const assnRepo = await this.prepareRepo(assnUrl, assnDir, assnRef);
        await new Promise((resolve, reject) => {
            exec(`chown -R ${this.host.uid} ${this.workspace}`, (error) => {
                if (error) {
                    reject(error);
                }
                resolve();
            });
        });
    }

    protected async postRun(): Promise<void> {
        Log.info(`GradeWorker::postRun() - Start`);
        return fs.remove(`${this.workspace}/assn`);
    }

    protected async handleContainerMessage(message: string, containerFirewall: IContainerFirewall): Promise<string> {
        if (message.toUpperCase().startsWith("NET ALLOW ")) {
            try {
                const rawUrl: string = message.substr(9);
                const url = new URL(rawUrl);
                await containerFirewall.unblock(url.host, Number(url.port));
                return "SUCCESS";
            } catch (err) {
                Log.error(`RouteHandler::handleContainerMessage(..) - ${err}`);
                return "INVALID_URL";
            }
        } else {
            Log.warn(`RouteHandler::handleContainerMessage(..) - Unsupported or invalid message from client: ${message}`);
            return "INVALID_MSG";
        }
    }
}
