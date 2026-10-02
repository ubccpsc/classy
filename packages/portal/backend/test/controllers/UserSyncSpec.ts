import { expect } from "chai";
import "mocha";

import { AdminController } from "@backend/controllers/AdminController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { IGitHubActions } from "@backend/controllers/GitHubActions";
import { IGitHubController } from "@backend/controllers/GitHubController";
import { TeamController } from "@backend/controllers/TeamController";
import { AuditLabel, PersonKind } from "@backend/Types";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec"; // load first

/**
 * AdminController::synchronizeUsers (formerly performStudentWithdraw), which settles every
 * person's kind from the GitHub students, staff, and admin teams. Its original job, marking every STUDENT missing from the GitHub
 * "students" team as WITHDRAWN.
 *
 * This is the second whole-class operation Classy has (dbSanityCheck is the other), and it was the
 * last uncovered function in AdminController. It could not be tested at all until it stopped
 * calling GitHubActions.getInstance(true): forcing the live client meant a local run read the real
 * org's team membership and then withdrew students in the real database.
 *
 * The guard worth protecting is the sanity floor. The GitHub team is trusted absolutely -- anyone
 * missing from it gets withdrawn -- so a team that is merely stale (LDAP has not synced, which
 * happens exactly at term start) would otherwise withdraw most of the class in one call.
 */
