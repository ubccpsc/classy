import Log from "@common/Log";

import { TeamTransport } from "@common/types/PortalTypes";
import Util from "@common/Util";
import Config, { ConfigKey } from "@common/Config";

import { Deliverable, GitHubStatus, Person, PersonKind, Team } from "../Types";
import { DatabaseController } from "./DatabaseController";
import { GitHubActions, IGitHubActions } from "./GitHubActions";

export class TeamController {
	/**
	 * A special GitHub team that contains all admins for a course (instructors, lead TAs).
	 */
	public static readonly ADMIN_NAME = Config.getInstance().getProp(ConfigKey.adminTeamName) as string;

	/**
	 * A special GitHub team for all other course staff (e.g., all TAs).
	 */
	public static readonly STAFF_NAME = Config.getInstance().getProp(ConfigKey.staffTeamName) as string;

	/**
	 * A special GitHub team that contains all students enrolled in a course.
	 */
	public static readonly STUDENTS_NAME = "students";

	private db: DatabaseController = DatabaseController.getInstance();
	private gha: IGitHubActions;

	constructor(gha?: IGitHubActions) {
		if (typeof gha === "undefined") {
			this.gha = GitHubActions.getInstance();
		} else {
			this.gha = gha;
		}
	}

	/**
	 * Returns all student teams.
	 *
	 * Special teams are _not_ returned.
	 *
	 * @returns {Promise<Team[]>}
	 */
	public async getAllTeams(): Promise<Team[]> {
		Log.trace("TeamController::getAllTeams() - start");
		const start = Date.now();

		// remove special teams
		const teamsToReturn = [];
		const teams = await this.db.getTeams();
		for (const team of teams) {
			if (
				team.id === TeamController.ADMIN_NAME ||
				team.id === TeamController.STAFF_NAME ||
				team.id === TeamController.STUDENTS_NAME
			) {
				// do not include
			} else {
				teamsToReturn.push(team);
			}
		}

		Log.trace("TeamController::getAllTeams() - done; took: " + Util.took(start));
		return teamsToReturn;
	}

	public async getTeam(name: string): Promise<Team | null> {
		Log.trace("TeamController::getTeam( " + name + " ) - start");
		const start = Date.now();

		const team = await this.db.getTeam(name);
		Log.trace("TeamController::getTeam( " + name + " ) - done; took: " + Util.took(start));
		return team;
	}

	/**
	 * Gets the GitHub team number.
	 *
	 * Returns null if the does not exist on GitHub.
	 *
	 * @param {string} name
	 * @returns {Promise<number | null>}
	 */
	public async getTeamNumber(name: string): Promise<number | null> {
		Log.trace("TeamController::getTeamNumber( " + name + " ) - start");
		const start = Date.now();

		const team = await this.db.getTeam(name);
		if (team === null) {
			Log.warn("TeamController::getTeamNumber( " + name + " ) - team does not exist in database");
			return null;
		}

		if (typeof team.githubId === "undefined" || team.githubId === null) {
			// teamId not known; get it & store it
			let teamNum = null;
			const ghTeam = await this.gha.getTeamByName(name);
			// NOTE: this is using teamNumber as a provisioning hint
			if (ghTeam !== null && ghTeam.githubTeamNumber >= 0) {
				Log.warn("TeamController::getTeamNumber( " + name + " ) - team does not exist on GitHub; setting null.");
				teamNum = ghTeam.githubTeamNumber;
			}
			// let teamNum: number | null = await this.gha.getTeamNumber(team.id);
			// if (teamNum < 0) {
			//     Log.warn("TeamController::getTeamNumber( " + name + " ) - team does not exist on GitHub; setting null.");
			//     teamNum = null;
			// }
			team.githubId = teamNum;
			await this.saveTeam(team);
		} else {
			// githubId is set, should we check to see if it"s right?
			// TODO: verify that the number is right?
			// could do it with this: this.gha.getTeam(team.githubId)
		}

		Log.info("TeamController::getTeamNumber( " + name + " ) - done; took: " + Util.took(start));
		return team.githubId;
	}

	public async saveTeam(team: Team): Promise<Team> {
		Log.info("TeamController::saveTeam(..) - start");
		const dc = DatabaseController.getInstance();
		await dc.writeTeam(team);
		return team;
	}

	public async getTeamsForPerson(myPerson: Person): Promise<Team[]> {
		Log.trace("TeamController::getTeamsForPerson( " + myPerson.id + " ) - start");
		const start = Date.now();

		let myTeams: Team[] = [];
		const allTeams = await this.db.getTeams();
		for (const team of allTeams) {
			if (team.personIds.indexOf(myPerson.id) >= 0) {
				myTeams.push(team);
			}
		}

		// sort by delivIds
		myTeams = myTeams.sort(function (a: Team, b: Team) {
			return a.delivId.localeCompare(b.delivId);
		});

		Log.info("TeamController::getTeamsForPerson( " + myPerson.id + " ) - # teams: " + myTeams.length + "; took: " + Util.took(start));
		return myTeams;
	}

