import * as dotenv from "dotenv";

import Log, { LogLevel } from "./Log";
import Util from "@common/Util";

const envLoadResult = dotenv.config({ path: __dirname + "/../../../.env" });

if (envLoadResult.error) {
	Log.error("Failed to parse .env " + envLoadResult.error);
	throw envLoadResult.error;
}

/**
 * Master list of courses supported by Classy. Config.name should
 * always be set to one of these in .env.
 */
export enum ConfigCourses {
	classytest = "classytest",
	cs310 = "cs310",
	// cs210 = "cs210",
}

export enum ConfigKey {
	name = "name", // name of the course (e.g., cs310, cs340, secapstone, classytest) // should be stable between course instances
	org = "org",
	testorg = "testorg",
	testname = "testname",
	plugin = "plugin",

	classlist_uri = "classlist_uri",
	classlist_username = "classlist_username",
	classlist_password = "classlist_password",

	minimum_student_delay = "minimum_student_delay",
	publichostname = "publichostname",

	backendUrl = "backendUrl",
	backendPort = "backendPort",

	mongoUrl = "mongoUrl",

	githubAPI = "githubAPI",
	githubBotName = "githubBotName",
	githubBotToken = "githubBotToken",
	githubDockerToken = "githubDockerToken",
	githubClientId = "githubClientId",
	githubClientSecret = "githubClientSecret",
	githubHost = "githubHost",

	githubAdmin = "githubAdmin",
	githubAdminStaff = "githubAdminStaff",
	githubStaff = "githubStaff",
	githubBot01 = "githubBot01",
	githubBot02 = "githubBot02",
	githubTestUsers = "githubTestUsers",

	autotestUrl = "autotestUrl",
	autotestPort = "autotestPort",
	autotestSecret = "autotestSecret",
	autotestJobs = "autotestJobs",

	sslKeyPath = "sslKeyPath",
	sslCertPath = "sslCertPath",

	// autotest
	persistDir = "persistDir",
	hostDir = "hostDir",
	dockerUid = "dockerUid",
	hostsAllow = "hostsAllow",
	timeout = "timeout",
	botName = "botName",
	postback = "postback",

	patchId = "patchId", // Used by classy
	patchToolUrl = "patchToolUrl",
	patchSourceRepo = "patchSourceRepo",

	// ADMIN_TEAM_NAME
	adminTeamName = "adminTeamName",
	// STAFF_TEAM_NAME
	staffTeamName = "staffTeamName",

	logLevel = "logLevel",
}

export default class Config {
	protected static instance: Config = null;
	private readonly config: any;

	public static getInstance(): Config {
		if (Config.instance === null) {
			Config.instance = new Config();
		}
		return Config.instance;
	}

