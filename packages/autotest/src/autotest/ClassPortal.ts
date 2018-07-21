import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {IAutoTestResult} from "../Types";
import {
    AutoTestAuthPayload,
    AutoTestAuthTransport,
    AutoTestConfigPayload,
    AutoTestConfigTransport,
    AutoTestDefaultDeliverablePayload,
    AutoTestDefaultDeliverableTransport,
    AutoTestGradeTransport,
    AutoTestResultPayload,
    AutoTestResultTransport,
    Payload
} from "../../../common/types/PortalTypes";

export interface IClassPortal {

    /**
     *
     * GET /portal/admin/getDefaultDeliverable
     *
     */
    getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null>;

    /**
     * Returns whether the username is privileged on the course.
     *
     * GET /portal/at/isStaff{:userId}
     *
     * @param userName
     */
    isStaff(userName: string): Promise<AutoTestAuthTransport>;

    /**
     * Gets the identifier for the AutoTest docker container that should process
     * requests for this deliverable.
     *
     * @param delivId
     */
    getContainerDetails(delivId: string): Promise<AutoTestConfigTransport | null>;

    /**
     * Send grade for saving. Useful for courses where the container decides
     * if a grade should be saved (rather than portal-backend making the decision
     * about what grade should be saved).
     *
     * POST /portal/at/grade
     */
    sendGrade(grade: AutoTestGradeTransport): Promise<Payload>;

    // This seems like it should be here, but AutoTest does all of this itself in
    // AutoTest::handleExecutionComplete

    /**
     * Send result for saving.
     *
     * POST /portal/at/result
     *
     * @param {IAutoTestResult} result
     * @returns {Promise<Payload>}
     */
    sendResult(result: IAutoTestResult): Promise<Payload>;

    /**
     * Get result for a given delivId / repoId pair. Will return null if a result does not exist.
     *
     * @param {string} delivId
     * @param {string} repoId
     * @returns {Promise<AutoTestResultTransport | null>}
     */
    getResult(delivId: string, repoId: string): Promise<AutoTestResultTransport | null>;
}

export class ClassPortal implements IClassPortal {
    private host: string = Config.getInstance().getProp(ConfigKey.backendUrl);
    private port: number = Config.getInstance().getProp(ConfigKey.backendPort);

    public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
        const NO_ACCESS = {personId: userName, isStaff: false, isAdmin: false}; // if error, give no credentials

        try {
            const url = this.host + ":" + this.port + "/portal/at/isStaff/" + userName;
            Log.info("ClassPortal::isStaff(..) - Sending request to " + url);
            const opts: rp.RequestPromiseOptions = {
                rejectUnauthorized: false,
                headers:            {
                    token: Config.getInstance().getProp(ConfigKey.autotestSecret)
                }
            };

            return rp(url, opts).then(function (res) {
                Log.trace("ClassPortal::isStaff( " + userName + " ) - success; payload: " + res);
                const json: AutoTestAuthPayload = JSON.parse(res);
                if (typeof json.success !== 'undefined') {
                    return json.success;
                } else {
                    Log.error("ClassPortal::isStaff(..) - ERROR: " + JSON.stringify(json));
                    return NO_ACCESS;
                }
            }).catch(function (err) {
                Log.error("ClassPortal::isStaff(..) - ERROR; url: " + url + "; ERROR: " + err);
                return NO_ACCESS;
            });
        } catch (err) {
            Log.error("ClassPortal::isStaff(..) - ERROR: " + err);
            return NO_ACCESS;
        }
    }

    public async getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null> {

        const url = this.host + ":" + this.port + "/portal/at/defaultDeliverable";
        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false, headers: {
                token: Config.getInstance().getProp(ConfigKey.autotestSecret)
            }
        };
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
        const url = this.host + ":" + this.port + "/portal/at/container/" + delivId;
        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false, headers: {
                token: Config.getInstance().getProp(ConfigKey.autotestSecret)
            }
        };
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

    public async sendGrade(grade: AutoTestGradeTransport): Promise<Payload> { // really just a mechanism to report more verbose errors
        const url = this.host + ":" + this.port + "/portal/at/grade/";
        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false, method: 'post', headers: {
                token: Config.getInstance().getProp(ConfigKey.autotestSecret)
            }
        };
        Log.info("ClassPortal::sendGrade(..) - Sending request to " + url);
        return rp(url, opts).then(function (res) {
            Log.trace("ClassPortal::sendGrade() - sent; returned payload: " + res);
            const json: Payload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                Log.error("ClassPortal::sendGrade(..) - successfully received");
                return json;
            } else {
                Log.error("ClassPortal::sendGrade(..) - ERROR; not successfully received:  " + JSON.stringify(json));
                return json;
            }
        }).catch(function (err) {
            Log.error("ClassPortal::sendGrade(..) - ERROR; url: " + url + "; ERROR: " + err);
            const pay: Payload = {failure: {message: err.message, shouldLogout: false}};
            return pay;
        });
    }

    public async sendResult(result: IAutoTestResult): Promise<Payload> { // really just a mechanism to report more verbose errors

        const url = this.host + ":" + this.port + "/portal/at/result/";

        let payload: AutoTestResultTransport = result;

        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false,
            method:             'post',
            body:               payload,
            headers:            {token: Config.getInstance().getProp(ConfigKey.autotestSecret)}
        };

        Log.info("ClassPortal::sendResult(..) - Sending request to " + url);
        return rp(url, opts).then(function (res) {
            Log.trace("ClassPortal::sendResult() - sent; returned payload: " + res);
            const json: Payload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                Log.error("ClassPortal::sendResult(..) - successfully received");
                return json;
            } else {
                Log.error("ClassPortal::sendResult(..) - ERROR; not successfully received:  " + JSON.stringify(json));
                return json;
            }
        }).catch(function (err) {
            Log.error("ClassPortal::sendResult(..) - ERROR; url: " + url + "; ERROR: " + err);
            const pay: Payload = {failure: {message: err.message, shouldLogout: false}};
            return pay;
        });
    }

    public async getResult(delivId: string, repoId: string): Promise<AutoTestResultTransport | null> {
        Log.info("ClassPortal::getResut( " + delivId + ", " + repoId + " ) - start");
        const url = this.host + ":" + this.port + "/portal/at/result/" + delivId + "/" + repoId;
        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false,
            method:             'get',
            headers:            {token: Config.getInstance().getProp(ConfigKey.autotestSecret)}
        };
        Log.info("ClassPortal::getResult(..) - Requesting result from: " + url);
        return rp(url, opts).then(function (res) {
            Log.trace("ClassPortal::getResult() - sent; returned payload: " + res);
            const json: AutoTestResultPayload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                Log.error("ClassPortal::getResult(..) - successfully received");
                return <AutoTestResultTransport>json.success;
            } else {
                Log.error("ClassPortal::getResult(..) - ERROR; not successfully received:  " + JSON.stringify(json));
                return null;
            }
        }).catch(function (err) {
            Log.error("ClassPortal::getResult(..) - ERROR; url: " + url + "; ERROR: " + err);
            // const pay: Payload = {failure: {message: err.message, shouldLogout: false}};
            // return pay;
            return null;
        });
    }


}
