import Log from "../../../packages/common/Log";
import {CourseController} from "../../../packages/portal/backend/src/controllers/CourseController";
import {IGitHubController} from "../../../packages/portal/backend/src/controllers/GitHubController";
import {Deliverable, Person} from "../../../packages/portal/backend/src/Types";

export class DefaultCourseController extends CourseController {

    constructor(ghController: IGitHubController) {
        Log.trace("DefaultCourseController::<init>");
        super(ghController);
    }

}
