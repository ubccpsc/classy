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
import Util from "@common/Util";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as fs from "fs-extra";
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
import IREST, { type ClassyRequest } from "../IREST";
import { AuthRoutes } from "./AuthRoutes";
import { ClasslistAgent } from "./ClasslistAgent";
import { PrairieLearnAgent } from "./PrairieLearnAgent";
import { RouteUtil } from "./RouteUtil";

export default class GeneralRoutes implements IREST {
	public static async getConfig(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("GeneralRoutes::getConfig(..) - start");
		const start = Date.now();

		const org = Config.getInstance().getProp(ConfigKey.org);
		const name = Config.getInstance().getProp(ConfigKey.name);
		const githubAPI = Config.getInstance().getProp(ConfigKey.githubAPI);
		const githubHost = Config.getInstance().getProp(ConfigKey.githubHost);
		const studentsFormTeamDelivIds = (await new DeliverablesController().getAllDeliverables())
			.filter((d) => d.teamStudentsForm === true)
			.map((d) => d.id);

		if (org !== null) {
			const payload: ConfigTransportPayload = {
				success: {
					org: org,
					name: name,
					githubAPI: githubAPI,
					githubHost: githubHost,
					studentsFormTeamDelivIds,
					prairieLearnEnabled: PrairieLearnAgent.isConfigured(),
				},
			};
			Log.trace("GeneralRoutes::getConfig(..) - done; took: " + Util.took(start));
			Log.trace("GeneralRoutes::getConfig(..) - sending: " + JSON.stringify(payload));
			res.code(200).send(payload);
			return;
		}

		const payload: ConfigTransportPayload = {
			failure: { message: "Unable to retrieve config (server error)", shouldLogout: false },
		};
		res.code(400).send(payload);
	}

	public static async getPerson(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const user = req.headers.user;
		const token = req.headers.token;
		Log.trace("GeneralRoutes::getPerson(..) - start; user: " + user);

		try {
			const personTrans = await GeneralRoutes.performGetPerson(user, token);
			const payload: Payload = { success: personTrans };
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.info("GeneralRoutes::getPerson(..) - ERROR: " + err.message); // intentionally info
			const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
			res.code(400).send(payload);
			return;
		}
	}

	public static async getGrades(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const user = req.headers.user;
		const token = req.headers.token;

		Log.trace("GeneralRoutes::getGrades(..) - start; user: " + user);

		try {
			const grades = await GeneralRoutes.performGetGrades(user, token);
			const payload: GradeTransportPayload = { success: grades };
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.info("GeneralRoutes::getGrades(..) - ERROR: " + err.message); // intentionally info
			const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
			res.code(400).send(payload);
			return;
		}
	}

	public static async getTeams(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const user = req.headers.user;
		const token = req.headers.token;
		Log.trace("GeneralRoutes::getTeams(..) - start; user: " + user);
		const start = Date.now();

		try {
			const teams = await GeneralRoutes.performGetTeams(user, token);
			Log.trace("GeneralRoutes::getTeams(..) - done; user: " + user + ": #teams: " + teams.length + "; took: " + Util.took(start));
			const payload: TeamTransportPayload = { success: teams };
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.info("GeneralRoutes::getTeams(..) - ERROR: " + err.message); // intentionally info
			const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
			res.code(400).send(payload);
			return;
		}
	}

	public static async getResource(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.trace("GeneralRoutes::getResource(..) - start; user: " + req.headers.user);

		const auth = RouteUtil.processAuth(req);
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
			res.redirect(loc, 302);
			return;
		}

		Log.info("GeneralRoutes::getResource(..) - user: " + auth.user + "; path: " + path);

