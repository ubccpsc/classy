import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { CommitTarget } from "@common/types/ContainerTypes";
import Util from "@common/Util";
import * as crypto from "crypto";
import Docker from "dockerode";
import type { FastifyReply, FastifyRequest } from "fastify";
import * as fs from "fs";
import * as http from "http";
import * as querystring from "querystring";

import { AutoTest } from "../autotest/AutoTest";
import { ClassPortal } from "../autotest/ClassPortal";
import { MongoDataStore } from "../autotest/DataStore";
import { GitHubAutoTest } from "../github/GitHubAutoTest";
import { GitHubUtil } from "../github/GitHubUtil";

declare module "fastify" {
	interface FastifyRequest {
		/**
		 * The unparsed request body, stashed by the content type parsers in AutoTestServer.
		 *
		 * GitHub signs the exact bytes it sends, and those bytes cannot be recovered from the
		 * parsed object, so the webhook signature check needs the original string.
		 */
		rawBody?: string;
	}
}

/**
 * Outcome of the webhook signature check.
 */
export interface WebhookSignatureResult {
	verified: boolean;
	detail: string;
}

export default class AutoTestRouteHandler {
	public static docker: Docker = null;
	public static autoTest: AutoTest = null;

	/**
	 * Whether a webhook whose signature does not verify should be rejected.
	 *
	 * NOTE: false on purpose. verifyWebhookSignature() below is computed and logged for every
	 * delivery, but the result is _not_ enforced yet: if the check is wrong, enforcing it stops
	 * all grading silently.
	 *
	 * Once deployed, make sure the signature check lines are right before removing this guard.
	 */
	private static readonly ENFORCE_WEBHOOK_SIGNATURE: boolean = false;

	public static getDocker(): Docker {
		if (AutoTestRouteHandler.docker === null) {
			// NOTE: constructed even under test. dockerode does not connect here, so this is cheap;
			// the specs that actually build images need a real daemon anyway. Dockerode honours
			// DOCKER_HOST itself (see getDockerRequestOptions for the raw-request equivalent).
			AutoTestRouteHandler.docker = new Docker();
		}

		return AutoTestRouteHandler.docker;
	}

	public static getAutoTest(): AutoTest {
		if (AutoTestRouteHandler.autoTest === null) {
			const dataStore = new MongoDataStore();
			const docker = AutoTestRouteHandler.getDocker();
			const portal: ClassPortal = new ClassPortal();

			AutoTestRouteHandler.autoTest = new GitHubAutoTest(dataStore, portal, docker);
		}
		return AutoTestRouteHandler.autoTest;
	}

	/**
	 * Makes sure the AutoTest server is started
	 */
	public static async getAutoTestStatus(_request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
		try {
			Log.info("AutoTestRouteHandler::getAutoTestStatus(..) - start");

			// should load AutoTest, if it has not been loaded already
			// if it is loading for the first time the queue will tick itself
			const at: GitHubAutoTest = AutoTestRouteHandler.getAutoTest() as GitHubAutoTest;

			// tick the queue again, in case it was not being loaded for the first time
			// feels odd to tick on status, but it might as well be up-to-date
			// and tick is idempotent
			at.tick();

			// get the status
			const status = at.getStatus();

			Log.info("AutoTestRouteHandler::getAutoTestStatus(..) - done");
			return reply.code(200).send(status);
		} catch (err) {
			Log.info("AutoTestRouteHandler::getAutoTestStatus(..) - ERROR: " + err);
			return reply.code(400).send("Failed to check AutoTest: " + err.message);
		}
	}

