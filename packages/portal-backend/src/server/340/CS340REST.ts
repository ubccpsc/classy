import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {Deliverable} from "../../Types";
import {AssignmentController} from "../../controllers/340/AssignmentController";
import {AssignmentGradingRubric} from "../../../../common/types/CS340Types";

export default class CS340REST implements IREST {
    public constructor() {
        Log.trace("Starting CS340REST");
    }

    public registerRoutes(server: restify.Server) {
        Log.trace("CS340REST::registerRoutes() - start");

        // TODO: Add the routes here
        server.get('/getAssignmentGrade/:sid/:aid', CS340REST.getAssignmentGrade);
        server.get('/getAssignmentRubric/:aid', CS340REST.getAssignmentRubric);
        server.post('/setAssignmentGrade', CS340REST.setAssignmentGrade);
    }

    public static getAssignmentGrade(req: any, res: any, next: any) {
        // TODO: Get the grade of the student
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // TODO: Authenticate token

        const sid : string = req.params.sid;
        const aid : string = req.params.aid;

        let ac : AssignmentController = new AssignmentController();
        ac.getAssignmentGrade(sid, aid).then((result) => {
            if(result !== null) {
                res.send(200, result);
            } else {
                res.send(404, "Not found"); // TODO: Find proper HTML code for this
            }
        });

/*        res.send(404, {
            message: "Not implemented"
        });
*/
    }

    public static getAssignmentRubric(req: any, res: any, next: any) {
        // TODO: Get Assignment rubric for grading view rendering
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const aid = req.params.aid;                 // Assignment ID

        // TODO: Authenticate token

        // let courseController : CourseController = new CourseController(new GitHubController());
        // let ac : AssignmentController = new AssignmentController();

        res.send(200, {
            name: "Assignment 1",
            comment: "Graded assignment",
            question: [
                {
                    name: "Question 1",
                    comment: "",
                    subQuestions: [
                        {
                            name: "code quality",
                            comment: "",
                            outOf: 5,
                            modifiers: null
                        }
                    ]
                }
            ]
        });

        // return next();

    let delivController : DeliverablesController = new DeliverablesController();
        delivController.getDeliverable(aid).then((deliv) => {
            if(deliv === null) {
                // TODO: send an appropriate failure
            } else {
                if (deliv.custom !== null) {
                    let rubric : AssignmentGradingRubric = deliv.custom;
                    //
                }
            }
        });

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
