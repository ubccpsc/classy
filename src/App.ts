/**
 * Created by rtholmes on 2018-02-23.
 */

import Log from "./util/Log";
import FrontEndServer from "./Server";

const Config = require("../Config");

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
    backendUrl: string;
    frontendUrl: string;
}

export class App {

    constructor() {
        Log.info('App::<init> - start');
    }

    public init() {
        Log.info('App::init() - start');

        const config: IConfig = <IConfig>Config;
        // handle any config changes (specifically dev vs prod)

        const server = new FrontEndServer(config);
        server.start().then(function () {
            Log.info("App::init() - server started");
        }).catch(function (err) {
            Log.info("App::init() - server staring - ERROR: " + err);
        });


        Log.info('App::init() - done');
    }
}

Log.info("App - start");
const app = new App();
app.init();
Log.info("App - done");