	/**
	 * Handles GitHub POST events:
	 * - ping
	 * - commit_comment
	 * - push
	 */
	public static async postGithubHook(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
		const start = Date.now();
		// NOTE: restify offered req.header() with case-insensitive lookup; Fastify exposes the
		// raw headers object, which Node has already lower-cased
		const githubEvent: string = request.headers["x-github-event"] as string;

		Log.info("AutoTestRouteHandler::postGithubHook(..) - start; handling event: " + githubEvent);
		const body = request.body;

		const handleError = function (msg: string) {
			Log.error("AutoTestRouteHandler::postGithubHook() - failure; ERROR: " + msg + "; took: " + Util.took(start));
			return reply.code(400).send("Failed to process commit: " + msg);
		};

		const signature = AutoTestRouteHandler.verifyWebhookSignature(request);
		if (signature.verified === true) {
			Log.info("AutoTestRouteHandler::postGithubHook(..) - signature check; verified: true; " + signature.detail);
		} else {
			// warn rather than error
			Log.warn("AutoTestRouteHandler::postGithubHook(..) - signature check; verified: false; " + signature.detail);
		}

		// TODO: once validated that the signatures are right in prod, remove the ENFORCE back channel
		const secretVerified = signature.verified === true || AutoTestRouteHandler.ENFORCE_WEBHOOK_SIGNATURE === false;

		if (secretVerified === true) {
			if (githubEvent === "ping") {
				// github test packet; use to let the webhooks know we are listening
				Log.info("AutoTestRouteHandler::postGithubHook() - <200> pong.");
				return reply.code(200).send("pong");
			}

			// NOTE: awaited rather than left as a floating .then(). Fastify considers the request
			// finished when the handler resolves, so returning before the webhook completes would
			// close the response out from under it.
			Log.trace("AutoTestRouteHandler::postGithubHook() - starting handle");
			try {
				const commitEvent = await AutoTestRouteHandler.handleWebhook(githubEvent, body);
				Log.trace("AutoTestRouteHandler::postGithubHook(..) - done handling event: " + githubEvent);
				if (commitEvent !== null) {
					Log.info("AutoTestRouteHandler::postGithubHook() - handle done; took: " + Util.took(start));
					return reply.code(200).send(commitEvent); // report back our interpretation of the hook
				}
				Log.info("AutoTestRouteHandler::postGithubHook() - handle done (branch deleted); took: " + Util.took(start));
				return reply.code(204).send(); // 204 carries no body
			} catch (err) {
				Log.error("AutoTestRouteHandler::postGithubHook() - ERROR: " + err);
				return handleError(err.message ?? String(err));
			}
		}

		return handleError("Invalid payload signature.");
	}

	/**
	 * Verifies the HMAC signature GitHub attaches to each webhook delivery.
	 *
	 * GitHub signs the exact bytes it sent, so this hashes the untouched payload.
	 *
	 * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
	 *
	 * @param request the inbound webhook request
	 * @returns {WebhookSignatureResult} whether it verified, and why not if it did not
	 */
	private static verifyWebhookSignature(request: FastifyRequest): WebhookSignatureResult {
		// GitHub sends both; sha256 is current, sha1 is the legacy header older GHE still uses
		const sha256Header = request.headers["x-hub-signature-256"] as string;
		const sha1Header = request.headers["x-hub-signature"] as string;
		const headersSeen = "sha256Header: " + (typeof sha256Header === "string") + "; sha1Header: " + (typeof sha1Header === "string");

		const algorithm = typeof sha256Header === "string" ? "sha256" : "sha1";
		const provided = typeof sha256Header === "string" ? sha256Header : sha1Header;
		const rawBody = request.rawBody;

		if (typeof provided !== "string" || provided.length === 0) {
			return { verified: false, detail: "no signature header present; " + headersSeen };
		}

		if (typeof rawBody !== "string" || rawBody.length === 0) {
			// the content type parser did not run, or ran on a body it could not retain
			return { verified: false, detail: "raw body unavailable; " + headersSeen };
		}

		try {
			const atSecret = Config.getInstance().getProp(ConfigKey.autotestSecret);
			if (typeof atSecret !== "string" || atSecret.length === 0) {
				return { verified: false, detail: "autotestSecret is not configured; " + headersSeen };
			}

			const key = crypto.createHash("sha256").update(atSecret, "utf8").digest("hex");
			const keyFingerprint = key.substring(0, 8);

			const computed = algorithm + "=" + crypto.createHmac(algorithm, key).update(rawBody, "utf8").digest("hex");
			const providedBuffer = Buffer.from(provided, "utf8");
			const computedBuffer = Buffer.from(computed, "utf8");
			const verified = providedBuffer.length === computedBuffer.length && crypto.timingSafeEqual(providedBuffer, computedBuffer) === true;

			const detail =
				"algorithm: " +
				algorithm +
				"; rawBodyLen: " +
				rawBody.length +
				"; keyFingerprint: " +
				keyFingerprint +
				"; provided: " +
				AutoTestRouteHandler.signaturePrefix(provided) +
				"; computed: " +
				AutoTestRouteHandler.signaturePrefix(computed);

			return { verified: verified, detail: detail };
		} catch (err) {
			return { verified: false, detail: "ERROR computing HMAC: " + err.message };
		}
	}

