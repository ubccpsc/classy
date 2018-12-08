import {EventEmitter} from "events";

export enum TaskStatus {
    Created = "CREATED",
    Running = "RUNNING",
    Done = "DONE",
    Failed = "FAILED"
}

export class Task {
    public readonly statusEmitter: EventEmitter;
    private taskStatus: TaskStatus;

    constructor() {
        this.statusEmitter = new EventEmitter();
    }

    public get status(): TaskStatus {
        return this.taskStatus;
    }

    public set status(status: TaskStatus) {
        this.taskStatus = status;
        this.statusEmitter.emit("change", status);
    }
}
