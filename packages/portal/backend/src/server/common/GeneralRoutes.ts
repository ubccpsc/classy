import * as fs from "fs-extra";
import * as restify from "restify";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import {
	ConfigTransportPayload,
	GradeTransport,
	GradeTransportPayload,
	Payload,
	RepositoryPayload,
	RepositoryTransport,
	StudentTransport,
	TeamFormationTransport,
	TeamTransport,
	TeamTransportPayload,
} from "@common/types/PortalTypes";

import { AuthController } from "../../controllers/AuthController";
import { DatabaseController } from "../../controllers/DatabaseController";
import { DeliverablesController } from "../../controllers/DeliverablesController";
import { GitHubActions } from "../../controllers/GitHubActions";
import { GitHubController } from "../../controllers/GitHubController";
import { GradesController } from "../../controllers/GradesController";
import { PersonController } from "../../controllers/PersonController";
import { RepositoryController } from "../../controllers/RepositoryController";
import { TeamController } from "../../controllers/TeamController";
import { Factory } from "../../Factory";
import { AuditLabel, GitHubStatus, Person } from "../../Types";
import { ClasslistAgent } from "./ClasslistAgent";

import IREST from "../IREST";
import AdminRoutes from "./AdminRoutes";
import { AuthRoutes } from "./AuthRoutes";
import Util from "@common/Util";

export default class GeneralRoutes implements IREST {
	public static async getConfig(req: any, res: any, next: any) {
		Log.trace("GeneralRoutes::getConfig(..) - start");
		const start = Date.now();

		const org = Config.getInstance().getProp(ConfigKey.org);
		const name = Config.getInstance().getProp(ConfigKey.name);
		const githubAPI = Config.getInstance().getProp(ConfigKey.githubAPI);
		const studentsFormTeamDelivIds = (await new DeliverablesController().getAllDeliverables())
			.filter((d) => d.teamStudentsForm === true)
			.map((d) => d.id);

		let payload: ConfigTransportPayload;
		if (org !== null) {
			payload = { success: { org: org, name: name, githubAPI: githubAPI, studentsFormTeamDelivIds } };
			Log.trace("GeneralRoutes::getConfig(..) - done; took: " + Util.took(start));
			Log.trace("GeneralRoutes::getConfig(..) - sending: " + JSON.stringify(payload));
			res.send(200, payload);
			return next(false);
		} else {
			payload = { failure: { message: "Unable to retrieve config (server error)", shouldLogout: false } };
			res.send(400, payload);
			return next(false);
		}
	}

	public static getPerson(req: any, res: any, next: any) {
		const user = req.headers.user;
		const token = req.headers.token;
		Log.trace("GeneralRoutes::getPerson(..) - start; user: " + user);

		GeneralRoutes.performGetPerson(user, token)
			.then(function (personTrans) {
				const payload: Payload = { success: personTrans };
				res.send(200, payload);
				return next(false);
			})
			.catch(function (err) {
				Log.info("GeneralRoutes::getPerson(..) - ERROR: " + err.message); // intentionally info
				const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
				res.send(400, payload);
				return next(false);
			});
	}

	public static getGrades(req: any, res: any, next: any) {
		const user = req.headers.user;
		const token = req.headers.token;

		Log.trace("GeneralRoutes::getGrades(..) - start; user: " + user);

		GeneralRoutes.performGetGrades(user, token)
			.then(function (grades) {
				const payload: GradeTransportPayload = { success: grades };
				res.send(200, payload);
				return next(false);
			})
			.catch(function (err) {
				Log.info("GeneralRoutes::getGrades(..) - ERROR: " + err.message); // intentionally info
				const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
				res.send(400, payload);
				return next(false);
			});
	}

	public static getTeams(req: any, res: any, next: any) {
		const user = req.headers.user;
		const token = req.headers.token;
		Log.trace("GeneralRoutes::getTeams(..) - start; user: " + user);
		const start = Date.now();

		GeneralRoutes.performGetTeams(user, token)
			.then(function (teams) {
				Log.trace(
					"GeneralRoutes::getTeams(..) - done; user: " + user + ": #teams: " + teams.length + "; took: " + Util.took(start)
				);
				const payload: TeamTransportPayload = { success: teams };
				res.send(200, payload);
				return next(false);
			})
			.catch(function (err) {
				Log.info("GeneralRoutes::getTeams(..) - ERROR: " + err.message); // intentionally info
				const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
				res.send(400, payload);
				return next(false);
			});
	}

