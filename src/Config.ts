import Log from "./util/Log";

export class Config {

    protected static instance: Config = null;
    private config: any;

    private constructor() {
        // should not be called by clients
        try {
            //this.config = fs.readJSONSync("./config.priv.json");
            this.config = {
                name:               process.env.NAME,
                org:                process.env.ORG,
                githubClientId:     process.env.GH_CLIENT_ID,
                githubClientSecret: process.env.GH_CLIENT_SECRET,
                sslCertPath:        process.env.SSL_CERT_PATH,
                sslKeyPath:         process.env.SSL_KEY_PATH,
                sslIntCert:         process.env.SSL_INT_CERT,
                frontendPort:       process.env.FRONTEND_PORT,
                frontendUrl:        process.env.FRONTEND_URL,
                backendPort:        process.env.BACKEND_PORT,
                backendUrl:         process.env.BACKEND_URL,
                githubHost:         process.env.GITHUB_HOST,
                githubAPI:          process.env.GITHUB_API,
            }
        } catch (err) {
            Log.error("Config::<init> - fatal error reading configuration file: " + err);
        }
    }

    public static getInstance(configName?: string): Config {
        Log.trace("Config::getInstance() - start");
        if (Config.instance === null) {
            const c = new Config();
            Config.instance = c;
            // Log.trace("Full config: " + JSON.stringify(c));
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
