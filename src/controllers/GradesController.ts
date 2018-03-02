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

    public async createGrade(org: string, repoId: string, delivId: string, score: number, comment: string, url: string): Promise<boolean> {
        Log.info("RepositoryController::createGrade( " + org + ", " + repoId + ", " + delivId + ",.. ) - start");
        try {

            // find all people on a repo
            let repo = await this.db.getRepository(org, repoId);
            const teamIds = repo.teamIds;
            const allPeopleIds: string[] = [];
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

            Log.info("RepositoryController::createGrade(..) - # people: " + allPeopleIds.length);

            for (var personId of allPeopleIds) {
                // set their grades
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
            }

            return true;
        } catch (err) {
            Log.error("RepositoryController::createGrade(..) - ERROR: " + err);
            return false;
        }
    }
}