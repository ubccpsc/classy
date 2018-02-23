/**
 * Created by rtholmes on 2016-06-19.
 */

import restify = require('restify');
import Log from "./Util/Log";

var Config = require("../../Config");

import * as fs from "fs";
import * as rp from "request-promise-native";

import ClientOAuth2 = require("client-oauth2");

// import RouteHandler from './RouteHandler';

/**
 * This configures the REST endpoints for the server.
 */
export default class FrontEndServer {

    private port: number;
    private rest: restify.Server;

    constructor(port: number) {
        Log.info("Server::<init>( " + port + " )");

        this.port = port;
    }

    /**
     * Stops the server. Again returns a promise so we know when the connections have
     * actually been fully closed and the port has been released.
     *
     * @returns {Promise<boolean>}
     */
    public stop(): Promise<boolean> {
        Log.info('Server::close()');
        let that = this;
        return new Promise(function (fulfill) {
            that.rest.close(function () {
                fulfill(true);
            });
        });
    }

    /**
     * Starts the server. Returns a promise with a boolean value. Promises are used
     * here because starting the server takes some time and we want to know when it
     * is done (and if it worked).
     *
     * @returns {Promise<boolean>}
     */
    public start(): Promise<boolean> {
        let that = this;
        return new Promise(function (fulfill, reject) {
            try {
                Log.info('FrontEndServer::start() - start');

                var https_options = {
                    name:        'frontend',
                    key:         fs.readFileSync(Config.sslKeyPath),
                    certificate: fs.readFileSync(Config.sslCertPath)
                };

                that.rest = restify.createServer(https_options);

                that.rest.use(function crossOrigin(req, res, next) {
                    res.header("Access-Control-Allow-Origin", "*");
                    res.header("Access-Control-Allow-Headers", "X-Requested-With");
                    return next();
                });

                var githubAuth = new ClientOAuth2({
                    clientId:         Config.githubClientId,
                    clientSecret:     Config.githubClientSecret,
                    accessTokenUri:   'https://github.com/login/oauth/access_token',
                    authorizationUri: 'https://github.com/login/oauth/authorize',
                    redirectUri:      'https://localhost:3000/githubCallback',
                    scopes:           ['']
                });

                that.rest.get('/auth', function (req, res, next) {
                    Log.info("FES - /auth redirect start");
                    const uri = githubAuth.code.getUri();
                    res.redirect(uri, next);
                });

                let token: string;
                that.rest.get('/githubCallback', function (req: any, res, next) {
                    Log.info("FES - /githubCallback - start");
                    githubAuth.code.getToken(req.url).then(function (user) {
                        Log.trace("FES - token aquired");

                        token = user.accessToken;
                        var options = {
                            uri:     'https://api.github.com/user',
                            method:  'GET',
                            headers: {
                                'Content-Type':  'application/json',
                                'User-Agent':    'Portal',
                                'Authorization': 'token ' + token
                            }
                        };

                        return rp(options);
                    }).then(function (ans) {
                        Log.info("FES - /githubCallback - GH username received");
                        const body = JSON.parse(ans);
                        const username = body.login;
                        Log.info("FES - /githubCallback - GH username: " + username);

                        // only header method that worked for me
                        res.setHeader("Set-Cookie", "token=" + token);
                        res.redirect({
                            hostname: 'localhost',
                            pathname: '/index.html',
                            port:     3000,                 // defaults to 80
                            secure:   true,             // sets https
                        }, next);

                        // res.redirect('https://localhost:3000/index.html', next);
                        // res.send({success: true, data: 'myFoo'});
                    }).catch(function (err) {
                        // code incorrect or expired
                        Log.error("FES - /githubCallback - ERROR: " + err);
                        return next();
                    });
                    // return next();
                });

                that.rest.get('/getCredentials', function (req: any, res, next) {
                    Log.trace('FES - /getCredentials - start');
                    const user = req.headers.user;
                    const token = req.headers.token;
                    Log.trace('FES - /getCredentials; user: ' + user + '; token: ' + token);
                    if (typeof user !== 'undefined' && typeof token !== 'undefined') {
                        // TODO: look this up and send something real
                        res.send({user: user, token: token, kind: 'student'});
                    } else {
                        res.send(400, {error: "invalid user"});
                    }
                });

                // serves up the root directory
                that.rest.get('/\/.*/', restify.plugins.serveStatic({
                        directory: 'frontend/html',
                        default:   'index.html'
                    })
                );

                that.rest.listen(that.port, function () {
                    Log.info('FrontEndServer::start() - restify listening: ' + that.rest.url);
                    fulfill(true);
                });

                that.rest.on('error', function (err: string) {
                    // catches errors in restify start; unusual syntax due to internal node not using normal exceptions here
                    Log.info('FrontEndServer::start() - restify ERROR: ' + err);
                    reject(err);
                });
            } catch (err) {
                Log.error('FrontEndServer::start() - ERROR: ' + err);
                reject(err);
            }
        });
    }
}

const server = new FrontEndServer(3000);
server.start().then(function () {
    Log.info("FrontEndServer - started");
}).catch(function (err) {
    Log.info("FrontEndServer - ERROR: " + err);
});
