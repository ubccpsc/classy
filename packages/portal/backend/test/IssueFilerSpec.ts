import { expect } from "chai";
import "mocha";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import "@common/GlobalSpec"; // load first

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { GitIssueTuple, Issue } from "@backend/controllers/GitHubController";
import { RepoStatus } from "@backend/Types";
import { TestHarness } from "@common/TestHarness";
import { IssueFiler, IssueFilerOptions } from "../src-util/IssueFiler";
import { TestGitHubActions } from "./controllers/TestGitHubActions";

/**
 * Records what the script asks GitHub to do instead of doing it.
 */
class RecordingGitHubActions extends TestGitHubActions {
	public made: Array<{ repoId: string; issue: Issue }> = [];
	public existing: { [repoId: string]: GitIssueTuple[] } = {};
	/**
	 * GitHub logins that "lack access": an issue naming any of them is refused, as GitHub does.
	 */
	public badAssignees: string[] = [];
	public refuseAll = false;

	public async makeIssue(repoId: string, issue: Issue): Promise<string | null> {
		this.made.push({ repoId, issue });
		if (this.refuseAll === true || (issue.assignees ?? []).some((a) => this.badAssignees.indexOf(a) >= 0)) {
			return null;
		}
		return "https://github.test/" + repoId + "/issues/" + this.made.length;
	}

	public async listIssues(repoId: string): Promise<GitIssueTuple[]> {
		return this.existing[repoId] ?? [];
	}
}

