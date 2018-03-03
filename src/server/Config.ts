import * as fs from "fs-extra";
import Log from "../app/util/Log";


// const ConfigFile = require("../Config");

export class Config {

    protected static instance: Config = null;
    private config: any;

    private constructor() {
        // should not be called by clients
        try {
            this.config = fs.readJSONSync("./config.priv.json");
        } catch (err) {
            Log.error("Config::<init> - fatal error reading configuration file: " + err);
        }
    }

    public static getInstance(configName?: string): Config {
        Log.trace("Config::getInstance() - start");
        if (Config.instance === null) {
            if (typeof configName === "undefined") {
                Log.warn("Config::getInstance() - configName not specified; using prod");
                configName = "prod";
            }

            const c = new Config();
            Config.instance = c;

        }
        Log.trace("Config::getInstance() - done");
        return Config.instance;
    }

    public getProp(prop: string): any {
        if (typeof this.config[prop] === "undefined") {
            Log.error("Config::getProp( " + prop + " ) - property is undefined; you probably want this in your config file.");
        } else if (this.config[prop] === null) {
            Log.error("Config::getProp( " + prop + " ) - property is null");
        } else {
            return this.config[prop];
        }
        return null;
    }
}
