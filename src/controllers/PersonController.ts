import Log from "../util/Log";
import {DatabaseController} from "./DatabaseController";

export class PersonController {

    /**
     * Validates github username for the specified orgName.
     *
     * This sets the Person.url field, confirming that they have
     * successfully logged in.
     *
     * @param {string} githubUsername
     * @returns {boolean}
     */
    static async configureUsername(orgName: string, githubUsername: string): Promise<boolean> {
        Log.info("PersonController::configureUsername( " + orgName + ", " + githubUsername + " ) - start");
        // TODO: add user to the database

        let person = await DatabaseController.getPerson(orgName, githubUsername);

        return true;
    }
}