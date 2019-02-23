import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {AssignmentGrade} from "../../../../common/types/CS340Types";
import {RepositoryTransport} from "../../../../common/types/PortalTypes";
import {GradePayload} from "../../../../common/types/SDMMTypes";
import Util from "../../../../common/Util";
import {Deliverable, Person, Repository, Team} from "../Types";
import {AdminController} from "./AdminController";
import {DatabaseController} from "./DatabaseController";
import {GitHubActions, IGitHubActions} from "./GitHubActions";
import {GitHubController} from "./GitHubController";
import {GradesController} from "./GradesController";
import {RepositoryController} from "./RepositoryController";
import {RubricController} from "./RubricController";
import {ScheduleController} from "./ScheduleController";

export class AssignmentController {

    private db: DatabaseController = DatabaseController.getInstance();
    private rc: RepositoryController = new RepositoryController();
    private rubricController: RubricController = new RubricController();
    private gha: IGitHubActions = GitHubActions.getInstance();
    private ghc: GitHubController = new GitHubController(this.gha);
    private gc: GradesController = new GradesController();
    private cc: AdminController = new AdminController(this.ghc);

    public static COLLABORATOR_FLAG: boolean = true;

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

        await this.provisionRepos(repoRecords, deliverableRecord);

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

        await this.cc.performRelease(repoRecords, AssignmentController.COLLABORATOR_FLAG);

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
            return repo.delivId === delivId && repo.URL !== null;
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

        const repo: Repository = await this.db.getRepository(repoId);

        if (repo === null || repo.URL === null) {
            Log.warn(`AssignmentController::closeAssignmentRepository(..) - Unable to close a repo that doesn't exist!`);
            return true;
        }

        const success = await this.gha.setRepoPermission(repoId, "pull");

        let collabSuccess = true;

        // find collaborators and change their permissions, if we are using collaborators
        if (AssignmentController.COLLABORATOR_FLAG === true) {
            const collaborators: Array<{id: string, permission: string}> = await this.gha.listCollaborators(repoId);

            const collaboratorIds: string[] = collaborators.filter((x) => x.permission !== "admin")
                .map((x) => x.id);

            collabSuccess = await this.gha.addCollaborators(repoId, collaboratorIds, "pull");
        }

        if (!success || !collabSuccess) {
            Log.error(`AssignmentController::closeAssignmentRepository(..) - Error: unable to close repo: ${repoId};` +
                `closed teams: ${success} collaborators: ${collabSuccess}`);
        }

        return success && collabSuccess;
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

    public async provisionRepos(repos: Repository[], deliverable: Deliverable): Promise<RepositoryTransport[]> {
        const config = Config.getInstance();

        Log.info(`AssignmentController::provisionRepos(..) - start; ` +
            `# repos: ${repos.length}; deliverable: ${deliverable.id}`);
        const provisionedRepos: Repository[] = [];

        if (deliverable === null) {
            Log.error(`AssignmentController:provisionRepos(..) - Error: Unable to provision repositories ` +
                `due to invalid deliverable.`);
            return provisionedRepos;
        }

        let importPath: string = "";
        const importURL: string = deliverable.importURL;
        if (typeof deliverable.custom !== "undefined" && typeof deliverable.custom.assignment !== "undefined") {
            importPath = deliverable.custom.assignment.seedRepoPath.trim();
            Log.info(`AssignmentController::provisionRepos(..) - Deliverable ${deliverable.id} is an assignment; ` +
                `Seed path: ${importPath}`);
        } else {
            Log.info(`AssignmentController::provisionRepos(..) - Deliverable is not an assignment; using ` +
                `default behaviour`);
        }

        for (const repo of repos) {
            try {
                const start = Date.now();
                Log.info(`AssignmentController::provisionRepos(..) ***** START *****; repo: ${repo.id}`);
                if (repo.URL === null) {
                    const teams: Team[] = [];
                    for (const teamId of repo.teamIds) {
                        teams.push(await this.db.getTeam(teamId));
                    }
                    Log.info(`AssignmentController::performProvision(..) - about to provision: ${repo.id}`);

                    let success: boolean;
                    if (importPath !== "") {
                        success = await this.ghc.createRepositoryWithPath(repo.id, teams, importURL, importPath);
                    } else {
                        success = await this.ghc.provisionRepository(repo.id, teams, importURL);
                    }
                    Log.info(`AssignmentController::performProvision(..) - provisioned: ${repo.id}; success: ${success}`);

                    if (success === true) {
                        repo.URL = config.getProp(ConfigKey.githubHost) + "/" + config.getProp(ConfigKey.org) + "/" + repo.id;
                        repo.custom.githubCreated = true;
                        await this.db.writeRepository(repo);
                        Log.info(`AssignmentController::performProvision(..) - success: ${repo.id}; URL: ${repo.URL}`);
                        provisionedRepos.push(repo);
                    } else {
                        Log.warn(`AssignmentController::performProvision(..) - provision FAILED: ${repo.id}; URL: ${repo.URL}`);
                    }

                    Log.info(`AssignmentController::performProvision(..) - done provisioning: ${repo.id}; forced wait`);
                    await Util.delay(2 * 1000); // after any provisioning wait a bit
                    // Log.info("AdminController::performProvision(..) - done for repo: " + repo.id + "; wait complete");
                    Log.info(`AssignmentController::performProvision(..) ***** DONE *****; repo: ${repo.id}; ` +
                        ` took: ${Util.took(start)}`);
                } else {
                    Log.info(`AssignmentController::performProvision(..) - skipped; already provisioned: ${repo.id};` +
                        ` URL: ${repo.URL}`);
                }
            } catch (error) {
                Log.error(`AssignmentController::performProvision(..) - FAILED: ${repo.id}; Deliv: ${deliverable.id}; ` +
                `ERROR: ${error.message}`);
            }
        }

        const provisionedRepositoryTransport: RepositoryTransport[] = [];
        for (const repo of provisionedRepos) {
            provisionedRepositoryTransport.push(RepositoryController.repositoryToTransport(repo));
        }
        return provisionedRepositoryTransport;
    }
}
