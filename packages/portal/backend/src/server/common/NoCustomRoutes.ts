import * as restify from "restify";

import Log from "../../../../../common/Log";

import IREST from "../IREST";

/**
 * No-Op route handle for courses that do not define custom endpoints.
 *
 * Nothing should be added to this class.
 */
export default class NoCustomRoutes implements IREST {
    public registerRoutes(server: restify.Server) {
        Log.trace('NoCustomRoutes::registerRoutes(); nothing to register');
    }
}
