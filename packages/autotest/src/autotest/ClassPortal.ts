import * as https from "https";
import * as http from "http";
import fetch, {RequestInit} from "node-fetch";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {AutoTestResult} from "@common/types/AutoTestTypes";
import {CommitTarget} from "@common/types/ContainerTypes";
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
} from "@common/types/PortalTypes";
import Util from "@common/Util";

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
     * @param {AutoTestResult} result
     * @returns {Promise<Payload>}
     */
    sendResult(result: AutoTestResult): Promise<Payload>;

    /**
     * Get result for a given <delivId, repoId, SHA, ref?> tuple If
     * ref is not specified, any ref will be matched.
     *
     * Return null if a result does not exist.
     *
     * @param {string} delivId
     * @param {string} repoId
     * @param {string} sha
     * @param {string} ref
     * @returns {Promise<AutoTestResultTransport | null>}
     */
    getResult(delivId: string, repoId: string, sha: string, ref?: string): Promise<AutoTestResultTransport | null>;

    /**
     * Converts a grade report into the feedback returned by the container. The default implementation
     * on portal just returns gradeRecord.feedback but courses are free to adjust this as needed using
     * their CourseController class.
     *
     * @returns {Promise<Payload>}
     */
    formatFeedback(res: AutoTestResultTransport): Promise<string | null>;

    /**
     * Asks Classy if a commit should be placed on the standard queue without a comment event.
     * The default implementation in portal just sends false, but courses can extend this behaviour
     * using their CustomCourseController class.
     *
     * @param {CommitTarget} info
     * @return {Promise<boolean>}
     */
    shouldPromotePush(info: CommitTarget): Promise<boolean>;

    /**
     * Asks Classy whether a person is allowed to make a request on a given deliverable.
     * The timestamp of their request is also included.
     *
     * A null return means that a custom scheduling scheme is not implemented and the default
     * time-based approach should be used.
     *
     * A non-null return means that a custom scheduling scheme is implemented;
     * if accepted is true, the request should proceed. If accepted is false,
     * the message should contain user-facing text about when their next request
     * can be made.
     *
     * @param delivId
     * @param personId
     * @param timestamp
     */
    requestFeedbackDelay(delivId: string, personId: string, timestamp: number):
        Promise<{ accepted: boolean, message: string } | null>;
}

/**
 * This class is used to communicate with the Classy backend. This is required
 * because AutoTest and Classy are separate services that need to communicate.
 *
 * The class exposes the aspects of Classy that AutoTest needs to know about.
 * Some of these are extended by the CourseController class in a course's
 * plugin, which enables per-course customization.
 */
export class ClassPortal implements IClassPortal {
    private host: string = Config.getInstance().getProp(ConfigKey.backendUrl);
    private port: number = Config.getInstance().getProp(ConfigKey.backendPort);

    public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
        const NO_ACCESS = {personId: userName, isStaff: false, isAdmin: false}; // if error, give no credentials
        const start = Date.now();

