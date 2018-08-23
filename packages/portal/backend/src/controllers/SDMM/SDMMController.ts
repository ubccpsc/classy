import * as crypto from 'crypto';
import Config, {ConfigKey} from "../../../../../common/Config";

import Log from "../../../../../common/Log";
import {GradePayload, Payload, SDMMStatus, StatusPayload} from "../../../../../common/types/SDMMTypes";
import Util from "../../../../../common/Util";
import {Deliverable, Grade, Person, Team} from "../../Types";

import {CourseController} from "../CourseController";
import {IGitHubController} from "../GitHubController";
import {PersonController} from "../PersonController";

/**
 * Handles the SDMM course. This controller is different than for other courses because the SDMM
 * is self-paced. This means learners need to be able to be created and provision repositories
 * on demand based on their performance in the course.
 *
 * The controller is also somewhat more defensive than is normal because the SDMM is open to
 * anyone on the internet, so we are a bit more careful about validating the inputs being
 * provided to the backend than we might normally for a course being offered on campus.
 */
export class SDMMController extends CourseController {

    // /**
    //  * Public static so tests can use them too.
    //  *
    //  * @returns {string}
    //  */
    // public static getProjectPrefix(): string {
    //     const name = Config.getInstance().getProp(ConfigKey.name);
    //     if (name === ConfigCourses.classytest) {
    //         Log.info("SDMMController::getProjectPrefix(..) - returning test prefix");
    //         return "TEST__X__p_";
    //     } else if (name === 'sdmm') {
    //         Log.trace("SDMMController::getProjectPrefix(..) - returning sdmm prefix");
    //         return "secap_";
    //     } else {
    //         // NOTE: non-sdmm courses shouldn't use this...
    //         Log.error("SDMMController::getProjectPrefix(..) - unhandled course: " + name);
    //         return "project_";
    //     }
    // }

    // /**
    //  * Public static so tests can use them too.
    //  *
    //  * @returns {string}
    //  */
    // public static getTeamPrefix() {
    //     const name = Config.getInstance().getProp(ConfigKey.name);
    //
    //     if (name === ConfigCourses.classytest) {
    //         Log.info("SDMMController::getTeamPrefix(..) - returning test prefix");
    //         return "TEST__X__t_";
    //     } else if (name === 'sdmm') {
    //         Log.trace("SDMMController::getTeamPrefix(..) - returning sdmm prefix");
    //         // NOTE: was supposed to be "t_" but we made a mistake in initial deployment so we're stuck with no prefix
    //         return "";
    //     } else {
    //         // NOTE: non-sdmm courses shouldn't use this...
    //         Log.error("SDMMController::getTeamPrefix(..) - unhandled course: " + name);
    //         return "t_";
    //     }
    // }

    private GRADE_TO_ADVANCE = 90;

    public static readonly D0 = 'd0';
    public static readonly D1 = 'd1';
    public static readonly D2 = 'd2';
    public static readonly D3 = 'd3';

    public constructor(ghController: IGitHubController) {
        super(ghController);
    }

