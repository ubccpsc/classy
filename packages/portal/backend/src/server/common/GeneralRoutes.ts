import restify = require('restify');
import Log from "../../../../../common/Log";

import IREST from "../IREST";
import {ConfigTransportPayload, GradeTransport, GradeTransportPayload, Payload} from '../../../../../common/types/PortalTypes';
import Config, {ConfigKey} from '../../../../../common/Config';
import {AuthController} from "../../controllers/AuthController";
import {GradesController} from "../../controllers/GradesController";

export default class GeneralRoutes implements IREST {

    public constructor() {
    }

    public registerRoutes(server: restify.Server) {
        Log.trace('GeneralRoutes::registerRoutes() - start');

        // returns the org that the backend is currently configured to serve
        // mainly used by the frontend so it uses the correct UI
        server.get('/portal/config', GeneralRoutes.getConfig);

        server.get('/portal/grades', GeneralRoutes.getGrades);
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

    public static getGrades(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getGrades(..) - start');

        const org = Config.getInstance().getProp(ConfigKey.org);
        const name = Config.getInstance().getProp(ConfigKey.name);
        const user = req.headers.user;
        const token = req.headers.token;

        const handleError = function (code: number, msg: string) {
            Log.info('GeneralRoutes::getGrades(..) - ERROR: ' + msg); // intentionally info
            const payload: Payload = {failure: {message: msg, shouldLogout: false}};
            res.send(code, payload);
            return next(false);
        };

        const ac = new AuthController();
        const gc: GradesController = new GradesController();
        ac.isValid(user, token).then(function (isValid) {
            Log.trace('GeneralRoutes::getGrades(..) - in isValid: ' + isValid);
            if (isValid === true) {
                return gc.getReleasedGradesForPerson(user);
            } else {
                return handleError(401, 'Authorization error; user not valid');
            }
        }).then(function (grades) {
            const gradeTrans: GradeTransport[] = [];
            for (const grade of grades) {
                gradeTrans.push(gc.translateGrade(grade));
            }
            const payload: GradeTransportPayload = {success: gradeTrans};
            res.send(200, payload);
        }).catch(function (err) {
            Log.error('GeneralRoutes::getGrades(..) - ERROR: ' + err.message);
            return handleError(400, 'Error retrieving grades.');
        });
    }

}
