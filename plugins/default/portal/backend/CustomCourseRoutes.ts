import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import IREST from "@backend/server/IREST";

import Log from "@common/Log";

/**
 * This class should add any custom routes a course might need.
 *
 * Nothing should be added to this class.
 */
export default class DefaultCourseRoutes implements IREST {
    public registerRoutes(server: FastifyInstance): void {
        Log.trace('DefaultCourseRoutes::registerRoutes()');
    }
}
