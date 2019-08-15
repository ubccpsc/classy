import * as rp from "request-promise-native";
import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {ClasslistTransport} from "../../../../common/types/PortalTypes";
import Util from "../../../../common/Util";

import {DatabaseController} from "./DatabaseController";
import {GitHubActions, IGitHubActions} from "./GitHubActions";

export class IntegrationController {

    private db: DatabaseController = DatabaseController.getInstance();

}
