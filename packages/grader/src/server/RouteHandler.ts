import * as fs from "fs-extra";
import * as restify from "restify";
import { URL } from "url";
import {DockerContainer, IDockerContainer} from "../docker/DockerContainer";
import {Repository} from "../git/Repository";
import { ContainerFirewall, IContainerFirewall } from "../network/ContainerFirewall";
import { FirewallController } from "../network/FirewallController";
import { IContainerOutput, IDockerContainerOptions, IGradeReport, IGradeTask, IHostEnv } from "../Types";
import Log from "../util/Log";
import {GradeWorker, IGradeWorker} from "../worker/GradeWorker";
import { ISocketServer, SocketServer } from "./SocketServer";

export default class RouteHandler {
    public static containerSocketServer: ISocketServer = new SocketServer(Number(process.env.SOCK_PORT));

    public static async putGradingTask(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            req.socket.setTimeout(0);  // don't close the connection
            const id: string = req.params.id;
            const body = req.body;
            body.assn["token"] = process.env.GITHUB_TOKEN;
            const task: IGradeTask = body;
            if (!RouteHandler.containerSocketServer.isListening) {
                Log.info("Starting socket server");
                await RouteHandler.containerSocketServer.start();
                Log.info("DONE");
            }

            const workspace = `/data/${id}`;
            const host: IHostEnv = {
                name: process.env.HOST_NAME,
                port: Number(process.env.SOCK_PORT),
                uid: Number(process.env.USER_UID),
                net: process.env.DOCKER_NET,
                mount: process.env.HOST_DIR,
            };
            const grader: IGradeWorker = new GradeWorker(workspace, task, RouteHandler.containerSocketServer, host);
            const out: IContainerOutput = await grader.execute();
            res.json(200, out);
        } catch (err) {
            res.json(400, err);
        }
    }
}
