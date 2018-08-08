import {GradesController} from "../GradesController";
import {DatabaseController} from "../DatabaseController";
import {Deliverable, Grade, Person, Repository, Team} from "../../Types";
// import {GradePayload} from "../GradesController";
import Log from "../../../../../common/Log";
import {GradePayload} from "../../../../../common/types/SDMMTypes";
import {
    AssignmentGrade,
    AssignmentGradingRubric,
    AssignmentInfo,
    AssignmentRepositoryInfo,
    AssignmentStatus, QuestionGrade, QuestionGradingRubric, SubQuestionGrade, SubQuestionGradingRubric
} from "../../../../../common/types/CS340Types";
import {RepositoryController} from "../RepositoryController";
import {TeamController} from "../TeamController";
import {DeliverablesController} from "../DeliverablesController";
import {GitHubController} from "../GitHubController";
import Config, {ConfigKey} from "../../../../../common/Config";
import {PersonController} from "../PersonController";
import {GitHubActions} from "../GitHubActions";

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
        if(typeof assignmentGrade.questions === 'undefined' ||
            typeof assignmentGrade.assignmentID === 'undefined') return null;
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

        Log.trace("AssignmentController::setAssignmentGrade() - " + (markerId ? 'Marked by ' + markerId : 'Marked assignment'));

        let newGradePayload: GradePayload = {
            // assignmentID: assnPayload.assignmentID,
            // studentID: assnPayload.studentID,
            score:     totalGrade,
            comment:   markerId ? 'Marked by ' + markerId : 'Marked assignment',
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
        if (deliverable === null) {
            Log.error("AssignmentController::createAssignmentRepo(..) - error: could not retrieve " +
                "deliverable based on delivId: " + delivId);
            return null;
        }
        let assignInfo: AssignmentInfo = deliverable.custom;
        if (assignInfo === null || typeof assignInfo.seedRepoURL === 'undefined') {
            Log.error("AssignmentController::createAssignmentRepo(..) - deliverable " + delivId + " is" +
                "not an assignment.");
            return null;
        }

        // save repository information to database
        let assignRepoInfo: AssignmentRepositoryInfo = {
            assignmentId:  [delivId],
            status:        AssignmentStatus.INITIALIZED,
            assignedTeams: []
        };

        // add all the teams
        for (const team of teams) {
            assignRepoInfo.assignedTeams.push(team.id);
        }

        // creates repository record
        let repository = await this.rc.createRepository(repoName, teams, assignRepoInfo);

        // retrieve provisioning information
        let seedURL = assignInfo.seedRepoURL;
        let seedPath = assignInfo.seedRepoPath;

        // attempt to provision the repository
        let provisionAttempt: boolean;
        if (seedPath.trim() === "" || seedPath.trim() === "*" || seedPath.trim() === "/*") {
            // provisionAttempt = await this.ghc.provisionRepository(repoName, [], seedURL, WEBHOOKADDR);
            provisionAttempt = await this.ghc.createRepository(repoName, seedURL);
        } else {
            // provisionAttempt = await dthis.ghc.provisionRepository(repoName, [], seedURL, WEBHOOKADDR, seedPath);
            provisionAttempt = await this.ghc.createRepository(repoName, seedURL, seedPath.trim());
        }

        if (!provisionAttempt) {
            Log.error("AssignmentController::createAssignmentRepo(..) - error: unable to create repository");
            return null;
        }

        // // record the url
        // repository.URL = await this.ghc.getRepositoryUrl(repository);
        //
        // await this.db.writeRepository(repository);

        if (!assignInfo.repositories.includes(repository.id)) {
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
        let deliv: Deliverable = await this.dc.getDeliverable(delivId);
        // get assignment information
        if (deliv.custom === null) {
            Log.error("AssignmentController::initializeAllRepositories(..) - assignment not set up" +
                "properly");
            return false;
        }

        let assignInfo: AssignmentInfo = deliv.custom;
        // get all students
        let allPeople: Person[] = await this.pc.getAllPeople();
        let allStudents: Person[] = [];
        for (const person of allPeople) {
            if (person.kind === "student") {
                allStudents.push(person);
            }
        }

        let anyError: boolean = false;
        // todo: teams?
        let peopleList = await this.gha.listPeople();
        let personVerification: { [githubID: string]: any } = {};

        // create a map of personID to
        for(const person of peopleList) {
            if(typeof personVerification[person.name] === 'undefined') personVerification[person.name] = person;
        }


        for (const student of allStudents) {
            // verify student is a person in the org, if not, skip it (DATABASE INCONSISTENCY!?)
            if(typeof personVerification[student.githubId] === 'undefined') {
                Log.error("AssignmentController::initializeAllRepositories(..) - ERROR: " +
                    "database inconsistency; student exists that is not registered in Github. " +
                    "Student ID: " + student.id + "; Student Github ID: " + student.githubId);
                continue;
            }

            // for each student, create a team
            let teamName = deliv.teamPrefix + student.githubId;
            let newTeam: Team = await this.tc.createTeam(teamName, deliv, [student], null);
            if (newTeam === null) {
                Log.error("AssignmentController::initializeAllRepositories(..) - error creating team " +
                    teamName + " for student " + student.githubId);
            }

            let newGithubTeam = await this.gha.createTeam(teamName, "push");
            let githubTuple = await this.gha.addMembersToTeam(newGithubTeam.teamName, newGithubTeam.githubTeamNumber, [student.githubId]);

            // attempt to provision the repository,
            // if success, add it to the AssignmentInfo
            let repoName: string = deliv.repoPrefix + student.githubId;
            let provisionedRepo = await this.createAssignmentRepo(repoName, delivId, [newTeam]);


            if (provisionedRepo !== null) {
                if (assignInfo.repositories === null || typeof assignInfo.repositories === 'undefined') assignInfo.repositories = [];
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
        if (!anyError) {
            assignInfo.status = AssignmentStatus.INITIALIZED;
        }

        await this.dc.saveDeliverable(deliv);
        Log.info("AssignmentController::initializeAllRepositories(..) - finish");
        return true;
    }

    public async publishAssignmentRepo(repoId: string): Promise<boolean> {
        Log.info("AssignmentController::publishAssignmentRepo( " + repoId + " ) - start");
        // Log.info("AssignmentController::publishAssignmentRepo(..)");
        let repo: Repository = await this.rc.getRepository(repoId);
        if (repo.custom === null) {
            Log.error("AssignmentController::publishAssignmentRepo(..) - error: repository " + repoId +
                " not created properly");
            return false;
        }

        // check if assignment is ready to be published
        let repoInfo: AssignmentRepositoryInfo = repo.custom;
        if (repoInfo.status !== AssignmentStatus.INITIALIZED) {
            Log.error("AssignmentController::publishAssignmentRepo(..) - error: repository " + repoId +
                " is not initialized");
            switch (repoInfo.status) {
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

        let teamList: Team[] = [];
        for (const teamId of repoInfo.assignedTeams) {
            let team = await this.tc.getTeam(teamId);
            if (team === null) {
                Log.error("AssignmentController::publishAssignmentRepo(..) - invalid team: " + teamId + " " +
                    "skipping and continuing...");
                continue;
            }
            teamList.push(team);
            // let githubTeamNumber = await this.gha.getTeamNumber(team.id);
            // if(githubTeamNumber === -1) {
            //     Log.error("AssignmentController::publishAssignmentRepo(..) - team not created on Github");
            //     return false;
            // }
            //
            // await this.gha.addTeamToRepo(githubTeamNumber, repo.id, "push");
        }

        let success: boolean = await this.ghc.releaseRepository(repo, teamList, false);

        if (success) {
            repoInfo.status = AssignmentStatus.PUBLISHED;
            await this.db.writeRepository(repo);
        } else {
            Log.error("AssignmentController::publishAssignmentRepo(..) - unable to release repo");
            return false;
        }

        Log.info("AssignmentController::publishAssignmentRepo(..) - finish");
        return true;
    }

    public async publishAllRepositories(delivId: string): Promise<boolean> {
        Log.info("AssignmentController::publishAllRepositories( " + delivId + ") - start");
        // Log.info("AssignmentController::publishAllRepositories(..)");
        let deliv = await this.dc.getDeliverable(delivId);
        if (deliv.custom === null) {
            Log.error("AssignmentController::publishAllRepositories(..) - error: assignment not " +
                "set up properly");
            return false;
        }

        let assignInfo: AssignmentInfo = deliv.custom;

        let anyError: boolean = false;
        for (const repoId of assignInfo.repositories) {
            let repo: Repository = await this.rc.getRepository(repoId);
            if (!await this.publishAssignmentRepo(repo.id)) {
                Log.error("AssignmentController::publishAllRepositories(..) - unable to publish " +
                    " repository " + repo.id);
                anyError = true;
            }
        }

        if (anyError) {
            Log.error("AssignmentController::publishAllRepositories(..) - unable to publish all" +
                " repositories");
            return false;
        }

        assignInfo.status = AssignmentStatus.PUBLISHED;
        await this.dc.saveDeliverable(deliv);
        Log.info("AssignmentController::publishAllRepositories(..) - finish");
        return true;
    }

    /**
     * Deletes the given assignment repository
     * @param {string} repoName: repository name to delete
     * @param {string} delivId: deliverable ID to delete record from
     * @param {boolean} single: indicates if this is a one-off operation; if {true},
     * will modify database to remove repo from assignment record
     * @returns {Promise<boolean | null>} indicates success of deletion
     */
    public async deleteAssignmentRepository(repoName: string, delivId: string, single: boolean = true): Promise<boolean | null> {
        Log.info("AssignmentController::deleteAssignmentRepository( " + repoName + ", " + delivId + " ) - start");
        // Log.info("AssignmentController::deleteAssignmentRepository(..) - start");

        let deliverable: Deliverable = await this.dc.getDeliverable(delivId);
        if (deliverable === null) {
            Log.error("AssignmentController::deleteAssignmentRepository(..) - error: could not retrieve " +
                "deliverable based on delivId: " + delivId);
            return null;
        }
        let assignInfo: AssignmentInfo = deliverable.custom;
        if (assignInfo === null || typeof assignInfo.repositories === 'undefined') {
            Log.error("AssignmentController::deleteAssignmentRepository(..) - deliverable " + delivId + " is" +
                "not an assignment.");
            return null;
        }

        if (!await this.gha.deleteRepo(repoName)) {
            return false;
        }

        if (single) {
            const pos = assignInfo.repositories.indexOf(repoName);
            if (pos != -1) {
                assignInfo.repositories.splice(pos, 1);
            }

            // save update information to database
            await this.dc.saveDeliverable(deliverable);
        }

        let repoRecord: Repository = await this.rc.getRepository(repoName);
        if (repoRecord === null) {
            Log.error("AssignmentController::deleteAssignmentRepository(..) - error: unable" +
                " to retrieve repository from database");

            return null;
        }

        // TODO: Clean up teams as well
        // for(const teamId of repoRecord.teamIds) {
        //
        // }

        Log.info("AssignmentController::deleteAssignmentRepository(..) - deleted repository " + repoName);
        return await this.db.deleteRepository(repoRecord);
    }


    /**
     * Deletes all repositories associated with the deliverable
     * @param {string} delivId: deliverable to delete
     * @returns {Promise<boolean>} indicates success of deleting all repositories
     */
    public async deleteAllAssignmentRepositories(delivId: string): Promise<boolean> {
        Log.info("AssignmentController::deleteAllAssignmentRepositories( " + delivId + ") - start");

        let deliv: Deliverable = await this.dc.getDeliverable(delivId);
        // get assignment information
        if (deliv.custom === null || typeof (deliv.custom as AssignmentInfo).repositories === 'undefined') {
            Log.error("AssignmentController::deleteAllAssignmentRepositories(..) - " +
                "assignment not set up properly");
            return false;
        }

        let assignInfo: AssignmentInfo = deliv.custom;
        for (const repoName of assignInfo.repositories) {
            await this.deleteAssignmentRepository(repoName, delivId, false);
        }

        // check teams and make sure that the team records is deleted
        let allTeams = await this.tc.getAllTeams();
        for (const team of allTeams) {
            if (team.delivId === delivId) {
                await this.db.deleteTeam(team);
            }
        }

        // clear out repositories
        assignInfo.repositories = [];

        // update deliverable
        await this.dc.saveDeliverable(deliv);

        return true;
    }

    // Retrieves the status of a given assignment
    // Warning: This might be stale
    public async getAssignmentStatus(delivId: string): Promise<AssignmentStatus | null> {
        Log.info("AssignmentController::getAssignmentStatus( " + delivId + ") - start");
        let deliv = await this.dc.getDeliverable(delivId);
        if (deliv === null) {
            Log.error("AssignmentController::getAssignmentStatus(..) - error: nothing found");
            return null;
        }

        if (deliv.custom === null) {
            Log.error("AssignmentController::getAssignmentStatus(..) - error: " +
                delivId + " has no assignment status");
            return null;
        }

        if (!('seedRepoURL' in deliv.custom)) {
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
        let deliv = await this.dc.getDeliverable(delivId);
        if (deliv === null) {
            Log.error("AssignmentController::updateAssignmentStatus(..) - error: nothing found");
            return null;
        }

        if (deliv.custom === null) {
            Log.error("AssignmentController::updateAssignmentStatus(..) - error: " +
                delivId + " has no assignment status");
            return null;
        }
        // get all students, check if all repositories are created yet
        let allPeople: Person[] = await this.pc.getAllPeople();
        let allStudents: Person[] = [];
        for (const person of allPeople) {
            if (person.kind === "student") {
                allStudents.push(person);
            }
        }

        let studentRepoMapping: { [studentId: string]: Repository[] } = {};
        let assignInfo: AssignmentInfo = deliv.custom;
        let repoList: string[] = assignInfo.repositories;
        for (const repoId of repoList) {
            let repo: Repository = await this.rc.getRepository(repoId);
            // retrieve all the students associated with the repository, and then record it
            for (const teamId of repo.teamIds) {
                let team: Team = await this.tc.getTeam(teamId);
                for (const personId of team.personIds) {
                    if (typeof studentRepoMapping[personId] === 'undefined') {
                        studentRepoMapping[personId] = [];
                    }
                    studentRepoMapping[personId].push(repo);
                }
            }
        }

        // verify all students have a repository
        let newStatus = AssignmentStatus.CLOSED;
        for (const student of allStudents) {
            if (typeof studentRepoMapping[student.id] === 'undefined') {
                // this means a repository is missing,
                (deliv.custom as AssignmentInfo).status = AssignmentStatus.INACTIVE;
                await this.dc.saveDeliverable(deliv);
                return AssignmentStatus.INACTIVE;
            } else {
                // if the student has repositories,
                let studentRepos: Repository[] = studentRepoMapping[student.id];
                for (const repo of studentRepos) {
                    if (repo.custom === null) {
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
                    if (repoInfo.status < newStatus) {
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
        if (deliv === null) {
            Log.error("AssignmentController::getAssignmentRepo(..) - error: unable to find " +
                "assignment " + delivId);
            return null;
        }

        if (deliv.custom === null) {
            Log.error("AssignmentController::getAssignmentRepo(..) - error: deliverable not " +
                "setup with rubric");
            return null;
        }

        let assignInfo: AssignmentInfo = deliv.custom;
        for (const repoId of assignInfo.repositories) {
            let repo: Repository = await this.rc.getRepository(repoId);
            for (const teamId of repo.teamIds) {
                let team: Team = await this.tc.getTeam(teamId);
                if (team === null) continue;
                if (team.personIds.includes(person.id)) {
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

    /**
     *
     * @param {string} studentGradeRepoName - Repository name for the student
     * @param {string} fileName - name of the file to create
     * @param {string} studentId - Student
     * @param {string} delivId - deliverable the grade is for
     * @returns {Promise<boolean>}
     */

    public async publishGrade(studentGradeRepoName: string, fileName: string, studentId: string, delivId: string): Promise<boolean> {
        Log.info("AssignmentController::publishGrade( ..., " + studentId + ", " + delivId + " ) - start");
        // Log.error("AssignmentController::publishGrade(..) - ");

        // get student grade
        let gradeRecord: Grade = await this.gc.getGrade(studentId, delivId);
        if(gradeRecord === null) {
            Log.error("AssignmentController::publishGrade(..) - Unable to find grade for student: " + studentId + "" +
                " and delivId: " + delivId);
            return false;
        }

        // get the student's assignment breakdown
        let assignmentGrade: AssignmentGrade = gradeRecord.custom;
        if (assignmentGrade === null || typeof assignmentGrade.questions === 'undefined') {
            Log.error("AssignmentController::publishGrade(..) - Student does not have an assignmentGrade: " + studentId);
            return false;
        }

        let studentRecord = await this.pc.getPerson(studentId);
        if(studentRecord === null) {
            Log.error("AssignmentController::publishGrade(..) - Invalid studentId: " + studentId + " unable to continue");
            return false;
        }

        // get the grading rubric

        let deliverableRecord: Deliverable = await this.db.getDeliverable(delivId);
        if (deliverableRecord === null) {
            // deliverable doesn't exist! Error
            Log.error("AssignmentController::publishGrade(..) - Deliverable does not exist: " + delivId);
            return false;
        }

        // check if the deliverable is an assignment
        let assignmentInfo: AssignmentInfo = deliverableRecord.custom;
        if (assignmentInfo === null || typeof assignmentInfo.rubric === "undefined") {
            // this is not an assignment, currently does not support deliverable grade writing
            Log.error("AssignmentController::publishGrade(..) - Deliverable: " + delivId + " is not an assignment");
            return false;
        }


        // get the rubric (so we can get the max grade)
        let assignmentRubric: AssignmentGradingRubric = assignmentInfo.rubric;

        // add a file in the repo and then push
        // check if the studentRepo exists
        let repoExists = await this.gha.repoExists(studentGradeRepoName);

        if(!repoExists) {
            // Create the repo, it doesn't exist yet

            // first, need to check if a student Repo object has been created
            let studentRepoRecord: Repository = await this.rc.getRepository(studentGradeRepoName);
            if (studentRepoRecord === null) {
                Log.info("AssignmentController::publishGrade(..) - No student Repo found, creating repo");

                // create the record
                studentRepoRecord = await this.rc.createRepository(studentGradeRepoName, [], null);
                if(studentRepoRecord === null) {
                    // we tried multiple times, unable to continue (something is wrong)
                    Log.error("AssignmentController::publishGrade(..) - Error; unable to create student grade repository.");
                    return false;
                }
            }

            let repoURL: string = await this.gha.createRepo(studentGradeRepoName);
        }

        // now assume we have the all the needed pieces
        let tableInfo: string[][] = [];
        let tableHeader: string[] = ["Exercise Name", "Grade", "Out of", "Feedback"];
        tableInfo.push(tableHeader);

        // get the rest of the information
        for(let i = 0; i < assignmentRubric.questions.length; i++) {
            let assignmentQuestion: QuestionGradingRubric = assignmentRubric.questions[i];
            let studentGrade: QuestionGrade = assignmentGrade.questions[i];
            //get their subQuestions
            for(let j = 0; j < assignmentQuestion.subQuestions.length; j++) {
                let assignmentSubQuestion: SubQuestionGradingRubric = assignmentQuestion.subQuestions[j];
                let gradeSubQuestion: SubQuestionGrade = studentGrade.subQuestion[j];
                let rowName = assignmentQuestion.name + " - " + assignmentSubQuestion.name;
                let newRow = [rowName, String(gradeSubQuestion.grade), String(assignmentSubQuestion.outOf), gradeSubQuestion.feedback];
                tableInfo.push(newRow);
            }
        }

        // construct the md file
        Log.info("AssignmentController::publishGrade(..) - generating tableInfo complete; " + tableInfo);

        let table = require('markdown-table');
        let payload = table(tableInfo);

        // add extra line warning that grades are potentially rounded

        return true;
    }
}
