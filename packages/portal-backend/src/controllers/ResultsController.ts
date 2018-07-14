import Log from "../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {IAutoTestResult} from "../../../autotest/src/Types";
import {RepositoryController} from "./RepositoryController";
import {Result} from "../Types";

export class ResultsController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllResults(): Promise<Result[]> {
        Log.info("ResultsController::getAllResults() - start");

        let results = await this.db.getResults();
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
        Log.info("ResultController::createResult(..) - start");
        Log.trace("GradesController::createResult(..) - payload: " + JSON.stringify(record));
        try {

            const rc = new RepositoryController();
            const people = await rc.getPeopleForRepo(record.repoId);

            (<any>record).people = people; // don't know how to augment this record with people to keep the type system happy

            let outcome = await DatabaseController.getInstance().writeResult(<Result>record);
            Log.trace("ResultController::createResult(..) - result written");
            return outcome;
        } catch (err) {
            Log.error("ResultController::createResult(..) - ERROR: " + err);
            return false;
        }
    }

    public async getResult(delivId: string, repoId: string): Promise<IAutoTestResult | null> {
        Log.info("ResultController::getResult( " + delivId + ", " + repoId + " ) - start");
        try {
            let outcome = await DatabaseController.getInstance().getResult(delivId, repoId);
            return outcome;
        } catch (err) {
            return null;
        }
    }

}
