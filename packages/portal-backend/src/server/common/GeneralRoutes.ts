import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {CourseController} from "../../controllers/CourseController";
import {OrgTransportPayload} from '../../../../common/types/PortalTypes';

export default class GeneralRoutes implements IREST {

    public constructor() {
    }

    public registerRoutes(server: restify.Server) {
        Log.trace('GeneralRoutes::registerRoutes() - start');

        // returns the org that the backend is currently configured to serve
        // mainly used by the frontend so it uses the correct UI
        server.get('/org', GeneralRoutes.getOrg);
    }

    public static getOrg(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getOrg(..) - start');

        const org = CourseController.getOrg();
        let payload: OrgTransportPayload;
        if (org !== null) {
            payload = {success: {org: org}};
            Log.trace('GeneralRoutes::getOrg(..) - sending: ' + JSON.stringify(payload));
            res.send(200, payload);
        } else {
            payload = {failure: {message: 'Unable to retrieve org (server error)', shouldLogout: false}};
            res.send(400, payload);
        }
    }

}
