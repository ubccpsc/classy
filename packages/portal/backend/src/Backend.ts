/**
 * Created by rtholmes on 2018-02-23.
 */

import Log from "../../../common/Log";
import Config, {ConfigCourses} from "../../../common/Config";

import BackendServer from "./server/BackendServer";

export class Backend {

    private server: BackendServer = null;

    constructor() {
        Log.info('Backend::<init> - start');
        //  App.config = <IConfig>Config;
    }

    public async start(): Promise<boolean> {
        Log.info('Backend::start() - start');

        // handle any config changes (specifically dev vs prod)
        if (this.server === null) {
            this.server = new BackendServer();
        }

        return this.server.start().then(function () {
            Log.info("Backend::start() - server started");
            return true;
        }).catch(function (err) {
            Log.info("Backend::start() - server staring - ERROR: " + err);
            return false;
        });
    }

    public async stop(): Promise<boolean> {
        Log.info('Backend::stop() - start');

        // handle any config changes (specifically dev vs prod)
        if (this.server !== null) {
            return this.server.stop().then(function () {
                Log.info("Backend::stop() - server stopped");
                return true;
            }).catch(function (err) {
                Log.info("Backend::stop() - server stopping - ERROR: " + err);
                return false;
            });
        } else {
            Log.info('Backend::stop() - server not defined');
            return false;
        }

    }

}

// This ends up starting the whole system
Log.info("Backend - starting");
Config.getInstance();
const app = new Backend();
app.start().then(function (success) {
    if (success === true) {
        Log.info("Backend - start success");
    } else {
        Log.info("Backend - start failure");
    }
}).catch(function (err) {
    Log.info("Backend - start ERROR: " + err);
});


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

