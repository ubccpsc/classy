// import {GradePayload} from "../GradesController";
import Log from "../../../../../common/Log";
import {
    AssignmentGrade,
    AssignmentGradingRubric,
    AssignmentInfo,
    AssignmentRepositoryInfo,
    AssignmentStatus,
    QuestionGrade,
    QuestionGradingRubric,
    SubQuestionGrade,
    SubQuestionGradingRubric
} from "../../../../../common/types/CS340Types";
import {GradePayload} from "../../../../../common/types/SDMMTypes";
import Util from "../../../../../common/Util";
import {Factory} from "../../Factory";
import {Deliverable, Grade, Person, Repository, Team} from "../../Types";
import {DatabaseController} from "../DatabaseController";
import {DeliverablesController} from "../DeliverablesController";
import {GitHubActions, IGitHubActions} from "../GitHubActions";
import {GitHubController, GitTeamTuple} from "../GitHubController";
import {GradesController} from "../GradesController";
import {PersonController} from "../PersonController";
import {RepositoryController} from "../RepositoryController";
import {ScheduleController} from "../ScheduleController";
import {TeamController} from "../TeamController";
import {CS340Controller} from "./CS340Controller";
import {RubricController} from "./RubricController";

/*
 * Definition of controller object
 */
export class AssignmentController {
    private db: DatabaseController = DatabaseController.getInstance();
    private gc: GradesController = new GradesController();
    private rc: RepositoryController = new RepositoryController();
    private tc: TeamController = new TeamController();
    private dc: DeliverablesController = new DeliverablesController();
    private ghc: GitHubController = new GitHubController(GitHubActions.getInstance());
    private pc: PersonController = new PersonController();
    private gha: IGitHubActions = GitHubActions.getInstance();
    private sc: ScheduleController = ScheduleController.getInstance();
    private rbc: RubricController = new RubricController();
    private cc: CS340Controller = Factory.getCourseController(this.ghc);

    /**
     * Gets the assignment grade for the personId and assignmentId
     * @param personId
     * @param assignId
     */
    public async getAssignmentGrade(personId: string, assignId: string): Promise<AssignmentGrade | null> {
        // let returningPromise = new Promise((resolve, reject) => {
        //     let gradeObj : Grade = await this.gc.getGrade(org, personId, assignId);
        // });
        //
        // return returningPromise;
        Log.info("AssignmentController:getAssignmentGrade(" + ", " + personId + ", " + assignId + ") - start");
        const grade: Grade = await this.gc.getGrade(personId, assignId);
        if (grade === null) {
            Log.error("AssignmentController::getAssignmentGrade(..) - No grade found.");
            return null;
        }

        const assignmentGrade: AssignmentGrade = grade.custom.assignmentGrade;
        // check if the grade retrieved is an assignment grade. If it isn't, return null.
        if (assignmentGrade === undefined || typeof assignmentGrade.questions === 'undefined' ||
            typeof assignmentGrade.assignmentID === 'undefined') {
            Log.error("AssignmentController::getAssignmentGrade(..) - Grade retrieved is not an assignment grade.");
            return null;
        }

        return assignmentGrade;
    }

    /**
     * Sets the assignment grade for the repository, based on the assignment
     * @param repoID - repository to select for the new grade
     * @param assignId - assignment that is associated with the grade
     * @param assnPayload - new assignment grade to save
     * @param markerId - the person who marked the assignment
     */
    public async setAssignmentGrade(repoID: string,
                                    assignId: string,
                                    assnPayload: AssignmentGrade,
                                    markerId: string = ""): Promise<boolean> {
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

        // check if the repository exists
        const repo: Repository = await this.rc.getRepository(repoID);
        // if(repo === null) {
        //     // create the repo
        //     let person = await this.pc.getPerson(assnPayload.studentID);
        //
        //     // check if there is an empty repo
        //     repo = await this.rc.getRepository("empty_" + person.id);
        //     if(repo === null) {
        //         let deliv = await this.db.getDeliverable(assignId);
        //         if(deliv === null || typeof(deliv.custom as AssignmentInfo).rubric === "undefined") {
        //             return false;
        //         }
        //         let team = await this.tc.getTeam("empty_" + person.id);
        //         if(team === null) {
        //             team = await this.tc.createTeam("empty_" + person.id, deliv, [person], null);
        //         }
        //
        //         // let arepoInfo: AssignmentRepositoryInfo = {
        //         //     assignmentId: []
        //         // }
        //         repo = await this.rc.createRepository("empty_" + person.id, [team], null);
        //     }
        // }

        if (repo === null) {
            Log.error("AssignmentController::setAssignmentGrade(..) - unable to find repo: " + repoID);
            return false;
        }

        Log.trace("AssignmentController::setAssignmentGrade() - " + (markerId ? 'Marked by ' + markerId : 'Marked assignment'));

        const newGradePayload: GradePayload = {
            // assignmentID: assnPayload.assignmentID,
            // studentID: assnPayload.studentID,
            score:     totalGrade,
            comment:   markerId !== "" ? 'Marked by ' + markerId : 'Marked assignment',
            urlName:   repo.id,
            URL:       repo.URL,
            timestamp: Date.now(),
            custom:    {assignmentGrade: assnPayload}
        };

        const success = await this.gc.createGrade(repo.id, assignId, newGradePayload);
        const deliverableRecord: Deliverable = await this.db.getDeliverable(assignId);

        // check if we should publish the grade (if the assignment's grades are released, publish the grade immediately
        if (deliverableRecord !== null && deliverableRecord.custom.assignment !== undefined) {
            if (typeof deliverableRecord.custom.assignment.status !== "undefined") {
                // if the deliverable's grades are released
                if (deliverableRecord.gradesReleased) {
                    // get the person, and publish their grades
                    const personRecord: Person = await this.db.getPerson(assnPayload.studentID);
                    if (personRecord === null) {
                        return success;
                    }
                    try {
                        // TODO: Return this as part of the response (?), leaving it as is might be annoying for tests b/c of timing issues
                        // do this async
                        await this.publishGrade(personRecord.githubId + "_grades",
                            assignId + "_grades.md", personRecord.id, assignId);
                    } catch (err) {
                        Log.error("AssignmentController::setAssignmentGrade(..) - Error: " + err);
                    }
                }
            }
        }

        return success;
    }

