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
            rName = deliv.repoPrefix + postfix;
        } else {
            rName = deliv.repoPrefix + postfix;
        }

        if(deliv.teamPrefix.trim() === "") {
            tName = deliv.teamPrefix + postfix;
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
            throw new Error("CS340Controller::computeNames( ... ) - names not available; t: " + tName + "; r: " + rName);
        }
    }

}
