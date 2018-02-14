import {expect} from "chai";
import "mocha";
import {Config} from "../src/Config";
import {IDataStore, MongoDataStore} from "../src/autotest/DataStore";
import {TestData} from "./TestData";

describe.only("MongoStore", () => {
    Config.getInstance("test");

    let ds: IDataStore;

    beforeEach(async () => {
        ds = new MongoDataStore();
        // we know it is a test environment
        await ds.clearData();
    });

    it("Should be able to save a push event.", async () => {
        try {
            let allData = await ds.getAllData();
            expect(allData.pushes).to.be.empty;
            await ds.savePush(TestData.inputRecordA);
            allData = await ds.getAllData();
            expect(allData.pushes.length).to.equal(1);

            // const actual = await cp.isStaff(classId, "cs310");
            // expect(actual).to.equal(true);
        } catch (err) {
            expect.fail("Should not happen");
        }
    });

});
