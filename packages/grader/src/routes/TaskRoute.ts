import * as fs from "fs-extra";
import * as restify from "restify";
import Log from "../../../common/Log";
import {ContainerInput, ContainerOutput} from "../../../common/types/ContainerTypes";
import {TaskController} from "../controllers/TaskController";
import {ServerSentEvent} from "../model/ServerSentEvent";

export class TaskRoute {
    private readonly taskController: TaskController;

    constructor() {
        this.taskController = new TaskController();
    }

    public async getTaskAttachments(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            const id = req.params.id;
            const filePath = req.params["*"];
            const basePath = this.taskController.getAttachmentBasePath(id);
            const path = basePath + "/" + filePath;
            // await fs.access(path);

            // fs.createReadStream(basePath + "/" + path).pipe(res).on("end", res.end);
            const rs = fs.createReadStream(path);
            rs.on("error", (err) => {
                if (err.code === "ENOENT") {
                    // File doesn't exist
                    res.send(404, err.message);
                } else {
                    // problem while trying to read the file
                    res.send(500, err.message);
                }
            });
            rs.pipe(res);
            // res.send(200, rs);
        } catch (err) {
            // task id not found
            res.send(404, err.message);
        }

        next();
    }

    public async getTaskEvents(req: restify.Request, res: restify.Response, next: restify.Next) {
        Log.info("TaskRoute::getTaskEvents(..) - start; params: " + JSON.stringify(req.params));
        let resultPromise: Promise<ContainerOutput>;
        let id: string;
        try {
            id = req.params.id;
            resultPromise = this.taskController.getResult(id);
        } catch (err) {
            Log.error("TaskRoute::getTaskEvents(..) - ERROR Getting result for " + id + ": " + err.message);
            return res.send(404, err.message);
        }

        req.on("close", res.end);
        res.writeHead(200, {
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache"
        });

        let body: string;
        try {
            const result = await resultPromise;
            // Set the event id to 1 since we only ever emit a single event.
            body = new ServerSentEvent(1, "done", JSON.stringify(result)).toString();
        } catch (err) {
            body = new ServerSentEvent(1, "error", err).toString();
            Log.error("TaskRoute::getTaskEvent(..) - ERROR An error was raised during execution of task " + id + ": " + err.message);
        } finally {
            Log.trace("TaskRoute::getTaskEvent(..) - Sending response: " + body);
            res.write(body);
            res.write("\n\n");
            res.end();
        }

        next();
    }

    public postTask(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            const input: ContainerInput = req.body;
            const id: string = this.taskController.create(input);
            const me: string = req.isSecure() ? "https" : "http" + "://" + req.headers.host;
            const result = {
                id,
                notify_url: `${me}/task/${id}/notify`,
                attachments_url: `${me}/task/${id}/attachments/{+name}`
            };
            res.json(201, result);
        } catch (err) {
            res.json(500, err.message);
        }

        next();
    }
}
