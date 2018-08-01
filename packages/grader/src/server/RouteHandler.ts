import * as restify from "restify";
import {IHostEnv} from "../Types";
import Log from "../../../common/Log";
import {GradeWorker, IGradeWorker} from "../worker/GradeWorker";
import {IContainerInput, IContainerOutput} from "../../../common/types/AutoTestTypes";

export default class RouteHandler {
    public static async putGradingTask(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            req.socket.setTimeout(0);  // don't close the connection
            const id: string = req.params.id;
            const task: IContainerInput = req.body;

            // TODO @ncbradley workspace should be an env var
            const workspace = `/data/${id}`; //`/app/grader/data/${id}`;
            const host: IHostEnv = {
                uid: Number(process.env.UID),
                net: process.env.DOCKER_NET,
                mount: process.env.GRADER_HOST_DIR,
            };

            // Inject the GitHub token into the cloneURL so the GradeTask can clone the student's repo.
            const token: string = process.env["GH_BOT_TOKEN"].replace("token ", "");
            task.pushInfo.cloneURL.replace("://", `://${token}@`);
            //const grader: IGradeWorker = new GradeTask(workspace, task, host);
            const out: IContainerOutput = null;// await grader.execute();
            res.json(200, out);
        } catch (err) {
            Log.error("Failed to handle grading task: " + err);
            res.json(400, err);
        }
    }
}
