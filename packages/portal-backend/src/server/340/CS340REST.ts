import restify = require('restify');
import Log from "../../../../common/Log";

import IREST from "../IREST";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {Deliverable, Grade, Person, Repository} from "../../Types";
import {AssignmentController} from "../../controllers/340/AssignmentController";
import {AssignmentGrade, AssignmentGradingRubric, QuestionGrade} from "../../../../common/types/CS340Types";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {RepositoryController} from "../../controllers/RepositoryController";

export default class CS340REST implements IREST {
    public constructor() {
        Log.trace("Starting CS340REST");
    }

    public registerRoutes(server: restify.Server) {
        Log.trace("CS340REST::registerRoutes() - start");

        // TODO [Jonathan]: Add the routes here
        server.get('/getAssignmentGrade/:sid/:aid', CS340REST.getAssignmentGrade);
        server.get('/getAssignmentRubric/:aid', CS340REST.getAssignmentRubric);
        server.get('/getAllDeliverables', CS340REST.getAllDeliverables);
        server.get('/getAllSubmissionsByDelivID/:id', CS340REST.getAllSubmissionsByDelivID);
        server.get('/getAllGrades', CS340REST.getAllGrades);
        server.put('/setAssignmentGrade', CS340REST.setAssignmentGrade);
        server.get('/getPersonByID/:gitHubUserName', CS340REST.getPersonByID);
        server.get('/getAllPersons', CS340REST.getAllPersons);
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
        Log.info("cs340REST::getAssignmentRubric(...) - start");
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const aid = req.params.aid;                 // Assignment ID
        Log.info("cs340REST::getAssignmentRubric(...) - aid: " + aid);

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
                    res.send(200, {response: rubric});
                } else {
                    Log.info("cs340REST::getAssignmentRubric(...) - deliv.custom: " + deliv.custom);

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
            res.send(400, {error: "invalid request"});
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
        Log.info("CS340REST::setAssignmentGrade() - start");
        let reqBody : AssignmentGrade;
        if(typeof req.body === 'string') {
            reqBody = JSON.parse(req.body);
        } else {
            reqBody = req.body
        }

        if(reqBody === null) {
            Log.error("Unable to get request body: " + req.body);
            res.send(400, {error: "Invalid request"});
            return next();
        }

        // Log.info("CS340REST::setAssignmentGrade() - reqBody is not NULL");
        Log.info("CS340REST::setAssignmentGrade() - reqBody = " + JSON.stringify(reqBody));
        // Log.info("CS340REST::setAssignmentGrade() - req = " + req);
        const assignId  : string = reqBody.assignmentID;
        const studentId : string = reqBody.studentID;
        const questions: QuestionGrade[] = reqBody.questions;

        Log.info("CS340REST::setAssignmentGrade() - aid: "+assignId+" sid: "+studentId);

        let assignController = new AssignmentController();
        let personController = new PersonController();

        personController.getPerson(studentId).then(async function (result) {
            let person : Person = result;

            if(result === null) {
                res.send(400, {error: "Invalid student ID"});
                return next();
            }
            let repo : Repository = await assignController.getAssignmentRepo(assignId, person);
            if(repo === null) {
                res.send(400, {error: "no assignment repository created"});
                return next();
            }
            let success = await assignController.setAssignmentGrade(repo.id, assignId, reqBody, user);
            if (success) {
                res.send(200, {response: "Success"});
            } else {
                res.send(500, {error: "Unable to write to database"});
            }

            Log.info("CS340REST::setAssignmentGrade() - end");
            return next();
        });
    }

    public static getAllDeliverables(req:any, res:any, next:any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // TODO [Jonathan]: Return an array of deliverables
        let delivController : DeliverablesController = new DeliverablesController();

        delivController.getAllDeliverables().then((result) => {
            res.send(200, {response: result});
        });

        // return next();
    }

    public static getAllGrades(req:any, res:any, next:any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let gradeController:GradesController = new GradesController();
        gradeController.getAllGrades().then((result) => {
            res.send(200, {response: result});
        });
    }

    // TODO: Should we move something like this to the general routes?
    // Probably want to rename this to something better
    public static getAllSubmissionsByDelivID(req:any, res:any, next:any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const delivId = req.params.id;                  // Deliverable ID

        let gradeController:GradesController = new GradesController();

        gradeController.getAllGrades().then((result) => {
            let resultArray:Grade[] = [];
            for(const grade of result) {
                // <Grade>gradeValue.
                if(grade.delivId == delivId) {
                    resultArray.push(grade);
                }
            }
            res.send(200, {response: resultArray});
        });

        return next();
    }

    public static getPersonByID(req:any, res:any, next:any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const gitHubUserName = req.params.gitHubUserName;                  // gitHubUserName

        let personController : PersonController = new PersonController();

        personController.getPerson(gitHubUserName).then((result) => {
            if(result === null) {
                res.send(404, {error: "Username not found"});
            } else {
                res.send(200, {response: result});
            }
        });

        return next();
    }

    public static getAllPersons(req:any, res:any, next:any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let personController : PersonController = new PersonController();

        personController.getAllPeople().then(result => {
            res.send(200, {response: result});
        });
        return next();
    }
}
