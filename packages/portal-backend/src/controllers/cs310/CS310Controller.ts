import {CourseController} from "../CourseController";
import {IGitHubController} from "../GitHubController";
import {Person} from "../../Types";

import Log from "../../../../common/Log";
import Config, {ConfigKey} from "../../../../common/Config";

export class CS310Controller extends CourseController {

    public constructor(ghController: IGitHubController) {
        super(ghController);
    }

    public async handleUnknownUser(githubUsername: string): Promise<Person | null> {
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("CS310Controller:handleUnknownUser( " + org + ", " + githubUsername + " ) - returning null");
        return null;
    }

}