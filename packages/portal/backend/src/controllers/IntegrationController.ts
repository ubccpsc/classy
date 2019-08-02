import * as rp from "request-promise-native";
import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";

import {ClasslistTransport} from "../../../../common/types/PortalTypes";
import Util from "../../../../common/Util";

import {DatabaseController} from "./DatabaseController";
import {GitHubActions, IGitHubActions} from "./GitHubActions";

export class IntegrationController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async fetchClasslist(): Promise<ClasslistTransport[]> {
        Log.info("IntegrationController::fetchClasslist - start");
        try {
            const uri = this.getClasslistUri();
            const options = {
                uri,
                rejectUnauthorized: false
            };

            return JSON.parse(await rp(options));
        } catch (err) {
            Log.error("IntegrationController::fetchClasslist - ERROR: " + err);
            throw new Error("Could not fetch Classlist " + err.message);
        }
    }

    private getClasslistUri() {
        const config = Config.getInstance();
        const hostname = config.getProp(ConfigKey.classlist_hostname).trim();
        const courseNum = config.getProp(ConfigKey.classlist_course_num).trim();
        const year = config.getProp(ConfigKey.classlist_year).trim();
        const semester = config.getProp(ConfigKey.classlist_semester).toUpperCase().trim().charAt(0);
        const sections = config.getProp(ConfigKey.classlist_sections).trim();
        const username = config.getProp(ConfigKey.classlist_username).trim();
        const password = config.getProp(ConfigKey.classlist_password).trim();
        return 'https://' + username + ':' + password + '@' + hostname + '/classlist1.0/CPSC/' + courseNum + '/'
            + year + semester + '/' + sections;
    }
}
