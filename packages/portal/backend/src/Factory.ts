import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";

import { AdminController } from "./controllers/AdminController";
import { ICourseController } from "./controllers/CourseController";
import { GitHubActions } from "./controllers/GitHubActions";
import { GitHubController, IGitHubController } from "./controllers/GitHubController";
import IREST from "./server/IREST";

export class Factory {
	/**
	 * This is a test variable, but cannot be hosted in a test/ file because it breaks the Docker build process.
	 *
	 * Set to true if you want to run these slow tests locally (they will always run on CI):
	 */
	// public static OVERRIDE = true; // NOTE: should be commented out when committing
	public static OVERRIDE = false; // NOTE: should NOT be commented out when committing

	private static readonly TESTNAME = "classytest";

	/**
	 * Returns a custom route handler for a course. This will be used to configure
	 * Restify with any custom routes required for the course backend. Only one
	 * custom handler is permitted per instance.
	 * @param {string} name optional name (for testing or overriding the default; usually not needed)
	 * @returns {IREST}
	 */
	public static async getCustomRouteHandler(name?: string): Promise<IREST> {
		const plugin = Config.getInstance().getProp(ConfigKey.plugin);

		if (typeof name === "undefined") {
			name = Factory.getName();
		}

		try {
			// plugin path can be substituted in .env for customization of routes
			let plug: any;
			Log.info("Factory::getCustomRouteHandler() - instantiating CustomCourseRoutes for: " + name + "; path: " + plugin);
			plug = await require("../../../../plugins/" + plugin + "/portal/backend/CustomCourseRoutes"); // default for testing
			Log.trace("Factory::getCustomRouteHandler() - CustomRouteHandler loaded");

			// if this fails an error will be raised and the default view will be provided in the catch below
			const constructorName = Object.keys(plug)[0];
			const handler = new plug[constructorName]();
			Log.info("Factory::getCustomRouteHandler() - CustomRouteHandler instantiated");
			return handler;
		} catch (err) {
			Log.error(err);
			const msg = "Factory::getCustomRouteHandler() - " + plugin + "/portal/backend/CustomCourseRoutes.ts must be defined";
			Log.error(msg);
			throw new Error(msg);
		}
	}

	// only visible for testing
	public static controller: ICourseController = null;

	/**
	 *
	 * @param {IGitHubController} ghController
	 * @param {string} name optional name (for testing or overriding the default; usually not needed)
	 * @returns {AdminController}
	 */
	public static async getCourseController(ghController?: IGitHubController, name?: string): Promise<ICourseController> {
		if (typeof name === "undefined") {
			name = Factory.getName();
		}

		// Disabled; do not return the cached controller for now
		// if (Factory.controller !== null) {
		//     Log.trace("Factory::getCourseController() - returning cached course controller");
		//     return Factory.controller;
		// }

		if (typeof ghController === "undefined") {
			ghController = new GitHubController(GitHubActions.getInstance());
		} else {
			// really only for testing
			Log.trace("Factory::getCourseController() - using provided CustomCourseController");
		}
		try {
			const plugin = Config.getInstance().getProp(ConfigKey.plugin);

			Log.trace("Factory::getCourseController() - name: " + name + "; plugin: " + plugin);

			// NOTE: using require instead of import because file might not be present in forks
			// import complains about this, but require does not.
			let plug: any = null;

			try {
				// If a course wants to specialize the AdminView it should be in the file below.
				// This is not required. But if it is added, it should never be pushed back to "classy/main"
				Log.trace("Factory::getCourseController() - name: " + name + " - plug: CustomCourseController");
				const controllerPath = "../../../../plugins/" + plugin + "/portal/backend/CustomCourseController";
				Log.info("Factory::getCourseController() - loading CustomCourseController; full path: " + controllerPath);
				plug = await require(controllerPath);
			} catch (err) {
				const msg = "Factory::getCourseController() - " + plugin + "/src/custom/CustomCourseController.ts must be defined";
				Log.error(msg);
				Log.error(err);
				plug = null;
			}

			Log.trace("Factory::getCourseController() - CustomCourseController loaded");

			// if this fails an error will be raised and the default view will be provided in the catch below
			const constructorName = Object.keys(plug)[0];
			const handler = new plug[constructorName](ghController);
			Log.trace("Factory::getCourseController() - CustomCourseController handler instantiated");
			return handler;
		} catch (err) {
			const msg = "Factory::getCourseController() - src/custom/CustomCourseController.ts must be defined";
			Log.error(msg);
			throw new Error(msg);
		}
	}

	/**
	 * Gets the name associated with the BackendDaemon instance from the .env file.
	 *
	 * @returns {string | null}
	 */
	private static getName(): string | null {
		const name = Config.getInstance().getProp(ConfigKey.name);
		/* istanbul ignore if */
		if (name === null) {
			const msg = "Factory::getName() - null name; this is almost certainly an error with your .env file.";
			Log.error(msg);
			throw new Error(msg);
		}
		return name;
	}
}