    /**
     * Performs a complete provisioning task for a given deliverable and set of people.
     *
     * @param {string} delivId
     * @param {string[]} peopleIds people order matters; requestor should be peopleIds[0]
     * @returns {Promise<Payload>}
     */
    public async provision(delivId: string, peopleIds: string[]): Promise<Payload> {
        Log.info("SDMMController::provision( " + delivId + ", ... ) - start");

        try {
            if (peopleIds.length < 1) {
                Log.error("SDMMController::provision(..) - there needs to be at least one person on a repo");
                throw new Error("Invalid # of people; contact course staff.");
            }

            // sanity check; people have to exist
            for (const peopleId of peopleIds) {
                const person = await this.pc.getGitHubPerson(peopleId);
                if (person === null) {
                    throw new Error("Username ( " + peopleId + " ) not registered; contact course staff.");
                }
            }

            if (delivId === "d0") {
                if (peopleIds.length === 1) {
                    Log.info("SDMMController::provision(..) - provisioning new d0 repo for " + peopleIds[0]);
                    return await this.provisionD0Repo(peopleIds[0]);
                } else {
                    Log.error("SDMMController::provision(..) - d0 repos are only for individuals");
                    throw new Error("D0 for indivduals only; contact course staff.");
                }
            } else if (delivId === "d1") {

                if (peopleIds.length === 1) {
                    Log.info("SDMMController::provision(..) - updating existing d0 repo to d1 for " + peopleIds[0]);
                    return await this.updateIndividualD0toD1(peopleIds[0]);
                } else if (peopleIds.length === 2) {
                    Log.info("SDMMController::provision(..) - provisioning new d1 repo for " + JSON.stringify(peopleIds));
                    if (peopleIds[0] !== peopleIds[1]) {
                        return await this.provisionD1Repo(peopleIds);
                    } else {
                        Log.error("SDMMController::provision(..) - d1 duplicate users");
                        throw new Error("D1 duplicate users; if you wish to work alone, please select 'work individually'.");
                    }
                } else {
                    Log.error("SDMMController::provision(..) - d1 can only be performed by single students or pairs of students.");
                    throw new Error("D1 can only be performed by single students or pairs of students.");
                }
            } else {
                Log.warn("SDMMController::provision(..) - new repo not needed for delivId: " + delivId);
                throw new Error("Repo not needed; contact course staff.");
            }
        } catch (err) {
            Log.error("SDMMController::provision(..) - ERROR: " + err);
            throw new Error(err.message);
        }
    }

    /**
     * SDMM is self-paced so the system needs to decide what status each learner has
     * (e.g., are they on d0, d1, d2, d3) and whether they are eligible to progress
     * to the next deliverable. This calculates the learner's status and allows
     * them to advance if they have met the prerequisites.
     *
     * This also provisions a StatusPayload which returns all existing status information
     * to the learner in their dashboard.
     *
     * @param {string} personId
     * @returns {Promise<StatusPayload>}
     */
    public async getStatus(personId: string): Promise<StatusPayload> {
        Log.info("SDMMController::getStatus( " + personId + " ) - start");
        const start = Date.now();

        const myStatus = await this.computeStatusString(personId);

        let myD0: GradePayload = null;
        let myD1: GradePayload = null;
        let myD2: GradePayload = null;
        let myD3: GradePayload = null;

        const d0Grade: Grade = await this.dc.getGrade(personId, 'd0');
        const d1Grade: Grade = await this.dc.getGrade(personId, 'd1');
        const d2Grade: Grade = await this.dc.getGrade(personId, 'd2');
        const d3Grade: Grade = await this.dc.getGrade(personId, 'd3');

        if (d0Grade !== null) {
            myD0 = {
                score:     d0Grade.score,
                urlName:   d0Grade.urlName,
                URL:       d0Grade.URL,
                comment:   '',
                timestamp: d0Grade.timestamp,
                custom:    {}
            };
        }

        if (d1Grade !== null) {
            myD1 = {
                score:     d1Grade.score,
                urlName:   d1Grade.urlName,
                URL:       d1Grade.URL,
                comment:   '',
                timestamp: d1Grade.timestamp,
                custom:    {}
            };
        }

        if (d2Grade !== null) {
            myD2 = {
                score:     d2Grade.score,
                urlName:   d2Grade.urlName,
                URL:       d2Grade.URL,
                comment:   '',
                timestamp: d2Grade.timestamp,
                custom:    {}
            };
        }

        if (d3Grade !== null) {
            myD3 = {
                score:     d3Grade.score,
                urlName:   d3Grade.urlName,
                URL:       d3Grade.URL,
                comment:   '',
                timestamp: d3Grade.timestamp,
                custom:    {}
            };
        }

        const statusPayload = {
            status: myStatus,
            d0:     myD0,
            d1:     myD1,
            d2:     myD2,
            d3:     myD3
        };

        Log.trace("SDMMController::getStatus( " + personId + " ) - took: " + Util.took(start));
        return statusPayload;
    }

