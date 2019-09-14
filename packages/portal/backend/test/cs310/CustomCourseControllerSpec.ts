import {expect} from "chai";
import "mocha";
import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {Test} from "../../../../common/TestHarness";

import {CourseController, ICourseController} from "../../src/controllers/CourseController";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {GitHubActions} from "../../src/controllers/GitHubActions";
import {GitHubController} from "../../src/controllers/GitHubController";
import {PersonController} from "../../src/controllers/PersonController";
import {Factory} from "../../src/Factory";
import '../controllers/PersonControllerSpec';

import '../GlobalSpec';

describe("CustomCourseController", () => {

    const TIMEOUT = 10000;

    let cc: ICourseController;

    before(async () => {
        await Test.suiteBefore('CustomCourseController');
        await Test.preparePeople();
        await Test.prepareDeliverables();
        Config.getInstance().setProp(ConfigKey.name, 'cs310'); // force us to use the custom course controller
    });

    beforeEach(async () => {
        const ghc = new GitHubController(GitHubActions.getInstance());
        cc = await Factory.getCourseController(ghc);
        // cc = new CourseController(ghc);
    });

    after(async () => {
        Config.getInstance().setProp(ConfigKey.name, 'classytest'); // revert the course controller
        Test.suiteAfter('CourseController');
    });

    // NOTE: only testing naming as this is the only part of 310 that is unique

    it("Should be able to compute names.", async () => {
        const p1 = await new PersonController().getPerson(Test.USER1.id);
        const p2 = await new PersonController().getPerson(Test.USER2.id);
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID1);

        const names = await cc.computeNames(deliv, [p1, p2]);
        Log.test("Computed names: " + JSON.stringify(names));

        expect(names.teamName).to.equal('t_d1_team000'); // clearData will always reset the counter
        expect(names.repoName).to.equal('d1_team000');
    });

    it("Requesting a name that already exists should return the same name.", async () => {
        const p1 = await new PersonController().getPerson(Test.USER1.id);
        const p2 = await new PersonController().getPerson(Test.USER2.id);
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID1);

        const names = await cc.computeNames(deliv, [p1, p2]);
        Log.test("Computed names: " + JSON.stringify(names));

        // request names for a group that has been previously provisioned; name should be the same
        expect(names.teamName).to.equal('t_d1_team000');
        expect(names.repoName).to.equal('d1_team000');
    });

    it("Names should increment as others exist.", async () => {
        const p1 = await new PersonController().getPerson(Test.USER3.id);
        const p2 = await new PersonController().getPerson(Test.USER4.id);
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID1);

        const names = await cc.computeNames(deliv, [p1, p2]);
        Log.test("Computed names: " + JSON.stringify(names));

        expect(names.teamName).to.equal('t_d1_team001');
        expect(names.repoName).to.equal('d1_team001');
    });

    it("Counter should reset for a different deliverable.", async () => {
        const p1 = await new PersonController().getPerson(Test.USER3.id);
        const p2 = await new PersonController().getPerson(Test.USER4.id);
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID0);

        // also check with no prefixes
        deliv.teamPrefix = '';
        deliv.repoPrefix = '';

        const names = await cc.computeNames(deliv, [p1, p2]);
        Log.test("Computed names: " + JSON.stringify(names));

        expect(names.teamName).to.equal('d0_team000');
        expect(names.repoName).to.equal('d0_team000');
    });

    it("Requesting a name that already exists should return the same name regardless of the person order.", async () => {
        const p1 = await new PersonController().getPerson(Test.USER3.id);
        const p2 = await new PersonController().getPerson(Test.USER4.id);
        const deliv = await new DeliverablesController().getDeliverable(Test.DELIVID0);

        // also check with no prefixes
        deliv.teamPrefix = '';
        deliv.repoPrefix = '';

        const names = await cc.computeNames(deliv, [p2, p1]);
        Log.test("Computed names: " + JSON.stringify(names));

        expect(names.teamName).to.equal('d0_team000');
        expect(names.repoName).to.equal('d0_team000');
    });
});
