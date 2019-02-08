import * as restify from "restify";
import Log from "../../../../../common/Log";
import {AssignmentController} from "../../controllers/AssignmentController";
import {AuthController} from "../../controllers/AuthController";
import {PersonController} from "../../controllers/PersonController";
import {RepositoryController} from "../../controllers/RepositoryController";
import {RubricController} from "../../controllers/RubricController";
import {Person, Repository} from "../../Types";
import IREST from "../IREST";

export default class CS340Routes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.info('CS340Routes::registerRoutes() - start');

        server.get("/portal/cs340/retrieveRepoUrl/:sid/:delivId", CS340Routes.retrieveRepoUrl);

        server.post("/portal/cs340/generateRubric/:delivId", CS340Routes.generateRubric);
        server.post("/portal/cs340/closeAssignmentRepositories/:delivId", CS340Routes.closeAssignmentRepositories);
    }

    public static async retrieveRepoUrl(req: any, res: any, next: any) {
        Log.info(`CS340Routes::generateRubric(..) - start`);
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
}
