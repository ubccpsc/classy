/**
 * Created by rtholmes on 2018-02-23.
 */
import restify = require('restify');
import Log from "../../common/Log";

import * as fs from "fs";
import {Config} from "../../common/Config";
import {RouteHandler} from "./RouteHandler";
import {Factory} from "./Factory";

// import RouteHandler from './RouteHandler';

/**
 * This configures the REST endpoints for the server.
 */
export default class BackendServer {

    private rest: restify.Server;
    private config: Config = null;
    private useHttps = false;

    constructor(useHttps = true) {
        Log.info("BackendServer::<init> - start");
        this.config = Config.getInstance();
        this.useHttps = useHttps;
    }

    /**
     * Used in tests.
     *
     * @returns {Server}
     */
    public getServer(): restify.Server {
        Log.trace('BackendServer::getServer()');
        return this.rest;
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
                let https_options: any = {
                    name:        'backend',
                    key:         fs.readFileSync(that.config.getProp('sslKeyPath')),
                    certificate: fs.readFileSync(that.config.getProp('sslCertPath'))
                };

                if (that.useHttps === false) {
                    Log.warn('BackendServer::start() - disabling HTTPS; should only be used in testing!');
                    https_options = {name: 'backend'};
                }

                that.rest = restify.createServer(https_options);

                that.rest.use(restify.plugins.queryParser());
                that.rest.use(restify.plugins.bodyParser({mapParams: true})); // NEW

                that.rest.use(function crossOrigin(req, res, next) {
                    res.header("Access-Control-Allow-Origin", "*");
                    res.header("Access-Control-Allow-Headers", "X-Requested-With Content-Type token user org");
                    return next();
                });

                /**
                 * Authentication
                 */
                that.rest.on('MethodNotAllowed', RouteHandler.handlePreflight); // preflights cors requests
                that.rest.get('/getCredentials', RouteHandler.getCredentials);
                that.rest.get('/auth', RouteHandler.getAuth);
                that.rest.get('/githubCallback', RouteHandler.githubCallback);


                /**
                 * UI routes
                 */
                that.rest.get('/currentStatus', RouteHandler.getCurrentStatus);


                /**
                 * AutoTest routes
                 */
                that.rest.get('/defaultDeliverable/:org', RouteHandler.atDefaultDeliverable);
                that.rest.get('/isStaff/:org/:personId', RouteHandler.atIsStaff);
                that.rest.get('/container/:org/:delivId', RouteHandler.atContainerDetails);
                that.rest.post('/grade/:org/:repoId/:delivId', RouteHandler.atGradeResult);
                that.rest.post('/githubWebhook', RouteHandler.githubWebhook); // forward GitHub Webhooks to AutoTest

                /**
                 * Register custom route handler.
                 */
                Factory.getCustomRouteHandler().registerRoutes(that.rest);

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