	public static getResource(req: any, res: any, next: any) {
		Log.trace("GeneralRoutes::getResource(..) - start; user: " + req.headers.user);

		const auth = AdminRoutes.processAuth(req);
		// const user = req.headers.user;
		// const token = req.headers.token;
		// const params = req.params;
		const path = req.url.substring(16); // this strips off the route prefix (i.e., /portal/resource)

		// right now this means requests _must_ be by an authorized user (admin, staff, or student)
		if (auth === null || typeof auth.user === "undefined" || typeof auth.token === "undefined") {
			Log.warn("GeneralRoutes::isAdmin(..) - undefined user or token for resource: " + path);
			// If the requester is not authenticated forward them back to the front page.
			// TODO: use ref for forwarding the user to their original resource once they have logged in
			const loc = Config.getInstance().getProp(ConfigKey.publichostname) + "?ref=" + path;
			return res.redirect(loc, next);
		}

		Log.info("GeneralRoutes::getResource(..) - user: " + auth.user + "; path: " + path);

		GeneralRoutes.performGetResource(auth, path)
			.then(function (resource: any) {
				const filePath = Config.getInstance().getProp(ConfigKey.persistDir) + "/runs" + path;
				Log.trace("GeneralRoutes::getResource(..) - start; trying to read file: " + filePath);

				try {
					if (fs.lstatSync(filePath).isDirectory()) {
						Log.trace("GeneralRoutes::getResource(..) - File was actually a directory: " + filePath);
						const html = GeneralRoutes.generateDirectoryHtml(filePath, path, req.url);
						res.writeHead(200, {
							"Content-Length": Buffer.byteLength(html),
							"Content-Type": "text/html",
						});
						res.write(html);
						res.end();
					} else {
						const rs = fs.createReadStream(filePath);
						rs.on("error", (err: any) => {
							if (err.code === "ENOENT") {
								Log.error(
									"GeneralRoutes::getResource(..) - ERROR Requested resource does not exist. " +
										"This really should not have reached here: " +
										path
								);
								res.send(404, err.message);
							} else {
								Log.error("GeneralRoutes::getResource(..) - ERROR Reading requested resource: " + path);
								res.send(500, err.message);
							}
							return next();
						});
						rs.on("end", () => {
							Log.trace("GeneralRoutes::getResource(..) - done; finished reading file: " + filePath);
							rs.close();
							return next();
						});
						rs.pipe(res);
					}
				} catch (err) {
					Log.error("GeneralRoutes::getResource(..) - ERROR Requested resource does not exist: " + path);
					res.send(404, err.message);
				}
			})
			.catch(function (err) {
				Log.error("GeneralRoutes::getResource(..) - ERROR: " + err);
				if (err.message === "401") {
					return GeneralRoutes.handleError(401, "Authorization error; unknown user/token.", res, next);
				} else {
					Log.info("GeneralRoutes::getResource(..) - ERROR: " + err.message); // intentionally info
					return GeneralRoutes.handleError(400, "Problem encountered getting resource: " + err.message, res, next);
				}
			});
	}

	public static generateDirectoryHtml(absolutePath: string, relativePath: string, baseUrl: string): string {
		const directoryAddress: string = Config.getInstance().getProp(ConfigKey.publichostname) + baseUrl.replace(/\/$/, "");
		let body = `<html lang="en"><body><p><strong>${relativePath}</strong></p>`;
		body += [".."]
			.concat(fs.readdirSync(absolutePath))
			.map((file) => `<p><a href="${directoryAddress}/${file}">${file}</a></p>`)
			.join("");
		body += "</body></html>";
		return body;
	}

	public static async performGetResource(auth: { user: string; token: string }, path: string): Promise<boolean> {
		Log.trace("GeneralRoutes::performGetResource( .., " + path + " ) - start");

		let proceed = false;
		// if user/token does not have access to resource request should return 401
		try {
			const priv = await AuthRoutes.performGetCredentials(auth.user, auth.token);

			if (/\/student(\/|$)/.test(path)) {
				Log.trace("GeneralRoutes::performGetResource( .., " + path + " ) - student resource; is valid");
				// works for everyone (performGetCredentials would have thrown exception if not a valid user)
				proceed = true;
			} else if (/\/admin(\/|$)/.test(path)) {
				// works for admin only
				if (priv.isAdmin === true) {
					Log.trace("GeneralRoutes::performGetResource( ..," + path + " ) - admin resource; is valid");
					proceed = true;
				} else {
					Log.warn("GeneralRoutes::performGetResource( .., " + path + " ) - admin resource; NOT valid");
				}
			} else if (/\/staff(\/|$)/.test(path)) {
				Log.trace("GeneralRoutes::performGetResource( .., " + path + " ) - staff resource");
				// works for admin and staff
				if (priv.isAdmin === true || priv.isStaff === true) {
					Log.trace("GeneralRoutes::performGetResource( .., " + path + " ) - staff resource; is valid");
					proceed = true;
				} else {
					Log.warn("GeneralRoutes::performGetResource( .., " + path + " ) - staff resource; NOT valid");
				}
			}
			if (proceed === false) {
				// internal throw not great, but gets us into the same path as invalid student from
				throw new Error("401");
			}
		} catch (err) {
			throw new Error("401");
		}

		// Log.info("GeneralRoutes::performGetResource( .. ) - valid request; passing through to: " + uri);
		// if resource does not exist, request should return 404
		return proceed;
	}

