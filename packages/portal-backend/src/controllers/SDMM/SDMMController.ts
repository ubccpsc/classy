import {CourseController} from "../CourseController";
import {IGitHubController} from "../GitHubController";

export class SDMMController extends CourseController {

    public constructor(ghController: IGitHubController) {
        super(ghController);
    }
}