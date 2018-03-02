import Log from "../util/Log";
import Util from "../util/Util";
import {RepositoryController} from "./RepositoryController";
import {DatabaseController} from "./DatabaseController";
import {GradesController} from "./GradesController";
import {Person, Team} from "../Types";
import {IGitHubController} from "./GitHubController";
import {TeamController} from "./TeamController";
import {PersonController} from "./PersonController";

import * as crypto from 'crypto';

export interface ResponsePayload {
    success: boolean;
    message: string;
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

    public async createRepo(org: string, delivId: string, peopleIds: string[]): Promise<ResponsePayload> {
        Log.info("SDDMController::createRepo( " + org + ", " + delivId + ", " + JSON.stringify(peopleIds) + " ) - start");

        try {
            if (org !== "secapstone" && org !== "secapstonetest") {
                Log.error("SDDMController::createRepo(..) - SDDMController should not be used for other orgs");
                return {success: false, message: "Invalid org; contact course staff."};
            }

            if (peopleIds.length < 1) {
                Log.error("SDDMController::createRepo(..) - there needs to be at least one person on a repo");
                return {success: false, message: "Invalid # of people; contact course staff."};
            }

            if (delivId === "d0") {
                if (peopleIds.length === 1) {
                    Log.info("SDDMController::createRepo(..) - provisioning new d0 repo for " + peopleIds[0]);
                    return await this.provisionD0Repo(org, peopleIds[0]);
                } else {
                    Log.error("SDDMController::createRepo(..) - d0 repos are only for individuals");
                    return {success: false, message: "D0 for indivduals only; contact course staff."};
                }
            } else if (delivId === "d1") {

                if (peopleIds.length === 1) {
                    Log.info("SDDMController::createRepo(..) - updating existing d0 repo to d1 for " + peopleIds[0]);
                    return await this.updateIndividualD0toD1(org, peopleIds[0]);
                } else {
                    Log.info("SDDMController::createRepo(..) - provisioning new d1 repo for " + JSON.stringify(peopleIds[0]));
                    return await this.provisionD1Repo(org, peopleIds);
                }
            } else {
                Log.warn("SDDMController::createRepo(..) - new repo not needed for delivId: " + delivId);
                return {success: false, message: "Repo not needed; contact course staff."};
            }
        } catch (err) {
            Log.error("SDDMController::createRepo(..) - ERROR: " + err);
            return {success: false, message: "Unknown error creating repo; contact course staff."};
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
        Log.info("XXX::getStatus( " + org + ', ' + personId + ' ) - start');
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
            let currentStatus = "D0PRE";

            // D0PRE
            if (currentStatus === "D0PRE") {
                // make sure d0 doesn't exist for a person, if it does, make them D0

                let d0Repo = null;
                let repos = await this.rc.getReposForPerson(person);
                for (const r of repos) {
                    if (r.custom.d0enabled === true) {
                        d0Repo = r;
                    }

                    if (d0Repo !== null) {
                        Log.info("SDDMController::getStatus(..) - elevating D0PRE to D0");
                        currentStatus = "D0";
                    } else {
                        Log.info("SDDMController::getStatus(..) - NOT elevating from D0PRE");
                    }
                }
            }

            // D0
            if (currentStatus === "D0") {
                // if their d0 score >= 60, make them D1UNLOCKED
                const d0Grade = await this.dc.getGrade(org, personId, "d0");
                if (d0Grade && d0Grade.score >= 60) {
                    Log.info("SDDMController::getStatus(..) - elevating D0 to D1UNLOCKED");
                    currentStatus = "D1UNLOCKED";
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D0");
                }
            }

            // D1UNLOCKED
            if (currentStatus === "D1UNLOCKED") {
                // if they have a d1 team, make them D1TEAMSET
                const teams = await this.dc.getTeamsForPerson(org, personId);

                // XXX: check to see if one of them is a d0 team
                let d1team: Team = null;
                for (const t of teams) {
                    if (t.custom.sdmmd1 === true) {
                        d1team = t;
                    }
                }

                if (d1team !== null) {
                    Log.info("SDDMController::getStatus(..) - elevating D1UNLOCKED to D1TEAMSET");
                    currentStatus = "D1TEAMSET";
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D1UNLOCKED");
                }
            }

            // D1TEAMSET
            if (currentStatus === "D1TEAMSET") {
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
                    currentStatus = "D1";
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D1TEAMSET");
                }
            }

            // D1
            if (currentStatus === "D1") {
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
                    currentStatus = "D2";
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D1");
                }
            }

