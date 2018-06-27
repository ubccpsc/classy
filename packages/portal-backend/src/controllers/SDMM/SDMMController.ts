import {CourseController} from "../CourseController";
import {IGitHubController} from "../GitHubController";
import {Person} from "../../Types";

import Log from "../../../../common/Log";
import Config, {ConfigKey} from "../../../../common/Config";

export class SDMMController extends CourseController {

    public constructor(ghController: IGitHubController) {
        super(ghController);
    }

    public async handleUnknownUser(githubUsername: string): Promise<Person | null> {
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("SDDMController::handleUnknownUser( " + org + ", " + githubUsername + " ) - start");
        if (org === 'secapstone' || org === 'secapstonetest') {
            Log.info("SDDMController::handleUnknownUser(..) - new person for this org; - provisioning");

            // in the secapstone we don't know who the students are in advance
            // in this case, we will create Person objects on demand

            // make person
            let newPerson: Person = {
                id:            githubUsername,
                csId:          githubUsername, // sdmm doesn't have these
                githubId:      githubUsername,
                studentNumber: null,

                // org:    org,
                fName:  '',
                lName:  '',
                kind:   'student',
                URL:    'https://github.com/' + githubUsername, // HARDCODE
                labId:  'UNKNOWN',
                custom: {}
            };

            newPerson.custom.sdmmStatus = 'd0pre'; // new users always start in d0pre state

            // add to database
            await this.dc.writePerson(newPerson);
            return newPerson;
        }

        Log.error("SDDMController::handleUnknownUser() - not a SDDM org");
        return null;
    }

}