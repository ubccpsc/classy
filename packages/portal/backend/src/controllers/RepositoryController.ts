import Log from "../../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {Person, Repository, Team} from "../Types";
import {TeamController} from "./TeamController";

export class RepositoryController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllRepos(): Promise<Repository[]> {
        Log.info("RepositoryController::getAllRepos() - start");

        const repos = await this.db.getRepositories();
        return repos;
    }

    public async getRepository(name: string): Promise<Repository | null> {
        Log.info("RepositoryController::getRepository( " + name + " ) - start");

        const repo = await this.db.getRepository(name);
        return repo;
    }

    public async getReposForPerson(myPerson: Person): Promise<Repository[]> {
        Log.info("RepositoryController::getReposForPerson( " + myPerson.id + " ) - start");

        // TODO: this is slow; there is a faster implementation in db.getReposForPerson now, but it is untested
        // db.getRepositoriesForPerson(myPerson.id)

        const myTeams = await new TeamController().getTeamsForPerson(myPerson);

        const myRepos: Repository[] = [];
        const allRepos = await this.db.getRepositories();
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


    public async createRepository(name: string, teams: Team[], custom: any): Promise<Repository | null> {
        Log.info("RepositoryController::createRepository( " + name + ",.. ) - start");

        const existingRepo = await this.getRepository(name);
        if (existingRepo === null) {
            const teamIds: string[] = teams.map(team => team.id);

            const repo: Repository = {
                id:      name,
                URL:     null,
                teamIds: teamIds,
                custom:  custom
            };

            await this.db.writeRepository(repo);
            return await this.db.getRepository(repo.id);
        } else {
            Log.info("RepositoryController::createRepository( " + name + ",.. ) - repository exists: " + JSON.stringify(existingRepo));
            return await this.db.getRepository(name);
        }
    }

    public async createPullRequest(repoId: string, prId: string, custom: any): Promise<Repository | null> {
        Log.error("RepositoryController::createPullRequest( " + repoId + ", " + prId + ", ... ) -  NOT IMPLEMENTED!!");
        // TODO: implement PR functionality

        // NOTE: this impl is more complex than it needs to be but is erring on the side of caution
        let repo = await this.getRepository(repoId);
        let customA = Object.assign({}, repo.custom);
        let customB = Object.assign(customA, custom); // overwrite with new fields
        repo.custom = customB;
        await this.db.writeRepository(repo);
        return await this.getRepository(repoId);
    }

    public async getPeopleForRepo(repoId: string): Promise<string[] | null> {
        Log.info("RepositoryController::getPeopleForRepo( " + repoId + ",.. ) -  start");

        const peopleIds: string[] = [];
        const tc = new TeamController();
        const repo = await this.getRepository(repoId);
        if (repo !== null) {
            for (const teamId of repo.teamIds) {
                let team = await tc.getTeam(teamId);
                for (const personId of team.personIds) {
                    if (peopleIds.indexOf(personId) < 0) {
                        peopleIds.push(personId);
                    }
                }
            }
        }
        return peopleIds;
    }
}
