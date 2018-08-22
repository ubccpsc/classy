import restify = require('restify');
import Log from "../../../../../common/Log";

import IREST from "../IREST";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {Deliverable, Grade, Person, Repository, Team} from "../../Types";
import {AssignmentController} from "../../controllers/340/AssignmentController";
import {AssignmentGrade, AssignmentGradingRubric, AssignmentInfo, QuestionGrade} from "../../../../../common/types/CS340Types";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {RubricController} from "../../controllers/340/RubricController";
import {TeamController} from "../../controllers/TeamController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {RepositoryTransport, TeamTransport} from "../../../../../common/types/PortalTypes";
import {RepositoryController} from "../../controllers/RepositoryController";

export default class CS340REST implements IREST {
    public constructor() {
        Log.trace("CS340REST::<init>");
    }

    public registerRoutes(server: restify.Server) {
        Log.trace("CS340REST::registerRoutes() - start");

        // TODO [Jonathan]: Add the routes here

        server.get('/portal/cs340/getAllDeliverables', CS340REST.getAllDeliverables);
        server.get('/portal/cs340/getAssignmentRubric/:aid', CS340REST.getAssignmentRubric);
        server.get('/portal/cs340/getAllAssignmentRubrics', CS340REST.getAllAssignmentRubrics);
        server.get('/portal/cs340/getAllGrades', CS340REST.getAllGrades);
        server.get('/portal/cs340/getAssignmentGrade/:sid/:aid', CS340REST.getAssignmentGrade);
        server.get('/portal/cs340/getAllSubmissionsByDelivID/:id', CS340REST.getAllSubmissionsByDelivID);
        server.get('/portal/cs340/getPersonByID/:gitHubUserName', CS340REST.getPersonByID);
        server.get('/portal/cs340/getAllPersons', CS340REST.getAllPersons);
        server.get('/portal/cs340/updateAssignmentStatus/:delivid', CS340REST.updateAssignmentStatus);
        server.get('/portal/cs340/getAssignmentStatus/:delivid', CS340REST.getAssignmentStatus);
        server.get('/portal/cs340/getStudentTeamByDeliv/:sid/:delivid', CS340REST.getStudentTeamByDeliv); // TODO
        server.get('/portal/cs340/getRepository/:teamid' , CS340REST.getRepositoryFromTeam);
        server.put('/portal/cs340/setAssignmentGrade', CS340REST.setAssignmentGrade);
        server.post('portal/cs340/releaseGrades/:delivid', CS340REST.releaseGrades);
        server.post('/portal/cs340/initializeAllRepositories/:delivid', CS340REST.initializeAllRepositories);
        server.post('/portal/cs340/publishAllRepositories/:delivid', CS340REST.publishAllRepositories);
        server.post('/portal/cs340/deleteRepository/:delivid/:reponame', CS340REST.deleteRepository);
        server.post('/portal/cs340/deleteAllRepositories/:delivid', CS340REST.deleteAllRepositories);
        server.post('/portal/cs340/verifyScheduledJobs/:aid', CS340REST.verifyScheduledJobs);
        server.post('/portal/cs340/verifyScheduledJobs/', CS340REST.verifyAllScheduledJobs);

        // server.get('/testPublishRepository/:repoId', CS340REST.testPublishRepository);
        server.get('/portal/cs340/testPublishGrade', CS340REST.testPublishGrade);
        server.get('/portal/cs340/testPublishAllGrades', CS340REST.testPublishAllGrades);
        server.get('/portal/cs340/testRubricParser', CS340REST.testRubricParser);
    }


    public static async testPublishGrade(req: any, res: any, next: any) {
        let ac: AssignmentController = new AssignmentController();
        let success = await ac.publishGrade("jopika_grades", "a2_grades", "jopika", "a2");
        if(success) {
            res.send(200, "Complete!");
        } else {
            res.send(400, "Failed :(");
        }
    }

    public static async testPublishAllGrades(req: any, res: any, next: any) {
        let ac: AssignmentController = new AssignmentController();
        let success = await ac.publishAllGrades("a2");
        if(success) {
            res.send(200, "Complete!");
        } else {
            res.send(400, "Failed :(");
        }
    }

    public static async testRubricParser(req: any, res: any, next: any) {
        let rc: RubricController = new RubricController();
        await rc.updateRubric("a1");
        res.send(200, "complete!");
    }

