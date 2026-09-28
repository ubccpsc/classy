import Log from "@common/Log";
import { PersonTransport } from "@common/types/PortalTypes";
import Util from "@common/Util";
import { Person, PersonKind, Repository } from "../Types";

import { DatabaseController } from "./DatabaseController";
import { GitHubActions } from "./GitHubActions";

/** The GitHub logins on each of the course's role teams; see PersonController::syncKindsWithTeams. */
export interface TeamLogins {
	students: string[];
	/** empty means "could not be read": staff and admin kinds are then left alone */
	staff: string[];
	admin: string[];
}

export class PersonController {
	private db: DatabaseController = DatabaseController.getInstance();

	/**
	 * Creates a person. If that person exists, returns the existing person.
	 *
	 * @param {Person} personPrototype
	 * @returns {Promise<Person | null>}
	 */
	public async createPerson(personPrototype: Person): Promise<Person | null> {
		Log.trace("PersonController::createPerson( " + personPrototype.id + " ) - start");
		const existingPerson = await this.db.getPerson(personPrototype.id);

		if (existingPerson === null) {
			await this.db.writePerson(personPrototype);

			Log.info("PersonController::createPerson( " + personPrototype.id + " ) - new person created");
			return await this.db.getPerson(personPrototype.id);
		} else {
			// merge people

			if (existingPerson.labId !== personPrototype.labId) {
				Log.info(
					"PersonController::createPerson( " +
						personPrototype.id +
						" ) - lab id change: " +
						existingPerson.labId +
						" -> " +
						personPrototype.labId
				);
			}
			existingPerson.labId = personPrototype.labId; // can update

			if (existingPerson.githubId !== personPrototype.githubId) {
				Log.info(
					"PersonController::createPerson( " +
						personPrototype.id +
						" ) - githubId change: " +
						existingPerson.githubId +
						" -> " +
						personPrototype.githubId
				);
			}
			existingPerson.githubId = personPrototype.githubId; // can update

			if (existingPerson.githubId !== personPrototype.githubId) {
				Log.info(
					"PersonController::createPerson( " + personPrototype.id + " ) - URL change: " + existingPerson.URL + " -> " + personPrototype.URL
				);
			}
			existingPerson.URL = personPrototype.URL; // can update (along with githubId)

			if (existingPerson.fName !== personPrototype.fName) {
				Log.info(
					"PersonController::createPerson( " +
						personPrototype.id +
						" ) - fName change: " +
						existingPerson.fName +
						" -> " +
						personPrototype.fName
				);
			}
			existingPerson.fName = personPrototype.fName; // can update (along with githubId)

			if (existingPerson.lName !== personPrototype.lName) {
				Log.info(
					"PersonController::createPerson( " +
						personPrototype.id +
						" ) - lName change: " +
						existingPerson.lName +
						" -> " +
						personPrototype.lName
				);
			}
			existingPerson.lName = personPrototype.lName; // can update (along with githubId)

			// NOTE: existingPerson.custom is _not_ deleted ; unsure if this is the right thing
			// existingPerson.custom = {};

			await this.db.writePerson(existingPerson);

			Log.trace("PersonController::createPerson( " + existingPerson.id + " ) - updated");
			return await this.db.getPerson(personPrototype.id);
		}
	}

	/**
	 * Writes a person record. If the person exists, they will be updated.
	 *
	 * Person.id is invariant so that is the field that will be used for matching.
	 *
	 * @param {Person} person
	 * @returns {Promise<boolean>}
	 */
	public async writePerson(person: Person): Promise<boolean> {
		Log.trace("PersonController::writePerson( " + person.id + " ) - start");

		return await this.db.writePerson(person);
	}

	/**
	 * Finds the person based on their githubId.
	 *
	 * @param {string} githubId
	 * @returns {Promise<Person | null>}
	 */
	public async getGitHubPerson(githubId: string): Promise<Person | null> {
		let person = await this.db.getGitHubPerson(githubId);
		if (person === null) {
			Log.trace("PersonController::getGitHubPersonPerson( " + githubId + " ) - githubId not yet registered.");

			// user not registered but might be admin or staff
			const gh = GitHubActions.getInstance();
			const isAdmin = await gh.isOnAdminTeam(githubId);
			const isStaff = await gh.isOnStaffTeam(githubId);

			if (isAdmin === true || isStaff === true) {
				Log.trace("PersonController::getGitHubPersonPerson( " + githubId + " ) - githubId is admin or staff.");
				person = {
					id: githubId,
					githubId: githubId,
					csId: githubId,
					URL: null,
					studentNumber: null,
					fName: githubId,
					lName: githubId,
					labId: null,
					kind: null, // will be filled in later
					custom: {},
				};
				person = await this.createPerson(person);
				return person;
			} else {
				Log.trace("PersonController::getGitHubPersonPerson( " + githubId + " ) - githubId is unknown and not admin/staff.");
				return null;
			}
		}
		return person;
	}

