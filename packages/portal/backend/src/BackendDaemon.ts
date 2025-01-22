/**
 * Created by rtholmes on 2018-02-23.
 */

import Config from "@common/Config";
import Log from "@common/Log";

import BackendServer from "./server/BackendServer";

export class BackendDaemon {
	private server: BackendServer = null;

	constructor() {
		Log.info("BackendDaemon::<init> - start");
		//  App.config = <IConfig>Config;
	}

	public async start(): Promise<boolean> {
		Log.info("BackendDaemon::start() - start");

		// handle any config changes (specifically dev vs prod)
		if (this.server === null) {
			this.server = new BackendServer(true); // RELEASE: param should be true
		}

		try {
			await this.server.start();
			Log.info("BackendDaemon::start() - server started");
			return true;
		} catch (err) {
			Log.info("BackendDaemon::start() - server staring - ERROR: " + err);
			return false;
		}
	}

	public async stop(): Promise<boolean> {
		Log.info("BackendDaemon::stop() - start");

		// handle any config changes (specifically dev vs prod)
		if (this.server !== null) {
			return this.server
				.stop()
				.then(function () {
					Log.info("BackendDaemon::stop() - server stopped");
					return true;
				})
				.catch(function (err) {
					Log.info("BackendDaemon::stop() - server stopping - ERROR: " + err);
					return false;
				});
		} else {
			Log.info("BackendDaemon::stop() - server not defined");
			return false;
		}
	}
}

// This ends up starting the whole system
Log.info("BackendDaemon - starting");
Config.getInstance();
const app = new BackendDaemon();
app.start()
	.then(function (success) {
		if (success === true) {
			Log.info("BackendDaemon - start success");
		} else {
			Log.info("BackendDaemon - start failure");
		}
	})
	.catch(function (err) {
		Log.info("BackendDaemon - start ERROR: " + err);
	});

// Unhandled rejection checking code; this is not great, but is better than being surprised
Log.info("BackendDaemon - registering unhandled rejection");
process.on("unhandledRejection", (reason) => {
	// , p
	try {
		Log.error("BackendDaemon - unhandled promise"); // in case next line fails
		// console.log("BackendDaemon - unhandled rejection at: ", p, "; reason:", reason);
		Log.error("BackendDaemon - unhandled promise: " + JSON.stringify(reason));
	} catch (err) {
		// eat any error
	}
});
Log.info("BackendDaemon - registering unhandled rejection; done");
// Promise.reject("foo");
