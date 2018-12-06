import * as rp from "request-promise-native";

import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {AutoTestResult} from "../../../common/types/AutoTestTypes";
import {GradeReport} from "../../../common/types/ContainerTypes";
import {
    AutoTestAuthPayload,
    AutoTestAuthTransport,
    AutoTestConfigPayload,
    AutoTestConfigTransport,
    AutoTestGradeTransport,
    AutoTestPersonIdTransport,
    AutoTestResultPayload,
    AutoTestResultTransport,
    ClassyConfigurationPayload,
    ClassyConfigurationTransport,
    Payload
} from "../../../common/types/PortalTypes";

export interface IClassPortal {

    /**
     * Returns the personId for a given githubId (since githubIds are not guaranteed to be stable).
     *
     * GET /portal/at/personId/{:githubId}
     *
     * @param userName
     */
    getPersonId(userName: string): Promise<AutoTestPersonIdTransport | null>;

    /**
     *
     * GET /portal/admin/getDefaultDeliverable
     *
     */
    getConfiguration(): Promise<ClassyConfigurationTransport | null>;

    /**
     * Returns whether the username is privileged on the course.
     *
     * GET /portal/at/isStaff/{:githubId}
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
    sendResult(result: AutoTestResult): Promise<Payload>;

    /**
     * Get result for a given delivId / repoId pair. Will return null if a result does not exist.
     *
     * @param {string} delivId
     * @param {string} repoId
     * @param {string} sha
     * @returns {Promise<AutoTestResultTransport | null>}
     */
    getResult(delivId: string, repoId: string, sha: string): Promise<AutoTestResultTransport | null>;

    /**
     * Converts a grade report into the feedback returned by the container. The default implementation
     * on portal just returns gradeRecord.feedback but courses are free to adjust this as needed using
     * their CourseController class.
     *
     * @param {GradeReport} gradeRecord
     * @param {string} feedbackMode
     * @returns {Promise<Payload>}
     */
    formatFeedback(gradeRecord: GradeReport, feedbackMode?: string): Promise<string | null>;
}

export class ClassPortal implements IClassPortal {
    private host: string = Config.getInstance().getProp(ConfigKey.backendUrl);
    private port: number = Config.getInstance().getProp(ConfigKey.backendPort);

    public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
        const NO_ACCESS = {personId: userName, isStaff: false, isAdmin: false}; // if error, give no credentials