    /**
     * In the SDMM users are not known in advance (aka there is no classlist and we only learn about
     * learners for the first time when they try to login to GitHub). Because of this, when we encounter
     * a GitHub id we have not seen before we need to provision that person as if we always knew about them.
     *
     * This is _NOT_ what traditional courses are going to want to do as it allows _anyone_ to join a course.
     *
     * @param {string} githubUsername
     * @returns {Promise<Person | null>}
     */
    public async handleUnknownUser(githubUsername: string): Promise<Person | null> {
        Log.info("SDMMController::handleUnknownUser( " + githubUsername + " ) - start");

        // in the secapstone we don't know who the students are in advance
        // in this case, we will create Person objects on demand

        // make person
        let newPerson: Person = {
            id:            githubUsername,
            csId:          githubUsername, // sdmm doesn't have these
            githubId:      githubUsername,
            studentNumber: null,

            fName:  '',
            lName:  '',
            kind:   null,
            URL:    'https://github.com/' + githubUsername, // HARDCODE
            labId:  'UNKNOWN',
            custom: {}
        };

        newPerson.custom.sdmmStatus = 'd0pre'; // new users always start in d0pre state

        const pc = new PersonController();
        newPerson = await pc.createPerson(newPerson);

        return newPerson;
    }

    /**
     * Students get their highest grade; no deadlines are enforced since SDMM is self-paced.
     *
     * If the newGrade.score > existingGrade.score, return true.
     *
     * @param {Deliverable} deliv
     * @param {Grade} newGrade
     * @param {Grade} existingGrade
     * @returns {boolean}
     */
    public handleNewAutoTestGrade(deliv: Deliverable, newGrade: Grade, existingGrade: Grade): boolean {
        Log.info("SDMMController:handleNewAutoTestGrade( " + deliv.id + ", " +
            newGrade.personId + ", " + newGrade.score + ", ... ) - start");
        if ((existingGrade === null || newGrade.score > existingGrade.score)) {
            Log.trace("SDMMController:handleNewAutoTestGrade( " + deliv.id + ", " +
                newGrade.personId + ", " + newGrade.score + ", ... ) - returning true");
            return true;
        } else {
            Log.trace("SDMMController:handleNewAutoTestGrade( " + deliv.id + ", " +
                newGrade.personId + ", " + newGrade.score + ", ... ) - returning false");
            return false;
        }
    }

