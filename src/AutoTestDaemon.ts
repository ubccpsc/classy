/**
 * Created by rtholmes on 2016-06-19.
 */

import Log from "./Log";
import Server from './Server';
// import {IConfig, AppConfig} from './Config';
// import MongoDB from './db/MongoDB';

/**
 * Starts the server; doesn't listen to whether the start was successful.
 */
export class AutoTestDaemon {

    // private config: IConfig = new AppConfig();

    public initServer() {
        const courseNums = [310]; // this.config.getCourseNums();
        Log.info("AutoTestDaemon::initServer() - start");

        for (const courseNum of courseNums) {

            // 1 + because ports under 1000 need 'sudo' priviledges
            // which is a potential security risk
            const portNum = Number("1" + courseNum);

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
}

// This ends up starting the whole system and listens on a hardcoded port (4321)
Log.info("AutoTest Daemon - starting");
const app = new AutoTestDaemon();
app.initServer();
