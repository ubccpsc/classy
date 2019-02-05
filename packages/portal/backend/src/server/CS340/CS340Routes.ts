import * as restify from "restify";
import Log from "../../../../../common/Log";
import {AuthController} from "../../controllers/AuthController";
import {RubricController} from "../../controllers/RubricController";
import IREST from "../IREST";

export default class CS340Routes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.info('CS340Routes::registerRoutes() - start');

        server.post("/portal/cs340/generateRubric/:delivId", CS340Routes.generateRubric);
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

            const updateResult = await rubricController.updateRubric(req.params.delivId);

            res.send(200, {response: updateResult});
        }

        return next();
    }
}
