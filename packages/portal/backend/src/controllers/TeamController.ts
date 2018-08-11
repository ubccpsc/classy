import Log from "../../../../common/Log";

import {TeamTransport} from "../../../../common/types/PortalTypes";
import {Deliverable, Person, Team} from "../Types";

import {DatabaseController} from "./DatabaseController";
import {DeliverablesController} from "./DeliverablesController";
import {PersonController} from "./PersonController";

export class TeamController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllTeams(): Promise<Team[]> {
        Log.info("TeamController::getAllTeams() - start");

        const teams = await this.db.getTeams();
        return teams;
    }

    public async getTeam(name: string): Promise<Team | null> {
        Log.info("TeamController::getAllTeams( " + name + " ) - start");

        const team = await this.db.getTeam(name);
        return team;
    }

    public async getTeamsForPerson(myPerson: Person): Promise<Team[]> {
        Log.info("TeamController::getTeamsForPerson( " + myPerson.id + " ) - start");

        let myTeams: Team[] = [];
        const allTeams = await this.db.getTeams();
        for (const team of allTeams) {
            if (team.personIds.indexOf(myPerson.id) >= 0) {
                myTeams.push(team);
            }
        }

        // sort by delivIds
        myTeams = myTeams.sort(function(a: Team, b: Team) {
            return a.delivId.localeCompare(b.delivId);
        });

        Log.info("TeamController::getTeamsForPerson( " + myPerson.id + " ) - done; # teams: " + myTeams.length);
        return myTeams;
    }

    /*
     * @param {string} delivId
     * @param {string[]} gitHubIds
     * @returns {Promise<Team | null>}
     */
    public async formTeam(delivId: string, gitHubIds: string[], adminOverride: boolean): Promise<Team | null> {
        Log.info("TeamController::formTeam( ... ) - start");

        const dc = new DeliverablesController();
        const pc = new PersonController();

        const deliv = await dc.getDeliverable(delivId);

        // sanity checking
        if (deliv === null) {
            throw new Error("Team not created; deliverable does not exist.");
        }
        if (deliv.teamStudentsForm === false || adminOverride) {
            throw new Error("Team not created; students cannot form their own teams for this deliverable.");
        }
        if (gitHubIds.length > deliv.teamMaxSize || adminOverride) {
            throw new Error("Team not created; too many team members specified for this deliverable.");
        }
        if (gitHubIds.length < deliv.teamMinSize || adminOverride) {
            throw new Error("Team not created; too few team members specified for this deliverable.");
        }

        const teams = await this.getAllTeams();
        const teamName: string = deliv.teamPrefix + teams.length;
        const people: Person[] = [];

        for (const ghId of gitHubIds) {
            const person = await pc.getGitHubPerson(ghId);
            if (person === null) {
                throw new Error("Team not created; GitHub id not associated with student registered in course: " + ghId);
            } else {
                people.push(person);
            }
        }

        // ensure members are all in the same lab section (if required)
        if (deliv.teamSameLab === true) {
            let labName = null;
            for (const p of people) {
                if (labName === null) {
                    labName = p.labId;
                }
                if (labName !== p.labId) {
                    Log.error("TeamController::formTeam( ... ) - members not all in same lab ( " + labName + ", " + p.labId + " )");
                    throw new Error("Team not created; all members are not in the same lab.");
                }
            }
        }

        // ensure members are not already on a team for that deliverable
        for (const p of people) {
            const teamsForPerson = await this.getTeamsForPerson(p);
            for (const personTeam of teamsForPerson) {
                if (personTeam.delivId === delivId) {
                    Log.error("TeamController::formTeam( ... ) - member already on team: " +
                        personTeam.id + " for deliverable: " + delivId);
                    throw new Error("Team not created; some members are already on existing teams for this deliverable.");
                }
            }
        }

        const team = await this.createTeam(teamName, deliv, people, {});
        return team;
    }

    public async createTeam(name: string, deliv: Deliverable, people: Person[], custom: any): Promise<Team | null> {
        Log.info("TeamController::createTeam( " + name + ",.. ) - start");

        if (deliv === null) {
            throw new Error("TeamController::createTeam() - null deliverable provided.");
        }

        const existingTeam = await this.getTeam(name);
        if (existingTeam === null) {
            const peopleIds: string[] = people.map((person) => person.id);
            const team: Team = {
                id:        name,
                delivId:   deliv.id,
                URL:       null,
                personIds: peopleIds,
                custom:    custom
            };
            await this.db.writeTeam(team);
            return await this.db.getTeam(name);
        } else {
            // Log.info("TeamController::createTeam( " + name + ",.. ) - team exists: " + JSON.stringify(existingTeam));
            // return await this.db.getTeam(name);
            throw new Error("Duplicate team name");
        }
    }

    public teamToTransport(team: Team): TeamTransport {
        const t: TeamTransport = {
            id:      team.id,
            delivId: team.delivId,
            people:  team.personIds,
            URL:     team.URL
        };

        return t;
    }

}
