"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Log_1 = require("./Log");
class Config {
    constructor() {
        try {
            this.config = {
                name: process.env.NAME,
                org: process.env.ORG,
                adminUser: process.env.ADMIN_USER,
                dockerId: process.env.DOCKER_ID,
                workspace: process.env.WORKSPACE,
                oracleRepo: process.env.ORACLE_REPO,
                postback: Boolean(process.env.POSTBACK),
                persistDir: process.env.PERSIST_DIR,
                port: Number(process.env.PORT),
                kind: process.env.KIND,
                timeout: Number(process.env.TIMEOUT),
                botName: process.env.BOT_NAME,
                githubOrgToken: process.env.GHT_STUDENT_ORG,
                githubOracleToken: process.env.GHT_ORACLE,
                sslCertPath: process.env.SSL_CERT_PATH,
                sslKeyPath: process.env.SSL_KEY_PATH,
                classPortalHost: process.env.CP_HOST,
                classPortalPort: process.env.CP_PORT,
                graderHost: process.env.GRADER_HOST,
                graderPort: process.env.GRADER_PORT,
                mongoUrl: process.env.DB_URL,
                githubClientId: process.env.GH_CLIENT_ID,
                githubClientSecret: process.env.GH_CLIENT_SECRET,
                sslIntCert: process.env.SSL_INT_CERT,
                frontendPort: process.env.FRONTEND_PORT,
                frontendUrl: process.env.FRONTEND_URL,
                backendPort: process.env.BACKEND_PORT,
                backendUrl: process.env.BACKEND_URL,
                githubHost: process.env.GITHUB_HOST,
                githubAPI: process.env.GITHUB_API,
                githubTokenUser: process.env.GH_TOKEN_USER,
                githubToken: process.env.GH_API_TOKEN,
                autotestUrl: process.env.AUTOTEST_URL,
                autotestPort: process.env.AUTOTEST_PORT
            };
        }
        catch (err) {
            Log_1.default.error("Config::<init> - fatal error reading configuration file: " + err);
        }
    }
    static getInstance(configName) {
        if (Config.instance === null) {
            const c = new Config();
            Config.instance = c;
        }
        return Config.instance;
    }
    getProp(prop) {
        if (typeof this.config[prop] === "undefined") {
            Log_1.default.error("Config::getProp( " + prop + " ) - property is undefined; you probably want this in your config file.");
        }
        else if (this.config[prop] === null) {
            Log_1.default.error("Config::getProp( " + prop + " ) - property is null");
        }
        else {
            return this.config[prop];
        }
        return null;
    }
}
Config.instance = null;
exports.Config = Config;
//# sourceMappingURL=Config.js.map