	/**
	 * Finds the person based on their id.
	 *
	 * @param {string} personId
	 * @returns {boolean}
	 */
	public async getPerson(personId: string): Promise<Person | null> {
		// Log.trace("PersonController::getPerson( ... ) - start");
		Log.trace("PersonController::getPerson( " + personId + " ) - start");
		const start = Date.now();

		const person = await this.db.getPerson(personId);
		if (person === null) {
			Log.trace("PersonController::getPerson( " + personId + " ) - unknown person for this org check githubId");
			// Log.trace("PersonController::getPerson( " + personId + " ) - unknown person for this org: " +
			//     Config.getInstance().getProp(ConfigKey.org));
			return null;
		}
		Log.trace("PersonController::getPerson( " + personId + " ) - done; took: " + Util.took(start));
		return person;
	}

	/**
	 * This returns _all_ people (including admins, staff, withrdawn students, etc.).
	 *
	 * @returns {Promise<Person[]>}
	 */
	public async getAllPeople(): Promise<Person[]> {
		Log.trace("PersonController::getAllPeople() - start");
		const start = Date.now();
		const people = await this.db.getPeople();
		Log.trace("PersonController::getAllPeople() - done; took: " + Util.took(start));
		return people;
	}

	public async getRepos(personId: string): Promise<Repository[] | null> {
		Log.trace("PersonController::getRepos( " + personId + " ) - start");
		const start = Date.now();
		const repos = await this.db.getRepositoriesForPerson(personId);
		Log.trace("PersonController::getRepos( " + personId + " ) - # repos: " + repos.length + "; took: " + Util.took(start));
		return repos;
	}

