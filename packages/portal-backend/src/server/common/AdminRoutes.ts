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

        // student list visible to all privileged users
        server.get('/admin/students', AdminRoutes.isPrivileged, AdminRoutes.getStudents);

        // posting a class list is admin only
        server.post('/admin/classlist', AdminRoutes.isAdmin, AdminRoutes.postClasslist);
    }

    /**
     * Handler that succeeds if the user is privileged (admin || staff).
     *
     * @param req
     * @param res
     * @param next
     */
    private static isPrivileged(req: any, res: any, next: any) {
        Log.info('AdminRoutes::isPrivileged(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        ac.isPrivileged(user, token).then(function (priv) {
                Log.trace('AdminRoutes::isPrivileged(..) - in isPrivileged: ' + JSON.stringify(priv));
                if (priv.isStaff === true || priv.isAdmin === true) {
                    return next();
                } else {
                    res.send(401, {
                        failure: {
                            message:      'Authorization error; user not priviliged',
                            shouldLogout: false
                        }
                    });
                    return next(false);
                }
            }
        ).catch(function (err) {
            Log.error('AdminRoutes::isPrivileged(..) - ERROR: ' + err.message);
            res.send(401, {
                failure: {
                    message:      'Authorization error; user not priviliged',
                    shouldLogout: false
                }
            });
            return next(false);
        });
    }


    /**
     * Handler that succeeds if the user is staff.
     *
     * @param req
     * @param res
     * @param next
     */
    private static isStaff(req: any, res: any, next: any) {
        Log.info('AdminRoutes::isStaff(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        ac.isPrivileged(user, token).then(function (priv) {
                Log.trace('AdminRoutes::isPrivileged(..) - in isStaff: ' + JSON.stringify(priv));
                if (priv.isStaff === true) {
                    return next();
                } else {
                    res.send(401, {
                        failure: {
                            message:      'Authorization error; user not staff.',
                            shouldLogout: false
                        }
                    });
                    return next(false);
                }
            }
        ).catch(function (err) {
            Log.error('AdminRoutes::isStaff(..) - ERROR: ' + err.message);
            res.send(401, {
                failure: {
                    message:      'Authorization error; user not staff.',
                    shouldLogout: false
                }
            });
            return next(false);
        });
    }

    /**
     * Handler that succeeds if the user is admin.
     *
     * @param req
     * @param res
     * @param next
     */
    private static isAdmin(req: any, res: any, next: any) {
        Log.info('AdminRoutes::isAdmin(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        ac.isPrivileged(user, token).then(function (priv) {
                Log.trace('AdminRoutes::isAdmin(..) - in isStaff: ' + JSON.stringify(priv));
                if (priv.isAdmin === true) {
                    return next();
                } else {
                    res.send(401, {
                        failure: {
                            message:      'Authorization error; user not admin.',
                            shouldLogout: false
                        }
                    });
                    return next(false);
                }
            }
        ).catch(function (err) {
            Log.error('AdminRoutes::isAdmin(..) - ERROR: ' + err.message);
            res.send(401, {
                failure: {
                    message:      'Authorization error; user not admin.',
                    shouldLogout: false
                }
            });
            return next(false);
        });
    }

    /**
     * Returns a StudentTransportPayload.
     *
     * @param req
     * @param res
     * @param next
     */
    private static getStudents(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getStudents(..) - start');

        const cc = new CourseController(new GitHubController());
        cc.getStudents().then(function (students) {
            Log.trace('AdminRoutes::getStudents(..) - in then; # students: ' + students.length);
            const payload: StudentTransportPayload = {success: students};
            res.send(payload);
            return next();
        }).catch(function (err) {
            Log.error('AdminRoutes::getStudents(..) - ERROR: ' + err.message);
            const payload: StudentTransportPayload = {
                failure: {
                    message:      'Unable to retrieve student list; ERROR: ' + err.message,
                    shouldLogout: false
                }
            };
            res.send(400, payload);
            return next(false);
        });
    }

    private static postClasslist(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postClasslist(..) - start');
    }
}
