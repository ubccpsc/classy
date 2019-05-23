import Log from "../../../../common/Log";
import {CourseController} from "../controllers/CourseController";
import {IGitHubController} from "../controllers/GitHubController";

export class CustomCourseController extends CourseController {

    // Does not do anything right now, just here so we know where to make course-specific changes to CourseController

    public constructor(ghController: IGitHubController) {
        super(ghController);
        Log.info("CustomCourseController::<init>");
    }

}
