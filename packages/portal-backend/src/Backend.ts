/**
 * Created by rtholmes on 2018-02-23.
 */

import Log from "../../common/Log";
import Config from "../../common/Config";

import BackendServer from "./server/BackendServer";

export class Backend {

    constructor() {
        Log.info('Backend::<init> - start');
        //  App.config = <IConfig>Config;
    }

    public init() {
        Log.info('Backend::init() - start');

        // handle any config changes (specifically dev vs prod)
        const server = new BackendServer();
        server.start().then(function () {
            Log.info("Backend::init() - server started");
        }).catch(function (err) {
            Log.info("Backend::init() - server staring - ERROR: " + err);
        });
        Log.info('Backend::init() - done');
    }
}

// This ends up starting the whole system
Log.info("Backend - starting");

Config.getInstance();
const app = new Backend();
app.init();

Log.info("Backend - started");

// Unhandled rejection checking code; this isn't great, but is better than being surprised
Log.info("Backend - registering unhandled rejection");
process.on('unhandledRejection', (reason, p) => {
    try {
        Log.error('Backend - unhandled promise'); // in case next line fails
        console.log('Backend - unhandled rejection at: ', p, '; reason:', reason);
        Log.error('Backend - unhandled promise: ' + (<any>JSON.stringify(reason)));
    } catch (err) {
        // eat any error
    }
});
Log.info("Backend - registering unhandled rejection; done");
// Promise.reject('foo');

