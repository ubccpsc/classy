/**
 * Created by rtholmes on 2018-02-23.
 */

import Log from "./util/Log";
import BackendServer from "./BackendServer";
import {Config} from "./Config";
import {PersonController} from "./controllers/PersonController";

// const Config = require("../Config");

export class PortalBackend {

    constructor() {
        Log.info('PortalBackend::<init> - start');
        //  App.config = <IConfig>Config;
    }

    public init() {
        Log.info('PortalBackend::init() - start');

        // handle any config changes (specifically dev vs prod)
        const server = new BackendServer();
        server.start().then(function () {
            Log.info("PortalBackend::init() - server started");
        }).catch(function (err) {
            Log.info("PortalBackend::init() - server staring - ERROR: " + err);
        });
        Log.info('PortalBackend::init() - done');
    }
}


// This ends up starting the whole system
Log.info("PortalBackend - starting");
if (process.argv.length < 3) {
    Log.error("PortalBackend - missing runtime param: node PortalBackend.js <courseName>");
} else {
    const confKey = process.argv[2];
    Log.info("PortalBackend - initiating configuration: " + confKey);
    Config.getInstance(confKey);
    // Log.trace("PortalBackend - initiating configuration: " + Config.getInstance());
    const app = new PortalBackend();
    app.init();
}

// Unhandled rejection checking code; this isn't great, but is better than being surprised
Log.info("PortalBackend - registering unhandled rejection");
process.on('unhandledRejection', (reason, p) => {
    try {
        Log.error('PortalBackend - unhandled promise'); // in case next line fails
        console.log('PortalBackend - unhandled rejection at: ', p, '; reason:', reason);
        Log.error('PortalBackend - unhandled promise: ' + (<any>JSON.stringify(reason)));
    } catch (err) {
        // eat any error
    }
});
Log.info("PortalBackend - registering unhandled rejection; done");
// Promise.reject('foo');

