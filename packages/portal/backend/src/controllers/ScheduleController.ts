// import Scheduler from "node-schedule"
//
//
//

import {GitHubController} from "./GitHubController";
import {AssignmentController} from "./340/AssignmentController";
import Log from "../../../../common/Log";

let schedule = require('node-schedule');

// This exists so we can potentially add more information to the task
export interface Task {
    scheduledTask: any,
    // time: string
}

// TAKE THE DELIVERABLE AND MAP IT TO THE ACTION
// ONLY ONE JOB PER ACTION PER DELIVERABLE

export class ScheduleController {

    private taskList: {[taskName: string]:Task[]};
    private static instance: ScheduleController = null;

    public static getInstance(): ScheduleController {
        if(ScheduleController.instance === null) {
            ScheduleController.instance = new ScheduleController();
        }
        return ScheduleController.instance;
    }

    private constructor() {
        this.taskList = {};
    }

    public async scheduleAssignmentCreation(scheduledTime: string, assignId: string): Promise<boolean> {
        let taskName: string = "CREATE_" + assignId;

        if (typeof this.taskList[taskName] !== 'undefined') {
            delete this.taskList[taskName];
        }

        let scheduledJob = schedule.scheduleJob(scheduledTime, () => {
            let ac: AssignmentController = new AssignmentController();
            let ghc: GitHubController = new GitHubController();

            ac.initializeAllRepositories(assignId).then((result) => {
                // remove from taskList
                Log.info("Finished initializing repositories for deliverable: " + assignId);
                delete this.taskList[taskName];
            });
        });

        let newTask: Task = {
            scheduledTask: scheduledJob,
        };

        taskList[taskName] = newTask;
    }

    // public async scheduleTask(scheduledTime: string, functionCall: () => Promise<void>) {
    //
    // }

    public async scheduleAssignmentPublish(scheduledTime: string, assignId: string): boolean {
        let taskName: string = "PUBLISH_" + assignId;

        if (typeof this.taskList[taskName] !== 'undefined') {
            delete this.taskList[taskName];
        }

        let scheduledJob = schedule.scheduleJob(scheduledTime, () => {
            let ac: AssignmentController = new AssignmentController();
            let ghc: GitHubController = new GitHubController();

            ac.publishAllRepositories(assignId).then((result) => {
                // remove from taskList
                Log.info("Finished publishing repositories for deliverable: " + assignId);
                delete this.taskList[taskName];
            });
        });

        let newTask: Task = {
            scheduledTask: scheduledJob,
        };

        taskList[taskName] = newTask;
    }

    public async scheduleAssignmentClosure(scheduleTime: string, assignId: string): boolean {

    }
}
