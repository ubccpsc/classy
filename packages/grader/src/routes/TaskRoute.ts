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
        let resultPromise: Promise<ContainerOutput>;
        try {
            const id: string = req.params.id;
            resultPromise = this.taskController.getResult(id);
        } catch (err) {
            return res.send(404, err.message);
        }

        req.on("close", res.end);
        res.writeHead(200, {
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache"
        });

        try {
            const result = await resultPromise;
            // Set the event id to 1 since we only ever emit a single event.
            const body: string = new ServerSentEvent(1, "done", JSON.stringify(result)).toString();
            res.write(body);
        } catch (err) {
            const body: string = new ServerSentEvent(1, "error", err).toString();
            res.write(body);
        } finally {
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
