// this is terrible, but we don't have effective tests for this code yet
/* istanbul ignore file */

import Log from "../../../../common/Log";
import {Deliverable} from "../Types";
import {AssignmentController} from "./340/AssignmentController";
import {DatabaseController} from "./DatabaseController";

// tslint:disable-next-line
const schedule = require('node-schedule');

// This exists so we can potentially add more information to the task
export interface Task {
    scheduledTask: any;
}

// TAKE THE DELIVERABLE AND MAP IT TO THE ACTION
// ONLY ONE JOB PER ACTION PER DELIVERABLE

export class ScheduleController {

    private taskList: {[taskName: string]: Task};
    private static instance: ScheduleController = null;

    public static getInstance(): ScheduleController {
        if (ScheduleController.instance === null) {
            ScheduleController.instance = new ScheduleController();
        }
        return ScheduleController.instance;
    }

    private constructor() {
        this.taskList = {};
    }

    public async scheduleAssignmentCreation(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = "CREATE_" + assignId;

        if (typeof this.taskList[taskName] !== 'undefined') {
            delete this.taskList[taskName];
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, () => {
            const ac: AssignmentController = new AssignmentController();

            ac.initializeAllRepositories(assignId).then((result) => {
                // remove from taskList
                if (result) {
                    Log.info("ScheduleController::scheduleAssignmentCreation - " +
                        "Finished initializing repositories for deliverable: " + assignId);
                } else {
                    Log.warn("ScheduleController::scheduleAssignmentCreation - " +
                        "An error occurred when initializing repositories for deliverable: " + assignId);
                }
                delete this.taskList[taskName];
            }).catch(function(err) {
                Log.error("ScheduleController::scheduleAssignmentCreation - Error: " + err);
            });
        });

        const newTask: Task = {
            scheduledTask: scheduledJob
        };

        this.taskList[taskName] = newTask;
        return true;
    }

    // public async scheduleTask(scheduledTime: string, functionCall: () => Promise<void>) {
    //
    // }

    public async scheduleAssignmentPublish(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = "PUBLISH_" + assignId;

        if (typeof this.taskList[taskName] !== 'undefined') {
            delete this.taskList[taskName];
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, () => {
            const ac: AssignmentController = new AssignmentController();

            ac.publishAllRepositories(assignId).then((result) => {
                // remove from taskList
                if (result) {
                    Log.info("ScheduleController::scheduleAssignmentPublish - " +
                        "Finished publishing repositories for deliverable: " + assignId);
                } else {
                    Log.warn("ScheduleController::scheduleAssignmentPublish - " +
                        "An error occurred when publishing repositories for deliverable: " + assignId);
                }
                delete this.taskList[taskName];
            }).catch(function(err) {
                Log.error("ScheduleController::scheduleAssignmentPublish - Error: " + err);
            });
        });

        const newTask: Task = {
            scheduledTask: scheduledJob
        };

        this.taskList[taskName] = newTask;
        return true;
    }

    public async scheduleAssignmentClosure(scheduledTime: Date, assignId: string): Promise<boolean> {
        const taskName: string = "CLOSE_" + assignId;

        if (typeof this.taskList[taskName] !== 'undefined') {
            delete this.taskList[taskName];
        }

        const scheduledJob = schedule.scheduleJob(scheduledTime, () => {
            const ac: AssignmentController = new AssignmentController();

            ac.closeAllRepositories(assignId).then((result) => {
                // remove from taskList
                if (result) {
                    Log.info("ScheduleController::scheduleAssignmentClosure - " +
                        "Finished closing repositories for deliverable: " + assignId);
                } else {
                    Log.warn("ScheduleController::scheduleAssignmentClosure - " +
                        "An error occurred when closing repositories for deliverable: " + assignId);
                }
                delete this.taskList[taskName];
            }).catch(function(err) {
                Log.error("ScheduleController::scheduleAssignmentClosure - Error: " + err);
            });
        });

        const newTask: Task = {
            scheduledTask: scheduledJob
        };

        this.taskList[taskName] = newTask;
        return true;
    }

    /**
     * Verifies that the given assignment has the scheduled tasks set up
     * @param {string} assignId
     * @returns {Promise<boolean>}
     */

    public async createAssignmentTasks(assignId: string): Promise<boolean> {
        Log.info("ScheduleController::createAssignmentTasks( " + assignId + " ) - start");

        const CREATE_OFFSET_HOURS = 2;

        const db: DatabaseController = DatabaseController.getInstance();

        const deliv: Deliverable = await db.getDeliverable(assignId);
        if (deliv === null) {
            Log.error("ScheduleController::createAssignmentTasks(..) - Error: no deliverable found with id: " + assignId);
            return false;
        }

        if (deliv.custom === null || typeof deliv.custom === 'undefined' ||
            typeof deliv.custom.assignment === 'undefined' || typeof deliv.custom.assignment.seedRepoURL === 'undefined') {
            Log.error("ScheduleController::createAssignmentTasks(..) - Error: deliv: " + assignId + " is not an assignment");
            return false;
        }

        const sc: ScheduleController = ScheduleController.getInstance();

        const openDate: Date = new Date(deliv.openTimestamp);
        const closeDate: Date = new Date(deliv.closeTimestamp);
        const createDate: Date = new Date(deliv.openTimestamp);
        createDate.setHours(createDate.getHours() - CREATE_OFFSET_HOURS);

        let created = false;
        const currentDate: Date = new Date();
        if (createDate > currentDate) {
            if (this.getTask("CREATE_" + assignId) === null) {
                created = true;
            }
            Log.info("ScheduleController::createAssignmentTasks(..) - Making create repo task");
            await sc.scheduleAssignmentCreation(createDate, assignId);
            Log.info("ScheduleController::createAssignmentTasks(..) - Task will execute at: " + createDate.toISOString());
        }

        if (openDate > currentDate) {
            if (this.getTask("OPEN_" + assignId) === null) {
                created = true;
            }
            Log.info("ScheduleController::createAssignmentTasks(..) - Making publish repo task");
            await sc.scheduleAssignmentPublish(openDate, assignId);
            Log.info("ScheduleController::createAssignmentTasks(..) - Task will execute at: " + openDate.toISOString());
        }

        if (closeDate > currentDate) {
            if (this.getTask("CLOSE_" + assignId) === null) {
                created = true;
            }
            Log.info("ScheduleController::createAssignmentTasks(..) - Making close repo task");
            await sc.scheduleAssignmentClosure(closeDate, assignId);
            Log.info("ScheduleController::createAssignmentTasks(..) - Task will execute at: " + closeDate.toISOString());
        }

        Log.info("ScheduleController::createAssignmentTasks(..) - Current date is: " + currentDate.toISOString());

        return created;
    }

    public getTask(taskName: string): Task | null {
        Log.info("ScheduleController::getTask( " + taskName + " ) - start");
        if (typeof this.taskList[taskName] === 'undefined') {
            Log.error("ScheduleController::getTask(..) - error: " + taskName + " was not found");
            return null;
        }

        return this.taskList[taskName];
    }

    public deleteTask(taskName: string): boolean {
        Log.info("ScheduleController::deleteTask( " + taskName + " ) - start");
        if (typeof this.taskList[taskName] === 'undefined') {
            Log.error("ScheduleController::deleteTask(..) - error: " + taskName + " was not found");
            return false;
        }
        const task: Task = this.taskList[taskName];

        const job = task.scheduledTask;

        job.cancel();

        delete this.taskList[taskName];

        return true;
    }
}
