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
    ProvisionTransport,
    RepositoryPayload,
    RepositoryTransport,
    StudentTransportPayload,
    TeamFormationTransport,
    TeamTransport,
    TeamTransportPayload
} from '../../../../../common/types/PortalTypes';

import {AuthController} from "../../controllers/AuthController";
import {CourseController} from "../../controllers/CourseController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {GitHubActions} from "../../controllers/GitHubActions";
import {GitHubController} from "../../controllers/GitHubController";
import {PersonController} from "../../controllers/PersonController";
import {TeamController} from "../../controllers/TeamController";
import {Factory} from "../../Factory";

import {AuditLabel, Person} from "../../Types";

import IREST from "../IREST";
import {CSVParser} from "./CSVParser";

export default class AdminRoutes implements IREST {

    private static ghc = new GitHubController(GitHubActions.getInstance());

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
        server.get('/portal/admin/result/:delivId/:repoId/:sha', AdminRoutes.isPrivileged, AdminRoutes.getResult); // result stdio
        server.get('/portal/admin/dashboard/:delivId/:repoId', AdminRoutes.isPrivileged, AdminRoutes.getDashboard); // detailed results

        // admin-only functions
        server.post('/portal/admin/classlist', AdminRoutes.isAdmin, AdminRoutes.postClasslist);
        server.post('/portal/admin/deliverable', AdminRoutes.isAdmin, AdminRoutes.postDeliverable);
        server.post('/portal/admin/team', AdminRoutes.isAdmin, AdminRoutes.postTeam);
        server.post('/portal/admin/course', AdminRoutes.isAdmin, AdminRoutes.postCourse);
        server.post('/portal/admin/provision', AdminRoutes.isAdmin, AdminRoutes.postProvision);
        server.post('/portal/admin/release', AdminRoutes.isAdmin, AdminRoutes.postRelease);
        server.del('/portal/admin/deliverable/:delivId', AdminRoutes.isAdmin, AdminRoutes.deleteDeliverable);
        server.del('/portal/admin/repository/:repoId', AdminRoutes.isAdmin, AdminRoutes.deleteRepository);
        server.del('/portal/admin/team/:teamId', AdminRoutes.isAdmin, AdminRoutes.deleteTeam);

        // TODO: unrelease repos

