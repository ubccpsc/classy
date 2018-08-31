import {CourseController} from "../CourseController";
import {Deliverable, Person} from "../../Types";
import Log from "../../../../../common/Log";
import {DatabaseController} from "../DatabaseController";
import {IGitHubController} from "../GitHubController";


export class CS340Controller extends CourseController {

    public constructor(ghController: IGitHubController) {
        super(ghController);
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

        if(deliv.repoPrefix.trim() === "") {
            rName = deliv.id + postfix;
        } else {
            rName = deliv.repoPrefix + postfix;
        }

        if(deliv.teamPrefix.trim() === "") {
            tName = deliv.id + postfix;
        } else {
            tName = deliv.teamPrefix + postfix;
        }



        const db = DatabaseController.getInstance();
        const team = await db.getTeam(tName);
        const repo = await db.getRepository(rName);

        if (team === null && repo === null) {
            Log.info('CS340Controller::computeNames( ... ) - done; t: ' + tName + ', r: ' + rName);
            return {teamName: tName, repoName: rName};
        } else {
            for(let count = 1; count < 30; count++) {
                const team = await db.getTeam(tName + count);
                const repo = await db.getRepository(rName + count);
                if(team === null && repo === null) {
                    Log.info('CS340Controller::computeNames( ... ) - done; t: ' + tName + count + ', r: ' + rName + count);
                    return {teamName: tName + count, repoName: rName + count};
                }
            }

            throw new Error("CS340Controller::computeNames( ... ) - names not available; t: " + tName + "; r: " + rName);
        }
    }

}