describe("AdminController::synchronizeUsers", function () {
	const dbc = DatabaseController.getInstance();

	function controllerFor(students: string[], staff: string[] = [], admin: string[] = []): AdminController {
		const byTeam: { [name: string]: string[] } = {
			students: students,
			[TeamController.STAFF_NAME]: staff,
			[TeamController.ADMIN_NAME]: admin,
		};
		const gha = {
			getTeamMembers: async (teamName: string): Promise<string[]> => byTeam[teamName] ?? [],
		} as unknown as IGitHubActions;
		return new AdminController({ getActions: () => gha } as unknown as IGitHubController);
	}

	async function makeStudent(id: string, githubId: string): Promise<void> {
		const person = TestHarness.createPerson(id, id, githubId, PersonKind.STUDENT);
		await dbc.writePerson(person);
	}

	async function kindOf(id: string): Promise<string> {
		return (await dbc.getPerson(id)).kind;
	}

	before(async function () {
		await TestHarness.suiteBefore("AdminController::synchronizeUsers");
		await TestHarness.prepareDeliverables();
	});

	after(function () {
		TestHarness.suiteAfter("AdminController::synchronizeUsers");
	});

	beforeEach(async function () {
		// each case needs its own class; withdrawing is global by design
		await dbc.clearData();
	});

	it("Should withdraw a student who is no longer on the GitHub team.", async function () {
		await makeStudent("withdrawStays1", "ghStays1");
		await makeStudent("withdrawStays2", "ghStays2");
		await makeStudent("withdrawGone", "ghGone");

		// the team still has two of the three, which is above the floor
		const msg = (await controllerFor(["ghStays1", "ghStays2"]).synchronizeUsers(TestHarness.ADMIN1.id)).message;

		expect(await kindOf("withdrawGone"), "absent from the team means withdrawn").to.equal(PersonKind.WITHDRAWN);
		expect(await kindOf("withdrawStays1"), "still on the team means still enrolled").to.equal(PersonKind.STUDENT);
		expect(await kindOf("withdrawStays2")).to.equal(PersonKind.STUDENT);
		expect(msg).to.be.a("string");
	});

	it("Should match GitHub logins case-insensitively.", async function () {
		// Classy stores the lowercased CWL; GitHub may report the login with capitals. An exact
		// compare withdrew such a student on every run.
		await makeStudent("withdrawCase1", "ghcase1");
		await makeStudent("withdrawCase2", "ghcase2");

		const msg = (await controllerFor(["GhCase1", "GHCASE2"]).synchronizeUsers(TestHarness.ADMIN1.id)).message;

		expect(await kindOf("withdrawCase1"), "a capitalised login is still the same account").to.equal(PersonKind.STUDENT);
		expect(await kindOf("withdrawCase2")).to.equal(PersonKind.STUDENT);
		expect(msg).to.contain("# active: 2; # withdrawn: 0; # withdrawn (this run): 0");
	});

	it("Should treat a null kind as a student.", async function () {
		// The login callback nulls kind until the next privileged request re-derives it; a student
		// who logs in and leaves stays null. They must still be counted, and withdrawn if gone.
		await makeStudent("withdrawNullStays", "ghNullStays");
		await makeStudent("withdrawNullGone", "ghNullGone");
		await makeStudent("withdrawNullOther", "ghNullOther");
		for (const id of ["withdrawNullStays", "withdrawNullGone"]) {
			const p = await dbc.getPerson(id);
			p.kind = null;
			await dbc.writePerson(p);
		}

		const msg = (await controllerFor(["ghNullStays", "ghNullOther"]).synchronizeUsers(TestHarness.ADMIN1.id)).message;

		// settled from the teams now, rather than left for the next login to re-derive
		expect(await kindOf("withdrawNullStays"), "on the team: settled to student").to.equal(PersonKind.STUDENT);
		expect(await kindOf("withdrawNullGone"), "off the team: withdrawn like any student").to.equal(PersonKind.WITHDRAWN);
		expect(msg).to.contain("# active: 2; # withdrawn: 1; # withdrawn (this run): 1");
	});

	it("Should account for reinstatements, unknown team logins, and students without a GitHub id.", async function () {
		// the counts an admin needs to answer "why is this student not active?" from the summary
		await makeStudent("withdrawActive1", "ghActive1");
		await makeStudent("withdrawActive2", "ghActive2");
		await dbc.writePerson(TestHarness.createPerson("withdrawBack", "withdrawBack", "ghBack", PersonKind.WITHDRAWN));
		await dbc.writePerson(TestHarness.createPerson("withdrawNoGh", "withdrawNoGh", null, PersonKind.STUDENT));

		// ghTAOnly is on the team but is nobody in Classy (a TA, or someone not on the classlist)
		const result = await controllerFor(["ghActive1", "ghActive2", "ghBack", "ghTAOnly"]).synchronizeUsers(TestHarness.ADMIN1.id);
		const msg = result.message;
		// the payload carries the people behind the counts, so a page can show them without the log
		expect(
			result.reinstated.map((c) => c.person.githubId),
			"reinstated"
		).to.deep.equal(["ghBack"]);
		expect(result.reinstated[0].from, "from the kind it had").to.equal("withdrawn");
		expect(result.reinstated[0].to).to.equal("student");
		expect(result.withdrawnThisRun.length, "withdrawn this run").to.equal(1);
		expect(result.unknownLogins, "team login unknown to Classy").to.deep.equal(["ghTAOnly"]);
		expect(result.noGithubId.length, "students without a GitHub id").to.equal(1);
		expect(result.teams.students).to.equal(4);
		expect(result.active).to.equal(3);
		expect(result.withdrawn).to.equal(1);
		Log.test(msg);

		expect(await kindOf("withdrawBack"), "back on the team means reinstated").to.equal(PersonKind.STUDENT);
		expect(await kindOf("withdrawNoGh"), "no githubId can never match the team").to.equal(PersonKind.WITHDRAWN);
		expect(msg).to.contain("# active: 3; # withdrawn: 1; # withdrawn (this run): 1");
		expect(msg).to.contain("# reinstated (this run): 1");
		expect(msg).to.contain("# on GitHub teams: students 4");
		expect(msg).to.contain("# team logins unknown to Classy: 1");
		expect(msg).to.contain("# students without a GitHub id: 1");
	});

	async function makePerson(id: string, githubId: string, kind: PersonKind): Promise<void> {
		await dbc.writePerson(TestHarness.createPerson(id, id, githubId, kind));
	}

	it("Should derive staff and admin kinds from their teams.", async function () {
		await makeStudent("syncStudent", "ghStudent");
		await makeStudent("syncNewTA", "ghNewTA");
		await makeStudent("syncNewAdmin", "ghNewAdmin");
		await makeStudent("syncNewBoth", "ghNewBoth");

		const msg = (
			await controllerFor(["ghStudent", "ghNewTA"], ["ghNewTA", "ghNewBoth"], ["ghNewAdmin", "ghNewBoth"]).synchronizeUsers(
				TestHarness.ADMIN1.id
			)
		).message;
		Log.test(msg);

		expect(await kindOf("syncStudent")).to.equal(PersonKind.STUDENT);
		expect(await kindOf("syncNewTA"), "staff wins over students").to.equal(PersonKind.STAFF);
		expect(await kindOf("syncNewAdmin")).to.equal(PersonKind.ADMIN);
		expect(await kindOf("syncNewBoth")).to.equal(PersonKind.ADMINSTAFF);
		expect(msg).to.contain("# promoted (this run): 3");
		expect(msg).to.contain("# withdrawn (this run): 0");
	});

	it("Should demote former staff who are no longer on the staff or admin team.", async function () {
		await makeStudent("syncStudentA", "ghStudentA");
		await makeStudent("syncStudentB", "ghStudentB");
		await makePerson("syncFormerTA", "ghFormerTA", PersonKind.STAFF); // still enrolled as a student
		await makePerson("syncGoneAdmin", "ghGoneAdmin", PersonKind.ADMIN); // on no team at all
		await makePerson("syncStillAdmin", "ghStillAdmin", PersonKind.ADMIN);

		const msg = (
			await controllerFor(["ghStudentA", "ghStudentB", "ghFormerTA"], ["ghSomeTA"], ["ghStillAdmin"]).synchronizeUsers(
				TestHarness.ADMIN1.id
			)
		).message;
		Log.test(msg);

		expect(await kindOf("syncFormerTA"), "off staff, on students: a student again").to.equal(PersonKind.STUDENT);
		expect(await kindOf("syncGoneAdmin"), "off every team: withdrawn").to.equal(PersonKind.WITHDRAWN);
		expect(await kindOf("syncStillAdmin")).to.equal(PersonKind.ADMIN);
		expect(msg).to.contain("# demoted (this run): 1");
		expect(msg).to.contain("# withdrawn (this run): 1");
		expect(msg).to.contain("# team logins unknown to Classy: 1"); // ghSomeTA
	});

	it("Should leave staff and admin kinds alone when those teams cannot be read.", async function () {
		// getTeamMembers answers an empty list for a failed request; a course always has an admin,
		// so empty is read as unreadable rather than as "nobody is staff any more"
		await makeStudent("syncGuardStudent", "ghGuardStudent");
		await makeStudent("syncGuardWouldBeTA", "ghGuardWouldBeTA");
		await makePerson("syncGuardTA", "ghGuardTA", PersonKind.STAFF); // on no team we can see
		await makePerson("syncGuardAdmin", "ghGuardAdmin", PersonKind.ADMINSTAFF);

		const msg = (await controllerFor(["ghGuardStudent", "ghGuardWouldBeTA"], [], []).synchronizeUsers(TestHarness.ADMIN1.id)).message;
		Log.test(msg);

		expect(await kindOf("syncGuardTA"), "not demoted on a run that could not read the teams").to.equal(PersonKind.STAFF);
		expect(await kindOf("syncGuardAdmin")).to.equal(PersonKind.ADMINSTAFF);
		expect(await kindOf("syncGuardWouldBeTA"), "not promoted either").to.equal(PersonKind.STUDENT);
		expect(msg).to.contain("staff/admin unreadable");
		expect(msg).to.contain("# promoted (this run): 0; # demoted (this run): 0");
	});

	it("Should settle a null kind from whichever team has them.", async function () {
		await makeStudent("syncNullStudent", "ghNullStudent");
		await makeStudent("syncNullTA", "ghNullTA");
		await makeStudent("syncNullOther", "ghNullOther");
		for (const id of ["syncNullStudent", "syncNullTA"]) {
			const p = await dbc.getPerson(id);
			p.kind = null;
			await dbc.writePerson(p);
		}

		const msg = (await controllerFor(["ghNullStudent", "ghNullOther"], ["ghNullTA"], ["ghAnAdmin"]).synchronizeUsers(TestHarness.ADMIN1.id))
			.message;
		Log.test(msg);

		expect(await kindOf("syncNullStudent")).to.equal(PersonKind.STUDENT);
		expect(await kindOf("syncNullTA")).to.equal(PersonKind.STAFF);
		expect(msg).to.contain("# null kinds settled (this run): 2");
	});

	it("Should refuse to run when the GitHub team looks stale.", async function () {
		// four students, one team member: below half, so this is far more likely to be a team that
		// has not synced than a class that shrank by 75%
		await makeStudent("staleA", "ghStaleA");
		await makeStudent("staleB", "ghStaleB");
		await makeStudent("staleC", "ghStaleC");
		await makeStudent("staleD", "ghStaleD");

		let message: string = null;
		try {
			await controllerFor(["ghStaleA"]).synchronizeUsers(TestHarness.ADMIN1.id);
		} catch (err) {
			message = err.message;
		}

		expect(message, "a stale-looking team must stop the operation").to.not.be.null;
		expect(message).to.contain("Refusing to withdraw");

		// and nothing may have been written before it refused
		for (const id of ["staleA", "staleB", "staleC", "staleD"]) {
			expect(await kindOf(id), id + " must be untouched").to.equal(PersonKind.STUDENT);
		}
	});

	it("Should refuse to run when the GitHub team is empty.", async function () {
		// an empty team would withdraw the entire class
		await makeStudent("emptyTeamStudent", "ghEmptyTeam");

		let message: string = null;
		try {
			await controllerFor([]).synchronizeUsers(TestHarness.ADMIN1.id);
		} catch (err) {
			message = err.message;
		}

		expect(message).to.not.be.null;
		expect(await kindOf("emptyTeamStudent")).to.equal(PersonKind.STUDENT);
	});

	it("Should write an audit record naming the requester.", async function () {
		await makeStudent("auditStays1", "ghAuditStays1");
		await makeStudent("auditStays2", "ghAuditStays2");

		const before = await dbc.getAudits(AuditLabel.USER_SYNC, 1000);
		await controllerFor(["ghAuditStays1", "ghAuditStays2"]).synchronizeUsers(TestHarness.ADMIN1.id);
		const after = await dbc.getAudits(AuditLabel.USER_SYNC, 1000);

		expect(after.length).to.equal(before.length + 1);
		expect(after[0].personId).to.equal(TestHarness.ADMIN1.id);
	});

	it("Should not audit when no requester is given.", async function () {
		// the job path passes a requester; a scripted call may not, and an audit record with a null
		// actor is worse than none
		await makeStudent("noAuditStays1", "ghNoAuditStays1");
		await makeStudent("noAuditStays2", "ghNoAuditStays2");

		const before = await dbc.getAudits(AuditLabel.USER_SYNC, 1000);
		await controllerFor(["ghNoAuditStays1", "ghNoAuditStays2"]).synchronizeUsers(null);
		const after = await dbc.getAudits(AuditLabel.USER_SYNC, 1000);

		expect(after.length).to.equal(before.length);
	});
});