    /**
     * Initializes an assignment Repo, based on the information specified in the Assignment object
     * @param repoName
     * @param delivId
     * @param teams
     */
    public async createAssignmentRepo(repoName: string, delivId: string, teams: Team[]): Promise<Repository | null> {
        Log.info("AssignmentController::createAssignmentRepo( " + repoName + ", " + delivId + ",... ) - start");
        // get assignment information
        const deliverable: Deliverable = await this.dc.getDeliverable(delivId);
        if (deliverable === null) {
            Log.error("AssignmentController::createAssignmentRepo(..) - error: could not retrieve " +
                "deliverable based on delivId: " + delivId);
            return null;
        }
        const assignInfo: AssignmentInfo = deliverable.custom.assignment;
        if (assignInfo === undefined || typeof assignInfo.seedRepoURL === 'undefined') {
            Log.error("AssignmentController::createAssignmentRepo(..) - deliverable " + delivId + " is" +
                "not an assignment.");
            return null;
        }

        // save repository information to database
        const assignRepoInfo: AssignmentRepositoryInfo = {
            assignmentId:  [delivId],
            status:        AssignmentStatus.CREATED,
            assignedTeams: []
        };

        // add all the teams
        for (const team of teams) {
            assignRepoInfo.assignedTeams.push(team.id);
        }

        // creates repository record
        const repository = await this.rc.createRepository(repoName, deliverable, teams, {assignmentInfo: assignRepoInfo});

        // retrieve provisioning information
        const seedURL = assignInfo.seedRepoURL;
        const seedPath = assignInfo.seedRepoPath;
        // const mainFilePath = assignInfo.mainFilePath;

        // attempt to provision the repository
        let provisionAttempt: boolean;
        try {
            if (seedPath.trim() === "" || seedPath.trim() === "*" || seedPath.trim() === "/*") {
                provisionAttempt = await this.ghc.createRepository(repoName, seedURL);
            } else {
                provisionAttempt = await this.ghc.createRepository(repoName, seedURL, seedPath.trim());
            }
        } catch (err) {
            Log.error("AssignmentController::createAssignmentRepo(..) - Error: " + err);
        }

        if (!provisionAttempt) {
            Log.error("AssignmentController::createAssignmentRepo(..) - error: unable to create repository");
            return null;
        }

        // record the url
        repository.URL = await this.ghc.getRepositoryUrl(repository);

        await this.db.writeRepository(repository);

        if (!assignInfo.repositories.includes(repository.id)) {
            Log.info("AssignmentController::createAssignmentRepo(..) - adding repository to list");
            deliverable.custom.assignment.repositories.push(repository.id);
            // save the assignment information back
            await this.dc.saveDeliverable(deliverable);
        }

        Log.info("AssignmentController::createAssignmentRepo(..) - finish");
        return repository;
    }

    /**
     * Initializes all repositories, if a team exists with a student and the associated deliverable
     * create the repository with that team.
     * @param delivId
     */
    public async initializeAllRepositories(delivId: string): Promise<boolean> {
        Log.info("AssignmentController::initializeAllRepositories( " + delivId + ") - start");
        // Log.info("AssignmentController::initializeAllRepositories(..)");
        const deliv: Deliverable = await this.dc.getDeliverable(delivId);
        if (deliv === null) {
            Log.error("AssignmentController::initializeAllRepositories(..) - Invalid deliverable");
            return false;
        }

        // verify this is an assignment
        if (deliv.custom.assignment === undefined || typeof (deliv.custom.assignment.repositories) === "undefined") {
            Log.error("AssignmentController::initializeAllRepositories(..) - assignment not set up" +
                "properly");
            return false;
        }

        // get all students
        const allPeople: Person[] = await this.pc.getAllPeople();
        const allStudents: Person[] = [];
        for (const person of allPeople) {
            if (person.kind === "student") {
                allStudents.push(person);
            }
        }

        let anyError: boolean = false;

        const allTeams: Team[] = await this.tc.getAllTeams();
        // create a mapping between persons and teams
        const personTeams: {[personId: string]: Team} = {};
        for (const team of allTeams) {
            if (team.delivId === delivId) {
                for (const personId of team.personIds) {
                    personTeams[personId] = team;
                }
            }
        }

        const peopleList = await this.gha.listPeople();
        const personVerification: {[githubID: string]: any} = {};

        // create a map of personID to
        for (const person of peopleList) {
            if (typeof personVerification[person.githubId] === 'undefined') {
                personVerification[person.githubId] = person;
            }
        }
        let assignInfo: AssignmentInfo;

        for (const student of allStudents) {
            // verify student is a person in the org, if not, skip it (DATABASE INCONSISTENCY!?)
            if (typeof personVerification[student.githubId] === 'undefined') {
                Log.error("AssignmentController::initializeAllRepositories(..) - ERROR: " +
                    "database inconsistency; student exists that is not registered in Github. " +
                    "Student ID: " + student.id + "; Student Github ID: " + student.githubId);
                continue;
            }

            let studentTeam: Team;
            let newGithubTeam: {teamName: string, githubTeamNumber: number};
            let githubTuple: GitTeamTuple;
            let repoName: string;

            if (typeof personTeams[student.id] === "undefined") {
                // for each student, create a team
                let teamName: string;
                if (deliv.teamPrefix === null || deliv.teamPrefix === "") {
                    teamName = deliv.id + "_";
                } else {
                    teamName = deliv.teamPrefix;
                }
                teamName += student.githubId;

                // let computedNames = await this.cc.computeNames(deliv, [student]);
                // let teamName: string = computedNames.teamName;

                // verify if the team exists or not
                studentTeam = await this.tc.getTeam(teamName);
                if (studentTeam === null) {
                    // The team doesn't exist, so initialize it
                    studentTeam = await this.tc.createTeam(teamName, deliv, [student], {});
                }
                if (studentTeam === null) {
                    Log.error("AssignmentController::initializeAllRepositories(..) - error creating team " +
                        teamName + " for student " + student.githubId);
                }

                newGithubTeam = await this.gha.createTeam(teamName, "push");
                githubTuple = await this.gha.addMembersToTeam(newGithubTeam.teamName, newGithubTeam.githubTeamNumber, [student.githubId]);
            } else {
                studentTeam = personTeams[student.id];
            }

            if (typeof personTeams[student.id] === "undefined") {
                if (deliv.repoPrefix === null || deliv.repoPrefix === "") {
                    repoName = deliv.id + "_";
                } else {
                    repoName = deliv.repoPrefix;
                }
                repoName += student.githubId;
            } else {
                repoName = studentTeam.id;
                if (!repoName.startsWith(deliv.repoPrefix)) {
                    repoName = deliv.repoPrefix + repoName;
                }
            }

            // attempt to provision the repository,
            // if success, add it to the AssignmentInfo
            assignInfo = (await this.db.getDeliverable(delivId)).custom.assignment;
            const repoList: string[] = assignInfo.repositories;
            let provisionedRepo: Repository;
            if (!repoList.includes(repoName)) {
                provisionedRepo = await this.createAssignmentRepo(repoName, delivId, [studentTeam]);
                await Util.delay(200);
            } else {
                continue;
            }

            // let provisionedRepo = await this.createAssignmentRepo(repoName, delivId, [studentTeam]);

            if (provisionedRepo !== null) {
                if (assignInfo.repositories === null || typeof assignInfo.repositories === 'undefined') {
                    assignInfo.repositories = [];
                }
                if (!assignInfo.repositories.includes(provisionedRepo.id)) {
                    assignInfo.repositories.push(provisionedRepo.id);
                }
                Log.info("AssignmentController::initializeAllRepositories(..) - added repo " +
                    repoName + "to assignment");
            } else {
                Log.trace("AssignmentController::initializeAllRepositories(..) - provisioning repo: " +
                    repoName + " failed.");
                anyError = true;
            }
        }

        assignInfo = (await this.db.getDeliverable(delivId)).custom.assignment;

        // once you are done, update the assignment information
        if (!anyError) {
            assignInfo.status = AssignmentStatus.CREATED;
        }
        deliv.custom.assignment = assignInfo;
        await this.dc.saveDeliverable(deliv);
        Log.info("AssignmentController::initializeAllRepositories(..) - finish");
        return true;
    }

