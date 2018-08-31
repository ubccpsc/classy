import {expect} from "chai";
import "mocha";

import {GitHubController} from "../../src/controllers/GitHubController";
import {TeamController} from "../../src/controllers/TeamController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import Log from "../../../../common/Log";
import Config, {ConfigKey} from "../../../../common/Config";
import {Test} from "../GlobalSpec";
import {Repository, Team} from "../../src/Types";
import {ScheduleController, Task} from "../../src/controllers/ScheduleController";
import {DatabaseController} from "../../src/controllers/DatabaseController";

const loadFirst = require('../GlobalSpec');

describe("ScheduleController", () => {
    let TIMEOUT = 10000;

    let sc: ScheduleController = ScheduleController.getInstance();

    before(async () => {
        // do something before
        // TODO: prep the database
        Log.test("ScheduleController::before - start");

        await Test.suiteBefore('ScheduleController');

        const db: DatabaseController = DatabaseController.getInstance();
        await db.clearData();

        await Test.prepareAll();
        await Test.prepareAssignment();
        await Test.prepareAssignment2();
        await Test.prepareAssignmentTeam2();
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
        let success: boolean = await sc.createAssignmentTasks(Test.ASSIGNID0);

        expect(success).to.be.true;
    });

    it("Should not be able to schedule tasks for an assignment that doesn't exist.", async () => {
        let success: boolean = await sc.createAssignmentTasks("invalidDeliverable");

        expect(success).to.be.false;
    });

    it("Should not be able to schedule tasks for a non-assignment.", async () => {
        let success: boolean = await sc.createAssignmentTasks(Test.DELIVID0);

        expect(success).to.be.false;
    });

    it("Should be able to check if a task is scheduled.", async () => {
        let task: Task = sc.getTask("PUBLISH_" + Test.ASSIGNID0);
        expect(task).to.not.be.null;
    });

    it("Should not be able to find a task that is not scheduled.", async () => {
        let task: Task = sc.getTask("INVALID_TASK");
        expect(task).to.be.null;
    });

    it("Should not be able to delete a task that doesn't exist", async () => {
        let success = sc.deleteTask("INVALID_TASK");
        expect(success).to.be.false;
    });

    it("Should be able to delete a task that has been scheduled", async () => {
        let success = sc.deleteTask("PUBLISH_" + Test.ASSIGNID0);
        expect(success).to.be.true;
    });
});

