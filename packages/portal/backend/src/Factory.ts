import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

import {AdminController} from "./controllers/AdminController";
import {ICourseController} from "./controllers/CourseController";
import {GitHubActions} from "./controllers/GitHubActions";
import {GitHubController, IGitHubController} from "./controllers/GitHubController";
import IREST from "./server/IREST";

export class Factory {

    /**
     * This is a test variable, but can't be hosted in a test/ file because it breaks the Docker build process.
     *
     * Set to true if you want to run these slow tests locally (they will always run on CI):
     */
    // public static OVERRIDE = true; // NOTE: should be commented out when committing
    public static OVERRIDE = false; // NOTE: should NOT be commented out when committing

    /**
     * Returns a custom OR default route handler for a course. This will be used to configure
     * Restify with any custom routes required for the course backend. Only one
     * custom handler is permitted per instance.
     * @param {string} name? optional name (for testing or overriding the default; usually not needed)
     * @returns {IREST}
     */
    public static async getRouteHandler(name?: string): Promise<IREST> {
        if (typeof name === 'undefined') {
            name = Factory.getName();
        }

        const {defaultRoutes, customRoutes} = this.getRouteFiles();
        let plug: any;
        if (customRoutes) {
            // If a course wants to specialize the AdminView it should be in the CustomCourseRoutes.ts file.
            // This is not required. But if it is added, it should never be pushed back to 'classy/master'
            plug = customRoutes;
        } else {
            plug = defaultRoutes;
        }

        Log.trace("Factory::getRouteHandler() - handler loaded");
        try {
            Log.info("Factory::getRouteHandler() - instantiating custom route handler for: " + name);

            // if this fails an error will be raised and the default view will be provided in the catch below
            const constructorName = Object.keys(plug)[0];
            const handler = new plug[constructorName]();
            Log.info("Factory::getRouteHandler() - handler instantiated");
            return handler;
        } catch (err) {
            const msg = "Factory::getRouteHandler() - Custom Course Routes not implemented and Default Course Routes not found";
            Log.error(msg);
            throw new Error(msg);
        }
    }

    private static getRouteFiles(): {defaultRoutes: NodeRequire, customRoutes: NodeRequire} {
        // NOTE: using require instead of import because file might not be present in forks
        // import complains about this, but require does not.
        let customRoutes = null;
        let defaultRoutes = null;

        try {
            customRoutes = require('./custom/CustomCourseRoutes');
        } catch (err) {
            Log.info('Factory::getRouteFiles() - No custom routes found');
        }

        try {
            defaultRoutes = require('./custom/DefaultCourseRoutes');
        } catch (err) {
            Log.warn('Factory::getRouteFiles() - CRITICAL: Could not find DefaultRoutes.ts fallback');
        }
        return {customRoutes, defaultRoutes};
    }

    // only visible for testing
    public static controller: ICourseController = null;

    /**
     *
     * @param {IGitHubController} ghController
     * @param {string} name? optional name (for testing or overriding the default; usually not needed)
     * @returns {AdminController}
     */
    public static async getCourseController(ghController?: IGitHubController, name?: string): Promise<ICourseController> {
        if (typeof name === 'undefined') {
            name = Factory.getName();
        }

        // Disabled; do not return the cached controller for now
        // if (Factory.controller !== null) {
        //     Log.trace("Factory::getCourseController() - returning cached course controller");
        //     return Factory.controller;
        // }

        if (typeof ghController === 'undefined') {
            ghController = new GitHubController(GitHubActions.getInstance());
        } else {
            // really only for testing
            Log.trace("Factory::getCourseController() - using provided controller");
        }
        try {
            // NOTE: using require instead of import because file might not be present in forks
            // import complains about this, but require does not.
            let plug: any;
            if (name === 'classytest') {
                plug = await require('./controllers/CourseController'); // default for testing
            } else {
                // If a course wants to specialize the AdminView it should be in the file below.
                // This is not required. But if it is added, it should never be pushed back to 'classy/master'
                plug = await require('./custom/CustomCourseController');
            }

            Log.trace("Factory::getCourseController() - handler loaded");

            // if this fails an error will be raised and the default view will be provided in the catch below
            const constructorName = Object.keys(plug)[0];
            const handler = new plug[constructorName]();
            Log.info("Factory::getCourseController() - handler instantiated");
            return handler;
        } catch (err) {
            const msg = "Factory::getCourseController() - src/custom/CustomCourseController.ts must be defined";
            Log.error(msg);
            throw new Error(msg);
        }
    }

    /**
     * Gets the name associated with the Backend instance from the .env file.
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
