import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

import {AdminController} from "./controllers/AdminController";
import {CourseController, ICourseController} from "./controllers/CourseController";
import {GitHubActions} from "./controllers/GitHubActions";
import {GitHubController, IGitHubController} from "./controllers/GitHubController";
import {CustomCourseController} from "./custom/CustomCourseController";

import CustomCourseRoutes from "./custom/CustomCourseRoutes";
import NoCustomRoutes from "./server/common/NoCustomRoutes";
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
     * Returns a custom route handler for a course. This will be used to configure
     * Restify with any custom routes required for the course backend. Only one
     * custom handler is permitted per instance.
     * @param {string} name? optional name (for testing or overriding the default; usually not needed)
     * @returns {IREST}
     */
    public static getCustomRouteHandler(name?: string): IREST {
        if (typeof name === 'undefined') {
            name = Factory.getName();
        }

        if (name === 'classytest') {
            Log.info("Factory::getCustomRouteHandler() - using NoCustomRoutes");
            return new NoCustomRoutes();
        } else {
            Log.info("Factory::getCustomRouteHandler() - using CustomCourseRoutes");
            return new CustomCourseRoutes(); // instantiate any course-specific routes
        }
    }

    // only visible for testing
    public static controller: ICourseController = null;

    /**
     *
     * @param {IGitHubController} ghController
     * @param {string} name? optional name (for testing or overriding the default; usually not needed)
     * @returns {AdminController}
     */
    public static getCourseController(ghController?: IGitHubController, name?: string): ICourseController {
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

        if (name === 'classytest') {
            // for unit testing
            Factory.controller = new CourseController(ghController);
        } else if (name === 'classy') {
            // for test deploying
            Log.info("Factory::getCourseController() - using CourseController for: " + name);
            Factory.controller = new CourseController(ghController);
        } else {
            // NOTE: this could be updated to be like the frontend Factory (using plug) if we have problems with
            // forks trying to upstream their Custom*.ts changes
            Log.info("Factory::getCourseController() - using CustomCourseController for: " + name);
            Factory.controller = new CustomCourseController(ghController);
        }
        return Factory.controller;
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
