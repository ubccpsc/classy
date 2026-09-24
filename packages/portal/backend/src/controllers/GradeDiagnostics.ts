import Log from "@common/Log";
import Util from "@common/Util";

import { DatabaseController } from "./DatabaseController";

export interface GradeDiagnosticFindings {
	grades: number;
	avgGradeKB: number;
	totalGradesMB: number;
	/** grades carrying at least one level of custom.previousGrade */
	withHistory: number;
	maxDepth: number;
	depthBuckets: Array<{ label: string; count: number }>;
	/** grades within NEAR_LIMIT saves of LIMIT_DEPTH, including those at it */
	nearLimit: number;
	/** grades at LIMIT_DEPTH, whose next save will be refused */
	atLimit: number;
	deepest: Array<{ personId: string; delivId: string; depth: number }>;
	people: number;
	uniqueIdIndex: boolean;
	duplicatePersonIdCount: number;
	/** up to ten of them */
	duplicatePersonIds: string[];
}

/**
 * TEMPORARY. Answers two questions about a live course's grades that decide how the grades page's
 * performance fixes ship, on a deployment where the database cannot be queried by hand. Remove
 * this file and its one call in AdminRoutes::getGrades once they are answered.
 *
 * 1. How deep does regrade history nest? GradesController::saveGrade stores the existing record,
 *    history and all, under custom.previousGrade, so each save of a grade adds a level. MongoDB
 *    refuses a write past its nesting limit (see LIMIT_DEPTH), and that failure is logged and
 *    swallowed, so a grade that reaches it silently stops updating.
 * 2. Are person ids unique? Replacing the per-grade person lookup in getAllGrades with one read and
 *    a Map is only exactly equivalent if they are. ensureUniqueIdIndexes enforces it, but skips the
 *    index (logging an error) when duplicates already existed, so its presence has to be checked.
 *
 * Read-only. Runs once per process, on the first grades page load, and the route does not wait for
 * it, so the page is no slower. Every line it logs starts with "GradeDiagnostics".
 */
export class GradeDiagnostics {
	/**
	 * The deepest history a grade can hold and still be saved. MongoDB refuses a document nested past
	 * 180 levels, which is the save that would create a 90th previousGrade. Measured against 5.0.14,
	 * production's image, and 7.0: 90 saves of one grade succeed and the 91st is refused.
	 */
	public static readonly LIMIT_DEPTH = 89;
	private static readonly NEAR_LIMIT = 10;

	/**
	 * One level deeper than any history that can be stored (see LIMIT_DEPTH), so every depth counts
	 * exactly. It cannot go much further: MongoDB rejects a field path of more than 200 components,
	 * and each level is two (custom, previousGrade), so 90 levels is 180.
	 */
	private static readonly MAX_PROBE = GradeDiagnostics.LIMIT_DEPTH + 1;

	/** Lower bounds of the depth histogram; the last bucket is the one that can no longer be saved. */
	private static readonly BUCKETS: Array<{ from: number; label: string }> = [
		{ from: 0, label: "0" },
		{ from: 1, label: "1-4" },
		{ from: 5, label: "5-9" },
		{ from: 10, label: "10-19" },
		{ from: 20, label: "20-39" },
		{ from: 40, label: "40-59" },
		{ from: 60, label: "60-69" },
		{ from: 70, label: "70-79" },
		{ from: 80, label: "80-88" },
		{ from: GradeDiagnostics.LIMIT_DEPTH, label: GradeDiagnostics.LIMIT_DEPTH + " (cannot be saved again)" },
	];

	private static ran = false;

	/**
	 * Starts the diagnostic the first time it is called in this process and returns at once. Never
	 * throws and never rejects: a failure is logged, and the caller's request is unaffected.
	 */
	public static runOnce(): void {
		if (GradeDiagnostics.ran === true) {
			return;
		}
		GradeDiagnostics.ran = true;
		try {
			GradeDiagnostics.run().catch((err) => {
				Log.warn("GradeDiagnostics - failed; nothing else is affected. ERROR: " + err?.message);
			});
		} catch (err) {
			Log.warn("GradeDiagnostics - failed to start; nothing else is affected. ERROR: " + err?.message);
		}
	}