	/**
	 * Signatures are logged as a short prefix. That is enough to tell "stably different" from
	 * "different every time" when diagnosing a mismatch, without writing a full MAC to the log.
	 *
	 * @param signature the full `algorithm=hex` signature
	 * @returns {string} the algorithm and the first few digest characters
	 */
	private static signaturePrefix(signature: string): string {
		return signature.substring(0, signature.indexOf("=") + 11) + "...";
	}

	/**
	 * The socket Docker listens on when DOCKER_HOST says nothing.
	 */
	private static readonly DEFAULT_DOCKER_SOCKET = "/var/run/docker.sock";

	/**
	 * Resolves how to reach the Docker daemon, honouring DOCKER_HOST.
	 *
	 * NOTE: AutoTestRouteHandler.docker (dockerode) already does this, because docker-modem reads
	 * DOCKER_HOST itself. The image build below issues a raw http.request instead, so without this
	 * the two talk to different daemons. Hardcoding /var/run/docker.sock only works where Docker
	 * exposes the legacy path: Docker Desktop uses ~/.docker/run/docker.sock unless "Allow the
	 * default Docker socket to be used" is enabled, and Colima and rootless Docker never create it.
	 *
	 * @returns the connection half of an http.request options object
	 */
	private static getDockerRequestOptions(): { socketPath?: string; host?: string; port?: number } {
		const dockerHost = process.env.DOCKER_HOST;

		if (typeof dockerHost === "string" && dockerHost.length > 0) {
			if (dockerHost.indexOf("unix://") === 0) {
				const socketPath = dockerHost.substring("unix://".length);
				return { socketPath: socketPath.length > 0 ? socketPath : AutoTestRouteHandler.DEFAULT_DOCKER_SOCKET };
			}

			const tcp = /(?:tcp:\/\/)?(.*?):([0-9]+)/.exec(dockerHost);
			if (tcp !== null) {
				return { host: tcp[1], port: Number(tcp[2]) };
			}

			Log.warn(
				"AutoTestRouteHandler::getDockerRequestOptions() - unrecognized DOCKER_HOST: " +
					dockerHost +
					"; falling back to " +
					AutoTestRouteHandler.DEFAULT_DOCKER_SOCKET
			);
		}

		// NOTE: unset is correct in production and under docker-compose, where the daemon socket is
		// bind-mounted at the default path -- so this reports whether that path actually exists
		// rather than just complaining. Silent ENOENT from a hardcoded path is what made the
		// AutoTest Docker specs look broken on developer machines.
		const defaultExists = fs.existsSync(AutoTestRouteHandler.DEFAULT_DOCKER_SOCKET);
		if (defaultExists === true) {
			Log.info(
				"AutoTestRouteHandler::getDockerRequestOptions() - DOCKER_HOST not set; using " + AutoTestRouteHandler.DEFAULT_DOCKER_SOCKET
			);
		} else {
			Log.warn(
				"AutoTestRouteHandler::getDockerRequestOptions() - DOCKER_HOST not set and " +
					AutoTestRouteHandler.DEFAULT_DOCKER_SOCKET +
					" does not exist; Docker requests will fail. Set DOCKER_HOST in .env " +
					"(see `docker context ls` for the endpoint this host uses)."
			);
		}

		return { socketPath: AutoTestRouteHandler.DEFAULT_DOCKER_SOCKET };
	}

	public static async getDockerImages(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
		try {
			const docker = AutoTestRouteHandler.getDocker();
			const filtersStr = (request.query as any).filters;
			const options: any = {};
			if (filtersStr) {
				options.filters = JSON.parse(filtersStr);
			}
			Log.info("AutoTestRouteHandler::getDockerImages(..) - start; options: " + JSON.stringify(options));
			const images = await docker.listImages(options);
			Log.trace("AutoTestRouteHandler::getDockerImages(..) - images: " + JSON.stringify(images));
			Log.info("AutoTestRouteHandler::getDockerImages(..) - done; # images: " + (images as any)?.length);
			return reply.code(200).send(images);
		} catch (err) {
			Log.error("AutoTestRouteHandler::getDockerImages(..) - ERROR Retrieving docker images: " + err.message);
			if (err.statusCode) {
				// Error from Docker daemon
				return reply.code(err.statusCode).send(err.message);
			}
			return reply.code(400).send(err.message);
		}
	}