	private constructor() {
		// should not be called by clients but typescript does not allow private constructors
		try {
			this.config = {
				name: process.env.NAME,
				org: process.env.ORG,
				testorg: process.env.ORGTEST,
				testname: process.env.NAMETEST,
				plugin: process.env.PLUGIN,

				classlist_uri: process.env.CLASSLIST_URI,
				classlist_username: process.env.CLASSLIST_USERNAME,
				classlist_password: process.env.CLASSLIST_PASSWORD,

				minimum_student_delay: process.env.MINIMUM_STUDENT_DELAY,
				publichostname: process.env.PUBLICHOSTNAME,

				hostDir: process.env.HOST_DIR,
				postback: Util.toBoolean(process.env.AUTOTEST_POSTBACK),
				persistDir: process.env.PERSIST_DIR,
				dockerUid: process.env.UID,
				hostsAllow: process.env.HOSTS_ALLOW,

				timeout: Number(process.env.GRADER_TIMEOUT),
				botName: process.env.GH_BOT_USERNAME,

				sslCertPath: process.env.SSL_CERT_PATH,
				sslKeyPath: process.env.SSL_KEY_PATH,

				mongoUrl: process.env.DB_URL,

				backendPort: process.env.BACKEND_PORT,
				backendUrl: process.env.BACKEND_URL,

				githubHost: process.env.GH_HOST,
				githubAPI: process.env.GH_API,
				githubBotName: process.env.GH_BOT_USERNAME,
				githubBotToken: process.env.GH_BOT_TOKEN,
				githubClientId: process.env.GH_CLIENT_ID,
				githubClientSecret: process.env.GH_CLIENT_SECRET,
				githubDockerToken: process.env.GH_DOCKER_TOKEN,

				githubAdmin: process.env.GH_ADMIN,
				githubAdminStaff: process.env.GH_ADMIN_STAFF,
				githubStaff: process.env.GH_STAFF,
				githubBot01: process.env.GH_BOT_01,
				githubBot02: process.env.GH_BOT_02,
				githubTestUsers: process.env.GH_TEST_USERS,

				autotestUrl: process.env.AUTOTEST_URL,
				autotestPort: process.env.AUTOTEST_PORT,
				autotestSecret: process.env.AUTOTEST_SECRET,
				autotestJobs: process.env.AUTOTEST_JOBS,

				patchId: process.env.PATCH_ID,
				patchToolUrl: process.env.PATCH_TOOL_URL,
				patchSourceRepo: process.env.PATCH_SOURCE_REPO,

				adminTeamName: process.env.ADMIN_TEAM_NAME,
				staffTeamName: process.env.STAFF_TEAM_NAME,

				logLevel: process.env.LOG_LEVEL,
			};

			Log.info("Config - Log::<init>");

			// This is not a great place to sniff for the CI environment
			// but at least it should happen near the start of any execution.
			const ci = process.env.CI;
			if (typeof ci !== "undefined" && Util.toBoolean(ci) === true) {
				// CI instances should be INFO always
				// trace emits too much text so the CI buffer does not save it all
				Log.info("Config - Log::<init> - CI detected; changing to INFO");
				Log.Level = LogLevel.INFO; // force INFO
			} else {
				const level = this.getProp(ConfigKey.logLevel);
				if (typeof this.config.logLevel !== "undefined" && level !== null) {
					Log.info("Config - Log::<init> - updating log level to: " + level);
					Log.Level = level;
					Log.parseLogLevel();
				}
			}
		} catch (err) {
			Log.error("Config::<init> - fatal error reading configuration file: " + err);
		}
	}

	/**
	 * Checks if a property has been defined in in the current configuration.
	 *
	 * @param prop
	 */
	public hasProp(prop: ConfigKey): boolean {
		if (typeof this.config[prop] === "undefined") {
			return false;
		} else {
			return true;
		}
	}

	public getProp(prop: ConfigKey): any {
		if (typeof this.config[prop] === "undefined") {
			Log.error("Config::getProp(...) - property is undefined; you probably want this in your config file.");
			Log.error("Config::getProp( " + prop + " ) - property is undefined; you probably want this in your config file.");
		} else if (this.config[prop] === null) {
			Log.error("Config::getProp(...) - property is null.");
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
		// only test code should really be setting properties on the fly like this
		Log.warn("Config::setProp( " + ConfigKey[prop] + ", " + val + " )");
		this.config[prop] = val;
	}

	/**
	 * WARNING: Can only be used by back-end, as dotenv uses FS, which does not work on front-end.
	 * Removes sensitive information from string types
	 * @param input a string that you MAY want to remove sensitive information from
	 */
	public static sanitize(input: string): string {
		const sensitiveKeys: ConfigKey[] = [ConfigKey.githubBotToken]; // Can add any sensitive keys here
		const config = Config.getInstance();
		sensitiveKeys.forEach((sk) => {
			// HACK: replace() - edge case regarding token prefix in the config.
			const value: string = config.getProp(sk).replace("token ", "");

			const hint = value.substring(0, 4);
			input = input.replace(new RegExp(value, "g"), hint + "-xxxxxx");
		});
		return input;
	}
}
