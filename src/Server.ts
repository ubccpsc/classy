/**
 * Created by rtholmes on 2018-02-23.
 */

import restify = require('restify');
import Log from "./Util/Log";

import * as fs from "fs";
import * as rp from "request-promise-native";

import ClientOAuth2 = require("client-oauth2");
import {App} from "./App";
import {AuthController} from "./controllers/AuthController";
import {IConfig} from "./Types";

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
                    key:         fs.readFileSync(App.config.sslKeyPath),
                    certificate: fs.readFileSync(App.config.sslCertPath)
                };

                that.rest = restify.createServer(https_options);

                that.rest.use(restify.plugins.queryParser());

                that.rest.use(function crossOrigin(req, res, next) {
                    res.header("Access-Control-Allow-Origin", "*");
                    res.header("Access-Control-Allow-Headers", "X-Requested-With Content-Type token user");
                    return next();
                });


                /**
                 * Authentication
                 */
                that.rest.on('MethodNotAllowed', AuthController.handlePreflight); // preflights cors requests
                that.rest.get('/getCredentials', AuthController.getCredentials);
                that.rest.get('/auth', AuthController.getAuth);
                that.rest.get('/githubCallback', AuthController.githubCallback);


                /**
                 * Serve up index.html; not needed for server backend
                 */
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
