import * as cookie from "cookie";
import * as http from "http";
import fetch, { RequestInit } from "node-fetch";
import * as restify from "restify";

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

import { AuditLabel, GitHubStatus, Person, Repository } from "@backend/Types";
import { Factory } from "@backend/Factory";

import { AdminController } from "@backend/controllers/AdminController";
import { AuthController } from "@backend/controllers/AuthController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { PersonController } from "@backend/controllers/PersonController";
import { RepositoryController } from "@backend/controllers/RepositoryController";
import { TeamController } from "@backend/controllers/TeamController";
import { ResultsKind } from "@backend/controllers/ResultsController";

import IREST from "@backend/server/IREST";
import { CSVPrairieLearnParser } from "@backend/server/common/CSVPrairieLearnParser";

import { ClasslistAgent } from "./ClasslistAgent";
import { CSVParser } from "./CSVParser";

export default class AdminRoutes implements IREST {
	private static ghc = new GitHubController(GitHubActions.getInstance());
	private static rc = new RepositoryController();

	public static handleError(code: number, msg: string, res: any, next: any) {
		const payload: Payload = { failure: { message: msg, shouldLogout: false } };
		if (code !== 401) {
			Log.error("AdminRoutes::handleError(..) - ERROR: ", msg);
			Log.trace("AdminRoutes::handleError(..) - Payload: ", msg); // only needed when debugging
		} else {
			// common enough it should not be logged as error
			Log.info("AdminRoutes::handleError(..) - ERROR: ", msg);
		}
		res.send(code, payload);
		return next(false);
	}

