import { AuthController } from "@backend/controllers/AuthController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { PersonController } from "@backend/controllers/PersonController";
import { Factory } from "@backend/Factory";
import IREST, { type ClassyRequest } from "@backend/server/IREST";
import { Auth } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { AuthTransportPayload, Payload } from "@common/types/PortalTypes";
import ClientOAuth2 from "client-oauth2";
import type { FastifyInstance, FastifyReply } from "fastify";
import fetch, { RequestInit } from "node-fetch";

/**
 * Just a large body of static methods for translating between Fastify and the remainder of the system.
 */
export class AuthRoutes implements IREST {
	private static ac = new AuthController();

	public registerRoutes(server: FastifyInstance): void {
		Log.info("AuthRoutes::registerRoutes() - start");

		// NOTE: CORS preflights used to be handled here by hanging handlePreflight off restify's
		// "MethodNotAllowed" event, which Fastify has no equivalent for. @fastify/cors now answers
		// them; the header values it is configured with in BackendServer are the ones the old
		// handler produced, and AuthRoutesSpec asserts them.

		// user endpoints
		server.get("/portal/getCredentials", AuthRoutes.getCredentials); // verify Classy credentials
		server.get("/portal/logout", AuthRoutes.getLogout);

		// GitHub OAuth endpoints
		server.get("/portal/auth", AuthRoutes.getAuth); // start GitHub OAuth flow
		server.get("/authCallback", AuthRoutes.authCallback); // finalize GitHub OAuth flow
	}

	// NOTE: handlers return Promise<void> rather than the reply. FastifyReply is itself thenable,
	// so returning it out of a promise chain unwraps to Promise<unknown>; sending without
	// returning keeps the signature honest. Fastify ends the request when the promise resolves.
	public static async getLogout(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AuthRouteHandler::getLogout(..) - start");
		let user: string = req.headers.user;
		let token: string = req.headers.token;

		if (typeof user === "undefined") {
			user = null;
		}
		if (typeof token === "undefined") {
			token = null;
		}

		Log.trace("AuthRoutes::getLogout(..) - user: " + user);
		let payload: Payload;

		const handleError = function (msg: string): void {
			Log.warn("AuthRoutes::getLogout(..) - ERROR: " + msg);
			payload = { failure: { message: "Logout failed: " + msg, shouldLogout: false } };
			res.code(400).send(payload);
		};

		if (user === null) {
			// NOTE: this now returns. Previously it fell through to the isValid() chain below and
			// could send a second response; restify tolerated that, Fastify raises
			// FST_ERR_REP_ALREADY_SENT.
			Log.warn("AuthRoutes::getLogout(..) - cannot logout unspecified user: " + user);
			handleError("unknown user.");
			return;
		}

		try {
			const success = await AuthRoutes.performLogout(user, token);
			if (success) {
				Log.info("AuthRoutes::getLogout( " + user + " ) - logged out");
				payload = { success: { message: "Logout successful" } };
				res.code(200).send(payload);
				return;
			}
			handleError("Logout unsuccessful.");
		} catch (err) {
			Log.error("AuthRoutes::getLogout(..) - unexpected ERROR: " + err.message);
			handleError(err.message);
		}
	}

	/**
	 * Validates the credentials and then removes the authentication either way.
	 *
	 * NOTE: extracted from getLogout so the handler has a single, statically-known return type;
	 * the previous inline chain returned a boolean from one .then() and a reply from the next,
	 * which infers as Promise<unknown>. Behaviour is unchanged: the logout happens regardless of
	 * whether the credentials were valid.
	 *
	 * @param user
	 * @param token
	 * @returns {Promise<boolean>} whether the authentication was removed
	 */
	private static async performLogout(user: string, token: string): Promise<boolean> {
		const isValid = await AuthRoutes.ac.isValid(user, token);
		Log.trace("AuthRoutes::performLogout( " + user + " ) - isValid: " + isValid);

		// logout either way
		const ac = new AuthController();
		return ac.removeAuthentication(user);
	}

	public static async getCredentials(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AuthRoutes::getCredentials(..) - start");
		const user = req.headers.user;
		const token = req.headers.token;
		Log.trace("AuthRoutes::getCredentials(..) - user: " + user + "; token: " + token);

		let payload: AuthTransportPayload;
		try {
			const isPrivileged = await AuthRoutes.performGetCredentials(user, token);
			payload = {
				success: {
					personId: user,
					token: token,
					isAdmin: isPrivileged.isAdmin,
					isStaff: isPrivileged.isStaff,
				},
			};
			Log.trace("AuthRoutes::getCredentials(..) - sending 200; isPriv: " + (isPrivileged.isStaff || isPrivileged.isAdmin));
			res.code(200).send(payload);
		} catch (err) {
			Log.warn("AuthRoutes::getCredentials(..) - ERROR: " + err.message);
			payload = { failure: { message: err.message, shouldLogout: false } };
			res.code(400).send(payload);
		}
	}

