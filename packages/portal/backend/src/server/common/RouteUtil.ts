import { AuthController } from "@backend/controllers/AuthController";
import { PersonController } from "@backend/controllers/PersonController";
import type { ClassyRequest } from "@backend/server/IREST";
import { PersonKind } from "@backend/Types";
import Log from "@common/Log";
import { Payload } from "@common/types/PortalTypes";
import * as cookie from "cookie";
import type { FastifyReply } from "fastify";

/**
 * Helpers shared by the route files.
 */
/**
 * Who a request is from, and who it is about.
 */
export interface ClassyIdentity {
	/**
	 * The authenticated caller. Authorization and audit records use this, always.
	 */
	readonly actedBy: string;

	/**
	 * Whose data this request concerns. The same as actedBy unless an admin is viewing as someone.
	 */
	readonly user: string;

	readonly token: string;

	/**
	 * Null unless view-as is active, in which case it is the person being viewed as (== user).
	 */
	readonly actedAs: string | null;
}

/**
 * A view-as request that is not allowed. Separate from an ordinary failure so the routes can answer
 * 403 rather than the 400 they use for everything else.
 */
export class ViewAsError extends Error {
	public readonly status = 403;

	public constructor(message: string) {
		super(message);
		this.name = "ViewAsError";
	}
}

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
	/**
	 * Who is really making this request.
	 *
	 * NOTE: use this for authorization and for audit records, always. It is deliberately distinct
	 * from the *effective* user (see resolveIdentity): an admin can drive Classy as one of their
	 * students, and the two questions -- "who is acting" and "whose data is this" -- must never be
	 * answered by the same value.
	 */
	public static getAuthenticatedUser(req: ClassyRequest): string {
		const user = RouteUtil.processAuth(req);
		if (typeof user?.user === "string") {
			return user.user;
		}
		return "UNKNOWN";
	}

	/**
	 * The header an admin sets to drive Classy as one of their students.
	 */
	public static readonly VIEW_AS_HEADER = "x-classy-view-as";

	/**
	 * Who this request is authenticated as, and whose data it is about.
	 *
	 * Without the view-as header the two are the same person and this is exactly the old behaviour.
	 * With it, and only for an admin, `user` becomes the target: the student endpoints then answer
	 * with that person's data, which is the whole feature.
	 *
	 * NOTE: the caller's own credentials are what is validated. The target's token is never
	 * involved, never issued to the admin, and never leaves the datastore.
	 *
	 * @param req
	 * @returns {Promise<ClassyIdentity>}
	 * @throws {ViewAsError} if the header is present and the request may not use it
	 */
	public static async resolveIdentity(req: ClassyRequest): Promise<ClassyIdentity> {
		const auth = RouteUtil.processAuth(req);
		const actedBy = typeof auth?.user === "string" ? auth.user : "UNKNOWN";
		const token = typeof auth?.token === "string" ? auth.token : null;

		const viewAs = req.headers[RouteUtil.VIEW_AS_HEADER] as string;
		if (typeof viewAs !== "string" || viewAs === "") {
			return { actedBy: actedBy, user: actedBy, token: token, actedAs: null };
		}

		// from here the request is asking to act as someone else, so every reason it might not be
		// allowed is checked before the target is used for anything
		const privileges = await new AuthController().isPrivileged(actedBy, token);
		if (privileges.isAdmin !== true) {
			// NOTE: staff are refused too. Staff can already read grades through the admin UI, but
			// acting *as* a student is a different power and this feature is admin-only.
			throw new ViewAsError("Only an admin can view Classy as another user.");
		}

		const target = await new PersonController().getPerson(viewAs);
		if (target === null) {
			throw new ViewAsError("Cannot view as unknown user: " + viewAs);
		}

		if (RouteUtil.VIEW_AS_KINDS.indexOf(target.kind) < 0) {
			// admins are excluded: it would grant nothing (privileges inside an impersonated route are
			// the target's, which can only narrow), but it keeps the set of people who can be viewed
			// as smaller than the set who can view
			throw new ViewAsError("Cannot view as " + viewAs + "; only students and staff can be viewed as.");
		}

		Log.info("RouteUtil::resolveIdentity(..) - " + actedBy + " acting as " + target.id + "; " + req.method + " " + req.url);
		return { actedBy: actedBy, user: target.id, token: token, actedAs: target.id };
	}

	/**
	 * Who may be viewed as. Withdrawn students are included: they are still in the student list, and
	 * a withdrawal question is one of the times this is most useful.
	 */
	private static readonly VIEW_AS_KINDS: PersonKind[] = [PersonKind.STUDENT, PersonKind.WITHDRAWN, PersonKind.STAFF];
}
