import restify = require('restify');
import Config, {ConfigKey} from '../../../../../common/Config';
import Log from "../../../../../common/Log";
import {
    ConfigTransportPayload,
    GradeTransport,
    GradeTransportPayload,
    Payload,
    TeamTransport,
    TeamTransportPayload
} from '../../../../../common/types/PortalTypes';
import {AuthController} from "../../controllers/AuthController";
import {GradesController} from "../../controllers/GradesController";
import {PersonController} from "../../controllers/PersonController";
import {TeamController} from "../../controllers/TeamController";

import IREST from "../IREST";

export default class GeneralRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.trace('GeneralRoutes::registerRoutes() - start');

        // returns the org that the backend is currently configured to serve
        // mainly used by the frontend so it uses the correct UI
        server.get('/portal/config', GeneralRoutes.getConfig);

        server.get('/portal/grades', GeneralRoutes.getGrades);

        server.get('/portal/teams', GeneralRoutes.getTeams);
    }

    public static getConfig(req: any, res: any, next: any) {
        Log.info('GeneralRoutes::getConfig(..) - start');

        const org = Config.getInstance().getProp(ConfigKey.org);
        const name = Config.getInstance().getProp(ConfigKey.name);

        let payload: ConfigTransportPayload;
        if (org !== null) {
            payload = {success: {org: org, name: name}};
            Log.trace('GeneralRoutes::getConfig(..) - sending: ' + JSON.stringify(payload));
            res.send(200, payload);
            return next(false);
        } else {
            payload = {failure: {message: 'Unable to retrieve config (server error)', shouldLogout: false}};
            res.send(400, payload);
            return next(false);
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
                gradeTrans.push(gc.translateGrade(grade));
            }
            return gradeTrans;
        }
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
                    teamTrans.push(tc.translateTeam(team));
                }
                return teamTrans;
            }
        }
    }

}
