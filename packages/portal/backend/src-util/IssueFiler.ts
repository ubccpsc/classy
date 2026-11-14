import * as fs from "node:fs";

import Log from "@common/Log";
import Util from "@common/Util";

import { DatabaseController } from "../src/controllers/DatabaseController";
import { GitHubActions, IGitHubActions } from "../src/controllers/GitHubActions";
import { Issue } from "../src/controllers/GitHubController";
import { RepositoryController } from "../src/controllers/RepositoryController";
import { RepoStatus, Repository } from "../src/Types";

/**
 * Files the same issue on every repository provisioned for a deliverable, assigned to the
 * students on the repository's team. Useful for handing back feedback, or for announcing a
 * change every team has to act on.
 *
 * Build and run (see README.md in this directory):
 *
 *   ../../../node_modules/typescript/bin/tsc -p tsconfig.src-util.json
 *   TS_NODE_BASEURL=. node --require dotenv/config --require tsconfig-paths/register src-util/IssueFiler.js \
 *       --deliv d2 --title "D2 feedback" --body /path/to/body.md [options]
 *
 * Options:
 *   --deliv <id>      The deliverable whose repositories get the issue. Required.
 *   --title <text>    Issue title. Required.
 *   --body <path>     File holding the Markdown body. Required. "{{repoId}}" in the body is
 *                     replaced with the repository name.
 *   --label <name>    Label to put on the issue (repeatable). Defaults to "classy". The first label
 *                     is also how a rerun recognises an issue it already filed, so keep at least one.
 *   --no-assign       Do not assign the issue to the students.
 *   --repo <id>       Only file on this repository (repeatable). Handy for a trial run on a staff repo.
 *   --any-status      Also file on repositories that are provisioned but not yet released. Students
 *                     cannot be assigned on those (they have no access yet), so the issue goes
 *                     unassigned.
 *   --report <path>   Also write the outcome for every repository to this CSV (repoId, outcome,
 *                     url, assignees). Useful as the record of what each team was sent.
 *   --live            Actually create the issues. Without it, the script only reports what it
 *                     would do.
 *
 * Without --live nothing is written to GitHub, so run that way first and read the report.
 *
 * GitHub rejects the whole issue if any assignee lacks access to the repo, which a stale GitHub id
 * (a student who changed their CWL) or a withdrawn student still on the team will cause. Rather
 * than lose the issue, it is filed again without assignees and reported as "unassigned" so those
 * repos can be dealt with by hand.
 *
 * Reruns are safe: a repository that already has an issue with this title and the first label
 * (open or closed) is skipped, so a run that dies partway through can be started again.
 *
 * Issues are created one at a time with a short pause between them. GitHub's secondary rate limit
 * is tuned for exactly this kind of burst of content creation, and tripping it costs far more time
 * than the pauses do.
 */
export class IssueFiler {
	/**
	 * Pause between issue creations, in ms. GitHub asks for at least a second between requests
	 * that create content.
	 */
	private static readonly CREATE_PAUSE_MS = 1000;

	/**
	 * GitHub refuses more assignees than this on one issue.
	 */
	private static readonly MAX_ASSIGNEES = 10;

	private readonly dc = DatabaseController.getInstance();
	private readonly gha: IGitHubActions;

	public constructor(
		private readonly opts: IssueFilerOptions,
		gha?: IGitHubActions
	) {
		Log.info("IssueFiler::<init> - deliv: " + opts.delivId + "; live: " + opts.live);
		this.gha = gha ?? GitHubActions.getInstance(true);
	}

