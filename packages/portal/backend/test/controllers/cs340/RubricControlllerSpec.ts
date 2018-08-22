import {expect} from "chai";
import "mocha";
import Config, {ConfigKey} from "../../../../../common/Config";
import {AssignmentController} from "../../../src/controllers/340/AssignmentController";
import {GitHubController} from "../../../src/controllers/GitHubController";
import {DatabaseController} from "../../../src/controllers/DatabaseController";
import {PersonController} from "../../../src/controllers/PersonController";
import {TeamController} from "../../../src/controllers/TeamController";
import {GradesController} from "../../../src/controllers/GradesController";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import {RepositoryController} from "../../../src/controllers/RepositoryController";
import {GitHubActions} from "../../../src/controllers/GitHubActions";
import {RubricController} from "../../../src/controllers/340/RubricController";
import {Test} from "../../GlobalSpec";
import Log from "../../../../../common/Log";
import {AssignmentInfo, AssignmentRepositoryInfo} from "../../../../../common/types/CS340Types";
import {Deliverable} from "../../../src/Types";
const TIMEOUT = 7500;

let DELAY_SEC = 1000;
let DELAY_SHORT = 200;

const ORIGINAL_ORG = Config.getInstance().getProp(ConfigKey.org);


describe("CS340: RubricController", () => {
    let ac: AssignmentController = new AssignmentController();
    let gc: GradesController = new GradesController();
    let tc: TeamController = new TeamController();
    let rc: RepositoryController = new RepositoryController();
    let dc: DeliverablesController = new DeliverablesController();
    let pc: PersonController = new PersonController();
    let gh: GitHubController = new GitHubController();
    let gha: GitHubActions;
    let db: DatabaseController = DatabaseController.getInstance();
    let rbc: RubricController = new RubricController();

    before(async () => {
        // change org to testing org for safety
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));

        await Test.suiteBefore('CS340: RubricController');

        // clear stale data
        db = DatabaseController.getInstance();
        await db.clearData();

        // get data ready
        await Test.prepareAll();

        gha = new GitHubActions();

        // create assignment Deliverables
        await Test.prepareAssignment();
        await Test.prepareAssignment2();

        // Log.info("Successfully created new Assignment Deliverable for testing");
    });

    after(async () => {
        Log.test("RubricController::after() - start; restoring original org");
        Config.getInstance().setProp(ConfigKey.org, ORIGINAL_ORG);
        await Test.suiteAfter('CS340: RubricController');

    });

    beforeEach(async () => {

    });

    afterEach(async () => {

    });

    it("Should not update the rubric when not specifying the main file.", async () => {
        let success = await rbc.updateRubric(Test.ASSIGNID0);
        expect(success).to.be.true;
    });

    it("Should be able to generate a rubric for an assignment when specifying the main file.", async () => {
        let success = await rbc.updateRubric(Test.ASSIGNID1);

        expect(success).to.be.true;

        let deliverableRecord: Deliverable = await db.getDeliverable(Test.ASSIGNID1);

        expect(deliverableRecord).to.not.be.null;

        let assignmentInfo: AssignmentInfo = deliverableRecord.custom;

        expect(assignmentInfo).to.not.be.null;
        expect(typeof assignmentInfo.rubric).to.not.be.equal("undefined");
        expect(assignmentInfo.rubric.questions.length).to.be.greaterThan(0);
    });

});
