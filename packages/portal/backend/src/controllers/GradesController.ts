import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";

import {AutoTestGradeTransport, GradeTransport} from "../../../../common/types/PortalTypes";
import {GradePayload} from "../../../../common/types/SDMMTypes";
import Util from "../../../../common/Util";
import {Grade, PersonKind} from "../Types";

import {DatabaseController} from "./DatabaseController";
import {DeliverablesController} from "./DeliverablesController";
import {PersonController} from "./PersonController";

export class GradesController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllGrades(studentsOnly?: boolean): Promise<Grade[]> {
        if (typeof studentsOnly === 'undefined') {
            studentsOnly = true;
        }
        Log.info("GradesController::getAllGrades( " + studentsOnly + " ) - start");
        const start = Date.now();

        const grades = await this.db.getGrades();
        const pc = new PersonController();

        const returnGrades = [];
        for (const grade of grades) {
            const person = await pc.getPerson(grade.personId);
            if (person !== null && (studentsOnly === false || (studentsOnly === true && person.kind === PersonKind.STUDENT))) {
                // only return student grades
                returnGrades.push(grade);
            } else {
                if (grade !== null && person !== null) {
                    Log.trace("GradesController::getAllGrades() - not returning grade for: " + grade.personId + "; kind: " + person.kind);
                } else {
                    Log.warn("GradesController::getAllGrades() - null; not returning grade: " +
                        JSON.stringify(grade) + "; person: " + JSON.stringify(person));
                }
            }
        }
        Log.info("GradesController::getAllGrades() - done; # all: " + grades.length +
            "; # returned: " + returnGrades.length + "; took: " + Util.took(start));
        return returnGrades;
    }

    public async getGrade(personId: string, delivId: string): Promise<Grade | null> {
        Log.info("GradesController::getGrade( " + personId + ", " + delivId + " ) - start");
        const start = Date.now();
        const grade = await this.db.getGrade(personId, delivId);

        Log.info("GradesController::getGrade( " + personId + ", " + delivId + " ) - done; took: " + Util.took(start));
        return grade;
    }

    public async getReleasedGradesForPerson(personId: string): Promise<Grade[]> {
        Log.info("GradesController::getReleasedGradesForPerson( " + personId + " ) - start");
        const start = Date.now();

        const delivc = new DeliverablesController();
        const delivs = await delivc.getAllDeliverables();
        let grades = [];
        for (const deliv of delivs) {
            if (deliv.gradesReleased === true && deliv.visibleToStudents === true) {
                Log.trace("GradesController::getReleasedGradesForPerson( " + personId + " ) - open deliv: " + deliv.id);
                let grade = await this.getGrade(personId, deliv.id);
                if (grade === null) {
                    // create empty grade
                    grade = {
                        personId:  personId,
                        delivId:   deliv.id,
                        score:     null,
                        comment:   null,
                        timestamp: -1,
                        URL:       null,
                        urlName:   null,
                        custom:    {}
                    };
                }
                if (grade.score !== null && grade.score < 0) {
                    grade.score = null; // null if not set (not -1)
                }
                grades.push(grade);
            } else {
                Log.trace("GradesController::getReleasedGradesForPerson( " + personId + " ) - closed deliv: " + deliv.id);
            }
        }

        // sort grades by delivid
        grades = grades.sort(function(g1: Grade, g2: Grade): number {
            return g1.delivId.localeCompare(g2.delivId);
        });

        Log.info("GradesController::getReleasedGradesForPerson( " + personId + " ) - # grades: " +
            grades.length + "; took: " + Util.took(start));
        return grades;
    }

    /**
     * This is a convenience function for creating and saving grades. It is also handled in
     * CourseController.processAutoTestGrade (and that implementation seems a lot simpler).
     *
     * @param {string} repoId
     * @param {string} delivId
     * @param {GradePayload} grade
     * @returns {Promise<boolean>}
     */
    public async createGrade(repoId: string, delivId: string, grade: GradePayload): Promise<boolean> {
        Log.info("GradesController::createGrade( " + repoId + ", " + delivId + ", ... ) - start");
        const start = Date.now();
        // Log.trace("GradesController::createGrade(..) - payload: " + JSON.stringify(grade));

        // find all people on a repo
        const allPeopleIds: string[] = [];
        const repo = await this.db.getRepository(repoId);
        const teamIds = repo.teamIds;
        if (teamIds !== null) {
            for (const tid of teamIds) {
                const team = await this.db.getTeam(tid);
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
                Log.trace("GradesController::createGrade(..) - new grade; personId: " +
                    personId + "; grade: " + JSON.stringify(gradeRecord));
            } else {
                // update existing
                // personId & delivId are invariant
                gradeRecord.score = grade.score;
                gradeRecord.comment = grade.comment;
                gradeRecord.URL = grade.URL;
                gradeRecord.timestamp = grade.timestamp;
                gradeRecord.custom = grade.custom;
                Log.trace("GradesController::createGrade(..) - updating grade; personId: " +
                    personId + "; grade: " + JSON.stringify(gradeRecord));
            }
            await this.db.writeGrade(gradeRecord);
        }

        Log.info("GradesController::createGrade( " + repoId + ", " + delivId + ", ... ) - done; took: " + Util.took(start));
        return true; // if an exception hasn't been thrown we must be ok
    }

    public async saveGrade(grade: Grade): Promise<boolean> {
        Log.info("GradesController::saveGrade( .. ) - start; person: " +
            grade.personId + "; deliv: " + grade.delivId + "; score: " + grade.score);
        const start = Date.now();

        const existingGrade = await this.db.getGrade(grade.personId, grade.delivId);
        if (existingGrade !== null) {
            Log.trace("GradesController::saveGrade( .. ) - updating existing grade");
            (grade.custom as any).previousGrade = existingGrade; // persist previous grade
            if (grade.URL === null && existingGrade.URL !== null) {
                grade.URL = existingGrade.URL; // restore the URL, if it exists on the previous but not on the update (e.g., for CSV upload)
            }
        }
        const worked = await this.db.writeGrade(grade);
        Log.info("GradesController::saveGrade( .. ) - done; person: " +
            grade.personId + "; deliv: " + grade.delivId + "; score: " + grade.score + "; took: " + Util.took(start));
        return worked;
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
            const msg = 'delivId missing';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // score: number; // grade: < 0 will mean 'N/A' in the UI
        if (typeof record.score === 'undefined') {
            const msg = 'score missing';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // comment: string; // simple grades will just have a comment
        if (typeof record.comment === 'undefined') {
            const msg = 'comment missing';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // urlName: string | null; // description to go with the URL (repo if exists)
        if (typeof record.urlName === 'undefined') {
            const msg = 'urlName missing';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // URL: string | null; // commit URL if known, otherwise repo URL (commit / repo if exists)
        if (typeof record.URL === 'undefined') {
            const msg = 'URL missing';
            Log.error('GradesController::validateAutoTestGrade(..) - ERROR: ' + msg);
            return msg;
        }
        // timestamp: number; // even if grade < 0 might as well return when the entry was made
        if (typeof record.timestamp === 'undefined') {
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

    public async gradeToTransport(grade: Grade): Promise<GradeTransport> {
        const config = Config.getInstance();

        const pc = new PersonController(); // this is a lot of slow work to go from personId -> githubId
        const p = await pc.getPerson(grade.personId);

        const g: GradeTransport = {
            personId:  grade.personId,
            personURL: config.getProp(ConfigKey.githubHost) + '/' + p.githubId, // grade.personId,

            delivId: grade.delivId,

            score:   grade.score,
            comment: grade.comment,

            urlName: grade.urlName,
            URL:     grade.URL,

            timestamp: grade.timestamp,
            custom:    grade.custom
        };

        return g;
    }
}
