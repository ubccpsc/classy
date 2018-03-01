import * as fs from "fs-extra";
import Log from "./util/Log";

const ConfigFile = require("../Config");

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
                Log.warn("Config::getInstance() - configName not specified; using test");
                configName = "test";
            }

            const c = new Config();
            let found = false;
            for (const course of c.config.courses) {
                if (course.name === configName) {
                    Log.info("Config::getInstance() - processing config: " + configName);
                    found = true;
                    for (const key of Object.keys(course)) {
                        if (typeof c.config[key] === "undefined") {
                            c.config[key] = course[key];
                        } else {
                            Log.warn("Config::getInstance() - key already exists: " + key);
                        }
                    }
                }
            }
            Config.instance = c;
            if (found === false) {
                Log.error("Config::getInstance( " + configName + " ) - config not found");
                throw new Error("Config::getInstance( " + configName + " ) - config not found");
            }
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
