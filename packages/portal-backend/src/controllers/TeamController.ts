import Log from "../../../common/Log";
import {DatabaseController} from "./DatabaseController";
import {Person, Team} from "../Types";

export class TeamController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllTeams(): Promise<Team[]> {
        Log.info("TeamController::getAllTeams() - start");

        let teams = await this.db.getTeams();
        return teams;
    }

    public async getTeam(name: string): Promise<Team | null> {
        Log.info("TeamController::getAllTeams( " + name + " ) - start");

        let team = await this.db.getTeam(name);
        return team;
    }

    public async getTeamsForPerson(myPerson: Person): Promise<Team[]> {
        Log.info("TeamController::getTeamsForPerson( " + myPerson.id + " ) - start");

        let myTeams: Team[] = [];
        let allTeams = await this.db.getTeams();
        for (const team of allTeams) {
            if (team.personIds.indexOf(myPerson.id) >= 0) {
                myTeams.push(team);
            }
        }

        Log.info("TeamController::getTeamsForPerson( " + myPerson.id + " ) - done; # teams: " + myTeams.length);
        return myTeams;
    }

    public async createTeam(name: string, people: Person[], custom: any): Promise<Team | null> {
        Log.info("TeamController::createTeam( " + name + ",.. ) - start");
        try {
            let existingTeam = await this.getTeam(name);
            if (existingTeam === null) {
                let peopleIds: string[] = people.map(person => person.id);
                const team: Team = {
                    id:        name,
                    url:       null,
                    personIds: peopleIds,
                    custom:    custom
                };
                await this.db.writeTeam(team);
                return await this.db.getTeam(name);
            } else {
                Log.info("TeamController::createTeam( " + name + ",.. ) - team exists: " + JSON.stringify(existingTeam));
                return await this.db.getTeam(name);
            }
        } catch (err) {
            Log.error("TeamController::createTeam(..) - ERROR: " + err);
            return null;
        }
    }

}
