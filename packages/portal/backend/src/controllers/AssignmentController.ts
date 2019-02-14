import Log from "../../../../common/Log";
import {AssignmentGrade} from "../../../../common/types/CS340Types";
import {GradePayload} from "../../../../common/types/SDMMTypes";
import {Deliverable, Grade, Repository, Team} from "../Types";
import {DatabaseController} from "./DatabaseController";
import {GitHubActions, IGitHubActions} from "./GitHubActions";
import {GradesController} from "./GradesController";
import {RepositoryController} from "./RepositoryController";
import {RubricController} from "./RubricController";
import {AdminController} from "./AdminController";
import {RepositoryTransport} from "../../../../common/types/PortalTypes";
import {GitHubController, IGitHubController} from "./GitHubController";

export class AssignmentController {

    private db: DatabaseController = DatabaseController.getInstance();
    private rc: RepositoryController = new RepositoryController();
    private rubricController: RubricController = new RubricController();
    private gha: IGitHubActions = GitHubActions.getInstance();
    private ghc: IGitHubController = new GitHubController(this.gha);
    private gc: GradesController = new GradesController();
    private cc: AdminController = new AdminController(this.ghc);

    public async createAllRepositories(delivId: string): Promise<boolean> {
        Log.info(`AssignmentController::createAllRepositories(${delivId}) - start`);

        const deliverableRecord: Deliverable = await this.db.getDeliverable(delivId);

        if (deliverableRecord === null) {
            Log.error(`AssignmentController::createAllRepositories(..) - Error: Unable to find deliverable`);
            return false;
        }
        const provisionDetails: RepositoryTransport[] = await this.cc.planProvision(deliverableRecord, false);

        const repoRecordPromises: Array<Promise<Repository>> = [];

        for (const provisionDetail of provisionDetails) {
            repoRecordPromises.push(this.db.getRepository(provisionDetail.id));
        }

        const repoRecords: Repository[] = await Promise.all(repoRecordPromises);

        let importURL: string = deliverableRecord.importURL;

        // if (deliverableRecord.custom !== null && deliverableRecord.custom.assignment !== null) {
        //     if (deliverableRecord.custom.assignment.seedRepoPath !== null) {
        //         importURL += deliverableRecord.custom.assignment.seedRepoPath;
        //     }
        // }

        await this.cc.performProvision(repoRecords, importURL);

        return true;
    }

    public async releaseAllRepositories(delivId: string): Promise<boolean> {
        Log.info(`AssignmentController::releaseAllRepositories(${delivId}) - start`);

        // doubling down; releasing any repositories that are missed

        await this.createAllRepositories(delivId);

        const deliverableRecord: Deliverable = await this.db.getDeliverable(delivId);

        if (deliverableRecord === null) {
            Log.error(`AssignmentController::releaseAllRepositories(..) - Error: Unable to find deliverable`);
            return false;
        }

        const releaseDetails: Repository[] = await this.cc.planRelease(deliverableRecord);

        const repoRecordPromises: Array<Promise<Repository>> = [];

        for (const releaseDetail of releaseDetails) {
            repoRecordPromises.push(this.db.getRepository(releaseDetail.id));
        }

        const repoRecords: Repository[] = await Promise.all(repoRecordPromises);

        Log.info(`AssignmentController::releaseAllRepositories(..) - Repos to release: ${JSON.stringify(repoRecords)}`);

        await this.cc.performRelease(repoRecords);

        return true;
    }

    public async closeAllRepositories(delivId: string): Promise<boolean> {
        Log.info(`AssignmentController::closeAllRepositories(${delivId}) - start`);

        // remove push access to all users
        const teamsPromise = this.db.getTeams();
        const reposPromise = this.db.getRepositories();

        const [teamsResult, reposResult] = await Promise.all([teamsPromise, reposPromise]);
        const teams = teamsResult as Team[];
        const repos = reposResult as Repository[];

        // build team mapping
        const teamMap: Map<string, Team> = new Map();
        for (const team of teams) {
            teamMap.set(team.id, team);
        }

        const filteredRepos = repos.filter((repo) => {
            return repo.delivId === delivId;
        });

        Log.info(`AssignmentController::closeAllRepositories(..) - Closing ${filteredRepos.length} repos`);

        const closeRepoPromiseArray: Array<Promise<boolean>> = [];
        for (const repo of filteredRepos) {
            closeRepoPromiseArray.push(this.closeAssignmentRepository(repo.id));
        }

        const closeRepoResultArray: boolean[] = await Promise.all(closeRepoPromiseArray);

        let closeSuccess: boolean = true;

        for (const bool of closeRepoResultArray) {
            closeSuccess = closeSuccess && bool;
        }

        // check that deliverable is an assignment

        const rubricUpdate = await this.rubricController.updateRubric(delivId);

        return closeSuccess && rubricUpdate;
    }

    public async closeAssignmentRepository(repoId: string): Promise<boolean> {
        Log.info(`AssignmentController::closeAssignmentRepository(${repoId}) - start`);

        const success = await this.gha.setRepoPermission(repoId, "pull");
        if (!success) {
            Log.error(`AssignmentController::closeAssignmentRepository(..) - Error: unable to close repo: ${repoId}`);
        }

        return success;
    }

    /**
     *
     * @param repoID
     * @param assignId
     * @param assnPayload
     * @param markerId
     */
    public async setAssignmentGrade(repoID: string,
                                    assignId: string,
                                    assnPayload: AssignmentGrade,
                                    markerId: string = ""): Promise<boolean> {
        Log.info(`AssignmentController::setAssignmentGrade(${repoID}, ${assignId}, ..) - start`);
        Log.trace(`AssignmentController::setAssignmentGrade(..) - payload: ${JSON.stringify(assnPayload)}`);

        let totalGrade = 0;
        for (const aQuestion of assnPayload.questions) {
            for (const aSubQuestion of aQuestion.subQuestions) {
                totalGrade += aSubQuestion.grade;
            }
        }

        // Check if repo exists
        const repo: Repository = await this.rc.getRepository(repoID);
        if (repo === null) {
            Log.error(`AssignmentController::setAssignmentGrade(..) - Error: Unable to find repo: ${repoID}`);
            return false;
        }

        Log.trace(`AssignmentController::setAssignmentGrade(..) - Marked by: ${markerId}`);

        const newGradePayload: GradePayload = {
            score:     totalGrade,
            comment:   markerId !== "" ? 'Marked by ' + markerId : 'Marked assignment',
            urlName:   repo.id,
            URL:       repo.URL,
            timestamp: Date.now(),
            custom:    {assignmentGrade: assnPayload}
        };

        const success = await this.gc.createGrade(repo.id, assignId, newGradePayload);

        // TODO: Perhaps add stuff about releasing grades?

        return success;
    }
}