	public async process(): Promise<IssueFilerReport> {
		Log.info("IssueFiler::process() - start; deliv: " + this.opts.delivId + "; live: " + this.opts.live);
		const start = Date.now();

		const report: IssueFilerReport = { planned: [], created: [], skipped: [], failed: [] };

		const repos = await this.selectRepos();
		Log.info("IssueFiler::process() - # repos selected: " + repos.length);

		for (const repo of repos) {
			const assignees = this.opts.assign === true ? await this.assigneesFor(repo) : [];
			const issue: Issue = {
				title: this.opts.title,
				body: this.opts.body.split("{{repoId}}").join(repo.id),
				labels: this.opts.labels,
				assignees: assignees,
			};

			const existing = await this.existingIssue(repo);
			if (existing !== null) {
				Log.info("IssueFiler::process() - SKIP " + repo.id + "; already filed: " + existing);
				report.skipped.push({ repoId: repo.id, reason: "already filed: " + existing });
				continue;
			}

			if (this.opts.live !== true) {
				Log.info("IssueFiler::process() - DRY RUN " + repo.id + "; would assign: [" + assignees.join(", ") + "]");
				report.planned.push({ repoId: repo.id, assignees: assignees });
				continue;
			}

			const outcome = await this.file(repo, issue);
			if (outcome.url !== null) {
				report.created.push({ repoId: repo.id, assignees: outcome.assignees, url: outcome.url });
			} else {
				report.failed.push({ repoId: repo.id, reason: "GitHub rejected the issue; see the makeIssue log lines above" });
			}
			await Util.delay(IssueFiler.CREATE_PAUSE_MS);
		}

		this.summarise(report);
		if (this.opts.reportPath !== null) {
			this.writeReport(report);
		}
		Log.info("IssueFiler::process() - done; took: " + Util.took(start));
		return report;
	}

	/**
	 * Creates the issue. If GitHub refuses it and assignees were requested, tries once more
	 * without them: an assignee without access fails the whole request, and an unassigned issue
	 * the staff can fix up beats no issue at all.
	 *
	 * @returns the URL (or null if both attempts failed) and who was actually assigned
	 */
	private async file(repo: Repository, issue: Issue): Promise<{ url: string | null; assignees: string[] }> {
		const assignees = issue.assignees ?? [];
		let url = await this.gha.makeIssue(repo.id, issue);
		if (url !== null) {
			Log.info("IssueFiler::file() - CREATED " + repo.id + "; assigned: [" + assignees.join(", ") + "]; " + url);
			return { url: url, assignees: assignees };
		}
		if (assignees.length === 0) {
			Log.warn("IssueFiler::file() - FAILED " + repo.id);
			return { url: null, assignees: [] };
		}
		Log.warn("IssueFiler::file() - " + repo.id + " rejected with assignees [" + assignees.join(", ") + "]; retrying unassigned");
		await Util.delay(IssueFiler.CREATE_PAUSE_MS);
		url = await this.gha.makeIssue(repo.id, { ...issue, assignees: [] });
		if (url !== null) {
			Log.warn("IssueFiler::file() - CREATED UNASSIGNED " + repo.id + "; " + url);
			return { url: url, assignees: [] };
		}
		Log.warn("IssueFiler::file() - FAILED " + repo.id + " (with and without assignees)");
		return { url: null, assignees: [] };
	}

	/**
	 * The repositories for the deliverable, narrowed by --repo and by provisioning status.
	 */
	private async selectRepos(): Promise<Repository[]> {
		const rc = new RepositoryController();
		const all = await rc.getAllRepos();
		const selected: Repository[] = [];
		for (const repo of all) {
			if (repo.delivId !== this.opts.delivId) {
				continue;
			}
			if (this.opts.repoIds.length > 0 && this.opts.repoIds.indexOf(repo.id) < 0) {
				continue;
			}
			if (repo.gitHubStatus === RepoStatus.NOT_CREATED) {
				Log.info("IssueFiler::selectRepos() - skipping " + repo.id + "; not on GitHub");
				continue;
			}
			if (repo.gitHubStatus !== RepoStatus.RELEASED && this.opts.anyStatus !== true) {
				Log.info("IssueFiler::selectRepos() - skipping " + repo.id + "; status: " + repo.gitHubStatus + " (use --any-status to include)");
				continue;
			}
			selected.push(repo);
		}
		selected.sort((a, b) => a.id.localeCompare(b.id));
		for (const wanted of this.opts.repoIds) {
			if (selected.find((r) => r.id === wanted) === undefined) {
				Log.warn("IssueFiler::selectRepos() - --repo " + wanted + " is not a provisioned " + this.opts.delivId + " repository; ignored");
			}
		}
		return selected;
	}

