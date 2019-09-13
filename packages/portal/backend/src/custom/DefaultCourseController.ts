import Log from "../../../../common/Log";
import {CourseController} from "../controllers/CourseController";
import {IGitHubController} from "../controllers/GitHubController";
import {Deliverable, Person} from "../Types";

export class DefaultCourseController extends CourseController {

    constructor(ghController: IGitHubController) {
        Log.trace("DefaultCourseController::<init>");
        super(ghController);
    }

}
