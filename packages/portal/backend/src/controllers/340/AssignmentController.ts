import {GradesController} from "../GradesController";
import {DatabaseController} from "../DatabaseController";
import {Deliverable, Grade, Person, Repository, Team} from "../../Types";
// import {GradePayload} from "../GradesController";
import Log from "../../../../../common/Log";
import {GradePayload} from "../../../../../common/types/SDMMTypes";
import {
    AssignmentGrade,
    AssignmentInfo,
    AssignmentRepositoryInfo,
    AssignmentStatus
} from "../../../../../common/types/CS340Types";
import {RepositoryController} from "../RepositoryController";
import {TeamController} from "../TeamController";
import {DeliverablesController} from "../DeliverablesController";
import {GitHubController} from "../GitHubController";
import Config, {ConfigKey} from "../../../../../common/Config";
import {PersonController} from "../PersonController";
import {GitHubActions} from "../util/GitHubActions";

/*
 * Definition of controller object
 */

export class AssignmentController {
    private db: DatabaseController = DatabaseController.getInstance();
    private gc: GradesController = new GradesController();
    private rc: RepositoryController = new RepositoryController();
    private tc: TeamController = new TeamController();
    private dc: DeliverablesController = new DeliverablesController();
    private ghc: GitHubController = new GitHubController();
    private pc: PersonController = new PersonController();
    private gha: GitHubActions = new GitHubActions();

    public async getAssignmentGrade(personId: string, assignId: string): Promise<AssignmentGrade | null> {
        // let returningPromise = new Promise((resolve, reject) => {
        //     let gradeObj : Grade = await this.gc.getGrade(org, personId, assignId);
        // });
        //
        // return returningPromise;
        Log.info("AssignmentController:getAssignmentGrade(" + ", " + personId + ", " + assignId + ") - start");
        let grade: Grade = await this.gc.getGrade(personId, assignId);
        if (grade === null) return null;

        const assignmentGrade: AssignmentGrade = grade.custom;
        return assignmentGrade;
    }

    public async setAssignmentGrade(repoID: string, assignId: string, assnPayload: AssignmentGrade, markerId?: string): Promise<boolean> {
        // Array<Array<SubsectionGrade>>
        Log.info("AssignmentController::setAssignmentGrade(" + ", " + repoID + ", " + assignId + ",..) - start");
        Log.trace("AssignmentController::setAssignmentGrade(..) - payload: " + JSON.stringify(assnPayload));

        let totalGrade = 0;

        for (const aQuestion of assnPayload.questions) {
            for (const aSubQuestion of aQuestion.subQuestion) {
                // Sum up all subcompartment grades
                totalGrade += aSubQuestion.grade;
            }
        }

        // Assume Repository exists
        let repo: Repository = await this.rc.getRepository(repoID);

        if (repo === null) {
            return false;
        }

        Log.trace("AssignmentController::setAssignmentGrade() - " + (markerId? 'Marked by ' + markerId : 'Marked assignment'));

        let newGradePayload: GradePayload = {
            // assignmentID: assnPayload.assignmentID,
            // studentID: assnPayload.studentID,
            score:     totalGrade,
            comment:   markerId? 'Marked by ' + markerId : 'Marked assignment',
            urlName:   repo.id,
            URL:       repo.URL,
            timestamp: Date.now(),
            custom:    assnPayload
        };

        let success = await this.gc.createGrade(repoID, assignId, newGradePayload);
        return success;
    }

