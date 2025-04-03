/**
 * Created by rtholmes on 2016-06-19.
 */

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";

import AutoTestServer from "@autotest/server/AutoTestServer";

/**
 * Starts the server; does not listen to whether the start was successful.
 */
export class AutoTestDaemon {
	public initServer() {
		Log.info("AutoTestDaemon::initServer() - start");

		const portNum = Number(Config.getInstance().getProp(ConfigKey.autotestPort));

		// start server
		const s = new AutoTestServer();
		s.setPort(portNum);
		s.start()
			.then(function (val: boolean) {
				Log.info("AutoTestDaemon::initServer() - started: " + val);
			})
			.catch(function (err: Error) {
				Log.error("AutoTestDaemon::initServer() - ERROR: " + err.message);
			});
	}
}

// This starts up the AutoTest system
Log.info("AutoTest Daemon - starting");
const app = new AutoTestDaemon();
app.initServer();

Log.info("AutoTestDaemon - registering unhandled rejection");

/**
 * AutoTest instances are run without then/catch blocks since we have
 * no way of recovering anyway. This just gives us an opportunity to
 * log when a container has failed (which in practice is extremely
 * rare).
 */
process.on("unhandledRejection", (reason, p) => {
	try {
		Log.warn("AutoTestDaemon - unhandled promise rejection"); // in case next line fails
		// tslint:disable-next-line
		console.log("AutoTestDaemon - unhandled rejection at: ", p, "; reason:", reason);
		Log.error("AutoTestDaemon - unhandled promise rejection: " + JSON.stringify(reason));
	} catch (err) {
		// eat any error
	}
});
Log.info("AutoTestDaemon - registering unhandled rejection; done");
