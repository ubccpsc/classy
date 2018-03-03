import Log from "../util/Log";
import Util from "../util/Util";
import {RepositoryController} from "./RepositoryController";
import {DatabaseController} from "./DatabaseController";
import {GradesController} from "./GradesController";
import {Grade, Person, Team} from "../Types";
import {IGitHubController} from "./GitHubController";
import {TeamController} from "./TeamController";
import {PersonController} from "./PersonController";

import * as crypto from 'crypto';

export interface Payload {
    success?: ActionPayload | StatusPayload; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface FailurePayload {
    message: string;
    shouldLogout: boolean; // almost always false
}

export interface ActionPayload {
    message: string;
    status: StatusPayload; // if an action was successful we should send the current status
}

export interface StatusPayload {
    status: string;
    d0: GradePayload | null;
    d1: GradePayload | null;
    d2: GradePayload | null;
    d3: GradePayload | null;
}

export interface GradePayload {
    score: number; // grade: < 0 will mean 'N/A' in the UI

    url: string; // commit URL if known, otherwise repo url

    timestamp: number; // even if grade < 0 might as well return when the entry was made
}

export enum SDDMStatus {
    D0PRE,
    D0,
    D1UNLOCKED,
    D1TEAMSET,
    D1,
    D2,
    D3PRE,
    D3
}

export class SDDMController {

    private dc = DatabaseController.getInstance();
    private pc = new PersonController();
    private rc = new RepositoryController();
    private tc = new TeamController();
    private gc = new GradesController();
    private gh: IGitHubController = null;

    constructor(ghController: IGitHubController) {
        Log.trace("SDDMController::<init> - start");
        this.gh = ghController;
    }

    public async handleUnknownUser(org: string, githubUsername: string): Promise<Person | null> {
        Log.info("SDDMController::handleUnknownUser( " + org + ", " + githubUsername + " ) - start");
        if (org === 'secapstone' || org === 'secapstonetest') {
            Log.info("SDDMController::handleUnknownUser(..) - new person for this org; - provisioning");

            // in the secapstone we don't know who the students are in advance
            // in this case, we will create Person objects on demand

            // make person
            let newPerson: Person = {
                id:            githubUsername,
                csId:          githubUsername, // sdmm doesn't have these
                githubId:      githubUsername,
                studentNumber: null,

                org:    org,
                fName:  '',
                lName:  '',
                kind:   'student',
                url:    'https://github.com/' + githubUsername,
                labId:  'UNKNOWN',
                custom: {}
            };

            newPerson.custom.sdmmStatus = 'd0pre';

            // add to database
            await this.dc.writePerson(newPerson);
            return newPerson;
        }

        Log.error("SDDMController::handleUnknownUser() - not a SDDM org");
        return null;
    }

