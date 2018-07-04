const dotenv = require('dotenv');
dotenv.config({path: '../../.env'});

import Log from "./Log";

/**
 * Master list of courses supported by Classy. Config.name should
 * always be set to one of these in .env.
 */
export enum ConfigCourses {
    classytest = "classytest",

    cs310 = "cs310",
    cs340 = "cs340",

    sdmm = "sdmm", // edX micromasters capstone project
}

export enum ConfigKey {
    name = "name", // name of the course (e.g., cs310, cs340, secapstone, classytest) // should be stable between course instances
    org = "org",
    testorg = "testorg",
    testname = "testname",

    frontendUrl = "frontendUrl",
    backendUrl = "backendUrl",
    frontendPort = "frontendPort",
    backendPort = "backendPort",

    mongoUrl = "mongoUrl",

    githubAPI = "githubAPI",
    githubBotName = "githubBotName",
    githubBotToken = "githubBotToken",

    githubClientId = "githubClientId",
    githubClientSecret = "githubClientSecret",
    githubHost = "githubHost",

    autotestUrl = "autotestUrl",
    autotestPort = "autotestPort",

    sslKeyPath = "sslKeyPath",
    sslCertPath = "sslCertPath",

    // autotest
    persistDir = "persistDir",
    // githubOracleToken = "githubOracleToken",
    // githubOrgToken = "githubOrgToken",
    dockerId = "dockerId",
    workspace = "workspace",
    graderHost = "graderHost",
    graderPort = "graderPort",
    classPortalHost = "classPortalHost",
    classPortalPort = "classPortalPort",
    timeout = "timeout",
    botName = "botName",
    postback = "postback",


}

export default class Config {

    public static getInstance(): Config {
        if (Config.instance === null) {
            const c = new Config();
            Config.instance = c;
        }
        return Config.instance;
    }

    protected static instance: Config = null;

    private config: any;

    private constructor() {
        // should not be called by clients but typescript does not allow private constructors
        try {
            this.config = {
                name:     process.env.NAME,
                org:      process.env.ORG,
                testorg:  process.env.ORGTEST,
                testname: process.env.NAMETEST,

                dockerId:   process.env.GRADER_DOCKER_ID,
                workspace:  process.env.GRADER_WORKSPACE,
                postback:   Boolean(process.env.AUTOTEST_POSTBACK),
                persistDir: process.env.GRADER_PERSIST_DIR,


                timeout: Number(process.env.GRADER_TIMEOUT),
                botName: process.env.GH_BOT_USERNAME,

                sslCertPath:     process.env.SSL_CERT_PATH,
                sslKeyPath:      process.env.SSL_KEY_PATH,
                classPortalHost: process.env.BACKEND_URL,
                classPortalPort: process.env.BACKEND_PORT,

                mongoUrl: process.env.DB_URL,

                frontendPort: process.env.FRONTEND_PORT,
                frontendUrl:  process.env.FRONTEND_URL,
                backendPort:  process.env.BACKEND_PORT,
                backendUrl:   process.env.BACKEND_URL,

                githubHost:         process.env.GH_HOST,
                githubAPI:          process.env.GH_API,
                githubBotName:      process.env.GH_BOT_USERNAME,
                githubBotToken:     process.env.GH_BOT_TOKEN,
                githubClientId:     process.env.GH_CLIENT_ID,
                githubClientSecret: process.env.GH_CLIENT_SECRET,

                autotestUrl:  process.env.AUTOTEST_URL,
                autotestPort: process.env.AUTOTEST_PORT,

                // Not used?
                // sslIntCert: process.env.SSL_INT_CERT,
                // adminUser:  process.env.ADMIN_USER,
                // oracleRepo: process.env.ORACLE_REPO,

                // Can remove?
                // kind:               process.env.KIND, // REMOVE
                // githubOrgToken:     process.env.GH_BOT_TOKEN,
                // githubOracleToken:  process.env.GH_ORG_TOKEN,
                // graderHost:         process.env.SERVER_URL,
                // graderPort:         process.env.GRADER_PORT,
            };
        } catch (err) {
            Log.error("Config::<init> - fatal error reading configuration file: " + err);
        }
    }

    public getProp(prop: ConfigKey): any {
        if (typeof this.config[prop] === "undefined") {
            Log.error("Config::getProp( " + prop + " ) - property is undefined; you probably want this in your config file.");
        } else if (this.config[prop] === null) {
            Log.error("Config::getProp( " + prop + " ) - property is null");
        } else {
            return this.config[prop];
        }
        return null;
    }

    public setProp(prop: ConfigKey, val: any) {
        if (Config.getInstance().getProp(ConfigKey.name) !== Config.getInstance().getProp(ConfigKey.testname)) {
            if ((prop === ConfigKey.name && val === Config.getInstance().getProp(ConfigKey.testname)) === false) {
                Log.error("Config::setProp( " + prop + ", " + val + " ) - should only be done by test suites, not production code");
            }
        }
        this.config[prop] = val;
    }
}
