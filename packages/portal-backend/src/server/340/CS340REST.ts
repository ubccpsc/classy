import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {CourseController} from "../../controllers/CourseController";
import {GitHubController} from "../../controllers/GitHubController";

export default class CS340REST implements IREST {
    public constructor() {
        Log.trace("Starting CS340REST");
    }

    public registerRoutes(server: restify.Server) {
        Log.trace("CS340REST::registerRoutes() - start");

        // TODO: Add the routes here
        server.get('/getAssignmentGrade', CS340REST.getAssignmentGrade);
    }

    public static getAssignmentGrade(req: any, res: any, next: any) {
        // TODO: Do something
        res.send(404, {
            message: "Not implemented"
        });
    }

    public static getAssignmentRubric(req: any, res: any, next: any) {
        // TODO: Get Assignment rubric for grading view rendering
        res.send(404, {
            message: "Not implemented"
        });
    }

    public static setAssignmentGrade(req:any, res: any, next:any) {
        // TODO: Set assignment grade for the respective student
        // TODO: Request is well-formed (complies with rubric format)
        res.send(404, {
            message: "Not implemented"
        });
    }

}