    /**
     * Performs a complete provisioning task for a given deliverable and set of people.
     *
     * @param {string} org
     * @param {string} delivId
     * @param {string[]} peopleIds people order matters; requestor should be peopleIds[0]
     * @returns {Promise<ResponsePayload>}
     */
    public async provision(org: string, delivId: string, peopleIds: string[]): Promise<Payload> {
        Log.info("SDDMController::provision( " + org + ", " + delivId + ", ... ) - start");

        try {
            if (org !== "secapstone" && org !== "secapstonetest") {
                Log.error("SDDMController::provision(..) - SDDMController should not be used for other orgs");
                return {failure: {shouldLogout: false, message: "Invalid org; contact course staff."}};
            }

            if (peopleIds.length < 1) {
                Log.error("SDDMController::provision(..) - there needs to be at least one person on a repo");
                return {failure: {shouldLogout: false, message: "Invalid # of people; contact course staff."}};
            }

            if (delivId === "d0") {
                if (peopleIds.length === 1) {
                    Log.info("SDDMController::provision(..) - provisioning new d0 repo for " + peopleIds[0]);
                    return await this.provisionD0Repo(org, peopleIds[0]);
                } else {
                    Log.error("SDDMController::provision(..) - d0 repos are only for individuals");
                    return {failure: {shouldLogout: false, message: "D0 for indivduals only; contact course staff."}};
                }
            } else if (delivId === "d1") {

                if (peopleIds.length === 1) {
                    Log.info("SDDMController::provision(..) - updating existing d0 repo to d1 for " + peopleIds[0]);
                    return await this.updateIndividualD0toD1(org, peopleIds[0]);
                } else if (peopleIds.length === 2) {
                    Log.info("SDDMController::provision(..) - provisioning new d1 repo for " + JSON.stringify(peopleIds));
                    if (peopleIds[0] !== peopleIds[1]) {
                        return await this.provisionD1Repo(org, peopleIds);
                    } else {
                        Log.error("SDDMController::provision(..) - d1 duplicate users");
                        return {failure: {shouldLogout: false, message: "D1 duplicate users; contact course staff."}};
                    }
                } else {
                    Log.error("SDDMController::provision(..) - d1 can only be performed by single students or pairs of students.");
                    return {failure: {shouldLogout: false, message: "D1 can only be performed by single students or pairs of students."}};
                }
            } else {
                Log.warn("SDDMController::provision(..) - new repo not needed for delivId: " + delivId);
                return {failure: {shouldLogout: false, message: "Repo not needed; contact course staff."}};
            }
        } catch (err) {
            Log.error("SDDMController::provision(..) - ERROR: " + err);
            return {failure: {shouldLogout: false, message: "Unknown error creating repo; contact course staff."}};
        }

    }

