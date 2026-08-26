import { AdminController } from "@backend/controllers/AdminController";
import { AuthController } from "@backend/controllers/AuthController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { GradesController } from "@backend/controllers/GradesController";
import { PersonController } from "@backend/controllers/PersonController";
import { ResultsController } from "@backend/controllers/ResultsController";
import { Factory } from "@backend/Factory";
import IREST, { type ClassyRequest } from "@backend/server/IREST";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { AutoTestResult } from "@common/types/AutoTestTypes";
import { CommitTarget } from "@common/types/ContainerTypes";
import {
	AutoTestAuthPayload,
	AutoTestConfigPayload,
	AutoTestConfigTransport,
	AutoTestGradeTransport,
	AutoTestResultPayload,
	AutoTestResultTransport,
	AutoTestStatus,
	ClassyConfigurationPayload,
	Payload,
} from "@common/types/PortalTypes";
import Util from "@common/Util";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fetch, { RequestInit } from "node-fetch";
import { RouteUtil } from "./RouteUtil";

/**
 * Handle the REST interactions initiated by AutoTest
 * to be served by the Classy backend.
 */
export class AutoTestRoutes implements IREST {
	public registerRoutes(server: FastifyInstance): void {
		Log.info("AutoTestRoutes::registerRoutes() - start");

		server.get("/portal/at", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atConfiguration); // deprecates defaultDeliverable endpoint
		server.get("/portal/at/isStaff/:githubId", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atIsStaff);
		server.get("/portal/at/personId/:githubId", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atPersonId);
		server.get("/portal/at/container/:delivId", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atContainerDetails);

		server.post("/portal/at/grade", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atGrade);

		server.post("/portal/at/result", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atPostResult);
		server.get("/portal/at/result/:delivId/:repoId/:sha/:ref", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atGetResult);

		server.post("/portal/at/promotePush", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atShouldPromotePush);

		server.post("/portal/at/feedbackDelay", { preHandler: AutoTestRoutes.isAutoTest }, AutoTestRoutes.atFeedbackDelay);

		// The next three endpoints are not in the right place as they represent
		// requests that do not arise from AutoTest.

		// Receives GitHub webhook events (commit/push events) and forwards them to AutoTest
		server.post("/portal/githubWebhook", AutoTestRoutes.githubWebhook);

		// Receives Grading Image admin events, and forwards them to AutoTest
		server.get("/portal/at/docker/images", AutoTestRoutes.getDockerImages);
		server.delete("/portal/at/docker/image/:tag", AutoTestRoutes.deleteDockerImage);
		server.post("/portal/at/docker/image", AutoTestRoutes.postDockerImage);
	}

