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

        // TODO [Jonathan]: Add the routes here
        server.get('/getAssignmentGrade/:sid/:aid', CS340REST.getAssignmentGrade);
        server.get('/getAssignmentRubric/:aid', CS340REST.getAssignmentRubric);
        server.post('/setAssignmentGrade', CS340REST.setAssignmentGrade);
    }

    public static getAssignmentGrade(req: any, res: any, next: any) {
        // TODO [Jonathan]: Get the grade of the student
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // TODO [Jonathan]: Authenticate token

        const sid : string = req.params.sid;
        const aid : string = req.params.aid;

        let ac : AssignmentController = new AssignmentController();
        ac.getAssignmentGrade(sid, aid).then((result) => {
            if(result !== null) {
                res.send(200, result);
            } else {
                res.send(404, "Not found"); // TODO [Jonathan]: Find proper HTML code for this
            }
        });

/*        res.send(404, {
            message: "Not implemented"
        });
*/
    }

    public static getAssignmentRubric(req: any, res: any, next: any) {
        // TODO [Jonathan]: Get Assignment rubric for grading view rendering
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const aid = req.params.aid;                 // Assignment ID

        // TODO [Jonathan]: Authenticate token

        // let courseController : CourseController = new CourseController(new GitHubController());
        // let ac : AssignmentController = new AssignmentController();

/*
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
    */
        // return next();
    // TODO: retrieve the information from the deliverable, then return the information
    let delivController : DeliverablesController = new DeliverablesController();
        delivController.getDeliverable(aid).then((deliv) => {
            if(deliv === null) {
                // TODO [Jonathan]: send an appropriate failure
                res.send(204, {error: "Deliverable not found, please create the deliverable first"});
                return next();
            } else {
                if (deliv.custom !== null) {
                    let rubric : AssignmentGradingRubric = deliv.custom;
                    res.send(200, rubric);
                } else {
                    // TODO [Jonathan]: Set this up to inform there was no rubric
                    res.send(204, {error: "Rubric not found, perhaps the deliverable has no rubric?"});
                }
                return next();
            }
        });
        //
        // res.send(404, {
        //     message: "Not implemented"
        // });
    }

    public static createAssignmentRubric(req: any, res:any, next:any) {
        // TODO [Jonathan]: Create a deliverable and then store it
        // TODO [Jonathan]: Respond with success or failure
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        if (req.body === null) {
            res.send(400, {errror: "invalid request"});
        }

        const newDeliv : Deliverable = req.body;

        let delivControl : DeliverablesController = new DeliverablesController();
        delivControl.saveDeliverable(newDeliv).then((result) => {
            res.send(200, result);
        });

        // let newDeliv : Deliverable = {
        //     id: "",
        //     openTimestamp: 0,
        //     closeTimestamp: 0,
        //     gradesReleased: false,
        //     delay: 0,
        //     teamMinSize: 0,
        //     teamMaxSize: 0,
        //     teamSameLab: false,
        //     teamStudentsForm: false,
        //     custom: null
        // }
    }

    // Takes all the grades synced up in the database and pushes them to Github
    // TODO [Jonathan]: Complete this
    public static releaseGrades(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        res.send(404, {
            message: "Not implemented"
        });
    }

    public static setAssignmentGrade(req:any, res: any, next:any) {
        // TODO [Jonathan]: Set assignment grade for the respective student
        // TODO [Jonathan]: Request is well-formed (complies with rubric format)
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        res.send(404, {
            message: "Not implemented"
        });
    }

}
