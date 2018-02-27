/**
 * Created by rtholmes on 2018-02-23.
 */

import Log from "./util/Log";
import FrontEndServer from "./Server";
import {IConfig} from "./Types";

const Config = require("../Config");

export class App {

    // Having this public is a hack, but makes config access simpler
    public static config: IConfig;

    constructor() {
        Log.info('App::<init> - start');
        App.config = <IConfig>Config;
    }

    public init() {
        Log.info('App::init() - start');


        // handle any config changes (specifically dev vs prod)
        const server = new FrontEndServer(App.config);
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