	public static async postDockerImage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
		Log.info("AutoTestRouteHandler::postDockerImage(..) - start");

		AutoTestRouteHandler.getDocker(); // make sure docker is configured

		const body = request.body as any;

		// NOTE: validation happens before the socket is hijacked below. Once hijacked, Fastify is
		// out of the picture and there is no way to send a normal error response.
		if (typeof body?.remote === "undefined") {
			reply.code(400).send("remote parameter missing");
			return;
		}
		if (typeof body?.tag === "undefined") {
			reply.code(400).send("tag parameter missing");
			return;
		}
		if (typeof body?.file === "undefined") {
			reply.code(400).send("file parameter missing");
			return;
		}

		const tag = body.tag;
		const file = body.file;
		let remote;

		if (Config.getInstance().hasProp(ConfigKey.githubDockerToken) === true) {
			// repo protected by the githubDockerToken from .env
			const token = Config.getInstance().getProp(ConfigKey.githubDockerToken);
			remote = token ? body.remote.replace("https://", "https://" + token + "@") : body.remote;
		} else {
			// public repo
			remote = body.remote;
		}

		const dockerOptions = { remote, t: tag, dockerfile: file };
		const reqParams = querystring.stringify(dockerOptions);
		const reqOptions = {
			...AutoTestRouteHandler.getDockerRequestOptions(),
			// v1.40 is the oldest API version modern daemons accept (Docker 29 reports
			// MinAPIVersion 1.40 and rejects anything older outright)
			path: "/v1.40/build?" + reqParams,
			method: "POST",
		};

		Log.info("AutoTestRouteHandler::postDockerImage(..) - building tag: " + tag);

		// NOTE: from here we own the socket. The Docker build emits progress for as long as the
		// build runs, and the client renders it live, so the bytes are piped straight through
		// rather than buffered into a single send. reply.hijack() tells Fastify not to send a
		// response of its own; under restify this was implicit.
		reply.hijack();
		reply.raw.writeHead(200);

