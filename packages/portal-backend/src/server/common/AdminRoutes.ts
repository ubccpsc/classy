import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {AuthController} from "../../controllers/AuthController";
import {CourseController} from "../../controllers/CourseController";
import {GitHubController} from "../../controllers/GitHubController";
import {StudentTransportPayload} from '../../../../common/types/PortalTypes';

export default class AdminRoutes implements IREST {

    public constructor() {
    }

    public registerRoutes(server: restify.Server) {
        Log.trace('AdminRoutes::registerRoutes() - start');

        // returns the org that the backend is currently configured to serve
        // mainly used by the frontend so it uses the correct UI
        server.get('/admin/students', AdminRoutes.getStudents);
    }

    /**
     * Returns a StudentTransportPayload.
     *
     * @param req
     * @param res
     * @param next
     */
    public static getStudents(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getStudents(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        const cc = new CourseController(new GitHubController());
        ac.isPrivileged(user, token).then(function (priv) {
            Log.trace('AdminRoutes::getStudents(..) - in isPrivileged: ' + JSON.stringify(priv));
            if (priv.isStaff === true || priv.isAdmin === true) {
                return cc.getStudents();
            } else {
                throw new Error('Insufficient privileges');
            }
        }).then(function (students) {
            Log.trace('AdminRoutes::getStudents(..) - in then; # students: ' + students.length);
            const payload: StudentTransportPayload = {success: students};
            res.send(payload);
        }).catch(function (err) {
            Log.error('AdminRoutes::getStudents(..) - ERROR: ' + err.message);
            const payload: StudentTransportPayload = {
                failure: {
                    message:      'Unable to retrieve student list; ERROR: ' + err.message,
                    shouldLogout: false
                }
            };
            res.send(400, payload);
        });

    }

}