describe("IssueFiler (src-util)", function () {
	const dc = DatabaseController.getInstance();
	let bodyPath: string;

	before(async function () {
		await TestHarness.prepareAll();
		// REPONAME1 (TEAMNAME1: USER1, USER2) is released; REPONAME2 (TEAMNAME2: USER1, USER3) is not yet
		const released = await dc.getRepository(TestHarness.REPONAME1);
		released.gitHubStatus = RepoStatus.RELEASED;
		await dc.writeRepository(released);
		const ready = await dc.getRepository(TestHarness.REPONAME2);
		ready.gitHubStatus = RepoStatus.READY;
		await dc.writeRepository(ready);

		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "issuefiler-"));
		bodyPath = path.join(dir, "body.md");
		fs.writeFileSync(bodyPath, "# Feedback for {{repoId}}\n\nSee the *rubric*.\n");
	});

	function opts(overrides: Partial<IssueFilerOptions> = {}): IssueFilerOptions {
		return IssueFiler.parseArgs(["--deliv", TestHarness.DELIVID1, "--title", "D1 feedback", "--body", bodyPath, ...flags(overrides)]);
	}

	function flags(o: Partial<IssueFilerOptions>): string[] {
		const f: string[] = [];
		if (o.live === true) f.push("--live");
		if (o.anyStatus === true) f.push("--any-status");
		if (o.assign === false) f.push("--no-assign");
		if (typeof o.reportPath === "string") f.push("--report", o.reportPath);
		for (const l of o.labels ?? []) f.push("--label", l);
		for (const r of o.repoIds ?? []) f.push("--repo", r);
		return f;
	}

	it("Should require the deliverable, title and body.", function () {
		expect(() => IssueFiler.parseArgs([])).to.throw("required");
		expect(() => IssueFiler.parseArgs(["--deliv", "d1", "--title", "t"])).to.throw("required");
		expect(() => IssueFiler.parseArgs(["--deliv"])).to.throw("needs a value");
		expect(() => IssueFiler.parseArgs(["--bogus"])).to.throw("unknown argument");
	});

	it("Should default to a dry run with the classy label and assignment on.", function () {
		const o = opts();
		expect(o.live).to.be.false;
		expect(o.assign).to.be.true;
		expect(o.labels).to.deep.equal(["classy"]);
		expect(o.body).to.contain("{{repoId}}");
		expect(opts({ labels: ["a", "b"] }).labels).to.deep.equal(["a", "b"]);
	});

	it("Should only report in a dry run, on released repos, assigned to the team.", async function () {
		const gha = new RecordingGitHubActions();
		const report = await new IssueFiler(opts(), gha).process();

		expect(gha.made, "dry run must not create anything").to.have.length(0);
		expect(report.created).to.have.length(0);
		expect(report.planned.map((p) => p.repoId)).to.deep.equal([TestHarness.REPONAME1]);
		expect(report.planned[0].assignees).to.have.members([TestHarness.USER1.github, TestHarness.USER2.github]);
	});

	it("Should include unreleased repos with --any-status, but not assign them.", async function () {
		const gha = new RecordingGitHubActions();
		const report = await new IssueFiler(opts({ anyStatus: true }), gha).process();

		expect(report.planned.map((p) => p.repoId)).to.deep.equal([TestHarness.REPONAME1, TestHarness.REPONAME2]);
		expect(report.planned[1].assignees).to.deep.equal([]);
	});

	it("Should narrow to --repo and honour --no-assign.", async function () {
		const gha = new RecordingGitHubActions();
		const report = await new IssueFiler(opts({ repoIds: [TestHarness.REPONAME1, "nope"], assign: false }), gha).process();

		expect(report.planned.map((p) => p.repoId)).to.deep.equal([TestHarness.REPONAME1]);
		expect(report.planned[0].assignees).to.deep.equal([]);
	});

	it("Should file the issue with --live, and skip it on a rerun.", async function () {
		const gha = new RecordingGitHubActions();
		const first = await new IssueFiler(opts({ live: true }), gha).process();

		expect(first.created.map((c) => c.repoId)).to.deep.equal([TestHarness.REPONAME1]);
		expect(first.created[0].url).to.equal("https://github.test/" + TestHarness.REPONAME1 + "/issues/1");
		expect(gha.made).to.have.length(1);
		const issue = gha.made[0].issue;
		expect(issue.title).to.equal("D1 feedback");
		expect(issue.body).to.equal("# Feedback for " + TestHarness.REPONAME1 + "\n\nSee the *rubric*.\n");
		expect(issue.labels).to.deep.equal(["classy"]);
		expect(issue.assignees).to.have.members([TestHarness.USER1.github, TestHarness.USER2.github]);

		// GitHub now has the issue; the rerun must notice and not file a second one
		gha.existing[TestHarness.REPONAME1] = [{ number: 1, title: "D1 feedback", state: "open", labels: ["classy"], url: "http://x/1" }];
		const second = await new IssueFiler(opts({ live: true }), gha).process();
		expect(gha.made, "no second issue").to.have.length(1);
		expect(second.created).to.have.length(0);
		expect(second.skipped.map((s) => s.repoId)).to.deep.equal([TestHarness.REPONAME1]);

		// a same-titled issue without the marker label is someone else's; it does not block
		gha.existing[TestHarness.REPONAME1][0].labels = [];
		const third = await new IssueFiler(opts({ live: true }), gha).process();
		expect(third.created).to.have.length(1);
	}).timeout(10000);

	it("Should file unassigned when GitHub refuses the assignees, and fail when it refuses outright.", async function () {
		const gha = new RecordingGitHubActions();
		gha.badAssignees = [TestHarness.USER2.github]; // say user2 changed their CWL and the id is stale
		const report = await new IssueFiler(opts({ live: true }), gha).process();

		expect(gha.made, "assigned attempt then unassigned retry").to.have.length(2);
		expect(gha.made[0].issue.assignees).to.have.members([TestHarness.USER1.github, TestHarness.USER2.github]);
		expect(gha.made[1].issue.assignees).to.deep.equal([]);
		expect(gha.made[1].issue.title, "retry is the same issue").to.equal(gha.made[0].issue.title);
		expect(gha.made[1].issue.body).to.equal(gha.made[0].issue.body);
		expect(report.created).to.have.length(1);
		expect(report.created[0].assignees, "reported as unassigned").to.deep.equal([]);
		expect(report.created[0].url).to.be.a("string");
		expect(report.failed).to.have.length(0);

		const broken = new RecordingGitHubActions();
		broken.refuseAll = true;
		const failed = await new IssueFiler(opts({ live: true }), broken).process();
		expect(broken.made, "one retry, not more").to.have.length(2);
		expect(failed.created).to.have.length(0);
		expect(failed.failed.map((f) => f.repoId)).to.deep.equal([TestHarness.REPONAME1]);

		// no assignees requested, so a refusal is not retried
		const plain = new RecordingGitHubActions();
		plain.refuseAll = true;
		await new IssueFiler(opts({ live: true, assign: false }), plain).process();
		expect(plain.made).to.have.length(1);
	}).timeout(15000);

	it("Should write a CSV report of every repository considered.", async function () {
		const reportPath = path.join(path.dirname(bodyPath), "report.csv");
		const gha = new RecordingGitHubActions();
		gha.existing[TestHarness.REPONAME2] = [{ number: 7, title: "D1 feedback", state: "closed", labels: ["classy"], url: "http://x/7" }];
		const report = await new IssueFiler(opts({ live: true, anyStatus: true, reportPath: reportPath }), gha).process();
		expect(report.created).to.have.length(1);
		expect(report.skipped).to.have.length(1);

		const lines = fs.readFileSync(reportPath, "utf8").trim().split("\n");
		expect(lines[0]).to.equal("repoId,outcome,url,assignees");
		expect(lines).to.have.length(3);
		const created = lines.find((l) => l.startsWith(TestHarness.REPONAME1 + ","));
		expect(created).to.contain(",created,https://github.test/" + TestHarness.REPONAME1 + "/issues/1,");
		expect(created).to.contain(TestHarness.USER1.github);
		const skipped = lines.find((l) => l.startsWith(TestHarness.REPONAME2 + ","));
		expect(skipped).to.equal(TestHarness.REPONAME2 + ",skipped,http://x/7,");
	}).timeout(10000);
});
