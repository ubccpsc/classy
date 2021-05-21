import * as restify from "restify";

import Log from "../../../packages/common/Log";

import IREST from "../../../packages/portal/backend/src/server/IREST";

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
