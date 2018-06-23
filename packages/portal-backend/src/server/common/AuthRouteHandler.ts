import * as rp from "request-promise-native";

import Config from "../../../../common/Config";
import Log from "../../../../common/Log";

import {AuthController} from "../../controllers/AuthController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {Auth, Person} from "../../Types";
import {PersonController} from "../../controllers/PersonController";
import IREST from "../IREST";
import {RouteHandler} from "../RouteHandler";
import restify = require('restify');
import ClientOAuth2 = require("client-oauth2");

/**
 * Just a large body of static methods for translating between restify and the remainder of the system.
 */
export class AuthRouteHandler implements IREST {

    private static ac = new AuthController();

    public registerRoutes(server: restify.Server) {
        Log.info("AuthRouteHanlder::registerRoutes() - start");

        server.on('MethodNotAllowed', RouteHandler.handlePreflight); // preflights cors requests
        server.get('/getCredentials', AuthRouteHandler.getCredentials);
        server.get('/auth', AuthRouteHandler.getAuth);
        server.get('/githubCallback', AuthRouteHandler.githubCallback);
    }

    public static getCredentials(req: any, res: any, next: any) {
        Log.trace('AuthRouteHandler::getCredentials(..) - start');
        const user = req.headers.user;
        const token = req.headers.token;
        const org = req.headers.org;
        Log.info('AuthRouteHandler::getCredentials(..) - org: ' + org + '; user: ' + user + '; token: ' + token);

        AuthRouteHandler.ac.isValid(user, token).then(function (isValid) {
            Log.trace('AuthRouteHandler::getCredentials(..) - in isValid(..)');
            if (isValid === true) {
                Log.trace('AuthRouteHandler::getCredentials(..) - isValid true');
                AuthRouteHandler.ac.isPrivileged(user, token).then(function (isPrivileged) {

                    Log.info('RouteHandler::getCredentials(..) - sending 200; isPriv: ' + (isPrivileged.isStaff || isPrivileged.isAdmin));
                    res.send({user: user, token: token, isAdmin: isPrivileged.isAdmin, isStaff: isPrivileged.isStaff});

                }).catch(function (err) {
                    Log.info('AuthRouteHandler::getCredentials(..) - isValid true; ERROR: ' + err);
                    res.send(400, {failure: {message: "Login error (getCredentials valid inner error)."}});
                });
            } else {
                Log.trace('AuthRouteHandler::getCredentials(..) - sending 400');
                res.send(400, {failure: {message: "Login error (getCredentials invalid inner error)."}});
            }
        }).catch(function (err) {
            Log.error('AuthRouteHandler::getCredentials(..) - ERROR: ' + err);
            res.send(400, {failure: {message: "Login error (getCredentials outer error)."}});
        });
    }

    public static getAuth(req: any, res: any, next: any) {
        Log.trace("AuthRouteHandler::getAuth(..) - /auth redirect start");
        let config = Config.getInstance();

        const org = req.query.org;

        const githubRedirect = config.getProp('backendUrl') + ':' + config.getProp('backendPort') + '/githubCallback?org=' + org;
        Log.info("AuthRouteHandler::getAuth(..) - /auth redirect; course: " + org + "; URL: " + githubRedirect);

        const setup = {
            clientId:         config.getProp('githubClientId'),
            clientSecret:     config.getProp('githubClientSecret'),
            accessTokenUri:   config.getProp('githubHost') + '/login/oauth/access_token',
            authorizationUri: config.getProp('githubHost') + '/login/oauth/authorize',
            redirectUri:      githubRedirect,
            scopes:           ['']
        };

        const githubAuth = new ClientOAuth2(setup);

        const uri = githubAuth.code.getUri();
        Log.trace("AuthRouteHandler::getAuth(..) - /auth uri: " + uri);
        res.redirect(uri, next);
    }

