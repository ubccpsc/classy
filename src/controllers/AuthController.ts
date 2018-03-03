import Log from "../util/Log";
import {PersonController} from "./PersonController";
import {DatabaseController} from "./DatabaseController";

export class AuthController {

    public async isValid(org: string, personId: string, token: string): Promise<boolean> {
        Log.trace("AuthController::isValid( " + org + ", " + personId + ", ... ) - start");
        let person = new PersonController().getPerson(org, personId);
        if (person !== null) {
            let dc = DatabaseController.getInstance();
            let valid = await dc.verifyAuthToken(org, personId, token);
            return valid;
        }
        return false;
    }

    public async isAdmin(org: string, personId: string, token: string): Promise<boolean> {
        Log.trace("AuthController::isAdmin( " + org + ", " + personId + ", ... ) - start");
        let person = await new PersonController().getPerson(org, personId);
        if (person !== null) {
            let valid = await this.isValid(org, personId, token);
            if (valid === true) {
                // student, ta, prof, ops
                if (person.kind === "ta" || person.kind === "prof" || person.kind === "ops") {
                    return true;
                }
            }
        }
        return false;
    }

}