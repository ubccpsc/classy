import Log from "../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {IContainerOutput} from "../../../autotest/src/Types";

export class ResultsController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllResults(): Promise<IContainerOutput[]> {
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
    public async createResult(result: IContainerOutput): Promise<boolean> {
        Log.info("ResultController::createResult(..) - start");
        Log.trace("GradesController::createResult(..) - payload: " + JSON.stringify(result));
        try {
            let outcome = await DatabaseController.getInstance().writeResult(result);

            return outcome;
        } catch (err) {
            Log.error("ResultController::createResult(..) - ERROR: " + err);
            return false;
        }
    }

}
