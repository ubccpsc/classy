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
        const auth = config.getProp(ConfigKey.classlist_username).trim() + ':' + config.getProp(ConfigKey.classlist_password).trim();
        const uri = config.getProp(ConfigKey.classlist_uri).trim();

        if (uri.indexOf('https://') === 0) {
            return 'https://' + auth + '@' + uri.slice(8);
        } else {
            throw new Error('https:// protocol is required for API integration');
        }
    }
}
