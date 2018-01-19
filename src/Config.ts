import * as fs from "fs";
import Log from "./util/Log";

export class Config {

    public static getInstance(): Config {
        if (Config.instance === null) {
            Config.instance = new Config();
        }
        return Config.instance;
    }

    protected static instance: Config = null;

    private config: any;

    private constructor() {
        // should not be called by clients but typescript does not allow private constructors
        try {
            this.config = JSON.parse(fs.readFileSync("./config.priv.json", "utf8"));
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
