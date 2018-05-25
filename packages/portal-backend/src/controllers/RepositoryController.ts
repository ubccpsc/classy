import Log from "../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {Person, Repository, Team} from "../Types";
import {TeamController} from "./TeamController";

export class RepositoryController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllRepos(): Promise<Repository[]> {
        Log.info("RepositoryController::getAllRepos() - start");

        let repos = await this.db.getRepositories();
        return repos;
    }

    public async getRepository(name: string): Promise<Repository | null> {
        Log.info("RepositoryController::getRepository( " + name + " ) - start");

        let repo = await this.db.getRepository(name);
        return repo;
    }

    public async getReposForPerson(myPerson: Person): Promise<Repository[]> {
        Log.info("RepositoryController::getReposForPerson( " + myPerson.id + " ) - start");

        // NOTE: this is slow; there is a faster implementation in db.getReposForPerson now, but it is untested

        let myTeams = await new TeamController().getTeamsForPerson(myPerson);

        let myRepos: Repository[] = [];
        let allRepos = await this.db.getRepositories();
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
        try {
            let existingRepo = await this.getRepository(name);
            if (existingRepo === null) {
                let teamIds: string[] = teams.map(team => team.id);

                const repo: Repository = {
                    id:      name,
                    URL:     null,
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
                return await this.db.getRepository(repo.id);
            } else {
                Log.info("RepositoryController::createRepository( " + name + ",.. ) - repository exists: " + JSON.stringify(existingRepo));
                return await this.db.getRepository(name);
            }
        }
        catch (err) {
            Log.error("RepositoryController::createRepository(..) - ERROR: " + err);
            return null;
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
        return await this.getRepository( repoId);
    }

    public async getPeopleForRepo( repoId: string): Promise<string[] | null> {
        Log.info("RepositoryController::getPeopleForRepo( " + repoId + ",.. ) -  start");

        let peopleIds: string[] = [];
        try {
            let tc = new TeamController();
            let repo = await this.getRepository(repoId);
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
        } catch (err) {
            Log.error("RepositoryController::getPeopleForRepo(..) - ERROR: " + err);
        }
        return peopleIds;
    }
}