        try {
            const url = this.host + ":" + this.port + "/portal/at/isStaff/" + userName;
            Log.info("ClassPortal::isStaff(..) - requesting from: " + url);
            const opts: rp.RequestPromiseOptions = {
                rejectUnauthorized: false,
                headers:            {
                    token: Config.getInstance().getProp(ConfigKey.autotestSecret)
                }
            };

            const res = await rp(url, opts);
            Log.trace("ClassPortal::isStaff( " + userName + " ) - success; payload: " + res);
            const json: AutoTestAuthPayload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                return json.success;
            } else {
                Log.error("ClassPortal::isStaff(..) - ERROR: " + JSON.stringify(json));
                return NO_ACCESS;
            }

        } catch (err) {
            Log.error("ClassPortal::isStaff(..) - ERROR: " + err);
            return NO_ACCESS;
        }
    }

    public async getPersonId(githubId: string): Promise<AutoTestPersonIdTransport> {
        // const NO_ACCESS = {personId: userName, isStaff: false, isAdmin: false}; // if error, give no credentials
        const url = this.host + ":" + this.port + "/portal/at/personId/" + githubId;
        try {
            Log.info("ClassPortal::personId(..) - requesting from: " + url);
            const opts: rp.RequestPromiseOptions = {
                rejectUnauthorized: false,
                headers:            {
                    token: Config.getInstance().getProp(ConfigKey.autotestSecret)
                }
            };

            const res = await rp(url, opts);
            Log.trace("ClassPortal::personId( " + githubId + " ) - success; payload: " + res);
            const json: Payload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                return json.success; // AutoTestPersonIdTransport
            } else {
                Log.error("ClassPortal::personId(..) - ERROR: " + JSON.stringify(json));
                return null;
            }
        } catch (err) {
            Log.error("ClassPortal::personId(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        }
    }

    public async getConfiguration(): Promise<ClassyConfigurationTransport | null> {

        const url = this.host + ":" + this.port + "/portal/at";
        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false, headers: {
                token: Config.getInstance().getProp(ConfigKey.autotestSecret)
            }
        };
        Log.trace("ClassPortal::getDefaultDeliverableId(..) - requesting from: " + url);
        try {
            const res = await rp(url, opts); // .then(function(res) {
            Log.trace("ClassPortal::getDefaultDeliverableId() - success; payload: " + res);
            const json: ClassyConfigurationPayload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                return json.success;
            } else {
                Log.trace("ClassPortal::getDefaultDeliverableId() - ERROR: " + JSON.stringify(json));
                return null;
            }
        } catch (err) {
            Log.trace("ClassPortal::getDefaultDeliverableId() - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        }
    }

    public async getContainerDetails(delivId: string): Promise<AutoTestConfigTransport | null> {
        const url = this.host + ":" + this.port + "/portal/at/container/" + delivId;
        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false, headers: {
                token: Config.getInstance().getProp(ConfigKey.autotestSecret)
            }
        };
        Log.trace("ClassPortal::getContainerDetails(..) - requesting from: " + url);
        try {
            const res = await rp(url, opts);
            Log.trace("ClassPortal::getContainerDetails( " + delivId + " ) - success; payload: " + res);
            const json: AutoTestConfigPayload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                return json.success;
            } else {
                Log.warn("ClassPortal::getContainerDetails(..) - ERROR: " + JSON.stringify(json));
                return null;
            }
        } catch (err) {
            Log.error("ClassPortal::getContainerDetails(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        }
    }

    public async sendGrade(grade: AutoTestGradeTransport): Promise<Payload> { // really just a mechanism to report more verbose errors
        const url = this.host + ":" + this.port + "/portal/at/grade/";
        try {
            const opts: rp.RequestPromiseOptions = {
                rejectUnauthorized: false,
                method:             'POST',
                headers:            {
                    "Content-Type": "application/json",
                    "token":        Config.getInstance().getProp(ConfigKey.autotestSecret)
                },
                body:               grade,
                json:               true
            };

            Log.trace("ClassPortal::sendGrade(..) - sending to: " + url + '; delivId: ' + grade.delivId +
                '; repo: ' + grade.repoId + '; url: ' + grade.URL);
            Log.trace("ClassPortal::sendGrade(..) - payload: " + JSON.stringify(grade));
            const res = await rp(url, opts);

            const json = res;
            if (typeof json.success !== 'undefined') {
                Log.info("ClassPortal::sendGrade(..) - grade accepted; url: " + grade.URL);
                return json;
            } else {
                Log.error("ClassPortal::sendGrade(..) - ERROR; grade not accepted:  " + JSON.stringify(json));
                return json;
            }
        } catch (err) {
            Log.error("ClassPortal::sendGrade(..) - ERROR; url: " + url + "; ERROR: " + err);
            const pay: Payload = {failure: {message: err.message, shouldLogout: false}};
            return pay;
        }
    }

    public async formatFeedback(gradeRecord: GradeReport, feedbackMode?: string): Promise<string | null> {
        Log.info("ClassPortal::formatFeedback(..) - start; feedbackMode: " + feedbackMode);
        try {
            // TODO: this could actually be sent to the frontend for consideration in the course-specific classy controller

            let feedback: string = gradeRecord.feedback;

            let altFeedback: string = "";
            if (typeof feedbackMode === "string" && feedbackMode !== "default") {
                altFeedback = (gradeRecord.custom as any)[feedbackMode].feedback;

                if (typeof altFeedback === "string") {
                    Log.info("ClassPortal::formatFeedback(..) - using altFeedback");
                    feedback = altFeedback;
                }
            }

            return feedback;
        } catch (err) {
            Log.error("ClassPortal::formatFeedback(..) - ERROR; message: " + err.message);
            return null;
        }
    }

    public async sendResult(result: AutoTestResult): Promise<Payload> { // really just a mechanism to report more verbose errors
        const url = this.host + ":" + this.port + "/portal/at/result/";

        try {
            const opts: rp.RequestPromiseOptions = {
                rejectUnauthorized: false,
                method:             'post',
                headers:            {
                    "Content-Type": "application/json",
                    "token":        Config.getInstance().getProp(ConfigKey.autotestSecret)
                },
                body:               result,
                json:               true
            };

            Log.trace("ClassPortal::sendResult(..) - sending to: " + url + ' for delivId: ' + result.delivId +
                '; repoId: ' + result.repoId + '; SHA: ' + result.input.target.commitSHA);
            const res = await rp(url, opts);
            Log.trace("ClassPortal::sendResult() - sent; returned payload: " + JSON.stringify(res));
            const json = res;
            if (typeof json.success !== 'undefined') {
                Log.info("ClassPortal::sendResult(..) - result accepted; SHA: " + result.input.target.commitSHA);
                return json;
            } else {
                Log.error("ClassPortal::sendResult(..) - ERROR; result not acccepted:  " + JSON.stringify(json));
                return json;
            }
        } catch (err) {
            Log.error("ClassPortal::sendResult(..) - ERROR; url: " + url + "; ERROR: " + err);
            const pay: Payload = {failure: {message: err.message, shouldLogout: false}};
            return pay;
        }
    }

    public async getResult(delivId: string, repoId: string, sha: string): Promise<AutoTestResultTransport | null> {
        Log.info("ClassPortal::getResut( " + delivId + ", " + repoId + ", " + sha + " ) - start");
        const url = this.host + ":" + this.port + "/portal/at/result/" + delivId + "/" + repoId + "/" + sha;
        try {
            const opts: rp.RequestPromiseOptions = {
                rejectUnauthorized: false,
                method:             'get',
                headers:            {token: Config.getInstance().getProp(ConfigKey.autotestSecret)}
            };
            Log.info("ClassPortal::getResult(..) - requesting from: " + url);
            const res = await rp(url, opts);
            // Log.trace("ClassPortal::getResult() - sent; returned payload: " + res);
            const json: AutoTestResultPayload = JSON.parse(res);
            if (typeof json.success !== 'undefined') {
                Log.info("ClassPortal::getResult(..) - result received; length: " + json.success.length);
                const success = json.success as AutoTestResultTransport[];
                if (success.length > 0) {
                    return success[0];
                } else {
                    return null;
                }
            } else {
                Log.error("ClassPortal::getResult(..) - ERROR; result not received:  " + JSON.stringify(json));
                return null;
            }
        } catch (err) {
            Log.error("ClassPortal::getResult(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        }
    }

}
