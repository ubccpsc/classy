import * as restify from "restify";

import Config, {ConfigKey} from '../../../../../common/Config';
import Log from "../../../../../common/Log";
import {
    ConfigTransportPayload,
    GradeTransport,
    GradeTransportPayload,
    Payload,
    RepositoryPayload,
    RepositoryTransport,
    StudentTransport,
    TeamFormationTransport,
    TeamTransport,
    TeamTransportPayload
} from "../../../../../common/types/PortalTypes";

import {AuthController} from "../../controllers/AuthController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {DeliverablesController} from "../../controllers/DeliverablesController";
import {GitHubActions} from "../../controllers/GitHubActions";
import {GitHubController} from "../../controllers/GitHubController";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {RepositoryController} from "../../controllers/RepositoryController";
import {TeamController} from "../../controllers/TeamController";
import {Factory} from "../../Factory";
import {AuditLabel, Person} from "../../Types";

import IREST from "../IREST";

export default class GeneralRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.trace('GeneralRoutes::registerRoutes() - start');

        // returns the org that the backend is currently configured to serve
        // mainly used by the frontend so it uses the correct UI
        server.get('/portal/config', GeneralRoutes.getConfig);

        // used to get student-specific data
        server.get('/portal/person', GeneralRoutes.getPerson);

        // used by students to get their (released) grades
        server.get('/portal/grades', GeneralRoutes.getGrades);

        // used by students to get their teams
        server.get('/portal/teams', GeneralRoutes.getTeams);

        // used by students to get their repos
        server.get('/portal/repos', GeneralRoutes.getRepos);

        // used by students to create their teams
        server.post('/portal/team', GeneralRoutes.postTeam);
    }

    public static getConfig(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getConfig(..) - start');

        const org = Config.getInstance().getProp(ConfigKey.org);
        const name = Config.getInstance().getProp(ConfigKey.name);
        const githubAPI = Config.getInstance().getProp(ConfigKey.githubAPI);

        let payload: ConfigTransportPayload;
        if (org !== null) {
            payload = {success: {org: org, name: name, githubAPI: githubAPI}};
            Log.trace('GeneralRoutes::getConfig(..) - sending: ' + JSON.stringify(payload));
            res.send(200, payload);
            return next(false);
        } else {
            payload = {failure: {message: 'Unable to retrieve config (server error)', shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        }
    }

    public static getPerson(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getPerson(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        GeneralRoutes.performGetPerson(user, token).then(function(personTrans) {
            const payload: Payload = {success: personTrans};
            res.send(200, payload);
            return next(false);
        }).catch(function(err) {
            Log.info('GeneralRoutes::getPerson(..) - ERROR: ' + err.message); // intentionally info
            const payload: Payload = {failure: {message: err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    private static async performGetPerson(user: string, token: string): Promise<StudentTransport> {
        const ac = new AuthController();
        const isValid = await ac.isValid(user, token);
        if (isValid === false) {
            Log.trace('GeneralRoutes::performGetGrades(..) - in isValid: ' + isValid);
            throw new Error('Invalid credentials');
        } else {
            const pc = new PersonController();
            const person = await pc.getPerson(user);
            if (person === null) {
                return null;
            }

            const personTrans: StudentTransport = PersonController.personToTransport(person);
            return personTrans;
        }
    }

    public static getGrades(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getGrades(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        GeneralRoutes.performGetGrades(user, token).then(function(grades) {
            const payload: GradeTransportPayload = {success: grades};
            res.send(200, payload);
            return next(false);
        }).catch(function(err) {
            Log.info('GeneralRoutes::getGrades(..) - ERROR: ' + err.message); // intentionally info
            const payload: Payload = {failure: {message: err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    public static getTeams(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getTeams(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        GeneralRoutes.performGetTeams(user, token).then(function(teams) {
            const payload: TeamTransportPayload = {success: teams};
            res.send(200, payload);
            return next(false);
        }).catch(function(err) {
            Log.info('GeneralRoutes::getTeams(..) - ERROR: ' + err.message); // intentionally info
            const payload: Payload = {failure: {message: err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    public static getRepos(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getRepos(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        GeneralRoutes.performGetRepos(user, token).then(function(repos) {
            const payload: RepositoryPayload = {success: repos};
            res.send(200, payload);
            return next(false);
        }).catch(function(err) {
            Log.info('GeneralRoutes::getRepos(..) - ERROR: ' + err.message); // intentionally info
            const payload: Payload = {failure: {message: err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    public static postTeam(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::postTeam(..) - start');

        const user = req.headers.user;
        const token = req.headers.token;

        const teamTrans: TeamFormationTransport = req.params;
        GeneralRoutes.performPostTeam(user, token, teamTrans).then(function(team) {
            Log.info('GeneralRoutes::postTeam(..) - done; team: ' + JSON.stringify(team));
            const payload: TeamTransportPayload = {success: [team]}; // really shouldn't be an array, but it beats having another type
            res.send(200, payload);
            return next(true);
        }).catch(function(err) {
            Log.info('GeneralRoutes::postTeam(..) - ERROR: ' + err.message); // intentionally info
            const payload: Payload = {failure: {message: err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    private static async performPostTeam(user: string, token: string, requestedTeam: TeamFormationTransport): Promise<TeamTransport> {
        Log.trace('GeneralRoutes::performPostTeam(..) - team: ' + JSON.stringify(requestedTeam));
        const ac = new AuthController();
        const isValid = await ac.isValid(user, token);
        if (isValid === false) {
            Log.trace('GeneralRoutes::performPostTeam(..) - in isValid: ' + isValid);
            throw new Error('Invalid credentials');
        } else {
            const tc = new TeamController();
            const dc = new DeliverablesController();
            const pc = new PersonController();

            // remove duplicate names
            const nameIds = requestedTeam.githubIds.filter(function(item, pos, self) {
                return self.indexOf(item) === pos;
            });
            if (nameIds.length !== requestedTeam.githubIds.length) {
                throw new Error("Team not created; duplicate team members specified.");
            }

            const people: Person[] = [];
            let requestor = null;
            for (const pId of nameIds) {
                const p = await pc.getGitHubPerson(pId); // students will provide github ids // getPerson(pId);
                if (p !== null) {
                    people.push(p);
                    if (p.id === user) {
                        requestor = p;
                    }
                } else {
                    throw new Error("Team not created; GitHub id not associated with student registered in course: " + pId);
                }
            }

            // make sure the requestor is one of the teammates!
            // we have to do this here because the TeamController does not actually know who made the request
            if (requestor === null) {
                throw new Error('Users cannot form teams they are not going to join.');
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
            const deliv = await dc.getDeliverable(requestedTeam.delivId);
            const names = await cc.computeNames(deliv, people);

            const team = await tc.formTeam(names.teamName, deliv, people, false);

            const dbc = DatabaseController.getInstance();
            await dbc.writeAudit(AuditLabel.TEAM_STUDENT, user, {}, team, {});

            const teamTrans: TeamTransport = {
                id:      team.id,
                delivId: team.delivId,
                people:  team.personIds,
                URL:     team.URL
            };

            Log.info('GeneralRoutes::performPostTeam(..) - team created: ' + team.id);
            return teamTrans;
        }
    }

    private static async performGetGrades(user: string, token: string): Promise<GradeTransport[]> {
        const ac = new AuthController();
        const isValid = await ac.isValid(user, token);
        if (isValid === false) {
            Log.trace('GeneralRoutes::performGetGrades(..) - in isValid: ' + isValid);
            throw new Error('Invalid credentials');
        } else {
            const gc: GradesController = new GradesController();
            const grades = await gc.getReleasedGradesForPerson(user);
            const gradeTrans: GradeTransport[] = [];
            for (const grade of grades) {
                const trans = await gc.gradeToTransport(grade);
                gradeTrans.push(trans);
            }
            return gradeTrans;
        }
    }

    private static async performGetTeams(user: string, token: string): Promise<TeamTransport[]> {
        const ac = new AuthController();
        const isValid = await ac.isValid(user, token);
        if (isValid === false) {
            Log.error('GeneralRoutes::performGetTeams(..) - isValid === false');
            throw new Error("Invalid credentials");
        } else {
            const pc = new PersonController();
            const person = await pc.getPerson(user);
            if (person === null) {
                Log.warn('GeneralRoutes::performGetTeams(..) - person === null');
                throw new Error('Unknown person');
            } else {
                const tc: TeamController = new TeamController();
                const teams = await tc.getTeamsForPerson(person);
                Log.trace('GeneralRoutes::performGetTeams(..) - in teams: ' + teams);
                const teamTrans: TeamTransport[] = [];
                for (const team of teams) {
                    teamTrans.push(tc.teamToTransport(team));
                }
                return teamTrans;
            }
        }
    }

    private static async performGetRepos(user: string, token: string): Promise<RepositoryTransport[]> {
        const ac = new AuthController();
        const isValid = await ac.isValid(user, token);
        if (isValid === false) {
            Log.error('GeneralRoutes::performGetRepos(..) - isValid === false');
            throw new Error("Invalid credentials");
        } else {
            const pc = new PersonController();
            const person = await pc.getPerson(user);
            // if (person === null) {
            //     person = await pc.getGitHubPerson(user);
            // }
            if (person === null) {
                Log.warn('GeneralRoutes::performGetRepos(..) - person === null');
                throw new Error('Unknown person');
            } else {
                const rc = new RepositoryController();
                const repos = await rc.getReposForPerson(person);
                Log.trace('GeneralRoutes::performGetRepos(..) - repos: ' + repos);
                const repoTrans: RepositoryTransport[] = [];
                for (const repo of repos) {
                    if (repo.URL !== null) {
                        // null URLs are Repository objects that have been created locally but not on GitHub
                        // TODO: should probably consider repo.custom.githubCreated
                        repoTrans.push(RepositoryController.repositoryToTransport(repo));
                    }
                }
                return repoTrans;
            }
        }
    }
}
