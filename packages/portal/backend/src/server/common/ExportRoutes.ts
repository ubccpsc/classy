import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GradesController } from "@backend/controllers/GradesController";
import IREST, { type ClassyRequest } from "@backend/server/IREST";
import { AuditLabel } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import * as crypto from "crypto";
import type { FastifyInstance, FastifyReply } from "fastify";

/**
 * One grade, as an external system sees it.
 *
 * The field names are the consumer's, not Classy's: this payload is a published contract
 * (docs/developer/elms-grade-sync-spec.md), so it deliberately does not reuse GradeTransport, which
 * exists to feed the admin UI and is free to change with it.
 */
export interface ExportedGrade {
	/**
	 * The student number, as a string, and the only join key. Never zero-padded: Classy treats
	 * a student number as a number, and student numbers do not start with a zero.
	 */
	snum: string;

	/**
	 * The CWL, for legibility only. NOT a join key.
	 */
	cwl: string;

	/**
	 * Out of `max`.
	 */
	score: number;

	/**
	 * Student-facing Markdown. May be empty. JSON.stringify handles the escaping.
	 */
	feedback: string;

	/**
	 * The bucket a student was actually graded on, for deliverables graded that way.
	 * Absent (not null) when the grade does not have an associated bucket value.
	 */
	display_score?: string;

	/**
	 * When the grade was produced, as opposed to when this payload was.
	 */
	timestamp: number;

	url: string | null;
}

export interface ExportedGrades {
	assessment: string;
	generated_at: string;
	max: number;
	grades: ExportedGrade[];
}

/**
 * Read-only grade export for external systems (an LMS, a dashboard).
 *
 * A fourth consumer class alongside the student UI (/portal/*), the admin UI (/portal/admin/*) and
 * AutoTest (/portal/at/*): its credential is issued and revoked without touching the other three.
 * See docs/developer/grade-export-api-plan.md for why, and
 * docs/developer/elms-grade-sync-spec.md for the contract this implements.
 */
export class ExportRoutes implements IREST {
	/**
	 * Every deliverable is exported out of 100. Classy has no max-score field, and its scores are
	 * percentages by convention; a course that needs a different scale wants a real field on
	 * Deliverable rather than a per-consumer fudge here.
	 */
	public static readonly MAX_SCORE = 100;

	public static readonly PREFIX = "/portal/api/v1/elms";

	public registerRoutes(server: FastifyInstance): void {
		Log.info("ExportRoutes::registerRoutes() - start");

		server.get(ExportRoutes.PREFIX + "/ping", { preHandler: ExportRoutes.isAuthorized }, ExportRoutes.ping);
		server.get(ExportRoutes.PREFIX + "/grades/:delivId", { preHandler: ExportRoutes.isAuthorized }, ExportRoutes.getGrades);
	}

	/**
	 * Rejects any request without a recognized bearer token.
	 *
	 * On success the matched consumer name is attached to the request, which is the only thing the
	 * audit record can name (there is no person in this flow).
	 */
	public static async isAuthorized(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const consumer = ExportRoutes.consumerFor(req.headers.authorization);
		if (consumer === null) {
			// NOTE: the provided value is deliberately neither echoed nor logged. It is
			// caller-supplied, and reflecting it puts noise -- or somebody else's token -- into the
			// logs and the response body.
			ExportRoutes.handleError(401, "INVALID_TOKEN", "Missing or invalid API token.", res);
			return;
		}
		(req as any).classyConsumer = consumer;
	}

	/**
	 * The consumer name for an Authorization header, or null if it does
	 * not match a configured token.
	 *
	 * API_TOKENS is a comma-separated list of consumer:token pairs, so one integration
	 * can be cut off by removing its entry without disturbing the others.
	 */
	private static consumerFor(header: string | undefined): string | null {
		if (typeof header !== "string") {
			return null;
		}

		const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
		if (match === null) {
			return null;
		}
		const provided = match[1];

		const configured = Config.getInstance().getProp(ConfigKey.apiTokens);
		if (typeof configured !== "string" || configured.trim().length === 0) {
			// no tokens configured means the export is off, not open
			Log.warn("ExportRoutes::consumerFor(..) - API_TOKENS is not configured; rejecting");
			return null;
		}

		let matched: string | null = null;
		for (const entry of configured.split(",")) {
			const sep = entry.indexOf(":");
			if (sep < 1) {
				Log.warn("ExportRoutes::consumerFor(..) - ignoring malformed API_TOKENS entry (expected consumer:token)");
				continue;
			}
			const name = entry.slice(0, sep).trim();
			const token = entry.slice(sep + 1).trim();
			if (token.length === 0) {
				Log.warn("ExportRoutes::consumerFor(..) - ignoring API_TOKENS entry with an empty token for: " + name);
				continue;
			}
			if (ExportRoutes.tokensMatch(provided, token) === true) {
				// no early return: comparing against every entry keeps the work independent of
				// which entry matched
				matched = name;
			}
		}
		return matched;
	}

