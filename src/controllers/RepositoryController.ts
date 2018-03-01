import Log from "../util/Log";
import {DatabaseController} from "./DatabaseController";
import {Person, Repository, Team} from "../Types";
import {TeamController} from "./TeamController";

export class RepositoryController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllRepos(orgName: string): Promise<Repository[]> {
        Log.info("RepositoryController::getAllRepos( " + orgName + " ) - start");

        let repos = await this.db.getRepositories(orgName);
        return repos;
    }

    public async getRepository(org: string, name: string): Promise<Repository | null> {
        Log.info("RepositoryController::getRepository( " + org + ", " + name + " ) - start");

        let repo = await this.db.getRepository(org, name);
        return repo;
    }

    public async getReposForPerson(myPerson: Person): Promise<Repository[]> {
        Log.info("RepositoryController::getReposForPerson( " + myPerson.id + " ) - start");

        let myTeams = await new TeamController().getTeamsForPerson(myPerson);

        let myRepos: Repository[] = [];
        let allRepos = await this.db.getRepositories(myPerson.org);
        for (const repo of allRepos) {
            for (const team of myTeams) {
                if (repo.teamIds.indexOf(team.id) >= 0) {
                    myRepos.push(repo);
                }
            }
        }

        Log.info("RepositoryController::getReposForPerson( " + myPerson.id + " ) - done; # found: " + myRepos.length);
        return myRepos;
    }

    public async createRepository(org: string, name: string, teams: Team[]): Promise<boolean> {
        Log.info("RepositoryController::createRepository( " + org + ", " + name + ",.. ) - start");
        try {
            let existingRepo = await this.getRepository(org, name);
            if (existingRepo === null) {
                let teamIds: string[] = teams.map(team => team.id);
                const repo: Repository = {
                    id:      name,
                    org:     org,
                    url:     null,
                    teamIds: teamIds,
                    custom:  {}
                };
                if (org === 'secapstone' || org === 'secapstonetest') {
                    repo.custom.sddmD3pr = false;
                }
                await this.db.writeRepository(repo);
                return true;
            } else {
                Log.info("RepositoryController::createRepository( " + org + ", " + name + ",.. ) - repository exists: " + JSON.stringify(existingRepo));
                return false;
            }
        } catch (err) {
            Log.error("RepositoryController::createRepository(..) - ERROR: " + err);
            return false
        }
    }
}