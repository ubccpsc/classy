import * as restify from "restify";

import Log from "../../../../common/Log";

import IREST from "../server/IREST";

/**
 * This class should add any custom routes a course might need.
 *
 * Nothing should be added to this class.
 */
export default class DefaultCourseRoutes implements IREST {
    public registerRoutes(server: restify.Server) {
        Log.trace('DefaultCourseRoutes::registerRoutes()');
    }
}
