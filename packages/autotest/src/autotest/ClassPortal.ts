import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

export interface IClassPortal {

    /**
     *
     * GET /admin/getDefaultDeliverable
     *
     */
    getDefaultDeliverableId(): Promise<string | null>;

    /**
     * Returns whether the username is staff on the course.
     *
     * GET /admin/isStaff/{:org}/{:userId} (or some variant)
     *
     * @param courseId
     * @param userName
     */
    isStaff(userName: string): Promise<boolean>;

    /**
     * Gets the identifier for the AutoTest docker container that should process requests for this deliverable.
     *
     * GET /admin/{:org}/{:delivId}/container
     *
     * @param courseId
     */
    getContainerDetails(delivId: string): Promise<{ dockerImage: string, studentDelay: number, maxExecTime: number, regressionDelivIds: string[] } | null>;
}

export class ClassPortal implements IClassPortal {
    private host: string = Config.getInstance().getProp(ConfigKey.backendUrl);
    private port: number = Config.getInstance().getProp(ConfigKey.backendPort);

    public async isStaff(userName: string): Promise<boolean> {

        const courseId = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of this var

        if (typeof courseId === "undefined" || courseId === null || typeof userName === "undefined" || userName === null) {
            Log.error("ClassPortal::isStaff(..) - missing parameters");
            return false;
        }

        const url = this.host + ":" + this.port + "/at/isStaff/" + userName;
        Log.info("ClassPortal::isStaff(..) - Sending request to " + url);
        const opts: rp.RequestPromiseOptions = {rejectUnauthorized: false};
        return rp(url, opts).then(function (res) {
            Log.trace("ClassPortal::isStaff( " + courseId + ", " + userName + " ) - success; payload: " + res);
            const json = JSON.parse(res);
            return json.isStaff;
        }).catch(function (err) {
            Log.trace("ClassPortal::isStaff(..) - ERROR; url: " + url + "; ERROR: " + err);
            return false; // err on the side of caution
        });
    }

    public async getDefaultDeliverableId(): Promise<string | null> {

        const courseId = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of this var
        const url = this.host + ":" + this.port + "/at/defaultDeliverable";
        const opts: rp.RequestPromiseOptions = {rejectUnauthorized: false};
        Log.info("ClassPortal::getDefaultDeliverableId(..) - Sending request to " + url);
        return rp(url, opts).then(function (res) {
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
    public async getContainerDetails(delivId: string): Promise<{ dockerImage: string, studentDelay: number, maxExecTime: number, regressionDelivIds: string[] } | null> {
        const courseId = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of this var
        if (typeof courseId === "undefined" || courseId === null || typeof delivId === "undefined" || delivId === null) {
            Log.error("ClassPortal::getContainerId(..) - missing parameters");
            return null;
        }

        const url = this.host + ":" + this.port + "/at/container/" + delivId;
        const opts: rp.RequestPromiseOptions = {rejectUnauthorized: false};
        Log.info("ClassPortal::getContainerId(..) - Sending request to " + url);
        return rp(url, opts).then(function (res) {
            Log.trace("ClassPortal::getContainerId( " + courseId + ", " + delivId + " ) - success; payload: " + res);
            const json = JSON.parse(res);
            return json;
        }).catch(function (err) {
            Log.trace("ClassPortal::getContainerId(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        });
    }

}
