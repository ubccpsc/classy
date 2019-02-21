import * as restify from "restify";
import Log from "../../../../../common/Log";
import {AssignmentGrade} from "../../../../../common/types/CS340Types";
import {Payload, RepositoryTransport, TeamTransport} from "../../../../../common/types/PortalTypes";
import {AssignmentController} from "../../controllers/AssignmentController";
import {AuthController} from "../../controllers/AuthController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {PersonController} from "../../controllers/PersonController";
import {RepositoryController} from "../../controllers/RepositoryController";
import {RubricController} from "../../controllers/RubricController";
import {ScheduleController} from "../../controllers/ScheduleController";
import {TeamController} from "../../controllers/TeamController";
import {AuditLabel, Deliverable, Grade, Person, Repository, Team} from "../../Types";
import IREST from "../IREST";

export default class CS340Routes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.info('CS340Routes::registerRoutes() - start');

        server.get("/portal/cs340/retrieveRepoUrl/:sid/:delivId", CS340Routes.retrieveRepoUrl);
        server.get("/portal/cs340/getStudentTeamByDeliv/:sid/:delivId", CS340Routes.getStudentTeamByDeliv);

        server.post("/portal/cs340/generateRubric/:delivId", CS340Routes.generateRubric);
        server.post("/portal/cs340/closeAssignmentRepositories/:delivId", CS340Routes.closeAssignmentRepositories);
        server.put("/portal/cs340/setAssignmentGrade/:sid/:delivId", CS340Routes.setAssignmentGrade);

        server.post("/portal/cs340/createAllRepositories/:delivId", CS340Routes.createAllRepositories);
        server.post("/portal/cs340/releaseAllRepositories/:delivId", CS340Routes.releaseAllRepositories);

        server.post("/portal/cs340/verifyScheduledTasks/:delivId", CS340Routes.verifyScheduledTasks);
        server.post("/portal/cs340/verifyAllScheduledTasks/", CS340Routes.verifyAllScheduledTasks);

        server.post("/portal/cs340/provision/:delivId/:repoId", CS340Routes.provisionOverride);

    }

    public static async createAllRepositories(req: any, res: any, next: any) {
        Log.info(`CS340Routes::createAllRepositories(..) - start`);

        const user = req.headers.user;
        const token = req.headers.token;
        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isAdmin) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        } else {
            const assignmentController: AssignmentController = new AssignmentController();
            const db: DatabaseController = DatabaseController.getInstance();

            // verify that the deliverable exists
            const deliverableRecord: Deliverable = await db.getDeliverable(req.params.delivId);
            if (deliverableRecord === null) {
                res.send(400, {error: `Improper usage; please specify valid deliverable ID`});
                return next();
            }

            const success = await assignmentController.createAllRepositories(deliverableRecord.id);

            res.send(200, {result: success});
        }
        return next();
    }

    public static async releaseAllRepositories(req: any, res: any, next: any) {
        Log.info(`CS340Routes::releaseAllRepositories(..) - start`);

        const user = req.headers.user;
        const token = req.headers.token;
        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isAdmin) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        } else {
            const assignmentController: AssignmentController = new AssignmentController();
            const db: DatabaseController = DatabaseController.getInstance();

            // verify that the deliverable exists
            const deliverableRecord: Deliverable = await db.getDeliverable(req.params.delivId);
            if (deliverableRecord === null) {
                res.send(400, {error: `Improper usage; please specify valid deliverable ID`});
                return next();
            }

            const success = await assignmentController.releaseAllRepositories(deliverableRecord.id);

            res.send(200, {result: success});
        }
        return next();
    }

    public static async setAssignmentGrade(req: any, res: any, next: any) {
        Log.info(`CS340Routes::setAssignmentGrade(..) - start`);

        const user = req.headers.user;
        const token = req.headers.token;
        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isAdmin) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        }

        let reqBody: AssignmentGrade;
        if (typeof req.body === 'string') {
            reqBody = JSON.parse(req.body);
        } else {
            reqBody = req.body;
        }

        if (reqBody === null) {
            Log.error("Unable to get request body: " + req.body);
            res.send(400, {error: "Invalid request"});
            return next();
        }

        Log.info("CS340REST::setAssignmentGrade() - reqBody = " + JSON.stringify(reqBody));

        const assignId: string = req.params.delivId;
        const studentId: string = req.params.sid;

        Log.info("CS340REST::setAssignmentGrade() - aid: " + assignId + " sid: " + studentId);

        const assignController = new AssignmentController();
        const personController = new PersonController();
        const repoController = new RepositoryController();
        const teamController = new TeamController();
        const db = DatabaseController.getInstance();

        const result: Person = await personController.getPerson(studentId);
        let success: boolean;
        if (result === null) {
            res.send(400, {error: "Invalid student ID, unable to record grade"});
            return next();
        }

        const repos: Repository[] = await repoController.getReposForPerson(result);

        const repo = repos.find((record) => {
            return record.delivId === assignId;
        });

        if (repo === null) {
            let totalGrade = 0;
            for (const aQuestion of reqBody.questions) {
                for (const aSubQuestion of aQuestion.subQuestions) {
                    // Sum up all subcompartment grades
                    totalGrade += aSubQuestion.grade;
                }
            }

            const newGrade: Grade = {
                personId: result.id,
                delivId:  assignId,

                score:     totalGrade,
                comment:   "Marked by " + user,
                timestamp: Date.now(),

                urlName: "",
                URL:     "",

                custom: {
                    assignmentGrade: reqBody
                }
            };

            await db.writeGrade(newGrade);
            res.send(200, {response: "Success"});
            return next();
        } else {
            success = await assignController.setAssignmentGrade(repo.id, assignId, reqBody, user);
        }

        if (success) {
            res.send(200, {response: "Success"});
        } else {
            res.send(500, {error: "Unable to write to database"});
        }
        Log.info("CS340REST::setAssignmentGrade() - end");
        return next();
    }

    public static async getStudentTeamByDeliv(req: any, res: any, next: any) {
        Log.info(`CS340Routes::getStudentTeamByDeliv(..) - start`);
        Log.warn(`Warning: This should be replaced at some point with front-end logic to retrieve teams`);

        const user = req.headers.user;
        const token = req.headers.token;
        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isAdmin) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        } else {
            const studentId: string = req.params.sid;
            const delivId: string = req.params.delivId;

            const pc: PersonController = new PersonController();
            const tc: TeamController = new TeamController();

            const personRecord: Person = await pc.getPerson(studentId);
            if (personRecord === null) {
                res.send(400, {error: `Improper usage; please specify valid student ID`});
                return next();
            }

            const teams: Team[] = await tc.getTeamsForPerson(personRecord);
            for (const team of teams) {
                if (team.delivId === delivId) {
                    const teamTransport: TeamTransport = tc.teamToTransport(team);
                    Log.info(`CS340Routes::getStudentTeamByDeliv(..) - Found team: ${JSON.stringify(team)}`);
                    res.send(200, {response: teamTransport});
                    return next();
                }
            }
            res.send(400, {error: `Unable to find team for student: ${studentId} and deliverable: ${delivId}`});
            return next();
        }
    }

    public static async retrieveRepoUrl(req: any, res: any, next: any) {
        Log.info(`CS340Routes::retrieveRepoUrl(..) - start`);
        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isStaff) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        } else {
            const studentId: string = req.params.sid;
            const delivId: string = req.params.delivId;

            const rc: RepositoryController = new RepositoryController();
            const pc: PersonController = new PersonController();
            const student: Person = await pc.getPerson(studentId);
            if (student === null) {
                res.send(400, {error: `Improper usage; please specify valid student ID`});
                return next();
            }

            const repos: Repository[] = await rc.getReposForPerson(student);
            for (const repoRecord of repos) {
                if (repoRecord.delivId === delivId) {
                    res.send(200, {response: repoRecord.URL});
                    return next();
                }
            }
            res.send(400, {error: `Improper usage; unable to find repository for student ${studentId} and` +
                    `deliverable: ${delivId}`});
            return next();
        }
    }

    public static async generateRubric(req: any, res: any, next: any) {
        Log.info(`CS340Routes::generateRubric(..) - start`);
        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isAdmin) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        } else {
            const rubricController: RubricController = new RubricController();
            const delivId = req.params.delivId;

            if (typeof delivId === "undefined" || delivId === "") {
                res.send(400, {error: "Improper usage; please specify valid deliverable id"});
            } else {
                const updateResult = await rubricController.updateRubric(delivId);
                res.send(200, {response: updateResult});
            }
        }
        return next();
    }

    public static async closeAssignmentRepositories(req: any, res: any, next: any) {
        Log.info(`CS340Routes::closeAssignmentRepositories(..) - start`);

        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isAdmin) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        } else {
            const assignmentController: AssignmentController = new AssignmentController();
            const delivId = req.params.delivId;

            if (typeof delivId === "undefined" || delivId === "") {
                res.send(400, {error: "Improper usage; please specify valid deliverable id"});
            } else {
                const result = await assignmentController.closeAllRepositories(delivId);
                res.send(200, {response: result});
            }
        }

        return next();
    }

    public static async verifyScheduledTasks(req: any, res: any, next: any) {
        Log.info(`CS340Routes::verifyScheduledTasks(..) - start`);

        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isAdmin) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        } else {
            const sc: ScheduleController = ScheduleController.getInstance();
            const delivId = req.params.delivId;

            if (typeof delivId === "undefined" || delivId === "") {
                res.send(400, {error: "Improper usage; please specify valid deliverable id"});
            } else {
                await sc.verifyScheduledAssignmentTasks(delivId);
                res.send(200, {response: true});
            }
        }

        return next();
    }

    public static async verifyAllScheduledTasks(req: any, res: any, next: any) {
        Log.info(`CS340Routes::verifyAllScheduledTasks(..) - start`);

        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isAdmin) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
        } else {
            const sc: ScheduleController = ScheduleController.getInstance();
            const dbc: DatabaseController = DatabaseController.getInstance();

            const deliverables: Deliverable[] = await dbc.getDeliverables();

            const schedulePromises: Array<Promise<void>> = [];

            for (const deliverable of deliverables) {
                schedulePromises.push(sc.verifyScheduledAssignmentTasks(deliverable.id));
            }

            await Promise.all(schedulePromises);

            res.send(200, {response: true});
        }

        return next();
    }

    private static async provisionOverride(req: any, res: any, next: any) {
        Log.info(`CS340Routes::provisionOverride(..) - start`);

        const user = req.headers.user;
        const token = req.headers.token;

        const ac = new AuthController();
        const isValid = await ac.isPrivileged(user, token);
        if (!isValid.isStaff) {
            res.send(401, {
                error: "Unauthorized usage of API: If you believe this is an error, please contact the course admin"
            });
            return next();
        }

        let payload: Payload;
        // const user = req.headers.user;
        const delivId = req.params.delivId;
        const repoId = req.params.repoId;

        Log.info('CS340Routes::postProvision(..) - start; delivId: ' + delivId + '; repoId: ' + repoId);

        try {
            const success = await CS340Routes.provisionRepository(user, delivId, repoId);
            payload = {success: success};
            res.send(200, payload);
            return next(true);
        } catch (err) {
            Log.error(`CS340Routes:: Error - Unable to provision repo: ${err.message} `);
            res.send(400, {failure: {message: `Unable to provision repo: ${err.message}`}, shouldLogout: false});
            return next(false);
        }
    }

    private static async provisionRepository(personId: string, delivId: string, repoId: string): Promise<RepositoryTransport[]> {
        const dc: DatabaseController = DatabaseController.getInstance();
        const ac: AssignmentController = new AssignmentController();
        const deliv = await dc.getDeliverable(delivId);

        if (deliv !== null && deliv.shouldProvision === true) {
            await dc.writeAudit(AuditLabel.REPO_PROVISION, personId, {}, {}, {delivId: delivId, repoId: repoId});

            const repo = await dc.getRepository(repoId);
            if (repo !== null) {
                Log.info("CS340Routes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - provisioning...");
                const provisionedRepos = await ac.provisionRepos([repo], deliv);
                Log.info("CS340Routes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - provisioning complete.");
                return [RepositoryController.repositoryToTransport(repo)];
            } else {
                throw new Error("CS340Routes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - null repository");
            }
        } else {
            throw new Error("CS340Routes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - null deliverable");
        }

    }
}
