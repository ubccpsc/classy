import Log from "../../../../common/Log";
import {Deliverable, Grade, Person} from "../Types";

import {DatabaseController} from "./DatabaseController";
import {IGitHubController} from "./GitHubController";
import {GradesController} from "./GradesController";
import {PersonController} from "./PersonController";
import {RepositoryController} from "./RepositoryController";
import {ResultsController} from "./ResultsController";
import {TeamController} from "./TeamController";

/**
 * This interface defines the extension points that courses will want to
 * customize based on their own preferences and needs. Courses should not
 * implement this interface but should instead extend CourseController.
 *
 * Courses can also of course add their own methods to their custom subclass
 * (e.g., see CustomCourseController), or can have minimal implementations (e.g.,
 * see CS310Controller).
 */
export interface ICourseController {

    /**
     * Given a GitHub username that is not already in the system, how should it be
     * handled? There are two main options here: return null (aka only accept registered
     * users) or create and save a new Person and return them.
     *
     * @param {string} githubUsername
     * @returns {Promise<Person | null>}
     */
    handleUnknownUser(githubUsername: string): Promise<Person | null>;

    /**
     * Given a new Grade and existing Grade for a deliverable, should the new grade be
     * saved? The Deliverable is included in case due dates want to be considered. The
     * Grade timestamp is the timestamp of the GitHub push event, not the commit event,
     * as this is the only time we can guarantee was not tampered with on the client side.
     * This will be called once-per-teammember if there are multiple people on the repo
     * receiving the grade.
     *
     * @param {Deliverable} deliv
     * @param {Grade} newGrade
     * * @param {Grade} existingGrade
     * @returns {boolean} whether the grade should be saved.
     */
    handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): Promise<boolean>;

    /**
     * Determine how to name teams and repos for a deliverable. Should only be called
     * before the team or repo is provisioned. Courses should be careful about how they
     * call this. e.g., some courses use team_1, team_2 which will require the team to
     * be created after a call and before computeNames is called again.
     *
     * @param {Deliverable} deliv
     * @param {Person[]} people
     * @returns {{teamName: string | null; repoName: string | null}}
     */
    computeNames(deliv: Deliverable, people: Person[], adminOverride?: boolean):
        Promise<{teamName: string | null; repoName: string | null}>;
}

/**
 * This is a default course controller for courses that do not want to do anything unusual.
 */
export class CourseController implements ICourseController {

    protected dbc = DatabaseController.getInstance();
    protected pc = new PersonController();
    protected rc = new RepositoryController();
    protected tc = new TeamController();
    protected gc = new GradesController();
    protected resC = new ResultsController();

    protected gh: IGitHubController = null;

    constructor(ghController: IGitHubController) {
        Log.trace("CourseController::<init>");
        this.gh = ghController;
    }

    /**
     * This endpoint just lets subclasses change the behaviour for when users are unknown.
     *
     * The default behaviour (returning null) effecively disallows any non-registered student,
     * although any user registered on the GitHub admin or staff team will bypass this.
     *
     * @param {string} githubUsername
     * @returns {Promise<Person | null>}
     */
    public async handleUnknownUser(githubUsername: string): Promise<Person | null> {
        Log.warn("CourseController::handleUnknownUser( " + githubUsername + " ) - person unknown; returning null");
        return null;
    }

