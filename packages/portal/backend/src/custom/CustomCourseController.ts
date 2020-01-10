import Log from "../../../../common/Log";
import {CourseController} from "../controllers/CourseController";
import {DatabaseController} from "../controllers/DatabaseController";
import {IGitHubController} from "../controllers/GitHubController";
import {RepositoryController} from "../controllers/RepositoryController";
import {TeamController} from "../controllers/TeamController";
import {Deliverable, Grade, Person, PersonKind, Team} from "../Types";

/**
 *
 * 310-specific course controller.
 *
 */
export class CustomCourseController extends CourseController {

    // Does not do anything right now, just here so we know where to make course-specific changes to CourseController

    public constructor(ghController: IGitHubController) {
        super(ghController);
        Log.info("CustomCourseController::<init> - start");
    }

    // public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null; repoName: string | null}> {
    //     Log.info("CustomCourseController::computeNames() - passing up to CourseController");
    //     return super.computeNames(deliv, people);
    // }

    public async computeNames(deliv: Deliverable, people: Person[], adminOverride = false):
        Promise<{teamName: string | null; repoName: string | null}> {
        if (deliv === null) {
            throw new Error("CustomCourseController::computeNames( ... ) - null Deliverable");
        }

        Log.info('CustomCourseController::computeNames( ' + deliv.id + ', ... ) - start; override: ' + adminOverride);
        if (people.length < 1) {
            throw new Error("CustomCourseController::computeNames( ... ) - must provide people");
        }

        // sort people alph by their id
        people = people.sort(function compare(p1: Person, p2: Person) {
            return p1.id.localeCompare(p2.id);
        });

        const db = DatabaseController.getInstance();
        let teamName: string | null = null;
        let allTeams: Team[] = [];
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
        // remove exact duplicates (common because p1s d1 team _should_ be the same as p2s d1 team)
        const allTeamsUnique: Team[] = [];
        allTeams.forEach(function(candidateTeam) {
            let include = true;
            allTeamsUnique.forEach(function(matchTeam) {
                if (candidateTeam.id === matchTeam.id) {
                    include = false;
                }
            });
            if (include === true) {
                allTeamsUnique.push(candidateTeam);
            }
        });
        allTeams = allTeamsUnique;

        Log.trace('CustomCourseController::computeNames( ' + deliv.id + ', ... ) - allTeams: ' + JSON.stringify(allTeams));

        if (allTeams.length === 1) {
            teamName = allTeams[0].id;
        } else if (allTeams.length > 1) {
            // this is a real problem
            throw new Error("CustomCourseController::computeNames( ... ) - multiple teams found: " + JSON.stringify(allTeams));
        }

        if (teamName === null) {
            const teamNum = await db.getUniqueTeamNumber(deliv.id);
            Log.trace('CustomCourseController::computeNames( ' + deliv.id + ', ... ) - null teamName; new number: ' + teamNum);
            let teamSuffix = '';

            let hasStudents = false;
            for (const person of people) {
                // if a team is all admins name it differently so it stands out more
                if (person.kind === PersonKind.ADMINSTAFF || person.kind === PersonKind.ADMIN || person.kind === PersonKind.STAFF) {
                    // is admin
                } else {
                    hasStudents = true;
                }
            }

            if (hasStudents === true) {
                teamSuffix = "_team" + teamNum;
            } else {
                teamSuffix = "_staff" + teamNum;
            }

            if (deliv.teamPrefix.length > 0) {
                teamName = deliv.teamPrefix + "_" + deliv.id + teamSuffix;
            } else {
                teamName = deliv.id + teamSuffix;
            }
        }

        const postfix = teamName.substr(teamName.lastIndexOf('_') + 1);
        Log.trace('CustomCourseController::computeNames( ' + deliv.id + ', ... ) - postfix: ' + postfix);

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
            rName = deliv.repoPrefix + '_' + deliv.id + '_' + postfix;
        } else {
            rName = deliv.id + '_' + postfix;
        }

        // const db = DatabaseController.getInstance();
        let teamObj = await db.getTeam(teamName);
        let repoObj = await db.getRepository(rName);

        if (teamObj === null) {
            try {
                // formTeam enforces team restrictions (teamCreate does not)
                // NOTE: this will fail if we need adminOverride === true
                Log.info('CustomCourseController::computeNames( ... ) - creating new team: t: ' + teamName);
                const tc = new TeamController();
                teamObj = await tc.formTeam(teamName, deliv, people, adminOverride);
            } catch (err) {
                Log.error("CustomCourseController::computeNames( ... ) - invalid team: " + err.message);
                // pass this error on so whoever called this will know why the team formation failed
                throw err;
            }
        }

        if (repoObj === null) {
            Log.info('CustomCourseController::computeNames( ... ) - creating new repo: r: ' + rName);
            const rc = new RepositoryController();
            repoObj = await rc.createRepository(rName, deliv, [teamObj], {});
        }

        if (teamObj === null || repoObj === null) {
            throw new Error('CustomCourseController::computeNames( ... ) - nulls encountered!; t: ' + teamObj + ', r: ' + repoObj);
        }

        Log.info('CustomCourseController::computeNames( ... ) - done; t: ' + teamName + ', r: ' + rName);
        return {teamName: teamName, repoName: rName};
    }

    /**
     * Extends the default behaviour: requires that push was on master
     *
     * @param {Deliverable} deliv
     * @param {Grade} newGrade
     * @param {Grade} existingGrade
     * @returns {boolean}
     */
    public handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): Promise<boolean> {
        const LOGPRE = "CustomCourseController::handleNewAutoTestGrade( " + deliv.id + ", " +
            newGrade.personId + ", " + newGrade.score + ", ... ) - URL: " + newGrade.URL + " - ";

        if (newGrade.custom["isMaster"] === false) {
            Log.info(LOGPRE + "not recorded; push was not on master");
            return Promise.resolve(false);
        } else {
            return super.handleNewAutoTestGrade(deliv, newGrade, existingGrade);
        }
    }
}
