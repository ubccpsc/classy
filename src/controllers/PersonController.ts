import Log from "../util/Log";
import {DatabaseController} from "./DatabaseController";
import {Person} from "../Types";
import {SDDMController} from "./SDDMController";

export class PersonController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async createPerson(personPrototype: Person): Promise<Person | null> {
        Log.info("PersonController::createPerson( " + personPrototype.org + ", " + personPrototype.id + " ) - start");
        let existingPerson = await this.db.getPerson(personPrototype.org, personPrototype.id);

        if (existingPerson === null) {
            Log.trace("PersonController::createPerson(..) - writing");
            let successful = await this.db.writePerson(personPrototype);
            if (successful === true) {
                Log.trace("PersonController::createPerson(..) - retrieving");
                const person = await this.db.getPerson(personPrototype.org, personPrototype.id);
                return person;
            }
        }
        return null;
    }

    /**
     * Validates github username for the specified org.
     *
     * This sets the Person.url field, confirming that they have
     * successfully logged in.
     *
     * @param {string} githubUsername
     * @returns {boolean}
     */
    public async getPerson(org: string, githubUsername: string): Promise<Person | null> {
        Log.info("PersonController::getPerson( " + org + ", " + githubUsername + " ) - start");

        let person = await this.db.getPerson(org, githubUsername);

        if (person === null) {
            // in this case, return false, because login failed
            Log.info("PersonController::getPerson( " + org + ", " + githubUsername + " ) - unknown person for this org - failing");
            return null;
        }
        return person;
    }

    public async getAllPeople(org: string): Promise<Person[]> {
        Log.info("PersonController::getAllPeople( " + org + " ) - start");
        return await this.db.getPeople(org);
    }

}