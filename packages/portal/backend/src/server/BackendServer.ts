/**
 * Created by rtholmes on 2018-02-23.
 */

import { AdminController } from "@backend/controllers/AdminController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { JobController } from "@backend/controllers/JobController";
import { ClasslistAgent } from "@backend/server/common/ClasslistAgent";
import { PrairieLearnAgent } from "@backend/server/common/PrairieLearnAgent";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import { Factory } from "../Factory";
import AdminRoutes from "./common/AdminRoutes";
import { AuthRoutes } from "./common/AuthRoutes";
import { AutoTestRoutes } from "./common/AutoTestRoutes";
import GeneralRoutes from "./common/GeneralRoutes";

/**
 * This configures the REST endpoints for the server.
 *
 * NOTE: this used to be restify. The differences worth knowing about:
 *
 * - Fastify parses JSON bodies and query strings itself, so the queryParser/bodyParser plugins
 *   are gone. Multipart uploads are handled by @fastify/multipart instead (see the upload
 *   handlers in AdminRoutes, which call request.saveRequestFiles()).
 * - Handlers no longer take (and must not call) next(); returning the reply ends the request.
 * - Routes are not live until ready() resolves, so start() awaits it before listen().
 * - CORS and the OPTIONS preflight are handled by @fastify/cors. Restify raised a
 *   "MethodNotAllowed" event for preflights, which Fastify has no equivalent for.
 */
export default class BackendServer {
	private rest: FastifyInstance;
	private config: Config = null;
	private useHttps = false;

	public constructor(useHttps = true) {
		Log.info("BackendServer::<init> - start");
		this.config = Config.getInstance();
		this.useHttps = useHttps;
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
		Log.trace("BackendServer::getServer()");
		return this.rest.server as http.Server;
	}

	/**
	 * Stops the server. Returns a promise so that we know when the connections
	 * have actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<boolean>}
	 */
	public async stop(): Promise<boolean> {
		Log.info("BackendServer::stop() - start");
		if (typeof this.rest === "undefined" || this.rest === null) {
			return true;
		}
		await this.rest.close();
		Log.info("BackendServer::stop() - done");
		return true;
	}

