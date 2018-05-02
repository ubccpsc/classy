import * as rp from "request-promise-native";
import { Config } from "../../../common/Config";
import Log from "../../../common/Log";

export interface IClassPortal {

    /**
     * For a given commitURL, figure out what the default deliverable is at the current time.
     *
     * NOTE: commitURL could be something simpler too, maybe just org is easiest:
     *
     * GET /admin/getDefaultDeliverable/{:org}
     *
     * @param courseId
     */
    getDefaultDeliverableId(courseId: string): Promise<string | null>;

    /**
     * Returns whether the username is staff on the course.
     *
     * GET /admin/isStaff/{:org}/{:userId} (or some variant)
     *
     * @param courseId
     * @param userName
     */
    isStaff(courseId: string, userName: string): Promise<boolean>;

    /**
     * Gets the identifier for the AutoTest docker container that should process requests for this deliverable.
     *
     * GET /admin/{:org}/{:delivId}/container
     *
     * @param courseId
     */
    getContainerDetails(courseId: string, delivId: string): Promise<{ dockerImage: string,  studentDelay: number, maxExecTime: number, regressionDelivIds: string[] } | null>;
}

export class ClassPortal implements IClassPortal {
    private host: string = Config.getInstance().getProp("classPortalHost");
    private port: number = Config.getInstance().getProp("classPortalPort");

    public async isStaff(courseId: string, userName: string): Promise<boolean> {
        if (typeof courseId === "undefined" || courseId === null || typeof userName === "undefined" || userName === null) {
            Log.error("ClassPortal::isStaff(..) - missing parameters");
            return false;
        }

        const url = "https://" + this.host + ":" + this.port + "/isStaff/" + courseId + "/" + userName;
        Log.info("ClassPortal::isStaff(..) - Sending request to " + url);
        return rp(url).then(function (res) {
            Log.trace("ClassPortal::isStaff( " + courseId + ", " + userName + " ) - success; payload: " + res);
            const json = JSON.parse(res);
            return json.isStaff;
        }).catch(function (err) {
            Log.trace("ClassPortal::isStaff(..) - ERROR; url: " + url + "; ERROR: " + err);
            return false; // err on the side of caution
        });
    }

    public async getDefaultDeliverableId(courseId: string): Promise<string | null> {
        if (typeof courseId === "undefined" || courseId === null) {
            Log.error("ClassPortal::getDefaultDeliverableId(..) - missing parameters");
            return null;
        }

        const url = "https://" + this.host + ":" + this.port + "/defaultDeliverable" + "/" + courseId;
        Log.info("ClassPortal::getDefaultDeliverableId(..) - Sending request to " + url);
        return rp(url).then(function (res) {
            Log.trace("ClassPortal::getDefaultDeliverableId( " + courseId + " ) - success; payload: " + res);
            const json = JSON.parse(res);
            return json.delivId;
        }).catch(function (err) {
            Log.trace("ClassPortal::getDefaultDeliverableId(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        });
    }

    /**
     * Gets the delay beween test executions in milliseconds
     *
     * @param {string} courseId
     * @returns {Promise<number>}
     */

    /*
    public async getTestDelay(org: string, delivId: string): Promise<number | null> {
        if (typeof org === "undefined" || org === null || typeof delivId === "undefined" || delivId === null) {
            Log.error("ClassPortal::getTestDelay(..) - missing parameters");
            return null;
        }

        const url = "https://portal.cs.ubc.ca:5000/" + org + "/" + delivId + "/rate";
        return rp(url).then(function (res) {
            Log.trace("ClassPortal::getTestDelay( " + org + ", " + delivId + " ) - success; payload: " + res);
            const json = JSON.parse(res);
            return json.response;
        }).catch(function (err) {
            Log.trace("ClassPortal::getTestDelay(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        });
    }
*/
    public async getContainerDetails(courseId: string, delivId: string): Promise<{ dockerImage: string,  studentDelay: number, maxExecTime: number, regressionDelivIds: string[] }  | null> {
        if (typeof courseId === "undefined" || courseId === null || typeof delivId === "undefined" || delivId === null) {
            Log.error("ClassPortal::getContainerId(..) - missing parameters");
            return null;
        }

        const url = "https://" + this.host + ":" + this.port  + "/container" + "/" + courseId + "/" + delivId;
        Log.info("ClassPortal::getContainerId(..) - Sending request to " + url);
        return rp(url).then(function (res) {
            Log.trace("ClassPortal::getContainerId( " + courseId + ", " + delivId + " ) - success; payload: " + res);
            const json = JSON.parse(res);
            return json;
        }).catch(function (err) {
            Log.trace("ClassPortal::getContainerId(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        });
    }

}
