import Log from "../../../../common/Log";
import {CourseController} from "../controllers/CourseController";
import {IGitHubController} from "../controllers/GitHubController";
import {Deliverable, Person} from "../Types";

export class DefaultCourseController extends CourseController {

    constructor(ghController: IGitHubController) {
        Log.trace("DefaultCourseController::<init>");
        super(ghController);
    }

    public async computeNames(deliv: Deliverable, people: Person[]): Promise<string> {
        Log.info("DefaultCourseController::computeNames() - passing up to CourseController");
        return super.computeNames(deliv, people);
    }

}
