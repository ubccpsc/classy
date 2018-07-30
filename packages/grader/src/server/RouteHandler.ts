import * as restify from "restify";
import { IContainerOutput, IGradeTask, IHostEnv } from "../Types";
import Log from "../../../common/Log";
import {GradeWorker, IGradeWorker} from "../worker/GradeWorker";


export default class RouteHandler {
    public static async putGradingTask(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            req.socket.setTimeout(0);  // don't close the connection
            const id: string = req.params.id;
            const body = req.body;
            body.assn["token"] = process.env["GH_BOT_TOKEN"].replace("token ", "");
                // Config.getInstance().getProp(ConfigKey.githubBotToken).replace("token ", "");
            const task: IGradeTask = body;

            // TODO @ncbradley workspace should be an env var
            const workspace = `/data/${id}`; //`/app/grader/data/${id}`;
            const host: IHostEnv = {
                name: process.env.HOST_NAME,
                port: Number(process.env.SOCK_PORT),
                uid: Number(process.env.UID),
                net: process.env.DOCKER_NET,
                mount: process.env.GRADER_HOST_DIR,
            };
            const grader: IGradeWorker = new GradeWorker(workspace, task, host);
            const out: IContainerOutput = await grader.execute();
            res.json(200, out);
        } catch (err) {
            Log.error("Failed to handle grading task: " + err);
            res.json(400, err);
        }
    }
}
