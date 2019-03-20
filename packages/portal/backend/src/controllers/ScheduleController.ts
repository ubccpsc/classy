import Log from "../../../../common/Log";
import {Deliverable} from "../Types";
import {AssignmentController} from "./AssignmentController";
import {DatabaseController} from "./DatabaseController";
import {DeliverablesController} from "./DeliverablesController";

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
    private taskList: Map<string, Task>;
    private static instance: ScheduleController = null;
    private dc: DeliverablesController = new DeliverablesController();
    private db: DatabaseController = DatabaseController.getInstance();
    private ac: AssignmentController = new AssignmentController();

    private CREATE_OFFSET_HOURS: number = 2;

    public static getInstance(): ScheduleController {
        if (typeof this.instance === "undefined" || this.instance === null) {
            this.instance = new ScheduleController();
        }
        return this.instance;
    }

    private constructor() {
        this.taskList = new Map<string, Task>();
    }

    public async scheduleAssignmentCreation(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = TaskPrefix.Create + assignId;
        Log.info("ScheduleController::scheduleAssignmentCreation( " +
            scheduledTime.toISOString() + " , " + assignId + " ) - start");

        // check if this task is already scheduled
        if (this.taskList.has(taskName)) {
            this.taskList.delete(taskName);
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, async () => {
            Log.info("ScheduleController::scheduleAssignmentCreation::scheduledJob() - starting task");
            // TODO: do something inside here
            await this.ac.createAllRepositories(assignId);
            Log.info("ScheduleController::scheduleAssignmentCreation::scheduledJob() - finished task");
        });

        this.taskList.set(taskName, {
            scheduledTask: scheduledJob
        });

        Log.info("ScheduleController::scheduleAssignmentCreation(..) - task scheduled");
        return true;
    }

    public async scheduleAssignmentRelease(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = TaskPrefix.Create + assignId;
        Log.info("ScheduleController::scheduleAssignmentRelease( " +
            scheduledTime.toISOString() + " , " + assignId + " ) - start");

        // check if this task is already scheduled
        if (this.taskList.has(taskName)) {
            this.taskList.delete(taskName);
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, async () => {
            Log.info("ScheduleController::scheduleAssignmentRelease::scheduledJob() - starting task");
            // TODO: do something inside here
            await this.ac.releaseAllRepositories(assignId);
            Log.info("ScheduleController::scheduleAssignmentRelease::scheduledJob() - finished task");
        });

        this.taskList.set(taskName, {
            scheduledTask: scheduledJob
        });

        Log.info("ScheduleController::scheduleAssignmentRelease(..) - task scheduled");
        return true;
    }

    public async scheduleAssignmentClose(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = TaskPrefix.Close + assignId;
        Log.info("ScheduleController::scheduleAssignmentClose( " +
            scheduledTime.toISOString() + " , " + assignId + " ) - start");

        // check if this task is already scheduled
        if (this.taskList.has(taskName)) {
            this.taskList.delete(taskName);
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, async () => {
            Log.info("ScheduleController::scheduleAssignmentClose::scheduledJob() - starting task");
            // TODO: do something inside here
            await this.ac.closeAllRepositories(assignId);
            Log.info("ScheduleController::scheduleAssignmentClose::scheduledJob() - finished task");
        });

        this.taskList.set(taskName, {
            scheduledTask: scheduledJob
        });

        Log.info("ScheduleController::scheduleAssignmentClose(..) - task scheduled");
        return true;
    }

    public async verifyScheduledAssignmentTasks(assignId: string) {
        Log.info(`ScheduleController::verifyScheduledAssignmentTasks(${assignId}) - start`);

        // retrieve deliverable information
        const deliverableRecord: Deliverable = await this.db.getDeliverable(assignId);

        if (deliverableRecord === null) {
            Log.error(`ScheduleController::verifyScheduledAssignmentTasks(..) - Error: No deliverable found with id: ${assignId}`);
            return;
        }

        if (deliverableRecord.custom.scheduled === true) {
            // default scheduling of deliverable information

            const createDate: Date = new Date(deliverableRecord.openTimestamp);
            const openDate: Date = new Date(deliverableRecord.openTimestamp);
            const closeDate: Date = new Date(deliverableRecord.closeTimestamp);
            createDate.setHours(createDate.getHours() - this.CREATE_OFFSET_HOURS);

            const scheduleCreateSuccess = await this.scheduleAssignmentCreation(createDate, assignId);
            const scheduleReleaseSuccess = await this.scheduleAssignmentRelease(openDate, assignId);
            const scheduleCloseSuccess = await this.scheduleAssignmentClose(closeDate, assignId);

            return;
        }

        Log.info(`ScheduleController::verifyScheduledAssignmentTasks(..) - Deliverable "${assignId}" ` +
            `is not configured to be scheduled`);

        return;
    }
}
