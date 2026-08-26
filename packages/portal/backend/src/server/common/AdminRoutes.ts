// biome-ignore-all lint/style/noExcessiveLinesPerFile: this file is the admin REST surface and is already over the limit; splitting it is worth doing on its own rather than as a side effect of adding a route

import { AdminController } from "@backend/controllers/AdminController";
import { AuthController } from "@backend/controllers/AuthController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { PersonController } from "@backend/controllers/PersonController";
import { RepositoryController } from "@backend/controllers/RepositoryController";
import { ResultsKind } from "@backend/controllers/ResultsController";
import { TeamController } from "@backend/controllers/TeamController";
import { Factory } from "@backend/Factory";
import { CSVPrairieLearnParser } from "@backend/server/common/CSVPrairieLearnParser";
import IREST, { type ClassyRequest } from "@backend/server/IREST";
import { AuditLabel, GitHubStatus, Person, Repository } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import {
	AutoTestResultSummaryPayload,
	ClasslistChangesTransportPayload,
	CourseTransport,
	CourseTransportPayload,
	DeliverableTransport,
	DeliverableTransportPayload,
	GradeTransportPayload,
	Payload,
	ProvisionTransport,
	RepositoryPayload,
	RepositoryTransport,
	StudentTransportPayload,
	TeamFormationTransport,
	TeamTransport,
	TeamTransportPayload,
} from "@common/types/PortalTypes";
import Util from "@common/Util";
import * as cookie from "cookie";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as http from "http";
import fetch, { RequestInit } from "node-fetch";

import { ClasslistAgent } from "./ClasslistAgent";
import { CSVParser } from "./CSVParser";

export default class AdminRoutes implements IREST {
	private static ghc = new GitHubController(GitHubActions.getInstance());
	private static rc = new RepositoryController();

