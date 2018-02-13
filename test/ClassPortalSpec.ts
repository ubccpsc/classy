import {expect} from "chai";
import "mocha";
import {Config} from "../src/Config";
import {ClassPortal, DummyClassPortal, IClassPortal} from "../src/autotest/ClassPortal";

describe("ClassPortal Service", () => {
    Config.getInstance("test");

    let cp: IClassPortal;
    const classId = "310";
    const CURRENT_DEFAULT_DELIV = "d2";

    beforeEach(function () {
        // cp = new DummyClassPortal(); // TODO: change to ClassPortalService not DummyClassPortal
        cp = new ClassPortal(); // TODO: change to ClassPortalService not DummyClassPortal
    });

    it("Should be able for a staff user to be staff.", async () => {
        try {
            const actual = await cp.isStaff(classId, "cs310");
            expect(actual).to.equal(true);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should be able for a non-staff user to not be staff.", async () => {
        try {
            const actual = await cp.isStaff(classId, "student");
            expect(actual).to.equal(false);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should be able for invalid user to not be staff.", async () => {
        try {
            const actual = await cp.isStaff(classId, "foo");
            expect(actual).to.equal(false);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return false for non-staff.", async () => {
        try {
            let actual = await cp.isStaff(classId, null);
            expect(actual).to.equal(false);
            actual = await cp.isStaff(classId, undefined);
            expect(actual).to.equal(false);
            actual = await cp.isStaff(classId, "");
            expect(actual).to.equal(false);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return false for courses that don't exist.", async () => {
        try {
            let actual = await cp.isStaff("cs999", "staff");
            expect(actual).to.equal(false);
            actual = await cp.isStaff(null, "staff");
            expect(actual).to.equal(false);
            actual = await cp.isStaff(undefined, "staff");
            expect(actual).to.equal(false);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return the test delay in seconds for a course.", async () => {
        try {
            const actual = await cp.getTestDelay(classId, "d0");
            expect(actual).to.equal(43200);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a null test delay if the course does not exist.", async () => {
        try {
            const actual = await cp.getTestDelay("cs999", "d0");
            expect(actual).to.equal(null);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a container id for an existing course.", async () => {
        try {
            const actual = await cp.getTestDelay("cs310", "d0");
            expect(actual).to.equal("foo"); // TODO: this is known to fail since the service isn't up yet
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a null container id if the course does not exist.", async () => {
        try {
            const actual = await cp.getTestDelay("cs999", "d0");
            expect(actual).to.equal(null);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a default deliverable if the course has one.", async () => {
        try {
            const actual = await cp.getDefaultDeliverableId(classId);
            expect(actual).to.equal(CURRENT_DEFAULT_DELIV);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a null default deliverable if the course does not exist.", async () => {
        try {
            const actual = await cp.getDefaultDeliverableId("cs999");
            expect(actual).to.equal(null);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });
});
