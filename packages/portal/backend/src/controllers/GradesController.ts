import Log from "../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {Grade} from "../Types";
import {GradePayload} from "../../../common/types/SDMMTypes";
import {AutoTestGradeTransport} from "../../../common/types/PortalTypes";

export class GradesController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllGrades(): Promise<Grade[]> {
        Log.info("GradesController::getAllGrades() - start");

        let grades = await this.db.getGrades();
        return grades;
    }

    public async getGrade(personId: string, delivId: string): Promise<Grade | null> {
        Log.info("GradesController::getGrade( " + personId + ", " + delivId + " ) - start");

        let grade = await this.db.getGrade(personId, delivId);
        return grade;
    }

    public async createGrade(repoId: string, delivId: string, grade: GradePayload): Promise<boolean> {
        Log.info("GradesController::createGrade( " + repoId + ", " + delivId + ", ... ) - start");
        Log.trace("GradesController::createGrade(..) - payload: " + JSON.stringify(grade));

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
                    urlName:   grade.urlName,
                    URL:       grade.URL,
                    timestamp: grade.timestamp,
                    custom:    grade.custom
                };
                Log.trace("GradesController::createGrade(..) - new grade; personId: " + personId + "; grade: " + JSON.stringify(gradeRecord));
            } else {
                // update existing
                // personId & delivId are invariant
                gradeRecord.score = grade.score;
                gradeRecord.comment = grade.comment;
                gradeRecord.URL = grade.URL;
                gradeRecord.timestamp = grade.timestamp;
                gradeRecord.custom = grade.custom;
                Log.trace("GradesController::createGrade(..) - updating grade; personId: " + personId + "; grade: " + JSON.stringify(gradeRecord));
            }
            await this.db.writeGrade(gradeRecord);
        }

        return true; // if an exception hasn't been thrown we must be ok
    }


    /**
     * Validates the AutoTest grade object.
     *
     * @param {AutoTestGradeTransport} record
     * @returns {string | null} String will contain a description of the error, null if successful.
     */
    public validateAutoTestGrade(record: AutoTestGradeTransport): string | null {
        // multiple returns is poor, but at least it's quick
        Log.info('GradesController::validateAutoTestGrade(..) - start');

        if (typeof record === 'undefined') {
            const msg = 'object undefined';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }

        if (record === null) {
            const msg = 'object null';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }

        // just rudimentary checking

        // delivId: string; // invariant: deliv grade is associated with
        if (typeof record.delivId === 'undefined') {
            const msg = 'delivId undefined';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // score: number; // grade: < 0 will mean 'N/A' in the UI
        if (typeof record.score === 'undefined') {
            const msg = 'score undefined';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // comment: string; // simple grades will just have a comment
        if (typeof record.comment === 'undefined') {
            const msg = 'comment undefined';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // urlName: string | null; // description to go with the URL (repo if exists)
        if (typeof record.urlName === 'undefined') {
            const msg = 'urlName undefined';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // URL: string | null; // commit URL if known, otherwise repo URL (commit / repo if exists)
        if (typeof record.URL === 'undefined') {
            const msg = 'URL undefined';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // timestamp: number; // even if grade < 0 might as well return when the entry was made
        if (typeof record.timestamp !== 'number') {
            const msg = 'timestamp missing';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // custom: any;
        if (typeof record.custom !== 'object') {
            const msg = 'custom object missing';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }

        Log.info('GradesController::validateAutoTestGrade(..) - done; object is valid');

        return null;
    }

}
