import Config, {ConfigCourses, ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {AutoTestGradeTransport, DeliverableTransport, StudentTransport} from '../../../common/types/PortalTypes';

import {RepositoryController} from "./RepositoryController";
import {DatabaseController} from "./DatabaseController";
import {GradesController} from "./GradesController";
import {Course, Deliverable, Grade, Person} from "../Types";
import {IGitHubController} from "./GitHubController";
import {TeamController} from "./TeamController";
import {PersonController} from "./PersonController";

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
     *
     * TODO: Convert Deliverable to DeliverableTransport
     *
     * Get all the deliverables for the course.
     *
     * @returns {Promise<Deliverable[]>}
     */
    getDeliverables(): Promise<Deliverable[]>;

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

    /**
     * Gets the deliverables associated with the course.
     *
     * @returns {Promise<DeliverableTransport[]>}
     */
    getDeliverables(): Promise<DeliverableTransport[]>;
}

export class CourseController { // don't implement ICourseController yet

    protected dc = DatabaseController.getInstance();
    protected pc = new PersonController();
    protected rc = new RepositoryController();
    protected tc = new TeamController();
    protected gc = new GradesController();
    protected gh: IGitHubController = null;

    constructor(ghController: IGitHubController) {
        Log.trace("CourseController::<init> - start");
        this.gh = ghController;
    }

    public async handleUnknownUser(githubUsername: string): Promise<Person | null> {
        Log.info("CourseController::handleUnknownUser( " + githubUsername + " ) - person unknown; returning null");

        return null;
    }

    public async handleNewAutoTestGrade(grade: AutoTestGradeTransport): Promise<boolean> {
        Log.info("CourseController::handleNewGrade( .. ) - start");

        try {
            let repo = await this.rc.getRepository(grade.repoId); // sanity check
            if (repo === null) {
                Log.error("CourseController::handleNewGrade( .. ) - invalid repo name: " + grade.repoId);
                return false;
            }

            let peopleIds = await this.rc.getPeopleForRepo(grade.repoId); // sanity check
            if (peopleIds.length < 1) {
                Log.error("CourseController::handleNewGrade( .. ) - no people to associate grade record with.");
                return false;
            }

            for (const personId of peopleIds) {
                let existingGrade = await this.gc.getGrade(personId, grade.delivId);
                if (existingGrade === null || existingGrade.score < grade.score) {
                    Log.info("CourseController::handleNewGrade( .. ) - grade is higher; updating");
                    this.gc.createGrade(grade.repoId, grade.delivId, grade);
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

    /**
     * Public static so tests can use them too.
     *
     * @returns {string}
     */
    public static getProjectPrefix(): string {
        const name = Config.getInstance().getProp(ConfigKey.name);
        if (name === ConfigCourses.classytest) {
            Log.info("CourseController::getProjectPrefix(..) - returning test prefix");
            return "TEST__X__secap_";
        } else {
            return "secap_";
        }
    }

    /**
     * Public static so tests can use them too.
     *
     * @returns {string}
     */
    public static getTeamPrefix() {
        const name = Config.getInstance().getProp(ConfigKey.name);

        if (name === ConfigCourses.classytest) {
            Log.info("CourseController::getTeamPrefix(..) - returning test prefix");
            return "TEST__X__t_";
        } else {
            return "t_";
        }
    }

    // public static getOrg(): string | null {
    //     try {
    //         const org = Config.getInstance().getProp(ConfigKey.org); // valid .org usage
    //         if (org !== null) {
    //             return org;
    //         } else {
    //             Log.error("CourseController::getOrg() - ERROR: null org");
    //         }
    //     } catch (err) {
    //         Log.error("CourseController::getOrg() - ERROR: " + err.message);
    //     }
    //     return null;
    // }

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
        let record: Course = await this.dc.getCourseRecord();
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
        let people = await this.pc.getAllPeople();
        let students: StudentTransport[] = [];
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
     * Gets the deliverables associated with the course.
     *
     * @returns {Promise<DeliverableTransport[]>}
     */
    public async getDeliverables(): Promise<DeliverableTransport[]> {
        let deliverables = await this.dc.getDeliverables();

        let delivs: DeliverableTransport[] = [];
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


}
