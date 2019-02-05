import Log from "../../../../common/Log";
import {Repository, Team} from "../Types";
import {DatabaseController} from "./DatabaseController";
import {GitHubActions, IGitHubActions} from "./GitHubActions";
import {RubricController} from "./RubricController";

export class AssignmentController {

    private db: DatabaseController = DatabaseController.getInstance();
    private rubricController: RubricController = new RubricController();
    private gha: IGitHubActions = GitHubActions.getInstance();

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
}
