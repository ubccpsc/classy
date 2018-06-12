import Log from "../../../common/Log";

import {DatabaseController} from "./DatabaseController";
// import {Grade} from "../Types";
// import {GradePayload} from "../../../common/types/SDMMTypes";

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

    // TODO: need to be able to associate a result row with a person
    /*
    public async createResult(repoId: string, delivId: string, grade: GradePayload): Promise<boolean> {
        Log.info("GradesController::createGrade( " + repoId + ", " + delivId + ",.. ) - start");
        Log.trace("GradesController::createGrade(..) - payload: " + JSON.stringify(grade));
        try {

            if (typeof (<any>grade).url !== 'undefined') {
                grade.URL = (<any>grade).url; // TODO: remove this when AutoTest is done being naughty
            }

            // find all people on a repo
            const allPeopleIds: string[] = [];
            let repo = await this.db.getRepository(repoId);
            const teamIds = repo.teamIds;
            if (teamIds !== null) {
                for (const tid of teamIds) {
                    let team = await this.db.getTeam(tid);
                    for (const t of team.personIds) {
                        let found = false;
                        for (const ap of allPeopleIds) {
                            if (ap === t) {
                                found = true;
                            }
                        }
                        if (found === false) {
                            allPeopleIds.push(t);
                        }
                    }
                }
            }

            Log.info("GradesController::createGrade(..) - # people: " + allPeopleIds.length);

            for (const personId of allPeopleIds) {
                // set their grades
                let gradeRecord = await this.getGrade(personId, delivId);
                if (gradeRecord === null) {
                    // create new
                    gradeRecord = {
                        personId:  personId,
                        delivId:   delivId,
                        score:     grade.score,
                        comment:   grade.comment,
                        URL:       grade.URL,
                        timestamp: grade.timestamp,
                        custom:    grade.custom
                    };
                    Log.trace("GradesController::createGrade(..) - new grade; personId: " + personId + "; grade: " + JSON.stringify(gradeRecord));
                } else {
                    // update existing
                    gradeRecord.score = grade.score;
                    gradeRecord.comment = grade.comment;
                    gradeRecord.URL = grade.URL;
                    gradeRecord.timestamp = grade.timestamp;
                    gradeRecord.custom = grade.custom;
                    Log.trace("GradesController::createGrade(..) - updating grade; personId: " + personId + "; grade: " + JSON.stringify(gradeRecord));
                }
                await this.db.writeGrade(gradeRecord);
            }

            return true;
        } catch (err) {
            Log.error("GradesController::createGrade(..) - ERROR: " + err);
            return false;
        }
    }
    */
}
