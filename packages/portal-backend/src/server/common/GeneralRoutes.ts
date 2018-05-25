import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {CourseController} from "../../controllers/CourseController";

export default class GeneralRoutes implements IREST {

    public constructor() {
    }

    public registerRoutes(server: restify.Server) {
        Log.trace("GeneralRoutes::registerRoutes() - start");

        // returns the org that the backend is currently configured to serve
        // mainly used by the frontend so it uses the correct UI
        server.get('/org', GeneralRoutes.getOrg);
    }

    public static getOrg(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getOrg(..) - start');

        const org = CourseController.getOrg();
        if (org !== null) {
            res.send({org: org});
        } else {
            res.send(400, {failure: {message: 'Unable to retrieve org (server error)'}});
        }
    }
}
