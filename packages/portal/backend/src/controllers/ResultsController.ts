import Log from "../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {IAutoTestResult} from "../../../autotest/src/Types";
import {RepositoryController} from "./RepositoryController";
import {Result} from "../Types";

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

        (<any>record).people = people; // don't know how to augment this record with people to keep the type system happy

        let outcome = await DatabaseController.getInstance().writeResult(<Result>record);
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

        Log.info('ResultsController::validateAutoTestResult(..) - start');

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
        // timestamp: number; // timestamp of push, not of any processing (already in input)
        if (typeof record.timestamp === 'undefined') {
            const msg = 'timestamp undefined';
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
        // input: IContainerInput;
        if (typeof record.input !== 'object') {
            const msg = 'input object missing';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }
        // output: IContainerOutput;
        if (typeof record.output === 'undefined') {
            const msg = 'output object missing';
            Log.error('ResultsController::validateAutoTestResult(..) - ERROR: ' + msg);
            return msg;
        }

        Log.info('ResultsController::validateAutoTestResult(..) - done; object is valid');
        return null;
    }
}
