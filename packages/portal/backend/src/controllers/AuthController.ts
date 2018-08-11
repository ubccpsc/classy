import Log from "../../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {GitHubActions} from "./GitHubActions";
import {PersonController} from "./PersonController";

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

        if (typeof personId === 'undefined' || personId === null || typeof token === 'undefined' || token === null) {
            // invalid person
            // these are never valid; this would be caught below, but this is just to be extra cautious
            Log.trace("AuthController::isValid( " + personId + ", ... ) - false; undefined | null encoutered");
            return false;
        }

        const pc = new PersonController();
        const person = await pc.getPerson(personId);
        Log.trace("AuthController::isValid( " + personId + ", ... ) - person: " + JSON.stringify(person));
        if (person !== null) {
            // person exists
            const valid = await this.verifyToken(personId, token);
            Log.trace("AuthController::isValid( " + personId + ", ... ) - " + valid + "; !null person");
            return valid;
        } else {
            // person does not exist
            Log.trace("AuthController::isValid( " + personId + ", ... ) - false; null person");
            return false;
        }
    }

    public async isPrivileged(personId: string, token: string): Promise<{isAdmin: boolean, isStaff: boolean}> {
        Log.trace("AuthController::isPrivileged( " + personId + ", ... ) - start");
        const pc = new PersonController();
        const dc = DatabaseController.getInstance();
        const person = await pc.getPerson(personId);
        if (person !== null) {
            const valid = await this.isValid(personId, token);
            if (valid === true) {
                Log.trace("AuthController::isPrivileged( " + personId + ", ... ) - person.kind: " + person.kind);

                if (person.kind === null || person.kind === '') {
                    // check github for credentials and cache them
                    const isStaff = await new GitHubActions().isOnStaffTeam(personId);
                    const isAdmin = await new GitHubActions().isOnAdminTeam(personId);
                    Log.trace("AuthController::isPrivileged( " + personId + ", ... ) - " +
                        " caching new credentials; admin: " + isAdmin + "; staff: " + isStaff);

                    if (isStaff === true && isAdmin === true) {
                        person.kind = 'adminstaff';
                        await dc.writePerson(person);
                    } else if (isStaff === true) {
                        person.kind = 'staff';
                        await dc.writePerson(person);
                    } else if (isAdmin === true) {
                        person.kind = 'admin';
                        await dc.writePerson(person);
                    } else {
                        // shouldn't happen: students shouldn't have null kind
                        person.kind = 'student';
                        await dc.writePerson(person);
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
        if (typeof personId !== 'undefined' && personId !== null) {
            const pc = new PersonController();
            const person = await pc.getPerson(personId);

            if (person === null) {
                Log.trace("AuthController::removeAuthentication() - person does not exist");
                return false; // just say it worked although nothing happened
            } else {
                if (person.kind !== 'student') {
                    // Students stay students _forever_
                    // This is just a safe option.
                    // Students do become TAs during the term for courses they were already students in.
                    person.kind = null;
                    await pc.writePerson(person);
                }

                const auth = await this.dc.getAuth(personId);
                await this.dc.deleteAuth(auth);
                Log.info("AuthController::removeAuthentication( " + personId + " ) - done");
                return true;
            }
        }
        Log.error("AuthController::removeAuthentication() - no person provided");
        return false; // if it doesn't throw an exception it must have worked enough
    }

    private async verifyToken(personId: string, token: string): Promise<boolean> {
        Log.trace("AuthController::verifyToken( " + personId + " ) - start");
        const auth = await this.dc.getAuth(personId);
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

}
