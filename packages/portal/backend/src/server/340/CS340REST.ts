import restify = require('restify');
import Log from "../../../../../common/Log";

import IREST from "../IREST";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {Deliverable, Grade, Person, Repository, Team} from "../../Types";
import {AssignmentController} from "../../controllers/340/AssignmentController";
import {
    AssignmentGrade,
    AssignmentGradingRubric,
    AssignmentInfo,
    DeliverableInfo,
    QuestionGrade
} from "../../../../../common/types/CS340Types";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {RubricController} from "../../controllers/340/RubricController";
import {TeamController} from "../../controllers/TeamController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {RepositoryTransport, StudentTransport, TeamTransport} from "../../../../../common/types/PortalTypes";
import {RepositoryController} from "../../controllers/RepositoryController";
import {AuthController} from "../../controllers/AuthController";
import {GitHubActions} from "../../controllers/GitHubActions";

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
        server.get('/portal/cs340/getStudentTeamByDeliv/:sid/:delivid', CS340REST.getStudentTeamByDeliv);
        server.get('/portal/cs340/getRepository/:teamid' , CS340REST.getRepositoryFromTeam);
        server.get('/portal/cs340/getAllDelivInfo' , CS340REST.getAllDelivInfo);
        server.get('/portal/cs340/getStudentsInOrg', CS340REST.getTrimmedStudentsList);
        server.put('/portal/cs340/setAssignmentGrade', CS340REST.setAssignmentGrade);
        server.post('/portal/cs340/releaseGrades/:delivid', CS340REST.releaseGrades);
        server.post('/portal/cs340/initializeAllRepositories/:delivid', CS340REST.initializeAllRepositories);
        server.post('/portal/cs340/publishAllRepositories/:delivid', CS340REST.publishAllRepositories);
        server.post('/portal/cs340/closeAllRepositories/:delivid', CS340REST.closeAllRepositories);
        server.post('/portal/cs340/deleteRepository/:delivid/:reponame', CS340REST.deleteRepository);
        server.post('/portal/cs340/deleteAllRepositories/:delivid', CS340REST.deleteAllRepositories);
        server.post('/portal/cs340/verifyScheduledJobs/:aid', CS340REST.verifyScheduledJobs);
        server.post('/portal/cs340/verifyScheduledJobs/', CS340REST.verifyAllScheduledJobs);
        server.post('/portal/cs340/publishAllFinalGrades', CS340REST.publishAllFinalGrades);

        // server.get('/testPublishRepository/:repoId', CS340REST.testPublishRepository);
        // server.get('/portal/cs340/testPublishGrade', CS340REST.testPublishGrade);
        // server.get('/portal/cs340/testPublishAllGrades', CS340REST.testPublishAllGrades);
        // server.get('/portal/cs340/testRubricParser', CS340REST.testRubricParser);
    }

    /*
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
    */

    /**
     * Gets all deliverable Ids
     * Authorization: anyone
     */
    public static async getAllDelivInfo(req: any, res: any, next: any) {
        // TODO [Jonathan]: Admin authentication
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isValid(user, token);
        if(!authLevel) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        Log.info("CS340REST::getAllDelivInfo() - start");
        let dc: DeliverablesController = new DeliverablesController();
        try {
            let deliverables: Deliverable[] = await dc.getAllDeliverables();
            let delivObjs: DeliverableInfo[] = [];
            for(const deliv of deliverables) {
                let newObj: DeliverableInfo = {
                    id: deliv.id,
                    minStudents: deliv.teamMinSize,
                    maxStudents: deliv.teamMaxSize
                };
                delivObjs.push(newObj);
            }
            Log.info("CS340REST::getAllDelivInfo() - received all responses");
            res.send(200, {response: delivObjs});
        } catch (err) {
            Log.error("CS340REST::getAllDelivInfo() - Error: " + err);
            res.send(500, {error: err});
        }
        return next();
    }

    public static async verifyAllScheduledJobs(req: any, res: any, next: any) {
        // TODO [Jonathan]: Admin authentication
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        Log.info("CS340REST::verifyAllScheduledJobs() - start");

        let ac: AssignmentController = new AssignmentController();

        try {
            let numberScheduled = await ac.verifyScheduledJobs();
            res.send(200, {response: numberScheduled});
            Log.info("CS340REST::verifyAllScheduledJobs(..) - completed verification; " +
                "created " + numberScheduled + " new tasks");
            return next();
        } catch(err) {
            Log.error("CS340REST::verifyAllScheduledJobs(..) - Error: " + err);
            res.send(500, {error: err});
        }

        return next();
    }

    public static async verifyScheduledJobs(req: any, res: any, next: any) {
        // TODO [Jonathan]: Admin authentication
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        const aid = req.params.aid;

        Log.info("CS340REST::verifyScheduledJobs( " + aid + ") - start");

        let ac: AssignmentController = new AssignmentController();

        try {
            let numberScheduled = await ac.verifyScheduledJobs(aid);
            res.send(200, {response: numberScheduled});
            Log.info("CS340REST::verifyScheduledJobs(..) - completed verification; " +
                "created " + numberScheduled + " new tasks");
            return next();
        } catch(err) {
            Log.error("CS340REST::verifyScheduledJobs(..) - Error: " + err);
            res.send(500, {error: err});
        }

        return next();
    }

    public static async getRepositoryFromTeam(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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

        res.send(400, {error: "Unable to find a repository using teamId: " + teamid});
        return next();
    }

    public static async getStudentTeamByDeliv(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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

        res.send(400, {error: "No team for student: " + sid + " and deliverable: " + delivid});
        return next();
    }

    public static async getAssignmentGrade(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }

        const sid: string = req.params.sid;
        const aid: string = req.params.aid;

        let ac: AssignmentController = new AssignmentController();
        ac.getAssignmentGrade(sid, aid).then((result) => {
            if (result !== null) {
                res.send(200, {response: result});
            } else {
                res.send(400, {response: null, error: "Not found"});
            }
        }).catch((error) => {
            Log.error("CS340REST::getAssignmentGrade - Error: " + error);
            res.send(500, {error: error});
        });

        /*        res.send(400, {
                    message: "Not implemented"
                });
        */
    }

    public static async getAssignmentRubric(req: any, res: any, next: any) {
        // TODO [Jonathan]: Get Assignment rubric for grading view rendering
        Log.info("cs340REST::getAssignmentRubric(...) - start");
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        const aid = req.params.aid;                 // Assignment ID
        Log.info("cs340REST::getAssignmentRubric(...) - aid: " + aid);


        // TODO: retrieve the information from the deliverable, then return the information
        let delivController: DeliverablesController = new DeliverablesController();
        delivController.getDeliverable(aid).then((deliv) => {
            if (deliv === null) {
                // TODO [Jonathan]: send an appropriate failure
                res.send(204, {error: "Deliverable not found, please create the deliverable first"});
            } else {
                if (deliv.custom !== null && typeof deliv.custom.rubric !== "undefined") {
                    let assignInfo: AssignmentInfo = deliv.custom.assignment;
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

    public static async getAllAssignmentRubrics(req: any, res: any, next: any) {
        Log.info("cs340REST::getAllGradingRubrics(...) - start");
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        let delivController: DeliverablesController = new DeliverablesController();
        delivController.getAllDeliverables().then((result) => {
            let assignRubrics: AssignmentGradingRubric[] = [];
            for (const deliv of result) {
                if (deliv.custom !== null && deliv.custom.rubric !== null) {
                    let assignInfo: AssignmentInfo = deliv.custom.assignment;
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

    /*
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
    */

    // Takes all the grades synced up in the database and pushes them to Github
    public static async releaseGrades(req: any, res: any, next: any) {
        // TODO [Jonathan]: Complete this
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        const delivid = req.params.delivid;

        // res.send(501, {
        //     message: "Not implemented"
        // });

        let ac: AssignmentController = new AssignmentController();

        let success = await ac.publishAllGrades(delivid);

        res.send(200, {response: success});

        return next();
    }

    public static async setAssignmentGrade(req: any, res: any, next: any) {
        // TODO [Jonathan]: Set assignment grade for the respective student
        // TODO [Jonathan]: Request is well-formed (complies with rubric format)
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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
        let repoController = new RepositoryController();
        let teamController = new TeamController();
        let db = DatabaseController.getInstance();
        personController.getPerson(studentId).then(async function (result) {
            let person: Person = result;
            let success: boolean;
            if (result === null) {
                res.send(400, {error: "Invalid student ID, unable to record grade"});
                return next();
            }
            let repo: Repository = await assignController.getAssignmentRepo(assignId, person);
            if (repo === null) {
                // success = await assignController.setAssignmentGrade("", assignId, reqBody, user);


                // res.send(400, {error: "No Assignment Repository found, unable to record grade"});
                // return next();

                let totalGrade = 0;
                for (const aQuestion of reqBody.questions) {
                    for (const aSubQuestion of aQuestion.subQuestion) {
                        // Sum up all subcompartment grades
                        totalGrade += aSubQuestion.grade;
                    }
                }

                let newGrade: Grade = {
                    personId: person.id,
                    delivId: assignId,

                    score: totalGrade,
                    comment: "Marked by " + user,
                    timestamp: Date.now(),

                    urlName: "",
                    URL: "",

                    custom: {
                        assignmentGrade: reqBody
                    }
                };

                await db.writeGrade(newGrade);
                res.send(200, {response: "Success"});
                return next();

                // create a team just for the student

                // let team = await teamController.getTeam("emptyGrade_" + person.id);
                // if(team === null) {
                //     let deliv = await db.getDeliverable(assignId);
                //     if (deliv === null) {
                //         res.send(400, {error: "Invalid deliverable specified"});
                //     }
                //     team = await teamController.createTeam("emptyGrade_" + person.id, deliv, [person], null)
                // }
                // repo = await repoController.createRepository("emptyGrade_" + person.id, [team], null);
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
        }).catch((error) => {
            Log.error("CS340REST::setAssignmentGrade - Error: " + error);
            res.send(500, error);
            return next();
        });
    }

    public static async publishAllFinalGrades(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        let ac: AssignmentController = new AssignmentController();

        Log.info("CS340REST::publishAllFinalGrades() - start");
        try {
            let success: boolean = await ac.publishAllFinalGrades();
            res.send(200, {response: success});
        } catch (err) {
            res.send(500, {error: "Issue publishing all final grades. " + err});
        }

        return next();
    }

    public static async getAllDeliverables(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        let delivController: DeliverablesController = new DeliverablesController();

        delivController.getAllDeliverables().then((result) => {
            res.send(200, {response: result});
        }).catch((error) => {
            Log.error("CS340REST::getAllDeliverables - Error: " + error);
            res.send(500, error);
        });

        // return next();
    }

    public static async getTrimmedStudentsList(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                "an error, please course admins"});
            return next();
        }

        try {
            let pc: PersonController = new PersonController();
            let gha: GitHubActions = new GitHubActions();

            let githubPeoplePromise = gha.listPeople();
            let allPeoplePromise = pc.getAllPeople();

            let githubPeople = await githubPeoplePromise;
            let allPeople = await allPeoplePromise;

            let personVerification: { [githubID: string]: any } = {};
            for(const githubPerson of githubPeople) {
                if(typeof personVerification[githubPerson.name] === "undefined") {
                    personVerification[githubPerson.name] = githubPerson;
                }
            }

            let filteredPerson: StudentTransport[] = [];

            for(const person of allPeople) {
                if(typeof personVerification[person.githubId] === "undefined") continue;
                if(person.kind !== "student") continue;
                filteredPerson.push(PersonController.personToTransport(person));
            }

            // let personMap: { [personId: string]: Person} = {};
            // for(const person of allPeople) {
            //     personMap[person.id] = person;
            // }

            // let filteredGrades: Grade[] = [];
            // for(const grade of allGrades) {
            //     if(typeof personMap[grade.personId] === "undefined") continue;
            //     let person: Person = personMap[grade.personId];
            //     if(typeof personVerification[person.githubId] === "undefined") continue;
            //     filteredGrades.push(grade);
            // }

            res.send(200, {response: filteredPerson});
            // res.send(200, {response: filteredGrades});
        } catch (err) {
            Log.error("CS340REST::getTrimmedStudentsList - Error: " + err);
            res.send(500, {error: err});
        }

        return next();
    }

    public static async getAllGrades(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }

        try {
            let gc: GradesController = new GradesController();
            // let pc: PersonController = new PersonController();
            // let gha: GitHubActions = new GitHubActions();
            //
            // let githubPeoplePromise = gha.listPeople();
            // let allPeoplePromise = pc.getAllPeople();
            // let allGradesPromise = gc.getAllGrades();
            //
            // let githubPeople = await githubPeoplePromise;
            // let allPeople = await allPeoplePromise;
            // let allGrades = await allGradesPromise;
            //
            // let personVerification: { [githubID: string]: any } = {};
            // for(const githubPerson of githubPeople) {
            //     if(typeof personVerification[githubPerson.name] === "undefined") {
            //         personVerification[githubPerson.name] = githubPerson;
            //     }
            // }
            //
            // let personMap: { [personId: string]: Person} = {};
            // for(const person of allPeople) {
            //     personMap[person.id] = person;
            // }
            //
            // let filteredGrades: Grade[] = [];
            // for(const grade of allGrades) {
            //     if(typeof personMap[grade.personId] === "undefined") continue;
            //     let person: Person = personMap[grade.personId];
            //     if(typeof personVerification[person.githubId] === "undefined") continue;
            //     filteredGrades.push(grade);
            // }

            let allGrades = await gc.getAllGrades();

            // res.send(200, {response: filteredGrades});
            res.send(200, {response: allGrades});
        } catch (err) {
            Log.error("CS340REST::getAllgrades - Error: " + err);
            res.send(500, {error: err});
        }

        return next();
    }

    // TODO: Should we move something like this to the general routes?
    // Probably want to rename this to something better
    public static async getAllSubmissionsByDelivID(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }

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

    public static async getPersonByID(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        const gitHubUserName = req.params.gitHubUserName;                  // gitHubUserName

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        let personController: PersonController = new PersonController();

        personController.getPerson(gitHubUserName).then((result) => {
            if (result === null) {
                res.send(400, {error: "Username not found"});
            } else {
                res.send(200, {response: result});
            }
        }).catch((error) => {
            Log.error("CS340REST::getPersonByID - Error: " + error);
            res.send(500, error);
        });

        return next();
    }

    public static async getAllPersons(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        let personController: PersonController = new PersonController();

        personController.getAllPeople().then(result => {
            res.send(200, {response: result});
        }).catch((error) => {
            Log.error("CS340REST::getAllPersons - Error: " + error);
            res.send(500, error);
        });
        return next();
    }

    /*
    public static async provisionRepository(req: any, res: any, next: any) {
        // TODO [Jonathan]: Complete this
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        // get deliverable ID
        res.send(501, "Single Repository Provisioning - Not Implemented");

        return next();
    }
    */

    public static async getAssignmentStatus(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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

        if (typeof (deliv.custom as AssignmentInfo).mainFilePath === "undefined") {
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

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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

        if (typeof (deliv.custom as AssignmentInfo).mainFilePath === "undefined") {
            res.send(400, {error: "Assignment not set up properly"});
            return next();
        }

        let assignController: AssignmentController = new AssignmentController();
        let success = await assignController.publishAllRepositories(delivId);

        res.send(200, {response: success});

        return next();
    }

    public static async closeAllRepositories(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
        // let
        Log.info("CS340REST::closeAllRepositories(..) - start");
        let delivId: string = req.params.delivid;

        // validate this is a valid deliverable
        let delivController: DeliverablesController = new DeliverablesController();
        let deliv: Deliverable = await delivController.getDeliverable(delivId);

        if (deliv === null) {
            res.send(400, {error: "Invalid deliverable specified"});
            return next();
        }

        if (typeof (deliv.custom as AssignmentInfo).mainFilePath === "undefined") {
            res.send(400, {error: "Assignment not set up properly"});
            return next();
        }

        let assignController: AssignmentController = new AssignmentController();
        let success = await assignController.closeAllRepositories(delivId);

        res.send(200, {response: success});

        return next();
    }


    public static async deleteRepository(req: any, res: any, next: any) {
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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

        let auth: AuthController = new AuthController();
        let authLevel = await auth.isPrivileged(user, token);
        if(!authLevel.isStaff) {
            res.send(401, {error: "Unauthorized usage of API: If you believe this is " +
                    "an error, please course admins"});
            return next();
        }
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
