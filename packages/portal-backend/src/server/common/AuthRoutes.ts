import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";

import {AuthController} from "../../controllers/AuthController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {Auth, Person} from "../../Types";
import {PersonController} from "../../controllers/PersonController";
import IREST from "../IREST";
import {AuthTransportPayload, Payload} from "../../../../common/types/PortalTypes";
import restify = require("restify");
import ClientOAuth2 = require("client-oauth2");

/**
 * Just a large body of static methods for translating between restify and the remainder of the system.
 */
export class AuthRoutes implements IREST {

    private static ac = new AuthController();

    public registerRoutes(server: restify.Server) {
        Log.info("AuthRouteHandler::registerRoutes() - start");

        server.on('MethodNotAllowed', AuthRoutes.handlePreflight); // preflights cors requests

        // user endpoints
        server.get('/getCredentials', AuthRoutes.getCredentials); // verify Classy credentials
        server.get('/logout', AuthRoutes.getLogout);

        // GitHub OAuth endpoints
        server.get('/auth', AuthRoutes.getAuth); // start GitHub OAuth flow
        server.get('/githubCallback', AuthRoutes.githubCallback); // finalize GitHub OAuth flow
    }

    /**
     * Work around some CORS-related issues for OAuth. This looks manky, but don't change it.
     *
     * Really.
     *
     * Code taken from restify #284
     *
     * @param req
     * @param res
     */
    public static handlePreflight(req: any, res: any) {
        Log.trace("AuthRouteHandler::handlePreflight(..) - " + req.method.toLowerCase() + "; uri: " + req.url);

        const allowHeaders = ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version', 'user-agent', 'user', 'token', 'org', 'name'];
        if (res.methods.indexOf('OPTIONS') === -1) {
            res.methods.push('OPTIONS');
        }

        if (res.methods.indexOf('GET') === -1) {
            res.methods.push('GET');
        }

        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Headers', allowHeaders.join(', '));
        res.header('Access-Control-Allow-Methods', res.methods.join(', '));
        res.header('Access-Control-Allow-Origin', req.headers.origin);

        Log.trace("AuthRouteHandler::handlePreflight(..) - sending 204; headers: " + JSON.stringify(res.getHeaders()));
        return res.send(204);
    }

    public static getLogout(req: any, res: any, next: any) {
        Log.trace('AuthRouteHandler::getLogout(..) - start');
        let user = req.headers.user;
        let token = req.headers.token;

        if (typeof user === 'undefined') {
            user = null;
        }
        if (typeof token === 'undefined') {
            token = null;
        }

        Log.info('AuthRouteHandler::getLogout(..) - user: ' + user + '; token: ' + token);

        let payload: Payload;
        AuthRoutes.ac.isValid(user, token).then(function (isValid) {
            if (isValid === true) {
                Log.info('AuthRouteHandler::getLogout(..) - user: ' + user + '; valid user');
            } else {
                // loglout anyways? if your user / token is stale we still need log you out
                // but that could mean someone else could spoof-log you out too
                Log.warn('AuthRouteHandler::getLogout(..) - user: ' + user + '; invalid user');
            }
            // logout
            const ac = new AuthController();
            return ac.removeAuthentication(user);
        }).then(function (success) {
            payload = {success: {message: "Logout successful"}};
            res.send(200, payload);
        }).catch(function (err) {
            Log.error('AuthRouteHandler::getLogout(..) - ERROR: ' + err);
            payload = {failure: {message: 'Logout failed: ' + err, shouldLogout: false}};
            res.send(400, payload);
        });
    }

    public static getCredentials(req: any, res: any, next: any) {
        Log.trace('AuthRouteHandler::getCredentials(..) - start');
        const user = req.headers.user;
        const token = req.headers.token;
        // const org = req.headers.org;
        Log.info('AuthRouteHandler::getCredentials(..) - user: ' + user + '; token: ' + token);

        let payload: AuthTransportPayload;
        AuthRoutes.ac.isValid(user, token).then(function (isValid) {
            Log.trace('AuthRouteHandler::getCredentials(..) - in isValid(..)');
            if (isValid === true) {
                Log.trace('AuthRouteHandler::getCredentials(..) - isValid true');
                AuthRoutes.ac.isPrivileged(user, token).then(function (isPrivileged) {
                    payload = {success: {personId: user, token: token, isAdmin: isPrivileged.isAdmin, isStaff: isPrivileged.isStaff}};
                    Log.info('RouteHandler::getCredentials(..) - sending 200; isPriv: ' + (isPrivileged.isStaff || isPrivileged.isAdmin));
                    res.send(200, payload);

                }).catch(function (err) {
                    Log.info('AuthRouteHandler::getCredentials(..) - isValid true; ERROR: ' + err);
                    payload = {failure: {message: "Login error (getCredentials valid inner error).", shouldLogout: false}};
                    res.send(400, payload);
                });
            } else {
                Log.trace('AuthRouteHandler::getCredentials(..) - sending 400');
                payload = {failure: {message: "Login error (getCredentials invalid inner error).", shouldLogout: false}};
                res.send(400, payload);
            }
        }).catch(function (err) {
            Log.error('AuthRouteHandler::getCredentials(..) - ERROR: ' + err);
            payload = {failure: {message: "Login error (getCredentials outer error).", shouldLogout: false}};
            res.send(400, payload);
        });
    }

    public static getAuth(req: any, res: any, next: any) {
        Log.trace("AuthRouteHandler::getAuth(..) - /auth redirect start");
        let config = Config.getInstance();

        // const org = req.query.org;
        const name = config.getProp(ConfigKey.name);
        const githubRedirect = config.getProp(ConfigKey.backendUrl) + ':' + config.getProp(ConfigKey.backendPort) + '/githubCallback?name=' + name;
        Log.info("AuthRouteHandler::getAuth(..) - /auth redirect; course: " + name + "; URL: " + githubRedirect);

        const setup = {
            clientId:         config.getProp(ConfigKey.githubClientId),
            clientSecret:     config.getProp(ConfigKey.githubClientSecret),
            accessTokenUri:   config.getProp(ConfigKey.githubHost) + '/login/oauth/access_token',
            authorizationUri: config.getProp(ConfigKey.githubHost) + '/login/oauth/authorize',
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
     * Coverage won't happen because of GitHub dependencies.
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
        const backendUrl = config.getProp(ConfigKey.backendUrl);
        const backendPort = config.getProp(ConfigKey.backendPort);
        // const githubRedirect = backendUrl + ':' + backendPort + '/githubCallback?orgName=secapstone';  // SDMM HardCode
        const githubRedirect = backendUrl + ':' + backendPort + '/githubCallback?name=' + config.getProp(ConfigKey.name);
        Log.info('AuthRouteHandler::githubCallback(..) - / githubCallback; URL: ' + githubRedirect);

        const opts = {
            clientId:         config.getProp(ConfigKey.githubClientId),
            clientSecret:     config.getProp(ConfigKey.githubClientSecret),
            accessTokenUri:   config.getProp(ConfigKey.githubHost) + '/login/oauth/access_token',
            authorizationUri: config.getProp(ConfigKey.githubHost) + '/login/oauth/authorize',
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
                uri:     config.getProp(ConfigKey.githubAPI) + '/user',
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
                kind:   null, // isPriv will fill this in on demand
                URL:    Config.getInstance().getProp(ConfigKey.githubHost) + '/' + username,
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
            let feUrl = config.getProp(ConfigKey.frontendUrl);
            let fePort = config.getProp(ConfigKey.frontendPort);

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