        const url = this.host + ":" + this.port + "/portal/at/isStaff/" + userName;
        try {
            Log.trace("ClassPortal::isStaff( " + userName + " ) - requesting from: " + url);
            const opts: RequestInit = {
                // agent: new https.Agent({rejectUnauthorized: false}),
                agent: this.getAgent(),
                headers: {
                    token: Config.getInstance().getProp(ConfigKey.autotestSecret)
                }
            };

            const res = await fetch(url, opts);
            Log.trace("ClassPortal::isStaff( " + userName + " ) - success; payload: " + res + "; took: " + Util.took(start));
            const json: AutoTestAuthPayload = await res.json() as AutoTestAuthPayload;
            Log.info("ClassPortal::isStaff( " + userName + " ) - success; isStaff: " +
                json.success.isStaff + "; isAdmin: " + json.success.isAdmin);
            if (typeof json.success !== "undefined") {
                return json.success;
            } else {
                Log.error("ClassPortal::isStaff(..) - inner ERROR; url: " + url + "; ERROR: " + JSON.stringify(json));
                return NO_ACCESS;
            }

        } catch (err) {
            Log.error("ClassPortal::isStaff(..) - outer ERROR; url: " + url + "; ERROR: " + err);
            return NO_ACCESS;
        }
    }

    public async getPersonId(githubId: string): Promise<AutoTestPersonIdTransport> {
        const url = this.host + ":" + this.port + "/portal/at/personId/" + githubId;
        const start = Date.now();

        try {
            Log.trace("ClassPortal::getPersonId( " + githubId + " ) - requesting from: " + url);
            const opts: RequestInit = {
                // agent: new https.Agent({rejectUnauthorized: false}),
                agent: this.getAgent(),
                headers: {
                    token: Config.getInstance().getProp(ConfigKey.autotestSecret)
                }
            };

            const res = await fetch(url, opts);
            const json: Payload = await res.json() as Payload;
            if (typeof json.success !== "undefined") {
                Log.info("ClassPortal::getPersonId( " + githubId + " ) - success; person: " +
                    json.success?.personId + "; took: " + Util.took(start));
                return json.success; // AutoTestPersonIdTransport
            } else {
                Log.error("ClassPortal::getPersonId(..) - ERROR: " + JSON.stringify(json));
                return null;
            }
        } catch (err) {
            Log.error("ClassPortal::getPersonId(..) - ERROR; url: " + url + "; ERROR: " + err);
        }
        return null;
    }

    public async getConfiguration(): Promise<ClassyConfigurationTransport | null> {

        const url = this.host + ":" + this.port + "/portal/at";
        const start = Date.now();

        const opts: RequestInit = {
            // agent: new https.Agent({rejectUnauthorized: false}),
            agent: this.getAgent(),
            headers: {
                token: Config.getInstance().getProp(ConfigKey.autotestSecret)
            }
        };
        Log.trace("ClassPortal::getConfiguration(..) - requesting from: " + url);
        try {
            const res = await fetch(url, opts);
            Log.trace("ClassPortal::getConfiguration() - success; took: " + Util.took(start));
            // Log.trace("ClassPortal::getConfiguration() - success; payload:", res);
            const json: ClassyConfigurationPayload = await res.json() as ClassyConfigurationPayload;
            if (typeof json.success !== "undefined") {
                return json.success;
            } else {
                Log.trace("ClassPortal::getConfiguration() - ERROR: " + JSON.stringify(json));
                return null;
            }
        } catch (err) {
            Log.trace("ClassPortal::getConfiguration() - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        }
    }

    public async getContainerDetails(delivId: string): Promise<AutoTestConfigTransport | null> {
        const url = this.host + ":" + this.port + "/portal/at/container/" + delivId;
        const start = Date.now();

        const opts: RequestInit = {
            // agent: new https.Agent({rejectUnauthorized: false}),
            agent: this.getAgent(),
            headers: {
                token: Config.getInstance().getProp(ConfigKey.autotestSecret)
            }
        };
        Log.trace("ClassPortal::getContainerDetails(..) - requesting from: " + url);

        if (delivId === null || delivId === "null") {
            Log.trace("ClassPortal::getContainerDetails(..) - skipping request; null delivId");
            return null;
        } else {
            try {
                const res = await fetch(url, opts);
                Log.trace("ClassPortal::getContainerDetails( " + delivId + " ) - success; took: " + Util.took(start));
                // Log.trace("ClassPortal::getContainerDetails( " + delivId + " ) - success; payload:", res);
                const json: AutoTestConfigPayload = await res.json() as AutoTestConfigPayload;
                if (typeof json.success !== "undefined") {
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
    }

    public async sendGrade(grade: AutoTestGradeTransport): Promise<Payload> { // really just a mechanism to report more verbose error
        const url = this.host + ":" + this.port + "/portal/at/grade";
        const start = Date.now();
        try {
            const opts: RequestInit = {
                // agent: new https.Agent({rejectUnauthorized: false}),
                agent: this.getAgent(),
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "token": Config.getInstance().getProp(ConfigKey.autotestSecret)
                },
                body: JSON.stringify(grade)
            };

            Log.trace("ClassPortal::sendGrade(..) - sending to: " + url + "; deliv: " + grade.delivId +
                "; repo: " + grade.repoId + "; url: " + grade.URL);
            Log.trace("ClassPortal::sendGrade(..) - payload: " + JSON.stringify(grade));
            const res = await fetch(url, opts);

            const json = await res.json();
            if (typeof json.success !== "undefined") {
                Log.info("ClassPortal::sendGrade(..) - grade accepted; deliv: " + grade.delivId +
                    "; repo: " + grade.repoId + "; took: " + Util.took(start));
                return json;
            } else {
                Log.error("ClassPortal::sendGrade(..) - ERROR; grade not accepted:  " + JSON.stringify(json));
                return json;
            }
        } catch (err) {
            Log.error("ClassPortal::sendGrade(..) - ERROR; url: " + url + "; ERROR: " + err + "; took: " + Util.took(start));
            return {failure: {message: err.message, shouldLogout: false}} as Payload;
        }
    }

    public async formatFeedback(res: AutoTestResultTransport): Promise<string | null> {
        const start = Date.now();

        Log.trace("ClassPortal::formatFeedback(..) - start; deliv: " +
            res.delivId + "; URL: " + res.commitURL);

        let feedback: string = "";
        try {
            const gradeRecord = res.output.report;
            feedback = gradeRecord.feedback;
        } catch (err) {
            Log.error("ClassPortal::formatFeedback(..) - ERROR; message: " + err.message);
            return null;
        }

        let msg = feedback;
        if (msg !== null) {
            const MAX_COMMENT_LENGTH = 40;
            if (msg.length > MAX_COMMENT_LENGTH) {
                // shorten long messages
                msg = msg.substring(0, MAX_COMMENT_LENGTH) + "...";
            }
            // replace newlines / line breaks with "; ", regardless of length
            msg = msg.replace(/(?:\r\n|\r|\n)/g, "; ");
            msg = msg.replace("; ; ", "; "); // replace a double new line
        }

        Log.trace("ClassPortal::formatFeedback(..) - repo: " + res.repoId + "; SHA: " +
            Util.shaHuman(res.commitSHA) + "; feedback: " + msg + "; took: " + Util.took(start));
        Log.info("ClassPortal::formatFeedback(..) - deliv: " +
            res.delivId + "; repo: " + res.repoId + "; feedback: " + msg + "; took: " + Util.took(start));
        return feedback;
    }

    public async sendResult(result: AutoTestResult): Promise<Payload> { // really just a mechanism to report more verbose errors
        const start = Date.now();
        const url = this.host + ":" + this.port + "/portal/at/result";

        try {
            const opts: RequestInit = {
                // agent: new https.Agent({rejectUnauthorized: false}),
                agent: this.getAgent(),
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                    "token": Config.getInstance().getProp(ConfigKey.autotestSecret)
                },
                body: JSON.stringify(result)
            };

            Log.trace("ClassPortal::sendResult(..) - sending to: " + url + " for deliv: " + result.delivId +
                "; repoId: " + result.repoId + "; SHA: " + result.input.target.commitSHA);
            const res = await fetch(url, opts);
            Log.trace("ClassPortal::sendResult() - sent; returned payload: " + JSON.stringify(res));
            const json = await res.json();
            if (typeof json.success !== "undefined") {
                Log.info("ClassPortal::sendResult(..) - result accepted; SHA: " +
                    Util.shaHuman(result.input.target.commitSHA) + "; took: " + Util.took(start));
                return json;
            } else {
                Log.error("ClassPortal::sendResult(..) - ERROR; result not acccepted:  " + JSON.stringify(json));
                return json;
            }
        } catch (err) {
            Log.error("ClassPortal::sendResult(..) - ERROR; url: " + url + "; ERROR: " + err + "; took: " + Util.took(start));
            return {failure: {message: err.message, shouldLogout: false}} as Payload;
        }
    }

    public async getResult(delivId: string, repoId: string, sha: string, ref?: string): Promise<AutoTestResultTransport | null> {
        if (!ref || ref === "") { // undefined, null, "" should match any result
            ref = "<ANY>";
        }

        Log.info("ClassPortal::getResult( " + delivId + ", " + repoId + ", " + Util.shaHuman(sha) + ", " + ref + " ) - start");
        const start = Date.now();

        const refStr = encodeURIComponent(ref); // refs can have / in them, so they need to be encoded
        const url = this.host + ":" + this.port + "/portal/at/result/" + delivId + "/" + repoId + "/" + sha + "/" + refStr;

        try {
            const opts: RequestInit = {
                // agent: new https.Agent({rejectUnauthorized: false}),
                agent: this.getAgent(),
                method: "get",
                headers: {token: Config.getInstance().getProp(ConfigKey.autotestSecret)}
            };

            Log.trace("ClassPortal::getResult(..) - requesting from: " + url);
            const res = await fetch(url, opts);
            // Log.trace("ClassPortal::getResult() - sent; returned payload: " + res);
            const json: AutoTestResultPayload = await res.json() as AutoTestResultPayload;
            if (typeof json.success !== "undefined") {
                Log.info("ClassPortal::getResult(..) - result received; length: " + json.success.length + "; took: " + Util.took(start));
                const success = json.success as AutoTestResultTransport[];
                if (success.length > 0) {
                    return success[0];
                } else {
                    return null;
                }
            } else {
                Log.error("ClassPortal::getResult(..) - ERROR; result not received:  " +
                    JSON.stringify(json) + "; took: " + Util.took(start));
                return null;
            }
        } catch (err) {
            Log.error("ClassPortal::getResult(..) - ERROR; url: " + url + "; ERROR: " + err);
            return null;
        }
    }

    public async shouldPromotePush(info: CommitTarget): Promise<boolean> {
        const url = `${this.host}:${this.port}/portal/at/promotePush`;
        const start = Date.now();
        let shouldPromote = false;

        Log.trace(`ClassPortal::shouldPromotePush(..) - Start for commit ${info.commitSHA}`);

        try {
            const opts: RequestInit = {
                // agent: new https.Agent({rejectUnauthorized: false}),
                agent: this.getAgent(),
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "token": Config.getInstance().getProp(ConfigKey.autotestSecret)
                },
                body: JSON.stringify(info)
            };

            const response = await fetch(url, opts);
            const json = await response.json();
            if (json.success !== undefined && typeof json.success.shouldPromote === "boolean") {
                shouldPromote = json.success.shouldPromote;
            } else {
                Log.error("ClassPortal::shouldPromotePush(..) - ERROR (bad response); Defaulting to no promotion", json);
            }
        } catch (err) {
            Log.error("ClassPortal::shouldPromotePush(..) - ERROR (making request); Defaulting to no promotion", err);
        }

        Log.trace(`ClassPortal::shouldPromotePush(${info.commitSHA}): ${shouldPromote}; Took: ${Util.took(start)}`);
        return shouldPromote;
    }

    public async requestFeedbackDelay(delivId: string, personId: string, timestamp: number): Promise<{
        accepted: boolean;
        message: string
    } | null> {

        const url = `${this.host}:${this.port}/portal/at/feedbackDelay`;
        const start = Date.now();

        Log.info(`ClassPortal::requestFeedbackDelay(..) - start; person: ${personId}; delivId: ${delivId}`);

        // default to null
        let resp: { accepted: boolean, message: string } | null = null;

        try {
            const opts: RequestInit = {
                // agent: new https.Agent({rejectUnauthorized: false}),
                agent: this.getAgent(),
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "token": Config.getInstance().getProp(ConfigKey.autotestSecret)
                },
                body: JSON.stringify(
                    {delivId: delivId, personId: personId, timestamp: timestamp}
                )
            };

            const response = await fetch(url, opts);
            let json = await response.json();
            if (json?.success?.feedbackDelay) {
                // strip outer wrapper
                json = json.success.feedbackDelay;
            }
            Log.info("ClassPortal::requestFeedbackDelay(..) - returned; payload: " + JSON.stringify(json));

            Log.trace("ClassPortal::requestFeedbackDelay(..) - types; json: " + typeof json +
                "; json.accepted: " + typeof json?.accepted +
                "; json.message: " + typeof json?.message +
                "; json.notImplemented: " + typeof json?.notImplemented);

            if (typeof json?.accepted === "boolean" && typeof json?.message === "string") {
                resp = {
                    accepted: json.accepted,
                    message: json.message
                };
            } else if (typeof json?.notImplemented === "boolean" && json.notImplemented === true) {
                resp = null;
            } else {
                Log.error("ClassPortal::requestFeedbackDelay(..) - ERROR (bad response); Defaulting to no custom scheduler", json);
                resp = null; // if something goes wrong, default to no custom scheduler
            }
        } catch (err) {
            Log.error("ClassPortal::requestFeedbackDelay(..) - ERROR (making request); Defaulting to no promotion", err);
        }

        const respStr = JSON.stringify(resp);
        Log.info(`ClassPortal::requestFeedbackDelay(${delivId}, ${personId}): ${respStr}; Took: ${Util.took(start)}`);
        return resp;
    }

    private getAgent() {
        const url = this.host;
        const isHttps = url.startsWith("https");
        Log.trace("ClassPortal::getAgent() - isHttps: " + isHttps);
        if (isHttps) {
            return new https.Agent({rejectUnauthorized: false});
        } else {
            Log.warn("ClassPortal::getAgent() - using http agent, this should only be used in testing environments.");
            new http.Agent();
        }
    }
}