    /**
     *
     * This confirms the SDMM status. The approach is conservative (and hence slow).
     *
     * NOTE: we can try to use checkStatus first to speed itself up if performance ends up being problematic.
     *
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
        Log.info("SDMMController::computeStatusString( " + personId + ' ) - start');
        const start = Date.now();

        try {
            const person = await this.dc.getPerson(personId);
            if (person === null) {
                Log.warn("SDMMController::computeStatusString(..) - person null: " + personId);
                throw new Error('Unknown person: ' + personId);
            }

            // const reportedStatus = person.custom.sdmmStatus;
            // most of the time the status doesn't change, so let's just check that first:
            // const statusCorrect = await this.checkStatus(personId);
            // if (statusCorrect === true) {
            //    Log.info("SDMMController::getStatus(..) - check successful; skipping");
            //    return reportedStatus;
            // }

            let currentStatus = SDMMStatus[SDMMStatus.D0PRE]; // start with the lowest status and work up

            // D0PRE
            if (currentStatus === SDMMStatus[SDMMStatus.D0PRE]) {
                // make sure d0 doesn't exist for a person, if it does, make them D0

                let d0Repo = null;
                const repos = await this.rc.getReposForPerson(person);
                for (const r of repos) {
                    if (r.custom === null) {
                        r.custom = {};
                    }

                    if (typeof r.custom.d0enabled === 'undefined') {
                        r.custom.d0enabled = false; // if we don't know what it is it must be false
                    }

                    if (r.custom.d0enabled === true) {
                        d0Repo = r;
                    }

                    if (d0Repo !== null) {
                        Log.info("SDMMController::computeStatusString(..) - elevating D0PRE to D0");
                        currentStatus = SDMMStatus[SDMMStatus.D0];
                    } else {
                        Log.info("SDMMController::computeStatusString(..) - NOT elevating from D0PRE");
                    }
                }
            }

            // D0
            if (currentStatus === SDMMStatus[SDMMStatus.D0]) {
                // if their d0 score >= GRADE_TO_ADVANCE, make them D1UNLOCKED
                const d0Grade = await this.dc.getGrade(personId, "d0");
                if (d0Grade && d0Grade.score !== null && d0Grade.score >= this.GRADE_TO_ADVANCE) {
                    Log.info("SDMMController::computeStatusString(..) - elevating D0 to D1UNLOCKED");
                    currentStatus = SDMMStatus[SDMMStatus.D1UNLOCKED];
                } else {
                    Log.info("SDMMController::computeStatusString(..) - NOT elevating from D0");
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
                    Log.info("SDMMController::computeStatusString(..) - elevating D1UNLOCKED to D1TEAMSET");
                    currentStatus = SDMMStatus[SDMMStatus.D1TEAMSET];
                } else {
                    Log.info("SDMMController::computeStatusString(..) - NOT elevating from D1UNLOCKED");
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
                    Log.info("SDMMController::computeStatusString(..) - elevating D1TEAMSET to D1");
                    currentStatus = SDMMStatus[SDMMStatus.D1];
                } else {
                    Log.info("SDMMController::computeStatusString(..) - NOT elevating from D1TEAMSET");
                }
            }

            // D1
            if (currentStatus === SDMMStatus[SDMMStatus.D1]) {
                // if their d1 score > GRADE_TO_ADVANCE, make them D2
                const d1Grade = await this.gc.getGrade(personId, "d1");
                if (d1Grade && d1Grade.score !== null && d1Grade.score >= this.GRADE_TO_ADVANCE) {
                    Log.info("SDMMController::computeStatusString(..) - elevating D1 to D2");
                    const allRepos = await this.rc.getReposForPerson(person);
                    for (const r of allRepos) {
                        if (r.custom.d1enabled === true) {
                            // is a project repo
                            r.custom.d2enabled = true;
                            await this.dc.writeRepository(r);
                        }
                    }
                    currentStatus = SDMMStatus[SDMMStatus.D2];
                } else {
                    Log.info("SDMMController::computeStatusString(..) - NOT elevating from D1");
                }
            }

            // D2
            if (currentStatus === SDMMStatus[SDMMStatus.D2]) {
                // if their d2 core > GRADE_TO_ADVANCE, make them D3PRE
                const d2Grade = await this.gc.getGrade(personId, "d2");
                if (d2Grade && d2Grade.score !== null && d2Grade.score >= this.GRADE_TO_ADVANCE) {
                    Log.info("SDMMController::computeStatusString(..) - elevating D2 to D3PRE");
                    currentStatus = SDMMStatus[SDMMStatus.D3PRE];
                } else {
                    Log.info("SDMMController::computeStatusString(..) - NOT elevating from D2");
                }
            }

            // D3PRE
            if (currentStatus === SDMMStatus[SDMMStatus.D3PRE]) {
                // if their d1 repo has custom.sddmD3pr===true, make them D3
                const allRepos = await this.rc.getReposForPerson(person);
                let prComplete = false;
                for (const r of allRepos) {
                    if (r.custom.d2enabled === true && r.custom.sddmD3pr === true) {
                        // is a project repo and has had the pr completed
                        prComplete = true;
                    }
                }
                if (prComplete === true) {
                    Log.info("SDMMController::computeStatusString(..) - elevating D3PRE to D3");
                    currentStatus = SDMMStatus[SDMMStatus.D3]; // "D3";
                } else {
                    Log.info("SDMMController::computeStatusString(..) - NOT elevating from D3PRE");
                }
            }

            // D3
            // nothing else to be done
            if (currentStatus === SDMMStatus[SDMMStatus.D3]) {
                const allRepos = await this.rc.getReposForPerson(person);
                for (const r of allRepos) {
                    if (r.custom.d2enabled === true) {
                        // is a project repo
                        r.custom.d3enabled = true;
                        await this.dc.writeRepository(r);
                    }
                }
                Log.info("SDMMController::computeStatusString(..) - NOT elevating from D3");
            }

            // let currentStatus = person.custom.sdmmStatus;
            person.custom.sdmmStatus = currentStatus;
            await this.dc.writePerson(person);

            Log.info("SDMMController::computeStatusString( " + personId + ' ) - done: ' +
                currentStatus + '; took: ' + Util.took(start));

            return currentStatus;
        } catch (err) {
            Log.error("SDMMController::computeStatusString( " + personId + ' ) - ERROR: ' + err);
            throw new Error("Error computing status for " + personId + "; contact course staff.");
        }
    }

    /**
     *
     * This confirms the custom.sdmmStatus is correct.
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
     * @returns {Promise<string>}
     */

