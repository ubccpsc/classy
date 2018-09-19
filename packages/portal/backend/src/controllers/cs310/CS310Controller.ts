import Log from "../../../../../common/Log";
import {Deliverable, Grade, Person} from "../../Types";
import {CourseController} from "../CourseController";
import {DatabaseController} from "../DatabaseController";
import {IGitHubController} from "../GitHubController";

export class CS310Controller extends CourseController {

    private readonly PROJD0 = 'd0';
    private readonly PROJD1 = 'd1';
    private readonly PROJD2 = 'd2';
    private readonly PROJD3 = 'd3';
    private readonly PROJD4 = 'd4';
    private readonly PROJ = 'proj';  // TECHDEBT: 310; should be 'project'

    public constructor(ghController: IGitHubController) {
        super(ghController);
        Log.info("CS310Controller::<init>");
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
    public async handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): Promise<boolean> {
        // just use the default implementation
        let updateGrade = await super.handleNewAutoTestGradeDefault(deliv, newGrade, existingGrade);
        Log.info("CS310Controller::handleNewAutoTestGrade(..) - pId: " + newGrade.personId +
            "; delivId: " + deliv.id + "; higher? " + updateGrade);

        // handlenewAutoTestGradeDefault checks deliverable deadline
        // but after grades are released the deadline might be extended, so this allows for that
        if (deliv.gradesReleased === true) {
            // drop updates if grades have been released
            // could use closeTimetamp, but this lets us run the deliverables for the whole term
            // once the grades have been released

            Log.info("CS310Controller::handleNewAutoTestGrade(..) - pId: " + newGrade.personId +
                "; delivId: " + deliv.id + "; grades released - not saving");

            updateGrade = false;
        }

        if (updateGrade === true) {
            // consider updating overall project grade here?
            const personId = newGrade.personId;

            let d0Score = await this.getScore(this.PROJD0, personId);
            let d1Score = await this.getScore(this.PROJD1, personId);
            let d2Score = await this.getScore(this.PROJD2, personId);
            let d3Score = await this.getScore(this.PROJD3, personId);
            let d4Score = await this.getScore(this.PROJD4, personId);

            // this whole block is awkward because the new grade hasn't been written yet
            // if we try to get it, we'll get the old one
            if (deliv.id === this.PROJD0) {
                d0Score = newGrade.score;
            }
            if (deliv.id === this.PROJD1) {
                d1Score = newGrade.score;
            }
            if (deliv.id === this.PROJD2) {
                d2Score = newGrade.score;
            }
            if (deliv.id === this.PROJD3) {
                d3Score = newGrade.score;
            }
            if (deliv.id === this.PROJD4) {
                d4Score = newGrade.score;
            }
            const projectScore = (d0Score + d1Score + d2Score + d3Score + d4Score) / 4; // 25% of project score each
            const pGrade: Grade = {
                personId:  personId,
                delivId:   this.PROJ,
                score:     projectScore,
                comment:   '',
                timestamp: Date.now(),
                urlName:   null,
                URL:       null,
                custom:    {}

            };
            Log.trace("CS310Controller::handleNewAutoTestGrade(..) - pId: " + personId + "; new project score: " + projectScore);
            await this.gc.saveGrade(pGrade);
        }
        return updateGrade;
    }

    /**
     * Returns the grade or 0 if there is not one saved yet.
     *
     * @param {string} delivId
     * @param {string} personId
     * @returns {Promise<number>}
     */
    private async getScore(delivId: string, personId: string): Promise<number> {
        const grade = await this.gc.getGrade(personId, delivId);
        let score = 0;
        if (grade === null || typeof grade.score === 'undefined' || grade.score === null || grade.score < 0) {
            score = 0;
        } else {
            score = grade.score;
        }
        return score;
    }

    public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}> {
        Log.info('CS310Controller::computeNames( ' + deliv.id + ', ... ) - start');

        if (people.length < 1) {
            throw new Error("CS310Controller::computeNames( ... ) - must provide people");
        }

        // sort people alph by their id
        people = people.sort(function compare(p1: Person, p2: Person) {
                return p1.id.localeCompare(p2.id);
            }
        );

        let postfix = '';
        for (const person of people) {
            postfix = postfix + '_' + person.githubId;
        }

        let tName = '';
        if (deliv.teamPrefix.length > 0) {
            tName = deliv.teamPrefix + '_' + deliv.id + postfix;
        } else {
            tName = deliv.id + postfix;
        }

        let rName = '';
        if (deliv.repoPrefix.length > 0) {
            rName = deliv.repoPrefix + '_' + deliv.id + postfix;
        } else {
            rName = deliv.id + postfix;
        }

        const db = DatabaseController.getInstance();
        const team = await db.getTeam(tName);
        const repo = await db.getRepository(rName);

        if (team === null && repo === null) {
            Log.info('CS310Controller::computeNames( ... ) - done; t: ' + tName + ', r: ' + rName);
            return {teamName: tName, repoName: rName};
        } else {
            // TODO: should really verify that the existing teams contain the right people already
            return {teamName: tName, repoName: rName};
            // throw new Error("CS310Controller::computeNames( ... ) - names not available; t: " + tName + "; r: " + rName);
        }
    }

}
