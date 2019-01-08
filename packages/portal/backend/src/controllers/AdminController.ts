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
import {Factory} from "../Factory";
import {AuditLabel, Course, Deliverable, Grade, Person, PersonKind, Repository, Result, Team} from "../Types";
import {ICourseController} from "./CourseController";

import {DatabaseController} from "./DatabaseController";
import {DeliverablesController} from "./DeliverablesController";
import {GitHubActions} from "./GitHubActions";
import {GitHubController, IGitHubController} from "./GitHubController";
import {GradesController} from "./GradesController";
import {PersonController} from "./PersonController";
import {RepositoryController} from "./RepositoryController";
import {ResultsController} from "./ResultsController";
import {TeamController} from "./TeamController";

export class AdminController {

    public static getName(): string | null {
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            if (name !== null) {
                return name;
            } else {
                Log.error("AdminController::getName() - ERROR: null name");
            }
        } catch (err) {
            Log.error("AdminController::getName() - ERROR: " + err.message);
        }
        return null;
    }

    protected dbc = DatabaseController.getInstance();
    protected pc = new PersonController();
    protected rc = new RepositoryController();
    protected tc = new TeamController();
    protected gc = new GradesController();
    protected resC = new ResultsController();
    protected cc: ICourseController;
    protected gh: IGitHubController = null;

    constructor(ghController: IGitHubController) {
        Log.trace("AdminController::<init>");
        this.gh = ghController;
        this.cc = Factory.getCourseController(ghController);
    }

    public async processNewAutoTestGrade(grade: AutoTestGradeTransport): Promise<boolean> {
        Log.info("AdminController::processNewAutoTestGrade( .. ) - start");

        try {
            Log.info("AdminController::processNewAutoTestGrade( .. ) - payload: " + JSON.stringify(grade));
            const repo = await this.rc.getRepository(grade.repoId);
            if (repo === null) {
                // sanity check
                Log.error("AdminController::processNewAutoTestGrade( .. ) - invalid repo name: " + grade.repoId);
                return false;
            }

            const peopleIds = await this.rc.getPeopleForRepo(grade.repoId);
            if (peopleIds.length < 1) {
                // sanity check
                Log.error("AdminController::processNewAutoTestGrade( .. ) - no people to associate grade record with.");
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
                const shouldSave = await this.cc.handleNewAutoTestGrade(deliv, newGrade, existingGrade);

                if (shouldSave === true) {
                    await this.dbc.writeAudit(AuditLabel.GRADE_AUTOTEST, 'AutoTest',
                        existingGrade, newGrade, {repoId: grade.repoId});
                    await this.gc.saveGrade(newGrade);
                }
            }
            return true;
        } catch (err) {
            Log.error("AdminController::processNewAutoTestGrade( .. ) - ERROR: " + err);
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
            if (person.kind === PersonKind.STUDENT || person.kind === null) { // null should be set on first login
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
        Log.info("AdminController::getDashboard( " + reqDelivId + ", " + reqRepoId + ", " + maxNumResults + " ) - start");
        const start = Date.now();
        const NUM_RESULTS = maxNumResults ? maxNumResults : 500; // max # of records

        const repoIds: string[] = [];
        const results: AutoTestDashboardTransport[] = [];
        const allResults = await this.matchResults(reqDelivId, reqRepoId);
        for (const result of allResults) {
            const repoId = result.input.target.repoId;
            if (results.length < NUM_RESULTS) {

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
        Log.info("AdminController::getDashboard(..) - # results: " + results.length + "; took: " + Util.took(start));
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
        Log.trace("AdminController::matchResults(..) - # results: " + results.length);
        return results;
    }

    /**
     * Gets the list of GitHub ids associated with the 'students' team on GitHub
     * and marks them as PersonKind.WITHDRAWN. Does nothing if the students team
     * does not exist or is empty.
     *
     * @returns {Promise<string>} A message summarizing the outcome of the operation.
     */
    public async performStudentWithdraw(): Promise<string> {
        Log.info("AdminController::performStudentWithdraw() - start");
        const gha = GitHubActions.getInstance(true);
        const tc = new TeamController();
        const teamNum = await tc.getTeamNumber('students'); // await gha.getTeamNumber('students');
        const registeredGithubIds = await gha.getTeamMembers(teamNum);

        if (registeredGithubIds.length > 0) {
            const pc = new PersonController();
            const msg = await pc.markStudentsWithdrawn(registeredGithubIds);
            Log.info("AdminController::performStudentWithdraw() - done; msg: " + msg);
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
        Log.info("AdminController::getResults( " + reqDelivId + ", " + reqRepoId + " ) - start");
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

                // if the VM state is SUCCESS, return the report state
                let state = result.output.state.toString();
                if (state === 'SUCCESS' && typeof result.output.report.result !== 'undefined') {
                    state = result.output.report.result;
                }

                const resultTrans: AutoTestResultSummaryTransport = {
                    repoId:       repoId,
                    repoURL:      repoURL,
                    delivId:      result.delivId,
                    state:        state,
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
        Log.info("AdminController::getResults(..) - # results: " + results.length + "; took: " + Util.took(start));
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
            Log.error('AdminController::validateCourseTransport(..) - ERROR: ' + msg);
            throw new Error(msg);
        }

        // noinspection SuspiciousTypeOfGuard
        if (typeof courseTrans.id !== 'string') {
            const msg = 'Course.id not specified';
            Log.error('AdminController::validateCourseTransport(..) - ERROR: ' + msg);
            throw new Error(msg);
        }

        // noinspection SuspiciousTypeOfGuard
        if (typeof courseTrans.defaultDeliverableId !== 'string') {
            const msg = 'defaultDeliverableId not specified';
            Log.error('AdminController::validateCourseTransport(..) - ERROR: ' + msg);
            return msg;
        }

        // noinspection SuspiciousTypeOfGuard
        if (typeof courseTrans.custom !== 'object') {
            const msg = 'custom not specified';
            Log.error('AdminController::validateCourseTransport(..) - ERROR: ' + msg);
            return msg;
        }

        return null;
    }

    // /**
    //  *
    //  * @param {Deliverable} deliv
    //  * @param {boolean} formSingleTeams specify whether singletons should be allocated into teams.
    //  * Choose false if you want to wait for the students to specify, choose true if you want to
    //  * let them work individually. (Note: if your teams are of max size 1, you still need to say
    //  * yes to make this happen.)
    //  *
    //  * @returns {Promise<RepositoryTransport[]>}
    //  */
    // public async provision(deliv: Deliverable, formSingleTeams: boolean): Promise<RepositoryTransport[]> {
    //     Log.info("AdminController::provision( " + deliv.id + ", " + formSingleTeams + " ) - start");
    //     const allPeople: Person[] = await this.pc.getAllPeople();
    //     const allTeams: Team[] = await this.tc.getAllTeams();
    //
    //     if (deliv.teamMaxSize === 1) {
    //         formSingleTeams = true;
    //         Log.info("AdminController::provision( .. ) - team maxSize 1: formSingleTeams forced to true");
    //     }
    //
    //     const delivTeams: Team[] = [];
    //     for (const team of allTeams) {
    //         if (team === null || deliv === null || team.id === null || deliv.id === null) {
    //             // seeing this during 310 provisioning, need to figure this out
    //             Log.error("AdminController::provision( .. ) - ERROR! null team: " +
    //                 JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv));
    //         } else {
    //             if (team.delivId === deliv.id) {
    //                 Log.trace("AdminController::provision( .. ) - adding team: " + team.id + " to delivTeams");
    //                 delivTeams.push(team);
    //             }
    //         }
    //     }
    //     Log.trace("AdminController::provision( .. ) - # deliv teams: " + delivTeams.length + "; total people: " + allPeople.length);
    //
    //     // remove any people who are already on teams
    //     for (const team of delivTeams) {
    //         for (const personId of team.personIds) {
    //             const index = allPeople.map(function(p: Person) {
    //                 return p.id;
    //             }).indexOf(personId);
    //             if (index >= 0) {
    //                 allPeople.splice(index, 1);
    //             } else {
    //                 Log.error("AdminController::provision(..) - allPeople does not contain: " + personId);
    //             }
    //         }
    //     }
    //
    //     Log.trace("AdminController::provision( .. ) - # people not on teams: " + allPeople.length);
    //
    //     if (formSingleTeams === true) {
    //         // now create teams for individuals
    //         for (const individual of allPeople) {
    //             const names = await this.cc.computeNames(deliv, [individual]);
    //
    //             const team = await this.tc.formTeam(names.teamName, deliv, [individual], false);
    //             delivTeams.push(team);
    //         }
    //     }
    //
    //     Log.trace("AdminController::provision( .. ) - # delivTeams after individual teams added: " + delivTeams.length);
    //
    //     const reposToProvision: Repository[] = [];
    //     // now process the teams to create their repos
    //     for (const delivTeam of delivTeams) {
    //         // if (team.URL === null) { // this would be faster, but we are being more conservative here
    //
    //         Log.trace('AdminController::provision( .. ) - preparing to provision team: ' + delivTeam.id);
    //
    //         const people: Person[] = [];
    //         for (const pId of delivTeam.personIds) {
    //             people.push(await this.pc.getPerson(pId));
    //         }
    //         const names = await this.cc.computeNames(deliv, people);
    //
    //         Log.trace('AdminController::provision( .. ) - delivTeam: ' + delivTeam.id +
    //             '; computed team: ' + names.teamName + '; computed repo: ' + names.repoName);
    //
    //         const team = await this.tc.getTeam(names.teamName);
    //         let repo = await this.rc.getRepository(names.repoName);
    //
    //         if (team === null) {
    //             // sanity checking team must not be null given what we have done above (should never happen)
    //             throw new Error("AdminController::provision(..) - team unexpectedly null: " + names.teamName);
    //         }
    //
    //         if (repo === null) {
    //             repo = await this.rc.createRepository(names.repoName, deliv, [team], {});
    //         }
    //
    //         if (repo === null) {
    //             // sanity checking repo must not be null given what we have done above (should never happen)
    //             throw new Error("AdminController::provision(..) - repo unexpectedly null: " + names.repoName);
    //         }
    //
    //         // teams and repos should be provisioned together; this makes sure this consistency is maintained
    //         if (team.URL === null && repo.URL === null) {
    //             // provision
    //             reposToProvision.push(repo);
    //         } else if (team.URL !== null && repo.URL !== null) {
    //             // already provisioned
    //         } else {
    //             Log.error("AdminController::provision(..) - inconsistent repo/team; repo.URL: " + repo.URL + "; team.URL: " + team.URL);
    //         }
    //     }
    //
    //     Log.trace("AdminController::provision( .. ) - # repos to provision: " + reposToProvision.length);
    //
    //     const provisionedRepos = await this.provisionRepositories(reposToProvision, deliv.importURL);
    //     return provisionedRepos; // only returns provisioned this time; should it return all of them?
    // }

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
    public async planProvision(deliv: Deliverable, formSingleTeams: boolean): Promise<RepositoryTransport[]> {
        Log.info("AdminController::planProvision( " + deliv.id + ", " + formSingleTeams + " ) - start");
        const allPeople: Person[] = await this.pc.getAllPeople();
        const allTeams: Team[] = await this.tc.getAllTeams();

        if (deliv.teamMaxSize === 1) {
            formSingleTeams = true;
            Log.info("AdminController::planProvision( .. ) - team maxSize 1: formSingleTeams forced to true");
        }

        const delivTeams: Team[] = [];
        for (const team of allTeams) {
            if (team === null || deliv === null || team.id === null || deliv.id === null) {
                // seeing this during 310 provisioning, need to figure this out
                Log.error("AdminController::planProvision( .. ) - ERROR! null team: " +
                    JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv));
            } else {
                if (team.delivId === deliv.id) {
                    Log.trace("AdminController::planProvision( .. ) - adding team: " + team.id + " to delivTeams");
                    delivTeams.push(team);
                }
            }
        }
        Log.trace("AdminController::planProvision( .. ) - # deliv teams: " + delivTeams.length + "; total people: " + allPeople.length);

        // remove any people who are already on teams
        for (const team of delivTeams) {
            for (const personId of team.personIds) {
                const index = allPeople.map(function(p: Person) {
                    return p.id;
                }).indexOf(personId);
                if (index >= 0) {
                    allPeople.splice(index, 1);
                } else {
                    Log.error("AdminController::planProvision(..) - allPeople does not contain: " + personId);
                }
            }
        }

        Log.trace("AdminController::planProvision( .. ) - # people not on teams: " + allPeople.length);

        if (formSingleTeams === true) {
            // now create teams for individuals
            for (const individual of allPeople) {
                const names = await this.cc.computeNames(deliv, [individual]);

                const team = await this.tc.formTeam(names.teamName, deliv, [individual], false);
                delivTeams.push(team);
            }
        }

        Log.trace("AdminController::planProvision( .. ) - # delivTeams after individual teams added: " + delivTeams.length);

        const reposToProvision: Repository[] = [];
        // now process the teams to create their repos
        for (const delivTeam of delivTeams) {
            // if (team.URL === null) { // this would be faster, but we are being more conservative here

            Log.trace('AdminController::planProvision( .. ) - preparing to provision team: ' + delivTeam.id);

            const people: Person[] = [];
            for (const pId of delivTeam.personIds) {
                people.push(await this.pc.getPerson(pId));
            }
            const names = await this.cc.computeNames(deliv, people);

            Log.trace('AdminController::planProvision( .. ) - delivTeam: ' + delivTeam.id +
                '; computed team: ' + names.teamName + '; computed repo: ' + names.repoName);

            const team = await this.tc.getTeam(names.teamName);
            let repo = await this.rc.getRepository(names.repoName);

            if (team === null) {
                // sanity checking team must not be null given what we have done above (should never happen)
                throw new Error("AdminController::planProvision(..) - team unexpectedly null: " + names.teamName);
            }

            if (repo === null) {
                repo = await this.rc.createRepository(names.repoName, deliv, [team], {});
            }

            if (repo === null) {
                // sanity checking repo must not be null given what we have done above (should never happen)
                throw new Error("AdminController::planProvision(..) - repo unexpectedly null: " + names.repoName);
            }

            // // teams and repos should be provisioned together; this makes sure this consistency is maintained
            // if (team.URL === null && repo.URL === null) {
            //     // provision
            //     reposToProvision.push(repo);
            // } else if (team.URL !== null && repo.URL !== null) {
            //     // already provisioned
            // } else {
            //     Log.error("AdminController::planProvision(..) -
            // inconsistent repo/team; repo.URL: " + repo.URL + "; team.URL: " + team.URL);
            // }

            // this will include provisioned repos and unprovisioned repos
            // provisioned repos will have a value for their URL, unprovisioned repos will not
            reposToProvision.push(repo);
        }

        Log.trace("AdminController::planProvision( .. ) - # repos to provision: " + reposToProvision.length);

        const repoTrans: RepositoryTransport[] = [];
        for (const repo of reposToProvision) {
            repoTrans.push({delivId: deliv.id, id: repo.id, URL: repo.URL});
        }

        return repoTrans;
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
    public async performProvision(repos: Repository[], importURL: string): Promise<RepositoryTransport[]> {
        const gha = GitHubActions.getInstance(true);
        const ghc = new GitHubController(gha);

        const config = Config.getInstance();
        const dbc = DatabaseController.getInstance();

        Log.info("AdminController::performProvision( .. ) - start; # repos: " +
            repos.length + "; importURL: " + importURL);
        const provisionedRepos: Repository[] = [];

        for (const repo of repos) {
            try {
                Log.info("AdminController::performProvision( .. ) ***** START *****");
                Log.info("AdminController::performProvision( .. ) - start for repo: " + repo.id);
                if (repo.URL === null) {
                    const teams: Team[] = [];
                    for (const teamId of repo.teamIds) {
                        teams.push(await this.dbc.getTeam(teamId));
                    }
                    Log.info("AdminController::performProvision( .. ) - about to provision: " + repo.id);
                    const success = await ghc.provisionRepository(repo.id, teams, importURL, false);
                    Log.info("AdminController::performProvision( .. ) - provisioned: " + repo.id + "; success: " + success);

                    if (success === true) {
                        repo.URL = config.getProp(ConfigKey.githubHost) + "/" + config.getProp(ConfigKey.org) + "/" + repo.id;
                        repo.custom.githubProvisioned = true;
                        await dbc.writeRepository(repo);
                        Log.info("AdminController::performProvision( .. ) - success: " + repo.id + "; URL: " + repo.URL);
                        provisionedRepos.push(repo);
                    } else {
                        Log.warn("AdminController::performProvision( .. ) - provision FAILED: " + repo.id + "; URL: " + repo.URL);
                    }

                    Log.info("AdminController::performProvision( .. ) - done provisioning: " + repo.id + "; forced wait");
                    await Util.delay(2 * 1000); // after any provisioning wait a bit
                    Log.info("AdminController::performProvision( .. ) - done for repo: " + repo.id + "; wait complete");
                    Log.info("AdminController::performProvision( .. ) ***** DONE *****");
                } else {
                    Log.info("AdminController::performProvision( .. ) - skipped; already provisioned: " +
                        repo.id + "; URL: " + repo.URL);
                }
            } catch (err) {
                Log.error("AdminController::performProvision( .. ) - FAILED: " +
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
        Log.info("AdminController::release( " + deliv.id + " ) - start");
        const allTeams: Team[] = await this.tc.getAllTeams();
        Log.info("AdminController::release( " + deliv.id + " ) - # teams: " + allTeams.length);

        const delivTeams: Team[] = [];
        for (const team of allTeams) {
            if (team === null || deliv === null || team.id === null || deliv.id === null) {
                // seeing this during 310 provisioning, need to figure this out
                Log.error("AdminController::release( .. ) - ERROR! null team: " +
                    JSON.stringify(team) + " or deliv: " + JSON.stringify(deliv));
            } else {
                if (team.delivId === deliv.id) {
                    Log.trace("AdminController::release(..) - adding team: " + team.id + " to delivTeams");
                    delivTeams.push(team);
                }
            }
        }

        Log.info("AdminController::release( " + deliv.id + " ) - # deliv teams: " + delivTeams.length);
        const reposToRelease: Repository[] = [];
        for (const team of delivTeams) {
            try {
                if (typeof team.custom.githubAttached === 'undefined' || team.custom.githubAttached === false) {
                    // if the team
                    const people: Person[] = [];
                    for (const pId of team.personIds) {
                        people.push(await this.dbc.getPerson(pId));
                    }
                    const names = await this.cc.computeNames(deliv, people);
                    const repo = await this.dbc.getRepository(names.repoName);
                    if (repo !== null && typeof repo.custom.githubProvisioned !== 'undefined' && repo.custom.githubProvisioned === true) {
                        // repo exists and has been provisioned: this is important as teams may have formed that have not been provisioned
                        // aka only release provisioned repos
                        reposToRelease.push(repo);
                    } else {
                        Log.info("AdminController::release( " + deliv.id + " ) - repo not provisioned yet: " + JSON.stringify(names));
                    }
                } else {
                    Log.info("AdminController::release( " + deliv.id + " ) - skipping team: " + team.id + "; already attached");
                }
            } catch (err) {
                Log.error("AdminController::release( .. ) - ERROR: " + err.message);
                Log.exception(err);
            }
        }

        Log.info("AdminController::release( " + deliv.id + " ) - # repos to release: " + reposToRelease.length);
        return await this.releaseRepositories(reposToRelease);
    }

    private async releaseRepositories(repos: Repository[]): Promise<RepositoryTransport[]> {
        const gha = GitHubActions.getInstance(true);
        const ghc = new GitHubController(gha);

        Log.info("AdminController::releaseRepositories( .. ) - start; # repos: " + repos.length);
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
                        Log.info("AdminController::releaseRepositories( .. ) - success: " + repo.id);
                        releasedRepos.push(repo);
                    } else {
                        Log.warn("AdminController::releaseRepositories( .. ) - FAILED: " + repo.id);
                    }

                    await Util.delay(2 * 1000); // after any releasing wait a bit
                } else {
                    Log.info("AdminController::releaseRepositories( .. ) - skipped; repo not yet provisioned: " +
                        repo.id + "; URL: " + repo.URL);
                }
            } catch (err) {
                Log.error("AdminController::releaseRepositories( .. ) - FAILED: " +
                    repo.id + "; URL: " + repo.URL + "; ERROR: " + err.message);
            }
        }

        const releasedRepositoryTransport: RepositoryTransport[] = [];
        for (const repo of releasedRepos) {
            releasedRepositoryTransport.push(RepositoryController.repositoryToTransport(repo));
        }
        Log.info("AdminController::releaseRepositories( .. ) - complete; # released: " +
            releasedRepositoryTransport.length + "; took: " + Util.took(start));

        return releasedRepositoryTransport;
    }

    public async makeReposReadOnly(deliv: Deliverable): Promise<RepositoryTransport[]> {
        Log.info("AdminController::makeReposReadOnly( " + deliv.id + " ) - start");
        return [];
    }

    public async makeReposWriteable(deliv: Deliverable): Promise<RepositoryTransport[]> {
        Log.info("AdminController::makeReposReadOnly( " + deliv.id + " ) - start");
        return [];
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

    public static validateProvisionTransport(obj: ProvisionTransport) {
        if (typeof obj === 'undefined' || obj === null) {
            const msg = 'Transport not populated.';
            Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
            throw new Error(msg);
        }

        // noinspection SuspiciousTypeOfGuard
        if (typeof obj.delivId !== 'string') {
            const msg = 'Provision.id not specified';
            Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
            throw new Error(msg);
        }

        // // noinspection SuspiciousTypeOfGuard
        // if (obj.action !== 'PROVISION' && obj.action !== 'RELEASE') {
        //     const msg = 'action not correct: ' + obj.action;
        //     Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
        //     return msg;
        // }

        // noinspection SuspiciousTypeOfGuard
        if (typeof obj.formSingle !== 'boolean') {
            const msg = 'formSingle not specified';
            Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
            return msg;
        }

        // const dc = new DeliverablesController();
        // const deliv = await dc.getDeliverable(obj.delivId);
        // if (deliv === null && deliv.shouldProvision === true){
        //     const msg = 'delivId does not correspond to a real deliverable or that deliverable is not provisionable';
        //     Log.error('AdminController::validateProvisionTransport(..) - ERROR: ' + msg);
        //     return msg;
        // }

        return null;
    }
}
