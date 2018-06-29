import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {
    AutoTestAuthPayload,
    AutoTestAuthTransport,
    AutoTestConfigPayload,
    AutoTestConfigTransport,
    AutoTestDefaultDeliverablePayload,
    AutoTestDefaultDeliverableTransport
} from "../../../common/types/PortalTypes";

export interface IClassPortal {

    /**
     *
     * GET /admin/getDefaultDeliverable
     *
     */
    getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null>;

    /**
     * Returns whether the username is privileged on the course.
     * Returns false if anything goes wrong.
     *
     * GET /at/isStaff{:userId}
     *
     * @param userName
     */
    isStaff(userName: string): Promise<AutoTestAuthTransport>;

    /**
     * Gets the identifier for the AutoTest docker container that should process requests for this deliverable.
     *
     * GET /admin/{:org}/{:delivId}/container
     *
     * @param courseId
     */
    getContainerDetails(delivId: string): Promise<AutoTestConfigTransport | null>;
}

export class ClassPortal implements IClassPortal {
    private host: string = Config.getInstance().getProp(ConfigKey.backendUrl);
    private port: number = Config.getInstance().getProp(ConfigKey.backendPort);

    public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
        const url = this.host + ":" + this.port + "/at/isStaff/" + userName;
        Log.info("ClassPortal::isStaff(..) - Sending request to " + url);
        const opts: rp.RequestPromiseOptions = {rejectUnauthorized: false};
        return rp(url, opts).then(function (res) {
            Log.trace("ClassPortal::isStaff( " + userName + " ) - success; payload: " + res);
            const json: AutoTestAuthPayload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                return json.success;
            } else {
                Log.error("ClassPortal::isStaff(..) - ERROR: " + JSON.stringify(json));
                return {personId: userName, isStaff: false, isAdmin: false}; // if error, give no credentials
            }
        }).catch(function (err) {
            Log.error("ClassPortal::isStaff(..) - ERROR; url: " + url + "; ERROR: " + err);
            return {personId: userName, isStaff: false, isAdmin: false}; // if error, give no credentials
        });
    }

    public async getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null> {

        const url = this.host + ":" + this.port + "/at/defaultDeliverable";
        const opts: rp.RequestPromiseOptions = {rejectUnauthorized: false};
        Log.info("ClassPortal::getDefaultDeliverableId(..) - Sending request to " + url);
        return rp(url, opts).then(function (res) {
            Log.trace("ClassPortal::getDefaultDeliverableId() - success; payload: " + res);
            const json: AutoTestDefaultDeliverablePayload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                return json.success;
            } else {
                Log.trace("ClassPortal::getDefaultDeliverableId() - ERROR: " + JSON.stringify(json));
                return null;
            }
        }).catch(function (err) {
            Log.trace("ClassPortal::getDefaultDeliverableId() - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        });
    }

    public async getContainerDetails(delivId: string): Promise<AutoTestConfigTransport | null> {
        const url = this.host + ":" + this.port + "/at/container/" + delivId;
        const opts: rp.RequestPromiseOptions = {rejectUnauthorized: false};
        Log.info("ClassPortal::getContainerId(..) - Sending request to " + url);
        return rp(url, opts).then(function (res) {
            Log.trace("ClassPortal::getContainerId( " + delivId + " ) - success; payload: " + res);
            const json: AutoTestConfigPayload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                return json.success;
            } else {
                Log.error("ClassPortal::getContainerId(..) - ERROR: " + JSON.stringify(json));
                return null;
            }
        }).catch(function (err) {
            Log.error("ClassPortal::getContainerId(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        });
    }

}
