import Log from "../../../../common/Log";

import {TeamTransport} from "../../../../common/types/PortalTypes";
import {Deliverable, Person, Team} from "../Types";

import {DatabaseController} from "./DatabaseController";

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

    /**
     * Convenience method for creating team objects when only primitive types are known. This is
     * especially useful for students specifying their own teams as it checks to ensure that team
     * constraints (specified in the deliverable) are adhered to. Once all checks pass, the code
     * passes through to TeamController::createTeam(..).
     *
     * @param teamId
     * @param deliv
     * @param people
     * @param adminOverride
     * @returns {Promise<Team | null>}
     */
    public async formTeam(teamId: string, deliv: Deliverable, people: Person[], adminOverride: boolean): Promise<Team | null> {
        Log.info("TeamController::formTeam( ... ) - start");

        // sanity checking
        if (deliv === null) {
            throw new Error("Team not created; deliverable does not exist.");
        }
        if (deliv.teamStudentsForm === false && !adminOverride) {
            throw new Error("Team not created; students cannot form their own teams for this deliverable.");
        }

        if (people.indexOf(null) >= 0) {
            throw new Error("Team not created; some students not members of the course.");
        }
        if (people.length > deliv.teamMaxSize && !adminOverride) {
            throw new Error("Team not created; too many team members specified for this deliverable.");
        }
        if (people.length < deliv.teamMinSize && !adminOverride) {
            throw new Error("Team not created; too few team members specified for this deliverable.");
        }

        // const people: Person[] = [];
        // for (const ghId of gitHubIds) {
        //     const person = await pc.getGitHubPerson(ghId);
        //     if (person === null) {
        //         throw new Error("Team not created; GitHub id not associated with student registered in course: " + ghId);
        //     } else {
        //         people.push(person);
        //     }
        // }

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
                if (personTeam.delivId === deliv.id) {
                    Log.error("TeamController::formTeam( ... ) - member already on team: " +
                        personTeam.id + " for deliverable: " + deliv.id);
                    throw new Error("Team not created; some members are already on existing teams for this deliverable.");
                }
            }
        }

        const team = await this.createTeam(teamId, deliv, people, {});
        return team;
    }

    /**
     * Creates a team object.
     *
     * @param {string} name
     * @param {Deliverable} deliv
     * @param {Person[]} people
     * @param custom
     * @returns {Promise<Team | null>}
     */
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
            throw new Error("Duplicate team name: " + name);
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
