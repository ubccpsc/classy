/**
 * Created by rtholmes on 2018-02-23.
 */
import * as fs from "fs";
import * as restify from "restify";

import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";

import {Factory} from "../Factory";
import AdminRoutes from "./common/AdminRoutes";
import {AuthRoutes} from "./common/AuthRoutes";
import {AutoTestRoutes} from "./common/AutoTestRoutes";
import GeneralRoutes from "./common/GeneralRoutes";

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
        const that = this;
        return new Promise(function(fulfill) {
            that.rest.close(function() {
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

        const that = this;
        return new Promise(function(fulfill, reject) {

            // noinspection TsLint
            let https_options: any = {
                name:        'backend',
                key:         fs.readFileSync(that.config.getProp(ConfigKey.sslKeyPath)),
                certificate: fs.readFileSync(that.config.getProp(ConfigKey.sslCertPath))
            };

            if (that.useHttps === false) {
                Log.warn('BackendServer::start() - disabling HTTPS; should only be used in testing!');
                https_options = {name: 'backend'};
            }

            that.rest = restify.createServer(https_options);
            that.rest.use(restify.plugins.queryParser());
            that.rest.use(restify.plugins.bodyParser({mapParams: true}));

            that.rest.use(function crossOrigin(req, res, next) {
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "X-Requested-With Content-Type token user org");
                return next();
            });

            // Register handlers common between all classy instances
            Log.info('BackendServer::start() - Registering common handlers');

            // authentication
            new AuthRoutes().registerRoutes(that.rest);

            // autotest
            new AutoTestRoutes().registerRoutes(that.rest);

            // general
            new GeneralRoutes().registerRoutes(that.rest);

            // admin
            new AdminRoutes().registerRoutes(that.rest);

            Log.info('BackendServer::start() - Registering common handlers; done');

            // Register custom route handler for specific classy instance
            Log.info('BackendServer::start() - Registering custom handler');

            Factory.getCustomRouteHandler().registerRoutes(that.rest);

            Log.info('BackendServer::start() - Registering custom handler; done');

            // serve up the static frontend resources
            that.rest.get('/\/.*/', restify.plugins.serveStatic({
                directory: __dirname + '/../../../frontend/html',
                default:   'index.html'
            }));

            that.rest.listen(that.config.getProp(ConfigKey.backendPort), function() {
                Log.info('BackendServer::start() - restify listening: ' + that.rest.url);
                fulfill(true);
            });

            that.rest.on('error', function(err: string) {
                // catches errors in restify start; unusual syntax due to internal node not using normal exceptions here
                Log.error('BackendServer::start() - restify ERROR: ' + err);
                reject(err);
            });
        });
    }
}
