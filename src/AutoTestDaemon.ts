/**
 * Created by rtholmes on 2016-06-19.
 */

import Server from "./server/Server";
import Log from "./util/Log";
import {Config} from "./Config";
// import {IConfig, AppConfig} from './Config';
// import MongoDB from './db/MongoDB';

/**
 * Starts the server; doesn't listen to whether the start was successful.
 */
export class AutoTestDaemon {

    // private config: IConfig = new AppConfig();

    public initServer() {
        Log.info("AutoTestDaemon::initServer() - start");

        const portNum = Number(Config.getInstance().getProp("port"));

        // start server
        const s = new Server();
        s.setPort(portNum);
        s.start().then(function (val: boolean) {
            Log.info("AutoTestDaemon::initServer() - started: " + val);
        }).catch(function (err: Error) {
            Log.error("AutoTestDaemon::initServer() - ERROR: " + err.message);
        });
    }

}

// This ends up starting the whole system and listens on a hardcoded port (4321)
Log.info("AutoTest Daemon - starting");
if (process.argv.length < 3) {
    Log.error("AutoTest Daemon - missing runtime param: node AutoTestDaemon.js <courseName>");
} else {
    Config.getInstance(process.argv[2]);
    const app = new AutoTestDaemon();
    app.initServer();
}


Log.info("AutoTestDaemon - registering unhandled rejection");

process.on('unhandledRejection', (reason, p) => {
    // Prevent error output on the console:
    Log.error('ATD: Unhandled Rejection at: ', p, '; reason:', reason);
    Log.error('AutoTestDaemon - unhandled promise: ' + (<any>JSON.stringify(reason)));
});
Log.info("AutoTestDaemon - registering unhandled rejection; done");
// Promise.reject('test unhandler');