	public static handleError(code: number, msg: string, res: FastifyReply): void {
		const payload: Payload = { failure: { message: msg, shouldLogout: false } };
		if (code !== 401) {
			Log.error("AdminRoutes::handleError(..) - ERROR: ", msg);
			Log.trace("AdminRoutes::handleError(..) - Payload: ", msg); // only needed when debugging
		} else {
			// common enough it should not be logged as error
			Log.info("AdminRoutes::handleError(..) - ERROR: ", msg);
		}
		res.code(code).send(payload);
		return;
	}

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
					Log.info("AdminRoutes::processAuth(..) - from cookies; user: " + user);
				} else {
					// we are here because user or token are not defined, but we do not have them here either
					Log.info("AdminRoutes::processAuth(..) - cookies parsing failed; tokenString: " + tokenString);
				}
			}
			// only return a valid object if both user and token exist (aka no partial credentials)
			if (typeof user !== "undefined" && typeof token !== "undefined") {
				return { user, token };
			}
		} catch (err) {
			Log.error("AdminRoutes::processAuth(..) - ERROR: " + err.message);
		}
		return null;
	}

	public static async updateClasslist(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::updateClasslist(..) - start");

		const auditUser = req.headers.user;
		try {
			const ca = new ClasslistAgent();
			const data = await ca.fetchClasslist();
			const classlistChanges = await ca.processClasslist(auditUser, null, data);

			if (classlistChanges.classlist.length) {
				const payload: ClasslistChangesTransportPayload = { success: classlistChanges };
				res.code(200).send(payload);
				Log.info(
					"AdminRoutes::updateClasslist(..) - done: " +
						"Classlist upload successful. " +
						classlistChanges.classlist.length +
						" students processed."
				);
			} else {
				const msg = "Classlist upload not successful; no students were processed from classlist service.";
				return AdminRoutes.handleError(400, msg, res);
			}
		} catch (_err) {
			const msg = "Classlist upload not successful; no students were processed from classlist service.";
			return AdminRoutes.handleError(400, msg, res);
		}
	}

	public static async postWithdraw(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::postWithdraw(..) - start");

		// handled by isAdmin in the route chain
		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const msg = await cc.performStudentWithdraw();
			Log.info("AdminRoutes::postWithdraw(..) - done; msg: " + msg);
			const payload: Payload = { success: { message: msg } }; // really should not be an array, but it beats having another type
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.info("AdminRoutes::postWithdraw(..) - ERROR: " + err.message); // intentionally info
			const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
			res.code(400).send(payload);
			return;
		}
	}

	public static async postCheckDatabase(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::postCheckDatabase(..) - start");

		const dryRun = req.params.dryRun === "true";
		Log.info("AdminRoutes::postCheckDatabase(..) - dryRun: " + dryRun + "; true? " + (dryRun === true) + "; false? " + (dryRun === false));

		const cc = new AdminController(AdminRoutes.ghc);
		try {
			await cc.dbSanityCheck(dryRun);
			Log.info("AdminRoutes::postCheckDatabase(..) - done");
			const payload: Payload = { success: { message: "Check complete" } };
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.info("AdminRoutes::postCheckDatabase(..) - ERROR: " + err.message); // intentionally info
			const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
			res.code(400).send(payload);
			return;
		}
	}

	public static async teamCreate(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::teamCreate(..) - start");

		// handled by isAdmin in the route chain
		const userName = AdminRoutes.getUser(req);
		// NOTE: read from the body. These routes declare no path parameters; the values used to
		// arrive via req.params only because restify's bodyParser({ mapParams: true }) folded the
		// body into it. Fastify keeps params and body separate.
		const teamTrans = req.body as TeamFormationTransport;
		try {
			const team = await AdminRoutes.handleTeamCreate(userName, teamTrans);
			Log.info("AdminRoutes::teamCreate(..) - done; team: " + JSON.stringify(team));
			const payload: TeamTransportPayload = { success: [team] }; // really should not be an array, but it beats having another type
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.info("AdminRoutes::teamCreate(..) - ERROR: " + err.message); // intentionally info
			return AdminRoutes.handleError(400, err.message, res);
		}
	}

	/**
	 * Handler that succeeds if the user is privileged (admin || staff).
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	// NOTE: registered as a Fastify preHandler rather than a restify middleware. The await below
	// matters: the previous version started an un-awaited promise chain, which restify happened to
	// tolerate but which under Fastify would let the route handler run before the check resolved.
	// A preHandler that sends a reply stops the chain; one that returns without sending continues.
	private static async isPrivileged(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const auth = AdminRoutes.processAuth(req);
		if (auth === null || typeof auth.user === "undefined" || typeof auth.token === "undefined") {
			Log.warn("AdminRoutes::isPrivileged(..) - undefined user or token; user not admin.");
			AdminRoutes.handleError(401, "Authorization credentials error; user not admin.", res);
			return;
		}

		const user = auth.user;
		const token = auth.token;
		try {
			const priv = await new AuthController().isPrivileged(user, token);
			Log.trace("AdminRoutes::isPrivileged(..) - in isPrivileged: " + JSON.stringify(priv));
			if (priv.isStaff === true || priv.isAdmin === true) {
				Log.trace("AdminRoutes::isPrivileged( " + user + ", ... ) - is priv");
				return; // falls through to the route handler
			}
			Log.info("AdminRoutes::isPrivileged( " + user + ", ... ) - NOT priv");
			AdminRoutes.handleError(401, "Authorization error; user not privileged", res);
		} catch (err) {
			AdminRoutes.handleError(401, "Authorization error; user not privileged. ERROR: " + err.message, res);
		}
	}

	/**
	 * Handler that succeeds if the user is admin.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async isAdmin(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const auth = AdminRoutes.processAuth(req);
		if (auth === null || typeof auth.user === "undefined" || typeof auth.token === "undefined") {
			Log.warn("AdminRoutes::isAdmin(..) - undefined user or token; user not admin.");
			AdminRoutes.handleError(401, "Authorization credentials error; user not admin.", res);
			return;
		}

		const user = auth.user;
		const token = auth.token;
		try {
			const priv = await new AuthController().isPrivileged(user, token);
			Log.trace("AdminRoutes::isAdmin(..) - in isAdmin: " + JSON.stringify(priv));
			if (priv.isAdmin === true) {
				Log.trace("AdminRoutes::isAdmin(..) - isAdmin = true");
				return; // falls through to the route handler
			}
			Log.info("AdminRoutes::isAdmin(..) - isAdmin NOT true");
			AdminRoutes.handleError(401, "Authorization error; user not admin.", res);
		} catch (err) {
			AdminRoutes.handleError(401, "Authorization error; user not admin. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns a StudentTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getStudents(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getStudents(..) - start");
		const start = Date.now();

		const ac = new AdminController(AdminRoutes.ghc);
		try {
			const students = await ac.getStudents();
			Log.info("AdminRoutes::getStudents() - # students: " + students.length + "; took: " + Util.took(start));
			const payload: StudentTransportPayload = { success: students };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve student list. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns a StudentTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getStaff(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getStaff(..) - start");
		const start = Date.now();

		const ac = new AdminController(AdminRoutes.ghc);
		try {
			const staff = await ac.getStaff();
			Log.info("AdminRoutes::getStaff() - # staff: " + staff.length + "; took: " + Util.took(start));
			const payload: StudentTransportPayload = { success: staff };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve staff list. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns a TeamsTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getTeams(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getTeams(..) - start");
		const start = Date.now();

		const cc = new AdminController(AdminRoutes.ghc);
		// handled by preceding action in chain above (see registerRoutes)
		try {
			const teams = await cc.getTeams();
			Log.info("AdminRoutes::getTeams() - # teams: " + teams.length + "; took: " + Util.took(start));
			const payload: TeamTransportPayload = { success: teams };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve team list. ERROR: " + err.message, res);
		}
	}

	private static async getRepositories(_req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getRepositories() - start");
		const start = Date.now();

		const cc = new AdminController(AdminRoutes.ghc);
		// handled by preceding action in chain above (see registerRoutes)
		try {
			const repos = await cc.getRepositories();
			Log.info("AdminRoutes::getRepositories() - # repos: " + repos.length + "; took: " + Util.took(start));
			const payload: RepositoryPayload = { success: repos };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve repository list. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns a AutoTestResultPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getResults(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getResults(..) - start");
		const start = Date.now();

		// if these params are missing the client will get 404 since they are part of the path
		const delivId = req.params.delivId;
		const repoId = req.params.repoId;

		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const results = await cc.getResults(delivId, repoId);
			Log.info("AdminRoutes::getResults( " + delivId + ", " + repoId + " ) - # results: " + results.length + "; took: " + Util.took(start));
			const payload: AutoTestResultSummaryPayload = { success: results };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve results. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns AutoTestResultPayload[]
	 */
	private static async getGradedResults(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getGradedResults(..) - start");
		const start = Date.now();

		const delivId = req.params.delivId;
		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const results = await cc.getDashboard(delivId, "any", Number.MAX_SAFE_INTEGER, ResultsKind.GRADED);
			Log.info("AdminRoutes::getGradedResults(..) - done; # results: " + results.length + "; took: " + Util.took(start));
			const payload: AutoTestResultSummaryPayload = { success: results };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve graded results. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns AutoTestResultPayload[]
	 */
	private static async getBestResults(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getBestResults(..) - start");
		const start = Date.now();

		const delivId = req.params.delivId;
		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const results = await cc.getDashboard(delivId, "any", Number.MAX_SAFE_INTEGER, ResultsKind.BEST);
			Log.info("AdminRoutes::getBestResults(..) - done; # results: " + results.length + "; took: " + Util.took(start));
			const payload: AutoTestResultSummaryPayload = { success: results };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve highest results. ERROR: " + err.message, res);
		}
	}

	/**
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async deleteDeliverable(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::deleteDeliverable(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// NOTE: the actor comes from the auth headers, like every other handler here. This used to
		// read req.params.user, which is never populated: bodyParser({mapParams: true}) maps the
		// body and query into params, not headers, so the audit record recorded an undefined actor.
		const user = AdminRoutes.getUser(req);
		// delivId is part of the path, so a missing one produces a 404 before we get here
		const delivId = req.params.delivId;
		try {
			const success = await AdminRoutes.handleDeleteDeliverable(user, delivId);
			Log.trace("AdminRoutes::deleteDeliverable(..) - done; success: " + success);
			const payload: Payload = { success: { message: "Deliverable deleted." } };
			res.code(200).send(payload); // return as text rather than json
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to delete deliverable. " + err.message, res);
		}
	}

	private static async handleDeleteDeliverable(personId: string, delivId: string): Promise<boolean> {
		const dbc = DatabaseController.getInstance();
		const deliv = await dbc.getDeliverable(delivId);
		if (deliv !== null) {
			const worked = await dbc.deleteDeliverable(deliv);
			if (worked === true) {
				await dbc.writeAudit(AuditLabel.DELIVERABLE, personId, deliv, null, {});
			}
			return worked;
		} else {
			throw new Error("Unknown deliverable: " + delivId);
		}
	}

	/**
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async deleteRepository(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::deleteRepository(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const repoId = req.params.repoId;
		const userId = req.headers.user;
		try {
			const success = await AdminRoutes.handleDeleteRepository(userId, repoId);
			Log.info("AdminRoutes::deleteRepository(..) - done; success: " + success);
			const payload: Payload = { success: { message: "Repository deleted." } };
			res.code(200).send(payload); // return as text rather than json
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to delete repository. " + err.message, res);
		}
	}

	private static async handleDeleteRepository(personId: string, repoId: string): Promise<boolean> {
		const dbc = DatabaseController.getInstance();
		let worked = false;
		const repo = await dbc.getRepository(repoId);
		if (repo !== null) {
			const futureTeamUpdates = repo.teamIds.map(async (teamId) => {
				const team = await dbc.getTeam(teamId);
				const newTeam = { ...team, gitHubStatus: GitHubStatus.PROVISIONED_UNLINKED, custom: { ...team.custom } };
				Log.info("AdminRoutes::handleDeleteRepository(..) - unlinking team from deleted repo: " + JSON.stringify(newTeam));
				await dbc.writeTeam(newTeam);
				await dbc.writeAudit(AuditLabel.TEAM, personId, team, newTeam, {});
			});
			await Promise.all(futureTeamUpdates);
			worked = await dbc.deleteRepository(repo);
			await dbc.writeAudit(AuditLabel.REPOSITORY, personId, repo, null, {});
		} else {
			throw new Error("Unknown repository: " + repoId);
		}

		await GitHubActions.getInstance().deleteRepo(repoId);
		return worked;
	}

	private static getUser(req: ClassyRequest): string {
		const user = AdminRoutes.processAuth(req);
		let userName = "UNKNOWN";
		if (typeof user?.user === "string") {
			userName = user.user;
		}
		// was too complex, but need to make sure this still works before removing
		// if (user === null ||
		//     typeof user !== "undefined" &&
		//     typeof user.user !== "undefined" &&
		//     user.user !== null) {
		//     userName = user.user;
		// }
		return userName;
	}

	/**
	 * Returns a AutoTestResultPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getDashboard(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const start = Date.now();

		// if these params are missing the client will get 404 since they are part of the path
		const delivId = req.params?.delivId;
		const repoId = req.params?.repoId;

		Log.info("AdminRoutes::getDashboard( " + delivId + ", " + repoId + " ) - start");
		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const results = await cc.getDashboard(delivId, repoId);
			Log.info(
				"AdminRoutes::getDashboard( " + delivId + ", " + repoId + " ) - done; # results: " + results.length + "; took: " + Util.took(start)
			);
			const payload: AutoTestResultSummaryPayload = { success: results };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve dashboard. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns a AutoTestResultPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getDashboardAll(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::getDashboardAll(..) - start");

		// if these params are missing the client will get 404 since they are part of the path
		const delivId = req.params.delivId;
		const repoId = req.params.repoId;

		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const results = await cc.getDashboard(delivId, repoId, Number.MAX_SAFE_INTEGER);
			Log.trace("AdminRoutes::getDashboardAll(..) - in then; # results: " + results.length);
			const payload: AutoTestResultSummaryPayload = { success: results };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve dashboard. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns a GradeTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getGrades(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::getGrades(..) - start");
		const start = Date.now();

		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const grades = await cc.getGrades();
			Log.info("AdminRoutes::getGrades(..) - done; # grades: " + grades.length + "; took: " + Util.took(start));
			const payload: GradeTransportPayload = { success: grades };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve team list. ERROR: " + err.message, res);
		}
	}

	/**
	 * Returns a StudentTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getDeliverables(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getDeliverables() - start");
		const start = Date.now();

		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const delivs = await cc.getDeliverables();
			Log.info("AdminRoutes::getDeliverables() - # delivs: " + delivs.length + "; took: " + Util.took(start));
			const payload: DeliverableTransportPayload = { success: delivs };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to get deliverable list; ERROR: " + err.message, res);
		}
	}

	/**
	 * Saves the uploaded file to disk and returns its path.
	 *
	 * NOTE: restify's bodyParser wrote multipart uploads to a temp file and exposed the location
	 * as req.files.<field>.path. @fastify/multipart streams instead, so saveRequestFiles() is used
	 * to get the same on-disk behaviour; that keeps CSVParser and CSVPrairieLearnParser (which
	 * take a path) untouched. Fastify cleans the temp files up when the request completes.
	 *
	 * @param req
	 * @param fieldName the multipart field the client uploaded under (e.g. "classlist")
	 * @returns {Promise<string>} the path of the uploaded file on disk
	 */
	private static async getUploadedFilePath(req: ClassyRequest, fieldName: string): Promise<string> {
		const saved = await req.saveRequestFiles();
		const match = saved.files.find(function (file: any) {
			return file.fieldname === fieldName;
		});
		if (typeof match === "undefined" || match === null) {
			throw new Error("No file uploaded for field: " + fieldName);
		}
		Log.trace("AdminRoutes::getUploadedFilePath( " + fieldName + " ) - path: " + match.filepath);
		return match.filepath;
	}

	private static async postClasslist(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::postClasslist(..) - start");
		// authentication handled by preceding action in chain above (see registerRoutes)

		try {
			const userName = AdminRoutes.getUser(req);
			const path = await AdminRoutes.getUploadedFilePath(req, "classlist");

			// @fastify/multipart deletes the temp file saved by saveRequestFiles() as soon
			// as the handler resolves
			const ca = new ClasslistAgent();
			const classlistChanges = await ca.processClasslist(userName, path, null);
			if (classlistChanges.classlist.length) {
				const payload: ClasslistChangesTransportPayload = { success: classlistChanges };
				res.code(200).send(payload);
				Log.info(
					"AdminRoutes::postClasslist(..) - done: Classlist upload successful. " +
						classlistChanges.classlist.length +
						" students processed."
				);
				return;
			}
			AdminRoutes.handleError(400, "Classlist upload not successful; no students were processed from CSV.", res);
		} catch (err) {
			return AdminRoutes.handleError(400, "Classlist upload unsuccessful. ERROR: " + err.message, res);
		}
	}

	private static async postGrades(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::postGrades(..) - start");

		// authentication handled by preceding action in chain above (see registerRoutes)
		try {
			const delivId = req.params.delivId;
			const path = await AdminRoutes.getUploadedFilePath(req, "gradelist");
			const userName = AdminRoutes.getUser(req);
			const csvParser = new CSVParser();

			const grades = await csvParser.processGrades(userName, delivId, path);
			if (grades.length > 0) {
				const payload: Payload = {
					success: {
						message: "Grades upload successful. " + grades.length + " grades processed.",
					},
				};
				res.code(200).send(payload);
				Log.info("AdminRoutes::postGrades(..) - done: " + payload.success.message);
				return;
			}
			AdminRoutes.handleError(400, "Grades upload not successful; no grades were processed from CSV.", res);
		} catch (err) {
			return AdminRoutes.handleError(400, "Grades upload unsuccessful. ERROR: " + err.message, res);
		}
	}

	private static async postGradesPrairie(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::postGradesPrairie(..) - start");

		// authentication handled by preceding action in chain above (see registerRoutes)
		try {
			const path = await AdminRoutes.getUploadedFilePath(req, "gradelist");
			const userName = AdminRoutes.getUser(req);
			const csvParser = new CSVPrairieLearnParser();

			const grades = await csvParser.processGrades(userName, path);
			if (grades.length > 0) {
				const payload: Payload = {
					success: {
						message: "Grades upload successful. " + grades.length + " grades processed.",
					},
				};
				res.code(200).send(payload);
				Log.info("AdminRoutes::postGradesPrairie(..) - done: " + payload.success.message);
				return;
			}
			AdminRoutes.handleError(400, "Grades upload not successful; no grades were processed from CSV.", res);
		} catch (err) {
			return AdminRoutes.handleError(400, "Grades upload unsuccessful. ERROR: " + err.message, res);
		}
	}

	private static async postDeliverable(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::postDeliverable(..) - start");

		// isValid handled by preceding action in chain above (see registerRoutes)
		const userName = AdminRoutes.getUser(req);
		const delivTrans = req.body as DeliverableTransport;
		Log.info("AdminRoutes::postDeliverable() - body: " + JSON.stringify(delivTrans));
		try {
			const success = await AdminRoutes.handlePostDeliverable(userName, delivTrans);
			Log.info("AdminRoutes::postDeliverable() - done; success: " + success);
			const payload: Payload = { success: { message: "Deliverable saved successfully" } };
			res.code(200).send(payload);
		} catch (err) {
			return AdminRoutes.handleError(400, err.message, res);
		}
	}

	private static async handlePostDeliverable(personId: string, delivTrans: DeliverableTransport): Promise<boolean> {
		const dc = new DeliverablesController();
		const result = dc.validateDeliverableTransport(delivTrans);
		if (result === null) {
			const deliv = DeliverablesController.transportToDeliverable(delivTrans);

			const existingDeliv = await dc.getDeliverable(deliv.id);
			const saveSucceeded = await dc.saveDeliverable(deliv);
			if (saveSucceeded !== null) {
				// worked (would have returned a Deliverable)
				const dbc = DatabaseController.getInstance();
				await dbc.writeAudit(AuditLabel.DELIVERABLE, personId, existingDeliv, deliv, {});
				return true;
			}
		}
		// should never get here unless something went wrong
		throw new Error("Deliverable not saved.");
	}

	/**
	 * Retrieves the course object.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async getCourse(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("AdminRoutes::getCourse() - start");
		const start = Date.now();

		const cc = new AdminController(AdminRoutes.ghc);
		try {
			const course = await cc.getCourse();
			Log.trace("AdminRoutes::getCourse() - done; took: " + Util.took(start));
			const payload: CourseTransportPayload = { success: course };
			res.send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to retrieve course object; ERROR: " + err.message, res);
		}
	}

	private static async postCourse(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::postCourse(..) - start");

		const userName = AdminRoutes.getUser(req);
		// NOTE: read from the body. These routes declare no path parameters; the values used to
		// arrive via req.params only because restify's bodyParser({ mapParams: true }) folded the
		// body into it. Fastify keeps params and body separate.
		const courseTrans = req.body as CourseTransport;
		Log.info("AdminRoutes::postCourse() - body: " + JSON.stringify(courseTrans));
		try {
			const success = await AdminRoutes.handlePostCourse(userName, courseTrans);
			Log.trace("AdminRoutes::postCourse() -handle done; success: " + success);
			const payload: Payload = { success: { message: "Course object saved successfully" } };
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to post course: " + err.message, res);
		}
	}

	private static async handlePostCourse(personId: string, courseTrans: CourseTransport): Promise<boolean> {
		const cc = new AdminController(AdminRoutes.ghc);
		const result = AdminController.validateCourseTransport(courseTrans);
		if (result === null) {
			const existingCourse = await cc.getCourse();
			const saveSucceeded = await cc.saveCourse(courseTrans);
			if (saveSucceeded === true) {
				Log.info("AdminRoutes::handlePostCourse() - done");
				const dbc = DatabaseController.getInstance();
				await dbc.writeAudit(AuditLabel.COURSE, personId, existingCourse, courseTrans, {});
				return true;
			}
		}
		// should never get here unless something goes wrong
		throw new Error("Course object not saved.");
	}

	private static async postProvision(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const delivId = req.params.delivId;
		const repoId = req.params.repoId;

		const userName = AdminRoutes.getUser(req);
		Log.info("AdminRoutes::postProvision(..) - start; delivId: " + delivId + "; repoId: " + repoId);
		// const provisionTrans: ProvisionTransport = req.params;
		// Log.info("AdminRoutes::postProvision() - body: " + provisionTrans);
		try {
			const success = await AdminRoutes.handleProvisionRepo(userName, delivId, [repoId]);
			const payload: Payload = { success: success };
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to provision repo: " + err.message, res);
		}
	}

	/**
	 * Provisions a set of repos in one request, so the server can batch them.
	 *
	 * NOTE: callers should keep batches modest. The proxy in front of this
	 * (packages/proxy/proxy.conf) uses proxy_read_timeout 90, so a request that provisions more
	 * repos than fit in 90s is cut off by nginx even though the server keeps working.
	 */
	private static async postProvisionBatch(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const delivId = req.params.delivId;
		const body = (req.body || {}) as { repoIds?: string[] };
		const repoIds: string[] = Array.isArray(body.repoIds) ? body.repoIds : [];

		const userName = AdminRoutes.getUser(req);
		Log.info("AdminRoutes::postProvisionBatch(..) - start; delivId: " + delivId + "; # repos: " + repoIds.length);

		try {
			const success = await AdminRoutes.handleProvisionRepo(userName, delivId, repoIds);
			const payload: Payload = { success: success };
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to provision repos: " + err.message, res);
		}
	}

	private static async getProvision(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::getProvision(..) - start");

		const delivId = req.params.delivId;
		Log.info("AdminRoutes::getProvision() - delivId: " + delivId);
		try {
			const success = await AdminRoutes.planProvision({ delivId: delivId, formSingle: false });
			const payload: Payload = { success: success };
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to provision repos: " + err.message, res);
		}
	}

	/**
	 * Provisions one or more repos for a deliverable.
	 *
	 * NOTE: the repos are handed to performProvision as a batch so it can provision them with
	 * bounded concurrency (AdminController.PROVISION_CONCURRENCY). Passing them one at a time,
	 * as this used to, made that batching a no-op.
	 *
	 * @param personId the admin performing the operation (for the audit record)
	 * @param delivId
	 * @param repoIds
	 */
	private static async handleProvisionRepo(personId: string, delivId: string, repoIds: string[]): Promise<RepositoryTransport[]> {
		const cc = new AdminController(AdminRoutes.ghc);

		// TODO: if course is SDMM, always fail

		const dc = new DeliverablesController();
		const deliv = await dc.getDeliverable(delivId);
		if (deliv === null || deliv.shouldProvision !== true) {
			throw new Error("AdminRoutes::handleProvisionRepo( " + delivId + " ) - null deliverable");
		}

		if (Array.isArray(repoIds) === false || repoIds.length === 0) {
			throw new Error("AdminRoutes::handleProvisionRepo( " + delivId + " ) - no repositories requested");
		}

		const dbc = DatabaseController.getInstance();
		await dbc.writeAudit(AuditLabel.REPO_PROVISION, personId, {}, {}, { delivId: delivId, repoIds: repoIds });

		const repos: Repository[] = [];
		for (const repoId of repoIds) {
			const repo = await dbc.getRepository(repoId);
			if (repo === null) {
				throw new Error("AdminRoutes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - null repository");
			}
			repos.push(repo);
		}

		Log.info("AdminRoutes::handleProvisionRepo( " + delivId + " ) - provisioning " + repos.length + " repo(s)...");
		const provisioned = await cc.performProvision(repos, deliv.importURL);
		Log.info("AdminRoutes::handleProvisionRepo( " + delivId + " ) - complete; provisioned " + provisioned.length + " of " + repos.length);
		return provisioned;
	}

	private static async planProvision(provisionTrans: ProvisionTransport): Promise<RepositoryTransport[]> {
		// TODO: if course is SDMM, always fail
		const result = AdminController.validateProvisionTransport(provisionTrans);
		if (result === null) {
			const dc = new DeliverablesController();
			const deliv = await dc.getDeliverable(provisionTrans.delivId);
			if (deliv !== null && deliv.shouldProvision === true) {
				const cc = new AdminController(AdminRoutes.ghc);
				const ret = await cc.planProvision(deliv, provisionTrans.formSingle);
				Log.info("AdminRoutes::planProvision() - success; # results: " + ret.length);
				return ret;
			} else {
				throw new Error("Provisioning planning unsuccessful; cannot provision: " + provisionTrans.delivId);
			}
		}
		// should never get here unless something goes wrong
		throw new Error("Provisioning unsuccessful.");
	}

	private static async postRelease(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::postRelease(..) - start");

		const userName = AdminRoutes.getUser(req);
		const repoId = req.params.repoId;

		Log.info("AdminRoutes::postRelease() - repoId: " + repoId);
		try {
			const success = await AdminRoutes.performRelease(userName, repoId);
			const payload: Payload = { success: success };
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.exception(err);
			return AdminRoutes.handleError(400, "Unable to release repos: " + err.message, res);
		}
	}

	private static async getRelease(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::getRelease(..) - start");

		const delivId = req.params.delivId;
		Log.info("AdminRoutes::getRelease() - delivId: " + delivId);
		try {
			const success = await AdminRoutes.planRelease(delivId);
			const payload: Payload = { success: success };
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to plan release: " + err.message, res);
		}
	}

	private static async planRelease(delivId: string): Promise<RepositoryTransport[]> {
		// TODO: if course is SDMM, always fail
		const start = Date.now();

		const dc = new DeliverablesController();
		const deliv = await dc.getDeliverable(delivId);
		if (deliv !== null && deliv.shouldProvision === true) {
			const ac = new AdminController(AdminRoutes.ghc);
			const releasePlan = await ac.planRelease(deliv);
			const transportRepos: RepositoryTransport[] = [];
			for (const repo of releasePlan) {
				transportRepos.push(RepositoryController.repositoryToTransport(repo));
			}
			Log.info("AdminRoutes::planRelease() - success; # results: " + transportRepos.length + "; took: " + Util.took(start));
			return transportRepos;
		} else {
			// should never get here unless something goes wrong
			throw new Error("Release planning unsuccessful.");
		}
	}

	private static async performRelease(personId: string, repoId: string): Promise<RepositoryTransport[]> {
		// TODO: if course is SDMM, always fail
		const start = Date.now();
		const rc = new RepositoryController();

		const repo = await rc.getRepository(repoId);
		Log.info("AdminRoutes::performRelease( " + personId + ", " + repoId + " ) - start");
		if (repo !== null) {
			const dbc = DatabaseController.getInstance();
			await dbc.writeAudit(AuditLabel.REPO_RELEASE, personId, {}, {}, { repoId: repoId });

			const ac = new AdminController(AdminRoutes.ghc);
			const releaseSucceeded = await ac.performRelease([repo]);
			Log.info(
				"AdminRoutes::performRelease() - done; repo: " + repoId + ";  results: " + releaseSucceeded.length + "; took: " + Util.took(start)
			);
			return releaseSucceeded;
		} else {
			Log.error("AdminRoutes::performRelease() - unknown repository: " + repoId);
		}
		// should never get here unless something goes wrong
		throw new Error("Perform release unsuccessful.");
	}

	private static async handleTeamCreate(personId: string, requestedTeam: TeamFormationTransport): Promise<TeamTransport> {
		Log.info("AdminRoutes::handleTeamCreate( .. ) - Team: " + JSON.stringify(requestedTeam));

		const tc = new TeamController();
		const dc = new DeliverablesController();
		const pc = new PersonController();

		const deliv = await dc.getDeliverable(requestedTeam.delivId);
		if (deliv === null) {
			throw new Error("Team not created; Deliverable does not exist: " + requestedTeam.delivId);
		}
		// NOTE: this is not great because it largely duplicates what is in GeneralRoutes::handleTeamCreate

		// remove duplicate names
		const nameIds = requestedTeam.githubIds.filter(function (item, pos, self) {
			return self.indexOf(item) === pos;
		});
		if (nameIds.length !== requestedTeam.githubIds.length) {
			throw new Error("Team not created; duplicate team members specified.");
		}

		// make sure the ids exist
		const people: Person[] = [];
		for (const pId of nameIds) {
			const p = await pc.getGitHubPerson(pId); // students will provide github ids
			if (p !== null) {
				people.push(p);
			} else {
				throw new Error("Team not created; GitHub id not associated with student registered in course: " + pId);
			}
		}

		// make sure all users are not already on teams
		for (const person of people) {
			const teams = await tc.getTeamsForPerson(person);
			for (const aTeam of teams) {
				if (aTeam.delivId === requestedTeam.delivId) {
					throw new Error("User is already on a team for this deliverable ( " + person.id + " is on " + aTeam.id + " ).");
				}
			}
		}

		const cc = await Factory.getCourseController(new GitHubController(GitHubActions.getInstance()));
		const names = await cc.computeNames(deliv, people, true);

		let team = await tc.getTeam(names.teamName);
		if (team !== null) {
			// team created by CustomController::computeNames(..)
		} else {
			team = await tc.formTeam(names.teamName, deliv, people, true);
		}

		const dbc = DatabaseController.getInstance();
		await dbc.writeAudit(AuditLabel.TEAM_ADMIN, personId, null, team, {});

		const teamTrans: TeamTransport = {
			id: team.id,
			delivId: team.delivId,
			people: team.personIds,
			URL: team.URL,
		};

		Log.info("AdminRoutes::handleTeamCreate(..) - team created: " + team.id);
		return teamTrans;
	}

	/**
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async teamDelete(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::teamDelete(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const teamId = req.params.teamId;
		const userName = AdminRoutes.getUser(req);
		try {
			const success = await AdminRoutes.handleTeamDelete(userName, teamId);
			Log.trace("AdminRoutes::teamDelete(..) - done; success: " + success);
			const payload: Payload = {
				success: {
					message: "Team " + teamId + " deleted; object: " + success.deletedObject + "; GitHub: " + success.deletedGithub,
				},
			};
			res.code(200).send(payload);
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to delete team. " + err.message, res);
		}
	}

	private static async handleTeamDelete(
		personId: string,
		teamId: string
	): Promise<{
		deletedObject: boolean;
		deletedGithub: boolean;
	}> {
		Log.info("AdminRoutes::handleTeamDelete( " + teamId + " ) - start");

		let deletedGithub = false;
		const dbc = DatabaseController.getInstance();
		const team = await dbc.getTeam(teamId);
		if (team !== null) {
			// if (team.URL !== null) {
			if (team.gitHubStatus !== GitHubStatus.NOT_PROVISIONED) {
				deletedGithub = await GitHubActions.getInstance().deleteTeam(teamId);
				Log.info("AdminRoutes::handleTeamDelete( " + teamId + " ) - team deleted from GitHub");
			}

			await dbc.deleteTeam(team);
			await dbc.writeAudit(AuditLabel.TEAM, personId, team, null, {});
			Log.info("AdminRoutes::handleTeamDelete( " + teamId + " ) - team deleted from Classy");
		} else {
			throw new Error("Team not deleted; unknown team " + teamId);
		}

		return { deletedObject: true, deletedGithub: deletedGithub };
	}

	/**
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async teamAddMember(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::teamAddMember(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const teamId = req.params.teamId;
		const memberId = req.params.memberId;
		Log.info("AdminRoutes::teamAddMember(..) - team: " + teamId + "; member: " + memberId);

		const userName = AdminRoutes.getUser(req);
		try {
			const success = await AdminRoutes.handleTeamAddMember(userName, teamId, memberId);
			const addedMembers = JSON.stringify(success.people);
			Log.info("AdminRoutes::teamAddMember(..) - done; team: " + teamId + "; members: " + addedMembers);

			const payload: Payload = {
				success: {
					message: "Team " + teamId + " updated; members: " + addedMembers,
				},
			};
			res.code(200).send(payload); // return as text rather than json
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to update team: " + err.message, res);
		}
	}

	private static async handleTeamAddMember(requestorName: string, teamId: string, githubId: string): Promise<TeamTransport> {
		Log.info("AdminRoutes::handleTeamAddMember( t: " + teamId + " u: " + githubId + " ) - start");
		const dbc = DatabaseController.getInstance();
		const pc = new PersonController();

		const person = await pc.getGitHubPerson(githubId);
		if (person === null) {
			throw new Error("Unknown GitHub user " + githubId);
		}

		const team = await dbc.getTeam(teamId);
		if (team === null) {
			throw new Error("Unknown team " + teamId);
		}

		const beforeTeam = new TeamController().teamToTransport(team);

		// make sure user is not already on a team for this deliverable
		const delivId = team.delivId;
		const personTeams = await dbc.getTeamsForPerson(githubId);
		for (const t of personTeams) {
			if (t.delivId === delivId) {
				throw new Error("User " + githubId + " is already on team " + t.id + " for deliverable " + delivId);
			}
		}

		// if (team.URL !== null) {
		if (team.gitHubStatus !== GitHubStatus.NOT_PROVISIONED) {
			await GitHubActions.getInstance().addMembersToTeam(team.id, [githubId]);
			Log.info("AdminRoutes::handleTeamAddMember( t: " + teamId + ", u: " + githubId + " ) - member added to GitHub team");
		}

		// do this after github (if applicable) so if github fails, the db is not updated either
		team.personIds.push(person.id);
		await dbc.writeTeam(team);

		const afterTeam = new TeamController().teamToTransport(team);
		await dbc.writeAudit(AuditLabel.TEAM, requestorName, beforeTeam, afterTeam, {});

		Log.info("AdminRoutes::handleTeamAddMember( t: " + teamId + ", u: " + githubId + " ) - member added to Classy team");
		return afterTeam;
	}

	/**
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static async teamRemoveMember(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("AdminRoutes::teamRemoveMember(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const teamId = req.params.teamId;
		const memberId = req.params.memberId;
		Log.info("AdminRoutes::teamRemoveMember(..) - team: " + teamId + "; member: " + memberId);

		const userName = AdminRoutes.getUser(req);
		try {
			const success = await AdminRoutes.handleTeamRemoveMember(userName, teamId, memberId);
			Log.info("AdminRoutes::teamRemoveMember(..) - done; team: " + teamId + "; member: " + memberId); // + "; success:", success);

			const payload: Payload = {
				success: {
					message: "Team " + teamId + " updated; members: " + JSON.stringify(success.people),
				},
			};

			Log.trace("AdminRoutes::teamRemoveMember(..) - done; sending:", payload);
			res.code(200).send(payload); // return as text rather than json
			return;
		} catch (err) {
			return AdminRoutes.handleError(400, "Unable to update team: " + err.message, res);
		}
	}

	private static async handleTeamRemoveMember(requestorName: string, teamId: string, githubId: string): Promise<TeamTransport> {
		Log.info("AdminRoutes::handleTeamRemoveMember( t: " + teamId + " u: " + githubId + " ) - start");

		const pc = new PersonController();
		const person = await pc.getGitHubPerson(githubId);
		if (person === null) {
			throw new Error("Unknown GitHub user " + githubId);
		}

		const dbc = DatabaseController.getInstance();
		const team = await dbc.getTeam(teamId);
		if (team === null) {
			throw new Error("Unknown team " + teamId);
		}

		// make sure user is already on this team
		if (team.personIds.indexOf(person.id) < 0) {
			throw new Error("User " + githubId + " is not on team " + teamId);
		}

		const beforeTeam = new TeamController().teamToTransport(team);

		// if (team.URL !== null) {
		if (team.gitHubStatus !== GitHubStatus.NOT_PROVISIONED) {
			await GitHubActions.getInstance().removeMembersFromTeam(team.id, [githubId]);
			Log.info("AdminRoutes::handleTeamRemoveMember( t: " + teamId + ", u: " + githubId + " ) - member removed from GitHub team");
		}

		// do this after github (if applicable) so if github fails, the db is not updated either
		team.personIds = team.personIds.filter((e) => e !== person.id);
		await dbc.writeTeam(team);

		const afterTeam = new TeamController().teamToTransport(team);
		await dbc.writeAudit(AuditLabel.TEAM, requestorName, beforeTeam, afterTeam, {});
		Log.info("AdminRoutes::handleTeamRemoveMember( t: " + teamId + ", u: " + githubId + " ) - member removed from Classy team");

		return afterTeam;
	}

	// private static updatePatches(_req: ClassyRequest, res: FastifyReply): void {
	// 	Log.trace("AdminRoutes::updatePatches(..) - start");
	// 	const start = Date.now();
	//
	// 	const url = Config.getInstance().getProp(ConfigKey.patchToolUrl) + "/update";
	// 	const opts: RequestInit = {
	// 		method: "post",
	// 		agent: new http.Agent(),
	// 	};
	// 	fetch(url, opts)
	// 		.then((_result) => {
	// 			Log.info("AdminRoutes::updatePatches(..) - done; took: " + Util.took(start));
	// 			res.send({ success: "patches updated" });
	// 			return;
	// 		})
	// 		.catch((err) => {
	// 			return AdminRoutes.handleError(400, "Unable to update patches. Error: " + err.message, res);
	// 		});
	// }

	// private static listPatches(_req: ClassyRequest, res: FastifyReply): void {
	// 	Log.trace("AdminRoutes::listPatches(..) - start");
	// 	const start = Date.now();
	//
	// 	const url = Config.getInstance().getProp(ConfigKey.patchToolUrl) + "/patches";
	// 	const opts: RequestInit = {
	// 		method: "get",
	// 		agent: new http.Agent(),
	// 	};
	//
	// 	fetch(url, opts)
	// 		.then(async (result) => {
	// 			try {
	// 				const patches = (await result.json()).message;
	// 				Log.info(
	// 					"AdminRoutes::listPatches(..) - done; " +
	// 						patches.length +
	// 						" patch" +
	// 						(patches.length === 1 ? "" : "es") +
	// 						" found; took: " +
	// 						Util.took(start)
	// 				);
	// 				res.send({ success: patches });
	// 				return;
	// 			} catch (err) {
	// 				return AdminRoutes.handleError(400, "Patches not returned in expected format. Error: " + err.message, res);
	// 			}
	// 		})
	// 		.catch((err) => {
	// 			return AdminRoutes.handleError(400, "Unable to get patches. Error: " + err.message, res);
	// 		});
	// }

	// private static patchRepo(req: ClassyRequest, res: FastifyReply): void {
	// 	Log.trace("AdminRoutes::patchRepo(..) - start");
	// 	const start = Date.now();
	// 	const patch: string = req.params.patch;
	// 	const repoId: string = req.params.repo;
	// 	const root: boolean = req.params.root === "true";
	// 	AdminRoutes.rc
	// 		.getRepository(repoId)
	// 		.then((repo: Repository) => {
	// 			return AdminRoutes.ghc.createPullRequest(repo, patch, false, root);
	// 		})
	// 		.then((result: boolean) => {
	// 			if (result) {
	// 				Log.info("AdminRoutes::patchRepo(..) - done; took: " + Util.took(start));
	// 				res.send({ success: repoId });
	// 				return;
	// 			} else {
	// 				return AdminRoutes.handleError(400, "Unable to patch repo.", res);
	// 			}
	// 		})
	// 		.catch((err: any) => {
	// 			return AdminRoutes.handleError(400, "Unable to patch repo. ERROR: " + err.message, res);
	// 		});
	// }

	// private static patchSource(_req: ClassyRequest, res: FastifyReply): void {
	// 	Log.trace("AdminRoutes::patchSource(..) - start");
	// 	const patchSourceRepo: string = Config.getInstance().getProp(ConfigKey.patchSourceRepo);
	// 	if (patchSourceRepo && patchSourceRepo !== "") {
	// 		Log.trace("AdminRoutes::patchSource(..) - Responding with patch source (" + patchSourceRepo + ")");
	// 		res.send({ success: patchSourceRepo });
	// 		return;
	// 	} else {
	// 		Log.info("AdminRoutes::patchSource(..) - patch not found in environment");
	// 		return AdminRoutes.handleError(424, "Patch source repo not found in environment", res);
	// 	}
	// }

	public registerRoutes(server: FastifyInstance): void {
		Log.trace("AdminRoutes::registerRoutes() - start");

		// visible to non-privileged users
		// NOTHING

		// visible to all privileged users
		server.get("/portal/admin/course", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getCourse);
		server.get("/portal/admin/deliverables", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getDeliverables);
		server.get("/portal/admin/students", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getStudents);
		server.get("/portal/admin/staff", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getStaff);
		server.get("/portal/admin/teams", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getTeams);
		server.get("/portal/admin/repositories", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getRepositories);
		server.get("/portal/admin/grades", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getGrades);
		server.get("/portal/admin/dashboard/:delivId/:repoId", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getDashboard); // detailed results
		server.get("/portal/admin/export/dashboard/:delivId/:repoId", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getDashboardAll); // no num limit
		server.get("/portal/admin/results/:delivId/:repoId", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getResults); // result summaries
		server.get("/portal/admin/gradedResults/:delivId", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getGradedResults); // graded results
		server.get("/portal/admin/bestResults/:delivId", { preHandler: AdminRoutes.isPrivileged }, AdminRoutes.getBestResults); // results with best score

		// admin-only functions
		server.post("/portal/admin/classlist", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postClasslist);
		server.put("/portal/admin/classlist", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.updateClasslist);
		server.post("/portal/admin/grades/csv/:delivId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postGrades);
		server.post("/portal/admin/grades/prairie", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postGradesPrairie);
		server.post("/portal/admin/deliverable", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postDeliverable);

		server.post("/portal/admin/course", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postCourse);
		server.get("/portal/admin/provision/:delivId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.getProvision);
		server.post("/portal/admin/provision/:delivId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postProvisionBatch);
		server.post("/portal/admin/provision/:delivId/:repoId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postProvision);
		server.get("/portal/admin/release/:delivId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.getRelease);
		server.post("/portal/admin/release/:repoId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postRelease);
		server.post("/portal/admin/withdraw", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postWithdraw);
		server.post("/portal/admin/checkDatabase/:dryRun", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.postCheckDatabase);
		server.delete("/portal/admin/deliverable/:delivId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.deleteDeliverable);
		server.delete("/portal/admin/repository/:repoId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.deleteRepository);

		// admin team functions
		server.post("/portal/admin/team", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.teamCreate);
		server.post("/portal/admin/team/:teamId/members/:memberId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.teamAddMember);
		server.delete("/portal/admin/team/:teamId/members/:memberId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.teamRemoveMember);
		server.delete("/portal/admin/team/:teamId", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.teamDelete);

		// admin patch routes (no longer supported)
		// server.get("/portal/admin/listPatches", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.listPatches);
		// server.post("/portal/admin/patchRepo/:repo/:patch/:root", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.patchRepo);
		// server.get("/portal/admin/patchSource", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.patchSource);
		// server.post("/portal/admin/updatePatches", { preHandler: AdminRoutes.isAdmin }, AdminRoutes.updatePatches);

		// staff-only functions
		// NOTHING
	}
}
