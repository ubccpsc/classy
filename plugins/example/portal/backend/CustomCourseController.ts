import {CourseController} from "@backend/controllers/CourseController";
import {IGitHubController} from "@backend/controllers/GitHubController";
import {Deliverable, Person} from "@backend/Types";
import Log from "@common/Log";

import * as restify from "restify";

import fetch from 'node-fetch';
export class CustomCourseController extends CourseController {

    constructor(ghController: IGitHubController) {
        Log.trace("DefaultCourseController::<init>");
        super(ghController);
    }

    /**
     * Relays JSON data from your HelloWorld! Docker service to be consumed by front-end.
     * @param req
     * @param res
     * @param next
     */
    public static getHelloWorldData(req: restify.Request, res: restify.Response, next: restify.Next) {
    fetch('http://helloworld:3001')
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            res.send({success: {helloWorldData: data}});
        })
        .catch((err) => {
            // Careful not to send sensitive data in error
            // Likely want to create error handler
            res.send(err);
        });
    }
}
