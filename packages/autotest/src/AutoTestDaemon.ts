/**
 * Created by rtholmes on 2016-06-19.
 */

import AutoTestServer from "@autotest/server/AutoTestServer";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";

/**
 * Starts the server; does not listen to whether the start was successful.
 */
export class AutoTestDaemon {
	public async initServer(): Promise<void> {
		Log.info("AutoTestDaemon::initServer() - start");

		const portNum = Number(Config.getInstance().getProp(ConfigKey.autotestPort));

		// start server
		const s = new AutoTestServer();
		s.setPort(portNum);
		try {
			const val = await s.start();
			Log.info("AutoTestDaemon::initServer() - started: " + val);
		} catch (err) {
			Log.error("AutoTestDaemon::initServer() - ERROR: " + err.message);
		}
	}
}

// This starts up the AutoTest system
Log.info("AutoTest Daemon - starting");
const app = new AutoTestDaemon();
// NOTE: not awaited; this is the process entry point and there is nothing here to await into.
// initServer() handles its own errors, so this cannot reject.
void app.initServer();

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
		// JSON.stringify throws on a circular reason and the catch below eats it, so write the
		// raw values first; this is the only record that survives that case
		// biome-ignore lint/suspicious/noConsole: deliberate fallback when the Log call below throws
		console.log("AutoTestDaemon - unhandled rejection at: ", p, "; reason:", reason);
		Log.error("AutoTestDaemon - unhandled promise rejection: " + JSON.stringify(reason));
	} catch (_err) {
		// eat any error
	}
});
Log.info("AutoTestDaemon - registering unhandled rejection; done");
