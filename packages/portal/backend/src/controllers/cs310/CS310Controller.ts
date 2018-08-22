import Log from "../../../../../common/Log";
import {Deliverable, Grade, Person} from "../../Types";
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

    /**
     * Students get their highest grade before the deadline.
     *
     * If the newGrade.score > existingGrade.score and the deadline has not passed, return true.
     *
     * @param {Deliverable} deliv
     * @param {Grade} newGrade
     * @param {Grade} existingGrade
     * @returns {boolean}
     */
    public handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): boolean {
        Log.info("CS310Controller:handleNewAutoTestGrade( " + deliv.id + ", " +
            newGrade.personId + ", " + newGrade.score + ", ... ) - start");
        if ((existingGrade === null || newGrade.score > existingGrade.score) && newGrade.timestamp < deliv.closeTimestamp) {
            Log.trace("CS310Controller:handleNewAutoTestGrade( " + deliv.id + ", " +
                newGrade.personId + ", " + newGrade.score + ", ... ) - returning true");
            return true;
        } else {
            Log.trace("CS310Controller:handleNewAutoTestGrade( " + deliv.id + ", " +
                newGrade.personId + ", " + newGrade.score + ", ... ) - returning false");
            return false;
        }
    }

}