	/**
	 * Settles every person's kind from the GitHub teams, which are what actually grant access.
	 * Precedence is the one the login path uses (AuthController::personPrivileged): on staff and
	 * admin -> ADMINSTAFF, staff -> STAFF, admin -> ADMIN, otherwise students -> STUDENT, and on
	 * no team -> WITHDRAWN. A null kind (login in progress) is settled the same way.
	 *
	 * This used to look only at the students team and only at students, so a TA added to the
	 * staff team stayed a student until they next logged in, and an admin removed from the team
	 * kept admin until they did.
	 *
	 * Guard: an empty staff or admin list is treated as "could not be read", not as empty -- a
	 * course always has an admin, and getTeamMembers answers an empty list for a failed request.
	 * On such a run privileged kinds are neither granted nor removed; the students logic still runs.
	 *
	 * @param teams the logins on each team
	 * @returns {Promise<string>} a human-readable summary
	 */
	public async syncKindsWithTeams(teams: TeamLogins): Promise<string> {
		const prefix = "PersonController::syncKindsWithTeams( .. ) - ";
		const people = await this.getAllPeople();
		const privilegedReadable = teams.staff.length > 0 && teams.admin.length > 0;
		Log.info(
			prefix +
				"# people: " +
				people.length +
				"; students team: " +
				teams.students.length +
				"; staff team: " +
				teams.staff.length +
				"; admin team: " +
				teams.admin.length
		);
		if (privilegedReadable === false) {
			Log.warn(
				prefix +
					"the staff or admin team came back empty; treating both as unreadable, so staff and admin kinds are left as they are on this run"
			);
		}

		// GitHub logins are case-insensitive, and Classy lowercases the CWL it stores as githubId;
		// an exact compare withdrew anyone whose login GitHub reports with a capital letter, every run.
		const lower = (ids: string[]) => new Set(ids.map((id) => id.toLowerCase()));
		const students = lower(teams.students);
		const staff = lower(teams.staff);
		const admin = lower(teams.admin);

		// Everything needed to answer "why is this person this kind?" from the log alone.
		const reinstated: string[] = [];
		const withdrawnThisRun: string[] = [];
		const promoted: string[] = [];
		const demoted: string[] = [];
		const settled: string[] = [];
		const stillWithdrawn: string[] = [];
		const noGithubId: string[] = [];
		const knownLogins = new Set<string>();
		let numActive = 0;
		let numWithdrawn = 0;

		for (const person of people) {
			const hasGithubId = typeof person.githubId === "string" && person.githubId.length > 0;
			const login = hasGithubId ? person.githubId.toLowerCase() : null;
			if (login !== null) {
				knownLogins.add(login);
			}
			// NONE ("") is the older spelling of "not derived yet"
			const current: PersonKind | null = person.kind === PersonKind.NONE || typeof person.kind === "undefined" ? null : person.kind;
			const isPrivileged = current === PersonKind.STAFF || current === PersonKind.ADMIN || current === PersonKind.ADMINSTAFF;
			const onStudents = login !== null && students.has(login);
			const onStaff = privilegedReadable && login !== null && staff.has(login);
			const onAdmin = privilegedReadable && login !== null && admin.has(login);

			let target: PersonKind;
			if (onStaff && onAdmin) {
				target = PersonKind.ADMINSTAFF;
			} else if (onStaff) {
				target = PersonKind.STAFF;
			} else if (onAdmin) {
				target = PersonKind.ADMIN;
			} else if (isPrivileged && (privilegedReadable === false || hasGithubId === false)) {
				target = current; // cannot tell whether they still belong; keep what they have
			} else if (onStudents) {
				target = PersonKind.STUDENT;
			} else {
				target = PersonKind.WITHDRAWN;
			}

			const label = person.id + " (githubId: " + person.githubId + ")";
			if (hasGithubId === false && isPrivileged === false) {
				noGithubId.push(label);
			}

			if (target !== current) {
				const change = label + ": " + current + " -> " + target;
				if (target === PersonKind.WITHDRAWN) {
					withdrawnThisRun.push(change); // including a null kind that is on no team
				} else if (current === null) {
					settled.push(change);
				} else if (current === PersonKind.WITHDRAWN && target === PersonKind.STUDENT) {
					reinstated.push(change);
				} else if (target === PersonKind.STUDENT) {
					demoted.push(change);
				} else {
					promoted.push(change);
				}
				Log.info(prefix + "changing " + change);
				person.kind = target;
				await this.writePerson(person);
			} else if (target === PersonKind.WITHDRAWN) {
				stillWithdrawn.push(label);
			}

			if (target === PersonKind.STUDENT) {
				numActive++;
			} else if (target === PersonKind.WITHDRAWN) {
				numWithdrawn++;
			}
		}

		const unknownLogins = Array.from(new Set([...teams.students, ...teams.staff, ...teams.admin])).filter(
			(id) => knownLogins.has(id.toLowerCase()) === false
		);

		if (reinstated.length > 0) {
			Log.warn(prefix + "reinstated (back on the students team): " + PersonController.forLog(reinstated));
		}
		if (withdrawnThisRun.length > 0) {
			Log.warn(prefix + "withdrawn this run (githubId on no team): " + PersonController.forLog(withdrawnThisRun));
		}
		if (promoted.length > 0) {
			Log.warn(prefix + "promoted (on the staff or admin team): " + PersonController.forLog(promoted));
		}
		if (demoted.length > 0) {
			Log.warn(prefix + "demoted (no longer on the staff or admin team): " + PersonController.forLog(demoted));
		}
		if (settled.length > 0) {
			Log.info(prefix + "null kinds settled from the teams: " + PersonController.forLog(settled));
		}
		if (stillWithdrawn.length > 0) {
			Log.warn(
				prefix +
					"still withdrawn (githubId on no team; a classlist update never reinstates, only this job does): " +
					PersonController.forLog(stillWithdrawn)
			);
		}
		if (noGithubId.length > 0) {
			Log.warn(prefix + "students with no githubId, who can never match a team and are withdrawn: " + PersonController.forLog(noGithubId));
		}
		if (unknownLogins.length > 0) {
			Log.info(prefix + "team logins with no matching Classy person (not on the classlist): " + PersonController.forLog(unknownLogins));
		}

		const msg =
			"# active: " +
			numActive +
			"; # withdrawn: " +
			numWithdrawn +
			"; # withdrawn (this run): " +
			withdrawnThisRun.length +
			"; # reinstated (this run): " +
			reinstated.length +
			"; # promoted (this run): " +
			promoted.length +
			"; # demoted (this run): " +
			demoted.length +
			"; # null kinds settled (this run): " +
			settled.length +
			"; # on GitHub teams: students " +
			teams.students.length +
			", staff " +
			teams.staff.length +
			", admin " +
			teams.admin.length +
			(privilegedReadable ? "" : " (staff/admin unreadable; privileged kinds untouched)") +
			"; # team logins unknown to Classy: " +
			unknownLogins.length +
			(noGithubId.length > 0 ? "; # students without a GitHub id: " + noGithubId.length : "");
		Log.info(prefix + "done; " + msg);
		return msg;
	}

	/** Up to 50 entries, then a count of the rest, so a whole-class list cannot flood the log. */
	private static forLog(entries: string[], max: number = 50): string {
		if (entries.length <= max) {
			return entries.length + ": " + entries.join(", ");
		}
		return entries.length + ": " + entries.slice(0, max).join(", ") + ", ... and " + (entries.length - max) + " more";
	}

	public static personToTransport(person: Person): PersonTransport {
		if (typeof person === "undefined" || person === null) {
			throw new Error("PersonController::personToTransport( ... ) - ERROR: person not provided.");
		}

		return {
			id: person.id,
			firstName: person.fName,
			lastName: person.lName,
			githubId: person.githubId,
			userUrl: person.URL,
			studentNum: person.studentNumber,
			labId: person.labId,
		} as PersonTransport;
	}
}
