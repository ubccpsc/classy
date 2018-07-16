import Log from "../../../common/Log";

import {PersonController} from "./PersonController";
import {DatabaseController} from "./DatabaseController";
import {Auth} from "../Types";
import {GitHubActions} from "./util/GitHubActions";

/**
 * Nice OAuth Reference: https://medium.com/typeforms-engineering-blog/the-beginners-guide-to-oauth-dancing-4b8f3666de10
 */
export class AuthController {

    private dc: DatabaseController = null;

    constructor() {
        this.dc = DatabaseController.getInstance();
    }

    public async isValid(personId: string, token: string): Promise<boolean> {
        Log.trace("AuthController::isValid( " + personId + ", ... ) - start");
        let person = new PersonController().getPerson(personId);
        if (person !== null) {
            let valid = await this.verifyToken(personId, token);
            return valid;
        }
        return false;
    }

    private async verifyToken(personId: string, token: string): Promise<boolean> {
        Log.trace("AuthController::verifyToken( " + personId + " ) - start");
        let auth = <Auth> await this.dc.getAuth(personId);
        if (auth !== null) {
            if (auth.token === token) {
                Log.info("DatabaseController::verifyToken( " + personId + " ) - token verified");
                return true;
            } else {
                Log.info("DatabaseController::verifyToken( " + personId + " ) - token !verified");
                return false;
            }
        }
        Log.info("DatabaseController::verifyToken( " + personId + " ) - no token stored");
        return false;
    }

    public async isPrivileged(personId: string, token: string): Promise<{ isAdmin: boolean, isStaff: boolean }> {
        Log.trace("AuthController::isPrivileged( " + personId + ", ... ) - start");
        const pc = new PersonController();
        const dc = DatabaseController.getInstance();
        let person = await pc.getPerson(personId);
        if (person !== null) {
            let valid = await this.isValid(personId, token);
            if (valid === true) {
                Log.trace("AuthController::isPrivileged( " + personId + ", ... ) - person.kind: " + person.kind);

                if (person.kind === null || person.kind === '') {
                    // check github for credentials and cache them
                    const isStaff = await new GitHubActions().isOnStaffTeam(personId);
                    const isAdmin = await new GitHubActions().isOnAdminTeam(personId);
                    Log.trace("AuthController::isPrivileged( " + personId + ", ... ) - caching new credentials; admin: " + isAdmin + "; staff: " + isStaff);

                    if (isStaff === true && isAdmin === true) {
                        person.kind = 'adminstaff';
                        dc.writePerson(person);
                    } else if (isStaff === true) {
                        person.kind = 'staff';
                        dc.writePerson(person);
                    } else if (isAdmin === true) {
                        person.kind = 'admin';
                        dc.writePerson(person);
                    }
                }

                if (person.kind === 'student') {
                    return {isAdmin: false, isStaff: false};
                } else if (person.kind === 'admin') {
                    return {isAdmin: true, isStaff: false};
                } else if (person.kind === 'staff') {
                    return {isAdmin: false, isStaff: true};
                } else if (person.kind === 'adminstaff') {
                    return {isAdmin: true, isStaff: true};
                } else {
                    Log.trace("AuthController::isPrivileged( " + personId + ", ... ) - unknown kind: " + person.kind);
                }
            }
        }
        return {isAdmin: false, isStaff: false};
    }

    /**
     * Deauthenticates a user. This resets their Person.kind field and removes any Auth record they might have.
     *
     * @param {string} personId
     * @returns {Promise<boolean>}
     */
    public async removeAuthentication(personId: string): Promise<boolean> {
        Log.trace("AuthController::removeAuthentication() - start");
        const pc = new PersonController();
        const person = await pc.getPerson(personId);
        person.kind = null;
        pc.writePerson(person);

        const auth = await this.dc.getAuth(personId);
        await this.dc.deleteAuth(auth);

        Log.trace("AuthController::removeAuthentication() - done");
        return true; // if it doesn't throw an exception it must have worked enough
    }

}