    /**
     *
     * This confirms the SDDM status. The approach is conservative (and hence slow).
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
     * @returns {Promise<string>} null if the personId is not even known
     */
    public async getStatus(org: string, personId: string): Promise<string | null> {
        Log.info("SDDMController::getStatus( " + org + ', ' + personId + ' ) - start');
        const start = Date.now();
        try {
            const person = await this.dc.getPerson(org, personId);
            if (person === null) {
                Log.info("SDDMController::getStatus(..) - ERROR; person null");
                return null;
            }

            const reportedStatus = person.custom.sddmStatus;
            // most of the time the status doesn't change, so let's just check that first:
            const statusCorrect = await this.checkStatus(org, personId);
            if (statusCorrect === true) {
                Log.info("SDDMController::getStatus(..) - check successful; skipping");
                return reportedStatus;
            }

            let currentStatus = SDDMStatus[SDDMStatus.D0PRE]; // start with the lowest status and work up

            // D0PRE
            if (currentStatus === SDDMStatus[SDDMStatus.D0PRE]) {
                // make sure d0 doesn't exist for a person, if it does, make them D0

                let d0Repo = null;
                let repos = await this.rc.getReposForPerson(person);
                for (const r of repos) {
                    if (r.custom.d0enabled === true) {
                        d0Repo = r;
                    }

                    if (d0Repo !== null) {
                        Log.info("SDDMController::getStatus(..) - elevating D0PRE to D0");
                        currentStatus = SDDMStatus[SDDMStatus.D0];
                    } else {
                        Log.info("SDDMController::getStatus(..) - NOT elevating from D0PRE");
                    }
                }
            }

            // D0
            if (currentStatus === SDDMStatus[SDDMStatus.D0]) {
                // if their d0 score >= 60, make them D1UNLOCKED
                const d0Grade = await this.dc.getGrade(org, personId, "d0");
                if (d0Grade && d0Grade.score >= 60) {
                    Log.info("SDDMController::getStatus(..) - elevating D0 to D1UNLOCKED");
                    currentStatus = SDDMStatus[SDDMStatus.D1UNLOCKED];
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D0");
                }
            }

            // D1UNLOCKED
            if (currentStatus === SDDMStatus[SDDMStatus.D1UNLOCKED]) {
                // if they have a d1 team, make them D1TEAMSET
                const teams = await this.dc.getTeamsForPerson(org, personId);

                let d1team: Team = null;
                for (const t of teams) {
                    if (t.custom.sdmmd1 === true) {
                        d1team = t;
                    }
                }

                if (d1team !== null) {
                    Log.info("SDDMController::getStatus(..) - elevating D1UNLOCKED to D1TEAMSET");
                    currentStatus = SDDMStatus[SDDMStatus.D1TEAMSET];
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D1UNLOCKED");
                }
            }

            // D1TEAMSET
            if (currentStatus === SDDMStatus[SDDMStatus.D1TEAMSET]) {
                // if they have a d1 repo, make them D1
                const repos = await this.rc.getReposForPerson(person);
                let d1repo = null;
                for (const r of repos) {
                    if (r.custom.d1enabled === true) {
                        d1repo = r;
                    }
                }
                if (d1repo !== null) {
                    Log.info("SDDMController::getStatus(..) - elevating D1TEAMSET to D1");
                    currentStatus = SDDMStatus[SDDMStatus.D1];
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D1TEAMSET");
                }
            }

            // D1
            if (currentStatus === SDDMStatus[SDDMStatus.D1]) {
                // if their d1 score > 60, make them D2
                let d1Grade = await this.gc.getGrade(org, personId, "d1");
                if (d1Grade && d1Grade.score >= 60) {
                    Log.info("SDDMController::getStatus(..) - elevating D1 to D2");
                    let allRepos = await this.rc.getReposForPerson(person);
                    for (const r of allRepos) {
                        if (r.custom.d1enabled === true) {
                            // is a project repo
                            r.custom.d2enabled = true;
                            await this.dc.writeRepository(r);
                        }
                    }
                    currentStatus = SDDMStatus[SDDMStatus.D2];
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D1");
                }
            }

            // D2
            if (currentStatus === SDDMStatus[SDDMStatus.D2]) {
                // if their d2 core > 60, make them D3PRE
                let d2Grade = await this.gc.getGrade(org, personId, "d2");
                if (d2Grade && d2Grade.score >= 60) {
                    Log.info("SDDMController::getStatus(..) - elevating D2 to D3PRE");
                    currentStatus = SDDMStatus[SDDMStatus.D3PRE];
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D2");
                }
            }

            // D3PRE
            if (currentStatus === SDDMStatus[SDDMStatus.D3PRE]) {
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
                    Log.info("SDDMController::getStatus(..) - elevating D3PRE to D3");
                    currentStatus = SDDMStatus[SDDMStatus.D3];// "D3";
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D3PRE");
                }
            }

            // D3
            // nothing else to be done
            if (currentStatus === SDDMStatus[SDDMStatus.D3]) {
                let allRepos = await this.rc.getReposForPerson(person);
                for (const r of allRepos) {
                    if (r.custom.d2enabled === true) {
                        // is a project repo
                        r.custom.d3enabled = true;
                        await this.dc.writeRepository(r);
                    }
                }
                Log.info("SDDMController::getStatus(..) - NOT elevating from D3");
            }

            // let currentStatus = person.custom.sddmStatus;
            person.custom.sddmStatus = currentStatus;
            this.dc.writePerson(person);

            Log.info("SDDMController::getStatus( " + org + ', ' + personId + ' ) - done; took: ' + Util.took(start));
            return currentStatus;
        }
        catch
            (err) {
            Log.error("SDDMController::getStatus( " + org + ', ' + personId + ' ) - ERROR: ' + err);
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
    private async checkStatus(org: string, personId: string): Promise<boolean> {
        Log.info("SDDMController::getStatus( " + org + ', ' + personId + ' ) - start');
        const start = Date.now();
        try {
            const person = await this.dc.getPerson(org, personId);
            if (person === null) {
                Log.info("SDDMController::checkStatus(..) - ERROR; person null");
                return null;
            }

            const reportedStatus = person.custom.sddmStatus;
            if (reportedStatus === SDDMStatus[SDDMStatus.D0PRE]) {
                // don't bother, let checkStatus do it right
                return false;
            }

            // TODO: actually do this if it looks like getStatus is proving to be too slow

            return false;

        } catch (err) {
            Log.info("SDDMController::checkStatus(..) - ERROR: " + err);
        }
    }

    private async provisionD0Repo(org: string, personId: string): Promise<Payload> {
        Log.info("SDDMController::provisionD0Repo( " + org + ", " + personId + " ) - start");
        const start = Date.now();

        try {
            const name = personId;
            const person = await this.pc.getPerson(org, name);
            const teamName = name;
            const repoName = "secap_" + teamName;

            if (person === null) {
                // return early
                return {failure: {shouldLogout: false, message: "Username not registered; contact course staff."}};
            }

            let personStatus = await this.getStatus(org, personId);
            if (personStatus !== SDDMStatus[SDDMStatus.D0PRE]) {
                Log.info("SDDMController::provisionD0Repo( " + org + ", " + personId + " ) - bad status: " + personStatus);
            } else {
                Log.info("SDDMController::provisionD0Repo( " + org + ", " + personId + " ) - correct status: " + personStatus);
            }

            // create local team
            const teamCustom = {sdmmd0: true, sdmmd1: false, sdmmd2: false, sdmmd3: false}; // d0 team for now
            const team = await this.tc.createTeam(org, teamName, [person], teamCustom);

            // create local repo
            const repoCustom = {d0enabled: true, d1enabled: false, d2enabled: false, d3enabled: false, sddmD3pr: false}; // d0 repo for now
            const repo = await this.rc.createRepository(org, repoName, [team], repoCustom);

            // create remote repo
            const INPUTREPO = "https://github.com/SECapstone/bootstrap.git"; // HARDCODED for SDMM D0
            const WEBHOOKADDR = "https://sdmm.cs.ubc.ca:11333/submit"; // HARDCODED for SDMM
            const provisionResult = await this.gh.provisionRepository(org, repoName, [team], INPUTREPO, WEBHOOKADDR);

            if (provisionResult === true) {
                Log.info("SDDMController::provisionD0Repo(..) - d0 github provisioning successful");

                // update local team and repo with github values
                const repoUrl = await this.gh.getRepositoryUrl(repo);
                repo.url = repoUrl;
                this.dc.writeRepository(repo);

                const teamUrl = await this.gh.getTeamUrl(team);
                team.url = teamUrl;
                this.dc.writeTeam(team);

                // create grade entry
                await this.gc.createGrade(org, repo.id, 'd0', -1, 'Repo Provisioned', repo.url, Date.now());

                const statusPayload = await this.createStatusPayload(org, personId);
                Log.info("SDDMController::provisionD0Repo(..) - d0 final provisioning successful; took: " + Util.took(start));

                return {success: {message: "Repository successfully created.", status: statusPayload}};
            } else {
                Log.error("SDDMController::provisionD0Repo(..) - something went wrong provisioning this repo; see logs above.");
                return {failure: {shouldLogout: false, message: "Error provisioning d0 repo; contact course staff."}};
            }
        } catch (err) {
            Log.error("SDDMController::provisionD0Repo(..) - ERROR: " + err);
            return {failure: {shouldLogout: false, message: "Error creating d0 repo; contact course staff."}};
        }
    }

    private async updateIndividualD0toD1(org: string, personId: string): Promise<Payload> {
        Log.info("SDDMController::updateIndividualD0toD1( " + org + ", " + personId + " ) - start");
        const start = Date.now();

        try {
            // make sure person exists
            const person = await this.pc.getPerson(org, personId);
            if (person === null) {
                Log.error("SDDMController::updateIndividualD0toD1(..) - person does not exist: " + personId);
                return {failure: {shouldLogout: false, message: "Username not registered with course."}};
            }

            // make sure the person has suffient d0 grade
            let grade = await this.gc.getGrade(org, personId, "d0"); // make sure they can move on
            if (grade === null || grade.score < 60) {
                Log.error("SDDMController::updateIndividualD0toD1(..) - person does not exist: " + personId);
                return {failure: {shouldLogout: false, message: "Current d0 grade is not sufficient to move on to d1."}};
            }

            // make sure the person does not already have a d1 repo
            let myRepos = await this.rc.getReposForPerson(person);
            for (const r of myRepos) {
                if (r.custom.d1enabled === true) {
                    Log.error("SDDMController::updateIndividualD0toD1(..) - person already has a d1 repo: " + r.id);
                    return {failure: {shouldLogout: false, message: "D1 repo has already been assigned: " + r.id}};
                }
            }

            let personStatus = await this.getStatus(org, personId);
            if (personStatus !== SDDMStatus[SDDMStatus.D1UNLOCKED]) {
                Log.info("SDDMController::updateIndividualD0toD1( " + org + ", " + personId + " ) - bad status: " + personStatus);
            } else {
                Log.info("SDDMController::updateIndividualD0toD1( " + org + ", " + personId + " ) - correct status: " + personStatus);
            }

            const name = personId;
            // const person = await this.pc.getPerson(org, name);
            const teamName = name;
            const repoName = "secap_" + teamName;

            // find local team & repo
            const team = await this.tc.getTeam(org, teamName);
            const repo = await this.rc.getRepository(org, repoName);

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
                await this.gc.createGrade(org, repo.id, 'd1', -1, 'Repo Provisioned', repo.url, Date.now());
                await this.gc.createGrade(org, repo.id, 'd2', -1, 'Repo Provisioned', repo.url, Date.now());
                await this.gc.createGrade(org, repo.id, 'd3', -1, 'Repo Provisioned', repo.url, Date.now());
            } else {
                Log.error("SDDMController::updateIndividualD0toD1(..) - unable to find team: " + teamName + ' or repo: ' + repoName);
                return {failure: {shouldLogout: false, message: "Invalid team updating d0 repo; contact course staff."}};
            }

            const statusPayload = await this.createStatusPayload(org, personId);
            Log.info("SDDMController::updateIndividualD0toD1(..) - d0 to d1 individual upgrade successful; took: " + Util.took(start));
            return {success: {message: "D0 repo successfully updated to D1.", status: statusPayload}};
        } catch (err) {
            Log.error("SDDMController::updateIndividualD0toD1(..) - ERROR: " + err);
            return {failure: {shouldLogout: false, message: "Error updating d0 repo; contact course staff."}};
        }
    }

