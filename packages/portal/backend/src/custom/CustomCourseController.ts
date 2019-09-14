import Log from "../../../../common/Log";
import {CourseController} from "../controllers/CourseController";
import {DatabaseController} from "../controllers/DatabaseController";
import {IGitHubController} from "../controllers/GitHubController";
import {Deliverable, Person, Team} from "../Types";

/**
 *
 * 310-specific course controller.
 *
 */
export class CustomCourseController extends CourseController {

    // Does not do anything right now, just here so we know where to make course-specific changes to CourseController

    public constructor(ghController: IGitHubController) {
        super(ghController);
        Log.info("CustomCourseController::<init>");
    }

    // public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null; repoName: string | null}> {
    //     Log.info("CustomCourseController::computeNames() - passing up to CourseController");
    //     return super.computeNames(deliv, people);
    // }

    public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null; repoName: string | null}> {
        if (deliv === null) {
            throw new Error("CustomCourseController::computeNames( ... ) - null Deliverable");
        }

        Log.info('CustomCourseController::computeNames( ' + deliv.id + ', ... ) - start');
        if (people.length < 1) {
            throw new Error("CustomCourseController::computeNames( ... ) - must provide people");
        }

        // sort people alph by their id
        people = people.sort(function compare(p1: Person, p2: Person) {
            return p1.id.localeCompare(p2.id);
        });

        const db = DatabaseController.getInstance();
        let teamName: string | null = null;
        const allTeams: Team[] = [];
        for (const person of people) {
            const teams = await db.getTeamsForPerson(person.id);
            for (const team of teams) {
                if (team.delivId === deliv.id) {
                    let hasAllPeople = true;
                    for (const p of team.personIds) {
                        if (team.personIds.indexOf(p) < 0) {
                            hasAllPeople = false;
                        }
                    }
                    if (hasAllPeople === true) {
                        allTeams.push(team);
                    }
                }
            }
        }

        if (allTeams.length === 1) {
            teamName = allTeams[0].id;
        } else if (allTeams.length > 1) {
            // this is a real problem
            throw new Error("CustomCourseController::computeNames( ... ) - multiple teams found: " + JSON.stringify(allTeams));
        }

        if (teamName === null) {
            const teamNum = await db.getUniqueTeamNumber(deliv.id);
            if (deliv.teamPrefix.length > 0) {
                teamName = deliv.teamPrefix + "_" + deliv.id + "_team" + teamNum;
            } else {
                teamName = deliv.id + "_team" + teamNum;
            }
        }

        const postfix = teamName.substr(teamName.lastIndexOf('_') + 1);

        // let postfix = '';
        // for (const person of people) {
        //     // NOTE: use CSID here to be more resilient if CWLs change
        //     // TODO: this would be even better if it was person.id
        //     postfix = postfix + '_' + person.csId;
        // }
        //
        // let tName = '';
        // if (deliv.teamPrefix.length > 0) {
        //     tName = deliv.teamPrefix + '_' + deliv.id + postfix;
        // } else {
        //     tName = deliv.id + postfix;
        // }

        let rName = '';
        if (deliv.repoPrefix.length > 0) {
            rName = deliv.repoPrefix + '_' + deliv.id + postfix;
        } else {
            rName = deliv.id + postfix;
        }

        // const db = DatabaseController.getInstance();
        const teamObj = await db.getTeam(teamName);
        const repoObj = await db.getRepository(rName);

        if (teamObj === null && repoObj === null) {
            Log.info('CustomCourseController::computeNames( ... ) - new; t: ' + teamName + ', r: ' + rName);
            return {teamName: teamName, repoName: rName};
        } else {
            // TODO: should really verify that the existing teams contain the right people already
            Log.info('CustomCourseController::computeNames( ... ) - existing; t: ' + teamName + ', r: ' + rName);
            return {teamName: teamName, repoName: rName};
        }
    }
}
