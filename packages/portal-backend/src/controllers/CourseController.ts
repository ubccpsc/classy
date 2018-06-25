import * as crypto from 'crypto';

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import Util from "../../../common/Util";
import {StudentTransport} from '../../../common/types/PortalTypes';
import {GradePayload, Payload, SDMMStatus, StatusPayload} from "../../../common/types/SDMMTypes";

import {RepositoryController} from "./RepositoryController";
import {DatabaseController} from "./DatabaseController";
import {GradesController} from "./GradesController";
import {Deliverable, Grade, Person, Team} from "../Types";
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
     * @returns {Promise<Person | null>} Returns null if the username is unknown in the org.
     */
    getPerson(githubUsername: string): Promise<Person | null>;

    /**
     *
     * TODO: Convert Person to PersonTransport
     *
     * Sets the people for the org. Usually populated with classlist (or some such).
     *
     * @param {Person[]} people
     * @returns {Promise<boolean>}
     */
    setPeople(people: Person[]): Promise<boolean>;

    /**
     *
     * TODO: Convert Deliverable to DeliverableTransport
     *
     * Get all the deliverables for an org.
     *
     * @returns {Promise<Deliverable[]>}
     */
    getDeliverables(): Promise<Deliverable[]>;

    /**
     *
     * TODO: convert Deliverable to DeliverableTransport
     *
     * Sets the deliverables for an org. Will replace deliverables that have the same
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
     * If no Person is provided, gets all grades for an org.
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
     * Sets the grades for an org. Any grade that already exists in the system with the
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

    /**
     * Performs a complete provisioning task for a given deliverable and set of people.
     *
     * @param {string} delivId
     * @param {string[]} peopleIds people order matters; requestor should be peopleIds[0]
     * @returns {Promise<ResponsePayload>}
     */
    public async provision(delivId: string, peopleIds: string[]): Promise<Payload> {
        Log.info("CourseController::provision( " + delivId + ", ... ) - start");

        try {
            const org = Config.getInstance().getProp(ConfigKey.org);
            if (org !== "secapstone" && org !== "secapstonetest") {
                Log.error("CourseController::provision(..) - SDMMController should not be used for other orgs");
                return {failure: {shouldLogout: false, message: "Invalid org; contact course staff."}};
            }

            if (peopleIds.length < 1) {
                Log.error("CourseController::provision(..) - there needs to be at least one person on a repo");
                return {failure: {shouldLogout: false, message: "Invalid # of people; contact course staff."}};
            }

            if (delivId === "d0") {
                if (peopleIds.length === 1) {
                    Log.info("CourseController::provision(..) - provisioning new d0 repo for " + peopleIds[0]);
                    return await this.provisionD0Repo(peopleIds[0]);
                } else {
                    Log.error("CourseController::provision(..) - d0 repos are only for individuals");
                    return {failure: {shouldLogout: false, message: "D0 for indivduals only; contact course staff."}};
                }
            } else if (delivId === "d1") {

                if (peopleIds.length === 1) {
                    Log.info("CourseController::provision(..) - updating existing d0 repo to d1 for " + peopleIds[0]);
                    return await this.updateIndividualD0toD1(peopleIds[0]);
                } else if (peopleIds.length === 2) {
                    Log.info("CourseController::provision(..) - provisioning new d1 repo for " + JSON.stringify(peopleIds));
                    if (peopleIds[0] !== peopleIds[1]) {
                        return await this.provisionD1Repo(peopleIds);
                    } else {
                        Log.error("CourseController::provision(..) - d1 duplicate users");
                        return {
                            failure: {
                                shouldLogout: false,
                                message:      "D1 duplicate users; if you wish to work alone, please select 'work individually'."
                            }
                        };
                    }
                } else {
                    Log.error("CourseController::provision(..) - d1 can only be performed by single students or pairs of students.");
                    return {failure: {shouldLogout: false, message: "D1 can only be performed by single students or pairs of students."}};
                }
            } else {
                Log.warn("CourseController::provision(..) - new repo not needed for delivId: " + delivId);
                return {failure: {shouldLogout: false, message: "Repo not needed; contact course staff."}};
            }
        } catch (err) {
            Log.error("CourseController::provision(..) - ERROR: " + err);
            return {failure: {shouldLogout: false, message: "Unknown error creating repo; contact course staff."}};
        }

    }

    /**
     *
     * This confirms the SDMM status. The approach is conservative (and hence slow).
     *
     * It will try to use checkStatus first to speed itself up.
     * Status chain:
     *
     * D0PRE
     * D0
     * D1UNLOCKED
     * D1TEAMSET
     * D1
     * D2
     * D3PRE
     * D3
     *
     * @param {string} personId
     * @returns {Promise<string>} null if the personId is not even known
     */
    private async computeStatusString(personId: string): Promise<string | null> {
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("CourseController::getStatus( " + org + ', ' + personId + ' ) - start');
        const start = Date.now();
        try {
            const person = await this.dc.getPerson(personId);
            if (person === null) {
                Log.info("CourseController::getStatus(..) - ERROR; person null");
                return null;
            }

            const reportedStatus = person.custom.sddmStatus;
            // most of the time the status doesn't change, so let's just check that first:
            // const statusCorrect = await this.checkStatus(org, personId);
            // if (statusCorrect === true) {
            //    Log.info("CourseController::getStatus(..) - check successful; skipping");
            //    return reportedStatus;
            // }

            let currentStatus = SDMMStatus[SDMMStatus.D0PRE]; // start with the lowest status and work up

            // D0PRE
            if (currentStatus === SDMMStatus[SDMMStatus.D0PRE]) {
                // make sure d0 doesn't exist for a person, if it does, make them D0

                let d0Repo = null;
                let repos = await this.rc.getReposForPerson(person);
                for (const r of repos) {
                    if (r.custom.d0enabled === true) {
                        d0Repo = r;
                    }

                    if (d0Repo !== null) {
                        Log.info("CourseController::getStatus(..) - elevating D0PRE to D0");
                        currentStatus = SDMMStatus[SDMMStatus.D0];
                    } else {
                        Log.info("CourseController::getStatus(..) - NOT elevating from D0PRE");
                    }
                }
            }

            // D0
            if (currentStatus === SDMMStatus[SDMMStatus.D0]) {
                // if their d0 score >= 60, make them D1UNLOCKED
                const d0Grade = await this.dc.getGrade(personId, "d0");
                if (d0Grade && d0Grade.score >= 60) {
                    Log.info("CourseController::getStatus(..) - elevating D0 to D1UNLOCKED");
                    currentStatus = SDMMStatus[SDMMStatus.D1UNLOCKED];
                } else {
                    Log.info("CourseController::getStatus(..) - NOT elevating from D0");
                }
            }

            // D1UNLOCKED
            if (currentStatus === SDMMStatus[SDMMStatus.D1UNLOCKED]) {
                // if they have a d1 team, make them D1TEAMSET
                const teams = await this.dc.getTeamsForPerson(personId);

                let d1team: Team = null;
                for (const t of teams) {
                    if (t.custom.sdmmd1 === true) {
                        d1team = t;
                    }
                }

                if (d1team !== null) {
                    Log.info("CourseController::getStatus(..) - elevating D1UNLOCKED to D1TEAMSET");
                    currentStatus = SDMMStatus[SDMMStatus.D1TEAMSET];
                } else {
                    Log.info("CourseController::getStatus(..) - NOT elevating from D1UNLOCKED");
                }
            }

            // D1TEAMSET
            if (currentStatus === SDMMStatus[SDMMStatus.D1TEAMSET]) {
                // if they have a d1 repo, make them D1
                const repos = await this.rc.getReposForPerson(person);
                let d1repo = null;
                for (const r of repos) {
                    if (r.custom.d1enabled === true) {
                        d1repo = r;
                    }
                }
                if (d1repo !== null) {
                    Log.info("CourseController::getStatus(..) - elevating D1TEAMSET to D1");
                    currentStatus = SDMMStatus[SDMMStatus.D1];
                } else {
                    Log.info("CourseController::getStatus(..) - NOT elevating from D1TEAMSET");
                }
            }

            // D1
            if (currentStatus === SDMMStatus[SDMMStatus.D1]) {
                // if their d1 score > 60, make them D2
                let d1Grade = await this.gc.getGrade(personId, "d1");
                if (d1Grade && d1Grade.score >= 60) {
                    Log.info("CourseController::getStatus(..) - elevating D1 to D2");
                    let allRepos = await this.rc.getReposForPerson(person);
                    for (const r of allRepos) {
                        if (r.custom.d1enabled === true) {
                            // is a project repo
                            r.custom.d2enabled = true;
                            await this.dc.writeRepository(r);
                        }
                    }
                    currentStatus = SDMMStatus[SDMMStatus.D2];
                } else {
                    Log.info("CourseController::getStatus(..) - NOT elevating from D1");
                }
            }

            // D2
            if (currentStatus === SDMMStatus[SDMMStatus.D2]) {
                // if their d2 core > 60, make them D3PRE
                let d2Grade = await this.gc.getGrade(personId, "d2");
                if (d2Grade && d2Grade.score >= 60) {
                    Log.info("CourseController::getStatus(..) - elevating D2 to D3PRE");
                    currentStatus = SDMMStatus[SDMMStatus.D3PRE];
                } else {
                    Log.info("CourseController::getStatus(..) - NOT elevating from D2");
                }
            }

            // D3PRE
            if (currentStatus === SDMMStatus[SDMMStatus.D3PRE]) {
                // if their d1 repo has custom.sddmD3pr===true, make them D3
                let allRepos = await this.rc.getReposForPerson(person);
                let prComplete = false;
                for (const r of allRepos) {
                    if (r.custom.d2enabled === true && r.custom.sddmD3pr === true) {
                        // is a project repo and has had the pr completed
                        prComplete = true;
                    }
                }
                if (prComplete === true) {
                    Log.info("CourseController::getStatus(..) - elevating D3PRE to D3");
                    currentStatus = SDMMStatus[SDMMStatus.D3];// "D3";
                } else {
                    Log.info("CourseController::getStatus(..) - NOT elevating from D3PRE");
                }
            }

            // D3
            // nothing else to be done
            if (currentStatus === SDMMStatus[SDMMStatus.D3]) {
                let allRepos = await this.rc.getReposForPerson(person);
                for (const r of allRepos) {
                    if (r.custom.d2enabled === true) {
                        // is a project repo
                        r.custom.d3enabled = true;
                        await this.dc.writeRepository(r);
                    }
                }
                Log.info("CourseController::getStatus(..) - NOT elevating from D3");
            }

            // let currentStatus = person.custom.sddmStatus;
            person.custom.sddmStatus = currentStatus;
            this.dc.writePerson(person);

            Log.info("CourseController::getStatus( " + org + ', ' + personId + ' ) - done; took: ' + Util.took(start));
            return currentStatus;
        } catch (err) {
            Log.error("CourseController::getStatus( " + org + ', ' + personId + ' ) - ERROR: ' + err);
            return "UNKNOWN";
        }
    }

    /**
     *
     * This confirms the custom.sddmStatus is correct.
     *
     * It will try to use checkStatus first to speed itself up.
     * Status chain:
     *
     * D0PRE
     * D0
     * D1UNLOCKED
     * D1TEAMSET
     * D1
     * D2
     * D3PRE
     * D3
     *
     * @param {string} org
     * @param {string} personId
     * @returns {Promise<string>}
     */

    /*
    private async checkStatus(org: string, personId: string): Promise<boolean> {
        Log.info("CourseController::getStatus( " + org + ', ' + personId + ' ) - start');
        const start = Date.now();
        try {
            const person = await this.dc.getPerson(org, personId);
            if (person === null) {
                Log.info("CourseController::checkStatus(..) - ERROR; person null");
                return null;
            }

            const reportedStatus = person.custom.sddmStatus;
            if (reportedStatus === SDMMStatus[SDMMStatus.D0PRE]) {
                // don't bother, let checkStatus do it right
                return false;
            }

            // TODO: actually do this if it looks like getStatus is proving to be too slow

            return false;

        } catch (err) {
            Log.info("CourseController::checkStatus(..) - ERROR: " + err);
        }
    }
*/

    private async provisionD0Repo(personId: string): Promise<Payload> {
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("CourseController::provisionD0Repo( " + org + ", " + personId + " ) - start");
        const start = Date.now();

        try {
            const name = personId;
            const person = await this.pc.getPerson(name);
            const teamName = name;
            const repoName = CourseController.getProjectPrefix() + teamName;

            if (person === null) {
                // return early
                return {failure: {shouldLogout: false, message: "Username not registered; contact course staff."}};
            }

            let personStatus = await this.computeStatusString(personId);
            if (personStatus !== SDMMStatus[SDMMStatus.D0PRE]) {
                Log.info("CourseController::provisionD0Repo( " + org + ", " + personId + " ) - bad status: " + personStatus);
                return {failure: {shouldLogout: false, message: "User is not eligible for D0."}};
            } else {
                Log.info("CourseController::provisionD0Repo( " + org + ", " + personId + " ) - correct status: " + personStatus);
            }

            // create local team
            let existingTeam = await this.tc.getTeam(teamName);
            if (existingTeam !== null) {
                // team already exists; warn and fail
                throw new Error("CourseController::provisionD0Repo(..) - team already exists: " + teamName);
            }
            const teamCustom = {sdmmd0: true, sdmmd1: false, sdmmd2: false, sdmmd3: false}; // d0 team for now
            const team = await this.tc.createTeam(teamName, [person], teamCustom);

            // create local repo
            let existingRepo = await this.rc.getRepository(repoName);
            if (existingRepo !== null) {
                // repo already exists; warn and fail
                throw new Error("CourseController::provisionD0Repo(..) - repo already exists: " + repoName);
            }
            const repoCustom = {d0enabled: true, d1enabled: false, d2enabled: false, d3enabled: false, sddmD3pr: false}; // d0 repo for now
            const repo = await this.rc.createRepository(repoName, [team], repoCustom);

            // create remote repo
            const INPUTREPO = "https://github.com/SECapstone/bootstrap"; // HARDCODED for SDMM D0
            // set to the backendUrl:backendPort, not autotestUrl:autotestPort since the backend will be publicly visible
            const WEBHOOKADDR = Config.getInstance().getProp(ConfigKey.backendUrl) + ':' + Config.getInstance().getProp(ConfigKey.backendPort) + '/githubWebhook';
            const provisionResult = await this.gh.provisionRepository(repoName, [team], INPUTREPO, WEBHOOKADDR);

            if (provisionResult === true) {
                Log.info("CourseController::provisionD0Repo(..) - d0 github provisioning successful");

                // update local team and repo with github values
                const repoUrl = await this.gh.getRepositoryUrl(repo);
                repo.URL = repoUrl;
                this.dc.writeRepository(repo);

                const teamUrl = await this.gh.getTeamUrl(team);
                team.url = teamUrl;
                this.dc.writeTeam(team);

                // create grade entry
                let grade: GradePayload = {
                    score:     -1,
                    comment:   'Repo Provisioned',
                    URL:       repo.URL,
                    timestamp: Date.now(),
                    custom:    {}
                };
                await this.gc.createGrade(repo.id, 'd0', grade);

                const statusPayload = await this.getStatus(personId);
                Log.info("CourseController::provisionD0Repo(..) - d0 final provisioning successful; took: " + Util.took(start));

                return {success: {message: "Repository successfully created.", status: statusPayload}};
            } else {
                Log.error("CourseController::provisionD0Repo(..) - something went wrong provisioning this repo; see logs above.");

                // d0pre people should not have teams
                const delTeam = await this.dc.deleteTeam(team);
                // d0pre people should not have repos
                const delRepo = await this.dc.deleteRepository(repo);
                Log.info("CourseController::provisionD0Repo(..) - team removed: " + delTeam + ", repo removed: " + delRepo);

                return {failure: {shouldLogout: false, message: "Error provisioning d0 repo."}};
            }
        } catch (err) {
            Log.error("CourseController::provisionD0Repo(..) - ERROR: " + err);
            return {failure: {shouldLogout: false, message: "Error creating d0 repo; contact course staff."}};
        }
    }

    private async updateIndividualD0toD1(personId: string): Promise<Payload> {
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("CourseController::updateIndividualD0toD1( " + org + ", " + personId + " ) - start");
        const start = Date.now();

        try {
            // make sure person exists
            const person = await this.pc.getPerson(personId);
            if (person === null) {
                Log.error("CourseController::updateIndividualD0toD1(..) - person does not exist: " + personId);
                return {failure: {shouldLogout: false, message: "Username not registered with course."}};
            }

            // make sure the person has suffient d0 grade
            let grade = await this.gc.getGrade(personId, "d0"); // make sure they can move on
            if (grade === null || grade.score < 60) {
                Log.error("CourseController::updateIndividualD0toD1(..) - person does not exist: " + personId);
                return {failure: {shouldLogout: false, message: "Current d0 grade is not sufficient to move on to d1."}};
            }

            // make sure the person does not already have a d1 repo
            let myRepos = await this.rc.getReposForPerson(person);
            for (const r of myRepos) {
                if (r.custom.d1enabled === true) {
                    Log.error("CourseController::updateIndividualD0toD1(..) - person already has a d1 repo: " + r.id);
                    return {failure: {shouldLogout: false, message: "D1 repo has already been assigned: " + r.id}};
                }
            }

            let personStatus = await this.computeStatusString(personId);
            if (personStatus !== SDMMStatus[SDMMStatus.D1UNLOCKED]) {
                Log.info("CourseController::updateIndividualD0toD1( " + org + ", " + personId + " ) - bad status: " + personStatus);
            } else {
                Log.info("CourseController::updateIndividualD0toD1( " + org + ", " + personId + " ) - correct status: " + personStatus);
            }

            const name = personId;
            // const person = await this.pc.getPerson(org, name);
            const teamName = name;
            const repoName = CourseController.getProjectPrefix() + teamName;

            // find local team & repo
            const team = await this.tc.getTeam(teamName);
            const repo = await this.rc.getRepository(repoName);

            if (team !== null && repo !== null) {
                // custom should be {d0enabled: true, d1enabled: true, d2enabled: false, d3enabled: false, sddmD3pr: false};
                repo.custom.d1enabled = true;
                await this.dc.writeRepository(repo);

                // team custom should be {sdmmd0: true, sdmmd1: true, sdmmd2: true, sdmmd3: true};
                team.custom.sdmmd1 = true;
                team.custom.sdmmd2 = true;
                team.custom.sdmmd3 = true;
                await this.dc.writeTeam(team);

                // create grade entries
                let grade: GradePayload = {
                    score:     -1,
                    comment:   'Repo Provisioned',
                    URL:       repo.URL,
                    timestamp: Date.now(),
                    custom:    {}
                };
                await this.gc.createGrade(repo.id, 'd1', grade);
                await this.gc.createGrade(repo.id, 'd2', grade);
                await this.gc.createGrade(repo.id, 'd3', grade);
            } else {
                Log.error("CourseController::updateIndividualD0toD1(..) - unable to find team: " + teamName + ' or repo: ' + repoName);
                return {failure: {shouldLogout: false, message: "Invalid team updating d0 repo; contact course staff."}};
            }

            const statusPayload = await this.getStatus(personId);
            Log.info("CourseController::updateIndividualD0toD1(..) - d0 to d1 individual upgrade successful; took: " + Util.took(start));
            return {success: {message: "D0 repo successfully updated to D1.", status: statusPayload}};
        } catch (err) {
            Log.error("CourseController::updateIndividualD0toD1(..) - ERROR: " + err);
            return {failure: {shouldLogout: false, message: "Error updating d0 repo; contact course staff."}};
        }
    }

    /**
     * @param {string[]} peopleIds order matters here: the requestor should be peopleIds[0]
     * @returns {Promise<Payload>}
     */
    private async provisionD1Repo(peopleIds: string[]): Promise<Payload> {
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("CourseController::provisionD1Repo( " + org + ", " + JSON.stringify(peopleIds) + " ) - start");
        const start = Date.now();

        try {
            // seems complicated, but we need team names that are unique
            // but with lots of people signing up at once we can't rely on a counter
            // especially since full provisioning will take a long time (e.g., 60+ seconds)
            let teamName: string | null = null;
            while (teamName === null) {
                let str = crypto.randomBytes(256).toString('hex');
                str = str.substr(0, 6);
                const name = CourseController.getTeamPrefix() + str; // team prefix
                Log.trace("CourseController::provisionD1Repo(..) - checking name: " + str);
                let team = await this.tc.getTeam(str);
                if (team === null) {
                    teamName = str;
                    Log.trace("CourseController::provisionD1Repo(..) - name available; using: " + teamName);
                }
            }

            let people: Person[] = [];
            for (const pid of peopleIds) {
                let person = await this.dc.getPerson(pid); // make sure the person exists
                if (person !== null) {
                    let grade = await this.gc.getGrade(pid, "d0"); // make sure they can move on
                    if (grade !== null && grade.score > 59) {
                        people.push(person)
                    } else {
                        return {
                            failure: {
                                shouldLogout: false,
                                message:      "All teammates must have achieved a score of 60% or more to join a team."
                            }
                        };
                    }
                } else {
                    return {
                        failure: {
                            shouldLogout: false,
                            message:      "Unknown person " + pid + " requested to be on team; please make sure they are registered with the course."
                        }
                    };
                }
            }

            for (const p of people) {
                let personStatus = await this.computeStatusString(p.id);
                if (personStatus !== SDMMStatus[SDMMStatus.D1UNLOCKED]) {
                    Log.info("CourseController::provisionD1Repo( " + org + ", " + p.id + " ) - bad status: " + personStatus);
                    return {
                        failure: {
                            shouldLogout: false,
                            message:      "All teammates must be eligible to join a team and must not already be performing d1 in another team or on their own."
                        }
                    };
                } else {
                    Log.info("CourseController::provisionD1Repo( " + org + ", " + p.id + " ) - correct status: " + personStatus);
                }
            }

            // create local team
            const teamCustom = {sdmmd0: false, sdmmd1: true, sdmmd2: true, sdmmd3: true}; // configure for project
            const team = await this.tc.createTeam(teamName, people, teamCustom);

            // create local repo
            const repoName = CourseController.getProjectPrefix() + teamName;
            const repoCustom = {d0enabled: false, d1enabled: true, d2enabled: true, d3enabled: true, sddmD3pr: false}; // d0 repo for now
            const repo = await this.rc.createRepository(repoName, [team], repoCustom);

            // create remote repo
            const INPUTREPO = "https://github.com/SECapstone/bootstrap"; // HARDCODED for SDMM
            // set to the backendUrl:backendPort, not autotestUrl:autotestPort since the backend will be publicly visible
            const WEBHOOKADDR = Config.getInstance().getProp(ConfigKey.backendUrl) + ':' + Config.getInstance().getProp(ConfigKey.backendPort) + '/githubWebhook';
            const provisionResult = await this.gh.provisionRepository(repoName, [team], INPUTREPO, WEBHOOKADDR);

            if (provisionResult === true) {
                Log.info("CourseController::provisionD1Repo(..) - d1 github provisioning successful");

                // update local team and repo with github values
                const repoUrl = await this.gh.getRepositoryUrl(repo);
                repo.URL = repoUrl;
                this.dc.writeRepository(repo);

                const teamUrl = await this.gh.getTeamUrl(team);
                team.url = teamUrl;
                this.dc.writeTeam(team);

                // create grade entries
                let grade: GradePayload = {
                    score:     -1,
                    comment:   'Repo Provisioned',
                    URL:       repo.URL,
                    timestamp: Date.now(),
                    custom:    {}
                };
                await this.gc.createGrade(repo.id, 'd1', grade);
                await this.gc.createGrade(repo.id, 'd2', grade);
                await this.gc.createGrade(repo.id, 'd3', grade);

                const statusPayload = await this.getStatus(peopleIds[0]);
                Log.info("CourseController::provisionD1Repo(..) - d1 final provisioning successful; took: " + Util.took(start));
                return {success: {message: "D1 repository successfully provisioned.", status: statusPayload}};
            } else {
                Log.error("CourseController::provisionD1Repo(..) - something went wrong provisioning this repo; see logs above.");
                return {failure: {shouldLogout: false, message: "Error encountered creating d1 repo; contact course staff."}};
            }
        } catch (err) {
            Log.error("CourseController::provisionD1Repo(..) - ERROR: " + err);
            return {failure: {shouldLogout: false, message: "Error encountered provisioning d1 repo; contact course staff."}};
        }
    }

    public async getStatus(personId: string): Promise<StatusPayload> {
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("CourseController::getStatus( " + org + ", " + personId + " ) - start");
        const start = Date.now();

        const myStatus = await this.computeStatusString(personId);

        let myD0: GradePayload = null;
        let myD1: GradePayload = null;
        let myD2: GradePayload = null;
        let myD3: GradePayload = null;

        let d0Grade: Grade = await this.dc.getGrade(personId, 'd0');
        let d1Grade: Grade = await this.dc.getGrade(personId, 'd1');
        let d2Grade: Grade = await this.dc.getGrade(personId, 'd2');
        let d3Grade: Grade = await this.dc.getGrade(personId, 'd3');

        if (d0Grade !== null) {
            myD0 = {
                score:     d0Grade.score,
                URL:       d0Grade.URL,
                comment:   '',
                timestamp: d0Grade.timestamp,
                custom:    {}
            }
        }

        if (d1Grade !== null) {
            myD1 = {
                score:     d1Grade.score,
                URL:       d1Grade.URL,
                comment:   '',
                timestamp: d1Grade.timestamp,
                custom:    {}
            }
        }

        if (d2Grade !== null) {
            myD2 = {
                score:     d2Grade.score,
                URL:       d2Grade.URL,
                comment:   '',
                timestamp: d2Grade.timestamp,
                custom:    {}
            }
        }

        if (d3Grade !== null) {
            myD3 = {
                score:     d3Grade.score,
                URL:       d3Grade.URL,
                comment:   '',
                timestamp: d3Grade.timestamp,
                custom:    {}
            }
        }

        let statusPayload = {
            status: myStatus,
            d0:     myD0,
            d1:     myD1,
            d2:     myD2,
            d3:     myD3
        };

        Log.trace("CourseController::getStatus( " + personId + " ) - took: " + Util.took(start));

        return statusPayload;
    }

    public async handleNewGrade(repoId: string, delivId: string, grade: GradePayload): Promise<boolean> {
        Log.info("CourseController::handleNewGrade( .. ) - start");

        try {
            let peopleIds = await this.rc.getPeopleForRepo(repoId);
            for (const personId of peopleIds) {
                let existingGrade = await this.gc.getGrade(personId, delivId);
                if (existingGrade === null || existingGrade.score < grade.score) {
                    Log.info("CourseController::handleNewGrade( .. ) - grade is higher; updating");
                    this.gc.createGrade(repoId, delivId, grade);
                } else {
                    Log.info("CourseController::handleNewGrade( .. ) - grade is not higher");
                }
            }
            // createGrade(org: string, repoId: string, delivId: string, score: number, comment: string, URL: string, timestamp: number)
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
    private static getProjectPrefix(): string {
        const org = Config.getInstance().getProp(ConfigKey.org);
        if (org === "secapstonetest" || Config.getInstance().getProp(ConfigKey.name) === "secapstonetest") {
            Log.info("CourseController::getProjectPrefix(..) - returning test prefix");
            return "TEST__X__secap_";
        } else {
            return "secap_";
        }
    }

    /**
     * Public static so tests can use them too.
     *
     * @param {string} org
     * @returns {string}
     */
    private static getTeamPrefix() {
        const org = Config.getInstance().getProp(ConfigKey.org);

        if (org === "secapstonetest" || Config.getInstance().getProp(ConfigKey.name) === "secapstonetest") {
            Log.info("CourseController::getTeamPrefix(..) - returning test prefix");
            return "TEST__X__t_";
        } else {
            return "t_";
        }
    }

    public static getOrg(): string | null {
        try {
            const org = Config.getInstance().getProp(ConfigKey.org);
            if (org !== null) {
                return org;
            } else {
                Log.error("CourseController::getOrg() - ERROR: null org");
            }
        } catch (err) {
            Log.error("CourseController::getOrg() - ERROR: " + err.message);
        }
        return null;
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
}
