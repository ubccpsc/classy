import {GradesController} from "../GradesController";
import {DatabaseController} from "../DatabaseController";
import {Grade, Person, Repository, Team} from "../../Types";
// import {GradePayload} from "../GradesController";
import Log from "../../../../common/Log";
import {GradePayload} from "../../../../common/types/SDMMTypes";
import {AssignmentGrade} from "../../../../common/types/CS340Types";
import {RepositoryController} from "../RepositoryController";
import {TeamController} from "../TeamController";

/*
 * Definition of controller object
 */

export class AssignmentController {
    private db: DatabaseController = DatabaseController.getInstance();
    private gc: GradesController = new GradesController();
    private rc: RepositoryController = new RepositoryController();
    private tc: TeamController = new TeamController();

    public async getAssignmentGrade(personId: string, assignId: string): Promise<AssignmentGrade | null> {
        // let returningPromise = new Promise((resolve, reject) => {
        //     let gradeObj : Grade = await this.gc.getGrade(org, personId, assignId);
        // });
        //
        // return returningPromise;
        Log.info("AssignmentController:getAssignmentGrade(" + ", " + personId + ", " + assignId + ") - start");
        let grade: Grade = await this.gc.getGrade(personId, assignId);
        if (grade === null) return null;

        const assignmentGrade: AssignmentGrade = grade.custom;
        return assignmentGrade;
    }

    public async setAssignmentGrade(repoID: string, assignId: string, assnPayload: AssignmentGrade): Promise<boolean> {
        // Array<Array<SubsectionGrade>>
        Log.info("AssignmentController::setAssignmentGrade(" + ", " + repoID + ", " + assignId + ",..) - start");
        Log.trace("AssignmentController::setAssignmentGrade(..) - payload: " + JSON.stringify(assnPayload));

        let totalGrade = 0;

        for (const aQuestion of assnPayload.questions) {
            for (const aSubQuestion of aQuestion.subQuestion) {
                // Sum up all subcompartment grades
                totalGrade += aSubQuestion.grade;
            }
        }

        // Assume Repository exists
        let repo: Repository = await this.rc.getRepository(repoID);

        if (repo === null) {
            return false;
        }

        let newGradePayload: GradePayload = {
            // assignmentID: assnPayload.assignmentID,
            // studentID: assnPayload.studentID,
            score:     totalGrade,
            comment:   'Marked assignment',
            urlName:   repo.id,
            URL:       repo.URL,
            timestamp: Date.now(),
            custom:    assnPayload
        };

        let success = await this.gc.createGrade(repoID, assignId, newGradePayload);
        return success;
    }

    public async createAssignmentRepo(repoName: string, delivId: string, teams: Team[]): Promise<Repository | null> {
        Log.info("AssignmentController::createAssignmentRepo( " + repoName + ", " + delivId + ",... ) - start");
        return await this.rc.createRepository(repoName, teams, delivId);
    }

    public async getAssignmentRepo(delivId: string, person: Person): Promise<Repository | null> {
        Log.info("AssignmentController::getAssignmentRepo( " + delivId + ", " + person + " ) - start");

        let allRepos: Repository[] = await this.db.getRepositories();
        let personRepos: Repository[] = [];
        for (const repo of allRepos) {
            const teamIds: string[] = repo.teamIds;
            for (const teamId of teamIds) {
                const team = await this.tc.getTeam(teamId);
                for (const personIds of team.personIds) {
                    if (personIds === person.id) {
                        personRepos.push(repo);
                    }
                }
            }
        }
        let result: Repository[] = [];
        for (const repo of personRepos) {
            if (repo.custom === delivId) {
                result.push(repo);
            }
        }
        if (result.length !== 1) {
            Log.info("AssignmentController::getAssignmentRepo(...) - non-single repo found: " + result.toString());
            return null;
        } else {
            Log.info("AssignmentController::getAssignmentRepo(...) - end");
            return result[0];
        }
    }
}
