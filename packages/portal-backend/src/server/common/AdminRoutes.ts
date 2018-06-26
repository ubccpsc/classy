import restify = require('restify');
import Log from "../../../../common/Log";

import * as fs from 'fs';
import * as parse from 'csv-parse';

import IREST from "../IREST";
import {AuthController} from "../../controllers/AuthController";
import {CourseController} from "../../controllers/CourseController";
import {GitHubController} from "../../controllers/GitHubController";
import {Payload, StudentTransportPayload} from '../../../../common/types/PortalTypes';
import {Person} from "../../Types";
import {PersonController} from "../../controllers/PersonController";

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
                Log.trace('AdminRoutes::isAdmin(..) - in isAdmin: ' + JSON.stringify(priv));
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

        try {
            let files = req.files;
            let classlist = files.classlist;

            let rs = fs.createReadStream(classlist.path);
            const options = {
                columns:          true,
                skip_empty_lines: true,
                trim:             true,
            };

            const parser = parse(options, (err, data) => {
                if (err) {
                    Log.error('AdminRoutes::postClasslist(..) - parse ERROR: ' + err);
                    const payload: Payload = {
                        failure: {
                            message:      'Unable to parse classlist; ERROR: ' + err,
                            shouldLogout: false
                        }
                    };
                    res.send(400, payload);
                    return next();
                } else {
                    Log.info('AdminRoutes::postClasslist(..) - parse successful');
                    const pc = new PersonController();
                    for (const row of data) {
                        Log.trace(JSON.stringify(row));
                        let p: Person = {
                            id: row.ACCT, // id is CSID since this cannot be changed

                            csId:          row.ACCT,
                            githubId:      row.CWL,
                            studentNumber: row.SNUM,
                            fName:         row.FIRST,
                            lName:         row.LAST,

                            kind:   'student',
                            URL:    null,
                            labId:  row.LAB,
                            custom: {}
                        };
                        pc.createPerson(p);
                        // TODO: would be nice to keep track of # updates, # deleted, and # created here
                    }

                    res.send(200, {success: {message: 'Classlist upload successful'}});
                    Log.info('AdminRoutes::postClasslist(..) - end');
                }
            });

            rs.pipe(parser);
        } catch (err) {
            Log.error('AdminRoutes::postClasslist(..) - ERROR: ' + err);
            const payload: Payload = {
                failure: {
                    message:      'Unable to post classlist; ERROR: ' + err,
                    shouldLogout: false
                }
            };
            res.send(400, payload);
            return next();
        }

    }
}
