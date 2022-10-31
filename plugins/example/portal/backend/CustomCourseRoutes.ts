import * as restify from "restify";
import fetch from "node-fetch";

import Log from "@common/Log";

import IREST from "@backend/server/IREST";

import {CustomCourseController} from "./CustomCourseController";

/**
 * This class should add any custom routes a course might need.
 *
 * Nothing should be added to this class.
 */

export default class CustomCourseRoutes implements IREST {

    public registerRoutes(server: restify.Server) {
        Log.trace('CustomCourseRoutes::registerRoutes()');

        // Create or import auth middleware where necessary (examples in AuthRoutes.ts, GeneralRoutes.ts)
        server.get('/portal/custom/helloWorld', CustomCourseController.getHelloWorldData);

    }
}
