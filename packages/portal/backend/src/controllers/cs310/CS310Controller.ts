import Log from "../../../../../common/Log";
import {Person} from "../../Types";
import {CourseController} from "../CourseController";
import {IGitHubController} from "../GitHubController";

export class CS310Controller extends CourseController {

    public constructor(ghController: IGitHubController) {
        super(ghController);
    }

    public async handleUnknownUser(githubUsername: string): Promise<Person | null> {
        Log.info("CS310Controller:handleUnknownUser( " + githubUsername + " ) - returning null");
        return null;
    }

}
