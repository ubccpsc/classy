import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../common/Config";
import Log from "../../common/Log";
import {Test} from "../../common/TestHarness";
import {CommitTarget} from "../../common/types/ContainerTypes";

import {IDataStore, MongoDataStore} from "../src/autotest/DataStore";
// const loadFirst = require('./GlobalSpec');
import "./GlobalSpec";
import {TestData} from "./TestData";

describe("MongoStore", () => {

    let ds: IDataStore;
    const oldName = Config.getInstance().getProp(ConfigKey.name); // .env value to restore after tests

    before(function() {
        Log.test("MongoStoreSpec::before");
        Config.getInstance().setProp(ConfigKey.name, Config.getInstance().getProp(ConfigKey.testname)); // force a test name
    });

    after(function() {
        Log.test("MongoStoreSpec::after");
        Config.getInstance().setProp(ConfigKey.name, oldName); // restore name
    });

    beforeEach(async () => {
        ds = new MongoDataStore();
        // we know it is a test environment
        await ds.clearData();
        return;
    });

    it("Should be able to save a push event.", async () => {
        // SETUP
        let allData = await ds.getAllData();
        expect(allData.pushes).to.be.empty;

        // TEST
        await ds.savePush(TestData.inputRecordA.target);

        // VERIFY
        allData = await ds.getAllData();
        expect(allData.pushes.length).to.equal(1);
        const actual = allData.pushes[0];
        const expected = TestData.inputRecordA.target;
        expect(actual).to.deep.include(expected);
    });

    it("Should be able to retrieve a push event.", async () => {
        // SETUP
        await ds.savePush(TestData.inputRecordA.target);

        // TEST
        const actual = await ds.getPushRecord(TestData.inputRecordA.target.commitURL);

        // VERIFY
        expect(actual).to.not.be.null;
        const expected = TestData.inputRecordA.target;
        expect(actual).to.deep.include(expected);
    });

    it("Should return null for a push event that has not been saved.", async () => {
        // SETUP
        await ds.savePush(TestData.inputRecordA.target);

        // TEST
        const actual = await ds.getPushRecord(TestData.inputRecordB.target.commitURL);

        // VERIFY
        expect(actual).to.be.null;
    });

    it("Should be able to save a comment event.", async () => {
        // SETUP
        let allData = await ds.getAllData();
        expect(allData.comments).to.be.empty;

        // TEST
        await ds.saveComment(TestData.commentRecordStaffA);

        // VERIFY
        allData = await ds.getAllData();
        expect(allData.comments.length).to.equal(1);
        const actual = allData.comments[0];
        const expected = TestData.commentRecordStaffA;
        expect(actual).to.deep.include(expected);
    });

    it("Should be able to retrieve a comment event.", async () => {
        // SETUP
        await ds.saveComment(TestData.commentRecordStaffA);

        // TEST
        const actual = await ds.getCommentRecord(TestData.commentRecordStaffA.commitURL,
            TestData.commentRecordStaffA.delivId, 'standard');

        // VERIFY
        expect(actual).to.not.be.null;
        const expected = TestData.commentRecordStaffA;
        expect(actual).to.deep.include(expected);
    });

    it("Should return null for a comment event that has not been saved.", async () => {
        // SETUP
        await ds.saveComment(TestData.commentRecordStaffA);

        // TEST
        const actual = await ds.getCommentRecord(TestData.commentRecordUserA.commitURL,
            TestData.commentRecordUserA.delivId, 'standard');

        // VERIFY
        expect(actual).to.be.null;
    });

    // it("Should be able to save an output event.", async () => {
    //     // SETUP
    //     let allData = await ds.getAllData();
    //     expect(allData.records).to.be.empty;
    //
    //     // TEST
    //     expect(true).to.be.false; // TODO: need to call ClassPortal.sendResult
    //     // await ds.saveOutputRecord(TestData.outputRecordA);
    //
    //     // VERIFY
    //     allData = await ds.getAllData();
    //     expect(allData.records.length).to.equal(1);
    //     const actual = allData.records[0];
    //     const expected = TestData.outputRecordA;
    //     expect(actual).to.deep.include(expected);
    // });
    // //
    // it("Should be able to retrieve an output event.", async () => {
    //     // SETUP
    //     // await ds.saveOutputRecord(TestData.outputRecordA);
    //     expect(true).to.be.false; // TODO: need to call ClassPortal.sendResult
    //
    //     // TEST
    //     const actual = await ds.getOutputRecord(TestData.outputRecordA.commitURL, TestData.outputRecordA.input.delivId);
    //
    //     // VERIFY
    //     expect(actual).to.not.be.null;
    //     const expected = TestData.outputRecordA;
    //     expect(actual).to.deep.include(expected);
    // });
    //
    // it("Should return null for an output event that has not been saved.", async () => {
    //     // SETUP
    //     expect(true).to.be.false; // TODO: need to call ClassPortal.sendResult
    //     // await ds.saveOutputRecord(TestData.outputRecordA);
    //
    //     // TEST
    //     const actual = await ds.getOutputRecord(TestData.outputRecordB.commitURL, TestData.outputRecordB.input.delivId);
    //
    //     // VERIFY
    //     expect(actual).to.be.null;
    // });

    it("Should be able to save a feedback event.", async () => {
        // SETUP
        let allData = await ds.getAllData();
        expect(allData.feedback).to.be.empty;

        // TEST
        await ds.saveFeedbackGivenRecord(TestData.feedbackRecordA);

        // VERIFY
        allData = await ds.getAllData();
        expect(allData.feedback.length).to.equal(1);
        const actual = allData.feedback[0];
        const expected = TestData.feedbackRecordA;
        expect(actual).to.deep.include(expected);
    });

    it("Should be able to retrieve a feedback event.", async () => {
        // SETUP
        await ds.saveFeedbackGivenRecord(TestData.feedbackRecordA);

        const target: CommitTarget = {
            commitURL: TestData.feedbackRecordA.commitURL,
            delivId:   TestData.feedbackRecordA.delivId,
            personId:  TestData.feedbackRecordA.personId
        } as CommitTarget; // not a complete target

        // TEST
        const actual = await ds.getFeedbackGivenRecordForCommit(target);

        // VERIFY
        expect(actual).to.not.be.null;
        const expected = TestData.feedbackRecordA;
        expect(actual).to.deep.include(expected);
    });

    it("Should be able to retrieve the latest feedback event.", async () => {
        // SETUP
        await ds.saveFeedbackGivenRecord(TestData.feedbackRecordA);
        await ds.saveFeedbackGivenRecord(TestData.feedbackRecordB);

        // TEST
        const actual = await ds.getLatestFeedbackGivenRecord(TestData.feedbackRecordA.delivId,
            TestData.feedbackRecordA.personId, 'standard');

        // VERIFY
        expect(actual).to.not.be.null;
        const expected = TestData.feedbackRecordA;
        expect(actual).to.deep.include(expected);
    });

    it("Should return null for a feedback event that has not been saved.", async () => {
        // SETUP
        await ds.saveFeedbackGivenRecord(TestData.feedbackRecordA);

        const target: CommitTarget = {
            commitURL: TestData.feedbackRecordB.commitURL,
            delivId:   TestData.feedbackRecordB.delivId,
            personId:  TestData.feedbackRecordB.personId
        } as CommitTarget; // not a complete target

        // TEST
        const actual = await ds.getFeedbackGivenRecordForCommit(target);

        // VERIFY
        expect(actual).to.be.null;
    });

});
