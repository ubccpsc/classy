import Log from "../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {Person} from "../Types";

export class PersonController {

    private db: DatabaseController = DatabaseController.getInstance();

    /**
     * Creates a person. If that person exists, returns the existing person.
     *
     * @param {Person} personPrototype
     * @returns {Promise<Person | null>}
     */
    public async createPerson(personPrototype: Person): Promise<Person | null> {
        Log.info("PersonController::createPerson( " + personPrototype.id + " ) - start");
        let existingPerson = await this.db.getPerson(personPrototype.id);

        if (existingPerson === null) {
            Log.trace("PersonController::createPerson(..) - writing");
            let successful = await this.db.writePerson(personPrototype);
            if (successful === true) {
                Log.trace("PersonController::createPerson(..) - retrieving");
                const person = await this.db.getPerson(personPrototype.id);
                return person;
            }
        }
        return existingPerson;
    }

    /**
     * Validates github username for the specified org.
     *
     * This sets the Person.URL field, confirming that they have
     * successfully logged in.
     *
     * @param {string} githubUsername
     * @returns {boolean}
     */
    public async getPerson(githubUsername: string): Promise<Person | null> {
        Log.info("PersonController::getPerson( " + githubUsername + " ) - start");

        let person = await this.db.getPerson(githubUsername);

        if (person === null) {
            // in this case, return false, because login failed
            Log.info("PersonController::getPerson( " + githubUsername + " ) - unknown person for this org - failing");
            return null;
        }
        return person;
    }

    public async getAllPeople(): Promise<Person[]> {
        Log.info("PersonController::getAllPeople() - start");
        return await this.db.getPeople();
    }

}
