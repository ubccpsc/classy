import { expect } from "chai";
import * as fs from "fs";
import "mocha";

import "@common/GlobalSpec"; // load first
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import Util from "@common/Util";
import { TestHarness } from "@common/TestHarness";
import { CommitTarget } from "@common/types/ContainerTypes";

import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { PersonController } from "@backend/controllers/PersonController";
import BackendServer from "@backend/server/BackendServer";
import { Deliverable, Person } from "@backend/Types";

import { MockClassPortal } from "@autotest/autotest/mocks/MockClassPortal";
import { GitHubUtil } from "@autotest/github/GitHubUtil";

/* tslint:disable:max-line-length */
describe("GitHub Event Parser", () => {
	Config.getInstance();

	const PERSONID = "rthse2ID";
	const GITHUBID = "rthse2";
	const TIMEOUT = 1000;

	let backend: BackendServer = null;
	before(async function () {
		Log.test("GitHubEventParserSpec::before() - start");

		const ci = process.env.CI;
		if (typeof ci !== "undefined" && Util.toBoolean(ci) === true) {
			Log.test("GitHubEventParserSpec::before() - running in CI; using https");
			// CI uses https and certificates, but local testing does not
			backend = new BackendServer(true);
		} else {
			Log.test("GitHubEventParserSpec::before() - not running in CI; using http");
			backend = new BackendServer(false);
		}

		await backend.start();

		const pc = new PersonController();
		const id = PERSONID;
		const p: Person = {
			id: id,
			csId: id,
			githubId: GITHUBID,
			studentNumber: null,

			fName: "f" + id,
			lName: "l" + id,
			kind: null,
			URL: null,

			labId: null,

			custom: {},
		};
		// person needs to exist so we can do GitHubId <-> PersonId mapping
		await pc.createPerson(p);

		// deliverable needs to exist so we can match it in the comment parser
		const dc = new DeliverablesController();

		const deliv: Deliverable = {
			id: "d4",

			URL: "http://NOTSET",
			openTimestamp: new Date(1400000000000).getTime(),
			closeTimestamp: new Date(1500000000000).getTime(),
			gradesReleased: false,

			shouldProvision: true,
			importURL: Config.getInstance().getProp(ConfigKey.githubHost) + "/classytest/" + TestHarness.REPONAMEREAL_POSTTEST + ".git",
			teamMinSize: 2,
			teamMaxSize: 2,
			teamSameLab: true,
			teamStudentsForm: true,
			teamPrefix: "t",
			repoPrefix: "",

			visibleToStudents: true,

			lateAutoTest: false,
			shouldAutoTest: true,
			autotest: {
				dockerImage: "testImage",
				studentDelay: 60 * 60 * 12, // 12h
				maxExecTime: 300,
				regressionDelivIds: [],
				custom: {},
			},

			rubric: {},
			custom: {},
		};

		await dc.saveDeliverable(deliv);

		Log.test("GitHubEventParserSpec::before() - done");
	});

	after(async function () {
		Log.test("GitHubEventParserSpec::after() - start");
		await backend.stop();
		Log.test("GitHubEventParserSpec::after() - done");
	});

	it("Should fail gracefully with a bad push.", async () => {
		let actual = null;
		let ex = null;
		try {
			actual = await GitHubUtil.processPush(null, new MockClassPortal());
		} catch (err) {
			ex = err;
		}
		expect(actual).to.be.null;
		expect(ex).to.not.be.null;

		actual = null;
		ex = null;
		try {
			actual = await GitHubUtil.processPush(undefined, new MockClassPortal());
		} catch (err) {
			ex = err;
		}
		expect(actual).to.be.null;
		expect(ex).to.not.be.null;
	});

	it("Should be able to parse a standard push.", async () => {
		const content = readFile("push_master-branch.json");
		const actual = await GitHubUtil.processPush(JSON.parse(content), new MockClassPortal());
		// Log.test(JSON.stringify(actual));

		const expected: CommitTarget = {
			delivId: "d1",
			repoId: "d1_project9999",
			cloneURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
			commitSHA: "bbe3980fff47b7d6a921e9f89c6727bea639589c",
			commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
			postbackURL:
				"https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
			timestamp: 1516324553000,
			botMentioned: false,
			adminRequest: false,
			shouldPromote: false,
			personId: null,
			orgId: "CPSC310-2017W-T2",
			kind: "push",
			ref: "refs/heads/master",
		};
		delete expected.timestamp;
		delete actual.timestamp;
		expect(actual).to.deep.equal(expected);
	});

	it("Should be able to parse a push that created a new branch.", async () => {
		const content = readFile("push_create-new-branch.json");
		const actual = await GitHubUtil.processPush(JSON.parse(content), new MockClassPortal());

		const expected: CommitTarget = {
			delivId: "d1",
			cloneURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
			commitSHA: "6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
			commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
			postbackURL:
				"https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/6da86d2bdfe8fec9120b60e8d7b71c66077489b6/comments",
			repoId: "d1_project9999",
			timestamp: 1516322017000,
			botMentioned: false,
			adminRequest: false,
			shouldPromote: false,
			personId: null,
			orgId: "CPSC310-2017W-T2",
			kind: "push",
			ref: "refs/heads/test2",
		};
		delete expected.timestamp;
		delete actual.timestamp;
		expect(actual).to.deep.equal(expected);
	});

	it("Should be able to parse a push that deleted an existing branch.", async () => {
		const content = readFile("push_delete-branch.json");
		const actual = await GitHubUtil.processPush(JSON.parse(content), new MockClassPortal());

		const expected: any = null;
		expect(actual).to.equal(expected); // nothing to do when a branch is deleted
	});

	it("Should be able to parse a push to a branch.", async function () {
		const content = readFile("push_other-branch.json");
		const actual = await GitHubUtil.processPush(JSON.parse(content), new MockClassPortal());

		const expected: CommitTarget = {
			delivId: "d1",
			commitSHA: "d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
			cloneURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
			commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
			postbackURL:
				"https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
			repoId: "d1_project9999",
			timestamp: 1516324487000,
			botMentioned: false,
			adminRequest: false,
			shouldPromote: false,
			personId: null,
			orgId: "CPSC310-2017W-T2",
			kind: "push",
			ref: "refs/heads/test2",
		};

		delete expected.timestamp;
		delete actual.timestamp;
		expect(actual).to.deep.equal(expected);
	});

	it("Should be able to parse a comment on a master commit with one deliverable and a mention.", async function () {
		const content = JSON.parse(readFile("comment_master_bot_one-deliv.json"));
		const botname = Config.getInstance().getProp(ConfigKey.botName);
		content.comment.body = content.comment.body.replace("ubcbot", botname);
		const actual = await GitHubUtil.processComment(content);
		Log.test(JSON.stringify(actual));

		const expected: CommitTarget = {
			botMentioned: true,
			commitSHA: "bbe3980fff47b7d6a921e9f89c6727bea639589c",
			commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
			delivId: "d4",
			repoId: "d1_project9999",
			postbackURL:
				"https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
			timestamp: 1516324753000,
			adminRequest: false,
			shouldPromote: false,
			personId: PERSONID,
			orgId: "CPSC310-2017W-T2",
			kind: "standard",
			cloneURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
			flags: ["#d4"],
		};

		delete expected.timestamp;
		delete actual.timestamp;
		expect(expected).to.deep.equal(actual);
	}).timeout(TIMEOUT * 10);

	it("Should be able to parse a comment on a master commit with multiple deliverables and a mention.", async () => {
		const content = JSON.parse(readFile("comment_master_bot_two-deliv.json"));
		const botname = Config.getInstance().getProp(ConfigKey.botName);
		content.comment.body = content.comment.body.replace("ubcbot", botname);
		const actual = await GitHubUtil.processComment(content);
		Log.test(JSON.stringify(actual));

		const expected: CommitTarget = {
			botMentioned: true,
			commitSHA: "bbe3980fff47b7d6a921e9f89c6727bea639589c",
			commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/bbe3980fff47b7d6a921e9f89c6727bea639589c",
			postbackURL:
				"https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/bbe3980fff47b7d6a921e9f89c6727bea639589c/comments",
			adminRequest: false,
			shouldPromote: false,
			personId: PERSONID,
			orgId: "CPSC310-2017W-T2",
			kind: "standard",
			repoId: "d1_project9999",
			delivId: "d4",
			timestamp: 1516324833000,
			cloneURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
			flags: ["#d7", "#d4"],
		};

		delete expected.timestamp;
		delete actual.timestamp;
		expect(expected).to.deep.equal(actual);
	}).timeout(TIMEOUT * 10);

	it("Should be able to parse a comment on a master commit with no deliverables and no mention.", async () => {
		const content = readFile("comment_master_no-bot_no-deliv.json");
		const actual = await GitHubUtil.processComment(JSON.parse(content));
		Log.test(JSON.stringify(actual));

		const expected: CommitTarget = {
			botMentioned: false,
			commitSHA: "6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
			commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/6da86d2bdfe8fec9120b60e8d7b71c66077489b6",
			postbackURL:
				"https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/6da86d2bdfe8fec9120b60e8d7b71c66077489b6/comments",
			adminRequest: false,
			shouldPromote: false,
			personId: PERSONID,
			orgId: "CPSC310-2017W-T2",
			kind: "standard",
			repoId: "d1_project9999",
			delivId: null,
			timestamp: 1516320674000,
			cloneURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
			flags: [],
		};

		delete expected.timestamp;
		delete actual.timestamp;
		expect(expected).to.deep.equal(actual);
	}).timeout(TIMEOUT * 10);

	it("Should be able to parse a comment on another branch with one deliverable and a mention.", async () => {
		const content = JSON.parse(readFile("comment_other-branch_bot_one-deliv.json"));
		const botname = Config.getInstance().getProp(ConfigKey.botName);
		content.comment.body = content.comment.body.replace("ubcbot", botname);
		const actual = await GitHubUtil.processComment(content);
		Log.test(JSON.stringify(actual));

		const expected: CommitTarget = {
			botMentioned: true,
			commitSHA: "d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
			commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999/commit/d5f2203cfa1ae43a45932511ce39b2368f1c72ed",
			postbackURL:
				"https://github.ugrad.cs.ubc.ca/api/v3/repos/CPSC310-2017W-T2/d1_project9999/commits/d5f2203cfa1ae43a45932511ce39b2368f1c72ed/comments",
			adminRequest: false,
			shouldPromote: false,
			personId: PERSONID,
			orgId: "CPSC310-2017W-T2",
			kind: "standard",
			repoId: "d1_project9999",
			delivId: "d4",
			timestamp: 1516324931000,
			cloneURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_project9999.git",
			flags: ["#d4"],
		};

		delete expected.timestamp;
		delete actual.timestamp;
		expect(expected).to.deep.equal(actual);
	}).timeout(TIMEOUT * 10);

	function readFile(fName: string): string {
		// test root folders depend on the environment executing the test case
		if (TestHarness.isCI() === true) {
			// ./test/... works on CI
			return fs.readFileSync("./test/githubEvents/" + fName, "utf8");
		} else {
			// ./packages/... works on dev machine
			return fs.readFileSync("./packages/autotest/test/githubEvents/" + fName, "utf8");
		}
	}
});