	public static processAuth(req: any): { user: string; token: string } {
		try {
			let user = req.headers.user;
			let token = req.headers.token;

			// fallback to getting token from cookies
			// this is useful for providing links in for attachments, but also might become the default in the future
			if ((typeof user === "undefined" || typeof token === "undefined") && typeof req.headers.cookie !== "undefined") {
				// the following snippet is a tiny modification based on a snippet in App.validateCredentials()
				// https://github.com/ubccpsc/classy/blob/bbe1d564f21d828101935892103b51453ed7863f/
				// packages/portal/frontend/src/app/App.ts#L200
				const tokenString = cookie.parse(req.headers.cookie)["token"];
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

	public static async updateClasslist(req: any, res: any, next: any) {
		Log.info("AdminRoutes::updateClasslist(..) - start");

		const auditUser = req.headers.user;
		try {
			const ca = new ClasslistAgent();
			const data = await ca.fetchClasslist();
			const classlistChanges = await ca.processClasslist(auditUser, null, data);

			if (classlistChanges.classlist.length) {
				const payload: ClasslistChangesTransportPayload = { success: classlistChanges };
				res.send(200, payload);
				Log.info(
					"AdminRoutes::updateClasslist(..) - done: " +
						"Classlist upload successful. " +
						classlistChanges.classlist.length +
						" students processed."
				);
			} else {
				const msg = "Classlist upload not successful; no students were processed from classlist service.";
				return AdminRoutes.handleError(400, msg, res, next);
			}
		} catch (err) {
			const msg = "Classlist upload not successful; no students were processed from classlist service.";
			return AdminRoutes.handleError(400, msg, res, next);
		}
	}

	public static postWithdraw(req: any, res: any, next: any) {
		Log.info("AdminRoutes::postWithdraw(..) - start");

		// handled by isAdmin in the route chain
		const cc = new AdminController(AdminRoutes.ghc);
		cc.performStudentWithdraw()
			.then(function (msg) {
				Log.info("AdminRoutes::postWithdraw(..) - done; msg: " + msg);
				const payload: Payload = { success: { message: msg } }; // really should not be an array, but it beats having another type
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				Log.info("AdminRoutes::postWithdraw(..) - ERROR: " + err.message); // intentionally info
				const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
				res.send(400, payload);
				return next(false);
			});
	}

	public static postCheckDatabase(req: any, res: any, next: any) {
		Log.info("AdminRoutes::postCheckDatabase(..) - start");

		const dryRun = req.params.dryRun === "true";
		Log.info(
			"AdminRoutes::postCheckDatabase(..) - dryRun: " + dryRun + "; true? " + (dryRun === true) + "; false? " + (dryRun === false)
		);

		const cc = new AdminController(AdminRoutes.ghc);
		cc.dbSanityCheck(dryRun)
			.then(function () {
				Log.info("AdminRoutes::postCheckDatabase(..) - done");
				const payload: Payload = { success: { message: "Check complete" } };
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				Log.info("AdminRoutes::postCheckDatabase(..) - ERROR: " + err.message); // intentionally info
				const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
				res.send(400, payload);
				return next(false);
			});
	}

	public static teamCreate(req: any, res: any, next: any) {
		Log.info("AdminRoutes::teamCreate(..) - start");

		// handled by isAdmin in the route chain
		const userName = AdminRoutes.getUser(req);
		const teamTrans: TeamFormationTransport = req.params;
		AdminRoutes.handleTeamCreate(userName, teamTrans)
			.then(function (team) {
				Log.info("AdminRoutes::teamCreate(..) - done; team: " + JSON.stringify(team));
				const payload: TeamTransportPayload = { success: [team] }; // really should not be an array, but it beats having another type
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				Log.info("AdminRoutes::teamCreate(..) - ERROR: " + err.message); // intentionally info
				return AdminRoutes.handleError(400, err.message, res, next);
			});
	}

	/**
	 * Handler that succeeds if the user is privileged (admin || staff).
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static isPrivileged(req: any, res: any, next: any) {
		const auth = AdminRoutes.processAuth(req);
		if (auth === null || typeof auth.user === "undefined" || typeof auth.token === "undefined") {
			Log.warn("AdminRoutes::isPrivileged(..) - undefined user or token; user not admin.");
			return AdminRoutes.handleError(401, "Authorization credentials error; user not admin.", res, next);
		}

		const user = auth.user;
		const token = auth.token;
		const ac = new AuthController();
		ac.isPrivileged(user, token)
			.then(function (priv) {
				Log.trace("AdminRoutes::isPrivileged(..) - in isPrivileged: " + JSON.stringify(priv));
				if (priv.isStaff === true || priv.isAdmin === true) {
					Log.trace("AdminRoutes::isPrivileged( " + user + ", ... ) - is priv");
					return next();
				} else {
					Log.info("AdminRoutes::isPrivileged( " + user + ", ... ) - NOT priv");
					return AdminRoutes.handleError(401, "Authorization error; user not privileged", res, next);
				}
			})
			.catch(function (err) {
				return AdminRoutes.handleError(401, "Authorization error; user not privileged. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Handler that succeeds if the user is admin.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static isAdmin(req: any, res: any, next: any) {
		const auth = AdminRoutes.processAuth(req);
		if (auth === null || typeof auth.user === "undefined" || typeof auth.token === "undefined") {
			Log.warn("AdminRoutes::isAdmin(..) - undefined user or token; user not admin.");
			return AdminRoutes.handleError(401, "Authorization credentials error; user not admin.", res, next);
		}

		const user = auth.user;
		const token = auth.token;
		const ac = new AuthController();
		ac.isPrivileged(user, token)
			.then(function (priv) {
				Log.trace("AdminRoutes::isAdmin(..) - in isAdmin: " + JSON.stringify(priv));
				if (priv.isAdmin === true) {
					Log.trace("AdminRoutes::isAdmin(..) - isAdmin = true");
					return next();
				} else {
					Log.info("AdminRoutes::isAdmin(..) - isAdmin NOT true");
					return AdminRoutes.handleError(401, "Authorization error; user not admin.", res, next);
				}
			})
			.catch(function (err) {
				return AdminRoutes.handleError(401, "Authorization error; user not admin. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns a StudentTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static getStudents(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getStudents(..) - start");
		const start = Date.now();

		const ac = new AdminController(AdminRoutes.ghc);
		ac.getStudents()
			.then(function (students) {
				Log.info("AdminRoutes::getStudents() - # students: " + students.length + "; took: " + Util.took(start));
				const payload: StudentTransportPayload = { success: students };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve student list. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns a StudentTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static getStaff(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getStaff(..) - start");
		const start = Date.now();

		const ac = new AdminController(AdminRoutes.ghc);
		ac.getStaff()
			.then(function (staff) {
				Log.info("AdminRoutes::getStaff() - # staff: " + staff.length + "; took: " + Util.took(start));
				const payload: StudentTransportPayload = { success: staff };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve staff list. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns a TeamsTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static getTeams(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getTeams(..) - start");
		const start = Date.now();

		const cc = new AdminController(AdminRoutes.ghc);
		// handled by preceding action in chain above (see registerRoutes)
		cc.getTeams()
			.then(function (teams) {
				Log.info("AdminRoutes::getTeams() - # teams: " + teams.length + "; took: " + Util.took(start));
				const payload: TeamTransportPayload = { success: teams };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve team list. ERROR: " + err.message, res, next);
			});
	}

	private static getRepositories(_req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getRepositories() - start");
		const start = Date.now();

		const cc = new AdminController(AdminRoutes.ghc);
		// handled by preceding action in chain above (see registerRoutes)
		cc.getRepositories()
			.then(function (repos) {
				Log.info("AdminRoutes::getRepositories() - # repos: " + repos.length + "; took: " + Util.took(start));
				const payload: RepositoryPayload = { success: repos };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve repository list. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns a AutoTestResultPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static getResults(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getResults(..) - start");
		const start = Date.now();

		// if these params are missing the client will get 404 since they are part of the path
		const delivId = req.params.delivId;
		const repoId = req.params.repoId;

		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		cc.getResults(delivId, repoId)
			.then(function (results) {
				Log.info(
					"AdminRoutes::getResults( " +
						delivId +
						", " +
						repoId +
						" ) - # results: " +
						results.length +
						"; took: " +
						Util.took(start)
				);
				const payload: AutoTestResultSummaryPayload = { success: results };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve results. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns AutoTestResultPayload[]
	 */
	private static getGradedResults(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getGradedResults(..) - start");
		const start = Date.now();

		const delivId = req.params.delivId;
		const cc = new AdminController(AdminRoutes.ghc);
		cc.getDashboard(delivId, "any", Number.MAX_SAFE_INTEGER, ResultsKind.GRADED)
			.then((results) => {
				Log.info("AdminRoutes::getGradedResults(..) - done; # results: " + results.length + "; took: " + Util.took(start));
				const payload: AutoTestResultSummaryPayload = { success: results };
				res.send(payload);
				return next();
			})
			.catch((err) => {
				return AdminRoutes.handleError(400, "Unable to retrieve graded results. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns AutoTestResultPayload[]
	 */
	private static getBestResults(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getBestResults(..) - start");
		const start = Date.now();

		const delivId = req.params.delivId;
		const cc = new AdminController(AdminRoutes.ghc);
		cc.getDashboard(delivId, "any", Number.MAX_SAFE_INTEGER, ResultsKind.BEST)
			.then((results) => {
				Log.info("AdminRoutes::getBestResults(..) - done; # results: " + results.length + "; took: " + Util.took(start));
				const payload: AutoTestResultSummaryPayload = { success: results };
				res.send(payload);
				return next();
			})
			.catch((err) => {
				return AdminRoutes.handleError(400, "Unable to retrieve highest results. ERROR: " + err.message, res, next);
			});
	}

	/**
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static deleteDeliverable(req: any, res: any, next: any) {
		Log.info("AdminRoutes::deleteDeliverable(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const user = req.params.user;
		const delivId = req.params.delivId;
		AdminRoutes.handleDeleteDeliverable(user, delivId)
			.then(function (success) {
				Log.trace("AdminRoutes::deleteDeliverable(..) - done; success: " + success);
				const payload: Payload = { success: { message: "Deliverable deleted." } };
				res.send(200, payload); // return as text rather than json
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to delete deliverable. " + err.message, res, next);
			});
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
	private static deleteRepository(req: any, res: any, next: any) {
		Log.info("AdminRoutes::deleteRepository(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const repoId = req.params.repoId;
		const userId = req.headers.user;
		AdminRoutes.handleDeleteRepository(userId, repoId)
			.then(function (success) {
				Log.trace("AdminRoutes::deleteRepository(..) - done; success: " + success);
				const payload: Payload = { success: { message: "Repository deleted." } };
				res.send(200, payload); // return as text rather than json
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to delete repository. " + err.message, res, next);
			});
	}

	private static async handleDeleteRepository(personId: string, repoId: string): Promise<boolean> {
		const dbc = DatabaseController.getInstance();
		let worked = false;
		const repo = await dbc.getRepository(repoId);
		if (repo !== null) {
			const futureTeamUpdates = repo.teamIds.map(async (teamId) => {
				const team = await dbc.getTeam(teamId);
				const newTeam = { ...team, custom: { ...team.custom, gitHubStatus: GitHubStatus.PROVISIONED_UNLINKED } };
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

	private static getUser(req: any): string {
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
	private static getDashboard(req: any, res: any, next: any) {
		const start = Date.now();

		// if these params are missing the client will get 404 since they are part of the path
		const delivId = req.params?.delivId;
		const repoId = req.params?.repoId;

		Log.info("AdminRoutes::getDashboard( " + delivId + ", " + repoId + " ) - start");
		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		cc.getDashboard(delivId, repoId)
			.then(function (results) {
				Log.info(
					"AdminRoutes::getDashboard( " +
						delivId +
						", " +
						repoId +
						" ) - done; # results: " +
						results.length +
						"; took: " +
						Util.took(start)
				);
				const payload: AutoTestResultSummaryPayload = { success: results };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve dashboard. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns a AutoTestResultPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static getDashboardAll(req: any, res: any, next: any) {
		Log.info("AdminRoutes::getDashboardAll(..) - start");

		// if these params are missing the client will get 404 since they are part of the path
		const delivId = req.params.delivId;
		const repoId = req.params.repoId;

		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		cc.getDashboard(delivId, repoId, Number.MAX_SAFE_INTEGER)
			.then(function (results) {
				Log.trace("AdminRoutes::getDashboardAll(..) - in then; # results: " + results.length);
				const payload: AutoTestResultSummaryPayload = { success: results };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve dashboard. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns a GradeTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static getGrades(req: any, res: any, next: any) {
		Log.info("AdminRoutes::getGrades(..) - start");
		const start = Date.now();

		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		cc.getGrades()
			.then(function (grades) {
				Log.info("AdminRoutes::getGrades(..) - done; # grades: " + grades.length + "; took: " + Util.took(start));
				const payload: GradeTransportPayload = { success: grades };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve team list. ERROR: " + err.message, res, next);
			});
	}

	/**
	 * Returns a StudentTransportPayload.
	 *
	 * @param req
	 * @param res
	 * @param next
	 */
	private static getDeliverables(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getDeliverables() - start");
		const start = Date.now();

		// handled by preceding action in chain above (see registerRoutes)
		const cc = new AdminController(AdminRoutes.ghc);
		cc.getDeliverables()
			.then(function (delivs) {
				Log.info("AdminRoutes::getDeliverables() - # delivs: " + delivs.length + "; took: " + Util.took(start));
				const payload: DeliverableTransportPayload = { success: delivs };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to get deliverable list; ERROR: " + err.message, res, next);
			});
	}

	private static postClasslist(req: any, res: any, next: any) {
		Log.info("AdminRoutes::postClasslist(..) - start");
		// authentication handled by preceding action in chain above (see registerRoutes)

		try {
			const userName = AdminRoutes.getUser(req);
			const path = req.files.classlist.path; // this is brittle, but if it fails it will just trigger the exception

			const ca = new ClasslistAgent();
			ca.processClasslist(userName, path, null)
				.then(function (classlistChanges) {
					if (classlistChanges.classlist.length) {
						const payload: ClasslistChangesTransportPayload = {
							success: classlistChanges,
						};
						res.send(200, payload);
						Log.info(
							"AdminRoutes::postClasslist(..) - done: Classlist upload successful. " +
								classlistChanges.classlist.length +
								" students processed."
						);
					} else {
						const msg = "Classlist upload not successful; no students were processed from CSV.";
						return AdminRoutes.handleError(400, msg, res, next);
					}
				})
				.catch(function (err: Error) {
					return AdminRoutes.handleError(400, "Classlist upload unsuccessful. ERROR: " + err.message, res, next);
				});
		} catch (err) {
			return AdminRoutes.handleError(400, "Classlist upload unsuccessful. ERROR: " + err.message, res, next);
		}
	}

	private static postGrades(req: any, res: any, next: any) {
		Log.info("AdminRoutes::postGrades(..) - start");

		// authentication handled by preceding action in chain above (see registerRoutes)
		try {
			const delivId = req.params.delivId;
			const path = req.files.gradelist.path; // this is brittle, but if it fails it will just trigger the exception

			const userName = AdminRoutes.getUser(req);
			const csvParser = new CSVParser();
			csvParser
				.processGrades(userName, delivId, path)
				.then(function (grades) {
					if (grades.length > 0) {
						const payload: Payload = {
							success: {
								message: "Grades upload successful. " + grades.length + " grades processed.",
							},
						};
						res.send(200, payload);
						Log.info("AdminRoutes::postGrades(..) - done: " + payload.success.message);
					} else {
						const msg = "Grades upload not successful; no grades were processed from CSV.";
						return AdminRoutes.handleError(400, msg, res, next);
					}
				})
				.catch(function (err: Error) {
					return AdminRoutes.handleError(400, "Grades upload unsuccessful. ERROR: " + err.message, res, next);
				});
		} catch (err) {
			return AdminRoutes.handleError(400, "Grades upload unsuccessful. ERROR: " + err.message, res, next);
		}
	}

	private static postGradesPrairie(req: any, res: any, next: any) {
		Log.info("AdminRoutes::postGradesPrairie(..) - start");

		// authentication handled by preceding action in chain above (see registerRoutes)
		try {
			const path = req.files.gradelist.path; // this is brittle, but if it fails it will just trigger the exception
			const userName = AdminRoutes.getUser(req);
			const csvParser = new CSVPrairieLearnParser();
			csvParser
				.processGrades(userName, path)
				.then(function (grades) {
					if (grades.length > 0) {
						const payload: Payload = {
							success: {
								message: "Grades upload successful. " + grades.length + " grades processed.",
							},
						};
						res.send(200, payload);
						Log.info("AdminRoutes::postGradesPrairie(..) - done: " + payload.success.message);
					} else {
						const msg = "Grades upload not successful; no grades were processed from CSV.";
						return AdminRoutes.handleError(400, msg, res, next);
					}
				})
				.catch(function (err: Error) {
					return AdminRoutes.handleError(400, "Grades upload unsuccessful. ERROR: " + err.message, res, next);
				});
		} catch (err) {
			return AdminRoutes.handleError(400, "Grades upload unsuccessful. ERROR: " + err.message, res, next);
		}
	}

	private static postDeliverable(req: any, res: any, next: any) {
		Log.info("AdminRoutes::postDeliverable(..) - start");

		// isValid handled by preceding action in chain above (see registerRoutes)
		const userName = AdminRoutes.getUser(req);
		const delivTrans: DeliverableTransport = req.params;
		Log.info("AdminRoutes::postDeliverable() - body: " + delivTrans);
		AdminRoutes.handlePostDeliverable(userName, delivTrans)
			.then(function (success) {
				Log.info("AdminRoutes::postDeliverable() - done; success: " + success);
				const payload: Payload = { success: { message: "Deliverable saved successfully" } };
				res.send(200, payload);
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, err.message, res, next);
			});
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
	private static getCourse(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::getCourse() - start");
		const start = Date.now();

		const cc = new AdminController(AdminRoutes.ghc);
		cc.getCourse()
			.then(function (course) {
				Log.trace("AdminRoutes::getCourse() - done; took: " + Util.took(start));
				const payload: CourseTransportPayload = { success: course };
				res.send(payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to retrieve course object; ERROR: " + err.message, res, next);
			});
	}

	private static postCourse(req: any, res: any, next: any) {
		Log.info("AdminRoutes::postCourse(..) - start");

		const userName = AdminRoutes.getUser(req);
		const courseTrans: CourseTransport = req.params;
		Log.info("AdminRoutes::postCourse() - body: " + courseTrans);
		AdminRoutes.handlePostCourse(userName, courseTrans)
			.then(function (success) {
				Log.trace("AdminRoutes::postCourse() -handle done; success: " + success);
				const payload: Payload = { success: { message: "Course object saved successfully" } };
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to post course: " + err.message, res, next);
			});
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

	private static postProvision(req: any, res: any, next: any) {
		const delivId = req.params.delivId;
		const repoId = req.params.repoId;

		const userName = AdminRoutes.getUser(req);
		Log.info("AdminRoutes::postProvision(..) - start; delivId: " + delivId + "; repoId: " + repoId);
		// const provisionTrans: ProvisionTransport = req.params;
		// Log.info("AdminRoutes::postProvision() - body: " + provisionTrans);
		AdminRoutes.handleProvisionRepo(userName, delivId, repoId)
			.then(function (success) {
				const payload: Payload = { success: success };
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to provision repo: " + err.message, res, next);
			});
	}

	private static getProvision(req: any, res: any, next: any) {
		Log.info("AdminRoutes::getProvision(..) - start");

		const delivId = req.params.delivId;
		Log.info("AdminRoutes::getProvision() - delivId: " + delivId);
		AdminRoutes.planProvision({ delivId: delivId, formSingle: false })
			.then(function (success) {
				const payload: Payload = { success: success };
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to provision repos: " + err.message, res, next);
			});
	}

	private static async handleProvisionRepo(personId: string, delivId: string, repoId: string): Promise<RepositoryTransport[]> {
		const cc = new AdminController(AdminRoutes.ghc);

		// TODO: if course is SDMM, always fail

		const dc = new DeliverablesController();
		const deliv = await dc.getDeliverable(delivId);
		if (deliv !== null && deliv.shouldProvision === true) {
			const dbc = DatabaseController.getInstance();
			await dbc.writeAudit(AuditLabel.REPO_PROVISION, personId, {}, {}, { delivId: delivId, repoId: repoId });

			const repo = await dbc.getRepository(repoId);
			if (repo !== null) {
				Log.info("AdminRoutes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - provisioning...");
				await cc.performProvision([repo], deliv.importURL);
				Log.info("AdminRoutes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - provisioning complete.");
				return [RepositoryController.repositoryToTransport(repo)];
			} else {
				throw new Error("AdminRoutes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - null repository");
			}
		} else {
			throw new Error("AdminRoutes::handleProvisionRepo( " + delivId + ", " + repoId + " ) - null deliverable");
		}
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

	private static postRelease(req: any, res: any, next: any) {
		Log.info("AdminRoutes::postRelease(..) - start");

		const userName = AdminRoutes.getUser(req);
		const repoId = req.params.repoId;

		Log.info("AdminRoutes::postRelease() - repoId: " + repoId);
		AdminRoutes.performRelease(userName, repoId)
			.then(function (success) {
				const payload: Payload = { success: success };
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				Log.exception(err);
				return AdminRoutes.handleError(400, "Unable to release repos: " + err.message, res, next);
			});
	}

	private static getRelease(req: any, res: any, next: any) {
		Log.info("AdminRoutes::getRelease(..) - start");

		const delivId = req.params.delivId;
		Log.info("AdminRoutes::getRelease() - delivId: " + delivId);
		AdminRoutes.planRelease(delivId)
			.then(function (success) {
				const payload: Payload = { success: success };
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to plan release: " + err.message, res, next);
			});
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
				"AdminRoutes::performRelease() - done; repo: " +
					repoId +
					";  results: " +
					releaseSucceeded.length +
					"; took: " +
					Util.took(start)
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
	private static teamDelete(req: any, res: any, next: any) {
		Log.info("AdminRoutes::teamDelete(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const teamId = req.params.teamId;
		const userName = AdminRoutes.getUser(req);
		AdminRoutes.handleTeamDelete(userName, teamId)
			.then(function (success) {
				Log.trace("AdminRoutes::teamDelete(..) - done; success: " + success);
				const payload: Payload = {
					success: {
						message: "Team " + teamId + " deleted; object: " + success.deletedObject + "; GitHub: " + success.deletedGithub,
					},
				};
				res.send(200, payload);
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to delete team. " + err.message, res, next);
			});
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
			if (team.URL !== null) {
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
	private static teamAddMember(req: any, res: any, next: any) {
		Log.info("AdminRoutes::teamAddMember(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const teamId = req.params.teamId;
		const memberId = req.params.memberId;
		Log.info("AdminRoutes::teamAddMember(..) - team: " + teamId + "; member: " + memberId);

		const userName = AdminRoutes.getUser(req);
		AdminRoutes.handleTeamAddMember(userName, teamId, memberId)
			.then(function (success) {
				const addedMembers = JSON.stringify(success.people);
				Log.info("AdminRoutes::teamAddMember(..) - done; team: " + teamId + "; members: " + addedMembers);

				const payload: Payload = {
					success: {
						message: "Team " + teamId + " updated; members: " + addedMembers,
					},
				};
				res.send(200, payload); // return as text rather than json
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to update team: " + err.message, res, next);
			});
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

		if (team.URL !== null) {
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
	private static teamRemoveMember(req: any, res: any, next: any) {
		Log.info("AdminRoutes::teamRemoveMember(..) - start");
		// isAdmin pre-handler verifies that only valid users can do this

		// if these params are missing the client will get 404 since they are part of the path
		const teamId = req.params.teamId;
		const memberId = req.params.memberId;
		Log.info("AdminRoutes::teamRemoveMember(..) - team: " + teamId + "; member: " + memberId);

		const userName = AdminRoutes.getUser(req);
		AdminRoutes.handleTeamRemoveMember(userName, teamId, memberId)
			.then(function (success) {
				Log.info("AdminRoutes::teamRemoveMember(..) - done; team: " + teamId + "; member: " + memberId); // + "; success:", success);

				const payload: Payload = {
					success: {
						message: "Team " + teamId + " updated; members: " + JSON.stringify(success.people),
					},
				};

				Log.trace("AdminRoutes::teamRemoveMember(..) - done; sending:", payload);
				res.send(200, payload); // return as text rather than json
				return next();
			})
			.catch(function (err) {
				return AdminRoutes.handleError(400, "Unable to update team: " + err.message, res, next);
			});
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

		if (team.URL !== null) {
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

	private static updatePatches(_req: any, res: any, next: any) {
		Log.trace("AdminRoutes::updatePatches(..) - start");
		const start = Date.now();

		const url = Config.getInstance().getProp(ConfigKey.patchToolUrl) + "/update";
		const opts: RequestInit = {
			method: "post",
			agent: new http.Agent(),
		};
		fetch(url, opts)
			.then((_result) => {
				Log.info("AdminRoutes::updatePatches(..) - done; took: " + Util.took(start));
				res.send({ success: "patches updated" });
				return next();
			})
			.catch((err) => {
				return AdminRoutes.handleError(400, "Unable to update patches. Error: " + err.message, res, next);
			});
	}

	private static listPatches(_req: any, res: any, next: any) {
		Log.trace("AdminRoutes::listPatches(..) - start");
		const start = Date.now();

		const url = Config.getInstance().getProp(ConfigKey.patchToolUrl) + "/patches";
		const opts: RequestInit = {
			method: "get",
			agent: new http.Agent(),
		};

		fetch(url, opts)
			.then(async (result) => {
				try {
					const patches = (await result.json()).message;
					Log.info(
						"AdminRoutes::listPatches(..) - done; " +
							patches.length +
							" patch" +
							(patches.length === 1 ? "" : "es") +
							" found; took: " +
							Util.took(start)
					);
					res.send({ success: patches });
					return next();
				} catch (err) {
					return AdminRoutes.handleError(400, "Patches not returned in expected format. Error: " + err.message, res, next);
				}
			})
			.catch((err) => {
				return AdminRoutes.handleError(400, "Unable to get patches. Error: " + err.message, res, next);
			});
	}

	private static patchRepo(req: any, res: any, next: any) {
		Log.trace("AdminRoutes::patchRepo(..) - start");
		const start = Date.now();
		const patch: string = req.params.patch;
		const repoId: string = req.params.repo;
		const root: boolean = req.params.root === "true";
		AdminRoutes.rc
			.getRepository(repoId)
			.then((repo: Repository) => {
				return AdminRoutes.ghc.createPullRequest(repo, patch, false, root);
			})
			.then((result: boolean) => {
				if (result) {
					Log.info("AdminRoutes::patchRepo(..) - done; took: " + Util.took(start));
					res.send({ success: repoId });
					return next();
				} else {
					return AdminRoutes.handleError(400, "Unable to patch repo.", res, next);
				}
			})
			.catch((err: any) => {
				return AdminRoutes.handleError(400, "Unable to patch repo. ERROR: " + err.message, res, next);
			});
	}

	private static patchSource(_req: any, res: any, next: any) {
		Log.trace("AdminRoutes::patchSource(..) - start");
		const patchSourceRepo: string = Config.getInstance().getProp(ConfigKey.patchSourceRepo);
		if (patchSourceRepo && patchSourceRepo !== "") {
			Log.trace("AdminRoutes::patchSource(..) - Responding with patch source (" + patchSourceRepo + ")");
			res.send({ success: patchSourceRepo });
			return next();
		} else {
			Log.info("AdminRoutes::patchSource(..) - patch not found in environment");
			return AdminRoutes.handleError(424, "Patch source repo not found in environment", res, next);
		}
	}

	public registerRoutes(server: restify.Server) {
		Log.trace("AdminRoutes::registerRoutes() - start");

		// visible to non-privileged users
		// NOTHING

		// visible to all privileged users
		server.get("/portal/admin/course", AdminRoutes.isPrivileged, AdminRoutes.getCourse);
		server.get("/portal/admin/deliverables", AdminRoutes.isPrivileged, AdminRoutes.getDeliverables);
		server.get("/portal/admin/students", AdminRoutes.isPrivileged, AdminRoutes.getStudents);
		server.get("/portal/admin/staff", AdminRoutes.isPrivileged, AdminRoutes.getStaff);
		server.get("/portal/admin/teams", AdminRoutes.isPrivileged, AdminRoutes.getTeams);
		server.get("/portal/admin/repositories", AdminRoutes.isPrivileged, AdminRoutes.getRepositories);
		server.get("/portal/admin/grades", AdminRoutes.isPrivileged, AdminRoutes.getGrades);
		server.get("/portal/admin/dashboard/:delivId/:repoId", AdminRoutes.isPrivileged, AdminRoutes.getDashboard); // detailed results
		server.get("/portal/admin/export/dashboard/:delivId/:repoId", AdminRoutes.isPrivileged, AdminRoutes.getDashboardAll); // no num limit
		server.get("/portal/admin/results/:delivId/:repoId", AdminRoutes.isPrivileged, AdminRoutes.getResults); // result summaries
		server.get("/portal/admin/gradedResults/:delivId", AdminRoutes.isPrivileged, AdminRoutes.getGradedResults); // graded results
		server.get("/portal/admin/bestResults/:delivId", AdminRoutes.isPrivileged, AdminRoutes.getBestResults); // results with best score

		// admin-only functions
		server.post("/portal/admin/classlist", AdminRoutes.isAdmin, AdminRoutes.postClasslist);
		server.put("/portal/admin/classlist", AdminRoutes.isAdmin, AdminRoutes.updateClasslist);
		server.post("/portal/admin/grades/csv/:delivId", AdminRoutes.isAdmin, AdminRoutes.postGrades);
		server.post("/portal/admin/grades/prairie", AdminRoutes.isAdmin, AdminRoutes.postGradesPrairie);
		server.post("/portal/admin/deliverable", AdminRoutes.isAdmin, AdminRoutes.postDeliverable);

		server.post("/portal/admin/course", AdminRoutes.isAdmin, AdminRoutes.postCourse);
		server.get("/portal/admin/provision/:delivId", AdminRoutes.isAdmin, AdminRoutes.getProvision);
		server.post("/portal/admin/provision/:delivId/:repoId", AdminRoutes.isAdmin, AdminRoutes.postProvision);
		server.get("/portal/admin/release/:delivId", AdminRoutes.isAdmin, AdminRoutes.getRelease);
		server.post("/portal/admin/release/:repoId", AdminRoutes.isAdmin, AdminRoutes.postRelease);
		server.post("/portal/admin/withdraw", AdminRoutes.isAdmin, AdminRoutes.postWithdraw);
		server.post("/portal/admin/checkDatabase/:dryRun", AdminRoutes.isAdmin, AdminRoutes.postCheckDatabase);
		server.del("/portal/admin/deliverable/:delivId", AdminRoutes.isAdmin, AdminRoutes.deleteDeliverable);
		server.del("/portal/admin/repository/:repoId", AdminRoutes.isAdmin, AdminRoutes.deleteRepository);

		// admin team functions
		server.post("/portal/admin/team", AdminRoutes.isAdmin, AdminRoutes.teamCreate);
		server.post("/portal/admin/team/:teamId/members/:memberId", AdminRoutes.isAdmin, AdminRoutes.teamAddMember);
		server.del("/portal/admin/team/:teamId/members/:memberId", AdminRoutes.isAdmin, AdminRoutes.teamRemoveMember);
		server.del("/portal/admin/team/:teamId", AdminRoutes.isAdmin, AdminRoutes.teamDelete);

		// admin patch routes
		server.get("/portal/admin/listPatches", AdminRoutes.isAdmin, AdminRoutes.listPatches);
		server.post("/portal/admin/patchRepo/:repo/:patch/:root", AdminRoutes.isAdmin, AdminRoutes.patchRepo);
		server.get("/portal/admin/patchSource", AdminRoutes.isAdmin, AdminRoutes.patchSource);
		server.post("/portal/admin/updatePatches", AdminRoutes.isAdmin, AdminRoutes.updatePatches);

		// TODO: un-release repos

		// staff-only functions
		// NOTHING
	}
}