    // Intializes an assignment Repo
    public async createAssignmentRepo(repoName: string, delivId: string, teams: Team[]): Promise<Repository | null> {
        Log.info("AssignmentController::createAssignmentRepo( " + repoName + ", " + delivId + ",... ) - start");
        // get assignment information
        let deliverable: Deliverable = await this.dc.getDeliverable(delivId);
        if(deliverable === null) {
            Log.error("AssignmentController::createAssignmentRepo(..) - error: could not retrieve " +
                "deliverable based on delivId: " + delivId);
            return null;
        }
        let assignInfo: AssignmentInfo = deliverable.custom;
        if(assignInfo === null) {
            Log.error("AssignmentController::createAssignmentRepo(..) - deliverable " + delivId + " is" +
                "not an assignment.");
            return null;
        }

        // retrieve provisioning information
        let seedURL = assignInfo.seedRepoURL;
        let seedPath = assignInfo.seedRepoPath;
        const WEBHOOKADDR = Config.getInstance().getProp(ConfigKey.backendUrl) + ':'
            + Config.getInstance().getProp(ConfigKey.backendPort) + '/portal/githubWebhook';

        // attempt to provision the repository
        let provisionAttempt: boolean;
        if(seedPath.trim() === "") {
            // todo: set this to have no team to provision
            provisionAttempt = await this.ghc.provisionRepository(repoName, [], seedURL, WEBHOOKADDR);
        } else {
            // todo: set this to have no team to provision
            // provisionAttempt = await dthis.ghc.provisionRepository(repoName, [], seedURL, WEBHOOKADDR, seedPath);
        }

        if(!provisionAttempt) {
            Log.error("AssignmentController::createAssignmentRepo(..) - error: unable to create repository");
            return null;
        }

        // save repository information to database
        let assignRepoInfo: AssignmentRepositoryInfo = {
            assignmentId: [delivId],
            status: AssignmentStatus.INITIALIZED,
            assignedTeams: []
        };

        // add all the teams
        for(const team of teams) {
            assignRepoInfo.assignedTeams.push(team.id);
        }

        let repository = await this.rc.createRepository(repoName, teams, assignRepoInfo);
        // record the url
        repository.URL = await this.ghc.getRepositoryUrl(repository);

        if(!assignInfo.repositories.includes(repository.id)) {
            Log.info("AssignmentController::createAssignmentRepo(..) - adding repository to list");
            deliverable.custom.repositories.push(repository.id);
            // save the assignment information back
            await this.dc.saveDeliverable(deliverable);
        }

        Log.info("AssignmentController::createAssignmentRepo(..) - finish");
        return repository;
    }


    public async initializeAllRepositories(delivId: string): Promise<boolean> {
        Log.info("AssignmentController::initializeAllRepositories( " + delivId + ") - start");
        // Log.info("AssignmentController::initializeAllRepositories(..)");
        let deliv: Deliverable =  await this.dc.getDeliverable(delivId);
        // get assignment information
        if(deliv.custom === null) {
            Log.error("AssignmentController::initializeAllRepositories(..) - assignment not set up" +
                "properly");
            return false;
        }

        let assignInfo: AssignmentInfo = deliv.custom;
        // get all students
        let allPeople: Person[] = await this.pc.getAllPeople();
        let allStudents: Person[] = [];
        for(const person of allPeople) {
            if(person.kind === "student") {
                allStudents.push(person);
            }
        }

        let anyError: boolean = false;
        // todo: teams?
        for(const student of allStudents) {
            // for each student, create a team
            let teamName = deliv.teamPrefix + student.githubId;
            let newTeam: Team = await this.tc.createTeam(teamName, [student], null);
            if(newTeam === null) {
                Log.error("AssignmentController::initializeAllRepositories(..) - error creating team " +
                    teamName + " for student " + student.id);
            }

            let newGithubTeam = await this.gha.createTeam(teamName, "push");
            let githubTuple = await this.gha.addMembersToTeam(newGithubTeam.teamName, newGithubTeam.githubTeamNumber, [student.githubId]);

            // attempt to provision the repository,
            // if success, add it to the AssignmentInfo
            let repoName: string = deliv.repoPrefix + student.githubId;
            let provisionedRepo = await this.createAssignmentRepo(repoName, delivId, [newTeam]);

            if(provisionedRepo !== null) {
                if(assignInfo.repositories === null || typeof assignInfo.repositories === 'undefined') assignInfo.repositories = [];
                assignInfo.repositories.push(provisionedRepo.id);
                Log.info("AssignmentController::initializeAllRepositories(..) - added repo " +
                    repoName + "to assignment");
            } else {
                Log.trace("AssignmentController::initializeAllRepositories(..) - provisioning repo: " +
                    repoName + " failed.");
                anyError = true;
            }
        }

        // once you are done, update the assignment information
        if(!anyError) {
            assignInfo.status = AssignmentStatus.INACTIVE;
        }

        await this.dc.saveDeliverable(deliv);
        Log.info("AssignmentController::initializeAllRepositories(..) - finish");
        return true;
    }

    // TODO: Finish this
    public async deleteAssignmentRepository(repoName: string) {

    }

