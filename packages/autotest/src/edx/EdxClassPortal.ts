import Log from "../../../common/Log";
import {AutoTestDefaultDeliverableTransport, AutoTestPersonIdTransport} from "../../../common/types/PortalTypes";
import {ClassPortal} from "../autotest/ClassPortal";

export class EdXClassPortal extends ClassPortal {
    // private host: string = Config.getInstance().getProp(ConfigKey.backendUrl);
    // private port: number = Config.getInstance().getProp(ConfigKey.backendPort);

    // public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
    //     Log.info("EdXClassPortal::isStaff(..) - start");
    //     const courseId = Config.getInstance().getProp(ConfigKey.name);
    //     if (courseId === "sdmm") {
    //         if (userName === "rtholmes") {
    //             return {personId: userName, isStaff: true, isAdmin: true};
    //         }
    //     }
    //     return {personId: userName, isStaff: false, isAdmin: false};
    // }

    /**
     * There is no default deliverable for the SDMM since it is self-paced.
     *
     * @returns {Promise<AutoTestDefaultDeliverableTransport | null>}
     */
    public async getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null> {
        Log.info("EdXClassPortal::getDefaultDeliverableId(..) - returning null (no default deliverable for SDMM)");
        // no default deliverable for edx
        return null;
    }

    // public async getContainerDetails(delivId: string): Promise<{dockerImage: string, studentDelay: number, maxExecTime: number, regressionDelivIds: string[], custom: object} | null> {
    //     Log.info("EdXClassPortal::getContainerDetails(..) - start");
    //     const url = this.host + ":" + this.port + "/portal/at/container/" + delivId;
    //     const opts: rp.RequestPromiseOptions = {
    //         rejectUnauthorized: false, headers: {
    //             token: Config.getInstance().getProp(ConfigKey.autotestSecret)
    //         }
    //     };
    //     Log.info("EdXClassPortal::getContainerId(..) - Sending request to " + url);
    //     return rp(url, opts).then(function(res) {
    //         Log.trace("EdXClassPortal::getContainerId( " + delivId + " ) - success; payload: " + res);
    //         const json: AutoTestConfigPayload = JSON.parse(res);
    //         if (typeof json.success !== 'undefined') {
    //             return json.success;
    //         } else {
    //             Log.error("EdXClassPortal::getContainerId(..) - ERROR: " + JSON.stringify(json));
    //             return null;
    //         }
    //     }).catch(function(err) {
    //         Log.error("EdXClassPortal::getContainerId(..) - ERROR; url: " + url + "; ERROR: " + err);
    //         return null;
    //     });
    // }

    // public async sendGrade(grade: AutoTestGradeTransport): Promise<Payload> {
    //     Log.info("EdXClassPortal::getGrade(..) - start");
    //     return {success: {worked: true}};
    // }
    //
    // public async sendResult(grade: IAutoTestResult): Promise<Payload> {
    //     Log.info("EdXClassPortal::sendResult(..) - start");
    //     return {success: {worked: true}};
    // }
    //
    // getResult(delivId: string, repoId: string): Promise<AutoTestResultTransport | null> {
    //     Log.info("EdXClassPortal::getResult(..) - start");
    //     return null;
    // }

    /**
     * personId === githubId for the SDMM.
     * @param {string} githubId
     * @returns {Promise<AutoTestPersonIdTransport | null>}
     */
    getPersonId(githubId: string): Promise<AutoTestPersonIdTransport | null> {
        // usernames are the same for edX
        const payload: AutoTestPersonIdTransport = {
            personId: githubId
        };
        Log.info("EdXClassPortal::getPersonId( " + githubId + " ) - returning: " + JSON.stringify(payload));
        return Promise.resolve(payload);
    }
}

