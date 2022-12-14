import {CourseController} from "@backend/controllers/CourseController";
import {IGitHubController} from "@backend/controllers/GitHubController";

import Log from "@common/Log";

export class DefaultCourseController extends CourseController {

    constructor(ghController: IGitHubController) {
        Log.info("DefaultCourseController::<init>");
        super(ghController);
    }

}
