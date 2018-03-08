import {MockClassPortal} from "../src/autotest/mocks/MockClassPortal";

const loadFirst = require('./GlobalSpec');

import {expect} from "chai";
import "mocha";
import {Config} from "../src/Config";
import {ClassPortal, IClassPortal} from "../src/autotest/ClassPortal";

describe("ClassPortal Service", () => {
    Config.getInstance("test");

    let cp: IClassPortal;
    const classId = "secapstone";
    const CURRENT_DEFAULT_DELIV = "d2";

    beforeEach(function () {
        // cp = new MockClassPortal(); // TODO: change to ClassPortalService not MockClassPortal
        cp = new ClassPortal(); // TODO: change to ClassPortalService not MockClassPortal
    });

    it("Should be able for a staff user to be staff.", async () => {
        try {
            const actual = await cp.isStaff(classId, "rtholmes");
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
            const res = await cp.getContainerDetails(classId, "d0");
            expect(res).to.not.be.null;
            const actual = res.studentDelay;
            expect(actual).to.equal(43200);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a null test delay if the course does not exist.", async () => {
        try {
            const res = await cp.getContainerDetails("cs999", "d0");
            expect(res).to.equal(null);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a container id for an existing course.", async () => {
        try {
            const res = await cp.getContainerDetails(classId, "d0");
            const actual = res.dockerImage;
            expect(actual).to.equal("secapstone-grader");
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a null container id if the course does not exist.", async () => {
        try {
            const res = await cp.getContainerDetails("cs999", "d0");
            expect(res).to.equal(null);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

    it("Should return a default deliverable if the course has one.", async () => {
        try {
            const actual = await cp.getDefaultDeliverableId(classId);
            expect(actual).to.equal("d0");
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