	/**
	 * Constant-time token comparison.
	 *
	 * timingSafeEqual throws on a length mismatch, which would leak the configured length, so the
	 * lengths are checked first and a mismatch still walks the whole comparison.
	 */
	private static tokensMatch(provided: string, configured: string): boolean {
		const a = Buffer.from(provided, "utf8");
		const b = Buffer.from(configured, "utf8");
		if (a.length !== b.length) {
			// compare b against itself so the timing does not depend on the length difference
			crypto.timingSafeEqual(b, b);
			return false;
		}
		return crypto.timingSafeEqual(a, b);
	}

	/**
	 * Connectivity + credential check; backs the consumer's "test connection" action.
	 *
	 * Not audited: it carries no student data.
	 */
	public static async ping(_req: ClassyRequest, res: FastifyReply): Promise<void> {
		Log.info("ExportRoutes::ping(..) - start");
		res.status(200).send({ ok: true, service: "classy" });
	}

	/**
	 * Every grade for one deliverable.
	 */
	public static async getGrades(req: ClassyRequest, res: FastifyReply): Promise<void> {
		const start = Date.now();
		const delivId = req.params.delivId;
		const consumer = (req as any).classyConsumer as string;
		Log.info("ExportRoutes::getGrades( " + delivId + " ) - start; consumer: " + consumer);

		try {
			const deliv = await new DeliverablesController().getDeliverable(delivId);
			if (deliv === null) {
				ExportRoutes.handleError(404, "UNKNOWN_DELIVERABLE", "Unknown deliverable: " + delivId + ".", res);
				return;
			}

			if (deliv.gradesReleased !== true) {
				// The gate must not leak what it is gating, so this returns before any grade is
				// read. gradesReleased already means "final enough to leave Classy";
				// visibleToStudents is a different question (does the column show in the UI) and is
				// deliberately not consulted.
				ExportRoutes.handleError(
					409,
					"GRADES_NOT_RELEASED",
					"Grades for " + delivId + " have not been released. Release them in Classy, then retry.",
					res
				);
				return;
			}

			const rows = await new GradesController().getGradesForDeliverable(delivId);

			const grades: ExportedGrade[] = [];
			for (const row of rows) {
				const exported: ExportedGrade = {
					snum: String(row.person.studentNumber),
					cwl: row.person.githubId,
					score: row.grade.score,
					feedback: typeof row.grade.comment === "string" ? row.grade.comment : "",
					timestamp: row.grade.timestamp,
					url: row.grade.URL,
				};

				const displayScore = row.grade.custom?.displayScore;
				if (typeof displayScore === "string" && displayScore.length > 0) {
					exported.display_score = displayScore;
				}

				grades.push(exported);
			}

			const payload: ExportedGrades = {
				assessment: delivId,
				generated_at: new Date().toISOString(),
				max: ExportRoutes.MAX_SCORE,
				grades: grades,
			};

			// personId is the consumer name here; every other audit record's personId is a human.
			await DatabaseController.getInstance().writeAudit(
				AuditLabel.GRADE_EXPORT,
				consumer,
				{},
				{},
				{
					delivId: delivId,
					count: grades.length,
				}
			);

			Log.info(
				"ExportRoutes::getGrades( " +
					delivId +
					" ) - done; consumer: " +
					consumer +
					"; #: " +
					grades.length +
					"; took: " +
					(Date.now() - start) +
					"ms"
			);
			res.status(200).send(payload);
		} catch (err) {
			Log.error("ExportRoutes::getGrades( " + delivId + " ) - ERROR: " + err.message);
			ExportRoutes.handleError(500, "INTERNAL", "Unable to export grades for " + delivId + ".", res);
		}
	}

	/**
	 * The consumer's error envelope, with a stable code alongside the human-readable message.
	 *
	 * NOTE: deliberately not Classy's usual {failure: {message, shouldLogout}}. Everything else that
	 * reads FailurePayload is the frontend, which has no use for either shape, and this payload is a
	 * published contract with an external system.
	 */
	private static handleError(status: number, code: string, message: string, res: FastifyReply): void {
		Log.warn("ExportRoutes::handleError(..) - status: " + status + "; code: " + code + "; msg: " + message);
		res.status(status).send({ error: { message: message, code: code } });
	}
}
