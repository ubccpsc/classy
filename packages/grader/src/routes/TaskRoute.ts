import {EventEmitter} from "events";
import * as fs from "fs-extra";
import * as restify from "restify";
import {ContainerInput} from "../../../common/types/ContainerTypes";
import {TaskController, TaskEvent} from "../controllers/TaskController";
import {GradeTask} from "../model/GradeTask";
import {ObservableTaskMap} from "../model/ObservableTaskMap";
import {ServerSentEvent} from "../model/ServerSentEvent";
import {TaskStatus} from "../model/Task";

export class TaskRoute {
    protected readonly tasks: ObservableTaskMap;
    private readonly taskController: TaskController;
    private notifyCounter: number;
    public heartbeatInterval: number = 15000; // milliseconds

    constructor() {
        this.notifyCounter = 0;
        this.tasks = new ObservableTaskMap();
        this.taskController = new TaskController(this.tasks);  // TODO shouldn't be a class prop.
    }

    public async getTaskAttachments(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            const id = req.params.id;
            const filePath = req.params["*"];
            const basePath = this.taskController.getAttachmentBasePath(id);
            const path = basePath + "/" + filePath;

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
            rs.on("end", () => {
               rs.close();
            });
            rs.pipe(res);
        } catch (err) {
            // task id not found
            res.send(404, err.message);
        }

        next();
    }

    public async getTaskEvents(req: restify.Request, res: restify.Response, next: restify.Next) {
        res.writeHead(200, {
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache"
        });

        // While this wastes a TCP trip, we don't know when the first notification will be sent so we should acknowledge
        // the request immediately.
        res.flushHeaders();

        // Heartbeat
        const heartbeat = setInterval(function() {
            res.write("\n");
        }, this.heartbeatInterval);
        const sendNotification = (event: {id: string, status: string}) => {
            if (event.status === TaskStatus.Done || event.status === TaskStatus.Failed) {
                this.notifyCounter++;
                const task: GradeTask = this.tasks.get(event.id);
                const dataStr: string = JSON.stringify({
                    taskId: event.id,
                    body: task.executionOutput
                });
                const body: string = new ServerSentEvent(this.notifyCounter, event.status, dataStr).toString();
                res.write(body);
                res.write("\n\n");
            }
        };

        this.tasks.on("change", sendNotification.bind(this));
        // this.taskController.emitter.on("change", (data: TaskEvent) => {
        //
        //         if (data.event === TaskStatus.Done || data.event === TaskStatus.Failed) {
        //             this.notifyCounter++;
        //             const dataStr: string = JSON.stringify({
        //                 taskId: data.id,
        //                 body: data.body
        //             });
        //             const body: string = new ServerSentEvent(this.notifyCounter, data.event, dataStr).toString();
        //             res.write(body);
        //             res.write("\n\n");
        //         }
        // });

        // Clear heartbeat and listener
        req.on("close", () => {
            clearInterval(heartbeat);
            this.tasks.removeListener("change", sendNotification);
        });

        next();
    }

    public postTask(req: restify.Request, res: restify.Response, next: restify.Next) {
        try {
            const input: ContainerInput = req.body;
            const id: string = this.taskController.create(input);
            const me: string = req.isSecure() ? "https" : "http" + "://" + req.headers.host;
            const result = {
                id,
                attachments_url: `${me}/task/${id}/attachments`
            };
            res.json(201, result);
        } catch (err) {
            res.json(500, err.message);
        }

        next();
    }

    private sendNotification(data: TaskEvent) {
        if (data.event === TaskStatus.Done || data.event === TaskStatus.Failed) {
            this.notifyCounter++;
            const dataStr: string = JSON.stringify({
                taskId: data.id,
                body: data.body
            });
            const body: string = new ServerSentEvent(this.notifyCounter, data.event, dataStr).toString();
            // res.write(body);
            // res.write("\n\n");
        }
    }
}
