import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {DeliverablesController} from "../src/controllers/DeliverablesController";
import {Deliverable} from "../src/Types";

const loadFirst = require('./GlobalSpec');

describe("DeliverablesController", () => {

    let ORGNAME: string;
    let dc: DeliverablesController;

    const TEAMNAME1 = 'team1';
    const REPONAME1 = 'repo1';
    const REPONAME2 = 'repo2';

    const D1NAME = 'd1';

    let DELIV1: Deliverable = null;

    before(async () => {
        ORGNAME = Config.getInstance().getProp('org');
        DELIV1 = {
            id:               D1NAME,
            org:              ORGNAME,
            openTimestamp:    -1,
            closeTimestamp:   -1,
            gradesReleased:   false,
            delay:            -1,
            teamMinSize:      1,
            teamMaxSize:      1,
            teamSameLab:      false,
            teamStudentsForm: false
        };
    });

    beforeEach(() => {
        dc = new DeliverablesController();
    });

    it("Should be able to get all deliverables, even if there are none.", async () => {
        let delivs = await dc.getAllDeliverables(ORGNAME);
        expect(delivs).to.have.lengthOf(0);
    });

    it("Should be able to save a deliverable.", async () => {
        let delivs = await dc.getAllDeliverables(ORGNAME);
        expect(delivs).to.have.lengthOf(0);

        let valid = await dc.saveDeliverable(ORGNAME, DELIV1);
        expect(valid).to.not.be.null;
        delivs = await dc.getAllDeliverables(ORGNAME);
        expect(delivs).to.have.lengthOf(1);
        expect(delivs[0].id).to.equal(DELIV1.id);
    });

    it("Should update an existing deliverable.", async () => {
        let delivs = await dc.getAllDeliverables(ORGNAME);
        expect(delivs).to.have.lengthOf(1);

        var deliv2: Deliverable = Object.assign({}, DELIV1);
        deliv2.gradesReleased = true;
        deliv2.teamMinSize = 4;

        let valid = await dc.saveDeliverable(ORGNAME, deliv2);
        expect(valid).to.not.be.null;
        delivs = await dc.getAllDeliverables(ORGNAME);
        expect(delivs).to.have.lengthOf(1);
        expect(delivs[0].gradesReleased).to.be.true;
        expect(delivs[0].teamMinSize).to.equal(4);
    });


});