	/**
	 * Rejects any request that does not carry the shared AutoTest secret.
	 *
	 * @param req
	 * @param res
	 * @returns {Promise<void>} sends a 400 to stop the chain, or returns to continue
	 */
	public static async isAutoTest(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const providedSecret = req.headers.token;
		if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
			// NOTE: the provided value is deliberately not echoed back or logged; it is
			// caller-supplied and reflecting it just puts noise (or someone else's token) in
			// the logs and the response body.
			AutoTestRoutes.handleError(400, "Invalid AutoTest Secret.", res);
			return;
		}
	}

	public static handleError(code: number, msg: string, res: FastifyReply): void {
		RouteUtil.handleError("AutoTestRoutes", code, msg, res);
	}

	public static async atContainerDetails(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AutoTestRoutes::atContainerDetails(..) - /at/container/:delivId - start GET");
		const start = Date.now();

		const delivId = req.params.delivId;
		const name = Config.getInstance().getProp(ConfigKey.name);

		Log.trace("AutoTestRoutes::atContainerDetails(..) - name: " + name + "; delivId: " + delivId);

		const dc = new DeliverablesController();
		try {
			const deliv = await dc.getDeliverable(delivId);
			if (deliv !== null) {
				const at: AutoTestConfigTransport = {
					dockerImage: deliv.autotest.dockerImage,
					studentDelay: deliv.autotest.studentDelay,
					maxExecTime: deliv.autotest.maxExecTime,
					regressionDelivIds: deliv.autotest.regressionDelivIds,
					custom: deliv.autotest.custom,
					openTimestamp: deliv.openTimestamp,
					closeTimestamp: deliv.closeTimestamp,
					lateAutoTest: deliv.lateAutoTest,
				};
				const payload: AutoTestConfigPayload = { success: at };
				Log.trace("AutoTestRoutes::atContainerDetails(..) - /at/container/:delivId - done; " + "took: " + Util.took(start));
				res.code(200).send(payload);
				return;
			} else {
				// This is more like a warning; if a deliverable is not configured this is going to happen
				return AutoTestRoutes.handleError(400, "Could not retrieve container details for delivId: " + delivId, res);
			}
		} catch {
			// err
			return AutoTestRoutes.handleError(400, "Could not retrieve container details.", res);
		}
	}

	public static async atConfiguration(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AutoTestRoutes::atConfiguration(..) - /at - start");
		const start = Date.now();

		const name = Config.getInstance().getProp(ConfigKey.name);
		Log.trace("AutoTestRoutes::atConfiguration(..) - name: " + name + "; took: " + Util.took(start));

		const cc = new AdminController(new GitHubController(GitHubActions.getInstance()));
		Log.trace("AutoTestRoutes::atConfiguration(..) - cc; took: " + Util.took(start));

		try {
			// NOTE: these two are sequential rather than concurrent because that is what the
			// original .then() chain did; getDeliverables() does not depend on the course, so
			// they could be a Promise.all if this ever shows up as slow.
			const course = await cc.getCourse();
			const defaultDeliverable = course.defaultDeliverableId;
			Log.trace("AutoTestRoutes::atConfiguration(..) - default: " + defaultDeliverable + "; took: " + Util.took(start));

			const deliverables = await cc.getDeliverables();
			const delivIds = [];
			for (const deliv of deliverables) {
				delivIds.push(deliv.id);
			}
			const payload: ClassyConfigurationPayload = { success: { defaultDeliverable: defaultDeliverable, deliverableIds: delivIds } };

			Log.trace("AutoTestRoutes::atConfiguration(..) - /at - done; took: " + Util.took(start));
			res.code(200).send(payload);
		} catch {
			AutoTestRoutes.handleError(400, "Error retrieving backend configuration.", res);
		}
	}

	public static async atGrade(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AutoTestRoutes::atGrade(..) - start");
		const start = Date.now();

		const gradeRecord = req.body as AutoTestGradeTransport;

		try {
			const saved: any = await AutoTestRoutes.performPostGrade(gradeRecord);
			const payload: Payload = { success: { success: saved } };
			Log.trace("AutoTestRoutes::atGrade(..) - done; took: " + Util.took(start));
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AutoTestRoutes.handleError(400, "Failed to receive grade; ERROR: " + err.message, res);
		}
	}

	private static async performPostGrade(grade: AutoTestGradeTransport): Promise<boolean> {
		const gc: GradesController = new GradesController();
		const validGradeRecord = gc.validateAutoTestGrade(grade);
		if (validGradeRecord !== null) {
			throw new Error("Invalid Grade Record: " + validGradeRecord);
		} else {
			Log.info("AutoTestRoutes::performPostGrade(..) - deliv: " + grade.delivId + "; repo: " + grade.repoId + "; grade: " + grade.score);
			// Log.trace("AutoTestRoutes::atGrade(..) - repoId: " + grade.repoId +
			//     "; delivId: " + grade.delivId + "; body: " + JSON.stringify(grade));
			const ac = new AdminController(new GitHubController(GitHubActions.getInstance()));
			return await ac.processNewAutoTestGrade(grade);
		}
	}

	/**
	 * Receives the container result from AutoTest and persists it in the database.
	 * While the AutoTest container could write the DB directly, this assumes that it
	 * is always running on the same host (which we hope to change in the future) and
	 * this also gives us a chance to validate the result record before writing it
	 * which can be especially helpful especially in terms of debugging.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	public static async atPostResult(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AutoTestRoutes::atPostResult(..) - start");
		const start = Date.now();

		const resultRecord = req.body as AutoTestResultTransport;
		// Log.trace("AutoTestRoutes::atPostResult(..) - body: " + JSON.stringify(resultRecord));
		try {
			await AutoTestRoutes.performPostResult(resultRecord);
			const payload: Payload = { success: { message: "Result received" } };
			Log.trace("AutoTestRoutes::atPostResult(..) - done; took: " + Util.took(start));
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AutoTestRoutes.handleError(400, "Error processing result: " + err.message, res);
		}
	}

	private static async performPostResult(result: AutoTestResultTransport): Promise<boolean> {
		const rc = new ResultsController();
		const validResultRecord = rc.validateAutoTestResult(result);
		if (validResultRecord !== null) {
			throw new Error("Invalid Result Record: " + validResultRecord);
		} else {
			Log.info(
				"AutoTestRoutes::performPostResult(..) - valid result && valid secret; deliv: " +
					result.delivId +
					"; repo: " +
					result.repoId +
					"; SHA: " +
					Util.shaHuman(result.commitSHA)
			);
			const dc = new DeliverablesController();
			const deliv = await dc.getDeliverable(result.delivId);
			// if results should only be saved during the marking range, use the first line; otherwise the second
			// if (deliv !== null && result.input.pushInfo.timestamp < deliv.closeTimestamp && deliv.gradesReleased === false) {
			// saving results is always open, but saving grades (in performPostGrades) probably will not be
			// NOTE: this allows AutoTest to request the cached results for later access which will not be possible if saving is prohibited
			if (deliv !== null) {
				const success = await rc.createResult(result);
				Log.info(
					"AutoTestRoutes::performPostResult(..) - done; valid result && valid secret; deliv: " +
						result.delivId +
						"; repo: " +
						result.repoId +
						"; SHA: " +
						Util.shaHuman(result.commitSHA) +
						"; success: " +
						success
				);
				return success;
			} else {
				Log.info(
					"AutoTestRoutes::performPostResult(..) - not accepting new results for deliv: " +
						result.delivId +
						"; result ts: " +
						new Date(result.input.target.timestamp)
				);
				return false;
			}
		}
	}

	/**
	 * Returns whether a githubId is an admin/staff.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	public static async atIsStaff(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AutoTestRoutes::atIsStaff(..) - /isStaff/:githubId - start");
		const start = Date.now();

		let payload: AutoTestAuthPayload;
		const githubId = req.params.githubId;

		// Log.info("AutoTestRoutes::atIsStaff(..) - personId: " + githubId);
		const pc = new PersonController();
		const person = await pc.getGitHubPerson(githubId);
		if (person !== null) {
			const ac = new AuthController();
			const priv = await ac.personPrivileged(person);
			payload = { success: { personId: person.githubId, isStaff: priv.isStaff, isAdmin: priv.isAdmin } };
			Log.trace("AutoTestRoutes::atIsStaff(..) - /isStaff/:githubId - done: " + JSON.stringify(payload) + "; took: " + Util.took(start));
			res.code(200).send(payload);
			return;
		} else {
			payload = { success: { personId: githubId, isStaff: false, isAdmin: false } };
			Log.trace("AutoTestRoutes::atIsStaff(..) - /isStaff/:githubId - unknown person; result: " + JSON.stringify(payload));
			res.code(200).send(payload);
			return;
		}
	}

	public static async atPersonId(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AutoTestRoutes::atPersonId(..) - /isStaff/:githubId - start GET");
		const start = Date.now();

		const githubId = req.params.githubId;

		const pc = new PersonController();
		try {
			const person = await pc.getGitHubPerson(githubId);
			if (person !== null) {
				Log.info("AutoTestRoutes::atPersonId(..) - person: " + person.id + "; github: " + githubId + "; took: " + Util.took(start));
				const payload: Payload = { success: { personId: person.id } }; // PersonTransportPayload
				res.code(200).send(payload);
				return;
			} else {
				return AutoTestRoutes.handleError(404, "Invalid person id: " + githubId, res);
			}
		} catch {
			// err
			return AutoTestRoutes.handleError(404, "Invalid person id: " + githubId, res);
		}
	}

	public static async atGetResult(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AutoTestRoutes::atGetResult(..) - /at/result/:delivId/:repoId/:sha/:ref - start GET");

		let payload: AutoTestResultPayload;
		const delivId = req.params.delivId;
		const repoId = req.params.repoId;
		const sha = req.params.sha;
		let ref = req.params.ref;
		ref = decodeURIComponent(ref);
		if (ref === "<ANY>") {
			// ref not specified
			ref = null;
		}

		Log.trace(
			"AutoTestRoutes::atGetResult(..) - deliv: " + delivId + "; repo: " + repoId + "; SHA: " + Util.shaHuman(sha) + "; ref: " + ref
		);

		const rc = new ResultsController();
		try {
			const result: AutoTestResult = await rc.getResult(delivId, repoId, sha, ref);
			if (result !== null) {
				payload = { success: [result] };
			} else {
				payload = { success: [] };
			}
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AutoTestRoutes.handleError(400, "Error retrieving result record: " + err.message, res);
		}
	}

	public static async atShouldPromotePush(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AutoTestRoutes::atShouldPromotePush(..) - start");
		const start = Date.now();

		try {
			const info = req.body as CommitTarget;
			const courseController = await Factory.getCourseController();
			const shouldPromote = await courseController.shouldPrioritizePushEvent(info);
			Log.info("AutoTestRoutes::atShouldPromotePush(..) - done; shouldPromote: " + shouldPromote + "; took: " + Util.took(start));
			const payload: Payload = { success: { shouldPromote } };
			res.code(200).send(payload);
			return;
		} catch (_err) {
			return AutoTestRoutes.handleError(400, "Failed to find push promotion details", res);
		}
	}

	public static async atFeedbackDelay(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AutoTestRoutes::atFeedbackDelay(..) - start");

		const start = Date.now();

		try {
			const info = req.body as { delivId: string; personId: string; timestamp: number };
			const courseController = await Factory.getCourseController();
			const feedbackDelay = await courseController.requestFeedbackDelay(info);
			if (feedbackDelay === null) {
				// default implementation just says not implemented, although this is not an error
				res.code(204).send({ success: { notImplemented: true } });
				return;
			} else {
				Log.info(
					"AutoTestRoutes::atFeedbackDelay(..) - done; feedbackDelay: " + JSON.stringify(feedbackDelay) + "; took: " + Util.took(start)
				);
				const payload: Payload = { success: { feedbackDelay } };
				res.code(200).send(payload);
				return;
			}
		} catch (_err) {
			return AutoTestRoutes.handleError(400, "Failed to determine feedback eligibility", res);
		}
	}

	/**
	 * This route forwards GitHub webhooks from the public-facing backend
	 * to the AutoTest endpoint (which is internal and protected).
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	public static async githubWebhook(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AutoTestRoutes::githubWebhook(..) - start");
		const start = Date.now();

		try {
			const succ = await AutoTestRoutes.handleWebhook(req);
			Log.info("AutoTestRoutes::githubWebhook(..) - done; took: " + Util.took(start));
			res.code(200).send(succ);
		} catch (err) {
			/* istanbul ignore next: braces needed for ignore (only reachable when deployed) */
			{
				Log.error("AutoTestRoutes::githubWebhook(..) - ERROR: " + err.message + "; took: " + Util.took(start));
				if (err.message && err.message.indexOf("hang up") >= 0) {
					Log.error("AutoTestRoutes::githubWebhook(..) - ERROR: handling hangup; ending response");
					// the client is already gone; take the reply out of Fastify's hands and
					// close the socket rather than trying to send a response nobody will read
					res.hijack();
					res.raw.end();
					return;
				} else {
					return AutoTestRoutes.handleError(400, "Error processing webhook: " + err.message, res);
				}
			}
		}
	}

	/**
	 * Forwards Webhook to AutoTest if it is from a valid host. Returns the processed body
	 * to GitHub, so we can debug the contents in the GitHub webhook view, if needed.
	 *
	 * @param req
	 * @returns {Promise<{}>}
	 */
	private static async handleWebhook(req: ClassyRequest): Promise<{}> {
		Log.trace("AutoTestRoutes::handleWebhook(..) - start");
		const start = Date.now();

		const headers = JSON.stringify(req.headers);
		const config = Config.getInstance();
		const atHost = config.getProp(ConfigKey.autotestUrl);
		const url = atHost + ":" + config.getProp(ConfigKey.autotestPort) + "/githubWebhook";
		const options: RequestInit = {
			method: "POST",
			headers: JSON.parse(headers), // use GitHub headers
			body: JSON.stringify(req.body),
		};
		const res = await fetch(url, options);
		/* istanbul ignore next: braces needed for ignore (not reachable except when deployed) */
		{
			if (res.ok) {
				Log.trace("AutoTestRoutes::handleWebhook(..) - success: " + JSON.stringify(res.ok));
				Log.trace("AutoTestRoutes::handleWebhook(..) - done; took: " + Util.took(start));
				return res.ok;
			} else {
				const err = await res.json();
				const msg = "AutoTestRoutes::handleWebhook(..) - ERROR: " + JSON.stringify(err);
				throw new Error(msg);
			}
		}
	}

	public static async getDockerImages(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AutoTestRoutes::getDockerImages(..) - start");
		try {
			const config = Config.getInstance();

			const githubId = req.headers.user;
			const pc = new PersonController();
			const person = await pc.getGitHubPerson(githubId);
			const privileges = await new AuthController().personPrivileged(person);

			if (typeof githubId === "undefined" || person === null) {
				throw new Error("Valid user parameter not provided");
			}

			if (!privileges.isAdmin) {
				Log.warn("AutoTestRoutes::getDockerImages(..) - AUTHORIZATION FAILURE " + githubId + " is not an admin.");
				return res.code(401).send();
			}

			try {
				const atHost = config.getProp(ConfigKey.autotestUrl);
				const url = atHost + ":" + config.getProp(ConfigKey.autotestPort) + req.url.replace("/portal/at", "");
				const options: RequestInit = {
					method: "GET",
				};

				Log.trace("AutoTestRoutes::getDockerImages(..) - requesting; options: " + JSON.stringify(options));
				const atResponse = await fetch(url, options);
				Log.info("AutoTestRoutes::getDockerImages(..) - done; isOk: " + atResponse.ok);

				if (!atResponse.ok) {
					throw new Error("AutoTestRoutes::getDockerImages(..) - ERROR sending request to AutoTest service;" + " status: " + res.status);
				}

				const body = await atResponse.json();
				res.code(200).send(body);
			} catch (err) {
				Log.error("AutoTestRoutes::getDockerImages(..) - ERROR Sending request to AutoTest service. " + err);
				// TODO: this suggests a backend configuration problem and should be exposed to the user
				res.code(500).send();
			}
		} catch (err) {
			Log.error("AutoTestRoutes::getDockerImages(..) - ERROR " + err);
			res.code(400).send();
		}
	}

	public static async deleteDockerImage(req: ClassyRequest, res: FastifyReply): Promise<void> {
		try {
			const config = Config.getInstance();

			Log.info("AutoTestRoutes::deleteDockerImage(..) - start; tag: " + req.params.tag);
			const githubId = req.headers.user;
			const pc = new PersonController();
			const person = await pc.getGitHubPerson(githubId);
			const privileges = await new AuthController().personPrivileged(person);

			if (typeof githubId === "undefined" || person === null) {
				throw new Error("Valid user parameter not provided");
			}

			if (!privileges.isAdmin) {
				Log.warn("AutoTestRoutes::deleteDockerImage(..) - AUTHORIZATION FAILURE " + githubId + " is not an admin.");
				return res.code(401).send();
			}

			const atHost = config.getProp(ConfigKey.autotestUrl);
			const url = atHost + ":" + config.getProp(ConfigKey.autotestPort) + req.url.replace("/portal/at", "");
			const options: RequestInit = {
				method: "DELETE",
				headers: { token: Config.getInstance().getProp(ConfigKey.autotestSecret) },
			};

			Log.info("AutoTestRoutes::deleteDockerImage(..) - requesting; url: " + url);
			const atResponse = await fetch(url, options);
			Log.info("AutoTestRoutes::deleteDockerImage(..) - done; isOk: " + atResponse.ok);
			const body = await atResponse.json();
			const status = atResponse.status;

			if (!atResponse.ok) {
				Log.warn(
					"AutoTestRoutes::deleteDockerImage(..) - ERROR sending request to AutoTest service; " +
						"status: " +
						status +
						"; body: " +
						JSON.stringify(body)
				);
			} else {
				Log.info(
					"AutoTestRoutes::deleteDockerImage(..) - sending request to AutoTest service worked; " +
						"status: " +
						status +
						"; body: " +
						JSON.stringify(body)
				);
			}

			res.code(status).send(body);
		} catch (err) {
			Log.error("AutoTestRoutes::deleteDockerImage(..) - ERROR " + err);
			res.code(500).send();
		}
	}

	/**
	 * Forwards a Docker image build to AutoTest and streams the build output back to the browser.
	 *
	 * NOTE: this pipes to the raw Node response. Fastify will not let a handler write to the
	 * socket directly, so reply.hijack() is called first to take the reply out of its hands --
	 * after which nothing may call reply.send(). Validation therefore has to happen *before* the
	 * hijack, which is why the authorization checks below all return early.
	 */
	public static async postDockerImage(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AutoTestRoutes::postDockerImage(..) - start");
		try {
			const githubId = req.headers.user as string;
			const pc = new PersonController();
			const person = await pc.getGitHubPerson(githubId);
			const privileges = await new AuthController().personPrivileged(person);

			if (typeof githubId === "undefined" || person === null) {
				throw new Error("Valid user parameter not provided");
			}

			const headers = JSON.stringify(req.headers);
			const options: RequestInit = {
				method: "POST",
				body: JSON.stringify(req.body),
				headers: JSON.parse(headers),
			};

			if (!privileges.isAdmin) {
				Log.warn("AutoTestRoutes::postDockerImage(..) - AUTHORIZATION FAILURE " + githubId + " is not an admin.");
				return res.code(401).send();
			}

			const config = Config.getInstance();
			const atHost = config.getProp(ConfigKey.autotestUrl);
			const url = atHost + ":" + config.getProp(ConfigKey.autotestPort) + "/docker/image";

			// Request native replaced with fetch. See https://github.com/node-fetch/node-fetch#streams
			try {
				Log.info("AutoTestRoutes::postDockerImage(..) - requesting; opts: " + JSON.stringify(options));
				const atResponse = await fetch(url, options);

				// hand the socket over; after this point the reply is ours to write and close
				res.hijack();
				res.raw.writeHead(200, {
					"Content-Type": "application/octet-stream",
					"Access-Control-Allow-Origin": "*",
				});
				atResponse.body.pipe(res.raw);

				try {
					for await (const myChunk of atResponse.body) {
						Log.trace("AutoTestRoutes::postDockerImage(..) - myChunk: " + myChunk.toString());
						// This was a red herring, moving pipe up was enough
						// res.write(myChunk.toString());
					}
					Log.trace("AutoTestRoutes::postDockerImage(..) - closing");
				} catch (err) {
					Log.error("AutoTestRoutes::postDockerImage(..) - myChunk ERROR: " + err);
				}

				Log.info("AutoTestRoutes::postDockerImage(..) - responded code: " + atResponse.status);

				if (!atResponse.ok) {
					throw Error("AutoTestRoutes::postDockerImage(..) - ERROR Forwarding body to AutoTest service, code: " + atResponse.status);
				}
				Log.trace("AutoTestRoutes::postDockerImage(..) - before pipe");
				// atResponse.body.pipe(res);
				Log.trace("AutoTestRoutes::postDockerImage(..) - after pipe");
				// Need this line to keep the connection to the browser
				// alive until the stream has responded
				// res.write(""); // keep alive

				Log.trace("AutoTestRoutes::postDockerImage(..) - after write");
			} catch (err) {
				Log.error("AutoTestRoutes::postDockerImage(..) - ERROR Receiving response from AutoTest service. " + err);
				// if the stream was already hijacked the reply is gone, so end the socket instead
				if (res.raw.headersSent === true) {
					res.raw.end();
					return;
				}
				res.code(500).send();
				return;
			}
		} catch (err) {
			Log.error("AutoTestRoutes::postDockerImage(..) - ERROR " + err);
			if (res.raw.headersSent === true) {
				res.raw.end();
				return;
			}
			res.code(400).send();
		}
	}

	/**
	 * This is not actually a route, but calls the AutoTest backend
	 * to get the current size of all queues. It has the side effect
	 * of making sure the AutoTest server has started running.
	 */
	public static async checkATStatus(): Promise<AutoTestStatus> {
		Log.info("AutoTestRoutes::checkATStatus(..) - start");
		const start = Date.now();

		const config = Config.getInstance();
		const atHost = config.getProp(ConfigKey.autotestUrl);
		const url = atHost + ":" + config.getProp(ConfigKey.autotestPort) + "/status";
		const options: RequestInit = {
			method: "GET",
		};
		const res = await fetch(url, options);
		/* istanbul ignore next: braces needed for ignore (not reachable except when deployed) */
		{
			if (res.ok) {
				Log.trace("AutoTestRoutes::checkATStatus(..) - success: " + JSON.stringify(res.ok));
				Log.trace("AutoTestRoutes::checkATStatus(..) - done; took: " + Util.took(start));
				const result = await res.json();
				Log.info(
					"AutoTestRoutes::checkATStatus(..) - done; # jobs: " +
						result.executing +
						"; # exp: " +
						result.exp +
						"; # std: " +
						result.std +
						"; # low: " +
						result.low
				);
				return result;
			} else {
				const err = await res.json();
				const msg = "AutoTestRoutes::checkATStatus(..) - ERROR: " + JSON.stringify(err);
				Log.error(msg);
				throw new Error(msg);
			}
		}
	}
}
