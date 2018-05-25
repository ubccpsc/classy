import {GradesController} from "../GradesController";
import {DatabaseController} from "../DatabaseController";
import {Grade} from "../../Types";
// import {GradePayload} from "../GradesController";
import Log from "../../../../common/Log";

/**
 *
 * Custom type definitions, to be placed inside the custom field
 *
 */


// Represents an Assignment grade, comprised of an arbitrary amount of Questions
export interface AssignmentGrade {
    assignmentID: string;               // Unique Assignment ID per course
    studentID: string;                  // Unique Student ID per course
    questions: Array<QuestionGrade>;    // SubQuestions

}

// Represents the Question's grade, comprised of an arbitrary amount of subQuestions
export interface QuestionGrade {
    questionName: string;
    commentName: string;
    subQuestion: Array<SubQuestionGrade>;
}

// Represents the subQuestion's grade
export interface SubQuestionGrade {
    sectionName: string;
    grade: number;
    feedback: string;
}

export class AssignmentController {
    private db: DatabaseController = DatabaseController.getInstance();
    // private gc: GradesController = GradesController.getInstance();
    private gc : GradesController = new GradesController();

    // public constructor() {
    //     Log.info("New AssignmentController created");
    //     this.gc = new GradesController();
    // }


    public async getAssignmentGrade(org: string, personId: string, assignId: string): Promise<AssignmentGrade | null> {
        // let returningPromise = new Promise((resolve, reject) => {
        //     let gradeObj : Grade = await this.gc.getGrade(org, personId, assignId);
        // });
        //
        // return returningPromise;
        Log.info("AssignmentController:getAssignmentGrade("+org+", "+personId+", "+assignId+") - start");
        let grade : Grade = await this.gc.getGrade(org,personId,assignId);
        if (grade === null) return null;

        const assignmentGrade : AssignmentGrade = grade.custom;

        return assignmentGrade;
    }

    public async setAssignmentGrade(org: string, repoID: string, assignId: string, assnPayload: AssignmentGrade) : Promise<boolean> {
        // Array<Array<SubsectionGrade>>

        let totalGrade = 0;

        for (let i = 0; i < assnPayload.questions.length; i++) {
            let aQuestion = assnPayload.questions[i];
            for (let j = 0; j < aQuestion.subQuestion.length; j++) {
                let aSubQuestion = aQuestion.subQuestion[j];
                totalGrade += aSubQuestion.grade;
            }
        }

        Log.info("AssignmentController::setAssignmentGrade("+org+", "+repoID+", "+assignId+",..) - start");
        Log.trace("AssignmentController::setAssignmentGrade(..) - payload: " + JSON.stringify(assnPayload));

        try {
            let peopleIDs: string[] = [];
            let repo = await this.db.getRepository(org, repoID);
            const teamIDs = repo.teamIds;

            if (teamIDs !== null) {
                for (const tid of teamIDs) {
                    let team = await this.db.getTeam(org, tid);
                    for (const t of team.personIds) {
                        let found = false;
                        for (const ap of peopleIDs) {
                            if (ap === t) {
                                found = true;
                            }
                        }
                        if (found === false) {
                            peopleIDs.push(t);
                        }
                    }
                }
            }

            Log.info("AssignmentController::setAssignmentGrade(..) - # people: " + peopleIDs.length);

            for (let personID of peopleIDs) {
                // set each person's grade with the grade calculated
                let gradeRecord = await this.gc.getGrade(org, personID, assignId);
                if (gradeRecord === null) {
                    // if no record was found, create a new one

                    gradeRecord = {
                        org:        org,
                        personId:   personID,
                        delivId:    assignId,
                        score:      totalGrade,
                        comment:    "",                     // TODO, change this
                        URL:        "",                     // TODO: edit the url
                        timestamp:  Date.now(),
                        custom:     assnPayload

                };
                    Log.trace("AssignmentController::setAssignmentGrade(..) - new grade; personID: "+ personID + "; grade: " + JSON.stringify(gradeRecord));
                } else {
                    // retrieved grades, update existing records
                    gradeRecord.score       = totalGrade;
                    gradeRecord.comment     = "";           // TODO: have comments show up (maybe?)
                    gradeRecord.URL         = "";           // TODO: edit the url
                    gradeRecord.timestamp   = Date.now();
                }
                await this.db.writeGrade(gradeRecord);
            }
            return true;

        } catch (err) {
            Log.error("AssignmentController::setAssignmentGrade(..) - ERROR: " + err);
            return false;
        }
    }

    // public async addGrade(org: string, repoId: string, delivId: string)
}
