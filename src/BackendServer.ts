/**
 * Created by rtholmes on 2018-02-23.
 */
import restify = require('restify');
import Log from "./Util/Log";

import * as fs from "fs";
import {AuthController} from "./controllers/AuthController";
import {Config} from "./Config";
import {SDDMREST} from "./controllers/SDDMREST";

// import RouteHandler from './RouteHandler';

/**
 * This configures the REST endpoints for the server.
 */
export default class BackendServer {

    private rest: restify.Server;
    private config: Config = null;

    constructor() {
        Log.info("BackendServer::<init> - start");
        this.config = Config.getInstance();
    }

    /**
     * Stops the server. Again returns a promise so we know when the connections have
     * actually been fully closed and the port has been released.
     *
     * @returns {Promise<boolean>}
     */
    public stop(): Promise<boolean> {
        Log.info('BackendServer::stop() - start');
        let that = this;
        return new Promise(function (fulfill) {
            that.rest.close(function () {
                Log.info('BackendServer::stop() - done');
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
        Log.info('BackendServer::start() - start');
        Log.info('BackendServer::start() - config: ' + this.config);

        let that = this;
        return new Promise(function (fulfill, reject) {
            try {
                var https_options = {
                    name:        'backend',
                    key:         fs.readFileSync(that.config.getProp('sslKeyPath')),
                    certificate: fs.readFileSync(that.config.getProp('sslCertPath'))
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

                that.rest.get('/currentStatus', SDDMREST.getCurrentStatus);
                that.rest.post('/performAction', SDDMREST.performAction);

                /**
                 * Serve up index.html; not needed for server backend
                 */
                // that.rest.get('/\/.*/', restify.plugins.serveStatic({
                //        directory: 'html',
                //        default:   'index.html'
                //    })
                //);

                that.rest.listen(that.config.getProp('backendPort'), function () {
                    Log.info('BackendServer::start() - restify listening: ' + that.rest.url);
                    fulfill(true);
                });

                that.rest.on('error', function (err: string) {
                    // catches errors in restify start; unusual syntax due to internal node not using normal exceptions here
                    Log.info('BackendServer::start() - restify ERROR: ' + err);
                    reject(err);
                });
            } catch (err) {
                Log.error('BackendServer::start() - ERROR: ' + err);
                reject(err);
            }
        });
    }
}
