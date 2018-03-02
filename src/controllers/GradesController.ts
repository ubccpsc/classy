import Log from "../util/Log";
import {DatabaseController} from "./DatabaseController";
import {Grade} from "../Types";

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

    public async createGrade(org: string, personId: string, delivId: string, score: number, comment: string, url: string): Promise<Grade | null> {
        Log.info("RepositoryController::createGrade( " + org + ", " + personId + ", " + delivId + ",.. ) - start");
        try {
            let grade = await this.getGrade(org, personId, delivId);
            if (grade === null) {
                // create new
                grade = {
                    org:      org,
                    personId: personId,
                    delivId:  delivId,
                    score:    score,
                    comment:  comment,
                    url:      url
                };
            } else {
                // update existing
                grade.score = score;
                grade.comment = comment;
                grade.url = url;
            }
            await this.db.writeGrade(grade);
            return grade;
        } catch (err) {
            Log.error("RepositoryController::createGrade(..) - ERROR: " + err);
            return null;
        }
    }
}