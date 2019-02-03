import Log from "../../../../common/Log";
import {Deliverable} from "../Types";
// import {AssignmentController} from "./340/AssignmentController";
import {DatabaseController} from "./DatabaseController";
import {GitHubActions} from "./GitHubActions";
import {GitHubController} from "./GitHubController";

// tslint:disable-next-line
const schedule = require('node-schedule');

// This exists so we can potentially add more information to the task
export interface Task {
    scheduledTask: any;
    // time: string
}

export enum TaskPrefix {
    Create = "CREATE_",
    Release = "RELEASE_",
    Close = "CLOSE_",

}

export class ScheduleController {
    private taskList: { [taskName: string]: Task };
    private static instance: ScheduleController = null;

    public static getInstance(): ScheduleController {
        if (this.instance === null) {
            this.instance = new ScheduleController();
        } else {
            return this.instance;
        }
    }

    private constructor() {
        this.taskList = {};
    }

    public async scheduleAssignmentCreation(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = TaskPrefix.Create + assignId;
        Log.info("ScheduleController::scheduleAssignmentCreation( " +
            scheduledTime.toISOString() + " , " + assignId + " ) - start");

        // check if this task is already scheduled
        if (typeof this.taskList[taskName] !== 'undefined') {
            delete this.taskList[taskName];
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, () => {
            Log.info("ScheduleController::scheduleAssignmentCreation::scheduledJob() - starting task");
            // do something inside here
            Log.info("ScheduleController::scheduleAssignmentCreation::scheduledJob() - finished task");
        });

        this.taskList[taskName] = {
            scheduledTask: scheduledJob
        };

        Log.info("ScheduleController::scheduleAssignmentCreation(..) - task scheduled");
        return true;
    }

    public async scheduleAssignmentRelease(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = TaskPrefix.Create + assignId;
        Log.info("ScheduleController::scheduleAssignmentRelease( " +
            scheduledTime.toISOString() + " , " + assignId + " ) - start");

        // check if this task is already scheduled
        if (typeof this.taskList[taskName] !== 'undefined') {
            delete this.taskList[taskName];
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, () => {
            Log.info("ScheduleController::scheduleAssignmentRelease::scheduledJob() - starting task");
            // do something inside here
            Log.info("ScheduleController::scheduleAssignmentRelease::scheduledJob() - finished task");
        });

        this.taskList[taskName] = {
            scheduledTask: scheduledJob
        };

        Log.info("ScheduleController::scheduleAssignmentRelease(..) - task scheduled");
        return true;
    }

    public async scheduleAssignmentClose(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = TaskPrefix.Close + assignId;
        Log.info("ScheduleController::scheduleAssignmentClose( " +
            scheduledTime.toISOString() + " , " + assignId + " ) - start");

        // check if this task is already scheduled
        if (typeof this.taskList[taskName] !== 'undefined') {
            delete this.taskList[taskName];
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, () => {
            Log.info("ScheduleController::scheduleAssignmentClose::scheduledJob() - starting task");
            // do something inside here
            Log.info("ScheduleController::scheduleAssignmentClose::scheduledJob() - finished task");
        });

        this.taskList[taskName] = {
            scheduledTask: scheduledJob
        };

        Log.info("ScheduleController::scheduleAssignmentClose(..) - task scheduled");
        return true;
    }
}
