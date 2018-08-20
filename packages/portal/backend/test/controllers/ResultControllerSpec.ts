import {expect} from "chai";
import "mocha";
import {IGradeReport} from "../../../../common/types/AutoTestTypes";

import {AutoTestResultTransport} from "../../../../common/types/PortalTypes";
import {ResultsController} from "../../src/controllers/ResultsController";

import '../GlobalSpec'; // load first
import {Test} from "../GlobalSpec";
import './CourseControllerSpec'; // make sure it runs before github controller (which should be last of the controllers)

describe("ResultController", () => {

    let rc: ResultsController;

    before(async () => {
        await Test.suiteBefore('ResultController');

        // clear stale data (removed; happens in suitebefore)
        // const dc = DatabaseController.getInstance();
        // sawait dc.clearData();

        // get data ready
        await Test.prepareDeliverables();
        await Test.preparePeople();
        await Test.prepareAuth();
        await Test.prepareRepositories();
        await Test.prepareTeams();

        rc = new ResultsController();
    });

    after(async () => {
        Test.suiteAfter('ResultController');
    });

    it("Should be able to get all results, even if there are none.", async () => {
        const results = await rc.getAllResults();
        expect(results).to.have.lengthOf(0);
    });

    it("Should be able to save a result.", async () => {
        let results = await rc.getAllResults();
        expect(results).to.have.lengthOf(0);

        // const fullPath = __dirname + "/../../../../autotest/test/githubAutoTestData/outputRecords.json";
        // let data = fs.readJSONSync(fullPath);
        // let output = await rc.createResult(data[0]);
        // public static getResult(delivId: string, repoId: string, people: string[], score: number): Result {
        const result = Test.createResult(Test.DELIVID0, Test.REPONAME1, [Test.USER1.id], 50);
        const output = await rc.createResult(result);
        expect(output).to.be.true;

        results = await rc.getAllResults();
        expect(results).to.have.lengthOf(1);
    });

    it("Should be able to invalidate bad results.", async () => {
        let deliv = await rc.validateAutoTestResult(undefined);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        deliv = await rc.validateAutoTestResult(null);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        let data: AutoTestResultTransport = {} as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {delivId: 'd0'} as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {delivId: 'd0', repoId: 'r1'} as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {delivId: 'd0', repoId: 'r1', commitURL: 'url'}as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {delivId: 'd0', repoId: 'r1', commitURL: 'url', commitSHA: 'sha'}as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {delivId: 'd0', repoId: 'r1', commitURL: 'url', commitSHA: 'sha', input: {}}as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0'}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}},
            output:    {}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}},
            output:    {timestamp: Date.now()}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}},
            output:    {timestamp: Date.now(), postbackOnComplete: false}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}},
            output:    {timestamp: Date.now(), postbackOnComplete: false, attachments: []}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}},
            output:    {timestamp: Date.now(), postbackOnComplete: false, attachments: [], state: 'SUCCESS'}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}},
            output:    {timestamp: Date.now(), postbackOnComplete: false, attachments: [], state: 'SUCCESS', custom: {}}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        data = {
            delivId:   'd0',
            repoId:    'r1',
            commitURL: 'url',
            commitSHA: 'sha',
            input:     {delivId: 'd0', pushInfo: {}},
            output:    {timestamp: Date.now(), postbackOnComplete: false, attachments: [], state: 'SUCCESS', custom: {}, report: {}}
        }as AutoTestResultTransport;
        deliv = await rc.validateAutoTestResult(data);
        expect(deliv).to.not.be.null;
        expect(deliv).to.be.an('string');

        // TODO: test worked case (e.g., deliv === null)
    });

    it("Should be able to invalidate grade record.", async () => {
        // public static validateGradeReport(report: IGradeReport): string | null {
        let valid = await rc.validateGradeReport(undefined);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        valid = await rc.validateGradeReport(null);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        let data: IGradeReport = {} as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        // export interface IGradeReport {
        //     scoreOverall: number; // must be set
        //     scoreTest: number | null; // null means not valid for this report
        //     scoreCover: number | null; // null means not valid for this report
        //
        //     // The semantics of these four categories are up to the container
        //     // we only differentiate them so the report UI can render them uniquely.
        //     // Set to [] for any unused property.
        //     passNames: string[];
        //     failNames: string[];
        //     errorNames: string[];
        //     skipNames: string[];
        //
        //     // This is the text of the feedback (in markdown) that the container wants
        //     // to return to the user.
        //     feedback: string;
        //
        //     // Enables custom values to be returned to the UI layer.
        //     // PLEASE: do not store large objects in here or it will
        //     // significantly impact the performance of the dashboard.
        //     // Use attachments instead for large bits of data you wish
        //     // to persist.
        //     custom: {};
        // }
        data = {scoreOverall: 12} as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        data = {scoreOverall: 12, scoreTest: 22} as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        data = {scoreOverall: 12, scoreTest: 22, scoreCover: 33} as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        data = {scoreOverall: 12, scoreTest: 22, scoreCover: 33, passNames: ['pass']} as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        data = {scoreOverall: 12, scoreTest: 22, scoreCover: 33, passNames: ['pass'], failNames: ['fail']} as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        data = {
            scoreOverall: 12,
            scoreTest:    22,
            scoreCover:   33,
            passNames:    ['pass'],
            failNames:    ['fail'],
            errorNames:   ['error']
        } as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        data = {
            scoreOverall: 12,
            scoreTest:    22,
            scoreCover:   33,
            passNames:    ['pass'],
            failNames:    ['fail'],
            errorNames:   ['error'],
            skipNames:    ['skip']
        } as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        data = {
            scoreOverall: 12,
            scoreTest:    22,
            scoreCover:   33,
            passNames:    ['pass'],
            failNames:    ['fail'],
            errorNames:   ['error'],
            skipNames:    ['skip'],
            feedback:     'feedback'
        } as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.not.be.null;
        expect(valid).to.be.an('string');

        // valid record!
        data = {
            scoreOverall: 12,
            scoreTest:    22,
            scoreCover:   33,
            passNames:    ['pass'],
            failNames:    ['fail'],
            errorNames:   ['error'],
            skipNames:    ['skip'],
            feedback:     'feedback',
            custom:       {}
        } as IGradeReport;
        valid = await rc.validateGradeReport(data);
        expect(valid).to.be.null;
    });

});