    public static async verifyAllScheduledJobs(req: any, res: any, next: any) {
        // TODO [Jonathan]: Admin authentication
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        Log.info("CS340REST::verifyAllScheduledJobs() - start");

        let ac: AssignmentController = new AssignmentController();

        try {
            let numberScheduled = await ac.verifyScheduledJobs();
            res.send(200, numberScheduled);
            Log.info("CS340REST::verifyAllScheduledJobs(..) - completed verification; " +
                "created " + numberScheduled + " new tasks");
            return next();
        } catch(err) {
            Log.error("CS340REST::verifyAllScheduledJobs(..) - Error: " + err);
        }

        return next();
    }

    public static async verifyScheduledJobs(req: any, res: any, next: any) {
        // TODO [Jonathan]: Admin authentication
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        const aid = req.params.aid;

        Log.info("CS340REST::verifyScheduledJobs( " + aid + ") - start");

        let ac: AssignmentController = new AssignmentController();

        try {
            let numberScheduled = await ac.verifyScheduledJobs(aid);
            res.send(200, numberScheduled);
            Log.info("CS340REST::verifyScheduledJobs(..) - completed verification; " +
                "created " + numberScheduled + " new tasks");
            return next();
        } catch(err) {
            Log.error("CS340REST::verifyScheduledJobs(..) - Error: " + err);
        }

        return next();
    }

    public static async getRepositoryFromTeam(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        // TODO [Jonathan]: Authenticate token

        const teamid: string = req.params.teamid;

        let db: DatabaseController = DatabaseController.getInstance();

        let repositories = await db.getRepositories();
        for(const repo of repositories) {
            if(repo.teamIds.includes(teamid)) {
                let result: RepositoryTransport = {
                    id: repo.id,
                    URL: repo.URL
                };
                res.send(200, {response: result});
                return next();
            }
        }

        res.send(404, {error: "Unable to find a repository using teamId: " + teamid});
        return next();
    }

    public static async getStudentTeamByDeliv(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        // TODO [Jonathan]: Authenticate token

        const sid: string = req.params.sid;
        const delivid: string = req.params.delivid;

        let db: DatabaseController = DatabaseController.getInstance();

        let teams: Team[] = await db.getTeamsForPerson(sid);
        for(const team of teams) {
            if(team.delivId === delivid && team.personIds.includes(sid)) {
                let response: TeamTransport = {
                    id: team.id,
                    delivId: delivid,
                    people: team.personIds,
                    URL: team.URL,
                };
                res.send(200, {response: response});
                return next();
            }
        }

        res.send(404, {error: "No team for student: " + sid + " and deliverable: " + delivid});
        return next();
    }

