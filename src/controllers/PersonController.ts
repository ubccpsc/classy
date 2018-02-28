import Log from "../util/Log";
import {DatabaseController} from "./DatabaseController";
import {Person} from "../Types";

export class PersonController {

    private db: DatabaseController = DatabaseController.getInstance();

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
        Log.info("PersonController::configureUsername( " + org + ", " + githubUsername + " ) - start");

        let person = await this.db.getPerson(org, githubUsername);

        if (person === null) {
            if (org === 'secapstone' || org === 'secapstonetest') {
                Log.info("PersonController::configureUsername( " + org + ", " + githubUsername + " ) - new person for this org; - provisioning");
                // in the secapstone we don't know who the students are in advance
                // in this case, we will create Person objects on demand

                // make person
                let newPerson: Person = {
                    id:            githubUsername,
                    csId:          githubUsername, // sdmm doesn't have these
                    githubId:      githubUsername,
                    studentNumber: null,

                    org:   org,
                    fName: '',
                    lName: '',
                    kind:  'student',
                    url:   'https://github.com/' + githubUsername,
                    labId: 'UNKNOWN'
                };

                // add to database
                await this.db.writePerson(newPerson);
                return newPerson;
            } else {
                // otherwise, person should be configured for course in advance
                // in this case, return false, because login failed
                Log.info("PersonController::configureUsername( " + org + ", " + githubUsername + " ) - unknown person for this org - failing");
                return null;
            }
        } else {
            return person;
        }
    }

    public async getAllPeople(org: string): Promise<Person[]> {
        Log.info("PersonController::getAllPeople( " + org + " ) - start");
        return await this.db.getPeople(org);
    }

}