    public async publishAssignmentRepo(repoId: string): Promise<boolean> {
        Log.info("AssignmentController::publishAssignmentRepo( " + repoId + " ) - start");
        // Log.info("AssignmentController::publishAssignmentRepo(..)");
        let repo: Repository = await this.rc.getRepository(repoId);
        if(repo.custom === null) {
            Log.error("AssignmentController::publishAssignmentRepo(..) - error: repository " + repoId +
                " not created properly");
            return false;
        }
        let repoInfo: AssignmentRepositoryInfo = repo.custom;
        if(repoInfo.status !== AssignmentStatus.INITIALIZED) {
            Log.error("AssignmentController::publishAssignmentRepo(..) - error: repository " + repoId +
            " is not initialized");
            switch(repoInfo.status) {
                case AssignmentStatus.INACTIVE: {
                    Log.error("AssignmentController::publishAssignmentRepo(..) - status: INACTIVE");
                    break;
                }
                case AssignmentStatus.PUBLISHED: {
                    Log.error("AssignmentController::publishAssignmentRepo(..) - status: PUBLISHED");
                    break;
                }
                case AssignmentStatus.CLOSED: {
                    Log.error("AssignmentController::publishAssignmentRepo(..) - status: CLOSED");
                    break;
                }
            }
            return false;
        }

        for(const teamId of repoInfo.assignedTeams) {
            let team = await this.tc.getTeam(teamId);
            let githubTeamNumber = await this.gha.getTeamNumber(team.id);
            if(githubTeamNumber === -1) {
                Log.error("AssignmentController::publishAssignmentRepo(..) - team not created on Github");
                return false;
            }

            await this.gha.addTeamToRepo(githubTeamNumber, repo.id, "push");
        }

        repoInfo.status = AssignmentStatus.PUBLISHED;

        await this.db.writeRepository(repo);
        Log.info("AssignmentController::publishAssignmentRepo(..) - finish");

        return true;
    }

    public async publishAllRepositories(delivId: string): Promise<boolean> {
        Log.info("AssignmentController::publishAllRepositories( " + delivId + ") - start");
        // Log.info("AssignmentController::publishAllRepositories(..)");
        let deliv = await this.dc.getDeliverable(delivId);
        if(deliv.custom === null) {
            Log.error("AssignmentController::publishAllRepositories(..) - error: assignment not " +
                "set up properly");
            return false;
        }

        let assignInfo: AssignmentInfo = deliv.custom;

        let anyError: boolean = false;
        for(const repoId of assignInfo.repositories) {
            let repo: Repository = await this.rc.getRepository(repoId);
            if(!await this.publishAssignmentRepo(repo.id)) {
                Log.error("AssignmentController::publishAllRepositories(..) - unable to publish " +
                    " repository " + repo.id);

                anyError = true;
            }
        }

        if(anyError) {
            Log.error("AssignmentController::publishAllRepositories(..) - unable to publish all" +
                " repositories");
            return false;
        }

        assignInfo.status = AssignmentStatus.PUBLISHED;
        await this.dc.saveDeliverable(deliv);
        Log.info("AssignmentController::publishAllRepositories(..) - finish");
        return true;
    }

    // Retrieves the status of a given assignment
    // Warning: This might be stale
    public async getAssignmentStatus(delivId: string) : Promise<AssignmentStatus | null> {
        Log.info("AssignmentController::getAssignmentStatus( " + delivId + ") - start");
        let deliv =  await this.dc.getDeliverable(delivId);
        if(deliv === null) {
            Log.error("AssignmentController::getAssignmentStatus(..) - error: nothing found");
            return null;
        }

        if(deliv.custom === null) {
            Log.error("AssignmentController::getAssignmentStatus(..) - error: " +
                delivId + " has no assignment status");
            return null;
        }


        Log.info("AssignmentController::getAssignmentStatus(..) - finish");
        return (deliv.custom as AssignmentInfo).status;
    }

