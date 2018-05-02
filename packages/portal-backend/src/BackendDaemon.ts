/**
 * Created by rtholmes on 2018-02-23.
 */

import Log from "../../common/Log";
import BackendServer from "./BackendServer";
import {Config} from "../../common/Config";

// const Config = require("../../common/Config");

export class BackendDaemon {

    constructor() {
        Log.info('BackendDaemon::<init> - start');
        //  App.config = <IConfig>Config;
    }

    public init() {
        Log.info('BackendDaemon::init() - start');

        // handle any config changes (specifically dev vs prod)
        const server = new BackendServer();
        server.start().then(function () {
            Log.info("BackendDaemon::init() - server started");
        }).catch(function (err) {
            Log.info("BackendDaemon::init() - server staring - ERROR: " + err);
        });
        Log.info('BackendDaemon::init() - done');
    }
}

// This ends up starting the whole system
Log.info("BackendDaemon - starting");

Config.getInstance();
const app = new BackendDaemon();
app.init();

Log.info("BackendDaemon - started");

// Unhandled rejection checking code; this isn't great, but is better than being surprised
Log.info("BackendDaemon - registering unhandled rejection");
process.on('unhandledRejection', (reason, p) => {
    try {
        Log.error('BackendDaemon - unhandled promise'); // in case next line fails
        console.log('BackendDaemon - unhandled rejection at: ', p, '; reason:', reason);
        Log.error('BackendDaemon - unhandled promise: ' + (<any>JSON.stringify(reason)));
    } catch (err) {
        // eat any error
    }
});
Log.info("BackendDaemon - registering unhandled rejection; done");
// Promise.reject('foo');