	public static async performGetCredentials(
		user: string,
		token: string
	): Promise<{
		isAdmin: boolean;
		isStaff: boolean;
	}> {
		const isValid = await AuthRoutes.ac.isValid(user, token);
		Log.trace("AuthRoutes::performGetCredentials( " + user + " ) - in isValid(..)");
		if (isValid === false) {
			Log.trace("AuthRoutes::performGetCredentials( " + user + " ) - isValid false");
			throw new Error("Login error; user: " + user + " not valid.");
		}
		Log.trace("AuthRoutes::performGetCredentials( " + user + " ) - isValid true");

		// if isPrivileged fails, it will throw an exception which will reject this method"s promise
		const isPrivileged = await AuthRoutes.ac.isPrivileged(user, token);
		return { isAdmin: isPrivileged.isAdmin, isStaff: isPrivileged.isStaff };
	}

	/**
	 * Requires manual testing w/ live GitHub instance.
	 */

	/* istanbul ignore next */
	public static getAuth(_req: ClassyRequest, res: FastifyReply): void {
		Log.trace("AuthRoutes::getAuth(..) - /auth redirect start");

		const config = Config.getInstance();
		const setup = {
			clientId: config.getProp(ConfigKey.githubClientId),
			clientSecret: config.getProp(ConfigKey.githubClientSecret),
			accessTokenUri: config.getProp(ConfigKey.githubHost) + "/login/oauth/access_token",
			authorizationUri: config.getProp(ConfigKey.githubHost) + "/login/oauth/authorize",
			scopes: [""],
		};

		const githubAuth = new ClientOAuth2(setup);
		const uri = githubAuth.code.getUri();
		Log.trace("AuthRoutes::getAuth(..) - /auth uri: " + uri + "; setup: " + JSON.stringify(setup));
		res.redirect(uri, 302);
	}

	/**
	 * Handles the GitHub OAuth callback.
	 *
	 * This seems complicated, and is, so you should really think hard over
	 * a weekend before deciding to make any edits to _anything_ in this method.
	 *
	 * Coverage will not happen because of GitHub dependencies.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */

	/* istanbul ignore next */
	public static async authCallback(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AuthRoutes::authCallback(..) - /authCallback - start");

		try {
			const redirectOptions = await AuthRoutes.performAuthCallback(req.url, req.headers.host);

			const cookie = redirectOptions.cookie;
			if (cookie !== null) {
				// this is tricky; need to redirect to the client with a cookie being set on the connection
				res.header("Set-Cookie", cookie);
				Log.trace("AuthRoutes::authCallback(..) - /authCallback - redirect homepage; cookie: " + cookie);
			} else {
				Log.trace("AuthRoutes::authCallback(..) - /authCallback - redirect invalid credentials");
			}

			// NOTE: restify accepted a {hostname, pathname, port} object here and assembled the
			// URL itself (choosing the protocol from whether the request was secure). Fastify
			// takes a string, so that assembly is reproduced explicitly; performAuthCallback
			// has already stripped any protocol from hostname and split the port out.
			const protocol = req.protocol === "https" ? "https" : "http";
			const url = protocol + "://" + redirectOptions.hostname + ":" + redirectOptions.port + "/" + redirectOptions.pathname;
			Log.trace("AuthRoutes::authCallback(..) - /authCallback - redirecting to: " + url);
			res.redirect(url, 302);
		} catch (err) {
			Log.error("AuthRoutes::authCallback(..) - DB; typeof err: " + typeof err + "; err: " + err);
			if (typeof err === "string" && err.indexOf("incorrect or expired") >= 0) {
				// just a warning for auth expiry
				Log.warn("AuthRoutes::authCallback(..) - /authCallback - WARN: " + err);
			} else {
				Log.error("AuthRoutes::authCallback(..) - /authCallback - ERROR: " + err);
			}
			// NOTE: restify's next(false) just ended the chain without a response, which left
			// the request hanging until the client timed out. Fastify requires an explicit
			// reply, so this now closes the request out.
			res.code(400).send("Authentication failed.");
		}
	}