    /**
     * Handles the GitHub OAuth callback. This seems complicated, and is, so you should
     * really think on it over a weekend before deciding to make any edits to _anything_
     * in this method.
     *
     * @param req
     * @param res
     * @param next
     */
    public static githubCallback(req: any, res: any, next: any) {
        Log.trace("AuthRouteHandler::githubCallback(..) - /githubCallback - start");
        const config = Config.getInstance();
        // const org = req.query.org;

        const personController = new PersonController();

        // TODO: do we need this redirect?
        const backendUrl = config.getProp('backendUrl');
        const backendPort = config.getProp('backendPort');
        const githubRedirect = backendUrl + ':' + backendPort + '/githubCallback?orgName=secapstone';  // SDMM
        Log.info('AuthRouteHandler::githubCallback(..) - / githubCallback; URL: ' + githubRedirect);

        const opts = {
            clientId:         config.getProp('githubClientId'),
            clientSecret:     config.getProp('githubClientSecret'),
            accessTokenUri:   config.getProp('githubHost') + '/login/oauth/access_token',
            authorizationUri: config.getProp('githubHost') + '/login/oauth/authorize',
            redirectUri:      githubRedirect,
            scopes:           ['']
        };

        const githubAuth = new ClientOAuth2(opts);

        let token: string | null = null;
        let p: Person = null;

        // Log.info('RouteHandler::githubCallback(..) - opts: ' + JSON.stringify(opts));

        githubAuth.code.getToken(req.url).then(function (user) {
            Log.trace("AuthRouteHandler::githubCallback(..) - token acquired");

            token = user.accessToken;
            const options = {
                uri:     config.getProp('githubAPI') + '/user',
                method:  'GET',
                headers: {
                    'Content-Type':  'application/json',
                    'User-Agent':    'Portal',
                    'Authorization': 'token ' + token
                }
            };

            // this extra check isn't strictly required, but means we can
            // associate a username with a token on the backend if needed
            return rp(options);
        }).then(function (ans) {
            Log.info("AuthRouteHandler::githubCallback(..) - /githubCallback - GH username received");
            const body = JSON.parse(ans);
            const username = body.login;
            Log.info("AuthRouteHandler::githubCallback(..) - /githubCallback - GH username: " + username);

            // NOTE: this is not what you want for non micromasters
            // this will create a person every time
            // but for ubc courses we want to give a reject message for unknown users
            p = {
                id:            username,
                csId:          username,
                githubId:      username,
                studentNumber: null,

                fName:  '',
                lName:  '',
                kind:   'student',
                URL:    'https://github.com/' + username, // HARDCODE (don't hardcode host)
                labId:  'UNKNOWN',
                custom: {}
            };

            const auth: Auth = {
                personId: username,
                token:    token
            };

            return DatabaseController.getInstance().writeAuth(auth);
        }).then(function (authWritten) {
            Log.info("AuthRouteHandler::githubCallback(..) - authWritten: " + authWritten);

            // TODO: this should really handoff to an org-based controller to decide if we should
            // create a new person or return an error. This is fine for SDMM, but will need to
            // change in the future.

            // NOTE: this creates a new user; for most courses we would instead prefer to reject them here
            // if they are not registered with the org in advance

            return personController.createPerson(p);
        }).then(function (person) {
            Log.info("AuthRouteHandler::githubCallback(..) - person: " + person);
            let feUrl = config.getProp('frontendUrl');
            let fePort = config.getProp('frontendPort');

            if (person !== null) {
                // only header method that worked for me
                res.setHeader("Set-Cookie", "token=" + token);
                if (feUrl.indexOf('//') > 0) {
                    feUrl = feUrl.substr(feUrl.indexOf('//') + 2, feUrl.length);
                }
                Log.trace("RouteHandler::githubCallback(..) - /githubCallback - redirect URL: " + feUrl);
                res.redirect({
                    hostname: feUrl,
                    pathname: '/index.html',
                    port:     fePort
                }, next);
            } else {
                // TODO: specify 'unknown user' error message (SDMM will always be true, but for future courses this won't be true)
                res.redirect({
                    hostname: feUrl,
                    pathname: '/index.html',
                    port:     fePort
                }, next);
            }
            // res.redirect('https://localhost:3000/index.html', next);
            // res.send({success: true, data: 'myFoo'});

        }).catch(function (err) {
            // code incorrect or expired
            Log.error("AuthRouteHandler::githubCallback(..) - /githubCallback - ERROR: " + err);
            // NOTE: should this be returning 400 or something?
            return next();
        });
    }

}
