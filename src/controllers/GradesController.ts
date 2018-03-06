import Log from "../util/Log";
import {DatabaseController} from "./DatabaseController";
import {Grade} from "../Types";
import {GradePayload} from "./SDDMController";

export class GradesController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllGrades(org: string): Promise<Grade[]> {
        Log.info("GradesController::getAllGrades( " + org + " ) - start");

        let grades = await this.db.getGrades(org);
        return grades;
    }

    public async getGrade(org: string, personId: string, delivId: string): Promise<Grade | null> {
        Log.info("GradesController::getGrade( " + org + ", " + personId + ", " + delivId + " ) - start");

        let grade = await this.db.getGrade(org, personId, delivId);
        return grade;
    }

    public async createGrade(org: string, repoId: string, delivId: string, grade: GradePayload): Promise<boolean> {
        Log.info("GradesController::createGrade( " + org + ", " + repoId + ", " + delivId + ",.. ) - start");
        Log.trace("GradesController::createGrade(..) - payload: " + JSON.stringify(grade));
        try {

            // find all people on a repo
            const allPeopleIds: string[] = [];
            let repo = await this.db.getRepository(org, repoId);
            const teamIds = repo.teamIds;
            if (teamIds !== null) {
                for (const tid of teamIds) {
                    let team = await this.db.getTeam(org, tid);
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

            Log.info("RepositoryController::createGrade(..) - # people: " + allPeopleIds.length);

            for (var personId of allPeopleIds) {
                // set their grades
                let gradeRecord = await this.getGrade(org, personId, delivId);
                if (gradeRecord === null) {
                    // create new
                    gradeRecord = {
                        org:       org,
                        personId:  personId,
                        delivId:   delivId,
                        score:     grade.score,
                        comment:   grade.comment,
                        URL:       grade.URL,
                        timestamp: grade.timestamp
                    };
                    Log.trace("RepositoryController::createGrade(..) - new grade; personId: " + personId + "; grade: " + JSON.stringify(gradeRecord));
                } else {
                    // update existing
                    gradeRecord.score = grade.score;
                    gradeRecord.comment = grade.comment;
                    gradeRecord.URL = grade.URL;
                    gradeRecord.timestamp = grade.timestamp;
                    Log.trace("RepositoryController::createGrade(..) - updating grade; personId: " + personId + "; grade: " + JSON.stringify(gradeRecord));
                }
                await this.db.writeGrade(gradeRecord);
            }

            return true;
        } catch (err) {
            Log.error("RepositoryController::createGrade(..) - ERROR: " + err);
            return false;
        }
    }
}