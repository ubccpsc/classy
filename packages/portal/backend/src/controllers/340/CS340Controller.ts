import Log from "../../../../../common/Log";
import {Deliverable, Grade, Person} from "../../Types";
import {CourseController} from "../CourseController";
import {DatabaseController} from "../DatabaseController";
import {IGitHubController} from "../GitHubController";

export class CS340Controller extends CourseController {

    public constructor(ghController: IGitHubController) {
        super(ghController);
        Log.info("CS340Controller::<init>");
    }

    public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}> {
        Log.info('CS340Controller::computeNames( ' + deliv.id + ', ... ) - start');

        if (people.length < 1) {
            throw new Error("CS340Controller::computeNames( ... ) - must provide people");
        }

        let postfix = '';
        for (const person of people) {
            postfix = postfix + '_' + person.id;
        }

        let rName: string;
        let tName: string;

        if (deliv.repoPrefix.trim() === "") {
            rName = deliv.id + postfix;
        } else {
            if( deliv.repoPrefix.trim().endsWith("_") ) {
                rName = deliv.repoPrefix.substring(0, deliv.repoPrefix.length - 1) + postfix;
            } else {
                rName = deliv.repoPrefix + postfix;
            }
        }

        if (deliv.teamPrefix.trim() === "") {
            tName = deliv.id + postfix;
        } else {
            if( deliv.teamPrefix.trim().endsWith("_") ) {
                tName = deliv.teamPrefix.substring(0, deliv.teamPrefix.length - 1) + postfix;
            } else {
                tName = deliv.teamPrefix + postfix;
            }
        }

        const db = DatabaseController.getInstance();
        const team = await db.getTeam(tName);
        const repo = await db.getRepository(rName);

        if (team === null && repo === null) {
            Log.info('CS340Controller::computeNames( ... ) - done; t: ' + tName + ', r: ' + rName);
            return {teamName: tName, repoName: rName};
        } else {
            for (let count = 1; count < 30; count++) {
                const teamObj = await db.getTeam(tName + count);
                const repoObj = await db.getRepository(rName + count);
                if (teamObj === null && repoObj === null) {
                    Log.info('CS340Controller::computeNames( ... ) - done; t: ' + tName + count + ', r: ' + rName + count);
                    return {teamName: tName + count, repoName: rName + count};
                }
            }
            throw new Error("CS340Controller::computeNames( ... ) - names not available; t: " + tName + "; r: " + rName);
        }
    }

    public async handleUnknownUser(githubUsername: string): Promise<Person | null> {
        return super.handleUnknownUserDefault(githubUsername);
    }

    public handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): Promise<boolean> {
        return super.handleNewAutoTestGradeDefault(deliv, newGrade, existingGrade);
    }

}
