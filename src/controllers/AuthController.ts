import Log from "../util/Log";
import * as rp from "request-promise-native";
import {PersonController} from "./PersonController";
import {Config} from "../Config";
import ClientOAuth2 = require("client-oauth2");

export class AuthController {

    public static getCredentials(req: any, res: any, next: any) {
        Log.trace('BES - /getCredentials - start GET');
        const user = req.headers.user;
        const token = req.headers.token;
        Log.trace('BES - /getCredentials; user: ' + user + '; token: ' + token);
        if (typeof user !== 'undefined' && typeof token !== 'undefined') {
            // TODO: look this up and send something real
            res.send({user: user, token: token, kind: 'student'});
        } else {
            res.send(400, {error: "invalid user"});
        }
    }

    public static getAuth(req: any, res: any, next: any) {
        Log.info("BES - /auth redirect start");
        let config = Config.getInstance();

        const courseId = req.query.course;
        Log.info("BES - /auth redirect; course: " + courseId);
        const githubRedirect = config.getProp('backendUrl') + ':' + config.getProp('backendPort') + '/githubCallback?course=' + courseId;
        var githubAuth = new ClientOAuth2({
            clientId:         config.getProp('githubClientId'),
            clientSecret:     config.getProp('githubClientSecret'),
            accessTokenUri:   config.getProp('githubHost') + 'login/oauth/access_token',
            authorizationUri: config.getProp('githubHost') + 'login/oauth/authorize',
            redirectUri:      githubRedirect,
            scopes:           ['']
        });

        const uri = githubAuth.code.getUri();
        res.redirect(uri, next);
    }

    public static githubCallback(req: any, res: any, next: any) {
        Log.info("BES - /githubCallback - start");
        let config = Config.getInstance();
        const courseId = req.query.course;

        let personController = new PersonController();

        //const githubRedirect = App.config.backendUrl + ':' + App.config.backendPort + '/githubCallback';
        var githubAuth = new ClientOAuth2({
            clientId:         config.getProp('githubClientId'),
            clientSecret:     config.getProp('githubClientSecret'),
            accessTokenUri:   config.getProp('githubHost') + 'login/oauth/access_token',
            authorizationUri: config.getProp('githubHost') + 'login/oauth/authorize',
            //  redirectUri:      githubRedirect,
            scopes:           ['']
        });

        let token: string | null = null;
        githubAuth.code.getToken(req.url).then(function (user) {
            Log.trace("BES - token aquired");

            token = user.accessToken;
            var options = {
                uri:     config.getProp('githubAPI') + 'user',
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
            Log.info("BES - /githubCallback - GH username received");
            const body = JSON.parse(ans);
            const username = body.login;
            Log.info("BES - /githubCallback - GH username: " + username);

            return personController.configureUsername(courseId, username)
        }).then(function (validUser) {
            let url = config.getProp('frontendUrl');
            if (validUser === true) {
                // only header method that worked for me
                res.setHeader("Set-Cookie", "token=" + token);
                Log.info("BES - /githubCallback - url: " + config.getProp('frontendUrl') + "; port: " + config.getProp('frontendPort'));
                if (url.indexOf('//') > 0) {
                    url = url.substr(url.indexOf('//') + 2, url.length);
                }
                res.redirect({
                    hostname: url,
                    pathname: '/index.html',
                    port:     config.getProp('frontendPort')
                }, next);
            } else {
                // TODO: specify unknown user (SDMM will always be true, but for future courses this won't be true)
                res.redirect({
                    hostname: url,
                    pathname: '/index.html',
                    port:     config.getProp('frontendPort')
                }, next);
            }
            // res.redirect('https://localhost:3000/index.html', next);
            // res.send({success: true, data: 'myFoo'});

        }).catch(function (err) {
            // code incorrect or expired
            Log.error("BES - /githubCallback - ERROR: " + err);
            return next();
        });
    }

    // from restify #284
    public static handlePreflight(req: any, res: any) {
        Log.trace("BES - MethodNotAllowed - " + req.method.toLowerCase() + "; uri: " + req.url);

        if (req.method.toLowerCase() === 'options') {

            var allowHeaders = ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version', 'user', 'token'];
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

            Log.trace("BES - MethodNotAllowed - sending 204");
            return res.send(204);
        } else {
            Log.trace("BES - MethodNotAllowed - sending 405");
            return res.send(405);
        }
    }


}