	/**
	 * Starts the server. Returns a promise with a boolean value. Promises are used
	 * here because starting the server takes some time, and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<boolean>}
	 */
	public async start(): Promise<boolean> {
		Log.info("BackendServer::start() - start");

		try {
			const serverOptions: any = {
				// Classy logs through @common/Log; Fastify's own logger just duplicates every request
				logger: false,
			};

			/* istanbul ignore else */
			if (this.useHttps === false) {
				// test only
				Log.warn("BackendServer::start() - disabling HTTPS; should only be used in testing!");
			} else {
				// prod only
				// NOTE: fastify calls this `cert`; restify called the same thing `certificate`
				serverOptions.https = {
					key: fs.readFileSync(this.config.getProp(ConfigKey.sslKeyPath)),
					cert: fs.readFileSync(this.config.getProp(ConfigKey.sslCertPath)),
				};
			}

			// NOTE: cast because serverOptions is built dynamically; with an https key present
			// TypeScript otherwise resolves the Fastify() overload to the HTTP/2 secure server type
			this.rest = Fastify(serverOptions) as unknown as FastifyInstance;

			// CORS, including the OPTIONS preflight.
			//
			// NOTE: this replaces both the hand-rolled crossOrigin hook and AuthRoutes.handlePreflight,
			// which hung off restify's "MethodNotAllowed" event and mutated res.methods -- neither of
			// which Fastify has. The values below are what the frontend actually needs: it sends
			// user/token/org on every call, and the OAuth flow needs credentials allowed. Preflights
			// answer 204 to match the previous behaviour.
			await this.rest.register(fastifyCors, {
				origin: true, // reflect the request origin, as the old handler did
				credentials: true,
				methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
				allowedHeaders: ["Accept", "Accept-Version", "Content-Type", "Api-Version", "user-agent", "user", "token", "org", "name"],
				optionsSuccessStatus: 204,
			});

			// Fastify will not allow a body to be empty {}.
			// This overrides that behaviour, since the UI relies on this a lot. Updating
			// the UI and removing this is left as a future (probably not worth it) task.
			this.rest.addContentTypeParser("application/json", { parseAs: "string" }, (_req: any, body: string, done: any) => {
				if (typeof body !== "string" || body.trim() === "") {
					done(null, {});
					return;
				}
				try {
					done(null, JSON.parse(body));
				} catch (err) {
					err.statusCode = 400; // matches Fastify's own behaviour for malformed JSON
					done(err);
				}
			});

			// multipart uploads (classlist / grade CSVs); handlers call request.saveRequestFiles()
			await this.rest.register(fastifyMultipart);

			this.rest.addHook("onRequest", async (request, reply): Promise<void> => {
				// NOTE: restify's crossOrigin hook set Access-Control-Allow-Origin on *every*
				// response, including requests that carry no Origin header. @fastify/cors only
				// sets it when an Origin is present, so this fills that gap. It is conditional so
				// that it never overwrites the echoed origin a credentialed preflight needs --
				// "*" and credentials are not a legal combination.
				if (typeof request.headers.origin === "undefined") {
					reply.header("Access-Control-Allow-Origin", "*");
				}

				// prevent caching, overrides cache headers in html files
				reply.header("Last-Modified", new Date().toUTCString());
				reply.header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
			});

			// Register background job kinds before anything can start one.
			//
			// This sweep matters. With `restart: always`, a deploy or crash during a long job
			// leaves its record claiming to be RUNNING forever.
			const jc = JobController.getInstance();
			jc.register("prairielearn-sync", async (job, ctx) => {
				return await new PrairieLearnAgent().sync(job.requestedBy, ctx);
			});
			jc.register("classlist-update", async (job, ctx) => {
				return await new ClasslistAgent().updateClasslist(job.requestedBy, ctx);
			});
			jc.register("student-withdraw", async (job, ctx) => {
				const ac = new AdminController(new GitHubController(GitHubActions.getInstance()));
				return { message: await ac.performStudentWithdraw(job.requestedBy, ctx) };
			});
			try {
				const swept = await jc.sweepInterrupted();
				if (swept > 0) {
					Log.warn("BackendServer::start() - jobs interrupted by a previous shutdown: " + swept);
				}
			} catch (err) {
				// a failed sweep must not stop the server from starting
				Log.error("BackendServer::start() - job sweep ERROR: " + err.message);
			}

			// Register handlers common between all classy instances
			Log.info("BackendServer::start() - Registering common handlers");

			// authentication
			new AuthRoutes().registerRoutes(this.rest);

			// autotest
			new AutoTestRoutes().registerRoutes(this.rest);

			// general
			new GeneralRoutes().registerRoutes(this.rest);

			// admin
			new AdminRoutes().registerRoutes(this.rest);

			Log.info("BackendServer::start() - Registering common handlers; done");

			// Register custom route handler for specific classy instance
			Log.info("BackendServer::start() - Registering custom handlers");

			Log.info("BackendServer::start() - Loading custom course controller");
			// We do not need a Custom Course Controller here, but this is a good place
			// to make sure that the CustomCourseController loads up as expected
			// alongside the CustomRouteHandler.
			try {
				await Factory.getCourseController(new GitHubController(GitHubActions.getInstance()));
				Log.info("BackendServer::start() - CustomCourseController loaded");
			} catch (err) {
				Log.error("BackendServer::start() - Unable to load CustomCourseController: " + err);
			}

			Log.info("BackendServer::start() - Loading custom route handler");
			const handler = await Factory.getCustomRouteHandler();
			Log.info("BackendServer::start() - CustomRouteHandler loaded");
			handler.registerRoutes(this.rest);
			Log.info("BackendServer::start() - CustomRouteHandler registered");

			// serve up the static frontend resources
			//
			// NOTE: registered last, as it was under restify. @fastify/static with wildcard:false
			// serves files that exist and otherwise falls through to the notFound handler below,
			// which is what keeps unknown /portal/ paths returning 404 rather than index.html.
			const frontendHTML = path.join(__dirname, "/../../../frontend/html");
			Log.info("BackendServer::start() - Serving static from: " + frontendHTML);
			await this.rest.register(fastifyStatic, {
				root: frontendHTML,
				wildcard: false,
				index: ["index.html"],
			});

			// routes are not registered until this resolves; getServer() would otherwise 404
			await this.rest.ready();

			const port = this.config.getProp(ConfigKey.backendPort);
			await this.rest.listen({ port: port, host: "0.0.0.0" });
			Log.info("BackendServer::start() - fastify listening on port: " + port);

			// after the Classy backend is up, check AutoTest
			// (Docker should load AutoTest first, but the delay should not hurt)
			// NOTE: deliberately not awaited -- start() must resolve so the server is usable
			// whether or not AutoTest happens to be up yet. The callback swallows its own errors,
			// so this never produces an unhandled rejection.
			setTimeout(async () => {
				try {
					await AutoTestRoutes.checkATStatus();
					Log.trace("BackendServer::start() - AT status: success");
				} catch (err) {
					Log.trace("BackendServer::start() - AT status: failure; ERROR: " + err.message);
				}
			}, 500);

			return true;
		} catch (err) {
			Log.error("BackendServer::start() - ERROR: " + err);
			throw err;
		}
	}
}
