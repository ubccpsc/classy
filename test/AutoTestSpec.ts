import {expect} from "chai";
import "mocha";
import {AutoTestHandler} from "../src/autotest/AutoTestHandler";
import {DummyClassPortal, IClassPortal} from "../src/autotest/ClassPortal";
import {DummyDataStore, IDataStore} from "../src/autotest/DataStore";
import {IPushInfo} from "../src/Types";

import * as fs from "fs";

describe("AutoTest", () => {

    let pushes: IPushInfo[];
    let data: DummyDataStore;
    let portal: IClassPortal;
    let at: AutoTestHandler;

    before(async function () {
        return new Promise(function (resolve, reject) {
            fs.readFile("test/pushes.json", (err: any, data: any) => {
                if (err) {
                    reject(err);
                }
                pushes = JSON.parse(data);
                resolve(data);
            });

            // setup other vars
            data = new DummyDataStore();
            portal = new DummyClassPortal();
            const courseId = "cs310";
            at = new AutoTestHandler(courseId, data, portal);
        });
    });

    it("should be able to be instantiated", () => {
        expect(at).not.to.equal(null);
        expect(pushes.length).to.equal(9);
    });

    it("should receive a push event", () => {
        expect(at).not.to.equal(null);

        const pe: IPushInfo = pushes[0];
        expect(data.pushes.length).to.equal(0);
        at.handlePushEvent(pe);
        expect(data.pushes.length).to.equal(1);
        at.handlePushEvent(pushes[1]);
        at.handlePushEvent(pushes[2]);
        at.handlePushEvent(pushes[3]);
        at.handlePushEvent(pushes[4]);
        at.handlePushEvent(pushes[5]);
        expect(data.pushes.length).to.equal(6);
    });

    it("should be able to tick", () => {
        expect(data.pushes.length).to.equal(6);
        at.tick();
        expect(data.pushes.length).to.equal(5);
    });

});
