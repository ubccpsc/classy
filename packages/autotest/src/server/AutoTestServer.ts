import Config from "@common/Config";
import Log from "@common/Log";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import * as http from "http";

import AutoTestRouteHandler from "./AutoTestRouteHandler";

/**
 * This configures the endpoints for the AutoTest REST server.
 *
 * NOTE: this used to be restify. Two differences are worth knowing about:
 *
 * - Fastify parses JSON bodies and query strings itself, so the per-route bodyParser/queryParser
 *   plugins restify needed are gone. Anything that is not JSON has to be declared explicitly
 *   (see the octet-stream parser below, which the Docker build endpoint relies on).
 * - Routes are not live until `ready()` resolves. `start()` awaits it, and `getServer()` returns
 *   the underlying Node server, so supertest sees a fully-registered instance.
 */
export default class AutoTestServer {
	private rest: FastifyInstance;
	private port: number;

	public constructor() {
		Config.getInstance(); // for SSL params
	}

	/**
	 * Stops the server. Returns a promise, so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<boolean>}
	 */
	public async stop(): Promise<boolean> {
		Log.info("AutoTestServer::close()");
		if (typeof this.rest === "undefined" || this.rest === null) {
			return true;
		}
		await this.rest.close();
		return true;
	}

	/**
	 * Sets the port on this instance of a server
	 * @returns {void}
	 */
	public setPort(portNum: number): void {
		Log.info("AutoTestServer::setPort()");
		this.port = portNum;
	}

	/**
	 * Starts the server. Returns a promise with a boolean value. Promises are used
	 * here because starting the server takes some time, and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<boolean>}
	 */
	public async start(): Promise<boolean> {
		try {
			Log.info("AutoTestServer::start() - start");

			this.rest = Fastify({
				// Classy logs through @common/Log; a second logger just duplicates every request
				logger: false,
			});

			// support CORS
			this.rest.addHook("onRequest", async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
				reply.header("Access-Control-Allow-Origin", "*");
				reply.header("Access-Control-Allow-Headers", "X-Requested-With");
			});

			// NOTE: the Docker build endpoint is posted to by the portal with a JSON body, but
			// also by clients that do not set a content type. Fastify rejects unknown content
			// types with 415, where restify simply parsed what it was given, so accept both.
			this.rest.addContentTypeParser("application/octet-stream", { parseAs: "string" }, (_req: any, body: string, done: any) => {
				try {
					done(null, body.length > 0 ? JSON.parse(body) : {});
				} catch {
					done(null, {});
				}
			});

			// Return the queue stats (also makes sure the server is running)
			this.rest.get("/status", AutoTestRouteHandler.getAutoTestStatus);

			// GitHub Webhook endpoint
			this.rest.post("/githubWebhook", AutoTestRouteHandler.postGithubHook);

			// AutoTest image creation / listing / removal endpoints
			this.rest.get("/docker/images", AutoTestRouteHandler.getDockerImages);
			this.rest.delete("/docker/image/:tag", AutoTestRouteHandler.removeDockerImage);
			this.rest.post("/docker/image", AutoTestRouteHandler.postDockerImage);

			// routes are not registered until this resolves; getServer() would otherwise 404
			await this.rest.ready();

			await this.rest.listen({ port: this.port, host: "0.0.0.0" });
			Log.info("AutoTestServer::start() - fastify listening on port: " + this.port);
			return true;
		} catch (err) {
			Log.error("AutoTestServer::start() - ERROR: " + err);
			throw err;
		}
	}

	/**
	 * Used in tests.
	 *
	 * NOTE: returns the raw Node server rather than the Fastify instance, because that is what
	 * supertest attaches to. Only valid once start() has resolved.
	 *
	 * @returns {http.Server}
	 */
	public getServer(): http.Server {
		Log.trace("AutoTestServer::getServer()");
		return this.rest.server as http.Server;
	}
}