    // Updates the status of a given assignment
    // iterates over checking each status of the assigned repository
    public async updateAssignmentStatus(delivId: string): Promise<AssignmentStatus | null> {
        Log.info("AssignmentController::updateAssignmentStatus( " + delivId + ") - start");
        let deliv =  await this.dc.getDeliverable(delivId);
        if(deliv === null) {
            Log.error("AssignmentController::updateAssignmentStatus(..) - error: nothing found");
            return null;
        }

        if(deliv.custom === null) {
            Log.error("AssignmentController::updateAssignmentStatus(..) - error: " +
                delivId + " has no assignment status");
            return null;
        }
        // get all students, check if all repositories are created yet
        let allPeople: Person[] = await this.pc.getAllPeople();
        let allStudents: Person[] = [];
        for(const person of allPeople) {
            if(person.kind === "student") {
                allStudents.push(person);
            }
        }

        let studentRepoMapping: {[studentId:string]:Repository[]} = {};
        let assignInfo: AssignmentInfo = deliv.custom;
        let repoList: string[] = assignInfo.repositories;
        for(const repoId of repoList) {
            let repo: Repository = await this.rc.getRepository(repoId);
            // retrieve all the students associated with the repository, and then record it
            for(const teamId of repo.teamIds) {
                let team: Team = await this.tc.getTeam(teamId);
                for(const personId of team.personIds) {
                    if(typeof studentRepoMapping[personId] === 'undefined') {
                        studentRepoMapping[personId] = [];
                    }
                    studentRepoMapping[personId].push(repo);
                }
            }
        }

        // verify all students have a repository
        let newStatus = AssignmentStatus.CLOSED;
        for(const student of allStudents) {
            if(typeof studentRepoMapping[student.id] === 'undefined') {
                // this means a repository is missing,
                (deliv.custom as AssignmentInfo).status = AssignmentStatus.INACTIVE;
                await this.dc.saveDeliverable(deliv);
                return AssignmentStatus.INACTIVE;
            } else {
                // if the student has repositories,
                let studentRepos: Repository[] = studentRepoMapping[student.id];
                for(const repo of studentRepos) {
                    if(repo.custom === null) {
                        // a repo is not classified properly
                        Log.error("AssignmentController::updateAssignmentStatus(..) - error: " +
                            "repository " + repo.id + " is not set up properly");
                        return null;
                    }
                    let repoInfo: AssignmentRepositoryInfo = repo.custom;

                    // if(repoInfo.status === AssignmentStatus.INITIALIZED) {
                    //     currentStatus = repoInfo.status;
                    // } else if (currentStatus !== AssignmentStatus.INITIALIZED &&
                    //         repoInfo.status === AssignmentStatus.PUBLISHED) {
                    //     currentStatus = repoInfo.status;
                    // } else if (currentStatus !== AssignmentStatus.PUBLISHED &&
                    //         currentStatus !== AssignmentStatus.INITIALIZED &&
                    //         repoInfo.status === AssignmentStatus.CLOSED) {
                    //     currentStatus = repoInfo.status;
                    // }
                    if(repoInfo.status < newStatus) {
                        newStatus = repoInfo.status;
                    }
                }
            }
        }

        (deliv.custom as AssignmentInfo).status = newStatus;
        await this.dc.saveDeliverable(deliv);


        Log.info("AssignmentController::updateAssignmentStatus(..) - finish");
        return newStatus;
    }


    public async getAssignmentRepo(delivId: string, person: Person): Promise<Repository | null> {
        Log.info("AssignmentController::getAssignmentRepo( " + delivId + ", " + person + " ) - start");

        let deliv = await this.dc.getDeliverable(delivId);
        if(deliv === null) {
            Log.error("AssignmentController::getAssignmentRepo(..) - error: unable to find " +
                "assignment " + delivId);
            return null;
        }

        if(deliv.custom === null) {
            Log.error("AssignmentController::getAssignmentRepo(..) - error: deliverable not " +
                "setup with rubric");
            return null;
        }

        let assignInfo: AssignmentInfo = deliv.custom;
        for(const repoId of assignInfo.repositories) {
            let repo: Repository = await this.rc.getRepository(repoId);
            for(const teamId of repo.teamIds) {
                let team: Team = await this.tc.getTeam(teamId);
                if(team === null) continue;
                if(team.personIds.includes(person.id)) {
                    Log.info("AssignmentController::getAssignmentRepo(..) - found repository: " + repoId);
                    return repo;
                }
            }
        }

        Log.error("AssignmentController::getAssignmentRepo(..) - error: unable to find repo");
        return null;

        // let allRepos: Repository[] = await this.db.getRepositories();
        // let personRepos: Repository[] = [];
        // for (const repo of allRepos) {
        //     const teamIds: string[] = repo.teamIds;
        //     for (const teamId of teamIds) {
        //         const team = await this.tc.getTeam(teamId);
        //         for (const personIds of team.personIds) {
        //             if (personIds === person.id) {
        //                 personRepos.push(repo);
        //             }
        //         }
        //     }
        // }
        //
        // let result: Repository[] = [];
        // for (const repo of personRepos) {
        //     if (repo.custom === delivId) {
        //         result.push(repo);
        //     }
        // }
        // if (result.length !== 1) {
        //     if(result.length === 0) {
        //         Log.info("AssignmentController::getAssignmentRepo(...) - no repo found");
        //     } else {
        //         Log.info("AssignmentController::getAssignmentRepo(...) - non-single repo found: " + result.toString());
        //     }
        //     return null;
        // } else {
        //     Log.info("AssignmentController::getAssignmentRepo(...) - end");
        //     return result[0];
        // }
    }
}
