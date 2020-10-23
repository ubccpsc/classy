import {expect} from "chai";
import "mocha";
import {DeliverableTransport} from "../../../../common/types/PortalTypes";
import {DatabaseController} from "../../src/controllers/DatabaseController";

import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {Deliverable} from "../../src/Types";

import {Test} from "../../../../common/TestHarness";

import "../GlobalSpec";
import "./DatabaseControllerSpec"; // run first

describe("DeliverablesController", () => {

    let dc: DeliverablesController;

    let DELIV1: Deliverable = null; // delivs are complex so just use one for the whole suite

    before(async () => {
        await Test.suiteBefore("DeliverablesController");
        DELIV1 = Test.createDeliverable(Test.DELIVID1);
    });

    beforeEach(() => {
        dc = new DeliverablesController();
    });

    after(() => {
        Test.suiteAfter("DeliverablesController");
    });

    it("Should be able to get all deliverables, even if there are none.", async () => {
        const delivs = await dc.getAllDeliverables();
        expect(delivs).to.have.lengthOf(0);
    });

    it("Should be able to save a deliverable.", async () => {
        let delivs = await dc.getAllDeliverables();
        expect(delivs).to.have.lengthOf(0);

        const valid = await dc.saveDeliverable(DELIV1);
        expect(valid).to.not.be.null;
        delivs = await dc.getAllDeliverables();
        expect(delivs).to.have.lengthOf(1);
        expect(delivs[0].id).to.equal(DELIV1.id);
    });

    it("Should update an existing deliverable.", async () => {
        let delivs = await dc.getAllDeliverables();
        expect(delivs).to.have.lengthOf(1);

        const deliv2: Deliverable = Object.assign({}, DELIV1);
        deliv2.gradesReleased = true;
        deliv2.teamMinSize = 4;

        const valid = await dc.saveDeliverable(deliv2);
        expect(valid).to.not.be.null;
        delivs = await dc.getAllDeliverables();
        expect(delivs).to.have.lengthOf(1);
        expect(delivs[0].gradesReleased).to.be.true;
        expect(delivs[0].teamMinSize).to.equal(4);
    });

    it("Should be able to get a specific deliverable.", async () => {
        const deliv = await dc.getDeliverable(Test.DELIVID1);
        expect(deliv).to.not.be.null;
        expect(deliv.id).to.equal(Test.DELIVID1);
    });

    it("Should be able to invalidate bad deliverables.", async () => {
        let deliv = await dc.validateDeliverableTransport(undefined);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        deliv = await dc.validateDeliverableTransport(null);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        deliv = await dc.validateDeliverableTransport({id: 'a'} as DeliverableTransport);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');
    });

    // this test should be last
    it("Should enforce minimum constraint on student delay in deliverables when saving.", async () => {
        const db = DatabaseController.getInstance();

        const allPeople = await db.getPeople();
        for (const p of allPeople) {
            await db.deletePerson(p);
        }

        let deliv = await dc.getDeliverable(Test.DELIVID1);
        expect(deliv).to.not.be.null;

        deliv.autotest.studentDelay = 60; // 1 minute
        const valid = await dc.saveDeliverable(deliv);
        expect(valid).to.not.be.null;

        deliv = await dc.getDeliverable(Test.DELIVID1);
        expect(deliv).to.not.be.null;
        expect(deliv.autotest.studentDelay).to.be.greaterThan(120);
    });

    it("Should enforce custom entered minimum delay between grade requests", async () => {
        const db = DatabaseController.getInstance();
        let deliv = await dc.getDeliverable(Test.DELIVID1);
        expect(deliv).to.not.be.null;
        deliv.autotest.studentDelay = 901; // 15 minutes, 1 second

        const valid = await dc.saveDeliverable(deliv);
        expect(valid).to.not.be.null;

        deliv = await dc.getDeliverable(Test.DELIVID1);
        expect(deliv).to.not.be.null;
        expect(deliv.autotest.studentDelay).to.be.equal(901);
    });
});