	public static getRepos(req: any, res: any, next: any) {
		const user = req.headers.user;
		const token = req.headers.token;
		Log.trace("GeneralRoutes::getRepos(..) - start; user: " + user);

		GeneralRoutes.performGetRepos(user, token)
			.then(function (repos) {
				const payload: RepositoryPayload = { success: repos };
				res.send(200, payload);
				return next(false);
			})
			.catch(function (err) {
				Log.info("GeneralRoutes::getRepos(..) - ERROR: " + err.message); // intentionally info
				const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
				res.send(400, payload);
				return next(false);
			});
	}

	public static postTeam(req: any, res: any, next: any) {
		const user = req.headers.user;
		const token = req.headers.token;

		Log.info("GeneralRoutes::teamCreate(..) - start; user: " + user);

		const teamTrans: TeamFormationTransport = req.params;
		GeneralRoutes.performPostTeam(user, token, teamTrans)
			.then(function (team) {
				Log.info("GeneralRoutes::teamCreate(..) - done; team: " + JSON.stringify(team));
				const payload: TeamTransportPayload = { success: [team] }; // really should not be an array, but it beats having another type
				res.send(200, payload);
				return next(true);
			})
			.catch(function (err) {
				Log.info("GeneralRoutes::teamCreate(..) - ERROR: " + err.message); // intentionally info
				const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
				res.send(400, payload);
				return next(false);
			});
	}

	public static async updateClasslist(req: any, res: any, next: any) {
		Log.info("GeneralRoutes::updateClasslist(..) - start");
		const ca = new ClasslistAgent();
		const ipAddr = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
		const ipReg: RegExp = /(142\.103\.[1-9]+\.[1-9]+)/;
		let auditInfo: string;

		if (ipReg.test(ipAddr) === false) {
			return await GeneralRoutes.handleError(403, "Forbidden error; user not privileged", res, next);
		}

		auditInfo = req.headers.user || ipAddr;

		try {
			const data = await ca.fetchClasslist();
			const classlistChanges = await ca.processClasslist(auditInfo, null, data);

			let payload: Payload;

			if (classlistChanges.classlist.length) {
				payload = {
					success: {
						message: "Classlist upload successful. " + classlistChanges.classlist.length + " students processed.",
					},
				};
				res.send(200, payload);
				Log.info("GeneralRoutes::updateClasslist(..) - done: " + payload.success.message);
			} else {
				const msg = "Classlist upload not successful; no students were processed from CSV.";
				return GeneralRoutes.handleError(400, msg, res, next);
			}
		} catch (err) {
			const msg = "Classlist upload not successful; no students were processed from CSV.";
			return GeneralRoutes.handleError(400, msg, res, next);
		}
	}

	public static handleError(code: number, msg: string, res: any, next: any) {
		Log.error("GeneralRoutes::handleError(..) - ERROR: " + msg);
		res.send(code, { failure: { message: msg, shouldLogout: false } });
		return next(false);
	}

	private static async performGetPerson(user: string, token: string): Promise<StudentTransport> {
		const ac = new AuthController();
		const isValid = await ac.isValid(user, token);
		if (isValid === false) {
			Log.trace("GeneralRoutes::performGetGrades(..) - in isValid: " + isValid);
			throw new Error("Invalid credentials");
		} else {
			const pc = new PersonController();
			const person = await pc.getPerson(user);
			if (person === null) {
				return null;
			}

			return PersonController.personToTransport(person);
		}
	}

