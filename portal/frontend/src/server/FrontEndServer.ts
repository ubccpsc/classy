/**
 * Created by rtholmes on 2016-06-19.
 */

import restify = require('restify');
import Log from "../app/util/Log";
import * as fs from "fs";
import {Config} from "./Config";

// var Config = require("../../Config");

/**
 * This configures the REST endpoints for the server.
 */
export default class FrontEndServer {

    // private port: number;
    private rest: restify.Server;

    constructor() {
        Log.info("Server::<init> - start");
        Config.getInstance();
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
                    key:         fs.readFileSync(Config.getInstance().getProp('sslKeyPath')),
                    certificate: fs.readFileSync(Config.getInstance().getProp('sslCertPath'))
                };

                that.rest = restify.createServer(https_options);

                that.rest.use(function crossOrigin(req, res, next) {
                    res.header("Access-Control-Allow-Origin", "*");
                    res.header("Access-Control-Allow-Headers", "X-Requested-With");
                    return next();
                });

                // serves up the root directory
                that.rest.get('/\/.*/', restify.plugins.serveStatic({
                        directory: 'html',
                        default:   'index.html'
                    })
                );

                that.rest.listen(Config.getInstance().getProp('frontendPort'), function () {
                    Log.info('FrontEndServer::start() - restify listening: ' + that.rest.url);
                    fulfill(true);
                });

                that.rest.on('error', function (err: string) {
                    // catches errors in restify start; unusual syntax due to internal node not using normal exceptions here
                    Log.info('FrontEndServer::start() - restify ERROR: ' + err);
                    reject(err);
                });


                // forward port 80 to production port
                // Log.info('FrontEndServer::Creating forward - start');
                // const nonSecure = restify.createServer({name: 'redirectToSSL'});
                // nonSecure.get(/.*/, function (req, res, next) {
                //     const url = Config.getInstance().getProp('frontendUrl') + ':' + Config.getInstance().getProp('frontendPort') + req.getUrl().href;
                //     res.redirect(301, url, next);
                // });
                // nonSecure.on('error', function (err) {
                //     Log.warn('FrontEndServer::Creating forward failed; need sudo? ERROR: ' + err.message);
                // });
                // nonSecure.listen(80, function () {
                //     Log.info('FrontEndServer::Creating forward - listening on 80');
                // });
                // Log.info('FrontEndServer::Creating forward - done');

            } catch (err) {
                Log.error('FrontEndServer::start() - ERROR: ' + err);
                reject(err);
            }
        });
    }
}

/**
 * not sure we can validate this here
 */
export interface IConfig {
    githubClientId: string;
    githubClientSecret: string;
    sslCertPath: string;
    sslKeyPath: string;
    sslIntCert: string;
    frontendPort: number;
    backendPort: number;
    frontendUrl: string;
    backendUrl: string;
}


Log.info("FrontEndServer - port: " + Config.getInstance().getProp('frontendPort'));
const server = new FrontEndServer();
server.start().then(function () {
    Log.info("FrontEndServer - started");
}).catch(function (err) {
    Log.info("FrontEndServer - ERROR: " + err);
});
