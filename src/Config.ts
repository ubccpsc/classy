import * as fs from "fs-extra";
import Log from "./util/Log";

export class Config {

    public static getInstance(configName?: string): Config {
        if (Config.instance === null) {
            if (typeof configName === "undefined") {
                Log.warn("Config::getInstance() - configName not specified; using test");
                configName = "test";
            }
            const c = new Config();
            for (const course of c.config.courses) {
                if (course.name === configName) {
                    Log.info("Config::getInstance() - processing config: " + configName);
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
        }
        return Config.instance;
    }

    protected static instance: Config = null;

    private config: any;

    private constructor() {
        // should not be called by clients but typescript does not allow private constructors
        try {
            this.config = fs.readJSONSync("./config.priv.json");
        } catch (err) {
            Log.error("Config::<init> - fatal error reading configuration file: " + err);
        }
    }

    public getProp(prop: string): any {
        if (typeof this.config[prop] === "undefined") {
            Log.warn("Config::getProp( " + prop + " ) - property is undefined");
        } else if (this.config[prop] === null) {
            Log.warn("Config::getProp( " + prop + " ) - property is null");
        } else {
            return this.config[prop];
        }
        return null;
    }

}