	public static async run(): Promise<GradeDiagnosticFindings> {
		const start = Date.now();
		Log.info("GradeDiagnostics - start");
		const dbc = DatabaseController.getInstance();
		// the collection names DatabaseController uses (GRADECOLL, PERSONCOLL)
		const grades = await dbc.getCollection("grades");
		const people = await dbc.getCollection("people");

		const stats = (await grades.aggregate([{ $collStats: { storageStats: {} } }]).toArray())[0]?.storageStats ?? {};

		const facets = (
			await grades
				.aggregate([
					{ $project: { _id: 0, personId: 1, delivId: 1, depth: GradeDiagnostics.depthExpression() } },
					{
						$facet: {
							summary: [
								{
									$group: {
										_id: null,
										count: { $sum: 1 },
										withHistory: { $sum: { $cond: [{ $gt: ["$depth", 0] }, 1, 0] } },
										maxDepth: { $max: "$depth" },
									},
								},
							],
							buckets: [
								{
									$bucket: {
										groupBy: "$depth",
										boundaries: GradeDiagnostics.BUCKETS.map((b) => b.from).concat([GradeDiagnostics.MAX_PROBE + 1]),
										output: { count: { $sum: 1 } },
									},
								},
							],
							deepest: [{ $match: { depth: { $gt: 0 } } }, { $sort: { depth: -1 } }, { $limit: 10 }],
						},
					},
				])
				.toArray()
		)[0];

		const summary = facets?.summary?.[0] ?? { count: 0, withHistory: 0, maxDepth: 0 };
		const counted = new Map<number, number>((facets?.buckets ?? []).map((b: any) => [b._id, b.count]));
		const depthBuckets = GradeDiagnostics.BUCKETS.map((b) => ({ label: b.label, count: counted.get(b.from) ?? 0 }));
		const deepest = (facets?.deepest ?? []).map((d: any) => ({ personId: d.personId, delivId: d.delivId, depth: d.depth }));
		const atLimit = counted.get(GradeDiagnostics.LIMIT_DEPTH) ?? 0;
		const nearLimit = await grades.countDocuments({
			[GradeDiagnostics.historyPath(GradeDiagnostics.LIMIT_DEPTH - GradeDiagnostics.NEAR_LIMIT + 1)]: { $exists: true },
		});

		let uniqueIdIndex = false;
		try {
			uniqueIdIndex = (await people.indexes()).some((i: any) => i.unique === true && Object.keys(i.key).length === 1 && i.key.id === 1);
		} catch (_err) {
			// a course with no people collection yet has no indexes to list
		}
		const duplicates = await people
			.aggregate([{ $group: { _id: "$id", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $sort: { n: -1 } }])
			.toArray();

		const findings: GradeDiagnosticFindings = {
			grades: summary.count,
			avgGradeKB: Math.round(((stats.avgObjSize ?? 0) / 1024) * 10) / 10,
			totalGradesMB: Math.round(((stats.size ?? 0) / 1048576) * 10) / 10,
			withHistory: summary.withHistory,
			maxDepth: summary.maxDepth ?? 0,
			depthBuckets: depthBuckets,
			nearLimit: nearLimit,
			atLimit: atLimit,
			deepest: deepest,
			people: await people.countDocuments({}),
			uniqueIdIndex: uniqueIdIndex,
			duplicatePersonIdCount: duplicates.length,
			duplicatePersonIds: duplicates.slice(0, 10).map((d: any) => String(d._id)),
		};

		GradeDiagnostics.report(findings);
		Log.info("GradeDiagnostics - done; took: " + Util.took(start));
		return findings;
	}

	private static report(f: GradeDiagnosticFindings): void {
		Log.info("GradeDiagnostics - grades: " + f.grades + "; average " + f.avgGradeKB + " KB each; " + f.totalGradesMB + " MB in total");
		Log.info(
			"GradeDiagnostics - regrade history: " +
				f.withHistory +
				" of " +
				f.grades +
				" grades have some; deepest: " +
				f.maxDepth +
				"; by depth: " +
				f.depthBuckets.map((b) => b.label + ": " + b.count).join(", ")
		);
		if (f.deepest.length > 0) {
			Log.info(
				"GradeDiagnostics - deepest histories: " + f.deepest.map((d) => d.personId + "/" + d.delivId + " (" + d.depth + ")").join(", ")
			);
		}
		if (f.atLimit > 0) {
			Log.warn(
				"GradeDiagnostics - " +
					f.atLimit +
					" grade(s) are at depth " +
					GradeDiagnostics.LIMIT_DEPTH +
					": their next save will be refused, so their stored value can no longer change"
			);
		}
		if (f.nearLimit > 0) {
			Log.warn("GradeDiagnostics - " + f.nearLimit + " grade(s) are within " + GradeDiagnostics.NEAR_LIMIT + " saves of the limit");
		}

		const line =
			"GradeDiagnostics - people: " +
			f.people +
			"; unique id index: " +
			(f.uniqueIdIndex ? "present" : "MISSING") +
			"; duplicate ids: " +
			(f.duplicatePersonIdCount === 0 ? "none" : f.duplicatePersonIdCount + " (" + f.duplicatePersonIds.join(", ") + ")");
		if (f.uniqueIdIndex === true && f.duplicatePersonIdCount === 0) {
			Log.info(line);
		} else {
			Log.warn(line);
		}
	}

	/** custom.previousGrade, n levels deep */
	private static historyPath(n: number): string {
		return Array(n).fill("custom.previousGrade").join(".");
	}

	/**
	 * A grade's history depth: how many previousGrade levels exist. Existence is monotonic -- a level
	 * can only be present if the one above it is -- so counting the levels that exist is the depth.
	 */
	private static depthExpression(): object {
		const levels: object[] = [];
		for (let n = 1; n <= GradeDiagnostics.MAX_PROBE; n++) {
			levels.push({ $cond: [{ $eq: [{ $type: "$" + GradeDiagnostics.historyPath(n) }, "object"] }, 1, 0] });
		}
		return { $add: levels };
	}
}
