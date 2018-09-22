import {expect} from "chai";
import "mocha";
import Config, {ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";
import {AssignmentInfo} from "../../../../../common/types/CS340Types";
import {AssignmentController} from "../../../src/controllers/340/AssignmentController";
import {RubricController} from "../../../src/controllers/340/RubricController";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import {GitHubActions, IGitHubActions} from "../../../src/controllers/GitHubActions";
import {GitHubController} from "../../../src/controllers/GitHubController";
import {GradesController} from "../../../src/controllers/GradesController";
import {PersonController} from "../../../src/controllers/PersonController";
import {RepositoryController} from "../../../src/controllers/RepositoryController";
import {TeamController} from "../../../src/controllers/TeamController";
import {Deliverable} from "../../../src/Types";
import {Test} from "../../GlobalSpec";
import {CS340Test} from "./CS340Test";

const ORIGINAL_ORG = Config.getInstance().getProp(ConfigKey.org);

describe("CS340: RubricController", () => {
    const ac: AssignmentController = new AssignmentController();
    const gc: GradesController = new GradesController();
    const tc: TeamController = new TeamController();
    const rc: RepositoryController = new RepositoryController();
    const dc: DeliverablesController = new DeliverablesController();
    const pc: PersonController = new PersonController();
    const gh: GitHubController = new GitHubController(GitHubActions.getInstance());
    let gha: IGitHubActions;
    let db: DatabaseController = DatabaseController.getInstance();
    const rbc: RubricController = new RubricController();

    before(async () => {
        // change org to testing org for safety
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        await Test.suiteBefore('CS340: RubricController');

        // clear stale data
        db = DatabaseController.getInstance();
        await db.clearData();

        // get data ready
        await Test.prepareAll();

        gha = GitHubActions.getInstance();

        // create assignment Deliverables
        await CS340Test.prepareAssignment();
        await CS340Test.prepareAssignment2();

        // Log.info("Successfully created new Assignment Deliverable for testing");
    });

    after(async () => {
        Log.test("RubricController::after() - start; restoring original org");
        Config.getInstance().setProp(ConfigKey.org, ORIGINAL_ORG);
        await Test.suiteAfter('CS340: RubricController');

    });

    beforeEach(async () => {
        // empty
    });

    afterEach(async () => {
        // empty
    });

    it("Should not update the rubric when not specifying the main file.", async () => {
        const success = await rbc.updateRubric(Test.ASSIGNID0);
        expect(success).to.be.true;
    });

    it("Should be able to generate a rubric for an assignment when specifying the main file.", async () => {
        const success = await rbc.updateRubric(Test.ASSIGNID1);

        expect(success).to.be.true;

        const deliverableRecord: Deliverable = await db.getDeliverable(Test.ASSIGNID1);

        expect(deliverableRecord).to.not.be.null;

        const assignmentInfo: AssignmentInfo = deliverableRecord.custom.assignment;

        expect(assignmentInfo).to.not.be.null;
        expect(typeof assignmentInfo.rubric).to.not.be.equal("undefined");
        expect(assignmentInfo.rubric.questions.length).to.be.greaterThan(0);
    }).timeout(Test.TIMEOUT);

    it("Should not update if specified a non-assignment.", async () => {
        const success = await rbc.updateRubric(Test.DELIVID0);
        expect(success).to.be.false;
    });

    it("Should not update if specified a non-deliverable.", async () => {
        const success = await rbc.updateRubric("INVALID_DELIVERABLE");
        expect(success).to.be.false;
    });

});
