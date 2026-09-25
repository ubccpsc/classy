import Log from "@common/Log";
import { PersonTransport } from "@common/types/PortalTypes";
import Util from "@common/Util";
import { Person, PersonKind, Repository } from "../Types";

import { DatabaseController } from "./DatabaseController";
import { GitHubActions } from "./GitHubActions";

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
	 * Marks students as withdrawn if their gitHubId is not listed in the list of registered student githubIds.
	 * @param {string[]} registeredGithubIds
	 * @returns {Promise<string>}
	 */
	public async markStudentsWithdrawn(registeredGithubIds: string[]): Promise<string> {
		const people = await this.getAllPeople();
		Log.info(
			"PersonController::markStudentsWithdrawn( .. ) - # people: " + people.length + "; # registered: " + registeredGithubIds.length
		);
		// Counted after each person's kind has been settled, so a re-enrolled student lands in
		// active and a student dropped on this run lands in both withdrawn totals.
		let numActive = 0;
		let numWithdrawn = 0;
		let numWithdrawnThisRun = 0;
		// GitHub logins are case-insensitive, and Classy lowercases the CWL it stores as githubId;
		// an exact compare withdrew anyone whose login GitHub reports with a capital letter, every run.
		const registered = new Set(registeredGithubIds.map((id) => id.toLowerCase()));
		for (const person of people) {
			// A null kind is a student whose role is being re-derived: the login callback nulls it
			// and the next privileged request fills it back in. Skipping them here made a student
			// who logged in but never loaded a page invisible to both counts (AdminController::getPeople
			// already treats null as a student for the same reason). On the team they count as
			// active and kind is left null, so the pending re-derivation still runs; off the team
			// they are withdrawn like any other student.
			if (person.kind === PersonKind.STUDENT || person.kind === PersonKind.WITHDRAWN || person.kind === null) {
				if (typeof person.githubId === "string" && registered.has(person.githubId.toLowerCase())) {
					// student is registered
					if (person.kind === PersonKind.WITHDRAWN) {
						// this will happen if they have withdrawn and then re-enrolled
						person.kind = PersonKind.STUDENT;
						await this.writePerson(person);
					}
					numActive++;
				} else {
					// student is not registered; mark as withdrawn
					if (person.kind !== PersonKind.WITHDRAWN) {
						numWithdrawnThisRun++;
						person.kind = PersonKind.WITHDRAWN;
						Log.info("PersonController::markStudentsWithdrawn( .. ) - marking " + person.id + " as withdrawn");
						await this.writePerson(person);
					}
					numWithdrawn++;
				}
			}
		}
		const msg = "# active: " + numActive + "; # withdrawn: " + numWithdrawn + "; # withdrawn (this run): " + numWithdrawnThisRun;
		Log.info("PersonController::markStudentsWithdrawn( .. ) - done; " + msg);
		return msg;
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
