import {CourseController} from "@backend/controllers/CourseController";
import {IGitHubController} from "@backend/controllers/GitHubController";
import {Deliverable, Person} from "@backend/Types";
import Log from "@common/Log";
export class DefaultCourseController extends CourseController {

    constructor(ghController: IGitHubController) {
        Log.trace("DefaultCourseController::<init>");
        super(ghController);
    }

}
