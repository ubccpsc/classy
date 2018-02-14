import {expect} from "chai";
import "mocha";
import {Config} from "../src/Config";
import {IDataStore, MongoDataStore} from "../src/autotest/DataStore";
import {TestData} from "./TestData";
import Log from "../src/util/Log";

describe.only("MongoStore", () => {
    Config.getInstance("test");

    let ds: IDataStore;

    beforeEach(async () => {
        ds = new MongoDataStore();
        // we know it is a test environment
        await ds.clearData();
    });

    it("Should be able to save a push event.", async () => {
        // SETUP
        let allData = await ds.getAllData();
        expect(allData.pushes).to.be.empty;

        // TEST
        await ds.savePush(TestData.inputRecordA);

        // VERIFY
        allData = await ds.getAllData();
        expect(allData.pushes.length).to.equal(1);
        let actual = allData.pushes[0];
        expect(TestData.inputRecordA).to.deep.include(actual);
    });

    it("Should be able to retrieve a push event.", async () => {
        // SETUP
        await ds.savePush(TestData.inputRecordA);

        // TEST
        const actual = await ds.getPushRecord(TestData.inputRecordA.pushInfo.commitURL);

        // VERIFY
        expect(actual).to.not.be.null;
        expect(TestData.inputRecordA.pushInfo).to.deep.include(actual);
    });

    it("Should return null for a push event that has not been saved.", async () => {
        // SETUP
        await ds.savePush(TestData.inputRecordA);

        // TEST
        const actual = await ds.getPushRecord(TestData.inputRecordB.pushInfo.commitURL);

        // VERIFY
        expect(actual).to.be.null;
    });

});