            // D2
            if (currentStatus === "D2") {
                // if their d2 core > 60, make them D3PRE
                let d2Grade = await this.gc.getGrade(org, personId, "d2");
                if (d2Grade && d2Grade.score >= 60) {
                    Log.info("SDDMController::getStatus(..) - elevating D2 to D3PRE");
                    currentStatus = "D3PRE";
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D2");
                }
            }

            // D3PRE
            if (currentStatus === "D3PRE") {
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
                    currentStatus = "D3";
                } else {
                    Log.info("SDDMController::getStatus(..) - NOT elevating from D3PRE");
                }
            }

            // D3
            // nothing else to be done
            if (currentStatus === "D3") {
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
            Log.error("XXX::getStatus( " + org + ', ' + personId + ' ) - ERROR: ' + err);
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
        Log.info("XXX::getStatus( " + org + ', ' + personId + ' ) - start');
        const start = Date.now();
        try {
            const person = await this.dc.getPerson(org, personId);
            if (person === null) {
                Log.info("SDDMController::checkStatus(..) - ERROR; person null");
                return null;
            }

            const reportedStatus = person.custom.sddmStatus;
            if (reportedStatus === "D0PRE") {
                // don't bother, let checkStatus do it right
                return false;
            }

            // TODO: actually do this if it looks like getStatus is proving to be too slow

            return false;

        } catch (err) {
            Log.info("SDDMController::checkStatus(..) - ERROR: " + err);
        }
    }

    private async provisionD0Repo(org: string, personId: string): Promise<ResponsePayload> {
        Log.info("SDDMController::provisionD0Repo( " + org + ", " + personId + " ) - start");
        const start = Date.now();

        try {
            const name = personId;
            const person = await this.pc.getPerson(org, name);
            const teamName = name;
            const repoName = "secap_" + teamName;

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

                Log.info("SDDMController::provisionD0Repo(..) - d0 final provisioning successful; took: " + Util.took(start));
                return {success: true, message: "Repository successfully created."};
            } else {
                Log.error("SDDMController::provisionD0Repo(..) - something went wrong provisioning this repo; see logs above.");
                return {success: false, message: "Error provisioning d0 repo; contact course staff."};
            }
        } catch (err) {
            Log.error("SDDMController::provisionD0Repo(..) - ERROR: " + err);
            return {success: false, message: "Error creating d0 repo; contact course staff."};
        }
    }

    private async updateIndividualD0toD1(org: string, personId: string): Promise<ResponsePayload> {
        Log.info("SDDMController::updateIndividualD0toD1( " + org + ", " + personId + " ) - start");
        const start = Date.now();

        try {
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
            } else {
                Log.error("SDDMController::updateIndividualD0toD1(..) - unable to find team: " + teamName + ' or repo: ' + repoName);
                return {success: false, message: "Invalid team updating d0 repo; contact course staff."};
            }

            Log.info("SDDMController::updateIndividualD0toD1(..) - d0 to d1 individual upgrade successful; took: " + Util.took(start));
            return {success: true, message: "D0 repo successfully updated to D1."};
        } catch (err) {
            Log.error("SDDMController::updateIndividualD0toD1(..) - ERROR: " + err);
            return {success: false, message: "Error updating d0 repo; contact course staff."};
        }
    }

    private async provisionD1Repo(org: string, peopleIds: string[]): Promise<ResponsePayload> {
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
                            success: false,
                            message: "All teammates must have achieved a score of 60% or more to join a team."
                        };
                    }
                } else {
                    return {
                        success: false,
                        message: "Unknown person " + pid + " requested to be on team; please make sure they are registered with the course."
                    };
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

                Log.info("SDDMController::provisionD1Repo(..) - d1 final provisioning successful; took: " + Util.took(start));
                return {success: true, message: "D1 repository successfully provisioned."};
            } else {
                Log.error("SDDMController::provisionD1Repo(..) - something went wrong provisioning this repo; see logs above.");
                return {success: false, message: "Error encountered creating d1 repo; contact course staff."};
            }
        } catch (err) {
            Log.error("SDDMController::provisionD1Repo(..) - ERROR: " + err);
            return {success: false, message: "Error encountered provisioning d1 repo; contact course staff."};
        }
    }
}