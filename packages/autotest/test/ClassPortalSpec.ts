import { expect } from "chai";
import "mocha";

import "@common/GlobalSpec";

import { ClassPortal, IClassPortal } from "@autotest/autotest/ClassPortal";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import BackendServer from "@backend/server/BackendServer";
import { Course } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import { AutoTestResult } from "@common/types/AutoTestTypes";
import { ContainerInput, ContainerOutput, ContainerState } from "@common/types/ContainerTypes";
import { AutoTestGradeTransport } from "@common/types/PortalTypes";
import Util from "@common/Util";

describe("ClassPortal Service", () => {
	Config.getInstance();

	let cp: IClassPortal;

	let backend: BackendServer = null;
	let realBackendUrl: string = null;

	before(async function () {
		Log.test("ClassPortalSpec::before() - start");

		const ci = process.env.CI;
		if (typeof ci !== "undefined" && Util.toBoolean(ci) === true) {
			Log.test("ClassPortalSpec::before() - running in CI; using https");
			// CI uses https and certificates, but local testing does not
			backend = new BackendServer(true);
		} else {
			Log.test("ClassPortalSpec::before() - not running in CI; using http");
			backend = new BackendServer(false);

			// ClassPortal builds its URLs from backendUrl, which .env sets to https://localhost for
			// the deployed server. The local server started above speaks http, so every call in this
			// suite failed with "SSL routines ... wrong version number" -- nine tests red on every
			// local run, all term, for a protocol mismatch rather than a broken feature. Point the
			// config at what is actually listening, and restore it afterwards. Same approach as
			// StubAutoTestService, which overrides autotestUrl the same way.
			const config = Config.getInstance();
			realBackendUrl = config.getProp(ConfigKey.backendUrl);
			config.setProp(ConfigKey.backendUrl, "http://localhost");
		}

		await backend.start();
		await TestHarness.prepareDeliverables();
		await TestHarness.preparePeople();
		await TestHarness.prepareTeams();
		await TestHarness.prepareRepositories();
		Log.test("ClassPortalSpec::before() - done");
	});

	after(async function () {
		Log.test("ClassPortalSpec::after() - start");
		await backend.stop();
		if (realBackendUrl !== null) {
			Config.getInstance().setProp(ConfigKey.backendUrl, realBackendUrl);
		}
		Log.test("ClassPortalSpec::after() - done");
	});

	beforeEach(function () {
		cp = new ClassPortal();
	});

	// NOTE: if this fails it could be because the ClassPortal BackendDaemon has not been started yet
	it("Should be able for an adminstaff user to be staff.", async () => {
		try {
			const actual = await cp.isStaff(TestHarness.ADMINSTAFF1.github);
			Log.test("Actual: " + actual);
			expect(actual.isStaff).to.equal(true);
			expect(actual.isAdmin).to.equal(true);
		} catch (err) {
			expect.fail("Should not happen: " + err);
		}
	});

	it("Should be able for a non-staff user to not be staff.", async () => {
		try {
			const actual = await cp.isStaff("student");
			expect(actual.isStaff).to.equal(false);
			expect(actual.isAdmin).to.equal(false);
		} catch (_err) {
			expect.fail("Should not happen");
		}
	}).timeout(TestHarness.TIMEOUT);

	it("Should be able for invalid user to not be staff.", async () => {
		try {
			const actual = await cp.isStaff("foo");
			expect(actual.isStaff).to.equal(false);
			expect(actual.isAdmin).to.equal(false);
		} catch (_err) {
			expect.fail("Should not happen");
		}
	});

	it("Should return false for non-staff.", async () => {
		try {
			let actual = await cp.isStaff(null);
			expect(actual.isStaff).to.equal(false);
			expect(actual.isAdmin).to.equal(false);
			actual = await cp.isStaff(undefined);
			expect(actual.isStaff).to.equal(false);
			expect(actual.isAdmin).to.equal(false);
			actual = await cp.isStaff("");
			expect(actual.isStaff).to.equal(false);
			expect(actual.isAdmin).to.equal(false);
		} catch (_err) {
			expect.fail("Should not happen");
		}
	}).timeout(TestHarness.TIMEOUT);

	// Tested in the backend (AutoTestRouteSpec)
	// it("Should return the test delay in seconds for a course.", async () => {
	//     try {
	//         const res = await cp.getContainerDetails("d0");
	//         expect(res).to.not.be.null;
	//         const actual = res.studentDelay;
	//         expect(actual).to.equal(43200);
	//     } catch (err) {
	//         expect.fail("Should not happen: " + err.message);
	//     }
	// });

	// Tested in the backend (AutoTestRouteSpec)
	// it("Should return a container id for an existing course.", async () => {
	//     try {
	//         const res = await cp.getContainerDetails("d0");
	//         const actual = res.dockerImage;
	//         expect(actual).to.equal("testImage");
	//     } catch (err) {
	//         expect.fail("Should not happen: " + err.message);
	//     }
	// });

	it("Should return a null container id if delivId does not exist.", async () => {
		try {
			const res = await cp.getContainerDetails("d9997");
			expect(res).to.equal(null);
		} catch (_err) {
			expect.fail("Should not happen");
		}
	});

	it("Should return a default deliverable if the course has one.", async () => {
		// setup
		const db = DatabaseController.getInstance();
		const course: Course = {
			id: Config.getInstance().getProp(ConfigKey.name),
			defaultDeliverableId: "d0",
			custom: {},
		};
		await db.writeCourseRecord(course);

		// test
		const actual = await cp.getConfiguration();
		Log.test("Actual: " + JSON.stringify(actual));

		expect(actual.defaultDeliverable).to.equal("d0");
	});

	it("Should be able to send a valid grade.", async () => {
		const grade: AutoTestGradeTransport = {
			repoId: TestHarness.REPONAME1,
			repoURL: "https://repo1",
			delivId: "d0",
			score: 60,
			comment: "comment!",
			urlName: "SHAName",
			URL: "https://SHAURL",
			timestamp: new Date(1400000000000 + 1000).getTime(),
			custom: {},
		};
		const actual = await cp.sendGrade(grade);
		Log.test("Actual: " + JSON.stringify(actual));

		expect(actual.success).to.not.be.undefined;
		expect(actual.failure).to.be.undefined;
	});

	it("Should fail to send an invalid grade.", async () => {
		const grade: any = {
			// AutoTestGradeTransport
			repoId: TestHarness.REPONAME1,
			repoURL: "https://repo1",
			// delivId:   "d0",  // this should be required
			score: 60,
			comment: "comment!",
			urlName: "SHAName",
			URL: "https://SHAURL",
			timestamp: Date.now(),
			custom: {},
		};
		const actual = await cp.sendGrade(grade);
		Log.test("Actual: " + JSON.stringify(actual));

		expect(actual.success).to.be.undefined;
		expect(actual.failure).to.not.be.undefined;
		expect(actual.failure.message).to.be.an("string");
	});

	function getResult(delivId: string, repoId: string, score: number) {
		const ts = Date.now() - Math.random() * 1000 * 600;
		const projectURL =
			Config.getInstance().getProp(ConfigKey.githubHost) + "/" + Config.getInstance().getProp(ConfigKey.org) + "/" + repoId;
		const commitURL = projectURL + "/commits/FOOOSHA";
		const output: ContainerOutput = {
			timestamp: ts,
			report: {
				scoreOverall: score,
				scoreTest: Math.random() * 100,
				scoreCover: Math.random() * 100,
				passNames: [],
				failNames: [],
				errorNames: [],
				skipNames: [],
				custom: {},
				feedback: "feedback",
				result: "SUCCESS",
				attachments: [],
			},
			postbackOnComplete: true,
			custom: {},
			state: ContainerState.SUCCESS,
			graderTaskId: "",
		};

		const input: ContainerInput = {
			target: {
				delivId: delivId,
				repoId: repoId,

				// branch:    "master",
				cloneURL: "cloneURL",
				commitSHA: "sha",
				commitURL: commitURL,

				botMentioned: false,
				adminRequest: false,
				shouldPromote: false,
				personId: null,
				kind: "push",

				// projectURL:  projectURL,
				postbackURL: "postbackURL",
				timestamp: ts,
			},
			containerConfig: {
				dockerImage: "imageName",
				studentDelay: 300,
				maxExecTime: 6000,
				regressionDelivIds: [],
				custom: {},
				openTimestamp: 0,
				closeTimestamp: 10000,
				lateAutoTest: true,
			},
			// delivId: delivId,
		};

		const result: AutoTestResult = {
			delivId: delivId,
			repoId: repoId,
			commitURL: commitURL,
			commitSHA: "sha",
			input: input,
			output: output,
		};

		return result;
	}

	it("Should be able to send a valid result.", async () => {
		const result = getResult("d0", "TESTrepo1", 50);
		// timestamp needs to be hardcoded to when the deliverable is open for new results
		result.input.target.timestamp = new Date(Date.UTC(2017, 3, 1, 1, 1)).getTime();
		const actual = await cp.sendResult(result);
		Log.test("Actual: " + JSON.stringify(actual));

		expect(actual.success).to.not.be.undefined;
	});

	it("Should not be able to send an invalid result.", async () => {
		const result = getResult("d0", "TESTrepo1", 50);
		delete result.input.target.delivId; // REQUIRED field
		const actual = await cp.sendResult(result);
		Log.test("Actual: " + JSON.stringify(actual));

		expect(actual.success).to.be.undefined;
		expect(actual.failure).to.not.be.undefined;
		expect(actual.failure.message).to.be.an("string");
	});

	it("Should be able to get a result.", async () => {
		const proto = getResult("d0", "TESTrepo1", 50);
		const actual = await cp.getResult(proto.delivId, proto.repoId, proto.commitSHA);
		Log.test("Actual: " + JSON.stringify(actual));

		expect(actual).to.not.be.null;
		expect(actual.delivId).to.equal("d0");
		expect(actual.repoId).to.equal("TESTrepo1");
	});

	it("Should not get a result that does not exist.", async () => {
		const actual = await cp.getResult("d_" + Date.now(), "repo0", "INVALID_SHA_" + Date.now());
		Log.test("Actual: " + JSON.stringify(actual));

		expect(actual).to.be.null;
	});

	/**
	 * The three functions AutoTest asks the portal on the hot path, and what they do when the answer
	 * is unusable.
	 *
	 * All three are written to fail safe rather than throw, because they run per push and per
	 * comment: shouldPromotePush defaults to not promoting, requestFeedbackDelay to no custom
	 * scheduler, formatFeedback to null. Those defaults were never exercised, and they are exactly
	 * what runs when the portal is mid-restart during a deploy -- which happens in week 1.
	 */
	describe("hot-path defaults", () => {
		/**
		 * Points the portal client at a closed port for one call, so the fetch fails the way it does
		 * when the backend is restarting. Restored afterwards.
		 */
		async function withUnreachableBackend<T>(work: (portal: IClassPortal) => Promise<T>): Promise<T> {
			const config = Config.getInstance();
			const current = config.getProp(ConfigKey.backendUrl);
			// port 1 is reserved and nothing listens there: connection refused, immediately
			config.setProp(ConfigKey.backendUrl, "http://127.0.0.1");
			const previousPort = config.getProp(ConfigKey.backendPort);
			config.setProp(ConfigKey.backendPort, "1" as any);
			try {
				return await work(new ClassPortal());
			} finally {
				config.setProp(ConfigKey.backendUrl, current);
				config.setProp(ConfigKey.backendPort, previousPort as any);
			}
		}

		const target: any = {
			delivId: TestHarness.DELIVID0,
			repoId: TestHarness.REPONAME1,
			commitSHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			commitURL: "https://github.example/org/repo/commit/aaaaaaa",
			botMentioned: false,
			personId: TestHarness.USER1.id,
			kind: "push",
			timestamp: 1787900000000,
		};

		it("Should answer the promote question for a real push.", async () => {
			// the default CourseController does not prioritize anything, so false is the answer;
			// what matters is that a well-formed exchange produces a boolean rather than throwing
			const promote = await cp.shouldPromotePush(target);
			expect(promote).to.be.a("boolean");
		});

		it("Should not promote a push when the portal cannot be reached.", async () => {
			// promoting on failure would let a network blip jump one student ahead of the queue
			const promote = await withUnreachableBackend((portal) => portal.shouldPromotePush(target));
			expect(promote, "an unreachable portal must not promote").to.be.false;
		});

		it("Should report no custom feedback schedule when the course does not implement one.", async () => {
			// the default CourseController returns null, which the route sends as 204 notImplemented;
			// null here means "use the normal delay rules", not "something went wrong"
			const delay = await cp.requestFeedbackDelay(TestHarness.DELIVID0, TestHarness.USER1.id, Date.now());
			expect(delay).to.be.null;
		});

		it("Should report no custom feedback schedule when the portal cannot be reached.", async () => {
			// falling back to the normal rules is right; the alternative is locking students out
			const delay = await withUnreachableBackend((portal) =>
				portal.requestFeedbackDelay(TestHarness.DELIVID0, TestHarness.USER1.id, Date.now())
			);
			expect(delay, "an unreachable portal must fall back to the normal delay rules").to.be.null;
		});

		it("Should return the feedback from a result, unmodified.", async () => {
			// the truncation inside formatFeedback is for its own log line only; the student gets
			// the whole report, newlines and all
			const feedback = "## AutoTest\n\n42/45 passed.\n\nSee the handbook for the ones that did not.";
			const res: any = {
				delivId: TestHarness.DELIVID0,
				repoId: TestHarness.REPONAME1,
				commitSHA: "abc",
				commitURL: "u",
				output: { report: { feedback: feedback } },
			};

			expect(await cp.formatFeedback(res)).to.equal(feedback);
		});

		it("Should return null for a result with no report to format.", async () => {
			// a container that produced no report at all; the caller posts nothing rather than
			// posting "undefined" to the student's commit
			const res: any = { delivId: TestHarness.DELIVID0, repoId: TestHarness.REPONAME1, commitSHA: "abc", commitURL: "u", output: {} };
			expect(await cp.formatFeedback(res)).to.be.null;

			const noOutput: any = { delivId: TestHarness.DELIVID0, repoId: TestHarness.REPONAME1, commitSHA: "abc", commitURL: "u" };
			expect(await cp.formatFeedback(noOutput)).to.be.null;
		});
	});
});