	/**
	 * GitHub ids of the students on the repository's teams. Only students on a released repository
	 * can be assigned (assignment needs push access, which the release grants), so an unreleased
	 * repository gets none.
	 */
	private async assigneesFor(repo: Repository): Promise<string[]> {
		if (repo.gitHubStatus !== RepoStatus.RELEASED) {
			Log.warn("IssueFiler::assigneesFor( " + repo.id + " ) - not released; students cannot be assigned yet");
			return [];
		}
		const ids: string[] = [];
		for (const teamId of repo.teamIds) {
			const team = await this.dc.getTeam(teamId);
			if (team === null) {
				Log.warn("IssueFiler::assigneesFor( " + repo.id + " ) - team " + teamId + " not found");
				continue;
			}
			for (const personId of team.personIds) {
				const person = await this.dc.getPerson(personId);
				if (person === null || typeof person.githubId !== "string" || person.githubId.length === 0) {
					Log.warn("IssueFiler::assigneesFor( " + repo.id + " ) - person " + personId + " has no GitHub id");
					continue;
				}
				if (ids.indexOf(person.githubId) < 0) {
					ids.push(person.githubId);
				}
			}
		}
		if (ids.length > IssueFiler.MAX_ASSIGNEES) {
			Log.warn(
				"IssueFiler::assigneesFor( " +
					repo.id +
					" ) - " +
					ids.length +
					" students; GitHub allows " +
					IssueFiler.MAX_ASSIGNEES +
					", assigning the first " +
					IssueFiler.MAX_ASSIGNEES
			);
			return ids.slice(0, IssueFiler.MAX_ASSIGNEES);
		}
		return ids;
	}

	/**
	 * The URL of an issue with this title and marker label already on the repository, or null.
	 */
	private async existingIssue(repo: Repository): Promise<string | null> {
		const marker = this.opts.labels[0];
		const issues = await this.gha.listIssues(repo.id);
		for (const issue of issues) {
			if (issue.title === this.opts.title && (typeof marker === "undefined" || issue.labels.indexOf(marker) >= 0)) {
				return issue.url;
			}
		}
		return null;
	}

	private summarise(report: IssueFilerReport): void {
		const mode = this.opts.live === true ? "LIVE" : "DRY RUN";
		Log.info("IssueFiler::summarise() - " + mode + "; deliv: " + this.opts.delivId + "; title: " + this.opts.title);
		for (const p of report.planned) {
			Log.info("IssueFiler::summarise() -   would file on " + p.repoId + " -> [" + p.assignees.join(", ") + "]");
		}
		for (const c of report.created) {
			const who = c.assignees.length > 0 ? "[" + c.assignees.join(", ") + "]" : "UNASSIGNED";
			Log.info("IssueFiler::summarise() -   filed on " + c.repoId + " -> " + who + "; " + c.url);
		}
		for (const s of report.skipped) {
			Log.info("IssueFiler::summarise() -   skipped " + s.repoId + "; " + s.reason);
		}
		for (const f of report.failed) {
			Log.warn("IssueFiler::summarise() -   FAILED " + f.repoId + "; " + f.reason);
		}
		Log.info(
			"IssueFiler::summarise() - planned: " +
				report.planned.length +
				"; created: " +
				report.created.length +
				"; skipped: " +
				report.skipped.length +
				"; failed: " +
				report.failed.length
		);
		const unassigned = report.created.filter((c) => c.assignees.length === 0 && this.opts.assign === true);
		if (unassigned.length > 0) {
			Log.warn(
				"IssueFiler::summarise() - " +
					unassigned.length +
					" issue(s) could not be assigned; assign them by hand: " +
					unassigned.map((c) => c.repoId).join(", ")
			);
		}
		if (this.opts.live !== true && report.planned.length > 0) {
			Log.info("IssueFiler::summarise() - nothing was written; add --live to file the issues above");
		}
	}

