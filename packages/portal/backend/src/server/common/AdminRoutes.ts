import * as parse from 'csv-parse';
import * as fs from 'fs';
import * as restify from 'restify';

import Log from "../../../../../common/Log";
import {
    AutoTestResultSummaryPayload,
    CourseTransport,
    CourseTransportPayload,
    DeliverableTransport,
    DeliverableTransportPayload,
    GradeTransportPayload,
    Payload,
    RepositoryPayload,
    StudentTransportPayload,
    TeamTransportPayload
} from '../../../../../common/types/PortalTypes';

import {AuthController} from "../../controllers/AuthController";
import {CourseController} from "../../controllers/CourseController";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {GitHubController} from "../../controllers/GitHubController";
import {PersonController} from "../../controllers/PersonController";

import {Person} from "../../Types";

import IREST from "../IREST";

export default class AdminRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.trace('AdminRoutes::registerRoutes() - start');

        // visible to non-privileged users
        // NOTHING

        // visible to all privileged users
        server.get('/portal/admin/course', AdminRoutes.isPrivileged, AdminRoutes.getCourse);
        server.get('/portal/admin/deliverables', AdminRoutes.isPrivileged, AdminRoutes.getDeliverables);
        server.get('/portal/admin/students', AdminRoutes.isPrivileged, AdminRoutes.getStudents);
        server.get('/portal/admin/teams', AdminRoutes.isPrivileged, AdminRoutes.getTeams);
        server.get('/portal/admin/repositories', AdminRoutes.isPrivileged, AdminRoutes.getRepositories);
        server.get('/portal/admin/grades', AdminRoutes.isPrivileged, AdminRoutes.getGrades);
        server.get('/portal/admin/results/:delivId/:repoId', AdminRoutes.isPrivileged, AdminRoutes.getResults); // result summaries
        // server.get('/portal/admin/dashboard', AdminRoutes.isPrivileged, AdminRoutes.getDashboard); // detailed results

        // admin-only functions
        server.post('/portal/admin/classlist', AdminRoutes.isAdmin, AdminRoutes.postClasslist);
        server.post('/portal/admin/deliverable', AdminRoutes.isAdmin, AdminRoutes.postDeliverable);
        server.post('/portal/admin/course', AdminRoutes.isAdmin, AdminRoutes.postCourse);

        // staff-only functions
        // NOTHING
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

        const handleError = function(msg: string) {
            Log.info('AdminRoutes::isPrivileged(..) - ERROR: ' + msg); // intentionally info
            res.send(401, {failure: {message: msg, shouldLogout: false}});
            return next(false);
        };

        const ac = new AuthController();
        ac.isPrivileged(user, token).then(function(priv) {
            Log.trace('AdminRoutes::isPrivileged(..) - in isPrivileged: ' + JSON.stringify(priv));
            if (priv.isStaff === true || priv.isAdmin === true) {
                return next();
            } else {
                return handleError('Authorization error; user not priviliged');
            }
        }).catch(function(err) {
            Log.error('AdminRoutes::isPrivileged(..) - ERROR: ' + err.message);
            return handleError('Authorization error; user not priviliged');
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

        const handleError = function(msg: string) {
            Log.info('AdminRoutes::isAdmin(..) - ERROR: ' + msg); // intentionally info
            res.send(401, {failure: {message: msg, shouldLogout: false}});
            return next(false);
        };

        const ac = new AuthController();
        ac.isPrivileged(user, token).then(function(priv) {
                Log.trace('AdminRoutes::isAdmin(..) - in isAdmin: ' + JSON.stringify(priv));
                if (priv.isAdmin === true) {
                    return next();
                } else {
                    return handleError('Authorization error; user not admin.');
                }
            }
        ).catch(function(err) {
            Log.error('AdminRoutes::isAdmin(..) - ERROR: ' + err.message);
            return handleError('Authorization error; user not admin.');
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

        const handleError = function(code: number, msg: string) {
            const payload: Payload = {failure: {message: msg, shouldLogout: false}};
            res.send(code, payload);
            return next(false);
        };

        const cc = new CourseController(new GitHubController());
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getStudents().then(function(students) {
            Log.trace('AdminRoutes::getStudents(..) - in then; # students: ' + students.length);
            const payload: StudentTransportPayload = {success: students};
            res.send(payload);
            return next();
        }).catch(function(err) {
            Log.error('AdminRoutes::getStudents(..) - ERROR: ' + err.message);
            return handleError(400, 'Unable to retrieve student list.');
        });
    }

    /**
     * Returns a TeamsTransportPayload.
     *
     * @param req
     * @param res
     * @param next
     */
    private static getTeams(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getTeams(..) - start');

        const handleError = function(code: number, msg: string) {
            const payload: Payload = {failure: {message: msg, shouldLogout: false}};
            res.send(code, payload);
            return next(false);
        };

        const cc = new CourseController(new GitHubController());
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getTeams().then(function(teams) {
            Log.trace('AdminRoutes::getTeams(..) - in then; # teams: ' + teams.length);
            const payload: TeamTransportPayload = {success: teams};
            res.send(payload);
            return next();
        }).catch(function(err) {
            Log.error('AdminRoutes::getTeams(..) - ERROR: ' + err.message);
            return handleError(400, 'Unable to retrieve team list.');
        });
    }

    private static getRepositories(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getRepositories(..) - start');

        const handleError = function(code: number, msg: string) {
            const payload: Payload = {failure: {message: msg, shouldLogout: false}};
            res.send(code, payload);
            return next(false);
        };

        const cc = new CourseController(new GitHubController());
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getRepositories().then(function(repos) {
            Log.trace('AdminRoutes::getRepositories(..) - in then; # repos: ' + repos.length);
            const payload: RepositoryPayload = {success: repos};
            res.send(payload);
            return next();
        }).catch(function(err) {
            Log.error('AdminRoutes::getRepositories(..) - ERROR: ' + err.message);
            return handleError(400, 'Unable to retrieve repository list.');
        });
    }

    /**
     * Returns a AutoTestResultPayload.
     *
     * @param req
     * @param res
     * @param next
     */
    private static getResults(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getResults(..) - start');
        const cc = new CourseController(new GitHubController());

        const handleError = function(code: number, msg: string) {
            const payload: Payload = {failure: {message: msg, shouldLogout: false}};
            res.send(code, payload);
            return next(false);
        };

        let delivId = null;
        if (typeof req.params.delivId !== 'undefined') {
            delivId = req.params.delivId;
            if (delivId === 'any') {
                delivId = '*';
            }
        }

        let repoId = null;
        if (typeof req.params.repoId !== 'undefined') {
            repoId = req.params.repoId;
            if (repoId === 'any') {
                repoId = '*';
            }
        }

        // handled by preceeding action in chain above (see registerRoutes)
        cc.getResults(delivId, repoId).then(function(results) {
            Log.trace('AdminRoutes::getResults(..) - in then; # results: ' + results.length);
            const payload: AutoTestResultSummaryPayload = {success: results};
            res.send(payload);
            return next();
        }).catch(function(err) {
            Log.error('AdminRoutes::getResults(..) - ERROR: ' + err.message);
            return handleError(400, 'Unable to retrieve team list.');
        });
    }

    /**
     * Returns a GradeTransportPayload.
     *
     * @param req
     * @param res
     * @param next
     */
    private static getGrades(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getGrades(..) - start');

        const handleError = function(code: number, msg: string) {
            const payload: Payload = {failure: {message: msg, shouldLogout: false}};
            res.send(code, payload);
            return next(false);
        };

        const cc = new CourseController(new GitHubController());
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getGrades().then(function(grades) {
            Log.trace('AdminRoutes::getGrades(..) - in then; # teams: ' + grades.length);
            const payload: GradeTransportPayload = {success: grades};
            res.send(payload);
            return next();
        }).catch(function(err) {
            Log.error('AdminRoutes::getGrades(..) - ERROR: ' + err.message);
            return handleError(400, 'Unable to retrieve team list.');
        });
    }

    /**
     * Returns a StudentTransportPayload.
     *
     * @param req
     * @param res
     * @param next
     */
    private static getDeliverables(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getDeliverables(..) - start');

        const cc = new CourseController(new GitHubController());
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getDeliverables().then(function(delivs) {
            Log.trace('AdminRoutes::getDeliverables(..) - in then; # deliverables: ' + delivs.length);
            const payload: DeliverableTransportPayload = {success: delivs};
            res.send(payload);
            return next();
        }).catch(function(err) {
            Log.error('AdminRoutes::getDeliverables(..) - ERROR: ' + err.message);
            const payload: Payload = {failure: {message: 'Unable to deliverable list; ERROR: ' + err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    private static postClasslist(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postClasslist(..) - start');

        // handled by preceeding action in chain above (see registerRoutes)

        const handleError = function(msg: string) {
            Log.error('AdminRoutes::postClasslist(..)::handleError - message: ' + msg);
            const payload: Payload = {
                failure: {
                    message:      msg,
                    shouldLogout: false
                }
            };
            res.send(400, payload);
            return next();
        };

        try {
            const files = req.files;
            const classlist = files.classlist;

            const rs = fs.createReadStream(classlist.path);
            const options = {
                columns:          true,
                skip_empty_lines: true,
                trim:             true
            };

            const parser = parse(options, (err, data) => {
                if (err) {
                    const msg = 'Class list parse error: ' + err;
                    return handleError(msg);
                } else {
                    Log.info('AdminRoutes::postClasslist(..) - parse successful');
                    const pc = new PersonController();

                    const people: Array<Promise<Person>> = [];
                    for (const row of data) {
                        // Log.trace(JSON.stringify(row));
                        if (typeof row.ACCT !== 'undefined' && typeof row.CWL !== 'undefined' &&
                            typeof row.SNUM !== 'undefined' && typeof row.FIRST !== 'undefined' &&
                            typeof row.LAST !== 'undefined' && typeof row.LAB !== 'undefined') {
                            const p: Person = {
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
                            people.push(pc.createPerson(p));
                        } else {
                            Log.info('AdminRoutes::postClasslist(..) - column missing from: ' + JSON.stringify(row));
                            people.push(Promise.reject('Required column missing'));
                        }
                    }

                    Promise.all(people).then(function() {
                        if (people.length > 0) {
                            res.send(200, {success: {message: 'Class list upload successful. ' + people.length + ' students processed.'}});
                            Log.info('AdminRoutes::postClasslist(..) - end');
                        } else {
                            const msg = 'Class list upload not successful; no students were processed from CSV.';
                            return handleError(msg);
                        }
                    }).catch(function(errInner) {
                        return handleError('Class list upload error: ' + errInner);
                    });
                }
            });

            rs.pipe(parser);
        } catch (err) {
            Log.error('AdminRoutes::postClasslist(..) - ERROR: ' + err);
            return handleError('Class list upload unsuccessful: ' + err);
        }
    }

    private static postDeliverable(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postDeliverable(..) - start');
        let payload: Payload;

        // isValid handled by preceeding action in chain above (see registerRoutes)

        const handleError = function(msg: string) {
            Log.error('AdminRoutes::postDeliverable(..)::handleError - message: ' + msg);
            payload = {failure: {message: msg, shouldLogout: false}};
            res.send(400, payload);
            return next();
        };

        const delivTrans: DeliverableTransport = req.params;
        Log.info('AdminRoutes::postDeliverable() - body: ' + delivTrans);
        AdminRoutes.handlePostDeliverable(delivTrans).then(function(success) {
            Log.info('AdminRoutes::postDeliverable() - done');
            payload = {success: {message: 'Deliverable saved successfully'}};
            res.send(200, payload);
        }).catch(function(err) {
            handleError(err.message);
        });
    }

    private static async handlePostDeliverable(delivTrans: DeliverableTransport): Promise<boolean> {
        const dc = new DeliverablesController();
        const result = dc.validateDeliverableTransport(delivTrans);
        if (result === null) {
            const deliv = dc.transportToDeliverable(delivTrans);
            if (deliv.teamPrefix === '') {
                deliv.teamPrefix = 't_' + deliv.id;
            }
            if (deliv.repoPrefix === '') {
                deliv.repoPrefix = deliv.id;
            }
            const saveSucceeded = await dc.saveDeliverable(deliv);
            if (saveSucceeded !== null) {
                // worked (would have returned a Deliverable)
                return true;
            }
        }
        // should never get here unless something went wrong
        throw new Error("Deliverable not saved.");
    }

    /**
     * Retrieves the course object.
     *
     * @param req
     * @param res
     * @param next
     */
    private static getCourse(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getCourse(..) - start');

        const cc = new CourseController(new GitHubController());
        cc.getCourse().then(function(course) {
            Log.trace('AdminRoutes::getCourse(..) - in then');

            const payload: CourseTransportPayload = {success: course};
            res.send(payload);
            return next();
        }).catch(function(err) {
            Log.error('AdminRoutes::getCourse(..) - ERROR: ' + err.message);
            const payload: Payload = {failure: {message: 'Unable to retrieve course object; ERROR: ' + err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    private static postCourse(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postCourse(..) - start');
        let payload: Payload;

        const handleError = function(msg: string) {
            Log.error('AdminRoutes::postCourse(..)::handleError - message: ' + msg);
            payload = {failure: {message: msg, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        };

        const courseTrans: CourseTransport = req.params;
        Log.info('AdminRoutes::postCourse() - body: ' + courseTrans);
        AdminRoutes.handlePostCourse(courseTrans).then(function(success) {
            payload = {success: {message: 'Course object saved successfully'}};
            res.send(200, payload);
            return next(true);
        }).catch(function(err) {
            return handleError(err.message);
        });
    }

    private static async handlePostCourse(courseTrans: CourseTransport): Promise<boolean> {
        const cc = new CourseController(new GitHubController());
        const result = CourseController.validateCourseTransport(courseTrans);
        if (result === null) {
            const saveSucceeded = await cc.saveCourse(courseTrans);
            if (saveSucceeded !== null) {
                Log.info('AdminRoutes::handlePostCourse() - done');
                return true;
            }
        }
        // should never get here unless something goes wrong
        throw new Error("Course object not saved.");
    }
}