    /**
     * @param {string} org
     * @param {string[]} peopleIds order matters here: the requestor should be peopleIds[0]
     * @returns {Promise<Payload>}
     */
    private async provisionD1Repo(org: string, peopleIds: string[]): Promise<Payload> {
        Log.info("SDDMController::provisionD1Repo( " + org + ", " + JSON.stringify(peopleIds) + " ) - start");
        const start = Date.now();

        try {
            // seems complicated, but we need team names that are unique
            // but with lots of people signing up at once we can't rely on a counter
            // especially since full provisioning will take a long time (e.g., 60+ seconds)
            let teamName: string | null = null;
            while (teamName === null) {
                let str = crypto.randomBytes(256).toString('hex');
                str = str.substr(0, 6);
                const name = "t_" + str; // team prefix
                Log.trace("SDDMController::provisionD1Repo(..) - checking name: " + str);
                let team = await this.tc.getTeam(org, str);
                if (team === null) {
                    teamName = str;
                    Log.trace("SDDMController::provisionD1Repo(..) - name available; using: " + teamName);
                }
            }

            let people: Person[] = [];
            for (const pid of peopleIds) {
                let person = await this.dc.getPerson(org, pid); // make sure the person exists
                if (person !== null) {
                    let grade = await this.gc.getGrade(org, pid, "d0"); // make sure they can move on
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
                let personStatus = await this.getStatus(org, p.id);
                if (personStatus !== SDDMStatus[SDDMStatus.D1UNLOCKED]) {
                    Log.info("SDDMController::provisionD1Repo( " + org + ", " + p.id + " ) - bad status: " + personStatus);
                    return {
                        failure: {
                            shouldLogout: false,
                            message:      "All teammates must be eligible to join a team."
                        }
                    };
                } else {
                    Log.info("SDDMController::provisionD1Repo( " + org + ", " + p.id + " ) - correct status: " + personStatus);
                }
            }

            // create local team
            const teamCustom = {sdmmd0: false, sdmmd1: true, sdmmd2: true, sdmmd3: true}; // configure for project
            const team = await this.tc.createTeam(org, teamName, people, teamCustom);

            // create local repo
            const repoName = "secap_" + teamName;
            const repoCustom = {d0enabled: false, d1enabled: true, d2enabled: true, d3enabled: true, sddmD3pr: false}; // d0 repo for now
            const repo = await this.rc.createRepository(org, repoName, [team], repoCustom);

            // create remote repo
            const INPUTREPO = "https://github.com/SECapstone/bootstrap.git"; // HARDCODED for SDMM
            const WEBHOOKADDR = "https://sdmm.cs.ubc.ca:11333/submit"; // HARDCODED for SDMM
            const provisionResult = await this.gh.provisionRepository(org, repoName, [team], INPUTREPO, WEBHOOKADDR);

            if (provisionResult === true) {
                Log.info("SDDMController::provisionD1Repo(..) - d1 github provisioning successful");

                // update local team and repo with github values
                const repoUrl = await this.gh.getRepositoryUrl(repo);
                repo.url = repoUrl;
                this.dc.writeRepository(repo);

                const teamUrl = await this.gh.getTeamUrl(team);
                team.url = teamUrl;
                this.dc.writeTeam(team);

                // create grade entries
                await this.gc.createGrade(org, repo.id, 'd1', -1, 'Repo Provisioned', repo.url, Date.now());
                await this.gc.createGrade(org, repo.id, 'd2', -1, 'Repo Provisioned', repo.url, Date.now());
                await this.gc.createGrade(org, repo.id, 'd3', -1, 'Repo Provisioned', repo.url, Date.now());

                const statusPayload = await this.createStatusPayload(org, peopleIds[0]);
                Log.info("SDDMController::provisionD1Repo(..) - d1 final provisioning successful; took: " + Util.took(start));
                return {success: {message: "D1 repository successfully provisioned.", status: statusPayload}};
            } else {
                Log.error("SDDMController::provisionD1Repo(..) - something went wrong provisioning this repo; see logs above.");
                return {failure: {shouldLogout: false, message: "Error encountered creating d1 repo; contact course staff."}};
            }
        } catch (err) {
            Log.error("SDDMController::provisionD1Repo(..) - ERROR: " + err);
            return {failure: {shouldLogout: false, message: "Error encountered provisioning d1 repo; contact course staff."}};
        }
    }

    private async createStatusPayload(org: string, personId: string): Promise<StatusPayload> {
        const myStatus = await this.getStatus(org, personId);

        let myD0: GradePayload = null;
        let myD1: GradePayload = null;
        let myD2: GradePayload = null;
        let myD3: GradePayload = null;

        let d0Grade: Grade = await this.dc.getGrade(org, personId, 'd0');
        let d1Grade: Grade = await this.dc.getGrade(org, personId, 'd1');
        let d2Grade: Grade = await this.dc.getGrade(org, personId, 'd2');
        let d3Grade: Grade = await this.dc.getGrade(org, personId, 'd3');

        if (d0Grade !== null) {
            myD0 = {
                score:     d0Grade.score,
                url:       d0Grade.url,
                timestamp: d0Grade.timestamp
            }
        }

        if (d1Grade !== null) {
            myD1 = {
                score:     d1Grade.score,
                url:       d1Grade.url,
                timestamp: d1Grade.timestamp
            }
        }

        if (d2Grade !== null) {
            myD2 = {
                score:     d2Grade.score,
                url:       d2Grade.url,
                timestamp: d2Grade.timestamp
            }
        }

        if (d3Grade !== null) {
            myD3 = {
                score:     d3Grade.score,
                url:       d3Grade.url,
                timestamp: d3Grade.timestamp
            }
        }

        let statusPayload = {
            status: myStatus,
            d0:     myD0,
            d1:     myD1,
            d2:     myD2,
            d3:     myD3
        };

        return statusPayload;
    }
}