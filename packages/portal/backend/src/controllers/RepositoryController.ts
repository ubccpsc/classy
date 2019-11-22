import Log from "../../../../common/Log";
import {RepositoryTransport} from "../../../../common/types/PortalTypes";
import Util from "../../../../common/Util";
import {Deliverable, Person, Repository, Team} from "../Types";

import {DatabaseController} from "./DatabaseController";
import {DeliverablesController} from "./DeliverablesController";
import {TeamController} from "./TeamController";

export class RepositoryController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllRepos(): Promise<Repository[]> {
        Log.info("RepositoryController::getAllRepos() - start");
        const start = Date.now();

        const repos = await this.db.getRepositories();

        Log.info("RepositoryController::getAllRepos() - done; # repos: " + repos.length + "; took: " + Util.took(start));
        return repos;
    }

    public async getRepository(name: string): Promise<Repository | null> {
        Log.info("RepositoryController::getRepository( " + name + " ) - start");
        const start = Date.now();

        const repo = await this.db.getRepository(name);

        Log.info("RepositoryController::getRepository( " + name + " ) - done; took: " + Util.took(start));
        return repo;
    }

    public async getReposForPerson(myPerson: Person): Promise<Repository[]> {
        Log.info("RepositoryController::getReposForPerson( " + myPerson.id + " ) - start");
        const start = Date.now();

        // TODO: this is slow; there is a faster implementation in db.getReposForPerson now, but it is untested
        // db.getRepositoriesForPerson(myPerson.id)

        const myTeams = await new TeamController().getTeamsForPerson(myPerson);
        Log.info("RepositoryController::getReposForPerson( " + myPerson.id + " ) - # teams: " + myTeams.length);

        const myRepos: Repository[] = [];
        const allRepos = await this.db.getRepositories();
        for (const repo of allRepos) {
            for (const team of myTeams) {
                if (repo.teamIds.indexOf(team.id) >= 0) {
                    myRepos.push(repo);
                }
            }
        }

        Log.info("RepositoryController::getReposForPerson( " + myPerson.id +
            " ) - done; # found: " + myRepos.length + "; took: " + Util.took(start));
        return myRepos;
    }

    /**
     * Updates an existing repository record.
     *
     * @param {Repository} repo
     * @returns {Promise<Repository>}
     */
    public async updateRepository(repo: Repository): Promise<Repository> {
        Log.info("RepositoryController::updateRepository( .. ) - start");
        if (typeof repo === 'undefined' || repo === null) {
            return null;
        }

        const existingRepo = await this.getRepository(repo.id);
        if (existingRepo === null) {
            // repo not in db, create new one
            const teams: Team[] = [];
            const tc = new TeamController();
            for (const tid of repo.teamIds) {
                const team = await tc.getTeam(tid);
                teams.push(team);
            }
            const dc = new DeliverablesController();
            const deliv = await dc.getDeliverable(repo.delivId);
            await this.createRepository(repo.id, deliv, teams, repo.custom);
        } else {
            // overwrie existing repo
            const customExisting = Object.assign({}, existingRepo.custom); // overwrite with new fields
            const customCombined = Object.assign(customExisting, existingRepo.custom);
            repo.custom = customCombined;
            await this.db.writeRepository(repo);
        }
        return await this.db.getRepository(repo.id);
    }

    public async createRepository(name: string, deliv: Deliverable, teams: Team[], custom: any): Promise<Repository | null> {
        Log.info("RepositoryController::createRepository( " + name + ", .. ) - start");

        const existingRepo = await this.getRepository(name);
        if (existingRepo === null) {
            const teamIds: string[] = teams.map((team) => team.id);

            if (custom === null) {
                custom = {}; // custom must not be null
            }

            const repo: Repository = {
                id:       name,
                delivId:  deliv.id,
                URL:      null,
                cloneURL: null,
                teamIds:  teamIds,
                custom:   custom
            };

            await this.db.writeRepository(repo);
            return await this.db.getRepository(repo.id);
        } else {
            Log.info("RepositoryController::createRepository( " + name + ", .. ) - repository exists: " + JSON.stringify(existingRepo));
            return await this.db.getRepository(name);
        }
    }

    // public async createPullRequest(repoId: string, prId: string, custom: any): Promise<Repository | null> {
    //     Log.error("RepositoryController::createPullRequest( " + repoId + ", " + prId + ", .. ) -  NOT IMPLEMENTED!!");
    //     // TODO: implement PR functionality
    //
    //     // NOTE: this impl is more complex than it needs to be but is erring on the side of caution
    //     const repo = await this.getRepository(repoId);
    //     const customA = Object.assign({}, repo.custom);
    //     const customB = Object.assign(customA, custom); // overwrite with new fields
    //     repo.custom = customB;
    //     await this.db.writeRepository(repo);
    //     return await this.getRepository(repoId);
    // }

    public async getPeopleForRepo(repoId: string): Promise<string[] | null> {
        Log.info("RepositoryController::getPeopleForRepo( " + repoId + ", .. ) -  start");
        const start = Date.now();

        const peopleIds: string[] = [];
        const tc = new TeamController();
        const repo = await this.getRepository(repoId);
        if (repo !== null) {
            for (const teamId of repo.teamIds) {
                const team = await tc.getTeam(teamId);
                for (const personId of team.personIds) {
                    if (peopleIds.indexOf(personId) < 0) {
                        peopleIds.push(personId);
                    }
                }
            }
        }

        Log.info("RepositoryController::getPeopleForRepo( " + repoId + ", .. ) -  done; # people: " +
            peopleIds.length + "; took: " + Util.took(start));
        return peopleIds;
    }

    public static repositoryToTransport(repository: Repository): RepositoryTransport {
        if (typeof repository === 'undefined' || repository === null) {
            throw new Error("RepositoryController::repositoryToTransport( .. ) - ERROR: repository not provided.");
        }

        const repo: RepositoryTransport = {
            id:      repository.id,
            URL:     repository.URL,
            delivId: repository.delivId
        };

        return repo;
    }
}