    /**
     * Default behaviour is that if the deadline has not passed, and the grade is higher, accept it.
     *
     * @param {Deliverable} deliv
     * @param {Grade} newGrade
     * @param {Grade} existingGrade
     * @returns {boolean}
     */
    public handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): Promise<boolean> {
        const LOGPRE = "CourseController::handleNewAutoTestGrade( " + deliv.id + ", " +
            newGrade.personId + ", " + newGrade.score + ", ... ) - URL: " + newGrade.URL + " - ";

        Log.info(LOGPRE + "start");

        if (newGrade.timestamp < deliv.openTimestamp) {
            // too early
            Log.info(LOGPRE + "not recorded; deliverable not yet open");
            return Promise.resolve(false);
        }

        if (newGrade.timestamp > deliv.closeTimestamp) {
            // too late
            Log.info(LOGPRE + "not recorded; deliverable closed");
            return Promise.resolve(false);
        }

        // >= on purpose so 'last highest' is used
        const gradeIsLarger = (existingGrade === null || newGrade.score >= existingGrade.score);

        if (gradeIsLarger === true) {
            Log.info(LOGPRE + "recorded; deliv open and grade increased");
            return Promise.resolve(true);
        } else {
            Log.info(LOGPRE + "not recorded; deliverable open but grade not increased");
            return Promise.resolve(false);
        }
    }

    public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null; repoName: string | null}> {
        if (deliv === null) {
            throw new Error("CourseController::computeNames( ... ) - null Deliverable");
        }

        Log.info('CourseController::computeNames( ' + deliv.id + ', ... ) - start');
        if (people.length < 1) {
            throw new Error("CourseController::computeNames( ... ) - must provide people");
        }

        // sort people alph by their id
        people = people.sort(function compare(p1: Person, p2: Person) {
                return p1.id.localeCompare(p2.id);
            }
        );

        let postfix = '';
        for (const person of people) {
            // NOTE: use CSID here to be more resilient if CWLs change
            // TODO: this would be even better if it was person.id
            postfix = postfix + '_' + person.csId;
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
            Log.info('CourseController::computeNames( ... ) - done; t: ' + tName); // + ', r: ' + rName);
            return {teamName: tName, repoName: rName};
            // return tName;
        } else {
            // TODO: should really verify that the existing teams contain the right people already
            return {teamName: tName, repoName: rName};
            // return tName;
        }
    }

    // NOTE: the default implementation is currently broken; do not use it.
    /**
     * This is a method that subtypes can call from computeNames if they do not want to implement it themselves.
     *
     * @param {Deliverable} deliv
     * @param {Person[]} people
     * @returns {Promise<{teamName: string | null; repoName: string | null}>}
     */
    // public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}> {
    //     Log.info("AdminController::computeNames(..) - start; # people: " + people.length);
    //
    //     // TODO: this code has a fatal flaw; if the team/repo exists already for the specified people,
    //     // it is correct to return those.
    //
    //     let repoPrefix = '';
    //     if (deliv.repoPrefix.length > 0) {
    //         repoPrefix = deliv.repoPrefix;
    //     } else {
    //         repoPrefix = deliv.id;
    //     }
    //
    //     let teamPrefix = '';
    //     if (deliv.teamPrefix.length > 0) {
    //         teamPrefix = deliv.teamPrefix;
    //     } else {
    //         teamPrefix = deliv.id;
    //     }
    //     // the repo name and the team name should be the same, so just use the repo name
    //     const repos = await this.dbc.getRepositories();
    //     let repoCount = 0;
    //     for (const repo of repos) {
    //         if (repo.id.startsWith(repoPrefix)) {
    //             repoCount++;
    //         }
    //     }
    //     let repoName = '';
    //     let teamName = '';
    //
    //     let ready = false;
    //     while (!ready) {
    //         repoName = repoPrefix + '_' + repoCount;
    //         teamName = teamPrefix + '_' + repoCount;
    //         const r = await this.dbc.getRepository(repoName);
    //         const t = await this.dbc.getTeam(teamName);
    //         if (r === null && t === null) {
    //             ready = true;
    //         } else {
    //             Log.warn("AdminController::computeNames(..) - name not available; r: " + repoName + "; t: " + teamName);
    //             repoCount++; // try the next one
    //         }
    //     }
    //     Log.info("AdminController::computeNames(..) - done; r: " + repoName + "; t: " + teamName);
    //     return {teamName: teamName, repoName: repoName};
    // }

    // public static validateProvisionTransport(obj: ProvisionTransport) {
    //     if (typeof obj === 'undefined' || obj === null) {
    //         const msg = 'Transport not populated.';
    //         Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
    //         throw new Error(msg);
    //     }
    //
    //     // noinspection SuspiciousTypeOfGuard
    //     if (typeof obj.delivId !== 'string') {
    //         const msg = 'Provision.id not specified';
    //         Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
    //         throw new Error(msg);
    //     }
    //
    //     // noinspection SuspiciousTypeOfGuard
    //     if (typeof obj.formSingle !== 'boolean') {
    //         const msg = 'formSingle not specified';
    //         Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
    //         return msg;
    //     }
    //
    //     // const dc = new DeliverablesController();
    //     // const deliv = await dc.getDeliverable(obj.delivId);
    //     // if (deliv === null && deliv.shouldProvision === true){
    //     //     const msg = 'delivId does not correspond to a real deliverable or that deliverable is not provisionable';
    //     //     Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
    //     //     return msg;
    //     // }
    //
    //     return null;
    // }
}
