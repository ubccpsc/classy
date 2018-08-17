import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

import {CourseController} from "./controllers/CourseController";
import {GitHubController, IGitHubController} from "./controllers/GitHubController";
import {SDMMController} from "./controllers/SDMM/SDMMController";
import CS340REST from "./server/340/CS340REST";

import NoCustomRoutes from "./server/common/NoCustomRoutes";
import IREST from "./server/IREST";
import SDMMREST from "./server/SDMM/SDMMREST";

export class Factory {

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

        if (name === 'sdmm' || name === 'secapstonetest') {
            return new SDMMREST();
        } else if (name === 'cs310' || name === 'classytest') {
            // no custom routes are required for 310
            return new NoCustomRoutes();
        } else if (name === 'cs340' || name === 'cpsc340' || name.toLowerCase().startsWith('cpsc340')) {
            return new CS340REST();
        } else {
            Log.error("Factory::getCustomRouteHandler() - unknown name: " + name);
        }
        return new NoCustomRoutes(); // default handler
    }

    /**
     *
     * @param {IGitHubController} ghController
     * @param {string} name? optional name (for testing or overriding the default; usually not needed)
     * @returns {CourseController}
     */
    public static getCourseController(ghController?: IGitHubController, name?: string): CourseController {
        if (typeof name === 'undefined') {
            name = Factory.getName();
        }

        if (typeof ghController === 'undefined') {
            ghController = new GitHubController();
        } else {
            // really only for testing
            Log.trace("Factory::getCourseController() - using provided controller");
        }

        if (name === 'sdmm' || name === 'secapstonetest') {
            return new SDMMController(ghController);
        } else if (name === 'cs310' || name === 'classytest') {
            return new CourseController(ghController);
        } else if (name === 'cs340' || name === 'cpsc340') {
            return new CourseController(ghController);
        } else {
            Log.error("Factory::getCourseController() - unknown name: " + name);
            throw new Error("Unknown course name: " + name);
        }
    }

    /**
     * Gets the name associated with the Backend instance from the .env file.
     *
     * @returns {string | null}
     */
    private static getName(): string | null {
        const name = Config.getInstance().getProp(ConfigKey.name);
        if (name === null) {
            const msg = "Factory::getName() - null name; this is almost certainly an error with your .env file.";
            Log.error(msg);
            throw new Error(msg);
        }
        return name;
    }
}