    /*
    private async checkStatus(personId: string): Promise<boolean> {
        Log.info("SDMMController::getStatus( " + personId + ' ) - start');
        const start = Date.now();
        try {
            const person = await this.dc.getPerson(personId);
            if (person === null) {
                Log.info("SDMMController::checkStatus(..) - ERROR; person null");
                return null;
            }

            const reportedStatus = person.custom.sdmmStatus;
            if (reportedStatus === SDMMStatus[SDMMStatus.D0PRE]) {
                // don't bother, let checkStatus do it right
                return false;
            }

            // NOTE: actually do this if it looks like getStatus is proving to be too slow

            return false;

        } catch (err) {
            Log.info("SDMMController::checkStatus(..) - ERROR: " + err);
        }
    }
*/

    private async provisionD0Repo(personId: string): Promise<Payload> {
        Log.info("SDMMController::provisionD0Repo( " + personId + " ) - start");
        const start = Date.now();

        try {
            const name = personId;
            const person = await this.pc.getPerson(name);
            // const dc = new DeliverablesController();
            const deliv = await this.dc.getDeliverable('d0');
            const r = await this.computeNames(deliv, [person]);
            const teamName = r.teamName; // SDMMController.getTeamPrefix() + name;
            const repoName = r.repoName; // SDMMController.getProjectPrefix() + teamName;

            if (person === null) {
                throw new Error("Username not registered; contact course staff.");
            }

            const personStatus = await this.computeStatusString(personId);
            if (personStatus !== SDMMStatus[SDMMStatus.D0PRE]) {
                Log.info("SDMMController::provisionD0Repo( " + personId + " ) - bad status: " + personStatus);
                throw new Error("User is not eligible for D0.");
            } else {
                Log.info("SDMMController::provisionD0Repo( " + personId + " ) - correct status: " + personStatus);
            }

            // create local team
            const existingTeam = await this.tc.getTeam(teamName);
            if (existingTeam !== null) {
                // team already exists; warn and fail
                throw new Error("SDMMController::provisionD0Repo(..) - team already exists: " + teamName);
            }
            const teamCustom = {sdmmd0: true, sdmmd1: false, sdmmd2: false, sdmmd3: false}; // d0 team for now
            // const deliv = await this.dc.getDeliverable('d0');
            const team = await this.tc.createTeam(teamName, deliv, [person], teamCustom);

            // create local repo
            const existingRepo = await this.rc.getRepository(repoName);
            if (existingRepo !== null) {
                // repo already exists; warn and fail
                throw new Error("Failed to provision d0 repo; repository already exists in datastore: " + repoName);
            }
            const repoCustom = {d0enabled: true, d1enabled: false, d2enabled: false, d3enabled: false, sddmD3pr: false}; // d0 repo for now
            const repo = await this.rc.createRepository(repoName, [team], repoCustom);

            // create remote repo
            const INPUTREPO = "https://github.com/SECapstone/bootstrap";
            const host = Config.getInstance().getProp(ConfigKey.backendUrl);
            const WEBHOOKADDR = host + ':' + Config.getInstance().getProp(ConfigKey.backendPort) + '/portal/githubWebhook';
            const provisionResult = await this.gh.provisionRepository(repoName, [team], INPUTREPO, WEBHOOKADDR);

            if (provisionResult === true) {
                Log.info("SDMMController::provisionD0Repo(..) - d0 GitHub provisioning successful");

                // update local team and repo with github values
                repo.URL = await this.gh.getRepositoryUrl(repo);
                await this.dc.writeRepository(repo); // don't really need to wait, but this is conservative

                team.URL = await this.gh.getTeamUrl(team);
                await this.dc.writeTeam(team); // don't really need to wait, but this is conservative

                // create grade entry
                const grade: GradePayload = {
                    score:     null,
                    comment:   'Repo Provisioned',
                    urlName:   repo.id,
                    URL:       repo.URL,
                    timestamp: Date.now(),
                    custom:    {}
                };
                await this.gc.createGrade(repo.id, 'd0', grade);

                const statusPayload = await this.getStatus(personId);
                Log.info("SDMMController::provisionD0Repo(..) - d0 final provisioning successful; took: " + Util.took(start));

                return {success: {message: "Repository successfully created.", status: statusPayload}};
            } else {
                Log.error("SDMMController::provisionD0Repo(..) - something went wrong provisioning this repo; see logs above.");

                // d0pre people should not have teams
                const delTeam = await this.dc.deleteTeam(team);
                // d0pre people should not have repos
                const delRepo = await this.dc.deleteRepository(repo);
                Log.info("SDMMController::provisionD0Repo(..) - team removed: " + delTeam + ", repo removed: " + delRepo);

                throw new Error("Error provisioning d0 repo.");
            }
        } catch (err) {
            Log.error("SDMMController::provisionD0Repo(..) - ERROR: " + err);
            throw new Error(err.message); // more specific message from errors above
        }
    }

