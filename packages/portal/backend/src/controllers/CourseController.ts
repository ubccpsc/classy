import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {
    AutoTestGradeTransport,
    AutoTestResultSummaryTransport,
    CourseTransport,
    DeliverableTransport,
    GradeTransport,
    RepositoryTransport,
    StudentTransport,
    TeamTransport
} from '../../../../common/types/PortalTypes';
import {Course, Deliverable, Grade, Person} from "../Types";

import {DatabaseController} from "./DatabaseController";
import {DeliverablesController} from "./DeliverablesController";
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
 * (e.g., see SDMMController), or can have minimial implementations (e.g.,
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
     * NOTE: This is a synchronous API!
     *
     * @param {Deliverable} deliv
     * @param {Grade} newGrade
     * * @param {Grade} existingGrade
     * @returns {boolean} whether the grade should be saved.
     */
    handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): boolean;

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
    computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}>;
}

export class CourseController implements ICourseController {

    public static getName(): string | null {
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            if (name !== null) {
                return name;
            } else {
                Log.error("CourseController::getName() - ERROR: null name");
            }
        } catch (err) {
            Log.error("CourseController::getName() - ERROR: " + err.message);
        }
        return null;
    }

    protected dc = DatabaseController.getInstance();
    protected pc = new PersonController();
    protected rc = new RepositoryController();
    protected tc = new TeamController();
    protected gc = new GradesController();
    protected resC = new ResultsController();

    protected gh: IGitHubController = null;

    constructor(ghController: IGitHubController) {
        Log.trace("CourseController::<init> - start");
        this.gh = ghController;
    }

    /**
     * This endpoint just lets subclasses change the behaviour for when users are unknown.
     *
     * @param {string} githubUsername
     * @returns {Promise<Person | null>}
     */
    public async handleUnknownUser(githubUsername: string): Promise<Person | null> {
        Log.warn("CourseController::handleUnknownUser( " + githubUsername + " ) - person unknown; returning null");
        return null;
    }

    public handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): boolean {
        Log.warn("CourseController::handleUnknownUser( ... ) - returning true;");
        return true;
    }

    public async processNewAutoTestGrade(grade: AutoTestGradeTransport): Promise<boolean> {
        Log.info("CourseController::processNewAutoTestGrade( .. ) - start");

        try {
            Log.info("CourseController::processNewAutoTestGrade( .. ) - payload: " + JSON.stringify(grade));
            const repo = await this.rc.getRepository(grade.repoId);
            if (repo === null) {
                // sanity check
                Log.error("CourseController::processNewAutoTestGrade( .. ) - invalid repo name: " + grade.repoId);
                return false;
            }

            const peopleIds = await this.rc.getPeopleForRepo(grade.repoId);
            if (peopleIds.length < 1) {
                // sanity check
                Log.error("CourseController::processNewAutoTestGrade( .. ) - no people to associate grade record with.");
                return false;
            }

            const delivController = new DeliverablesController();
            const deliv = await delivController.getDeliverable(grade.delivId);

            for (const personId of peopleIds) {
                const newGrade: Grade = {
                    personId:  personId,
                    delivId:   grade.delivId,
                    score:     grade.score,
                    comment:   grade.comment,
                    urlName:   grade.urlName,
                    URL:       grade.URL,
                    timestamp: grade.timestamp,
                    custom:    grade.custom
                };

                const existingGrade = await this.gc.getGrade(personId, grade.delivId);
                const shouldSave = this.handleNewAutoTestGrade(deliv, newGrade, existingGrade);

                if (shouldSave === true) {
                    await this.gc.saveGrade(newGrade);
                }
            }
            return true;
        } catch (err) {
            Log.error("CourseController::processNewAutoTestGrade( .. ) - ERROR: " + err);
            return false;
        }
    }

    public async getCourse(): Promise<Course> {
        let record: Course = await this.dc.getCourseRecord();
        if (record === null) {
            // create default and write it
            record = {
                id:                   Config.getInstance().getProp(ConfigKey.name),
                defaultDeliverableId: null,
                custom:               {}
            };
            await this.dc.writeCourseRecord(record);
        }
        return record;
    }

    public async saveCourse(course: Course): Promise<boolean> {
        const record: Course = await this.dc.getCourseRecord();
        if (record !== null) {
            // merge the new with the old
            record.defaultDeliverableId = course.defaultDeliverableId;
            const custom = Object.assign({}, record.custom, course.custom); // merge custom properties
            record.custom = custom;
        }
        return await this.dc.writeCourseRecord(record);
    }

    /**
     * Gets the students associated with the course.
     *
     * @returns {Promise<StudentTransport[]>}
     */
    public async getStudents(): Promise<StudentTransport[]> {
        const people = await this.pc.getAllPeople();
        const students: StudentTransport[] = [];
        for (const person of people) {
            if (person.kind === 'student') {
                const studentTransport = {
                    id:         person.id,
                    firstName:  person.fName,
                    lastName:   person.lName,
                    githubId:   person.githubId,
                    userUrl:    Config.getInstance().getProp(ConfigKey.githubHost) + '/' + person.githubId,
                    studentNum: person.studentNumber,
                    labId:      person.labId
                };
                students.push(studentTransport);
            }
        }
        return students;
    }

    /**
     * Gets the teams associated with the course.
     *
     * @returns {Promise<TeamTransport[]>}
     */
    public async getTeams(): Promise<TeamTransport[]> {
        const allTeams = await this.tc.getAllTeams();
        const teams: TeamTransport[] = [];
        for (const team of allTeams) {
            const teamTransport: TeamTransport = {
                id:      team.id,
                delivId: team.delivId,
                people:  team.personIds,
                URL:     team.URL
            };
            teams.push(teamTransport);

        }
        return teams;
    }

    /**
     * Gets the repos associated with the course.
     *
     * @returns {Promise<RepositoryTransport[]>}
     */
    public async getRepositories(): Promise<RepositoryTransport[]> {
        const allRepos = await this.rc.getAllRepos();
        const repos: RepositoryTransport[] = [];
        for (const repo of allRepos) {
            const repoTransport: RepositoryTransport = {
                id:  repo.id,
                URL: repo.URL
            };
            repos.push(repoTransport);
        }
        return repos;
    }

    /**
     * Gets the grades associated with the course.
     *
     * @returns {Promise<GradeTransport[]>}
     */
    public async getGrades(): Promise<GradeTransport[]> {
        const allGrades = await this.gc.getAllGrades();
        const grades: GradeTransport[] = [];
        const pc = new PersonController();
        for (const grade of allGrades) {
            const p = await pc.getPerson(grade.personId); // TODO: slow action for just githubid
            const gradeTrans: GradeTransport = {
                personId:  grade.personId,
                personURL: Config.getInstance().getProp(ConfigKey.githubHost) + '/' + p.githubId,
                delivId:   grade.delivId,
                score:     grade.score,
                comment:   grade.comment,
                urlName:   grade.urlName,
                URL:       grade.URL,
                timestamp: grade.timestamp,
                custom:    grade.custom
            };
            grades.push(gradeTrans);
        }
        return grades;
    }

    /**
     * Gets the results associated with the course.
     * @param {reqDelivId: string} * for any
     * @param {reqRepoId: string} * for any
     * @returns {Promise<AutoTestGradeTransport[]>}
     */
    public async getResults(reqDelivId: string, reqRepoId: string): Promise<AutoTestResultSummaryTransport[]> {
        Log.info("CourseController::getResults( " + reqDelivId + ", " + reqRepoId + " ) - start");
        const NUM_RESULTS = 1000; // max # of records

        const allResults = await this.resC.getAllResults();
        const results: AutoTestResultSummaryTransport[] = [];
        for (const result of allResults) {
            // const repo = await rc.getRepository(result.repoId); // this happens a lot and ends up being too slow
            const delivId = result.delivId;
            const repoId = result.input.pushInfo.repoId;

            if ((reqDelivId === 'any' || delivId === reqDelivId) &&
                (reqRepoId === 'any' || repoId === reqRepoId) &&
                results.length <= NUM_RESULTS) {
                const repoURL = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
                    Config.getInstance().getProp(ConfigKey.org) + '/' + repoId;
                let scoreOverall = null;
                let scoreCover = null;
                let scoreTest = null;

                if (typeof result.output !== 'undefined' && typeof result.output.report !== 'undefined') {
                    const report = result.output.report;
                    if (typeof report.scoreOverall !== 'undefined') {
                        scoreOverall = report.scoreOverall;
                    }
                    if (typeof report.scoreTest !== 'undefined') {
                        scoreTest = report.scoreTest;
                    }
                    if (typeof report.scoreCover !== 'undefined') {
                        scoreCover = report.scoreCover;
                    }
                }

                const resultTrans: AutoTestResultSummaryTransport = {
                    repoId:       repoId,
                    repoURL:      repoURL,
                    delivId:      result.delivId,
                    state:        result.output.state,
                    timestamp:    result.output.timestamp,
                    commitSHA:    result.input.pushInfo.commitSHA,
                    commitURL:    result.input.pushInfo.commitURL,
                    scoreOverall: scoreOverall,
                    scoreCover:   scoreCover,
                    scoreTests:   scoreTest
                };
                results.push(resultTrans);
            } else {
                // result does not match filter
            }
        }
        Log.trace("CourseController::getResults(..) - # results: " + results.length);
        return results;
    }

    /**
     * Gets the deliverables associated with the course.
     *
     * @returns {Promise<DeliverableTransport[]>}
     */
    public async getDeliverables(): Promise<DeliverableTransport[]> {
        const deliverables = await this.dc.getDeliverables();

        let delivs: DeliverableTransport[] = [];
        for (const deliv of deliverables) {

            const delivTransport = DeliverablesController.deliverableToTransport(deliv);

            delivs.push(delivTransport);
        }

        delivs = delivs.sort(function(d1: DeliverableTransport, d2: DeliverableTransport) {
            return d1.id.localeCompare(d2.id);
        });

        return delivs;
    }

    /**
     * Validates the CourseTransport object.
     *
     * @param {CourseTransport} courseTrans
     * @returns {string | null} null if objct is valid; string description of error if not.
     */
    public static validateCourseTransport(courseTrans: CourseTransport): string | null {
        if (typeof courseTrans === 'undefined' || courseTrans === null) {
            const msg = 'Course not populated.';
            Log.error('CourseController::validateCourseTransport(..) - ERROR: ' + msg);
            throw new Error(msg);
        }

        // noinspection SuspiciousTypeOfGuard
        if (typeof courseTrans.id !== 'string') {
            const msg = 'Course.id not specified';
            Log.error('CourseController::validateCourseTransport(..) - ERROR: ' + msg);
            throw new Error(msg);
        }

        // noinspection SuspiciousTypeOfGuard
        if (typeof courseTrans.defaultDeliverableId !== 'string') {
            const msg = 'defaultDeliverableId not specified';
            Log.error('CourseController::validateCourseTransport(..) - ERROR: ' + msg);
            return msg;
        }

        // noinspection SuspiciousTypeOfGuard
        if (typeof courseTrans.custom !== 'object') {
            const msg = 'custom not specified';
            Log.error('CourseController::validateCourseTransport(..) - ERROR: ' + msg);
            return msg;
        }

        return null;
    }

    public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}> {
        Log.info("CourseController::computeNames(..) - start; # people: " + people.length);
        const repos = await this.dc.getRepositories();

        // the repo name and the team name should be the same, so just use the repo name
        let repoCount = 0;
        for (const repo of repos) {
            if (repo.id.startsWith(deliv.repoPrefix)) {
                repoCount++;
            }
        }
        let repoName = '';
        let teamName = '';

        let ready = false;
        while (!ready) {
            repoName = deliv.repoPrefix + '_' + repoCount;
            teamName = deliv.teamPrefix + '_' + repoCount;
            const r = await this.dc.getRepository(repoName);
            const t = await this.dc.getTeam(teamName);
            if (r === null && t === null) {
                ready = true;
            } else {
                Log.warn("CourseController::computeNames(..) - name not available; r: " + repoName + "; t: " + teamName);
                repoCount++; // try the next one
            }
        }
        Log.info("CourseController::computeNames(..) - done; r: " + repoName + "; t: " + teamName);
        return {teamName: teamName, repoName: repoName};
    }

}
