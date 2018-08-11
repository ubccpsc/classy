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
import {IGitHubController} from "./GitHubController";
import {GradesController} from "./GradesController";
import {PersonController} from "./PersonController";
import {RepositoryController} from "./RepositoryController";
import {ResultsController} from "./ResultsController";
import {TeamController} from "./TeamController";

/**
 * This is the high-level interfaces that provides intermediate access to the
 * low-level controllers for the REST interfaces. This interface ensures that
 * the REST subsystem never sends backend representations to the front-end.
 *
 * This separation ensures that front-ends only work with primitive types encoded
 * in transport representations, rather than the database types. This gives us
 * much greater flexibility for upgrading the backend without changing any frontend
 * code.
 *
 * Implementations which violate this separation do so at their own peril.
 *
 * Custom CourseControllers should not implement this directly, they probably
 * want tot extend CourseController instead.
 */
export interface ICourseController {

    /**
     *
     * TODO: Convert Person to PersonTransport
     *
     * Gets the person associated with the username.
     *
     * @param {string} githubUsername
     * @returns {Promise<Person | null>} Returns null if the username is unknown in the course.
     */
    getPerson(githubUsername: string): Promise<Person | null>;

    /**
     *
     * TODO: Convert Person to PersonTransport
     *
     * Sets the people for the course. Usually populated with classlist (or some such).
     *
     * @param {Person[]} people
     * @returns {Promise<boolean>}
     */
    setPeople(people: Person[]): Promise<boolean>;

    /**
     * Gets the deliverables associated with the course.
     *
     * @returns {Promise<DeliverableTransport[]>}
     */
    getDeliverables(): Promise<DeliverableTransport[]>;

    /**
     *
     * TODO: convert Deliverable to DeliverableTransport
     *
     * Sets the deliverables for the course. Will replace deliverables that have the same
     * Deliverable.id, otherwise it will create new ones.
     *
     * Will _not_ delete any deliverables.
     *
     * @param {Deliverable[]} deliverables
     * @returns {Promise<boolean>}
     */
    setDeliverables(deliverables: Deliverable[]): Promise<boolean>;

    /**
     *
     * TODO: Convert Person to PersonTransport and Grade to GradeTransport
     *
     * If no Person is provided, gets all grades for a course.
     * If a Person is provided, gets all grades for only that person.
     *
     * @param {Person} person
     * @returns {Promise<Grade[]>}
     */
    getGrades(person?: Person): Promise<Grade[]>;

    /**
     *
     * TODO: convert Grade to GradeTransport
     *
     * Sets the grades for a course. Any grade that already exists in the system with the
     * same Grade.personId && Grade.delivId will be replaced; new records will be added.
     *
     * Will _not_ delete any existing grades.
     *
     * @param {Grade[]} grades
     * @returns {Promise<boolean>}
     */
    setGrades(grades: Grade[]): Promise<boolean>;

    /**
     * Gets the students associated with the course.
     *
     * @returns {Promise<StudentTransport[]>}
     */
    getStudents(): Promise<StudentTransport[]>;

}

export class CourseController { // don't implement ICourseController yet

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
        Log.info("CourseController::handleUnknownUser( " + githubUsername + " ) - person unknown; returning null");

        return null;
    }

    public async handleNewAutoTestGrade(grade: AutoTestGradeTransport): Promise<boolean> {
        Log.info("CourseController::handleNewGrade( .. ) - start");

        try {
            const repo = await this.rc.getRepository(grade.repoId); // sanity check
            if (repo === null) {
                Log.error("CourseController::handleNewGrade( .. ) - invalid repo name: " + grade.repoId);
                return false;
            }

            const peopleIds = await this.rc.getPeopleForRepo(grade.repoId); // sanity check
            if (peopleIds.length < 1) {
                Log.error("CourseController::handleNewGrade( .. ) - no people to associate grade record with.");
                return false;
            }

            for (const personId of peopleIds) {
                const existingGrade = await this.gc.getGrade(personId, grade.delivId);
                if (existingGrade === null || existingGrade.score < grade.score) {
                    Log.info("CourseController::handleNewGrade( .. ) - grade is higher; updating");
                    await this.gc.createGrade(grade.repoId, grade.delivId, grade);
                } else {
                    Log.info("CourseController::handleNewGrade( .. ) - grade is not higher");
                }
            }
            return true;
        } catch (err) {
            Log.error("CourseController::handleNewGrade( .. ) - ERROR: " + err);
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
                    firstName:  person.fName,
                    lastName:   person.lName,
                    userName:   person.githubId,
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
        for (const grade of allGrades) {
            const gradeTrans: GradeTransport = {
                personId:  grade.personId,
                personURL: Config.getInstance().getProp(ConfigKey.githubHost) + '/' + grade.personId,
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

        const NUM_RESULTS = 200;

        const allResults = await this.resC.getAllResults();
        const results: AutoTestResultSummaryTransport[] = [];
        for (const result of allResults) {
            // const repo = await rc.getRepository(result.repoId); // this happens a lot and ends up being too slow
            const delivId = result.delivId;
            const repoId = result.input.pushInfo.repoId;

            if ((delivId === '*' || delivId === reqDelivId) &&
                (repoId === '*' || repoId === reqRepoId) &&
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
        return results;
    }

    /**
     * Gets the deliverables associated with the course.
     *
     * @returns {Promise<DeliverableTransport[]>}
     */
    public async getDeliverables(): Promise<DeliverableTransport[]> {
        const deliverables = await this.dc.getDeliverables();

        const delivs: DeliverableTransport[] = [];
        for (const deliv of deliverables) {

            const delivTransport: DeliverableTransport = {
                id:  deliv.id,
                URL: deliv.URL,

                openTimestamp:  deliv.openTimestamp,
                closeTimestamp: deliv.closeTimestamp,

                minTeamSize:       deliv.teamMinSize,
                maxTeamSize:       deliv.teamMaxSize,
                teamsSameLab:      deliv.teamSameLab,
                studentsFormTeams: deliv.teamStudentsForm,

                onOpenAction:  '',
                onCloseAction: '',

                gradesReleased: deliv.gradesReleased,

                autoTest: deliv.autotest,
                custom:   deliv.custom
            };

            delivs.push(delivTransport);
        }

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
}
