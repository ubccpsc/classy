import {expect} from "chai";
import "mocha";

import {GitHubController} from "../../src/controllers/GitHubController";
import {TeamController} from "../../src/controllers/TeamController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import Log from "../../../../common/Log";
import Config, {ConfigKey} from "../../../../common/Config";
import {Test} from "../GlobalSpec";
import {Repository, Team} from "../../src/Types";
import {ScheduleController} from "../../src/controllers/ScheduleController";

const loadFirst = require('../GlobalSpec');

describe("ScheduleController", () => {
    let TIMEOUT = 10000;

    let sc: ScheduleController = ScheduleController.getInstance();

    before(() => {
        // do something before
        // TODO: prep the database
        Log.test("ScheduleController::before - start");
    });

    after(() => {
        // do something here
    });

    beforeEach(() => {
        // do something here
    });

    afterEach(() => {
        // do something here
    });

    it("TODO: Add more tests", () => {
        expect(0).to.equal(0);
    });

});

