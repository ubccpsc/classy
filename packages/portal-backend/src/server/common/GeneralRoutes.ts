import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {ConfigTransportPayload} from '../../../../common/types/PortalTypes';
import Config, {ConfigKey} from '../../../../common/Config';

export default class GeneralRoutes implements IREST {

    public constructor() {
    }

    public registerRoutes(server: restify.Server) {
        Log.trace('GeneralRoutes::registerRoutes() - start');

        // returns the org that the backend is currently configured to serve
        // mainly used by the frontend so it uses the correct UI
        server.get('/portal/config', GeneralRoutes.getConfig);
    }

    public static getConfig(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getConfig(..) - start');

        // const org = CourseController.getOrg();
        // const name = CourseController.getName();
        const org = Config.getInstance().getProp(ConfigKey.org);
        const name = Config.getInstance().getProp(ConfigKey.name);

        let payload: ConfigTransportPayload;
        if (org !== null) {
            payload = {success: {org: org, name: name}};
            Log.trace('GeneralRoutes::getConfig(..) - sending: ' + JSON.stringify(payload));
            res.send(200, payload);
        } else {
            payload = {failure: {message: 'Unable to retrieve config (server error)', shouldLogout: false}};
            res.send(400, payload);
        }
    }

}
