import Log from "../../../../common/Log";
import {IAutoTestResult, IGradeReport} from "../../../../common/types/AutoTestTypes";
import {Result} from "../Types";

import {DatabaseController} from "./DatabaseController";
import {RepositoryController} from "./RepositoryController";

export class ResultsController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllResults(): Promise<Result[]> {
        Log.info("ResultsController::getAllResults() - start");

        const results = await this.db.getResults();
        return results;
    }

    // TODO: need to be able to get subsets of results
    /*
    public async getGrade(personId: string, delivId: string): Promise<Grade | null> {
        Log.info("GradesController::getGrade( " + personId + ", " + delivId + " ) - start");

        let grade = await this.db.getGrade(personId, delivId);
        return grade;
    }
    */

    // TODO: need to be able to associate a result row with a person or team?
    // rc.createResult(resultRecord.delivId, resultRecord.repoId, resultRecord.input, resultRecord.output).then(function (success) {÷
    public async createResult(record: IAutoTestResult): Promise<boolean> {
        Log.info("ResultsController::createResult(..) - start");
        Log.trace("GradesController::createResult(..) - payload: " + JSON.stringify(record));

        const rc = new RepositoryController();
        const people = await rc.getPeopleForRepo(record.repoId);

        (record as any).people = people; // don't know how to augment this record with people to keep the type system happy

        const outcome = await DatabaseController.getInstance().writeResult(record as Result);
        Log.trace("ResultsController::createResult(..) - result written");
        return outcome;
    }

    public async getResult(delivId: string, repoId: string): Promise<IAutoTestResult | null> {
        Log.info("ResultsController::getResult( " + delivId + ", " + repoId + " ) - start");

        const outcome = await DatabaseController.getInstance().getResult(delivId, repoId);
        return outcome;
    }

    /**
     * Validates the AutoTest result object.
     *
     * @param {IAutoTestResult} record
     * @returns {string | null} String will contain a description of the error, null if successful.
     */
    public validateAutoTestResult(record: IAutoTestResult): string | null {
        // multiple returns is poor, but at least it's quick

        // Log.info('ResultsController::validateAutoTestResult(..) - start');

        if (typeof record === 'undefined') {
            const msg = 'object undefined';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        if (record === null) {
            const msg = 'object null';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        // rudimentary checking

        // delivId: string; // (already in input)
        if (typeof record.delivId === 'undefined') {
            const msg = 'delivId undefined';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        // repoId: string;  // (already in input)
        if (typeof record.repoId === 'undefined') {
            const msg = 'repoId undefined';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        // commitURL: string;
        if (typeof record.commitURL === 'undefined') {
            const msg = 'commitURL undefined';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        // commitSHA: string;
        if (typeof record.commitSHA === 'undefined') {
            const msg = 'commitSHA undefined';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        // input: IContainerInput; // prepared by autotest
        if (typeof record.input !== 'object') {
            const msg = 'input object missing';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof record.input.delivId !== 'string') {
            const msg = 'input delivId missing';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof record.input.pushInfo !== 'object') {
            const msg = 'input pushInfo missing';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        // output: IContainerOutput;
        if (typeof record.output === 'undefined') {
            const msg = 'output object missing';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        // check report

        if (typeof record.output.timestamp === 'undefined' || typeof record.output.timestamp !== 'number') {
            const msg = 'output.timestamp missing or not a number';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof record.output.postbackOnComplete === 'undefined' || typeof record.output.postbackOnComplete !== 'boolean') {
            const msg = 'output.postbackOnComplete missing or not a boolean';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof record.output.attachments === 'undefined' || !Array.isArray(record.output.attachments)) {
            const msg = 'output.attachments missing or not an array';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof record.output.state === 'undefined' || typeof record.output.state !== 'string') {
            const msg = 'output.state missing or not a string';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof record.output.custom === 'undefined' || typeof record.output.custom !== 'object') {
            const msg = 'output.custom missing or not an object';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        // check the report (use helper fcn because other parts of the code might want to validate this too)
        if (typeof record.output.report === 'undefined' || typeof record.output.report !== 'object' || record.output.report === null) {
            const msg = 'output.report missing or not an object';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }
        const report = record.output.report;
        const rc = new ResultsController();
        const reportMsg = rc.validateGradeReport(report);

        if (reportMsg !== null) {
            return reportMsg;
        }

        Log.info('ResultsController::validateAutoTestResult(..) - done; object is valid');
        return null;
    }

    public validateGradeReport(report: IGradeReport): string | null {
        // Log.trace('ResultsController::validateGradeReport(..) - input: ' + JSON.stringify(report));

        if (typeof report === 'undefined') {
            const msg = 'object undefined';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (report === null) {
            const msg = 'object null';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.scoreOverall === 'undefined' || typeof report.scoreOverall !== 'number') {
            const msg = 'output.report.scoreOverall missing or not a number';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.scoreTest === 'undefined' || (typeof report.scoreTest !== 'number' && report.scoreTest !== null)) {
            const msg = 'output.report.scoreTest missing or not a number (or null)';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.scoreCover === 'undefined' || (typeof report.scoreCover !== 'number' && report.scoreCover !== null)) {
            const msg = 'output.report.scoreCover missing or not a number (or null)';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.passNames === 'undefined' || !Array.isArray(report.passNames)) {
            const msg = 'output.report.passNames missing or not an array';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.failNames === 'undefined' || !Array.isArray(report.failNames)) {
            const msg = 'output.report.failNames missing or not an array';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.errorNames === 'undefined' || !Array.isArray(report.errorNames)) {
            const msg = 'output.report.errorNames missing or not an array';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.skipNames === 'undefined' || !Array.isArray(report.skipNames)) {
            const msg = 'output.report.errorNames missing or not an array';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.feedback === 'undefined' || typeof report.feedback !== 'string') {
            const msg = 'output.report.feedback missing or not a string';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof report.custom === 'undefined' || typeof report.custom !== 'object') {
            const msg = 'output.report.custom missing or not an object';
            Log.error('ResultsController::validateGradeReport(..) - ERROR: ' + msg);
            return msg;
        }

        Log.info('ResultsController::validateGradeReport(..) - done; report is valid');
        return null; // everything is good
    }
}