	/**
	 * One row per repository considered, as a record of what was sent where.
	 */
	private writeReport(report: IssueFilerReport): void {
		const rows: string[][] = [["repoId", "outcome", "url", "assignees"]];
		for (const p of report.planned) {
			rows.push([p.repoId, "planned", "", p.assignees.join(" ")]);
		}
		for (const c of report.created) {
			const outcome = c.assignees.length > 0 || this.opts.assign !== true ? "created" : "created-unassigned";
			rows.push([c.repoId, outcome, c.url, c.assignees.join(" ")]);
		}
		for (const s of report.skipped) {
			rows.push([s.repoId, "skipped", s.reason.replace(/^already filed: /, ""), ""]);
		}
		for (const f of report.failed) {
			rows.push([f.repoId, "failed", "", ""]);
		}
		const csv = rows.map((r) => r.map(IssueFiler.csvField).join(",")).join("\n") + "\n";
		fs.writeFileSync(this.opts.reportPath, csv);
		Log.info("IssueFiler::writeReport() - " + (rows.length - 1) + " rows written to " + this.opts.reportPath);
	}

	private static csvField(value: string): string {
		return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
	}

	/**
	 * Reads the command line. Exits with usage on anything missing.
	 */
	public static parseArgs(argv: string[]): IssueFilerOptions {
		const opts: IssueFilerOptions = {
			delivId: "",
			title: "",
			body: "",
			labels: [],
			assign: true,
			repoIds: [],
			anyStatus: false,
			reportPath: null,
			live: false,
		};
		let bodyPath: string | null = null;
		for (let i = 0; i < argv.length; i++) {
			const arg = argv[i];
			const value = () => {
				const v = argv[i + 1];
				if (typeof v === "undefined" || v.startsWith("--")) {
					throw new Error(arg + " needs a value");
				}
				i++;
				return v;
			};
			switch (arg) {
				case "--deliv":
					opts.delivId = value();
					break;
				case "--title":
					opts.title = value();
					break;
				case "--body":
					bodyPath = value();
					break;
				case "--label":
					opts.labels.push(value());
					break;
				case "--repo":
					opts.repoIds.push(value());
					break;
				case "--report":
					opts.reportPath = value();
					break;
				case "--no-assign":
					opts.assign = false;
					break;
				case "--any-status":
					opts.anyStatus = true;
					break;
				case "--live":
					opts.live = true;
					break;
				default:
					throw new Error("unknown argument: " + arg);
			}
		}
		if (opts.delivId === "" || opts.title === "" || bodyPath === null) {
			throw new Error("--deliv, --title and --body are all required");
		}
		opts.body = fs.readFileSync(bodyPath, "utf8");
		if (opts.body.trim() === "") {
			throw new Error("body file is empty: " + bodyPath);
		}
		if (opts.labels.length === 0) {
			opts.labels.push("classy");
		}
		return opts;
	}
}

export interface IssueFilerOptions {
	delivId: string;
	title: string;
	body: string;
	labels: string[];
	assign: boolean;
	repoIds: string[];
	anyStatus: boolean;
	reportPath: string | null;
	live: boolean;
}

export interface IssueFilerReport {
	planned: Array<{ repoId: string; assignees: string[] }>;
	/**
	 * assignees is who was actually assigned: empty when assignment was off, or when GitHub
	 * refused the assignees and the issue was filed unassigned instead.
	 */
	created: Array<{ repoId: string; assignees: string[]; url: string }>;
	skipped: Array<{ repoId: string; reason: string }>;
	failed: Array<{ repoId: string; reason: string }>;
}

if (require.main === module) {
	let opts: IssueFilerOptions;
	try {
		opts = IssueFiler.parseArgs(process.argv.slice(2));
	} catch (err) {
		Log.error("IssueFiler - " + err.message);
		Log.error(
			"usage: IssueFiler.js --deliv <id> --title <text> --body <file.md> [--label <name>]... [--repo <id>]... [--no-assign] [--any-status] [--report <file.csv>] [--live]"
		);
		process.exit(2);
	}
	new IssueFiler(opts)
		.process()
		.then(function () {
			Log.info("IssueFiler::process() - complete");
			process.exit();
		})
		.catch(function (err) {
			Log.error("IssueFiler::process() - ERROR: " + err.message);
			process.exit(-1);
		});
}