    /**
     * Releases an assignment repository to the students
     * @param repoId
     */
    public async publishAssignmentRepo(repoId: string): Promise<boolean> {
        Log.info("AssignmentController::publishAssignmentRepo( " + repoId + " ) - start");
        // Log.info("AssignmentController::publishAssignmentRepo(..)");
        const repo: Repository = await this.rc.getRepository(repoId);
        if (repo.custom.assignmentInfo === undefined) {
            Log.error("AssignmentController::publishAssignmentRepo(..) - error: repository " + repoId +
                " not created properly");
            return false;
        }

        // check if assignment is ready to be published
        const repoInfo: AssignmentRepositoryInfo = repo.custom.assignmentInfo;
        if (repoInfo !== undefined && repoInfo.status !== AssignmentStatus.CREATED) {
            Log.error("AssignmentController::publishAssignmentRepo(..) - error: repository " + repoId +
                " is not initialized");
            switch (repoInfo.status) {
                case AssignmentStatus.INACTIVE: {
                    Log.warn("AssignmentController::publishAssignmentRepo(..) - status: INACTIVE");
                    break;
                }
                case AssignmentStatus.RELEASED: {
                    Log.warn("AssignmentController::publishAssignmentRepo(..) - status: RELEASED");
                    break;
                }
                case AssignmentStatus.CLOSED: {
                    Log.warn("AssignmentController::publishAssignmentRepo(..) - status: CLOSED");
                    break;
                }
            }
            return false;
        }

        const teamList: Team[] = [];
        for (const teamId of repoInfo.assignedTeams) {
            const team = await this.tc.getTeam(teamId);
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

        const success: boolean = await this.ghc.releaseRepository(repo, teamList, false);

        if (success) {
            repoInfo.status = AssignmentStatus.RELEASED;
            await this.db.writeRepository(repo);
        } else {
            Log.error("AssignmentController::publishAssignmentRepo(..) - unable to release repo");
            return false;
        }

        Log.info("AssignmentController::publishAssignmentRepo(..) - finish");
        return true;
    }

    /**
     * Publishes all repository with the given deliverable ID
     * @param delivId - Deliverable ID
     */
    public async publishAllRepositories(delivId: string): Promise<boolean> {
        Log.info("AssignmentController::publishAllRepositories( " + delivId + " ) - start");
        // Log.info("AssignmentController::publishAllRepositories(..)");

        // update assignment information first
        Log.info("AssignmentController::publishAllRepositories(..) - updating assignment status");
        const statusSuccess = await this.updateAssignmentStatus(delivId);
        if (statusSuccess === null) {
            Log.error("AssignmentController::publishAllRepositories(..) - Error: Deliverable is not correct");
            return false;
        }

        const deliv = await this.dc.getDeliverable(delivId);
        if (deliv === null || deliv.custom.assignment === undefined ||
            typeof deliv.custom.assignment.mainFilePath === "undefined") {
            Log.error("AssignmentController::publishAllRepositories(..) - error: assignment not " +
                "set up properly or doesn't exist");
            return false;
        }

        let assignInfo: AssignmentInfo = deliv.custom.assignment;

        if (assignInfo === undefined || typeof  assignInfo.status === "undefined") {
            Log.error("AssignmentController::publishAllRepositories(..) - Error: Deliverable: " + delivId + " " +
                "is not an assignment.");
            return false;
        }

        // check if the repositories have been created
        if (assignInfo.status === AssignmentStatus.INACTIVE) {
            await this.initializeAllRepositories(delivId);
            // poll the assignment info again, as it might have changed after initializing repositories
            assignInfo = (await this.dc.getDeliverable(delivId)).custom.assignment;
        }

        let anyError: boolean = false;
        for (const repoId of assignInfo.repositories) {
            const repo: Repository = await this.rc.getRepository(repoId);
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

        assignInfo.status = AssignmentStatus.RELEASED;
        deliv.custom.assignment = assignInfo;
        await this.dc.saveDeliverable(deliv);
        Log.info("AssignmentController::publishAllRepositories(..) - finish");
        return true;
    }

    public async closeAssignmentRepository(repoId: string): Promise<boolean> {
        Log.info("AssignmentController::closeRepository( " + repoId + " ) - start");
        const repoRecord: Repository = await this.rc.getRepository(repoId);
        if (repoRecord === null) {
            Log.error("AssignmentController::closeRepository(..) - Error: Repository not found; repoId: " + repoId);
            // Log.error("AssignmentController::closeRepository(..) - Error: ");
            return false;
        }

        if (repoRecord.custom.assignmentInfo === undefined || typeof repoRecord.custom.assignmentInfo.status === 'undefined') {
            Log.error("AssignmentController::closeRepository(..) - Error: RepoId: " + repoId + " is " +
                "not an assignment Repo");
            return false;
        }

        const success = await this.gha.setRepoPermission(repoRecord.id, "pull");
        if (!success) {
            Log.error("AssignmentController::closeRepository(..) - Error: Was not successful in changing permissions for repo");
            return false;
        }

        repoRecord.custom.assignmentInfo.status = AssignmentStatus.CLOSED;

        await this.db.writeRepository(repoRecord);
        return true;
    }

    /**
     * Closes all repositories
     * @param delivId - Deliverable ID to close repositories
     */
    public async closeAllRepositories(delivId: string): Promise<boolean> {
        Log.info("AssignmentController::closeAllRepositories( " + delivId + " ) - start");
        // Log.error("AssignmentController::closeAllRepositories(..) - Error: ");

        const deliverableRecord: Deliverable = await this.db.getDeliverable(delivId);
        if (deliverableRecord === null) {
            Log.error("AssignmentController::closeAllRepositories(..) - Error: Invalid delivId: " + delivId);
            return false;
        }

        // verify deliverable is an assignment
        if (deliverableRecord.custom.assignment === undefined ||
            typeof deliverableRecord.custom.assignment.repositories === 'undefined') {
            Log.error("AssignmentController::closeAllRepositories(..) - Error: Deliverable: " + delivId + " is not an assignment");
            return false;
        }

        const assignmentRepos: string[] = (deliverableRecord.custom.assignment as AssignmentInfo).repositories;

        let overallSuccess = true;
        for (const repoId of assignmentRepos) {
            const success: boolean = await this.closeAssignmentRepository(repoId);
            if (!success) {
                Log.warn("AssignmentController::closeAllRepositories(..) - Error: unable to close repository: " + repoId);
                overallSuccess = false;
            }
        }

        if (overallSuccess) {
            (deliverableRecord.custom.assignment as AssignmentInfo).status = AssignmentStatus.CLOSED;
            await this.db.writeDeliverable(deliverableRecord);
        } else {
            Log.warn("AssignmentController::closeAllRepositories(..) - Error: unable to close a repo in the assignment");
        }

        const rubricSuccess = await this.rbc.updateRubric(deliverableRecord.id);

        return overallSuccess && rubricSuccess;
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

        const deliverable: Deliverable = await this.dc.getDeliverable(delivId);
        if (deliverable === null) {
            Log.error("AssignmentController::deleteAssignmentRepository(..) - error: could not retrieve " +
                "deliverable based on delivId: " + delivId);
            return null;
        }
        const assignInfo: AssignmentInfo = deliverable.custom.assignment;
        if (assignInfo === undefined || typeof assignInfo.repositories === 'undefined') {
            Log.error("AssignmentController::deleteAssignmentRepository(..) - deliverable " + delivId + " is" +
                "not an assignment.");
            return null;
        }

        if (!await this.gha.deleteRepo(repoName)) {
            return false;
        }

        if (single) {
            const pos = assignInfo.repositories.indexOf(repoName);
            if (pos !== -1) {
                assignInfo.repositories.splice(pos, 1);
            }

            // save update information to database
            await this.dc.saveDeliverable(deliverable);
        }

        const repoRecord: Repository = await this.rc.getRepository(repoName);
        if (repoRecord === null) {
            Log.error("AssignmentController::deleteAssignmentRepository(..) - error: unable" +
                " to retrieve repository from database");

            return null;
        }

        // TODO: Clean up teams as well
        // NOTE: Probably won't happen, this function was mainly used for debugging

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

        const deliv: Deliverable = await this.dc.getDeliverable(delivId);
        // get assignment information
        if (deliv.custom.assignment === undefined || typeof (deliv.custom.assignment as AssignmentInfo).repositories === 'undefined') {
            Log.error("AssignmentController::deleteAllAssignmentRepositories(..) - " +
                "assignment not set up properly");
            return false;
        }

        const assignInfo: AssignmentInfo = deliv.custom.assignment;
        for (const repoName of assignInfo.repositories) {
            await this.deleteAssignmentRepository(repoName, delivId, false);
        }

        // check teams and make sure that the team records is deleted
        const allTeams = await this.tc.getAllTeams();
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
    /**
     * [WARNING] DEPRECATED - Gets the last calculated assignment status.
     * @param delivId
     */
    public async getAssignmentStatus(delivId: string): Promise<{
        assignStatus: AssignmentStatus,
        totalStudents: number, studentRepos: number
    } | null> {
        Log.info("AssignmentController::getAssignmentStatus( " + delivId + ") - start");
        Log.warn("AssignmentController::getAssignmentStatus(..) -- This method should not be used (deprecated); " +
            "use updateAssignmentStatus instead");

        const deliv = await this.dc.getDeliverable(delivId);
        if (deliv === null) {
            Log.error("AssignmentController::getAssignmentStatus(..) - error: nothing found");
            return null;
        }

        if (typeof deliv.custom.assignment.mainFilePath === "undefined") {
            Log.error("AssignmentController::getAssignmentStatus(..) - error: " +
                delivId + " has no assignment status");
            return null;
        }

        if (!('seedRepoURL' in deliv.custom.assignment)) {
            Log.error("AssignmentController::getAssignmentStatus(..) - error: " +
                delivId + " has no assignment status");
            return null;
        }

        Log.info("AssignmentController::getAssignmentStatus(..) - finish");
        return {assignStatus: deliv.custom.assignment.status, totalStudents: -1, studentRepos: -1};
    }

    /**
     * Updates the assignment status, and returns an object on the newly calculated status
     * @param delivId
     */
    public async updateAssignmentStatus(delivId: string): Promise<{
        // Updates the status of a given assignment
        // iterates over checking each status of the assigned repository
        assignmentStatus: AssignmentStatus,
        totalStudents: number, studentRepos: number
    } | null> {
        Log.info("AssignmentController::updateAssignmentStatus( " + delivId + " ) - start");
        const deliv = await this.dc.getDeliverable(delivId);
        if (deliv === null) {
            Log.error("AssignmentController::updateAssignmentStatus(..) - error: nothing found");
            return null;
        }

        // if (deliv.custom === null || typeof (deliv.custom as AssignmentInfo).status === 'undefined') {
        if (deliv.custom.assignment === undefined ||
            typeof deliv.custom.assignment.repositories === "undefined") {
            Log.error("AssignmentController::updateAssignmentStatus(..) - error: " +
                delivId + " is not an assignment");
            return null;
        }
        // get all students, check if all repositories are created yet
        const allPeople: Person[] = await this.pc.getAllPeople();
        const allStudents: Person[] = [];
        for (const person of allPeople) {
            if (person.kind === "student") {
                allStudents.push(person);
            }
        }

        Log.info("AssignmentController::updateAssignmentStatus(..) - Counted " + allStudents.length + " students in db");

        // build a repository mapping
        const studentRepoMapping: {[studentId: string]: Repository[]} = {};
        const assignInfo: AssignmentInfo = deliv.custom.assignment;
        const repoList: string[] = assignInfo.repositories;
        // for all repositories associated with the assignment
        for (const repoId of repoList) {
            let repo: Repository;
            Log.info("AssignmentController::updateAssignmentStatus(..) - verifying repo: " + repoId);
            try {
                repo = await this.rc.getRepository(repoId);
            } catch (err) {
                Log.error("AssignmentController::updateAssignmentStatus(..) - Error: " + err);
                continue;
            }
            // retrieve all the students associated with the repository, and then record it
            for (const teamId of repo.teamIds) {
                let team: Team;
                Log.info("AssignmentController::updateAssignmentStatus(..) - verifying team: " + teamId);
                try {
                    team = await this.tc.getTeam(teamId);
                    if (team === null) {
                        Log.error("AssignmentController::updateAssignmentStatus(..) - Team does not exist: " + teamId);
                        continue;
                    }

                } catch (err) {
                    Log.error("AssignmentController::updateAssignmentStatus(..) - Error: " + err);
                }
                for (const personId of team.personIds) {
                    if (typeof studentRepoMapping[personId] === 'undefined') {
                        studentRepoMapping[personId] = [];
                    }
                    studentRepoMapping[personId].push(repo);
                }
            }
        }

        // database to github verification
        const peopleList = await this.gha.listPeople();
        const personVerification: {[githubID: string]: any} = {};

        // create a map of personID
        let personvVerificationCount = 0;
        for (const person of peopleList) {
            if (typeof personVerification[person.githubId] === 'undefined') {
                personVerification[person.githubId] = person;
                personvVerificationCount++;
            }
        }

        Log.info("AssignmentController::updateAssignmentStatus(..) - Counted " + personvVerificationCount + " " +
            "students in the github verification map.");

        // verify all students have a repository
        let newStatus = AssignmentStatus.CLOSED;
        let totalStudentCount = allStudents.length;
        let studentRepoCount = 0;
        // check each student,
        for (const student of allStudents) {
            if (typeof personVerification[student.githubId] === 'undefined') {
                Log.warn("Skipping student: " + student.id + " as they are missing from Github.");
                totalStudentCount--;
                continue;
            }
            if (typeof studentRepoMapping[student.id] === 'undefined') {
                // this means a repository is missing,
                Log.info("AssignmentController::updateAssignmentStatus(..) - student: " + student.id + " " +
                    "is missing a repository");
                // (deliv.custom as AssignmentInfo).status = AssignmentStatus.INACTIVE;
                // await this.dbc.saveDeliverable(deliv);
                if (AssignmentStatus.INACTIVE < newStatus) {
                    newStatus = AssignmentStatus.INACTIVE;
                }
                continue;
            } else {
                // if the student has repositories,
                const studentRepos: Repository[] = studentRepoMapping[student.id];
                for (const repo of studentRepos) {

                    if (typeof repo.custom.assignmentInfo.assignmentId === "undefined") {
                        // a repo is not classified properly
                        Log.error("AssignmentController::updateAssignmentStatus(..) - error: " +
                            "repository " + repo.id + " is not set up properly");

                        // return null;
                        continue;
                    }
                    const repoInfo: AssignmentRepositoryInfo = repo.custom.assignmentInfo;

                    studentRepoCount += 1;

                    if (repoInfo.status < newStatus) {
                        newStatus = repoInfo.status;
                    }
                }
            }
        }

        // if the assignment has been closed before, you probably don't want to re-open it again (let it stay closed)
        // even if students join later
        if (deliv.custom.assignment.status !== AssignmentStatus.CLOSED) {
            deliv.custom.assignment.status = newStatus;
            await this.dc.saveDeliverable(deliv);
        } else {
            Log.warn("AssignmentController::updateAssignmentStatus( " + delivId + " ) - Calculated status is: " + newStatus);
        }

        newStatus = (await this.db.getDeliverable(delivId)).custom.assignment.status;

        Log.info("AssignmentController::updateAssignmentStatus(..) - finish");
        return {assignmentStatus: newStatus, totalStudents: totalStudentCount, studentRepos: studentRepoCount};
    }

    public async getAssignmentRepo(delivId: string, person: Person): Promise<Repository | null> {
        Log.info("AssignmentController::getAssignmentRepo( " + delivId + ", " + person + " ) - start");

        const deliv = await this.dc.getDeliverable(delivId);
        if (deliv === null) {
            Log.error("AssignmentController::getAssignmentRepo(..) - error: unable to find " +
                "assignment " + delivId);
            return null;
        }

        if (deliv.custom.assignment === undefined ||
            typeof deliv.custom.assignment.mainFilePath === "undefined") {
            Log.error("AssignmentController::getAssignmentRepo(..) - error: deliverable not " +
                "setup with rubric");
            return null;
        }

        const assignInfo: AssignmentInfo = deliv.custom.assignment;
        for (const repoId of assignInfo.repositories) {
            const repo: Repository = await this.rc.getRepository(repoId);
            for (const teamId of repo.teamIds) {
                const team: Team = await this.tc.getTeam(teamId);
                if (team === null) {
                    continue;
                }
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
     * Publishes an assignment grade to the given student repository
     * @param {string} studentGradeRepoName - Repository name for the student
     * @param {string} fileName - name of the file to create
     * @param {string} studentId - Student
     * @param {string} delivId - deliverable the grade is for
     * @param {string} header (optional)- Extra string to add at the top of the md file
     * @param {string} footer (optional)- Extra string to add at the bottom of the md file
     * @returns {Promise<boolean>}
     */
    public async publishGrade(studentGradeRepoName: string, fileName: string, studentId: string,
                              delivId: string, header?: string, footer?: string): Promise<boolean> {
        Log.info("AssignmentController::publishGrade( ..., " + studentId + ", " + delivId + " ) - start");
        // Log.error("AssignmentController::publishGrade(..) - ");

        let studentRecord = await this.pc.getPerson(studentId);
        if (studentRecord === null) {
            Log.error("AssignmentController::publishGrade(..) - Invalid studentId: " + studentId + " unable to continue");
            return false;
        }

        // get the grading rubric
        const deliverableRecord: Deliverable = await this.db.getDeliverable(delivId);
        if (deliverableRecord === null) {
            // deliverable doesn't exist! Error
            Log.error("AssignmentController::publishGrade(..) - Deliverable does not exist: " + delivId);
            return false;
        }

        // check if the deliverable is an assignment
        const assignmentInfo: AssignmentInfo = deliverableRecord.custom.assignment;
        if (assignmentInfo === undefined || assignmentInfo === null || typeof assignmentInfo.rubric === "undefined") {
            // this is not an assignment, currently does not support deliverable grade writing
            Log.error("AssignmentController::publishGrade(..) - Deliverable: " + delivId + " is not an assignment");
            return false;
        }

        // get the rubric (so we can get the max grade)
        const assignmentRubric: AssignmentGradingRubric = assignmentInfo.rubric;

        // get student grade
        const gradeRecord: Grade = await this.gc.getGrade(studentId, delivId);
        let assignmentGrade: AssignmentGrade;
        let validGrade: boolean = false;
        if (gradeRecord === null || gradeRecord.custom.assignmentGrade === undefined ||
            typeof gradeRecord.custom.assignmentGrade.questions === 'undefined') {
            // Log.error("AssignmentController::publishGrade(..) - Unable to find grade for student: " + studentId + "" +
            //     " and delivId: " + delivId);
            // return false;
            Log.info("AssignmentController::publishGrade(..) - Unable to find student grade");
            assignmentGrade = this.generateEmptyGrade(assignmentRubric);
        } else if (gradeRecord.custom.assignmentGrade === null || typeof gradeRecord.custom.assignmentGrade.questions === 'undefined') {
            Log.info("AssignmentController::publishGrade(..) - Student does not have an assignmentGrade");
            assignmentGrade = this.generateEmptyGrade(assignmentRubric);
        } else {
            assignmentGrade = gradeRecord.custom.assignmentGrade;
            validGrade = true;
        }

        // check if the grade has been released before:
        if (assignmentGrade.released) {
            Log.info("AssignmentController::publishGrade(..) - Grade for student: " + studentId + " has " +
                "already been released, skipping");
            return true;
        }

        // // get the student's assignment breakdown
        // assignmentGrade = gradeRecord.custom;
        // if (assignmentGrade === null || typeof assignmentGrade.questions === 'undefined') {
        //     Log.error("AssignmentController::publishGrade(..) - Student does not have an assignmentGrade: " + studentId);
        //     return false;
        // }

        /*
        // add a file in the repo and then push
        // check if the studentRepo exists
        let repoExists = await this.gha.repoExists(studentGradeRepoName);
        let studentRepoRecord: Repository = await this.rc.getRepository(studentGradeRepoName);

        if(!repoExists) {
            // Create the repo, it doesn't exist yet

            // first, need to check if a student Repo object has been created
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

            // create the repo
            let repoURL: string = await this.gha.createRepo(studentGradeRepoName);
        } else {
            if(studentRepoRecord === null) {
                studentRepoRecord = await this.rc.createRepository(studentGradeRepoName, [], null);
                studentRepoRecord.URL = await this.ghc.getRepositoryUrl(studentRepoRecord);
                await this.db.writeRepository(studentRepoRecord);
            }
        }
        */

        // now assume we have the all the needed pieces
        const tableInfo: string[][] = [];
        const tableHeader: string[] = ["**Exercise Name**", "**Grade**",
            "**Out of**", "**Feedback**"];
        tableInfo.push(tableHeader);

        // get the rest of the information

        Log.info("AssignmentController::publishGrade( .. ) - generating rows");

        let totalReceived: number = 0;
        let totalPossible: number = 0;
        for (let i = 0; i < assignmentRubric.questions.length; i++) {
            const assignmentQuestion: QuestionGradingRubric = assignmentRubric.questions[i];
            const studentGrade: QuestionGrade = assignmentGrade.questions[i];

            // get their subQuestions

            for (let j = 0; j < assignmentQuestion.subQuestions.length; j++) {
                const assignmentSubQuestion: SubQuestionGradingRubric = assignmentQuestion.subQuestions[j];
                const gradeSubQuestion: SubQuestionGrade = studentGrade.subQuestion[j];
                const rowName = assignmentQuestion.name + " - " + assignmentSubQuestion.name;
                const newRowRec = [rowName, String(gradeSubQuestion.grade),
                    String(assignmentSubQuestion.outOf), gradeSubQuestion.feedback];
                tableInfo.push(newRowRec);
                totalReceived += gradeSubQuestion.grade * assignmentSubQuestion.weight;
                totalPossible += assignmentSubQuestion.outOf * assignmentSubQuestion.weight;
            }
        }

        const percentageReceived: number = totalReceived / totalPossible;
        const newRow = ["**Total**", String(totalReceived), String(totalPossible),
            "Final Grade: " + (Math.round(percentageReceived * 100 * 10) / 10).toFixed(1) + "%"];
        tableInfo.push(newRow);

        // construct the md file
        Log.info("AssignmentController::publishGrade(..) - generating tableInfo complete; " + tableInfo);

        const table = require('markdown-table');

        let payload = "# " + deliverableRecord.id;

        if (header) {
            payload += "\n\n" + header;
        }

        payload += "\n\n" + table(tableInfo);

        if (footer) {
            payload += "\n\n" + footer;
        }

        // add extra line warning that grades are potentially rounded

        payload = payload + "\n\n Note: The weighed average of the above grades may deviate by 1 percent from the " +
            "overall grade due to rounding. However the overall grade shown is the correct one.";

        // get the repo again (in case of database changes)
        Log.info("AssignmentController::publishGrade( .. ) - retrieving repositoryRecord again");

        const studentRepoRecord: Repository = await this.verifyAndCreateRepo(studentGradeRepoName, deliverableRecord);

        // create the githubTeam and add the person to the team.
        studentRecord = await this.pc.getPerson(studentId);

        const teamName = studentId + "_grades";
        const team: Team = {
            id:        teamName,
            delivId:   delivId,
            URL:       null,
            personIds: [studentRecord.id],
            custom:    {}
        };
        const dbc = DatabaseController.getInstance();
        await dbc.writeTeam(team);

        const githubTeamInfo = await this.gha.createTeam(teamName, "pull");
        await this.gha.addMembersToTeam(studentId + "_grades",
            githubTeamInfo.githubTeamNumber, [studentRecord.githubId]);
        const addResult = await this.gha.addTeamToRepo(githubTeamInfo.githubTeamNumber,
            studentGradeRepoName, "pull");

        let gitSuccess: boolean;
        try {
            Log.info("AssignmentController::publishGrade( .. ) - writing grade");

            gitSuccess = await this.gha.writeFileToRepo(studentRepoRecord.URL,
                delivId + "_grades.md", payload, validGrade);
        } catch (err) {
            Log.error("AssignmentController::publishGrade() - Error: " + err);
            return false;
        }

        let databaseSuccess: boolean = true;
        // if it was successful, and the grade is a valid one (non-null)
        if (gitSuccess && validGrade) {
            // record to the database that grade has been released
            gradeRecord.custom.assignmentGrade.released = true;
            databaseSuccess = await this.db.writeGrade(gradeRecord);
        }

        return gitSuccess && databaseSuccess;
    }

    /**
     * Publishes all grades for all deliverable Id
     * @param delivId - deliverableID to publish grades for
     */
    public async publishAllGrades(delivId: string): Promise<boolean> {
        Log.info("AssignmentController::publishAllGrades( " + delivId + " ) - start");
        // Log.info("AssignmentController::publishAllGrades( .. ) - ");
        // Log.error("AssignmentController::publishAllGrades( .. ) - ");

        // get deliverable
        const deliverableRecord: Deliverable = await this.db.getDeliverable(delivId);
        if (deliverableRecord === null) {
            Log.error("AssignmentController::publishAllGrades( .. ) - Error: Deliverable does not exist");
            return false;
        }
        // verify it is an assignment
        const assignmentInfo: AssignmentInfo = deliverableRecord.custom.assignment;
        if (assignmentInfo === undefined || assignmentInfo === null || typeof assignmentInfo.rubric === "undefined") {
            // this is not an assignment, currently does not support deliverable grade writing
            Log.error("AssignmentController::publishAllGrades(..) - Deliverable: " + delivId + " is not an assignment");
            return false;
        }

        // get all students
        const allPeople: Person[] = await this.pc.getAllPeople();
        const allStudents: Person[] = [];
        for (const person of allPeople) {
            if (person.kind === 'student') {
                allStudents.push(person);
            }
        }

        // verification
        const peopleList = await this.gha.listPeople();
        const personVerification: {[githubID: string]: any} = {};

        // create a map of personID to
        for (const person of peopleList) {
            if (typeof personVerification[person.githubId] === 'undefined') {
                personVerification[person.githubId] = person;
            }
        }

        // for every student, publish their grade
        let totalSuccess = true;
        Log.info("AssignmentController::publishAllGrades( .. ) - Publishing grades for " +
            allStudents.length + " students");
        for (const student of allStudents) {
            if (typeof personVerification[student.id] === 'undefined') {
                continue;
            }
            if (!await this.publishGrade(student.githubId + "_grades",
                delivId + "_grades.md", student.id, delivId)) {
                Log.warn("AssignmentController::publishAllGrades( .. ) - Had an issue " +
                    "publishing student: <" + student.id + "> grade");

                totalSuccess = false;
            }
        }

        if (totalSuccess) {
            Log.info("AssignmentController::publishAllGrades( .. ) - Published all grades");
        } else {
            Log.warn("AssignmentController::publishAllGrades( .. ) - Encountered an error while " +
                "publishing all grades");
        }

        return totalSuccess;
    }

    /**
     * Publishes all final grades for every student
     */
    public async publishAllFinalGrades(): Promise<boolean> {
        Log.info("AssignmentController::publishAllFinalGrades( .. ) - start");

        // get all students
        const allPeople: Person[] = await this.pc.getAllPeople();
        const allStudents: Person[] = [];
        for (const person of allPeople) {
            if (person.kind === 'student') {
                allStudents.push(person);
            }
        }

        // verification
        const peopleList = await this.gha.listPeople();
        const personVerification: {[githubID: string]: any} = {};

        // create a map of personID to
        for (const person of peopleList) {
            if (typeof personVerification[person.githubId] === 'undefined') {
                personVerification[person.githubId] = person;
            }
        }

        // for every student, publish their grade
        let totalSuccess = true;
        Log.info("AssignmentController::publishAllFinalGrades( .. ) - Publishing grades for " +
            allStudents.length + " students");
        const allPromises: Array<Promise<boolean>> = [];
        for (const student of allStudents) {
            if (typeof personVerification[student.id] === 'undefined') {
                continue;
            }
            allPromises.push(this.publishFinalGrade(student.githubId + "_grades",
                student.githubId + "_grades.md", student.id));
        }

        const result: boolean[] = await Promise.all(allPromises);
        for (let i = 0; i < result.length; i++) {
            if (!result[i]) {
                Log.warn("AssignmentController::publishAllFinalGrades(..) - Had an issue publishing the final " +
                    "grades for student: <" + allStudents[i].id + ">");
                totalSuccess = false;
            }
        }

        if (totalSuccess) {
            Log.info("AssignmentController::publishAllFinalGrades( .. ) - Published all grades");
        } else {
            Log.warn("AssignmentController::publishAllFinalGrades( .. ) - Encountered an error while " +
                "publishing all grades");
        }

        return totalSuccess;
    }

    /**
     * Verifies that a repository exists, if not, create it.
     * @param repositoryName - repository name to be verified or created
     * @returns Promise<Repository|null> - The repository object, or null if it fails.
     */
    public async verifyAndCreateRepo(repositoryName: string, deliv: Deliverable): Promise<Repository | null> {
        Log.info("AssignmentController::verifyAndCreateRepo( " + repositoryName + " ) - start");

        // check if the repository exists
        const repoExists = await this.gha.repoExists(repositoryName);
        let repositoryRecord: Repository = await this.rc.getRepository(repositoryName);

        if (!repoExists) {
            // Create the repo, it doesn't exist yet
            // first, need to check if a Repo object has been created
            if (repositoryRecord === null) {
                // If no repo object exists
                Log.info("AssignmentController::verifyAndCreateRepo(..) - No student Repo found, creating repo");
                // create the record
                repositoryRecord = await this.rc.createRepository(repositoryName, deliv, [], {});
                if (repositoryRecord === null) {
                    // we tried multiple times, unable to continue (something is wrong)
                    Log.error("AssignmentController::verifyAndCreateRepo(..) - Error; unable to " +
                        "create student grade repository.");
                    return null;
                }
            }
            try {
                // create the repo
                repositoryRecord.URL = await this.gha.createRepo(repositoryName);
                // write the repository to the database
                await this.db.writeRepository(repositoryRecord);
            } catch (err) {
                Log.error("AssignmentController::verifyAndCreateRepo(..) - Err: ");
                return repositoryRecord;
            }

        } else {
            // if the repo does exist
            if (repositoryRecord === null) {
                // but the record doesn't
                // create the record, and set the URL to the record properly
                repositoryRecord = await this.rc.createRepository(repositoryName, deliv, [], {});
                repositoryRecord.URL = await this.ghc.getRepositoryUrl(repositoryRecord);
                // write back to the database
                await this.db.writeRepository(repositoryRecord);
            }
        }
        return repositoryRecord;
    }

    /**
     * Generates the final grade of all student's assignments (not deliverables)
     * @param {string} studentGradeRepoName
     * @param {string} fileName
     * @param {string} studentId
     * @returns {Promise<boolean>}
     */
    public async publishFinalGrade(studentGradeRepoName: string, fileName: string, studentId: string): Promise<boolean> {
        Log.info("AssignmentController::publishFinalGrade( ... ,  " + studentId + ") - start");

        // get all the student's grades
        const allGrades: Grade[] = await this.gc.getAllGrades();
        const deliverables: Deliverable[] = await this.dc.getAllDeliverables();

        // TODO: Check if this has any unintended consequences
        const deliv = deliverables[0];
        const studentRepoRecord: Repository = await this.verifyAndCreateRepo(studentGradeRepoName, deliv);

        const studentGradeMapping: {[delivId: string]: Grade} = {};

        for (const grade of allGrades) {
            if (grade.personId === studentId) {
                studentGradeMapping[grade.delivId] = grade;
            }
        }

        const tableInfo: string[][] = [];
        const tableHeader: string[] = ["**Assessment**", "**Grade**", "**Assessment Weight**", "**Weighted Grade**"];

        tableInfo.push(tableHeader);

        let totalRaw: number = 0;
        let totalWeight: number = 0;
        let totalScore: number = 0;
        for (const delivRec of deliverables) {
            if (delivRec.custom.assignment === undefined || typeof delivRec.custom.assignment.courseWeight === "undefined") {
                Log.info("AssignmentController::publishFinalGrade(..) - deliv: " + delivRec.id + " is " +
                    "not an assignment, skipping...");
                continue;
            }

            // attempt to get the student's grade
            let newRow: string[];
            const weight = delivRec.custom.assignment.courseWeight;

            totalWeight += weight;

            if (typeof studentGradeMapping[delivRec.id] === "undefined" || studentGradeMapping[delivRec.id] === null) {
                // no grade
                newRow = [delivRec.id, "X", weight.toString(), "0"];
            } else {
                // double check this
                const assignmentRubric = delivRec.custom.assignment.rubric;
                const studentScore = Math.round(
                    (studentGradeMapping[delivRec.id].score / this.calculateMaxGrade(assignmentRubric)) * 100 * 10) / 10;
                const weightedScore = Math.round(studentScore * weight * 10) / 10;
                totalRaw += studentScore;
                totalScore += weightedScore;

                newRow = [delivRec.id, studentScore.toFixed(1),
                    weight.toFixed(1), weightedScore.toFixed(1)];
            }
            tableInfo.push(newRow);
        }

        const newRowRec: string[] = ["**COURSE GRADE**", totalRaw.toString(),
            totalWeight.toString(), totalScore.toString() + "%"];
        tableInfo.push(newRowRec);

        Log.info("AssignmentController::publishGrade(..) - generating tableInfo complete; " + tableInfo);

        // generate payload
        const table = require('markdown-table'); // use the markdown-table module

        let payload: string = "# " + "Final Grade";

        payload += "\n\n" + table(tableInfo);

        payload += "\n\n Note: The weighed average of the above grades may deviate by 1 percent from the " +
            "overall grade due to rounding. However the overall grade shown is the correct one.";

        // create the githubTeam and add the person to the team.
        const studentRecord = await this.pc.getPerson(studentId);
        const githubTeamInfo = await this.gha.createTeam(studentId + "_grades", "pull");
        await this.gha.addMembersToTeam(studentId + "_grades",
            githubTeamInfo.githubTeamNumber, [studentRecord.githubId]);
        const addResult = await this.gha.addTeamToRepo(githubTeamInfo.githubTeamNumber,
            studentGradeRepoName, "pull");

        let gitSuccess: boolean;
        try {
            Log.info("AssignmentController::publishFinalGrade( .. ) - writing grade");

            gitSuccess = await this.gha.writeFileToRepo(studentRepoRecord.URL,
                "final_grade.md", payload, true);
        } catch (err) {
            Log.error("AssignmentController::publishFinalGrade() - Error: " + err);
            return false;
        }

        return gitSuccess;
    }

    /**
     * Generates an empty Assignment grade, based on a rubric. The grade can be marked, or not.
     * @param assignmentRubric - the rubric to generate the grade from
     * @param marked - (false) determines if the grade generated is "marked" or not
     */
    private generateEmptyGrade(assignmentRubric: AssignmentGradingRubric, marked: boolean = false): AssignmentGrade {
        if (assignmentRubric === null) {
            Log.error("AssignmentController::generateEmptyGrade(..) - Error: Received null rubric");
            return null;
        }
        Log.info("AssignmentController::generateEmptyGrade( " + assignmentRubric.name + " ) - start");

        const questions: QuestionGrade[] = [];
        for (const rubricQuestion of assignmentRubric.questions) {
            // make a new record
            const subQuestions: SubQuestionGrade[] = [];
            for (const rubricSubQuestion of rubricQuestion.subQuestions) {
                const newSubQuestion: SubQuestionGrade = {
                    sectionName: rubricSubQuestion.name,
                    grade:       0,
                    graded:      marked,
                    feedback:    ""
                };

                subQuestions.push(newSubQuestion);
            }

            const newQuestion: QuestionGrade = {
                questionName: rubricQuestion.name,
                commentName:  rubricQuestion.comment,
                subQuestion:  subQuestions
            };

            questions.push(newQuestion);
        }

        const newAssignmentGrade: AssignmentGrade = {
            assignmentID: assignmentRubric.name,
            studentID:    "---N/A---",
            released:     false,
            questions:    questions
        };

        return newAssignmentGrade;
    }

    /**
     * Calculates the maximum grade
     * @param assignmentRubric
     */
    public calculateMaxGrade(assignmentRubric: AssignmentGradingRubric): number {
        if (assignmentRubric === null || typeof assignmentRubric.questions === "undefined") {
            throw new Error("Unable to calculate max grade of a non-assignment");
        }

        let maxGrade: number = 0;
        for (const question of assignmentRubric.questions) {
            for (const subQuestion of question.subQuestions) {
                maxGrade += subQuestion.outOf * subQuestion.weight;
            }
        }
        return maxGrade;
    }

    /**
     * Handler for checking deliverables to tasks
     * @param {string?} assignId [optional] - the assignment ID to verify,
     * @returns {Promise<number>}
     */
    public async verifyScheduledJobs(assignId?: string): Promise<number> {
        Log.info("CS340AdminView::verifyScheduledJobs( " + assignId + " ) - start");
        let count = 0;

        // if assignId is not specified
        if (!assignId) {
            // check all deliverables
            Log.info("CS340AdminView::verifyScheduledJobs(..) - no assignment ID given, checking all of them");
            const result: Deliverable[] = await this.db.getDeliverables();
            for (const deliv of result) {
                if (await this.sc.createAssignmentTasks(deliv.id)) {
                    Log.info("AssignmentController::verifyScheduledJobs(..) - created tasks for " + deliv.id);
                    count++;
                }
            }
        } else {
            const deliv = await this.db.getDeliverable(assignId);
            if (deliv === null) {
                Log.error("CS340AdminView::verifyScheduledJobs(..) - no deliverable with such ID: " + assignId);
                return -1;
            }
            if (await this.sc.createAssignmentTasks(deliv.id)) {
                Log.info("AssignmentController::verifyScheduledJobs(..) - created tasks for " + deliv.id);
                count++;
            }
        }

        return count;
    }

}
