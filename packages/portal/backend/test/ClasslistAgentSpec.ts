import { expect } from "chai";
import "mocha";

import { DatabaseController } from "@backend/controllers/DatabaseController";
import { ClasslistAgent } from "@backend/server/common/ClasslistAgent";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec";

describe("ClasslistAgent", function () {
	const mockAPIData = [
		{
			SNUM: "8888888",
			FIRST: "Todd",
			LAST: "Smith",
			PREF: "Ted",
			ACCT: "x1x1x",
			CRS: "999",
			CWL: "tsmitht",
			SEC: "101",
			LAB: "L1Y",
			TUT: "",
		},
		{
			SNUM: "7777777",
			FIRST: "John",
			LAST: "Smith",
			PREF: "Jay",
			ACCT: "z1z1z",
			CRS: "991",
			CWL: "jaysmith7",
			SEC: "201",
			LAB: "L2F",
			TUT: "",
		},
		{
			SNUM: "6666666",
			FIRST: "Cletus",
			LAST: "Smith",
			PREF: "Clé",
			ACCT: "c1c1c",
			CRS: "210",
			CWL: "cletus1",
			SEC: "101",
			LAB: "L1Y",
			TUT: "",
		},
	];

	const ca: ClasslistAgent = new ClasslistAgent();

	/**
	 * updateClasslist is what the "classlist-update" job runs (see BackendServer). It is the whole
	 * job body, so the parts worth pinning are the ones the admin UI shows: the failure message, and
	 * that progress is reported.
	 *
	 * NOTE: no network. fetchClasslist is replaced on the instance, which is all the injection this
	 * needs -- the same trick PrairieLearnAgent solves with an injectable fetcher.
	 */
	// NOTE: deliberately different students from mockAPIData. "Should produce a list of CREATED
	// users" asserts that every row it processes is new, so a test that runs earlier must not have
	// created those people already.
	const mockJobData = [
		{
			SNUM: "5555555",
			FIRST: "Jane",
			LAST: "Jones",
			PREF: "Janey",
			ACCT: "j1j1j",
			CRS: "210",
			CWL: "jjones5",
			SEC: "101",
			LAB: "L1A",
			TUT: "",
		},
		{ SNUM: "4444444", FIRST: "Ravi", LAST: "Patel", PREF: "", ACCT: "r1r1r", CRS: "210", CWL: "rpatel4", SEC: "101", LAB: "L1A", TUT: "" },
	];

	function agentReturning(rows: any[]): { agent: ClasslistAgent; progress: string[] } {
		const agent = new ClasslistAgent();
		const progress: string[] = [];
		(agent as any).fetchClasslist = async () => rows;
		return { agent: agent, progress: progress };
	}

	function contextRecording(progress: string[]): any {
		return {
			isCancelled: () => false,
			progress: async (done: number, total: number, message: string) => {
				progress.push(done + "/" + total + " " + message);
			},
			error: async () => {
				//
			},
		};
	}

	it("Should update the classlist from the API, reporting progress", async function () {
		const { agent, progress } = agentReturning(mockJobData);

		const changes = await agent.updateClasslist(TestHarness.ADMIN1.id, contextRecording(progress));
		Log.test("changes: " + JSON.stringify(changes.classlist.map((s) => s.id)) + "; progress: " + JSON.stringify(progress));

		expect(changes.classlist.length).to.equal(mockJobData.length);

		// the status line under the button is driven by these
		expect(progress.length).to.be.greaterThan(1);
		expect(progress[0]).to.contain("fetching");
		expect(progress[progress.length - 1]).to.contain("done");
	});

	it("Should fail the classlist update when the service returns no students", async function () {
		// NOTE: this is the common real failure (bad credentials, wrong course), and as a job it has
		// to surface as a rejection: JobController records it, and the admin UI shows it in the
		// status line. Returning an empty change set instead would look like a successful no-op.
		const { agent, progress } = agentReturning([]);

		let message: string = null;
		try {
			await agent.updateClasslist(TestHarness.ADMIN1.id, contextRecording(progress));
		} catch (err) {
			message = err.message;
		}
		Log.test("message: " + message);

		expect(message).to.not.be.null;
		expect(message).to.contain("no students were processed");
	});

	it("Should be able to process an empty classlist", async function () {
		const path = __dirname + "/data/classlistEmpty.csv";
		const classlistChanges = await ca.processClasslist(TestHarness.ADMIN1.id, path, null);
		Log.test("# rows processed: " + classlistChanges.updated.length + classlistChanges.created.length);
		expect(classlistChanges.updated.length + classlistChanges.created.length).to.equal(0);
	});

	it("Should be able to process a valid classlist using first name", async function () {
		const path = __dirname + "/data/classlistValidFirst.csv";
		const classlistChanges = await ca.processClasslist(TestHarness.ADMIN1.id, path, null);
		const numChanges = classlistChanges.updated.length + classlistChanges.created.length;
		Log.test("# rows processed: " + numChanges);
		expect(numChanges).to.equal(5);
		expect(numChanges).to.equal(classlistChanges.classlist.length);
	});

	it("Should be able to process a valid classlist using pref name", async function () {
		const path = __dirname + "/data/classlistValidPrefName.csv";
		const classlistChanges = await ca.processClasslist(TestHarness.ADMIN1.id, path, null);
		const numChanges = classlistChanges.updated.length + classlistChanges.created.length;
		Log.test("# rows processed: " + numChanges);
		expect(numChanges).to.equal(5);
		expect(numChanges).to.equal(classlistChanges.classlist.length);
	});

	it("Should reject a classlist if both FIRST and PREF are empty", async () => {
		const path = __dirname + "/data/classlistEmptyNamePrefName.csv";
		let ex = null;
		try {
			await ca.processClasslist(TestHarness.ADMIN1.id, path, null);
		} catch (err) {
			ex = err;
		}
		expect(ex).to.not.be.null;
	});

	it("Should reject a classlist with empty field in fields: CWL, ACCT", async function () {
		const path = __dirname + "/data/classlistEmptyField.csv";
		let ex = null;
		try {
			await ca.processClasslist(TestHarness.ADMIN1.id, path, null);
		} catch (err) {
			ex = err;
		}
		expect(ex).to.not.be.null;
	});

	it("Should reject a classlist with duplicate data in fields: CWL, ACCT", async function () {
		const path = __dirname + "/data/classlistDuplicateField.csv";
		let ex = null;
		try {
			await ca.processClasslist(TestHarness.ADMIN1.id, path, null);
		} catch (err) {
			ex = err;
		}
		expect(ex).to.not.be.null;
	});

	it("Should be able to process an updated classlist", async function () {
		const path = __dirname + "/data/classlistValidUpdate.csv";
		const classlistChanges = await ca.processClasslist(TestHarness.ADMIN1.id, path, null);
		Log.test("# rows processed: " + classlistChanges.classlist.length);
		expect(classlistChanges.classlist.length).to.equal(5);
	});

	it("Should not be able to process an invalid classlist", async function () {
		let rows = null;
		let ex = null;
		try {
			const path = __dirname + "/data/classlistInvalid.csv";
			rows = await ca.processClasslist(TestHarness.ADMIN1.id, path, null);
		} catch (err) {
			ex = err;
		}
		expect(rows).to.be.null;
		expect(ex).to.not.be.null;
	});

	it("Should produce a list of CREATED users if a new user has been created via classlist API", async function () {
		const data = mockAPIData.slice();

		// NOTE: "created" only counts people who did not exist yet, so this test is about the state
		// of the datastore as much as the classlist. It used to fail intermittently in full-suite
		// runs, where an earlier suite could leave these people behind; removing them first makes it
		// mean what its name says regardless of what ran before.
		const dbc = DatabaseController.getInstance();
		for (const row of data) {
			const existing = await dbc.getPerson(row.ACCT.toLowerCase());
			if (existing !== null) {
				await dbc.deletePerson(existing);
			}
		}

		const classlistChanges = await ca.processClasslist(TestHarness.ADMIN1.id, null, data);
		expect(classlistChanges.created.length).to.equal(data.length);
	});

	it("Should produce a list of REMOVED users if user is NOT on second classlist API update", async function () {
		const data = mockAPIData.slice();
		const firstUpdate = await ca.processClasslist(TestHarness.ADMIN1.id, null, data);
		data.splice(2, 1); // remove 1 student
		const secondUpdate = await ca.processClasslist(TestHarness.ADMIN1.id, null, data);
		expect(firstUpdate.removed.length).to.be.lessThan(secondUpdate.removed.length);
		expect(secondUpdate.removed.length).to.equal(firstUpdate.removed.length + 1);
	});

	it("Should produce a list of UPDATED users if a property has changed via classlist API", async function () {
		const data = mockAPIData.slice();
		const firstUpdate = await ca.processClasslist(TestHarness.ADMIN1.id, null, data);
		// ONLY CWL AND LABID ARE PROGRAMMED TO CHANGE
		data[2].CWL = "newCWL";
		const secondUpdate = await ca.processClasslist(TestHarness.ADMIN1.id, null, data);
		expect(firstUpdate.updated.length).to.equal(0);
		expect(secondUpdate.updated.length).to.equal(1);
		await ca.processClasslist(TestHarness.ADMIN1.id, null, data);
	});
});
