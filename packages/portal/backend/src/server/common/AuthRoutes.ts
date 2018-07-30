import * as ClientOAuth2 from "client-oauth2";
import * as rp from "request-promise-native";
import * as restify from "restify";

import Config, {ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";
import {AuthTransportPayload, Payload} from "../../../../../common/types/PortalTypes";

import {AuthController} from "../../controllers/AuthController";
import {DatabaseController} from "../../controllers/DatabaseController";
import {PersonController} from "../../controllers/PersonController";
import {Factory} from "../../Factory";
import {Auth, Person} from "../../Types";

import IREST from "../IREST";

// import ClientOAuth2 = require("client-oauth2");

/**
 * Just a large body of static methods for translating between restify and the remainder of the system.
 */
export class AuthRoutes implements IREST {

    private static ac = new AuthController();

    public registerRoutes(server: restify.Server) {
        Log.info("AuthRoutes::registerRoutes() - start");

        server.on('MethodNotAllowed', AuthRoutes.handlePreflight); // preflights cors requests

        // user endpoints
        server.get('/portal/getCredentials', AuthRoutes.getCredentials); // verify Classy credentials
        server.get('/portal/logout', AuthRoutes.getLogout);

        // GitHub OAuth endpoints
        server.get('/portal/auth', AuthRoutes.getAuth); // start GitHub OAuth flow
        server.get('/authCallback', AuthRoutes.authCallback); // finalize GitHub OAuth flow
    }

    /**
     * Work around some CORS-related issues for OAuth. This looks manky, but don't change it.
     *
     * Really.
     *
     * Code taken from restify #284
     *
     * Run often by browsers, but never with the unit test suite.
     *
     * @param req
     * @param res
     */

    /* istanbul ignore next */
    public static handlePreflight(req: any, res: any) {
        Log.trace("AuthRoutes::handlePreflight(..) - " + req.method.toLowerCase() + "; uri: " + req.url);

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

        Log.trace("AuthRoutes::handlePreflight(..) - sending 204; headers: " + JSON.stringify(res.getHeaders()));
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

        Log.info('AuthRoutes::getLogout(..) - user: ' + user + '; token: ' + token);
        let payload: Payload;

        const handleError = function(msg: string) {
            Log.error('AuthRoutes::getLogout(..) - ERROR: ' + msg);
            payload = {failure: {message: 'Logout failed: ' + msg, shouldLogout: false}};
            res.send(400, payload);
            return next();
        };

        if (user === null) {
            Log.warn('AuthRoutes::getLogout(..) - cannot logout unspecified user: ' + user);
            handleError("unknown user.");
        }

        AuthRoutes.ac.isValid(user, token).then(function(isValid) {
            if (isValid === true) {
                Log.info('AuthRoutes::getLogout(..) - user: ' + user + '; valid user');
            } else {
                // logout anyways? if your user / token is stale we still need log you out
                // but that could mean someone else could spoof-log you out too
                Log.warn('AuthRoutes::getLogout(..) - user: ' + user + '; invalid user');
            }
            // logout
            const ac = new AuthController();
            return ac.removeAuthentication(user);
        }).then(function(success) {
            if (success) {
                payload = {success: {message: "Logout successful"}};
                res.send(200, payload);
            } else {
                handleError("Logout unsuccessful.");
            }
        }).catch(function(err) {
            Log.error('AuthRoutes::getLogout(..) - unexpected ERROR: ' + err.message);
            handleError(err.message);
        });
    }

    public static getCredentials(req: any, res: any, next: any) {
        Log.trace('AuthRoutes::getCredentials(..) - start');
        const user = req.headers.user;
        const token = req.headers.token;
        Log.info('AuthRoutes::getCredentials(..) - user: ' + user + '; token: ' + token);

        let payload: AuthTransportPayload;
        AuthRoutes.performGetCredentials(user, token).then(function(isPrivileged) {
            payload = {success: {personId: user, token: token, isAdmin: isPrivileged.isAdmin, isStaff: isPrivileged.isStaff}};
            Log.info('AuthRoutes::getCredentials(..) - sending 200; isPriv: ' + (isPrivileged.isStaff || isPrivileged.isAdmin));
            res.send(200, payload);
            return next(true);
        }).catch(function(err) {
            Log.warn("AuthRoutes::getCredentials(..) - ERROR: " + err.message);
            payload = {failure: {message: err.message, shouldLogout: false}};
            res.send(400, payload);
            return next(false);
        });
    }

    private static async performGetCredentials(user: string, token: string): Promise<{isAdmin: boolean, isStaff: boolean}> {
        const isValid = await AuthRoutes.ac.isValid(user, token);
        Log.trace('AuthRoutes::getCredentials(..) - in isValid(..)');
        if (isValid === false) {
            Log.error('AuthRoutes::getCredentials(..) - isValid false');
            throw new Error("Login error; user not valid.");
        }
        Log.trace('AuthRoutes::getCredentials(..) - isValid true');
        let isPrivileged = await AuthRoutes.ac.isPrivileged(user, token);

        if (typeof isPrivileged === 'undefined' || isPrivileged === null) {
            Log.warn('AuthRoutes::getCredentials(..) - failsafe; DEBUG this case?');
            isPrivileged = {isAdmin: false, isStaff: false}; // fail safe
        }
        return {isAdmin: isPrivileged.isAdmin, isStaff: isPrivileged.isStaff};
    }

    /**
     * Requires manual testing w/ live GitHub instance.
     */

    /* istanbul ignore next */
    public static getAuth(req: any, res: any, next: any) {
        Log.trace("AuthRoutes::getAuth(..) - /auth redirect start");

        const config = Config.getInstance();
        const setup = {
            clientId:         config.getProp(ConfigKey.githubClientId),
            clientSecret:     config.getProp(ConfigKey.githubClientSecret),
            accessTokenUri:   config.getProp(ConfigKey.githubHost) + '/login/oauth/access_token',
            authorizationUri: config.getProp(ConfigKey.githubHost) + '/login/oauth/authorize',
            scopes:           ['']
        };

        const githubAuth = new ClientOAuth2(setup);
        const uri = githubAuth.code.getUri();
        Log.info("AuthRoutes::getAuth(..) - /auth uri: " + uri + "; setup: " + JSON.stringify(setup));
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

    /* istanbul ignore next */
    public static authCallback(req: any, res: any, next: any) {
        Log.trace("AuthRoutes::authCallback(..) - /authCallback - start");
        const config = Config.getInstance();
        const personController = new PersonController();

        // Log.trace('req: ' + req + '; res: ' + res + '; next: ' + next);

        const opts = {
            clientId:         config.getProp(ConfigKey.githubClientId),
            clientSecret:     config.getProp(ConfigKey.githubClientSecret),
            accessTokenUri:   config.getProp(ConfigKey.githubHost) + '/login/oauth/access_token',
            authorizationUri: config.getProp(ConfigKey.githubHost) + '/login/oauth/authorize',
            scopes:           ['']
        };

        const githubAuth = new ClientOAuth2(opts);
        let token: string | null = null;
        let p: Person = null;
        let username: string | null = null;

        Log.trace("AuthRoutes::authCallback(..) - /authCallback - setup: " + JSON.stringify(opts));

        githubAuth.code.getToken(req.url).then(function(user) {
            Log.trace("AuthRoutes::authCallback(..) - token acquired");

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
            // associate a GitHub username with a token on the backend
            return rp(options);
        }).then(function(ans) {
            // we now have a github username

            Log.info("AuthRoutes::authCallback(..) - /portal/authCallback - GH username received");
            const body = JSON.parse(ans);
            username = body.login;
            Log.info("AuthRoutes::authCallback(..) - /portal/authCallback - GH username: " + username);

            return personController.getGitHubPerson(username);
        }).then(function(person: Person | null) {
            // we now know if that github username is known for the course

            if (person === null) {
                Log.info("AuthRoutes::authCallback(..) - /portal/authCallback - github username not registered");
                const cc = Factory.getCourseController();
                return cc.handleUnknownUser(username);
            } else {
                Log.info("AuthRoutes::authCallback(..) - /portal/authCallback - github username IS registered");
                return Promise.resolve(person);
            }
        }).then(function(person: Person | null) {
            // now we either have the person in the course or there will never be one

            if (person !== null) {
                Log.info("AuthRoutes::authCallback(..) - /portal/authCallback - registering auth for person: " + person.githubId);
                const auth: Auth = {
                    personId: person.id, // use person.id, not username (aka githubId)
                    token:    token
                };
                p = person;
                return DatabaseController.getInstance().writeAuth(auth);
            } else {
                // auth not written
                Log.info("AuthRoutes::authCallback(..) - /portal/authCallback - not registering auth");
            }

        }).then(function() { // authWritten
            // auth written (or not); we only really care about the state of p at this point

            Log.info("AuthRoutes::authCallback(..) - preparing redirect for: " + JSON.stringify(p));

            let feUrl = req.headers.host;
            if (feUrl.indexOf('//') > 0) {
                feUrl = feUrl.substr(feUrl.indexOf('//') + 2, feUrl.length);
            }
            let fePort = 443; // default to ssl port
            if (feUrl.indexOf(':') > 0) {
                fePort = feUrl.substr(feUrl.indexOf(':') + 1, feUrl.length);
                feUrl = feUrl.substr(0, feUrl.indexOf(':'));
            }

            Log.trace("AuthRoutes::authCallback(..) - /authCallback - redirect hostname: " + feUrl + "; fePort: " + fePort);

            if (p !== null) {
                // this is tricky; need to redirect to the client with a cookie being set on the connection
                // only header method that worked for me
                // res.setHeader("Set-Cookie", "token=" + token);
                const cookie = "token=" + token + '__' + p.id; // Firefox doesn't like multiple tokens (line above)
                res.setHeader("Set-Cookie", cookie);
                Log.trace("AuthRoutes::authCallback(..) - /authCallback - redirect homepage; cookie: " + cookie);

                res.redirect({
                    hostname: feUrl,
                    pathname: 'index.html',
                    port:     fePort
                }, next);
            } else {
                Log.info("AuthRoutes::authCallback(..) - /authCallback - person (GitHub id: " + username +
                    " ) not registered for course; redirecting to invalid user screen.");
                res.redirect({
                    hostname: feUrl,
                    pathname: 'invalid.html',
                    port:     fePort
                }, next);
            }
        }).catch(function(err) {
            // code incorrect or expired
            Log.error("AuthRoutes::authCallback(..) - /authCallback - ERROR: " + err);
            // NOTE: should this be returning 400 or something?
            return next();
        });
    }
}
