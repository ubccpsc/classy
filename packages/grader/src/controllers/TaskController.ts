import {ContainerInput, ContainerOutput} from "../../../common/types/ContainerTypes";
import {GradeTask} from "../model/GradeTask";
import {ObservableTaskMap} from "../model/ObservableTaskMap";
import {TaskStatus} from "../model/Task";
import {Workspace} from "../model/Workspace";

export interface TaskEvent {
    id: string;
    event: TaskStatus;
    body: any;
}

interface Task {
    duration: number;  // milliseconds
    start: Date;
    status: TaskStatus;
    result: Promise<ContainerOutput>;
    workspace: Workspace;
}

export class TaskController {
    protected readonly tasks: ObservableTaskMap;

    constructor(tasks: ObservableTaskMap) {
        this.tasks = tasks;
    }

    public create(input: ContainerInput): string {
        const id: string = input.target.commitSHA + "-" + input.delivId;
        const uid: number = Number(process.env.UID);
        const token: string = process.env.GH_BOT_TOKEN.replace("token ", "");

        // Add parameters to create the grading container. We'll be lazy and use the custom field.
        input.containerConfig.custom = {
            "--env":      [
                `ASSIGNMENT=${input.delivId}`
            ],
            "--volume":   [
                `${process.env.GRADER_HOST_DIR}/${id}/assn:/assn`,
                `${process.env.GRADER_HOST_DIR}/${id}/output:/output`
            ],
            "--network":  process.env.DOCKER_NET,
            "--add-host": process.env.HOSTS_ALLOW,
            "--user": uid
        };

        // Inject the GitHub token into the cloneURL so we can clone the repo.
        input.target.cloneURL = input.target.cloneURL.replace("://", `://${token}@`);

        const workspace: Workspace = new Workspace(process.env.GRADER_PERSIST_DIR + "/" + id, uid);
        const gradeTask: GradeTask = new GradeTask(id, input, workspace);
        const result = gradeTask.execute();

        this.tasks.set(id, gradeTask);
        gradeTask.on("change", (status: TaskStatus) => {
            this.tasks.emit("change", {id, status});
        });
        //
        // const statusListener = gradeTask.statusEmitter;
        //
        // this.tasks[id] = {
        //     duration: 0,
        //     start: new Date(),
        //     status: gradeTask.status,
        //     result,
        //     workspace
        // };
        //
        // statusListener.on("change", async (newStatus: TaskStatus) => {
        //     const task = this.tasks[id];
        //     task.status = newStatus;
        //     task.duration = new Date().getTime() - task.start.getTime();
        //
        //     const event: TaskEvent = {
        //         id,
        //         event: newStatus,
        //         body: null
        //     };
        //
        //     if (newStatus === TaskStatus.Done || newStatus === TaskStatus.Failed) {
        //         event.body = await result;
        //     }
        //
        //     this.emitter.emit("change", event);
        // });

        return id;
    }

    public getTask(id: string): GradeTask {
        if (!this.tasks.has(id)) {
            throw new Error("id " + id + " not found");
        }

        return this.tasks.get(id);
    }

    public getAttachmentBasePath(id: string): string {
        return this.getTask(id).workspace.rootDir;
    }
}