		const start = Date.now();
		await new Promise<void>((resolve) => {
			let settled = false;
			const finish = (why: string) => {
				if (settled === true) {
					return;
				}
				settled = true;
				Log.info("AutoTestRouteHandler::postDockerImage(..) - stream done (" + why + "); took: " + Util.took(start));
				resolve();
			};

			const handler = (stream: http.IncomingMessage) => {
				let heartbeat: NodeJS.Timeout = null;
				stream.on("data", (chunk: any) => {
					Log.trace("AutoTestRouteHandler::postDockerImage(..)::stream; chunk:" + chunk.toString());

					clearInterval(heartbeat); // if a timer exists, cancel it
					// start a new timer after every chunk to keep stream open
					heartbeat = setInterval(function () {
						Log.trace("AutoTestRouteHandler::postDockerImage(..)::stream; - sending heartbeat");
						const dur = ((Date.now() - start) / 1000).toFixed(0);
						stream.push('{"stream":"Working... (' + dur + ' seconds elapsed)\\n"}\n'); // send a heartbeat packet
					}, 5000); // time between heartbeats
				});
				stream.on("end", () => {
					Log.info("AutoTestRouteHandler::postDockerImage(..)::stream; end: Stream closed after building: " + tag);
					clearInterval(heartbeat);
					finish("end"); // pipe() ends the response for us
				});
				stream.on("error", (err: any) => {
					Log.error("AutoTestRouteHandler::postDockerImage(..)::stream; Docker Stream ERROR: " + err);
					clearInterval(heartbeat);
					reply.raw.end();
					finish("stream error");
				});
				stream.pipe(reply.raw);
			};

			const dockerReq = http.request(reqOptions, handler);
			dockerReq.on("error", (err: any) => {
				// e.g. the daemon socket does not exist; without this the request would hang
				Log.error("AutoTestRouteHandler::postDockerImage(..) - ERROR contacting Docker: " + err.message);
				reply.raw.end();
				finish("request error");
			});
			dockerReq.end(0);

			// write something to the response to keep it alive until the stream is emitting
			reply.raw.write(""); // NOTE: this is required, if odd
		});
	}

	public static async removeDockerImage(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
		let success = false;
		let errorMsg = "";

		try {
			const docker = AutoTestRouteHandler.getDocker();
			const tag = (request.params as any).tag;
			Log.info("AutoTestRouteHandler::removeDockerImage(..) - start; tag: " + tag);

			if (tag === undefined || tag.length < 1) {
				throw new Error("Docker image tag not provided.");
			}

			const providedSecret = request.headers.token;
			if (Config.getInstance().getProp(ConfigKey.autotestSecret) !== providedSecret) {
				return reply.code(403).send({ success: false, message: "Invalid request (secret mismatch)." });
			} else {
				Log.info("AutoTestRouteHandler::removeDockerImage(..) - valid request; token matched");
			}

			const images = await docker.listImages({ filters: { reference: ["grader"] } });
			Log.info("AutoTestRouteHandler::removeDockerImage(..) - # images: " + images.length);

			let imageDescription: Docker.ImageInfo = null;
			for (const img of images) {
				// Log.trace("AutoTestRouteHandler::removeDockerImage(..) - comparing tag: " + tag + " to image: " + img.Id);
				// tag often has extra details (sha256 etc)
				if (img.Id.indexOf(tag) >= 0) {
					Log.info("AutoTestRouteHandler::removeDockerImage(..) - matched tag: " + tag + " to image: " + img.Id);
					imageDescription = img;
				}
			}

			if (imageDescription !== null) {
				const image = docker.getImage(imageDescription.Id);
				// Log.warn("AutoTestRouteHandler::removeDockerImage(..) - not removed; not implemented"); // for safety, remove when ready
				const removeRes = await image.remove();
				// Log.trace("AutoTestRouteHandler::removeDockerImage(..) - image removal result: " + JSON.stringify(removeRes));
				for (const imgRes of removeRes) {
					if (typeof imgRes.Deleted === "string" && imgRes.Deleted.indexOf(imageDescription.Id) >= 0) {
						Log.info("AutoTestRouteHandler::removeDockerImage(..) - image removed successfully: " + imageDescription.Id);
						success = true;
					}
				}
				if (success) {
					Log.info("AutoTestRouteHandler::removeDockerImage(..) - done; success: " + success);
				} else {
					Log.info("AutoTestRouteHandler::removeDockerImage(..) - done; removal not successful: " + JSON.stringify(removeRes));
				}
			} else {
				Log.warn("AutoTestRouteHandler::removeDockerImage(..) - tag does not map to active image");
				errorMsg = "Docker tag does not map to known image.";
				success = false;
			}
		} catch (err) {
			// NOTE: this seems to happen a lot due to dependent child images in the testing environment
			// it is unclear what happens with these in production
			Log.error("AutoTestRouteHandler::removeDockerImage(..) - ERROR Removing docker image: " + err.message);
			errorMsg = err.message;
		}

		if (success === true) {
			return reply.code(200).send({ success: success });
		}
		return reply.code(400).send({ success: false, message: errorMsg });
	}

	private static async handleWebhook(event: string, body: unknown): Promise<CommitTarget> {
		// cast is unfortunate, but if we are listening to these routes it must be a GitHub AT instance
		const at: GitHubAutoTest = AutoTestRouteHandler.getAutoTest() as GitHubAutoTest;

		switch (event) {
			case "commit_comment":
				const commentEvent = await GitHubUtil.processComment(body);
				if (commentEvent === null) {
					Log.warn("AutoTestRouteHandler::handleWebhook() - comment event is null; figure out why; payload: " + JSON.stringify(body));
				}
				Log.trace("AutoTestRouteHandler::handleWebhook() - comment request: " + JSON.stringify(commentEvent, null, 2));
				await at.handleCommentEvent(commentEvent);
				return commentEvent;
			case "push":
				const pushEvent = await GitHubUtil.processPush(body, new ClassPortal());

				if (pushEvent === null && (body as any)?.deleted === true) {
					// branch was deleted
					Log.info("AutoTestRouteHandler::handleWebhook() - branch was deleted; no action required");
				} else if (pushEvent === null) {
					// figure out other reasons we end up here
					Log.warn("AutoTestRouteHandler::handleWebhook() - push event is null; figure out why; payload: " + JSON.stringify(body));
				}
				Log.trace("AutoTestRouteHandler::handleWebhook() - push request: " + JSON.stringify(pushEvent, null, 2));
				await at.handlePushEvent(pushEvent);
				return pushEvent;
			case "issue_comment":
				const prEvent = await GitHubUtil.processIssueComment(body);
				return prEvent;
			default:
				Log.error("AutoTestRouteHandler::handleWebhook() - Unhandled GitHub event: " + event);
				throw new Error("Unhandled GitHub hook event: " + event);
		}
	}
}
