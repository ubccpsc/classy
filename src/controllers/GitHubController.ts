import {DatabaseController} from "./DatabaseController";
import Log from "../util/Log";


export class GitHubController {

    private dc = DatabaseController.getInstance();

    public createD0repository(org: string, personId: string) {

    }

    public createD1repository(org: string, teamId: string) {
        // check that the team exists
        // make sure any team members have d0 grade > 60
        // make sure any team members do not already have d1 repos
    }

    public createD3pr(org: string, repoId: string) {

    }

    public async getStatus(org: string, personId: string): Promise<string> {
        Log.info("XXX::getStatus( " + org + ', ' + personId + ' ) - start');
        const person = await this.dc.getPerson(org, personId);
        if (person === null) {
            Log.info("XXX::getStatus(..) - ERROR; person null");
            return;
        }

        let currentStatus = person.custom.sddmStatus;

        // D0PRE
        if (currentStatus === "D0PRE") {
            // make sure d0 doesn't exist for a person, if it does, make them D0
            const d0Repo = await this.dc.getRepository(org, "d0_" + personId);
            if (d0Repo !== null) {
                Log.info("XXX::getStatus(..) - elevating D0PRE to D0");
                currentStatus = "D0";
            } else {
                Log.info("XXX::getStatus(..) - NOT elevating from D0PRE");
            }
        }

        // D0
        if (currentStatus === "D0") {
            // if their d0 score >= 60, make them D1UNLOCKED
            const d0Grade = await this.dc.getGrade(org, personId, "d0");
            if (d0Grade.score >= 60) {
                Log.info("XXX::getStatus(..) - elevating D0 to D1UNLOCKED");
                currentStatus = "D1UNLOCKED";
            } else {
                Log.info("XXX::getStatus(..) - NOT elevating from D0");
            }
        }

        // D1UNLOCKED
        if (currentStatus === "D1UNLOCKED") {
            // if they have a d1 team, make them D1TEAMSET
            const teams = await this.dc.getTeamsForPerson(org,personId);
            
            // XXX: check to see if one of them is a d0 team
        }

        // D1TEAMSET
        if (currentStatus === "D1TEAMSET") {
            // if they have a d1 repo, make them D1
        }

        // D1
        if (currentStatus === "D1") {
            // if their d1 score > 60, make them D2
        }

        // D2
        if (currentStatus === "D2") {
            // if their d2 core > 60, make them D3PRE
        }

        // D3PRE
        if (currentStatus === "D3PRE") {
            // if their d1 repo has custom.sddmD3pr===true, make them D3
        }

        // D3
        // nothing else to be done
    }
}