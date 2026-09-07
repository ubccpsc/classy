import { expect } from "chai";
import "mocha";

import Config from "@common/Config";
import Log from "@common/Log";

import Util from "@common/Util";
import "@common/GlobalSpec";

import { GitHubUtil } from "@autotest/github/GitHubUtil";

describe("GitHubUtil", () => {
	Config.getInstance();

	before(() => {
		Log.test("GitHubUtilSpec::before");
	});

	after(() => {
		Log.test("GitHubUtilSpec::after");
	});

	it("Should be able to correctly parse deliv ids from a commit comment.", () => {
		let actual;

		actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #d1", ["d1", "d2", "project"]);
		expect(actual).to.equal("d1");

		actual = GitHubUtil.parseDeliverableFromComment("@ubcbot d1", ["d1", "d2", "project"]);
		expect(actual).to.be.null;

		actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #d101", ["d101", "d2", "project"]);
		expect(actual).to.equal("d101");

		actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #a1", ["d1", "d2", "project"]);
		expect(actual).to.be.null;

		actual = GitHubUtil.parseDeliverableFromComment("@ubcbot #a1", ["d1", "d2", "project", "a1"]);
		expect(actual).to.equal("a1");
	});

	it("Should be able to find extra commands from a commit comment.", () => {
		let actual;

		actual = GitHubUtil.parseCommandsFromComment("@ubcbot #d1 #verbose");
		expect(actual).to.deep.equal(["#d1", "#verbose"]);

		actual = GitHubUtil.parseCommandsFromComment("@ubcbot d1 verbose ## # ###");
		expect(actual).to.deep.equal([]);

		actual = GitHubUtil.parseCommandsFromComment("@ubcbot #d101 #silent #force #verbose");
		expect(actual).to.deep.equal(["#d101", "#silent", "#force", "#verbose"]);

		actual = GitHubUtil.parseCommandsFromComment("@ubcbot #force. #verbose. #force #silent\n");
		expect(actual).to.deep.equal(["#force", "#verbose", "#silent"]);

		actual = GitHubUtil.parseCommandsFromComment("@ubcbot #forcefoo");
		expect(actual).to.deep.equal(["#forcefoo"]);
	});

	it("Should be able to correctly create human durations.", () => {
		const now = Date.now();
		const oneSecond = now - 1000;
		const twoSeconds = now - 1000 * 2;
		const oneMinute = now - 60 * 1000;
		const oneMinuteHalf = now - 90 * 1000;
		const halfHour = now - 30 * 60 * 1000;
		const halfHourSecond = now - 30 * 60 * 1000 - 1000;
		const halfHourSeconds = now - 30 * 60 * 1000 - 2000;
		const oneHour = now - 60 * 60 * 1000;
		const oneHourHalf = now - 90 * 60 * 1000;
		const twoDays = now - 48 * 60 * 60 * 1000;
		const sixHundredHours = now - 600 * 60 * 60 * 1000;

		expect(Util.tookHuman(oneSecond)).to.equal("1 second");
		expect(Util.tookHuman(twoSeconds)).to.equal("2 seconds");
		expect(Util.tookHuman(oneMinute)).to.equal("1 minute");
		expect(Util.tookHuman(oneMinuteHalf)).to.equal("1 minute and 30 seconds");
		expect(Util.tookHuman(halfHour)).to.equal("30 minutes");
		expect(Util.tookHuman(halfHourSecond)).to.equal("30 minutes and 1 second");
		expect(Util.tookHuman(halfHourSeconds)).to.equal("30 minutes and 2 seconds");
		expect(Util.tookHuman(oneHour)).to.equal("1 hour");
		expect(Util.tookHuman(oneHourHalf)).to.equal("1 hour and 30 minutes");
		expect(Util.tookHuman(twoDays)).to.equal("48 hours");
		expect(Util.tookHuman(sixHundredHours)).to.equal("600 hours");
	});

	/**
	 * The URL parsers, and their fallbacks.
	 *
	 * Both are total by design: given something they cannot parse they hand the input back rather
	 * than throwing, because they sit on the webhook path where an exception drops a student's
	 * push. That fallback is the half that was never exercised.
	 */
	describe("URL parsing", () => {
		const COMMIT_URL =
			"https://github.students.cs.ubc.ca/CPSC310-2022W-T1/project_team094/commits/47046cae35a31083761788d9fce80e85ca77f6d5/comments";

		it("Should pull the repo name out of a commit URL.", () => {
			expect(GitHubUtil.commitURLtoRepoName("https://github.example/org/project_team094/commit/abc123")).to.equal("project_team094");
		});

		it("Should hand back a URL it cannot parse, rather than throwing.", () => {
			// no "/commit" segment: nothing to find, so the input is the best answer available
			expect(GitHubUtil.commitURLtoRepoName("https://github.example/org/project_team094")).to.equal(
				"https://github.example/org/project_team094"
			);
			expect(GitHubUtil.commitURLtoRepoName("")).to.equal("");
		});

		it("Should pull a shortened SHA out of a commit comment URL.", () => {
			const sha = GitHubUtil.commitURLtoSHA(COMMIT_URL);
			expect(sha).to.equal(Util.shaHuman("47046cae35a31083761788d9fce80e85ca77f6d5"));
		});

		it("Should hand back a SHA URL it cannot parse, rather than throwing.", () => {
			// has /commits/ but no /comments, so the bounds the parser needs are not both there
			const partial = "https://github.example/org/repo/commits/47046cae35a31083761788d9fce80e85ca77f6d5";
			expect(GitHubUtil.commitURLtoSHA(partial)).to.equal(partial);
			expect(GitHubUtil.commitURLtoSHA("")).to.equal("");
		});

		it("Should recognise both main and master as the default branch.", () => {
			// courses differ on which they use, and a wrong answer here changes whether a push is
			// treated as being on the default branch
			expect(GitHubUtil.isMain("refs/heads/main")).to.be.true;
			expect(GitHubUtil.isMain("refs/heads/master")).to.be.true;

			expect(GitHubUtil.isMain("refs/heads/d1")).to.be.false;
			expect(GitHubUtil.isMain("main"), "a bare branch name is not a ref").to.be.false;
			expect(GitHubUtil.isMain("refs/heads/mainline"), "must not match on prefix").to.be.false;
			expect(GitHubUtil.isMain(""), "an empty ref is not the default branch").to.be.false;
		});
	});

	/**
	 * issue_comment webhooks, which AutoTest deliberately does not act on.
	 *
	 * The guard that matters is the bot mention: without it AutoTest would reply to every comment
	 * on every issue and pull request in the org. That branch was entirely uncovered.
	 *
	 * postMarkdownToGithub is swapped out so nothing reaches the network and the decision itself
	 * can be observed -- which is the only externally visible effect this function has.
	 */
	describe("issue comments", () => {
		let posted: Array<{ url: string; message: string }> = [];
		let realPost: any = null;

		beforeEach(() => {
			posted = [];
			realPost = (GitHubUtil as any).postMarkdownToGithub;
			(GitHubUtil as any).postMarkdownToGithub = async (message: any) => {
				posted.push(message);
				return true;
			};
		});

		afterEach(() => {
			(GitHubUtil as any).postMarkdownToGithub = realPost;
		});

		function issuePayload(body: string, extra: any = {}): any {
			return {
				comment: { body: body },
				issue: Object.assign({ comments_url: "https://github.example/api/issues/1/comments" }, extra),
			};
		}

		const bot = "@" + Config.getInstance().getProp("botName" as any);

		it("Should say nothing when the bot is not mentioned.", async () => {
			// the spam guard: every issue comment in the org arrives here
			await GitHubUtil.processIssueComment(issuePayload("looks good to me"));
			expect(posted, "AutoTest must not reply to comments that do not address it").to.have.length(0);
		});

		it("Should explain itself when mentioned on a pull request.", async () => {
			await GitHubUtil.processIssueComment(issuePayload(bot + " #d1", { pull_request: { url: "https://github.example/pr/1" } }));

			expect(posted).to.have.length(1);
			expect(posted[0].message).to.contain("pull requests");
		});

		it("Should explain itself when mentioned on an issue.", async () => {
			await GitHubUtil.processIssueComment(issuePayload(bot + " #d1"));

			expect(posted).to.have.length(1);
			expect(posted[0].message).to.contain("issues");
		});

		it("Should not throw on a payload with no comment or issue at all.", async () => {
			// webhooks arrive unattended; an unrecognised shape must not throw out of the handler
			let ex = null;
			try {
				await GitHubUtil.processIssueComment({});
				await GitHubUtil.processIssueComment(null);
			} catch (err) {
				ex = err;
			}
			expect(ex).to.be.null;
			expect(posted).to.have.length(0);
		});
	});
});