		try {
			// NOTE: the resolved resource is not used; performGetResource is called for its
			// authorization check, which throws when the user may not read this path.
			await GeneralRoutes.performGetResource(auth, path);

			const filePath = Config.getInstance().getProp(ConfigKey.persistDir) + "/runs" + path;
			Log.trace("GeneralRoutes::getResource(..) - start; trying to read file: " + filePath);

			try {
				if (fs.lstatSync(filePath).isDirectory()) {
					Log.trace("GeneralRoutes::getResource(..) - File was actually a directory: " + filePath);
					const html = GeneralRoutes.generateDirectoryHtml(filePath, path, req.url);
					// NOTE: sending a string lets Fastify set Content-Length itself, which is
					// what the directory-listing spec asserts; the previous writeHead/write/end
					// wrote to the raw response to achieve the same thing.
					res.code(200).header("Content-Type", "text/html").send(html);
				} else {
					// NOTE: handed to Fastify as a stream rather than piped to the response.
					// Fastify pipes it and responds chunked, so large AutoTest artifacts are
					// still streamed rather than buffered (the spec asserts the chunked
					// encoding). Stream errors after the headers are sent are Fastify's to
					// handle; a missing file is caught by the lstatSync above.
					const rs = fs.createReadStream(filePath);
					rs.on("end", () => {
						Log.trace("GeneralRoutes::getResource(..) - done; finished reading file: " + filePath);
					});
					// NOTE: awaited. In an async handler Fastify finalizes the reply as soon as the
					// handler's promise resolves, which for a stream payload means closing the
					// response before anything has been piped (a 200 with content-length: 0).
					// FastifyReply is thenable and settles once the response is actually flushed,
					// so awaiting it holds the handler open for the duration of the stream.
					await res.code(200).send(rs);
				}
			} catch (err) {
				Log.error("GeneralRoutes::getResource(..) - ERROR Requested resource does not exist: " + path);
				res.code(404).send(err.message);
			}
		} catch (err) {
			Log.error("GeneralRoutes::getResource(..) - ERROR: " + err);
			if (err.message === "401") {
				GeneralRoutes.handleError(401, "Authorization error; unknown user/token.", res);
				return;
			}
			Log.info("GeneralRoutes::getResource(..) - ERROR: " + err.message); // intentionally info
			GeneralRoutes.handleError(400, "Problem encountered getting resource: " + err.message, res);
		}
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
		} catch (_err) {
			throw new Error("401");
		}

		// Log.info("GeneralRoutes::performGetResource( .. ) - valid request; passing through to: " + uri);
		// if resource does not exist, request should return 404
		return proceed;
	}

	public static async getRepos(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const user = req.headers.user;
		const token = req.headers.token;
		Log.trace("GeneralRoutes::getRepos(..) - start; user: " + user);

		try {
			const repos = await GeneralRoutes.performGetRepos(user, token);
			const payload: RepositoryPayload = { success: repos };
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.info("GeneralRoutes::getRepos(..) - ERROR: " + err.message); // intentionally info
			const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
			res.code(400).send(payload);
			return;
		}
	}

	public static async postTeam(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const user = req.headers.user;
		const token = req.headers.token;

		Log.info("GeneralRoutes::teamCreate(..) - start; user: " + user);

		const teamTrans = req.body as TeamFormationTransport;

		if (typeof teamTrans !== "object" || teamTrans === null) {
			const payload: Payload = { failure: { message: "Invalid team creation request; no body sent.", shouldLogout: false } };
			Log.info("GeneralRoutes::teamCreate(..) - ERROR: no body sent");
			res.code(400).send(payload);
			return;
		}
		try {
			const team = await GeneralRoutes.performPostTeam(user, token, teamTrans);
			Log.info("GeneralRoutes::teamCreate(..) - done; team: " + JSON.stringify(team));
			const payload: TeamTransportPayload = { success: [team] }; // really should not be an array, but it beats having another type
			res.code(200).send(payload);
			return;
		} catch (err) {
			Log.info("GeneralRoutes::teamCreate(..) - ERROR: " + err.message); // intentionally info
			const payload: Payload = { failure: { message: err.message, shouldLogout: false } };
			res.code(400).send(payload);
			return;
		}
	}

	public static async updateClasslist(req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("GeneralRoutes::updateClasslist(..) - start");
		const ca = new ClasslistAgent();
		// NOTE: req.ip replaces restify's req.connection.remoteAddress, which Fastify does not
		// expose. Fastify resolves it from the socket (and honours x-forwarded-for when trustProxy
		// is on), but the explicit header check is kept because trustProxy is not enabled here.
		const ipAddr = req.headers["x-forwarded-for"] || req.ip;
		const ipReg: RegExp = /(142\.103\.[1-9]+\.[1-9]+)/;
		let auditInfo: string;

		if (ipReg.test(ipAddr) === false) {
			return await GeneralRoutes.handleError(403, "Forbidden error; user not privileged", res);
		}

		auditInfo = req.headers.user || ipAddr;

		try {
			const data = await ca.fetchClasslist();
			const classlistChanges = await ca.processClasslist(auditInfo, null, data);

			if (classlistChanges.classlist.length) {
				const payload: Payload = {
					success: {
						message: "Classlist upload successful. " + classlistChanges.classlist.length + " students processed.",
					},
				};
				res.code(200).send(payload);
				Log.info("GeneralRoutes::updateClasslist(..) - done: " + payload.success.message);
			} else {
				const msg = "Classlist upload not successful; no students were processed from CSV.";
				return GeneralRoutes.handleError(400, msg, res);
			}
		} catch (_err) {
			const msg = "Classlist upload not successful; no students were processed from CSV.";
			return GeneralRoutes.handleError(400, msg, res);
		}
	}

	public static handleError(code: number, msg: string, res: FastifyReply): void {
		RouteUtil.handleError("GeneralRoutes", code, msg, res);
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

	public registerRoutes(server: FastifyInstance): void {
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