        // staff-only functions
        // NOTHING
    }

    public static handleError(code: number, msg: string, res: any, next: any) {
        Log.error('AdminRoutes::handleError(..) - ERROR: ' + msg);
        res.send(code, {failure: {message: msg, shouldLogout: false}});
        return next(false);
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
        ac.isPrivileged(user, token).then(function(priv) {
            Log.trace('AdminRoutes::isPrivileged(..) - in isPrivileged: ' + JSON.stringify(priv));
            if (priv.isStaff === true || priv.isAdmin === true) {
                return next();
            } else {
                return AdminRoutes.handleError(401, 'Authorization error; user not privileged', res, next);
            }
        }).catch(function(err) {
            return AdminRoutes.handleError(401, 'Authorization error; user not privileged. ERROR: ' + err.message, res, next);
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
        ac.isPrivileged(user, token).then(function(priv) {
            Log.trace('AdminRoutes::isAdmin(..) - in isAdmin: ' + JSON.stringify(priv));
            if (priv.isAdmin === true) {
                return next();
            } else {
                return AdminRoutes.handleError(401, 'Authorization error; user not admin.', res, next);
            }
        }).catch(function(err) {
            return AdminRoutes.handleError(401, 'Authorization error; user not admin. ERROR: ' + err.message, res, next);
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

        // const handleError = function(code: number, msg: string) {
        //     const payload: Payload = {failure: {message: msg, shouldLogout: false}};
        //     res.send(code, payload);
        //     return next(false);
        // };

        const cc = Factory.getCourseController(AdminRoutes.ghc);
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getStudents().then(function(students) {
            Log.trace('AdminRoutes::getStudents(..) - in then; # students: ' + students.length);
            const payload: StudentTransportPayload = {success: students};
            res.send(payload);
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to retrieve student list. ERROR: ' + err.message, res, next);
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

        const cc = Factory.getCourseController(AdminRoutes.ghc);
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getTeams().then(function(teams) {
            Log.trace('AdminRoutes::getTeams(..) - in then; # teams: ' + teams.length);
            const payload: TeamTransportPayload = {success: teams};
            res.send(payload);
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to retrieve team list. ERROR: ' + err.message, res, next);
        });
    }

    private static getRepositories(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getRepositories(..) - start');

        const cc = Factory.getCourseController(AdminRoutes.ghc);
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getRepositories().then(function(repos) {
            Log.trace('AdminRoutes::getRepositories(..) - in then; # repos: ' + repos.length);
            const payload: RepositoryPayload = {success: repos};
            res.send(payload);
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to retrieve repository list. ERROR: ' + err.message, res, next);
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
        const cc = Factory.getCourseController(AdminRoutes.ghc);

        // if these params are missing the client will get 404 since they are part of the path
        const delivId = req.params.delivId;
        const repoId = req.params.repoId;

        // handled by preceeding action in chain above (see registerRoutes)
        cc.getResults(delivId, repoId).then(function(results) {
            Log.trace('AdminRoutes::getResults(..) - in then; # results: ' + results.length);
            const payload: AutoTestResultSummaryPayload = {success: results};
            res.send(payload);
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to retrieve results. ERROR: ' + err.message, res, next);
        });
    }

    /**
     * Returns a AutoTestResultPayload.
     *
     * @param req
     * @param res
     * @param next
     */
    private static getResult(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getResult(..) - start');
        const cc = Factory.getCourseController(AdminRoutes.ghc);

        // if these params are missing the client will get 404 since they are part of the path
        const delivId = req.params.delivId;
        const repoId = req.params.repoId;
        const sha = req.params.sha;

        // handled by preceeding action in chain above (see registerRoutes)
        cc.getResult(delivId, repoId, sha).then(function(stdio: string) {
            Log.trace('AdminRoutes::getResult(..) - in then; data length: ' + stdio.length);
            res.send(200, stdio); // return as text rather than json
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to retrieve result. ERROR: ' + err.message, res, next);
        });
    }

    /**
     *
     * @param req
     * @param res
     * @param next
     */
    private static deleteDeliverable(req: any, res: any, next: any) {
        Log.info('AdminRoutes::deleteDeliverable(..) - start');
        const cc = Factory.getCourseController(AdminRoutes.ghc);

        // isAdmin prehandler verifies that only valid users can do this

        // if these params are missing the client will get 404 since they are part of the path
        const user = req.params.user;
        const delivId = req.params.delivId;

        AdminRoutes.handleDeleteDeliverable(user, delivId).then(function(success) {
            Log.trace('AdminRoutes::deleteDeliverable(..) - done; success: ' + success);
            const payload: Payload = {success: {message: 'Deliverable deleted.'}};
            res.send(200, payload); // return as text rather than json
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to delete deliverable. ' + err.message, res, next);
        });
    }

    private static async handleDeleteDeliverable(personId: string, delivId: string): Promise<boolean> {
        const dbc = DatabaseController.getInstance();
        const deliv = await dbc.getDeliverable(delivId);
        if (deliv !== null) {
            const worked = await dbc.deleteDeliverable(deliv);
            if (worked === true) {
                await dbc.writeAudit(AuditLabel.DELIVERABLE, personId, deliv, null, {});
            }
            return worked;
        } else {
            throw new Error("Unknown deliverable: " + delivId);
        }
    }

    /**
     *
     * @param req
     * @param res
     * @param next
     */
    private static deleteRepository(req: any, res: any, next: any) {
        Log.info('AdminRoutes::deleteRepository(..) - start');

        // isAdmin prehandler verifies that only valid users can do this

        // if these params are missing the client will get 404 since they are part of the path
        const repoId = req.params.repoId;
        const userId = req.params.userId;

        AdminRoutes.handleDeleteRepository(userId, repoId).then(function(success) {
            Log.trace('AdminRoutes::deleteRepository(..) - done; success: ' + success);
            const payload: Payload = {success: {message: 'Repository deleted.'}};
            res.send(200, payload); // return as text rather than json
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to delete repository. ' + err.message, res, next);
        });
    }

    private static async handleDeleteRepository(personId: string, repoId: string): Promise<boolean> {
        const dbc = DatabaseController.getInstance();
        let worked = false;
        const repo = await dbc.getRepository(repoId);
        if (repo !== null) {
            worked = await dbc.deleteRepository(repo);
            await dbc.writeAudit(AuditLabel.REPOSITORY, personId, repo, null, {});
        } else {
            throw new Error("Unknown repository: " + repoId);
        }

        await GitHubActions.getInstance().deleteRepo(repoId);
        return worked;
    }

    /**
     *
     * @param req
     * @param res
     * @param next
     */
    private static deleteTeam(req: any, res: any, next: any) {
        Log.info('AdminRoutes::deleteTeam(..) - start');

        // isAdmin prehandler verifies that only valid users can do this

        // if these params are missing the client will get 404 since they are part of the path
        const teamId = req.params.teamId;
        const user = req.params.user;

        AdminRoutes.handleDeleteTeam(user, teamId).then(function(success) {
            Log.trace('AdminRoutes::deleteTeam(..) - done; success: ' + success);

            const payload: Payload = {
                success: {
                    message: 'Team ' + teamId + ' deleted; object: ' + success.deletedObject + '; GitHub: ' + success.deletedGithub
                }
            };
            res.send(200, payload); // return as text rather than json
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to delete team. ' + err.message, res, next);
        });
    }

    private static async handleDeleteTeam(personId: string, teamId: string): Promise<{deletedObject: boolean, deletedGithub: boolean}> {
        const dbc = DatabaseController.getInstance();
        let worked = false;

        const team = await dbc.getTeam(teamId);
        if (team !== null) {
            worked = await dbc.deleteTeam(team);
            if (worked === true) {
                await dbc.writeAudit(AuditLabel.TEAM, personId, team, null, {});
            }
        } else {
            throw new Error("Unknown team: " + teamId);
        }

        const deletedGithub = await GitHubActions.getInstance().deleteTeamByName(teamId);
        return {deletedObject: worked, deletedGithub: deletedGithub};
    }

    /**
     * Returns a AutoTestResultPayload.
     *
     * @param req
     * @param res
     * @param next
     */
    private static getDashboard(req: any, res: any, next: any) {
        Log.info('AdminRoutes::getDashboard(..) - start');
        const cc = Factory.getCourseController(AdminRoutes.ghc);

        // if these params are missing the client will get 404 since they are part of the path
        const delivId = req.params.delivId;
        const repoId = req.params.repoId;

        // handled by preceeding action in chain above (see registerRoutes)
        cc.getDashboard(delivId, repoId).then(function(results) {
            Log.trace('AdminRoutes::getDashboard(..) - in then; # results: ' + results.length);
            const payload: AutoTestResultSummaryPayload = {success: results};
            res.send(payload);
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to retrieve dashboard. ERROR: ' + err.message, res, next);
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

        const cc = Factory.getCourseController(AdminRoutes.ghc);
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getGrades().then(function(grades) {
            Log.trace('AdminRoutes::getGrades(..) - in then; # teams: ' + grades.length);
            const payload: GradeTransportPayload = {success: grades};
            res.send(payload);
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to retrieve team list. ERROR: ' + err.message, res, next);
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

        const cc = Factory.getCourseController(AdminRoutes.ghc);
        // handled by preceeding action in chain above (see registerRoutes)
        cc.getDeliverables().then(function(delivs) {
            Log.trace('AdminRoutes::getDeliverables(..) - in then; # deliverables: ' + delivs.length);
            const payload: DeliverableTransportPayload = {success: delivs};
            res.send(payload);
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to get deliverable list; ERROR: ' + err.message, res, next);
        });
    }

    private static postClasslist(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postClasslist(..) - start');

        // authentication handled by preceeding action in chain above (see registerRoutes)

        try {
            const user = req.params.user;
            const path = req.files.classlist.path; // this is brittle, but if it fails it will just trigger the exception

            const csvParser = new CSVParser();
            csvParser.processClasslist(user, path).then(function(people) {
                if (people.length > 0) {
                    const payload: Payload = {
                        success: {
                            message: 'Classlist upload successful. ' + people.length + ' students processed.'
                        }
                    };
                    res.send(200, payload);
                    Log.info('AdminRoutes::postClasslist(..) - done: ' + payload.success.message);
                } else {
                    const msg = 'Classlist upload not successful; no students were processed from CSV.';
                    return AdminRoutes.handleError(400, msg, res, next);
                }
            }).catch(function(err) {
                return AdminRoutes.handleError(400, 'Classlist upload unsuccessful. ERROR: ' + err.messge, res, next);
            });
        } catch (err) {
            return AdminRoutes.handleError(400, 'Classlist upload unsuccessful. ERROR: ' + err.messge, res, next);
        }
    }

    private static postDeliverable(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postDeliverable(..) - start');
        let payload: Payload;

        // isValid handled by preceeding action in chain above (see registerRoutes)
        const user = req.params.user;

        const delivTrans: DeliverableTransport = req.params;
        Log.info('AdminRoutes::postDeliverable() - body: ' + delivTrans);
        AdminRoutes.handlePostDeliverable(user, delivTrans).then(function(success) {
            Log.info('AdminRoutes::postDeliverable() - done');
            payload = {success: {message: 'Deliverable saved successfully'}};
            res.send(200, payload);
        }).catch(function(err) {
            return AdminRoutes.handleError(400, err.message, res, next);
        });
    }

    private static async handlePostDeliverable(personId: string, delivTrans: DeliverableTransport): Promise<boolean> {
        const dc = new DeliverablesController();
        const result = dc.validateDeliverableTransport(delivTrans);
        if (result === null) {
            const deliv = DeliverablesController.transportToDeliverable(delivTrans);

            const existingDeliv = await dc.getDeliverable(deliv.id);
            const saveSucceeded = await dc.saveDeliverable(deliv);
            if (saveSucceeded !== null) {
                // worked (would have returned a Deliverable)
                const dbc = DatabaseController.getInstance();
                await dbc.writeAudit(AuditLabel.DELIVERABLE, personId, existingDeliv, deliv, {});
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

        const cc = Factory.getCourseController(AdminRoutes.ghc);
        cc.getCourse().then(function(course) {
            Log.trace('AdminRoutes::getCourse(..) - in then');

            const payload: CourseTransportPayload = {success: course};
            res.send(payload);
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to retrieve course object; ERROR: ' + err.message, res, next);
        });
    }

    private static postCourse(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postCourse(..) - start');
        let payload: Payload;

        const user = req.params.user;

        const courseTrans: CourseTransport = req.params;
        Log.info('AdminRoutes::postCourse() - body: ' + courseTrans);
        AdminRoutes.handlePostCourse(user, courseTrans).then(function(success) {
            payload = {success: {message: 'Course object saved successfully'}};
            res.send(200, payload);
            return next(true);
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to post course: ' + err.message, res, next);
        });
    }

    private static async handlePostCourse(personId: string, courseTrans: CourseTransport): Promise<boolean> {
        const cc = Factory.getCourseController(AdminRoutes.ghc);
        const result = CourseController.validateCourseTransport(courseTrans);
        if (result === null) {
            const existingCourse = await cc.getCourse();
            const saveSucceeded = await cc.saveCourse(courseTrans);
            if (saveSucceeded === true) {
                Log.info('AdminRoutes::handlePostCourse() - done');
                const dbc = DatabaseController.getInstance();
                await dbc.writeAudit(AuditLabel.COURSE, personId, existingCourse, courseTrans, {});
                return true;
            }
        }
        // should never get here unless something goes wrong
        throw new Error("Course object not saved.");
    }

    private static postProvision(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postProvision(..) - start');
        let payload: Payload;
        const user = req.headers.user;

        const provisionTrans: ProvisionTransport = req.params;
        Log.info('AdminRoutes::postProvision() - body: ' + provisionTrans);
        AdminRoutes.handleProvision(user, provisionTrans).then(function(success) {
            payload = {success: success};
            res.send(200, payload);
            return next(true);
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to provision repos: ' + err.message, res, next);
        });
    }

    private static async handleProvision(personId: string, provisionTrans: ProvisionTransport): Promise<RepositoryTransport[]> {
        const cc = Factory.getCourseController(AdminRoutes.ghc);
        const result = CourseController.validateProvisionTransport(provisionTrans);

        // TODO: if course is SDMM, always fail

        if (result === null) {
            const dc = new DeliverablesController();
            const deliv = await dc.getDeliverable(provisionTrans.delivId);
            if (deliv !== null && deliv.shouldProvision === true) {
                const dbc = DatabaseController.getInstance();
                await dbc.writeAudit(AuditLabel.REPO_PROVISION, personId, {}, {}, provisionTrans);
                const provisionSucceeded = await cc.provision(deliv, provisionTrans.formSingle);
                Log.info('AdminRoutes::handleProvision() - success; # results: ' + provisionSucceeded.length);
                return provisionSucceeded;
            } else {
                throw new Error("Provisioning unsuccessful; cannot provision: " + provisionTrans.delivId);
            }
        }
        // should never get here unless something goes wrong
        throw new Error("Provisioning unsuccessful.");
    }

    private static postRelease(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postRelease(..) - start');
        let payload: Payload;

        const user = req.headers.user;
        const provisionTrans: ProvisionTransport = req.params;
        Log.info('AdminRoutes::postRelease() - body: ' + provisionTrans);
        AdminRoutes.handleRelease(user, provisionTrans).then(function(success) {
            payload = {success: success};
            res.send(200, payload);
            return next(true);
        }).catch(function(err) {
            Log.exception(err);
            return AdminRoutes.handleError(400, 'Unable to release repos: ' + err.message, res, next);
        });
    }

    private static async handleRelease(personId: string, releaseTrans: ProvisionTransport): Promise<RepositoryTransport[]> {
        const cc = Factory.getCourseController(AdminRoutes.ghc);
        const result = CourseController.validateProvisionTransport(releaseTrans);

        // TODO: if course is SDMM, always fail

        if (result === null) {
            const dc = new DeliverablesController();
            const deliv = await dc.getDeliverable(releaseTrans.delivId);
            if (deliv !== null && deliv.shouldProvision === true) {
                const dbc = DatabaseController.getInstance();
                await dbc.writeAudit(AuditLabel.REPO_RELEASE, personId, {}, {}, releaseTrans);

                const releaseSucceeded = await cc.release(deliv);
                Log.info('AdminRoutes::handleRelease() - success; # results: ' + releaseSucceeded.length);
                return releaseSucceeded;
            } else {
                throw new Error("Release unsuccessful, cannot release: " + releaseTrans.delivId);
            }
        }
        // should never get here unless something goes wrong
        throw new Error("Release unsuccessful.");
    }

    public static postTeam(req: any, res: any, next: any) {
        Log.info('AdminRoutes::postTeam(..) - start');

        // handled by isAdmin in the route chain
        const user = req.headers.user;
        // const token = req.headers.token;

        const teamTrans: TeamFormationTransport = req.params;
        AdminRoutes.performPostTeam(user, teamTrans).then(function(team) {
            Log.info('AdminRoutes::postTeam(..) - done; team: ' + JSON.stringify(team));
            const payload: TeamTransportPayload = {success: [team]}; // really shouldn't be an array, but it beats having another type
            res.send(200, payload);
            return next(true);
        }).catch(function(err) {
            Log.info('AdminRoutes::postTeam(..) - ERROR: ' + err.message); // intentionally info
            const payload: Payload = {failure: {message: err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    private static async performPostTeam(personId: string, requestedTeam: TeamFormationTransport): Promise<TeamTransport> {

        Log.info("AdminRoutes::performPostTeam( .. ) - Team: " + JSON.stringify(requestedTeam));
        const tc = new TeamController();
        const dc = new DeliverablesController();
        const pc = new PersonController();

        const deliv = await dc.getDeliverable(requestedTeam.delivId);
        if (deliv === null) {
            throw new Error("Team not created; Deliverable does not exist: " + requestedTeam.delivId);
        }
        // NOTE: this isn't great because it largely duplicates what is in GeneralRoutes::performPostTeam

        // remove duplicate names
        const nameIds = requestedTeam.githubIds.filter(function(item, pos, self) {
            return self.indexOf(item) === pos;
        });
        if (nameIds.length !== requestedTeam.githubIds.length) {
            throw new Error("Team not created; duplicate team members specified.");
        }

        // make sure the ids exist
        const people: Person[] = [];
        for (const pId of nameIds) {
            const p = await pc.getGitHubPerson(pId); // students will provide github ids // getPerson(pId);
            if (p !== null) {
                people.push(p);
            } else {
                throw new Error("Team not created; GitHub id not associated with student registered in course: " + pId);
            }
        }

        // make sure all users aren't already on teams
        for (const person of people) {
            const teams = await tc.getTeamsForPerson(person);
            for (const aTeam of teams) {
                if (aTeam.delivId === requestedTeam.delivId) {
                    throw new Error('User is already on a team for this deliverable ( ' + person.id + ' is on ' + aTeam.id + ' ).');
                }
            }
        }

        const cc = Factory.getCourseController(new GitHubController(GitHubActions.getInstance()));
        const names = await cc.computeNames(deliv, people);
        const team = await tc.formTeam(names.teamName, deliv, people, true);

        const dbc = DatabaseController.getInstance();
        await dbc.writeAudit(AuditLabel.TEAM_ADMIN, personId, null, team, {});

        const teamTrans: TeamTransport = {
            id:      team.id,
            delivId: team.delivId,
            people:  team.personIds,
            URL:     team.URL
        };

        Log.info('AdminRoutes::performPostTeam(..) - team created: ' + team.id);
        return teamTrans;
    }

}
