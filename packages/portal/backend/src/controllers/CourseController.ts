import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {
    AutoTestDashboardTransport,
    AutoTestGradeTransport,
    AutoTestResultSummaryTransport,
    CourseTransport,
    DeliverableTransport,
    GradeTransport,
    ProvisionTransport,
    RepositoryTransport,
    StudentTransport,
    TeamTransport
} from '../../../../common/types/PortalTypes';
import Util from "../../../../common/Util";
import {AuditLabel, Course, Deliverable, Grade, Person, PersonKind, Repository, Result, Team} from "../Types";

import {DatabaseController} from "./DatabaseController";
import {DeliverablesController} from "./DeliverablesController";
import {GitHubActions} from "./GitHubActions";
import {GitHubController, IGitHubController} from "./GitHubController";
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
    computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}>;
}

export abstract class CourseController implements ICourseController {

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

    // public abstract async handleUnknownUser(githubUsername: string): Promise<Person | null>;

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

    // public abstract handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): Promise<boolean>;

    /**
     * Default behaviour is that if the deadline has not passed, and the grade is higher, accept it.
     *
     * @param {Deliverable} deliv
     * @param {Grade} newGrade
     * @param {Grade} existingGrade
     * @returns {boolean}
     */
    public handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): Promise<boolean> {
        Log.info("CourseController:handleNewAutoTestGrade( " + deliv.id + ", " +
            newGrade.personId + ", " + newGrade.score + ", ... ) - start");
        if ((existingGrade === null || newGrade.score > existingGrade.score) && newGrade.timestamp < deliv.closeTimestamp) {
            Log.trace("CourseController:handleNewAutoTestGrade( " + deliv.id + ", " +
                newGrade.personId + ", " + newGrade.score + ", ... ) - returning true");
            return Promise.resolve(true);
        } else {
            Log.trace("CourseController:handleNewAutoTestGrade( " + deliv.id + ", " +
                newGrade.personId + ", " + newGrade.score + ", ... ) - returning false");
            return Promise.resolve(false);
        }
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
                const shouldSave = await this.handleNewAutoTestGrade(deliv, newGrade, existingGrade);

                if (shouldSave === true) {
                    await this.dbc.writeAudit(AuditLabel.GRADE_AUTOTEST, 'AutoTest',
                        existingGrade, newGrade, {repoId: grade.repoId});
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
        let record: Course = await this.dbc.getCourseRecord();
        if (record === null) {
            // create default and write it
            record = {
                id:                   Config.getInstance().getProp(ConfigKey.name),
                defaultDeliverableId: null,
                custom:               {}
            };
            await this.dbc.writeCourseRecord(record);
        }
        return record;
    }

    public async saveCourse(course: Course): Promise<boolean> {
        const record: Course = await this.dbc.getCourseRecord();
        if (record !== null) {
            // merge the new with the old
            record.defaultDeliverableId = course.defaultDeliverableId;
            const custom = Object.assign({}, record.custom, course.custom); // merge custom properties
            record.custom = custom;
        }
        return await this.dbc.writeCourseRecord(record);
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
            if (person.kind === PersonKind.STUDENT) {
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
                id:      repo.id,
                URL:     repo.URL,
                delivId: repo.delivId
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
     * @param reqDelivId ('any' for *)
     * @param reqRepoId ('any' for *)
     * @param maxNumResults (optional, default 500)
     * @returns {Promise<AutoTestGradeTransport[]>}
     */
    public async getDashboard(reqDelivId: string, reqRepoId: string, maxNumResults?: number): Promise<AutoTestDashboardTransport[]> {
        Log.info("CourseController::getDashboard( " + reqDelivId + ", " + reqRepoId + ", " + maxNumResults + " ) - start");
        const start = Date.now();
        const NUM_RESULTS = maxNumResults ? maxNumResults : 500; // max # of records

        const repoIds: string[] = [];
        const results: AutoTestDashboardTransport[] = [];
        const allResults = await this.matchResults(reqDelivId, reqRepoId);
        for (const result of allResults) {
            const repoId = result.input.target.repoId;
            if (results.length <= NUM_RESULTS) {

                const repoURL = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
                    Config.getInstance().getProp(ConfigKey.org) + '/' + repoId;

                let scoreOverall = null;
                let scoreCover = null;
                let scoreTest = null;

                let testPass: string[] = [];
                let testFail: string[] = [];
                let testSkip: string[] = [];
                let testError: string[] = [];

                if (typeof result.output !== 'undefined' && typeof result.output.report !== 'undefined') {
                    const report = result.output.report;
                    if (typeof report.scoreOverall !== 'undefined') {
                        scoreOverall = Util.truncateNumber(report.scoreOverall, 0);
                    }
                    if (typeof report.scoreTest !== 'undefined') {
                        scoreTest = Util.truncateNumber(report.scoreTest, 0);
                    }
                    if (typeof report.scoreCover !== 'undefined') {
                        scoreCover = Util.truncateNumber(report.scoreCover, 0);
                    }

                    if (typeof report.passNames !== 'undefined') {
                        testPass = report.passNames;
                    }
                    if (typeof report.failNames !== 'undefined') {
                        testFail = report.failNames;
                    }
                    if (typeof report.skipNames !== 'undefined') {
                        testSkip = report.skipNames;
                    }
                    if (typeof report.errorNames !== 'undefined') {
                        testError = report.errorNames;
                    }
                }

                const resultTrans: AutoTestDashboardTransport = {
                    repoId:       repoId,
                    repoURL:      repoURL,
                    delivId:      result.delivId,
                    state:        result.output.state,
                    timestamp:    result.output.timestamp,
                    commitSHA:    result.input.target.commitSHA,
                    commitURL:    result.input.target.commitURL,
                    scoreOverall: scoreOverall,
                    scoreCover:   scoreCover,
                    scoreTests:   scoreTest,

                    testPass:  testPass,
                    testFail:  testFail,
                    testError: testError,
                    testSkip:  testSkip
                };
                // just return the first result for a repo, unless they are specified
                if (reqRepoId !== 'any' || repoIds.indexOf(repoId) < 0) {
                    results.push(resultTrans);
                    repoIds.push(repoId);
                }
            } else {
                // result does not match filter
            }
        }
        Log.info("CourseController::getDashboard(..) - # results: " + results.length + "; took: " + Util.took(start));
        return results;
    }

    public async matchResults(reqDelivId: string, reqRepoId: string): Promise<Result[]> {
        const allResults = await this.resC.getAllResults();
        const NUM_RESULTS = 1000;

        const results: Result[] = [];
        for (const result of allResults) {
            // const repo = await rc.getRepository(result.repoId); // this happens a lot and ends up being too slow
            const delivId = result.delivId;
            const repoId = result.input.target.repoId;

            if ((reqDelivId === 'any' || delivId === reqDelivId) &&
                (reqRepoId === 'any' || repoId === reqRepoId) &&
                results.length <= NUM_RESULTS) {

                results.push(result);

            } else {
                // result does not match filter
            }
        }
        Log.trace("CourseController::matchResults(..) - # results: " + results.length);
        return results;
    }

    /**
     * Gets the stdio associated with a tuple.
     *
     * @param delivId
     * @param repoId
     * @param sha
     * @returns {Promise<AutoTestGradeTransport[]>}
     */
    public async getResult(delivId: string, repoId: string, sha: string): Promise<string> {
        Log.info("CourseController::getResult( " + delivId + ", " + repoId + ", " + sha + " ) - start");

        // portal/result/<FULL_COMMIT_SHA>-<DELIV_ID>/<FILENAME>
        // http://grader/randomStringInEnv/commitSHA-dX

        const host = Config.getInstance().getProp(ConfigKey.graderUrl);
        const port = Config.getInstance().getProp(ConfigKey.graderPort);

        const url = host + ':' + port + '/' + sha + '-' + delivId + '/stdio.txt';
        Log.info("CourseController::getResult( .. ) - URL: " + url);
        const res = await rp(url);
        Log.info("CourseController::getResult( .. ) - done; body: " + res);
        return res;
    }

    /**
     * Gets the list of GitHub ids associated with the 'students' team on GitHub
     * and marks them as PersonKind.WITHDRAWN. Does nothing if the students team
     * does not exist or is empty.
     *
     * @returns {Promise<string>} A message summarizing the outcome of the operation.
     */
    public async performStudentWithdraw(): Promise<string> {
        Log.info("CourseController::performStudentWithdraw() - start");
        const gha = GitHubActions.getInstance(true);
        const teamNum = await gha.getTeamNumber('students');
        const registeredGithubIds = await gha.getTeamMembers(teamNum);

        if (registeredGithubIds.length > 0) {
            const pc = new PersonController();
            const msg = await pc.markStudentsWithdrawn(registeredGithubIds);
            Log.info("CourseController::performStudentWithdraw() - done; msg: " + msg);
            return msg;
        } else {
            throw new Error("No students specified in the 'students' team on GitHub; operation aborted.");
        }
    }

    /**
     * Gets the results associated with the course.
     * @param reqDelivId ('any' for *)
     * @param reqRepoId ('any' for *)
     * @returns {Promise<AutoTestGradeTransport[]>}
     */
    public async getResults(reqDelivId: string, reqRepoId: string): Promise<AutoTestResultSummaryTransport[]> {
        Log.info("CourseController::getResults( " + reqDelivId + ", " + reqRepoId + " ) - start");
        const start = Date.now();
        const NUM_RESULTS = 1000; // max # of records

        const results: AutoTestResultSummaryTransport[] = [];
        const allResults = await this.matchResults(reqDelivId, reqRepoId);
        for (const result of allResults) {
            // const repo = await rc.getRepository(result.repoId); // this happens a lot and ends up being too slow

            const repoId = result.input.target.repoId;
            if (results.length <= NUM_RESULTS) {

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
                    commitSHA:    result.input.target.commitSHA,
                    commitURL:    result.input.target.commitURL,
                    scoreOverall: scoreOverall,
                    scoreCover:   scoreCover,
                    scoreTests:   scoreTest
                };

                results.push(resultTrans);
            } else {
                // result does not match filter
            }
        }
        Log.info("CourseController::getResults(..) - # results: " + results.length + "; took: " + Util.took(start));
        return results;
    }

    /**
     * Gets the deliverables associated with the course.
     *
     * @returns {Promise<DeliverableTransport[]>}
     */
    public async getDeliverables(): Promise<DeliverableTransport[]> {
        const deliverables = await this.dbc.getDeliverables();

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

    /**
     *
     * @param {Deliverable} deliv
     * @param {boolean} formSingleTeams specify whether singletons should be allocated into teams.
     * Choose false if you want to wait for the students to specify, choose true if you want to
     * let them work individually. (Note: if your teams are of max size 1, you still need to say
     * yes to make this happen.)
     *
     * @returns {Promise<RepositoryTransport[]>}
     */
    public async provision(deliv: Deliverable, formSingleTeams: boolean): Promise<RepositoryTransport[]> {
        Log.info("CourseController::provision( " + deliv.id + ", " + formSingleTeams + " ) - start");
        const allPeople: Person[] = await this.pc.getAllPeople();
        const allTeams: Team[] = await this.tc.getAllTeams();

        if (deliv.teamMaxSize === 1) {
            formSingleTeams = true;
            Log.info("CourseController::provision( .. ) - team maxSize 1: formSingleTeams forced to true");
        }

        const delivTeams: Team[] = [];
        for (const team of allTeams) {
            if (team === null || deliv === null || team.id === null || deliv.id === null) {
                // seeing this during 310 provisioning, need to figure this out
                Log.error("CourseController::provision( .. ) - ERROR! null team: " +
                    JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv));
            } else {
                if (team.delivId === deliv.id) {
                    Log.trace("CourseController::provision( .. ) - adding team: " + team.id + " to delivTeams");
                    delivTeams.push(team);
                }
            }
        }
        Log.trace("CourseController::provision( .. ) - # deliv teams: " + delivTeams.length + "; total people: " + allPeople.length);

        // remove any people who are already on teams
        for (const team of delivTeams) {
            for (const personId of team.personIds) {
                const index = allPeople.map(function(p: Person) {
                    return p.id;
                }).indexOf(personId);
                if (index >= 0) {
                    allPeople.splice(index, 1);
                } else {
                    Log.error("CourseController::provision(..) - allPeople does not contain: " + personId);
                }
            }
        }

        Log.trace("CourseController::provision( .. ) - # people not on teams: " + allPeople.length);

        if (formSingleTeams === true) {
            // now create teams for individuals
            for (const individual of allPeople) {
                const names = await this.computeNames(deliv, [individual]);

                const team = await this.tc.formTeam(names.teamName, deliv, [individual], false);
                delivTeams.push(team);
            }
        }

        Log.trace("CourseController::provision( .. ) - # delivTeams after individual teams added: " + delivTeams.length);

        const reposToProvision: Repository[] = [];
        // now process the teams to create their repos
        for (const delivTeam of delivTeams) {
            // if (team.URL === null) { // this would be faster, but we are being more conservative here

            Log.trace('CourseController::provision( .. ) - preparing to provision team: ' + delivTeam.id);

            const people: Person[] = [];
            for (const pId of delivTeam.personIds) {
                people.push(await this.pc.getPerson(pId));
            }
            const names = await this.computeNames(deliv, people);

            Log.trace('CourseController::provision( .. ) - delivTeam: ' + delivTeam.id +
                '; computed team: ' + names.teamName + '; computed repo: ' + names.repoName);

            const team = await this.tc.getTeam(names.teamName);
            let repo = await this.rc.getRepository(names.repoName);

            if (team === null) {
                // sanity checking team must not be null given what we have done above (should never happen)
                throw new Error("CourseController::provision(..) - team unexpectedly null: " + names.teamName);
            }

            if (repo === null) {
                repo = await this.rc.createRepository(names.repoName, deliv, [team], {});
            }

            if (repo === null) {
                // sanity checking repo must not be null given what we have done above (should never happen)
                throw new Error("CourseController::provision(..) - repo unexpectedly null: " + names.repoName);
            }

            // teams and repos should be provisioned together; this makes sure this consistency is maintained
            if (team.URL === null && repo.URL === null) {
                // provision
                reposToProvision.push(repo);
            } else if (team.URL !== null && repo.URL !== null) {
                // already provisioned
            } else {
                Log.error("CourseController::provision(..) - inconsistent repo/team; repo.URL: " + repo.URL + "; team.URL: " + team.URL);
            }
        }

        Log.trace("CourseController::provision( .. ) - # repos to provision: " + reposToProvision.length);

        const provisionedRepos = await this.provisionRepositories(reposToProvision, deliv.importURL);
        return provisionedRepos; // only returns provisioned this time; should it return all of them?
    }

    /**
     * Creates the GitHub side of the provided repositories. Only provisions those that
     * have not already been configured (e.g., their URL field is null).
     *
     * Does not release the repos to the students (e.g., the student team is not attached
     * to the repository; this should be done with releaseRepositories). Released repos will
     * have their Team.URL fields set. e.g., creating the repo sets Repository.URL; releasing
     * the repo sets Team.URL (for the student teams associated with the repo).
     *
     * @param {Repository[]} repos
     * @param {string} importURL
     * @returns {Promise<Repository[]>}
     */
    public async provisionRepositories(repos: Repository[], importURL: string): Promise<RepositoryTransport[]> {
        const gha = GitHubActions.getInstance(true);
        const ghc = new GitHubController(gha);

        const config = Config.getInstance();
        const dbc = DatabaseController.getInstance();

        Log.info("CourseController::provisionRepositories( .. ) - start; # repos: " +
            repos.length + "; importURL: " + importURL);
        const provisionedRepos: Repository[] = [];

        for (const repo of repos) {
            try {
                if (repo.URL === null) {
                    const teams: Team[] = [];
                    for (const teamId of repo.teamIds) {
                        teams.push(await this.dbc.getTeam(teamId));
                    }
                    const success = await ghc.provisionRepository(repo.id, teams, importURL, false);

                    if (success === true) {
                        repo.URL = config.getProp(ConfigKey.githubHost) + "/" + config.getProp(ConfigKey.org) + "/" + repo.id;
                        repo.custom.githubProvisioned = true;
                        await dbc.writeRepository(repo);
                        Log.info("CourseController::provisionRepositories( .. ) - success: " + repo.id + "; URL: " + repo.URL);
                        provisionedRepos.push(repo);
                    } else {
                        Log.warn("CourseController::provisionRepositories( .. ) - FAILED: " + repo.id + "; URL: " + repo.URL);
                    }

                    await Util.delay(1 * 1000); // after any provisioning wait a bit
                } else {
                    Log.info("CourseController::provisionRepositories( .. ) - skipped; already provisioned: " +
                        repo.id + "; URL: " + repo.URL);
                }
            } catch (err) {
                Log.error("CourseController::provisionRepositories( .. ) - FAILED: " +
                    repo.id + "; URL: " + repo.URL + "; ERROR: " + err.message);
            }
        }

        const provisionedRepositoryTransport: RepositoryTransport[] = [];
        for (const repo of provisionedRepos) {
            provisionedRepositoryTransport.push(RepositoryController.repositoryToTransport(repo));
        }
        return provisionedRepositoryTransport;
    }

    /**
     * Releases any provisioned repositories to their respective teams.
     *
     * NOTE: this does _not_ provision the repos; it just releases previously-provisioned repositories.
     *
     * @param {Deliverable} deliv
     * @returns {Promise<RepositoryTransport[]>}
     */
    public async release(deliv: Deliverable): Promise<RepositoryTransport[]> {
        Log.info("CourseController::release( " + deliv.id + " ) - start");
        const allTeams: Team[] = await this.tc.getAllTeams();
        Log.info("CourseController::release( " + deliv.id + " ) - # teams: " + allTeams.length);

        const delivTeams: Team[] = [];
        for (const team of allTeams) {
            if (team === null || deliv === null || team.id === null || deliv.id === null) {
                // seeing this during 310 provisioning, need to figure this out
                Log.error("CourseController::release( .. ) - ERROR! null team: " +
                    JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv));
            } else {
                if (team.delivId === deliv.id) {
                    Log.trace("CourseController::release(..) - adding team: " + team.id + " to delivTeams");
                    delivTeams.push(team);
                }
            }
        }

        Log.info("CourseController::release( " + deliv.id + " ) - # deliv teams: " + delivTeams.length);
        const reposToRelease: Repository[] = [];
        for (const team of delivTeams) {
            try {
                if (typeof team.custom.githubAttached === 'undefined' || team.custom.githubAttached === false) {
                    // if the team
                    const people: Person[] = [];
                    for (const pId of team.personIds) {
                        people.push(await this.dbc.getPerson(pId));
                    }
                    const names = await this.computeNames(deliv, people);
                    const repo = await this.dbc.getRepository(names.repoName);
                    if (repo !== null && typeof repo.custom.githubProvisioned !== 'undefined' && repo.custom.githubProvisioned === true) {
                        // repo exists and has been provisioned: this is important as teams may have formed that have not been provisioned
                        // aka only release provisioned repos
                        reposToRelease.push(repo);
                    } else {
                        Log.info("CourseController::release( " + deliv.id + " ) - repo not provisioned yet: " + JSON.stringify(names));
                    }
                } else {
                    Log.info("CourseController::release( " + deliv.id + " ) - skipping team: " + team.id + "; already attached");
                }
            } catch (err) {
                Log.error("CourseController::release( .. ) - ERROR: " + err.message);
                Log.exception(err);
            }
        }

        Log.info("CourseController::release( " + deliv.id + " ) - # repos to release: " + reposToRelease.length);
        return await this.releaseRepositories(reposToRelease);
    }

    private async releaseRepositories(repos: Repository[]): Promise<RepositoryTransport[]> {
        const gha = GitHubActions.getInstance(true);
        const ghc = new GitHubController(gha);

        Log.info("CourseController::releaseRepositories( .. ) - start; # repos: " + repos.length);
        const start = Date.now();

        const releasedRepos = [];
        for (const repo of repos) {
            try {
                if (repo.URL !== null) {
                    const teams: Team[] = [];
                    for (const teamId of repo.teamIds) {
                        teams.push(await this.dbc.getTeam(teamId));
                    }

                    // actually release the repo
                    const success = await ghc.releaseRepository(repo, teams, false);

                    if (success === true) {
                        Log.info("CourseController::releaseRepositories( .. ) - success: " + repo.id);
                        releasedRepos.push(repo);
                    } else {
                        Log.warn("CourseController::releaseRepositories( .. ) - FAILED: " + repo.id);
                    }

                    await Util.delay(2 * 1000); // after any releasing wait a bit
                } else {
                    Log.info("CourseController::releaseRepositories( .. ) - skipped; repo not yet provisioned: " +
                        repo.id + "; URL: " + repo.URL);
                }
            } catch (err) {
                Log.error("CourseController::releaseRepositories( .. ) - FAILED: " +
                    repo.id + "; URL: " + repo.URL + "; ERROR: " + err.message);
            }
        }

        const releasedRepositoryTransport: RepositoryTransport[] = [];
        for (const repo of releasedRepos) {
            releasedRepositoryTransport.push(RepositoryController.repositoryToTransport(repo));
        }
        Log.info("CourseController::releaseRepositories( .. ) - complete; # released: " +
            releasedRepositoryTransport.length + "; took: " + Util.took(start));

        return releasedRepositoryTransport;
    }

    public abstract computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}>;

    // NOTE: the default implementation is currently broken; do not use it.
    /**
     * This is a method that subtypes can call from computeNames if they do not want to implement it themselves.
     *
     * @param {Deliverable} deliv
     * @param {Person[]} people
     * @returns {Promise<{teamName: string | null; repoName: string | null}>}
     */
    // public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}> {
    //     Log.info("CourseController::computeNames(..) - start; # people: " + people.length);
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
    //             Log.warn("CourseController::computeNames(..) - name not available; r: " + repoName + "; t: " + teamName);
    //             repoCount++; // try the next one
    //         }
    //     }
    //     Log.info("CourseController::computeNames(..) - done; r: " + repoName + "; t: " + teamName);
    //     return {teamName: teamName, repoName: repoName};
    // }

    public static validateProvisionTransport(obj: ProvisionTransport) {
        if (typeof obj === 'undefined' || obj === null) {
            const msg = 'Transport not populated.';
            Log.error('CourseController::validateProvisionTransport(..) - ERROR: ' + msg);
            throw new Error(msg);
        }

        // noinspection SuspiciousTypeOfGuard
        if (typeof obj.delivId !== 'string') {
            const msg = 'Provision.id not specified';
            Log.error('CourseController::validateProvisionTransport(..) - ERROR: ' + msg);
            throw new Error(msg);
        }

        // // noinspection SuspiciousTypeOfGuard
        // if (obj.action !== 'PROVISION' && obj.action !== 'RELEASE') {
        //     const msg = 'action not correct: ' + obj.action;
        //     Log.error('CourseController::validateProvisionTransport(..) - ERROR: ' + msg);
        //     return msg;
        // }

        // noinspection SuspiciousTypeOfGuard
        if (typeof obj.formSingle !== 'boolean') {
            const msg = 'formSingle not specified';
            Log.error('CourseController::validateProvisionTransport(..) - ERROR: ' + msg);
            return msg;
        }

        // const dc = new DeliverablesController();
        // const deliv = await dc.getDeliverable(obj.delivId);
        // if (deliv === null && deliv.shouldProvision === true){
        //     const msg = 'delivId does not correspond to a real deliverable or that deliverable is not provisionable';
        //     Log.error('CourseController::validateProvisionTransport(..) - ERROR: ' + msg);
        //     return msg;
        // }

        return null;
    }
}
