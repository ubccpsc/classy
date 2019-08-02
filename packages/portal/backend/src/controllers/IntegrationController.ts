import * as rp from "request-promise-native";
import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";

import {ClasslistTransport} from "../../../../common/types/PortalTypes";
import Util from "../../../../common/Util";

import {DatabaseController} from "./DatabaseController";
import {GitHubActions, IGitHubActions} from "./GitHubActions";

export class IntegrationController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async fetchClasslist() {
        Log.info("IntegrationController::fetchClasslist - start");
        try {
            const config = Config.getInstance();
            const uri = config.getProp(ConfigKey.classlist_test_url);
            const credentials = config.getProp(ConfigKey.classlist_username) + ':'
             + config.getProp(ConfigKey.classlist_password);
            const buffer = new Buffer(credentials).toString('base64');
            const options = {
                uri:     uri,
                headers: {
                    Authorization: 'Basic ' + new Buffer(credentials).toString('base64'),
                    Accept:        'application/json'
                }
            };
            return rp(options);
        } catch (err) {
            Log.error("IntegrationController::fetchClasslist - ERROR: " + err);
            throw new Error("Could not fetch Classlist " + err.message);
        }
    }
}