	private static async performPostTeam(user: string, token: string, requestedTeam: TeamFormationTransport): Promise<TeamTransport> {
		Log.info("GeneralRoutes::performPostTeam(..) - team: " + JSON.stringify(requestedTeam));
		const ac = new AuthController();
		const isValid = await ac.isValid(user, token);
		if (isValid === false) {
			Log.trace("GeneralRoutes::performPostTeam(..) - in isValid: " + isValid);
			throw new Error("Invalid credentials");
		} else {
			const tc = new TeamController();
			const dc = new DeliverablesController();
			const pc = new PersonController();

			// remove duplicate names
			const nameIds = requestedTeam.githubIds.filter(function (item, pos, self) {
				return self.indexOf(item) === pos;
			});
			if (nameIds.length !== requestedTeam.githubIds.length) {
				throw new Error("Team not created; duplicate team members specified.");
			}

			const people: Person[] = [];
			let requestor = null;
			for (const pId of nameIds) {
				const p = await pc.getGitHubPerson(pId); // students will provide github ids
				if (p !== null) {
					people.push(p);
					if (p.id === user) {
						requestor = p;
					}
				} else {
					throw new Error("Team not created; GitHub id not associated with student registered in course: " + pId);
				}
			}

			// make sure the requester is one of the teammates!
			// we have to do this here because the TeamController does not actually know who made the request
			if (requestor === null) {
				throw new Error("Users cannot form teams they are not going to join.");
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
			const deliv = await dc.getDeliverable(requestedTeam.delivId);
			const names = await cc.computeNames(deliv, people);

			let team = await tc.getTeam(names.teamName); // if a CustomController forms the team, capture that here
			if (team === null) {
				// if the CourseController did not form the team, still form it
				team = await tc.formTeam(names.teamName, deliv, people, false);
			}

			const dbc = DatabaseController.getInstance();
			await dbc.writeAudit(AuditLabel.TEAM_STUDENT, user, {}, team, {});

			const teamTrans: TeamTransport = {
				id: team.id,
				delivId: team.delivId,
				people: team.personIds,
				URL: team.URL,
			};

			Log.info("GeneralRoutes::performPostTeam(..) - team created: " + team.id);
			return teamTrans;
		}
	}

	private static async performGetGrades(user: string, token: string): Promise<GradeTransport[]> {
		const ac = new AuthController();
		const isValid = await ac.isValid(user, token);
		if (isValid === false) {
			Log.trace("GeneralRoutes::performGetGrades(..) - in isValid: " + isValid);
			throw new Error("Invalid credentials");
		} else {
			const gc: GradesController = new GradesController();
			const grades = await gc.getReleasedGradesForPerson(user);
			const gradeTrans: GradeTransport[] = [];
			for (const grade of grades) {
				const trans = await gc.gradeToTransport(grade);
				gradeTrans.push(trans);
			}
			return gradeTrans;
		}
	}

	private static async performGetTeams(user: string, token: string): Promise<TeamTransport[]> {
		const ac = new AuthController();
		const isValid = await ac.isValid(user, token);
		if (isValid === false) {
			Log.error("GeneralRoutes::performGetTeams(..) - isValid === false");
			throw new Error("Invalid credentials");
		} else {
			const pc = new PersonController();
			const person = await pc.getPerson(user); // person will always exist (checked in isValid above)

			const tc: TeamController = new TeamController();
			const teams = await tc.getTeamsForPerson(person);
			Log.trace("GeneralRoutes::performGetTeams(..) - #teams: " + teams.length);
			const teamTrans: TeamTransport[] = [];
			for (const team of teams) {
				teamTrans.push(tc.teamToTransport(team));
			}
			return teamTrans;
		}
	}

	private static async performGetRepos(user: string, token: string): Promise<RepositoryTransport[]> {
		const ac = new AuthController();
		const isValid = await ac.isValid(user, token);
		if (isValid === false) {
			Log.error("GeneralRoutes::performGetRepos(..) - isValid === false");
			throw new Error("Invalid credentials");
		} else {
			const pc = new PersonController();
			const person = await pc.getPerson(user); // person always exists (checked in isValid above)

			const rc = new RepositoryController();
			const repos = await rc.getReposForPerson(person);
			Log.trace("GeneralRoutes::performGetRepos(..) - #repos: " + repos.length);
			const repoTrans: RepositoryTransport[] = [];
			for (const repo of repos) {
				// if (repo.URL !== null) {
				if (repo.gitHubStatus !== GitHubStatus.NOT_PROVISIONED) {
					// provisioned repos
					repoTrans.push(RepositoryController.repositoryToTransport(repo));
				}
			}
			return repoTrans;
		}
	}

	public registerRoutes(server: restify.Server) {
		Log.trace("GeneralRoutes::registerRoutes() - start");

		// returns the org that the backend is currently configured to serve
		// mainly used by the frontend so it uses the correct UI
		server.get("/portal/config", GeneralRoutes.getConfig);

		// used to get student-specific data
		server.get("/portal/person", GeneralRoutes.getPerson);

		// used by students to get their (released) grades
		server.get("/portal/grades", GeneralRoutes.getGrades);

		// used by students to get their teams
		server.get("/portal/teams", GeneralRoutes.getTeams);

		// used by students to get their repos
		server.get("/portal/repos", GeneralRoutes.getRepos);

		// used by students to create their teams
		server.post("/portal/team", GeneralRoutes.postTeam);

		// server.get("/portal/resource/:path", GeneralRoutes.getResource);
		server.get("/portal/resource/*", GeneralRoutes.getResource);

		// IP restricted
		server.put("/portal/classlist", GeneralRoutes.updateClasslist);
	}
}