    public static getAssignmentGrade(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // TODO [Jonathan]: Authenticate token

        const sid: string = req.params.sid;
        const aid: string = req.params.aid;

        let ac: AssignmentController = new AssignmentController();
        ac.getAssignmentGrade(sid, aid).then((result) => {
            if (result !== null) {
                res.send(200, {response: result});
            } else {
                res.send(404, {response: null, error: "Not found"}); // TODO [Jonathan]: Find proper HTML code for this
            }
        }).catch((error) => {
            Log.error("CS340REST::getAssignmentGrade - Error: " + error);
            res.send(500, {error: error});
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

        // TODO: retrieve the information from the deliverable, then return the information
        let delivController: DeliverablesController = new DeliverablesController();
        delivController.getDeliverable(aid).then((deliv) => {
            if (deliv === null) {
                // TODO [Jonathan]: send an appropriate failure
                res.send(204, {error: "Deliverable not found, please create the deliverable first"});
            } else {
                if (deliv.custom !== null && deliv.custom.rubric !== null) {
                    let assignInfo: AssignmentInfo = deliv.custom;
                    let rubric: AssignmentGradingRubric = assignInfo.rubric;
                    res.send(200, {response: rubric});
                } else {
                    Log.info("cs340REST::getAssignmentRubric(...) - deliv.custom: " + deliv.custom);

                    // TODO [Jonathan]: Set this up to inform there was no rubric
                    res.send(204, {error: "Rubric not found, perhaps the deliverable has no rubric?"});
                }
            }
        }).catch((error) => {
            Log.error("CS340REST::getAssignmentRubric - Error: " + error);
            res.send(500, {error: error});
        });
        return next();
    }

    public static getAllAssignmentRubrics(req: any, res: any, next: any) {
        Log.info("cs340REST::getAllGradingRubrics(...) - start");
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let delivController: DeliverablesController = new DeliverablesController();
        delivController.getAllDeliverables().then((result) => {
            let assignRubrics: AssignmentGradingRubric[] = [];
            for (const deliv of result) {
                if (deliv.custom !== null && deliv.custom.rubric !== null) {
                    let assignInfo: AssignmentInfo = deliv.custom;
                    assignRubrics.push(assignInfo.rubric);
                }
            }
            res.send(200, {response: assignRubrics});
        }).catch((error) => {
            Log.error("CS340REST::getAllAssignmentRubrics - Error: " + error);
            res.send(500, {error: error});
        });
        return next();
    }

    public static createAssignmentRubric(req: any, res: any, next: any) {
        // TODO [Jonathan]: Create a deliverable and then store it
        // TODO [Jonathan]: Respond with success or failure
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        if (req.body === null) {
            res.send(400, {error: "invalid request"});
        }

        const newDeliv: Deliverable = req.body;

        let delivControl: DeliverablesController = new DeliverablesController();
        delivControl.saveDeliverable(newDeliv).then((result) => {
            res.send(200, {response: result});
        }).catch((error) => {
            Log.error("CS340REST::createAssignmentRubric - Error: " + error);
            res.send(500, {error: error});
        });

        return next();

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
    public static async releaseGrades(req: any, res: any, next: any) {
        // TODO [Jonathan]: Complete this
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        const delivid = req.params.delivid;

        // res.send(501, {
        //     message: "Not implemented"
        // });

        let ac: AssignmentController = new AssignmentController();

        let success = await ac.publishAllGrades(delivid);

        res.send(200, {response: success});

        return next();
    }

    public static setAssignmentGrade(req: any, res: any, next: any) {
        // TODO [Jonathan]: Set assignment grade for the respective student
        // TODO [Jonathan]: Request is well-formed (complies with rubric format)
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        Log.info("CS340REST::setAssignmentGrade() - start");
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

        // Log.info("CS340REST::setAssignmentGrade() - reqBody is not NULL");
        Log.info("CS340REST::setAssignmentGrade() - reqBody = " + JSON.stringify(reqBody));
        // Log.info("CS340REST::setAssignmentGrade() - req = " + req);
        const assignId: string = reqBody.assignmentID;
        const studentId: string = reqBody.studentID;
        const questions: QuestionGrade[] = reqBody.questions;

        Log.info("CS340REST::setAssignmentGrade() - aid: " + assignId + " sid: " + studentId);

        let assignController = new AssignmentController();
        let personController = new PersonController();

        personController.getPerson(studentId).then(async function (result) {
            let person: Person = result;

            if (result === null) {
                res.send(400, {error: "Invalid student ID, unable to record grade"});
                return next();
            }
            let repo: Repository = await assignController.getAssignmentRepo(assignId, person);
            if (repo === null) {
                res.send(400, {error: "No Assignment Repository found, unable to record grade"});
                return next();
            }
            let success = await assignController.setAssignmentGrade(repo.id, assignId, reqBody, user);
            if (success) {
                res.send(200, {response: "Success"});
            } else {
                res.send(500, {error: "Unable to write to database"});
            }
            Log.info("CS340REST::setAssignmentGrade() - end");

        }).catch((error) => {
            Log.error("CS340REST::setAssignmentGrade - Error: " + error);
            res.send(500, error);
        });
        return next();
    }

    public static getAllDeliverables(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let delivController: DeliverablesController = new DeliverablesController();

        delivController.getAllDeliverables().then((result) => {
            res.send(200, {response: result});
        }).catch((error) => {
            Log.error("CS340REST::getAllDeliverables - Error: " + error);
            res.send(500, error);
        });

        // return next();
    }

    public static getAllGrades(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let gradeController: GradesController = new GradesController();
        gradeController.getAllGrades().then((result) => {
            res.send(200, {response: result});
        }).catch((error) => {
            Log.error("CS340REST::getAllgrades - Error: " + error);
            res.send(500, error);
        });
    }

    // TODO: Should we move something like this to the general routes?
    // Probably want to rename this to something better
    public static getAllSubmissionsByDelivID(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const delivId = req.params.id;                  // Deliverable ID

        let gradeController: GradesController = new GradesController();

        gradeController.getAllGrades().then((result) => {
            let resultArray: Grade[] = [];
            for (const grade of result) {
                // <Grade>gradeValue.
                if (grade.delivId == delivId) {
                    resultArray.push(grade);
                }
            }
            res.send(200, {response: resultArray});
        }).catch((error) => {
            Log.error("CS340REST::getAllSubmissionByDelivID - Error: " + error);
            res.send(500, error);
        });

        return next();
    }

    public static getPersonByID(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const gitHubUserName = req.params.gitHubUserName;                  // gitHubUserName

        let personController: PersonController = new PersonController();

        personController.getPerson(gitHubUserName).then((result) => {
            if (result === null) {
                res.send(404, {error: "Username not found"});
            } else {
                res.send(200, {response: result});
            }
        }).catch((error) => {
            Log.error("CS340REST::getPersonByID - Error: " + error);
            res.send(500, error);
        });

        return next();
    }

    public static getAllPersons(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let personController: PersonController = new PersonController();

        personController.getAllPeople().then(result => {
            res.send(200, {response: result});
        }).catch((error) => {
            Log.error("CS340REST::getAllPersons - Error: " + error);
            res.send(500, error);
        });
        return next();
    }

    public static async provisionRepository(req: any, res: any, next: any) {
        // TODO [Jonathan]: Complete this
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // get deliverable ID
        res.send(501, "Single Repository Provisioning - Not Implemented");

        return next();
    }

    public static async getAssignmentStatus(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // get deliverable ID
        let delivid: string = req.params.delivid;

        let assignController: AssignmentController = new AssignmentController();
        let newResult = await assignController.updateAssignmentStatus(delivid);
        if (newResult === null) {
            res.send(400, {error: "Assignment not initialized properly"});
        } else {
            res.send(200, {response: newResult});
        }

        return next();
    }

    public static async updateAssignmentStatus(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // get deliverable ID
        let delivid: string = req.params.delivid;

        let assignController: AssignmentController = new AssignmentController();
        let newResult = await assignController.updateAssignmentStatus(delivid);

        res.send(200, {response: newResult});
        return next();
    }

    /*    public static async testPublishRepository(req:any, res:any, next:any) {
            const user = req.headers.user;
            const token = req.headers.token;
            const org = req.headers.org;

            let repoId: string = req.params.repoId;


            let assignController: AssignmentController = new AssignmentController();
            let success = await assignController.publishAssignmentRepo(repoId);

            res.send(200, success);

            return next();
        }*/

    public static async initializeAllRepositories(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // let
        Log.info("CS340REST::intializeAllRepositories(..) - start");
        let delivId: string = req.params.delivid;

        // validate this is a valid deliverable
        let delivController: DeliverablesController = new DeliverablesController();
        let deliv: Deliverable = await delivController.getDeliverable(delivId);

        if (deliv === null) {
            res.send(400, {error: "Invalid deliverable specified"});
            return next();
        }

        if (deliv.custom === null) {
            res.send(400, {error: "Assignment not set up properly"});
            return next();
        }

        let assignController: AssignmentController = new AssignmentController();
        let success = await assignController.initializeAllRepositories(delivId);

        res.send(200, {response: success});

        return next();
    }


    public static async publishAllRepositories(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // let
        Log.info("CS340REST::intializeAllRepositories(..) - start");
        let delivId: string = req.params.delivid;

        // validate this is a valid deliverable
        let delivController: DeliverablesController = new DeliverablesController();
        let deliv: Deliverable = await delivController.getDeliverable(delivId);

        if (deliv === null) {
            res.send(400, {error: "Invalid deliverable specified"});
            return next();
        }

        if (deliv.custom === null) {
            res.send(400, {error: "Assignment not set up properly"});
            return next();
        }

        let assignController: AssignmentController = new AssignmentController();
        let success = await assignController.publishAllRepositories(delivId);

        res.send(200, {response: success});

        return next();
    }

    public static async deleteRepository(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        Log.warn("CS340REST::deleteRepository(..) - start");
        let repoName: string = req.params.reponame;
        let delivId: string = req.params.delivid;

        let assignController: AssignmentController = new AssignmentController();
        let success = await assignController.deleteAssignmentRepository(repoName, delivId);

        if (success === null) {
            res.send(400, {error: "Unable to delete repository " + repoName + " from deliverable " + delivId});
        } else {
            res.send(200, {response: success});
        }

        return next();
    }


    public static async deleteAllRepositories(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        Log.warn("CS340REST::deleteRepository(..) - start");
        let delivId: string = req.params.delivid;

        let assignController: AssignmentController = new AssignmentController();
        let success = await assignController.deleteAllAssignmentRepositories(delivId);

        if (success === null) {
            res.send(400, {error: "Unable to delete all repositories from " + delivId});
        } else {
            res.send(200, {response: success});
        }

        return next();
    }
}
