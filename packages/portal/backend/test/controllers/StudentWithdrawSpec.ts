import { expect } from "chai";
import "mocha";

import { AdminController } from "@backend/controllers/AdminController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { IGitHubActions } from "@backend/controllers/GitHubActions";
import { IGitHubController } from "@backend/controllers/GitHubController";
import { AuditLabel, PersonKind } from "@backend/Types";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec"; // load first

/**
 * AdminController::performStudentWithdraw, which marks every STUDENT missing from the GitHub
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
describe("AdminController::performStudentWithdraw", function () {
	const dbc = DatabaseController.getInstance();

	function controllerFor(githubIds: string[]): AdminController {
		const gha = {
			getTeamMembers: async (): Promise<string[]> => githubIds,
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
		await TestHarness.suiteBefore("AdminController::performStudentWithdraw");
		await TestHarness.prepareDeliverables();
	});

	after(function () {
		TestHarness.suiteAfter("AdminController::performStudentWithdraw");
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
		const msg = await controllerFor(["ghStays1", "ghStays2"]).performStudentWithdraw(TestHarness.ADMIN1.id);

		expect(await kindOf("withdrawGone"), "absent from the team means withdrawn").to.equal(PersonKind.WITHDRAWN);
		expect(await kindOf("withdrawStays1"), "still on the team means still enrolled").to.equal(PersonKind.STUDENT);
		expect(await kindOf("withdrawStays2")).to.equal(PersonKind.STUDENT);
		expect(msg).to.be.a("string");
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
			await controllerFor(["ghStaleA"]).performStudentWithdraw(TestHarness.ADMIN1.id);
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
			await controllerFor([]).performStudentWithdraw(TestHarness.ADMIN1.id);
		} catch (err) {
			message = err.message;
		}

		expect(message).to.not.be.null;
		expect(await kindOf("emptyTeamStudent")).to.equal(PersonKind.STUDENT);
	});

	it("Should write an audit record naming the requester.", async function () {
		await makeStudent("auditStays1", "ghAuditStays1");
		await makeStudent("auditStays2", "ghAuditStays2");

		const before = await dbc.getAudits(AuditLabel.STUDENT_WITHDRAW, 1000);
		await controllerFor(["ghAuditStays1", "ghAuditStays2"]).performStudentWithdraw(TestHarness.ADMIN1.id);
		const after = await dbc.getAudits(AuditLabel.STUDENT_WITHDRAW, 1000);

		expect(after.length).to.equal(before.length + 1);
		expect(after[0].personId).to.equal(TestHarness.ADMIN1.id);
	});

	it("Should not audit when no requester is given.", async function () {
		// the job path passes a requester; a scripted call may not, and an audit record with a null
		// actor is worse than none
		await makeStudent("noAuditStays1", "ghNoAuditStays1");
		await makeStudent("noAuditStays2", "ghNoAuditStays2");

		const before = await dbc.getAudits(AuditLabel.STUDENT_WITHDRAW, 1000);
		await controllerFor(["ghNoAuditStays1", "ghNoAuditStays2"]).performStudentWithdraw(null);
		const after = await dbc.getAudits(AuditLabel.STUDENT_WITHDRAW, 1000);

		expect(after.length).to.equal(before.length);
	});
});
