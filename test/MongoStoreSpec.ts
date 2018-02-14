import {expect} from "chai";
import "mocha";
import {Config} from "../src/Config";
import {ClassPortal, DummyClassPortal, IClassPortal} from "../src/autotest/ClassPortal";
import {IDataStore, MongoDataStore} from "../src/autotest/DataStore";
import {Mongos} from "mongodb";
import {IContainerInput} from "../src/Types";

describe.only("MongoStore", () => {
    Config.getInstance("test");

    let ds: IDataStore;

    beforeEach(function () {
        ds= new MongoDataStore();
    });

    it("Should be able to open a connection.", async () => {
        try {
            await ds.savePush(<IContainerInput>{});
            // const actual = await cp.isStaff(classId, "cs310");
            // expect(actual).to.equal(true);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

});