	/**
	 * Convenience method for creating team objects when only primitive types are known. This is
	 * especially useful for students specifying their own teams as it checks to ensure that team
	 * constraints (specified in the deliverable) are adhered to. Once all checks pass, the code
	 * passes through to TeamController::teamCreate(..).
	 *
	 * @param teamId
	 * @param deliv
	 * @param people
	 * @param adminOverride
	 * @returns {Promise<Team | null>}
	 */
	public async formTeam(teamId: string, deliv: Deliverable, people: Person[], adminOverride: boolean): Promise<Team | null> {
		Log.info("TeamController::formTeam( " + teamId + ", ... ) - start; override: " + adminOverride);

		// sanity checking
		if (deliv === null) {
			throw new Error("Team not created; deliverable does not exist.");
		}

		// check for non-existent people
		if (people.indexOf(null) >= 0) {
			throw new Error("Team not created; some students not members of the course.");
		}

		// make sure the team is not too large
		if (people.length > deliv.teamMaxSize && !adminOverride) {
			throw new Error("Team not created; too many team members specified for this deliverable.");
		}

		// make sure the team is not too small
		if (people.length < deliv.teamMinSize && !adminOverride) {
			throw new Error("Team not created; too few team members specified for this deliverable.");
		}

		// make sure students can form their own teams
		if (deliv.teamMaxSize > 1) {
			// only matters if the team size is grater than 1
			if (deliv.teamStudentsForm === false && !adminOverride) {
				throw new Error("Team not created; students cannot form their own teams for this deliverable.");
			}
		}

		// make sure all students are still registered in the class
		for (const p of people) {
			if (p.kind === PersonKind.WITHDRAWN && !adminOverride) {
				throw new Error("Team not created; at least one student is not an active member of the class.");
			}
		}

		// ensure members are all in the same lab section (if required)
		if (deliv.teamSameLab === true && !adminOverride) {
			let labName = null;
			for (const p of people) {
				if (labName === null) {
					labName = p.labId;
				}
				if (labName !== p.labId) {
					Log.warn("TeamController::formTeam( ... ) - members not all in same lab ( " + labName + ", " + p.labId + " )");
					throw new Error("Team not created; all members are not in the same lab.");
				}
			}
		}

		// ensure members are not already on a team for that deliverable
		for (const person of people) {
			const teamsForPerson = await this.getTeamsForPerson(person);
			for (const existingTeam of teamsForPerson) {
				if (existingTeam.delivId === deliv.id) {
					// NOTE: no adminOverride for this, this must be enforced
					Log.warn(
						"TeamController::formTeam( ... ) - member already on team: " + existingTeam.id + " for deliverable: " + deliv.id
					);
					if (
						existingTeam.personIds.length === people.length &&
						people.every((p) => existingTeam.personIds.includes(p.id)) &&
						existingTeam.id === teamId
					) {
						// The team being made is the same as one that was already made, so return the old one
						return existingTeam;
					} else {
						throw new Error("Team not created; some members are already on existing teams for this deliverable.");
					}
				}
			}
		}

		const team = await this.createTeam(teamId, deliv, people, {});
		Log.info("TeamController::formTeam( " + teamId + ", ... ) - done");
		return team;
	}

	/**
	 * Creates a team object.
	 *
	 * @param {string} name
	 * @param {Deliverable} deliv
	 * @param {Person[]} people
	 * @param {any} custom
	 * @returns {Promise<Team | null>}
	 */
	public async createTeam(name: string, deliv: Deliverable, people: Person[], custom: any): Promise<Team | null> {
		Log.info("TeamController::teamCreate( " + name + ", ... ) - start");

		if (typeof name === "undefined" || name === null || name.length < 1) {
			throw new Error("TeamController::teamCreate() - no team name provided.");
		}

		if (typeof deliv === "undefined" || deliv === null) {
			throw new Error("TeamController::teamCreate() - no deliverable provided.");
		}

		// this constraint is not necessary
		// if (Array.isArray(people) === false || people.length < 1) {
		//     throw new Error("TeamController::teamCreate() - no people provided.");
		// }

		try {
			const existingTeam = await this.getTeam(name);
			if (existingTeam === null) {
				const peopleIds: string[] = people.map((person) => person.id);

				const team: Team = {
					id: name,
					delivId: deliv.id,
					githubId: null,
					gitHubStatus: GitHubStatus.NOT_PROVISIONED,
					URL: null,
					personIds: peopleIds,
					custom: custom,
					// repoName:  null,  // team counts above used repoName
					// repoUrl:   null
				};
				await this.db.writeTeam(team);

				Log.info("TeamController::teamCreate( " + name + ", ... ) - done");
				return await this.db.getTeam(name);
			} else {
				throw new Error("Duplicate team name: " + name);
			}
		} catch (err) {
			Log.error("TeamController::teamCreate() - ERROR: " + err.message);
			throw err;
		}
	}

	/**
	 * Serialize team object to a TeamTransport.
	 *
	 * @param team
	 */
	public teamToTransport(team: Team): TeamTransport {
		return {
			id: team.id,
			delivId: team.delivId,
			people: team.personIds,
			URL: team.URL,
			// repoName: team.repoName,
			// repoUrl:  team.repoUrl
		};
	}
}
