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

        // NOTE: this is slow; there is a faster implementation in db.getReposForPerson now, but it is untested

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


    public async createRepository(org: string, name: string, teams: Team[], custom: any): Promise<Repository | null> {
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
                    custom:  custom
                };

                /**
                 This can't be here, but don't forget it
                 if (org === 'secapstone' || org === 'secapstonetest') {
                    repo.custom.sddmD3pr = false;

                    repo.custom.d0enabled = false;
                    repo.custom.d1enabled = false;
                    repo.custom.d2enabled = false;
                    repo.custom.d3enabled = false;
                }
                 */

                await this.db.writeRepository(repo);
                return await this.db.getRepository(repo.org, repo.id);
            } else {
                Log.info("RepositoryController::createRepository( " + org + ", " + name + ",.. ) - repository exists: " + JSON.stringify(existingRepo));
                return await this.db.getRepository(org, name);
            }
        }
        catch (err) {
            Log.error("RepositoryController::createRepository(..) - ERROR: " + err);
            return null;
        }
    }
}