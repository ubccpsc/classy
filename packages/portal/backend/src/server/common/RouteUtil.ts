import type { ClassyRequest } from "@backend/server/IREST";
import Log from "@common/Log";
import { Payload } from "@common/types/PortalTypes";
import * as cookie from "cookie";
import type { FastifyReply } from "fastify";

/**
 * Helpers shared by the route files.
 */
export class RouteUtil {
	/**
	 * Sends a failure payload and logs it.
	 *
	 * Each route file keeps a thin handleError of its own that delegates here, so its call sites
	 * and its log prefix are unchanged.
	 *
	 * @param source the calling class, used as the log prefix (e.g. "AdminRoutes")
	 * @param code the HTTP status to send
	 * @param msg the failure message; sent to the caller
	 * @param res
	 * @returns {void}
	 */
	public static handleError(source: string, code: number, msg: string, res: FastifyReply): void {
		const payload: Payload = { failure: { message: msg, shouldLogout: false } };
		if (code === 401 || code < 400) {
			// common enough that it should not be logged as an error
			Log.info(source + "::handleError(..) - code: " + code + "; msg: " + msg);
		} else {
			Log.error(source + "::handleError(..) - code: " + code + "; ERROR: " + msg);
		}
		res.code(code).send(payload);
	}

	/**
	 * Extracts the user and token from a request, falling back to the session cookie.
	 *
	 * @param req
	 * @returns {{user: string, token: string}} null unless _both_ are present
	 */
	public static processAuth(req: ClassyRequest): { user: string; token: string } {
		try {
			let user = req.headers.user;
			let token = req.headers.token;

			// fallback to getting token from cookies
			// this is useful for providing links in for attachments, but also might become the default in the future
			if ((typeof user === "undefined" || typeof token === "undefined") && typeof req.headers.cookie !== "undefined") {
				// the following snippet is a tiny modification based on a snippet in App.validateCredentials()
				// https://github.com/ubccpsc/classy/blob/bbe1d564f21d828101935892103b51453ed7863f/
				// packages/portal/frontend/src/app/App.ts#L200
				const tokenString = cookie.parse(req.headers.cookie).token;
				if (typeof tokenString !== "undefined" && tokenString !== null && typeof tokenString.split !== "undefined") {
					const tokenParts = tokenString.split("__"); // Firefox does not like multiple tokens
					if (tokenParts.length === 1) {
						token = tokenParts[0];
					} else if (tokenParts.length === 2) {
						token = tokenParts[0];
						user = tokenParts[1];
					}
					Log.info("RouteUtil::processAuth(..) - from cookies; user: " + user);
				} else {
					// we are here because user or token are not defined, but we do not have them here either
					Log.info("RouteUtil::processAuth(..) - cookies parsing failed; tokenString: " + tokenString);
				}
			}
			// only return a valid object if both user and token exist (aka no partial credentials)
			if (typeof user !== "undefined" && typeof token !== "undefined") {
				return { user, token };
			}
		} catch (err) {
			Log.error("RouteUtil::processAuth(..) - ERROR: " + err.message);
		}
		return null;
	}

	/**
	 * The requesting user, for audit records.
	 *
	 * @param req
	 * @returns {string} "UNKNOWN" when the request carries no usable credentials
	 */
	public static getUser(req: ClassyRequest): string {
		const user = RouteUtil.processAuth(req);
		if (typeof user?.user === "string") {
			return user.user;
		}
		return "UNKNOWN";
	}
}
