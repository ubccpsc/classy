import Log from "../../../../common/Log";

import {CourseController} from "../controllers/CourseController";
import {IGitHubController} from "../controllers/GitHubController";

export class CustomCourseController extends CourseController {

    constructor(ghController: IGitHubController) {
        Log.trace("CustomCourseController::<init>");
        super(ghController);
    }
}