    private async updateIndividualD0toD1(personId: string): Promise<Payload> {
        Log.info("SDMMController::updateIndividualD0toD1( " + personId + " ) - start");
        const start = Date.now();

        try {
            // make sure person exists
            const person = await this.pc.getPerson(personId);
            if (person === null) {
                Log.error("SDMMController::updateIndividualD0toD1(..) - person does not exist: " + personId);
                throw new Error("Username not registered with course.");
            }

            // make sure the person has suffient d0 grade
            const grade = await this.gc.getGrade(personId, "d0"); // make sure they can move on
            if (grade === null || grade.score === null || grade.score < this.GRADE_TO_ADVANCE) {
                Log.error("SDMMController::updateIndividualD0toD1(..) - insufficient d0 grade for: " + personId);
                throw new Error("Current d0 grade is not sufficient to move on to d1.");
            }

            // make sure the person does not already have a d1 repo
            const myRepos = await this.rc.getReposForPerson(person);
            for (const r of myRepos) {
                if (r.custom.d1enabled === true) {
                    Log.error("SDMMController::updateIndividualD0toD1(..) - person already has a d1 repo: " + r.id);
                    throw new Error("D1 repo has already been assigned: " + r.id);
                }
            }

            const personStatus = await this.computeStatusString(personId);
            if (personStatus !== SDMMStatus[SDMMStatus.D1UNLOCKED]) {
                Log.info("SDMMController::updateIndividualD0toD1( " + personId + " ) - bad status: " + personStatus);
            } else {
                Log.info("SDMMController::updateIndividualD0toD1( " + personId + " ) - correct status: " + personStatus);
            }

            const deliv = await this.dc.getDeliverable('d0'); // since we are upgrading the d0 repo, use this even though this is for d1
            const names = await this.computeNames(deliv, [person]);
            const teamName = names.teamName; // SDMMController.getTeamPrefix() + personId;
            const repoName = names.repoName; // SDMMController.getProjectPrefix() + teamName;

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
                const newGrade: GradePayload = {
                    score:     null,
                    comment:   'Repo Provisioned',
                    urlName:   repo.id,
                    URL:       repo.URL,
                    timestamp: Date.now(),
                    custom:    {}
                };
                await this.gc.createGrade(repo.id, 'd1', newGrade);
                await this.gc.createGrade(repo.id, 'd2', newGrade);
                await this.gc.createGrade(repo.id, 'd3', newGrade);
            } else {
                Log.error("SDMMController::updateIndividualD0toD1(..) - unable to find team: " + teamName + ' or repo: ' + repoName);
                throw new Error("Invalid team updating d0 repo; contact course staff.");
            }

            const statusPayload = await this.getStatus(personId);
            Log.info("SDMMController::updateIndividualD0toD1(..) - d0 to d1 individual upgrade successful; took: " + Util.took(start));
            return {success: {message: "D0 repo successfully updated to D1.", status: statusPayload}};
        } catch (err) {
            Log.error("SDMMController::updateIndividualD0toD1(..) - ERROR: " + err);
            throw new Error(err.message); // more specific message from errors above
        }
    }

    /**
     * @param {string[]} peopleIds order matters here: the requestor should be peopleIds[0]
     * @returns {Promise<Payload>}
     */
    private async provisionD1Repo(peopleIds: string[]): Promise<Payload> {
        Log.info("SDMMController::provisionD1Repo( " + JSON.stringify(peopleIds) + " ) - start");
        const start = Date.now();

        try {

            const people: Person[] = [];
            for (const pid of peopleIds) {
                const person = await this.dc.getPerson(pid); // make sure the person exists
                if (person !== null) {
                    const grade = await this.gc.getGrade(pid, "d0"); // make sure they can move on
                    if (grade !== null && grade.score > 59) {
                        people.push(person);
                    } else {
                        Log.error("SDMMController::provisionD1Repo(..) - user does not have sufficient grade: " + pid);
                        throw new Error("All teammates must have achieved a score of " +
                            this.GRADE_TO_ADVANCE + "% or more to join a team.");
                    }
                } else {
                    Log.error("SDMMController::provisionD1Repo(..) - unknown user: " + pid);
                    throw new Error("Unknown person " + pid +
                        " requested to be on team; please make sure they are registered with the course.");
                }
            }

            const deliv = await this.dc.getDeliverable('d1');
            const names = await this.computeNames(deliv, people);
            const teamName = names.teamName;
            const repoName = names.repoName;

            // // seems complicated, but we need team names that are unique
            // // but with lots of people signing up at once we can't rely on a counter
            // // especially since full provisioning will take a long time (e.g., GRADE_TO_ADVANCE+ seconds)
            // let teamName: string | null = null;
            // while (teamName === null) {
            //     let str = crypto.randomBytes(256).toString('hex');
            //     str = str.substr(0, 6);
            //     const name = SDMMController.getTeamPrefix() + str; // teamname with prefix
            //     // const name = str; // NOTE: 't_' missed in initial deployment so we'll leave it off
            //     Log.trace("SDMMController::provisionD1Repo(..) - checking name: " + name);
            //     const teamWithName = await this.tc.getTeam(name);
            //     if (teamWithName === null) {
            //         teamName = name;
            //         Log.trace("SDMMController::provisionD1Repo(..) - name available; using: " + teamName);
            //     }
            // }

            for (const p of people) {
                const personStatus = await this.computeStatusString(p.id);
                if (personStatus !== SDMMStatus[SDMMStatus.D1UNLOCKED]) {
                    Log.error("SDMMController::provisionD1Repo(..) - user does not have the right status to advance: " +
                        p.id + '; status: ' + personStatus);
                    throw new Error("All teammates must be eligible to join a team and must not " +
                        "already be performing d1 in another team or on their own.");
                } else {
                    Log.info("SDMMController::provisionD1Repo( " + p.id + " ) - correct status: " + personStatus);
                }
            }

            // create local team
            const teamCustom = {sdmmd0: false, sdmmd1: true, sdmmd2: true, sdmmd3: true}; // configure for project
            // const deliv = await this.dc.getDeliverable('d1');
            const team = await this.tc.createTeam(teamName, deliv, people, teamCustom);

            // create local repo
            // const repoName = SDMMController.getProjectPrefix() + teamName;
            const repoCustom = {d0enabled: false, d1enabled: true, d2enabled: true, d3enabled: true, sddmD3pr: false}; // d0 repo for now
            const repo = await this.rc.createRepository(repoName, [team], repoCustom);

            // create remote repo
            const INPUTREPO = "https://github.com/SECapstone/bootstrap"; // HARDCODED for SDMM
            const host = Config.getInstance().getProp(ConfigKey.backendUrl);
            const WEBHOOKADDR = host + ':' + Config.getInstance().getProp(ConfigKey.backendPort) + '/portal/githubWebhook';
            const provisionResult = await this.gh.provisionRepository(repoName, [team], INPUTREPO, WEBHOOKADDR);

            if (provisionResult === true) {
                Log.info("SDMMController::provisionD1Repo(..) - d1 github provisioning successful");

                // update local team and repo with github values
                repo.URL = await this.gh.getRepositoryUrl(repo);
                await this.dc.writeRepository(repo); // don't really need to wait, but this is conservative

                team.URL = await this.gh.getTeamUrl(team);
                await this.dc.writeTeam(team); // don't really need to wait, but this is conservative

                // create grade entries
                const grade: GradePayload = {
                    score:     null,
                    comment:   'Repo Provisioned',
                    urlName:   repo.id,
                    URL:       repo.URL,
                    timestamp: Date.now(),
                    custom:    {}
                };
                await this.gc.createGrade(repo.id, 'd1', grade);
                await this.gc.createGrade(repo.id, 'd2', grade);
                await this.gc.createGrade(repo.id, 'd3', grade);

                const statusPayload = await this.getStatus(peopleIds[0]);
                Log.info("SDMMController::provisionD1Repo(..) - d1 final provisioning successful; took: " + Util.took(start));
                return {success: {message: "D1 repository successfully provisioned.", status: statusPayload}};
            } else {
                Log.error("SDMMController::provisionD1Repo(..) - something went wrong provisioning this repo; see logs above.");
                throw new Error("Error encountered creating d1 repo; contact course staff.");
            }
        } catch (err) {
            Log.error("SDMMController::provisionD1Repo(..) - ERROR: " + err);
            throw new Error(err.message);
        }
    }

    public async computeNames(deliv: Deliverable, people: Person[]): Promise<{teamName: string | null, repoName: string | null}> {
        Log.info("SDMMController::computeNames( " + deliv.id + ", ... ) - start");
        const rPrefix = deliv.repoPrefix; // should be 'secap_' for d0 and d1
        const tPrefix = deliv.teamPrefix; // should be '' for d0 and d1
        if (deliv.id === 'd0' || people.length === 1) {
            const tName = tPrefix + people[0].id;
            const rName = rPrefix + people[0].id;
            const res = {teamName: tName, repoName: rName};
            Log.info("SDMMController::computeNames( ... ) - individual done; res: " + JSON.stringify(res));
            return res;
        } else {
            let teamName: string | null = null;
            while (teamName === null) {
                let name = crypto.randomBytes(256).toString('hex');
                name = name.substr(0, 6);
                name = tPrefix + name;
                Log.info("SDMMController::computeNames( ... ) - checking name: " + name);
                const teamWithName = await this.tc.getTeam(name);
                if (teamWithName === null) {
                    teamName = name;
                    Log.info("SDMMController::computeNames( ... ) - name available; using: " + teamName);
                }
            }

            const rName = rPrefix + teamName;
            const res = {teamName: teamName, repoName: rName};
            Log.info("SDMMController::computeNames( ... ) - team done; res: " + JSON.stringify(res));
            return res;
        }
    }
}
