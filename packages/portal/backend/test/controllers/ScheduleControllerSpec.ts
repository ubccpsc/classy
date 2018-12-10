import {expect} from "chai";
import "mocha";
import Log from "../../../../common/Log";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {ScheduleController, Task} from "../../src/controllers/ScheduleController";

import '../GlobalSpec';
import {Test} from "../TestHarness";
import {CS340Test} from "./cs340/CS340Test";

describe("ScheduleController", () => {
    // const TIMEOUT = 10000;

    const sc: ScheduleController = ScheduleController.getInstance();

    before(async () => {
        // do something  before
        // TODO: prep the database
        Log.test("ScheduleController::before - start");

        await Test.suiteBefore('ScheduleController');

        const db: DatabaseController = DatabaseController.getInstance();
        await db.clearData();

        await Test.prepareAll();
        await CS340Test.prepareAssignment();
        await CS340Test.prepareAssignment2();
        await CS340Test.prepareAssignmentTeam2();
    });

    after(async () => {
        // do something here
        Log.test("ScheduleController::after - start");

        await Test.suiteAfter('ScheduleController');
    });

    beforeEach(async () => {
        // do something here
    });

    afterEach(async () => {
        // do something here
    });

    it("Should be able to schedule tasks for an assignment.", async () => {
        const success: boolean = await sc.createAssignmentTasks(Test.ASSIGNID0);

        expect(success).to.be.true;
    });

    it("Should not be able to schedule tasks for an assignment that doesn't exist.", async () => {
        const success: boolean = await sc.createAssignmentTasks("invalidDeliverable");

        expect(success).to.be.false;
    });

    it("Should not be able to schedule tasks for a non-assignment.", async () => {
        const success: boolean = await sc.createAssignmentTasks(Test.DELIVID0);

        expect(success).to.be.false;
    });

    it("Should be able to check if a task is scheduled.", async () => {
        const task: Task = sc.getTask("PUBLISH_" + Test.ASSIGNID0);
        expect(task).to.not.be.null;
    });

    it("Should not be able to find a task that is not scheduled.", async () => {
        const task: Task = sc.getTask("INVALID_TASK");
        expect(task).to.be.null;
    });

    it("Should not be able to delete a task that doesn't exist", async () => {
        const success = sc.deleteTask("INVALID_TASK");
        expect(success).to.be.false;
    });

    it("Should be able to delete a task that has been scheduled", async () => {
        const success = sc.deleteTask("PUBLISH_" + Test.ASSIGNID0);
        expect(success).to.be.true;
    });
});
