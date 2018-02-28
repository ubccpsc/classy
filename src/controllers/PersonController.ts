import Log from "../util/Log";
import {DatabaseController} from "./DatabaseController";
import {Person} from "../Types";

export class PersonController {

    private db: DatabaseController = DatabaseController.getInstance();

    /**
     * Validates github username for the specified orgName.
     *
     * This sets the Person.url field, confirming that they have
     * successfully logged in.
     *
     * @param {string} githubUsername
     * @returns {boolean}
     */
    public async configureUsername(orgName: string, githubUsername: string): Promise<boolean> {
        Log.info("PersonController::configureUsername( " + orgName + ", " + githubUsername + " ) - start");

        let person = await this.db.getPerson(orgName, githubUsername);

        if (person === null) {
            if (orgName === 'secapstone' || orgName === 'secapstonetest') {
                Log.info("PersonController::configureUsername( " + orgName + ", " + githubUsername + " ) - new person for this org; - provisioning");
                // TODO: do the new user flow
                // add to org
                // make person object
                let person: Person = {
                    id:            githubUsername,
                    csId:          githubUsername, // sdmm doesn't have these
                    githubId:      githubUsername,
                    studentNumber: null,

                    org:   orgName,
                    fName: '',
                    lName: '',
                    kind:  'student',
                    url:   'https://github.com/' + githubUsername,
                    labId: 'UNKNOWN'
                };
                // add to database
                await this.db.writePerson(person);
                return true;
            } else {
                // otherwise, person should be configured for course in advance
                // in this case, return false, because login failed
                Log.info("PersonController::configureUsername( " + orgName + ", " + githubUsername + " ) - unknown person for this org - failing");
                return false;
            }
        } else {
            return true;
        }
    }

    public async getAllPeople(orgName: string): Promise<Person[]> {
        Log.info("PersonController::getAllPeople( " + orgName + " ) - start");
        return await this.db.getPeople(orgName);
    }

}