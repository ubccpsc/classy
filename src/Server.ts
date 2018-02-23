/**
 * Created by rtholmes on 2018-02-23.
 */

import restify = require('restify');
import Log from "./Util/Log";

import * as fs from "fs";
import * as rp from "request-promise-native";

import ClientOAuth2 = require("client-oauth2");
import {IConfig} from "./App";

// import RouteHandler from './RouteHandler';

/**
 * This configures the REST endpoints for the server.
 */
export default class BackEndServer {

    private rest: restify.Server;
    private config: IConfig;

    constructor(config: IConfig) {
        Log.info("BackEndServer::<init> - start");
        this.config = config;
    }

    /**
     * Stops the server. Again returns a promise so we know when the connections have
     * actually been fully closed and the port has been released.
     *
     * @returns {Promise<boolean>}
     */
    public stop(): Promise<boolean> {
        Log.info('BackEndServer::stop() - start');
        let that = this;
        return new Promise(function (fulfill) {
            that.rest.close(function () {
                Log.info('BackEndServer::stop() - done');
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
                Log.info('BackEndServer::start() - start');

                var https_options = {
                    name:        'backend',
                    key:         fs.readFileSync(that.config.sslKeyPath),
                    certificate: fs.readFileSync(that.config.sslCertPath)
                };

                that.rest = restify.createServer(https_options);

                // from restify #284
                // that.rest.use(restify.plugins.fullResponse());

                that.rest.use(function crossOrigin(req, res, next) {
                    res.header("Access-Control-Allow-Origin", "*");
                    res.header("Access-Control-Allow-Headers", "X-Requested-With Content-Type token user");
                    return next();
                });

                // from restify #284
                // this preflights cors requests. needed on localhost, not sure about in prod
                that.rest.on('MethodNotAllowed', function (req, res) {
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
                });

                that.rest.get('/getCredentials', function (req: any, res, next) {
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
                });

                const githubRedirect = that.config.backendUrl + ':' + that.config.backendPort + '/githubCallback';
                var githubAuth = new ClientOAuth2({
                    clientId:         that.config.githubClientId,
                    clientSecret:     that.config.githubClientSecret,
                    accessTokenUri:   'https://github.com/login/oauth/access_token',
                    authorizationUri: 'https://github.com/login/oauth/authorize',
                    redirectUri:      githubRedirect,
                    scopes:           ['']
                });

                that.rest.get('/auth', function (req, res, next) {
                    Log.info("BES - /auth redirect start");
                    const uri = githubAuth.code.getUri();
                    res.redirect(uri, next);
                });

                let token: string;
                that.rest.get('/githubCallback', function (req: any, res, next) {
                    Log.info("BES - /githubCallback - start");
                    githubAuth.code.getToken(req.url).then(function (user) {
                        Log.trace("BES - token aquired");

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
                        // this extra check isn't strictly required, but means we can
                        // associate a username with a token on the backend if needed
                        return rp(options);
                    }).then(function (ans) {
                        Log.info("BES - /githubCallback - GH username received");
                        const body = JSON.parse(ans);
                        const username = body.login;
                        Log.info("BES - /githubCallback - GH username: " + username);

                        // only header method that worked for me
                        res.setHeader("Set-Cookie", "token=" + token);
                        let url = that.config.frontendUrl;
                        Log.info("BES - /githubCallback - url: " + that.config.frontendUrl + "; port: " + that.config.frontendPort);
                        if (url.indexOf('//') > 0) {
                            url = url.substr(url.indexOf('//') + 2, url.length);
                        }
                        res.redirect({
                            hostname: url,
                            pathname: '/index.html',
                            port:     that.config.frontendPort
                        }, next);

                        // res.redirect('https://localhost:3000/index.html', next);
                        // res.send({success: true, data: 'myFoo'});
                    }).catch(function (err) {
                        // code incorrect or expired
                        Log.error("BES - /githubCallback - ERROR: " + err);
                        return next();
                    });
                    // return next();
                });

                // serves up the root directory
                that.rest.get('/\/.*/', restify.plugins.serveStatic({
                        directory: 'html',
                        default:   'index.html'
                    })
                );

                that.rest.listen(that.config.backendPort, function () {
                    Log.info('BackEndServer::start() - restify listening: ' + that.rest.url);
                    fulfill(true);
                });

                that.rest.on('error', function (err: string) {
                    // catches errors in restify start; unusual syntax due to internal node not using normal exceptions here
                    Log.info('BackEndServer::start() - restify ERROR: ' + err);
                    reject(err);
                });
            } catch (err) {
                Log.error('BackEndServer::start() - ERROR: ' + err);
                reject(err);
            }
        });
    }
}
