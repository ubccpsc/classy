"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
require("mocha");
const GlobalSpec_1 = require("../GlobalSpec");
const DeliverablesController_1 = require("../../src/controllers/DeliverablesController");
const loadFirst = require('../GlobalSpec');
describe("DeliverablesController", () => {
    let dc;
    let DELIV1 = null;
    before(() => __awaiter(this, void 0, void 0, function* () {
        DELIV1 = {
            id: GlobalSpec_1.Test.DELIVID1,
            URL: 'https://NOTSET',
            openTimestamp: -1,
            closeTimestamp: -1,
            gradesReleased: false,
            teamMinSize: 1,
            teamMaxSize: 1,
            teamSameLab: false,
            teamStudentsForm: false,
            teamPrefix: 'team_',
            repoPrefix: 'd1_',
            autotest: {
                dockerImage: 'testImage',
                studentDelay: 60 * 60 * 12,
                maxExecTime: 300,
                regressionDelivIds: [],
                custom: {}
            },
            custom: {}
        };
    }));
    beforeEach(() => {
        dc = new DeliverablesController_1.DeliverablesController();
    });
    it("Should be able to get all deliverables, even if there are none.", () => __awaiter(this, void 0, void 0, function* () {
        let delivs = yield dc.getAllDeliverables();
        chai_1.expect(delivs).to.have.lengthOf(0);
    }));
    it("Should be able to save a deliverable.", () => __awaiter(this, void 0, void 0, function* () {
        let delivs = yield dc.getAllDeliverables();
        chai_1.expect(delivs).to.have.lengthOf(0);
        let valid = yield dc.saveDeliverable(DELIV1);
        chai_1.expect(valid).to.not.be.null;
        delivs = yield dc.getAllDeliverables();
        chai_1.expect(delivs).to.have.lengthOf(1);
        chai_1.expect(delivs[0].id).to.equal(DELIV1.id);
    }));
    it("Should update an existing deliverable.", () => __awaiter(this, void 0, void 0, function* () {
        let delivs = yield dc.getAllDeliverables();
        chai_1.expect(delivs).to.have.lengthOf(1);
        var deliv2 = Object.assign({}, DELIV1);
        deliv2.gradesReleased = true;
        deliv2.teamMinSize = 4;
        let valid = yield dc.saveDeliverable(deliv2);
        chai_1.expect(valid).to.not.be.null;
        delivs = yield dc.getAllDeliverables();
        chai_1.expect(delivs).to.have.lengthOf(1);
        chai_1.expect(delivs[0].gradesReleased).to.be.true;
        chai_1.expect(delivs[0].teamMinSize).to.equal(4);
    }));
    it("Should be able to get a specific deliverable.", () => __awaiter(this, void 0, void 0, function* () {
        let deliv = yield dc.getDeliverable(GlobalSpec_1.Test.DELIVID1);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv.id).to.equal(GlobalSpec_1.Test.DELIVID1);
    }));
    it("Should be able to invalidate bad deliverables.", () => __awaiter(this, void 0, void 0, function* () {
        let deliv = yield dc.validateDeliverableTransport(undefined);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        deliv = yield dc.validateDeliverableTransport(null);
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
        deliv = yield dc.validateDeliverableTransport({ id: 'a' });
        chai_1.expect(deliv).to.not.be.null;
        chai_1.expect(deliv).to.be.an('string');
    }));
});
//# sourceMappingURL=DeliverablesControllerSpec.js.map