	/* istanbul ignore next */
	private static async performAuthCallback(
		url: string,
		host: string
	): Promise<{
		cookie: string | null;
		hostname: string;
		pathname: string;
		port: number;
	}> {
		Log.trace("AuthRoutes::performAuthCallback(..) - /authCallback - start");
		const config = Config.getInstance();
		const personController = new PersonController();

		// Log.trace("req: " + req + "; res: " + res + "; next: " + next);

		const opts = {
			clientId: config.getProp(ConfigKey.githubClientId),
			clientSecret: config.getProp(ConfigKey.githubClientSecret),
			accessTokenUri: config.getProp(ConfigKey.githubHost) + "/login/oauth/access_token",
			authorizationUri: config.getProp(ConfigKey.githubHost) + "/login/oauth/authorize",
			scopes: [""],
		};

		Log.trace("AuthRoutes::performAuthCallback(..) - /authCallback - setup: " + JSON.stringify(opts));

		const githubAuth = new ClientOAuth2(opts);
		let token: string | null;
		let username: string | null;
		const uri: string = config.getProp(ConfigKey.githubAPI) + "/user";
		const user = await githubAuth.code.getToken(url);

		Log.trace("AuthRoutes::performAuthCallback(..) - token acquired");

		token = user.accessToken;
		const options: RequestInit = {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "Portal",
				Authorization: "token " + token,
			},
			// rejectUnauthorized: false,
			// insecure:           true
		};

		// this extra check is not strictly required, but means we can
		// associate a GitHub username with a token on the backend
		const ans = await fetch(uri, options);

		// we now have a github username
		Log.trace("AuthRoutes::performAuthCallback(..) - /portal/authCallback - GH username received");
		const body = await ans.json();
		username = body.login;
		Log.trace("AuthRoutes::performAuthCallback(..) - /portal/authCallback - GH username: " + username);

		let person = await personController.getGitHubPerson(username);

		// we now know if that github username is known for the course

		if (person === null) {
			Log.warn("AuthRoutes::performAuthCallback(..) - /portal/authCallback - github username not registered: " + username);
			const cc = await Factory.getCourseController();
			person = await cc.handleUnknownUser(username);
		} else {
			Log.trace("AuthRoutes::performAuthCallback(..) - /portal/authCallback - github username IS registered");
			// forces update of user role on login.
			person.kind = null;
			await new PersonController().writePerson(person);
			Log.trace("AuthRoutes::performAuthCallback(..) - person kind reset for " + JSON.stringify(person));
		}

		// now we either have the person in the course or there will never be one
		// if (person === null) {
		//     Log.error("AuthRoutes::performAuthCallback(..) - /portal/authCallback - not registering auth; DOES THIS HAPPEN?");
		//     throw new Error("Person: " + username + " not registered in course.");
		// }

		let feUrl = host; // req.headers.host;
		if (feUrl.indexOf("//") > 0) {
			feUrl = feUrl.substring(feUrl.indexOf("//") + 2, feUrl.length);
		}
		let fePort = 443; // default to ssl port
		if (feUrl.indexOf(":") > 0) {
			fePort = Number(feUrl.substring(feUrl.indexOf(":") + 1, feUrl.length));
			feUrl = feUrl.substring(0, feUrl.indexOf(":"));
		}

		if (person === null) {
			Log.warn(
				"AuthRoutes::performAuthCallback(..) - /authCallback - person (GitHub id: " +
					username +
					" ) not registered for course; redirecting to invalid user screen."
			);
			return {
				cookie: null,
				hostname: feUrl,
				pathname: "invalid.html",
				port: fePort,
			};
		} else {
			Log.trace("AuthRoutes::performAuthCallback(..) - /portal/authCallback - registering auth for person: " + person.githubId);
			const auth: Auth = {
				personId: person.id, // use person.id, not username (aka githubId)
				token: token,
			};

			await DatabaseController.getInstance().writeAuth(auth);
			Log.trace("AuthRoutes::performAuthCallback(..) - preparing redirect for: " + JSON.stringify(person));

			Log.trace("AuthRoutes::performAuthCallback(..) - /authCallback - redirect hostname: " + feUrl + "; fePort: " + fePort);

			// this is tricky; need to redirect to the client with a cookie being set on the connection
			// only header method that worked for me
			const cookie = "token=" + token + "__" + person.id; // Firefox does not like multiple tokens (line above)
			Log.trace("AuthRoutes::performAuthCallback(..) - /authCallback - redirect homepage; cookie: " + cookie);
			return {
				cookie: cookie,
				hostname: feUrl,
				pathname: "index.html",
				port: fePort,
			};
		}
	}
}
