import {expect} from "chai";
import "mocha";
import {DummyDataStore} from "../src/autotest/DataStore";
import {DummyClassPortal} from "../src/autotest/ClassPortal";
import {AutoTestHandler} from "../src/autotest/AutoTestHandler";
import {IPushInfo} from "../src/Types";

describe("AutoTest", () => {
    it("should be able to be instantiated", () => {
        const data = new DummyDataStore();
        const portal = new DummyClassPortal();
        const courseId = "cs310";
        const at = new AutoTestHandler(courseId, data, portal);
        expect(at).not.to.equal(null);
    });

    it("receive a push event", () => {
        const data = new DummyDataStore();
        const portal = new DummyClassPortal();
        const courseId = "cs310";
        const at = new AutoTestHandler(courseId, data, portal);
        expect(at).not.to.equal(null);

        const pe: IPushInfo = {
            branch:     'master',
            repo:       'd0_team123',
            commit:     'as3422344kljsdfkl32l',
            commitUrl:  'https://github.ugrad.cs.ubc.ca/myOrg/d0_team123/commits/as3422344kljsdfkl32l',
            projectUrl: 'https://github.ugrad.cs.ubc.ca/myOrg/d0_team123/',
            timestamp:  1234567890
        };
        expect(data.pushes.length).to.equal(0);
        at.handlePushEvent(pe);
        expect(data.pushes.length).to.equal(1);
    });
});
