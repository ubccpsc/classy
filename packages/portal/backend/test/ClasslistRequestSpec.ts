import { expect } from "chai";
import "mocha";

import { ClasslistAgent } from "@backend/server/common/ClasslistAgent";
import { Person } from "@backend/Types";
import Config, { ConfigKey } from "@common/Config";

import "@common/GlobalSpec"; // load first

describe("ClasslistAgent request", function () {
	// Regression: the credential used to be spliced into the URI as https://user:pass@host, and
	// node-fetch echoes the full URL in its error messages, so a bad response from the registrar
	// wrote the password into the job record and the admin UI.
	const KEYS = [ConfigKey.classlist_uri, ConfigKey.classlist_username, ConfigKey.classlist_password];
	const saved: { [key: string]: string } = {};

	before(function () {
		const c = Config.getInstance();
		for (const k of KEYS) {
			saved[k] = c.hasProp(k) ? c.getProp(k) : "";
		}
		c.setProp(ConfigKey.classlist_uri, "https://registrar.example/classlist/v1/CPSC/210/2026W/101");
		c.setProp(ConfigKey.classlist_username, "svcuser");
		c.setProp(ConfigKey.classlist_password, "s3cret:with:colons");
	});

	after(function () {
		const c = Config.getInstance();
		for (const k of KEYS) {
			c.setProp(k, saved[k]);
		}
	});

	// getClasslistRequest is private; the existing ClasslistAgentSpec reaches private members the
	// same way, and it is the seam that matters here.
	function request(): { uri: string; headers: { [key: string]: string } } {
		return (new ClasslistAgent() as any).getClasslistRequest();
	}

	it("Should keep the credential out of the URI.", function () {
		const { uri } = request();

		expect(uri).to.equal("https://registrar.example/classlist/v1/CPSC/210/2026W/101");
		expect(uri).to.not.contain("@");
		expect(uri).to.not.contain("s3cret");
	});

	it("Should send the credential as a Basic Authorization header.", function () {
		const { headers } = request();
		const expected = "Basic " + Buffer.from("svcuser:s3cret:with:colons", "utf8").toString("base64");

		expect(headers.Authorization).to.equal(expected);
	});

	it("Should refuse a non-https registrar URI.", function () {
		Config.getInstance().setProp(ConfigKey.classlist_uri, "http://registrar.example/classlist");

		expect(() => request()).to.throw("https://");
	});
});

describe("ClasslistAgent validate-before-write", function () {
	// Regression: the SNUM/LAST/LAB check lived inside the write loop, so one bad row rejected AFTER
	// every other createPerson() had already fired -- the job said FAILED with hundreds of people
	// created. The pre-flight must now refuse the whole classlist before the first write.
	function row(acct: string, extra: any = {}, drop: string[] = []): any {
		const r: any = { ACCT: acct, CWL: acct + "cwl", SNUM: "1234567" + acct, FIRST: "f", LAST: "l", LAB: "L1A", ...extra };
		for (const column of drop) {
			delete r[column];
		}
		return r;
	}

	async function attempt(rows: any[]): Promise<{ writes: number; error: string | null }> {
		const agent = new ClasslistAgent();
		let writes = 0;
		(agent as any).pc.createPerson = async (p: Person): Promise<Person> => {
			writes++;
			return p;
		};
		try {
			await agent.processClasslist(null, null, rows);
			return { writes, error: null };
		} catch (err) {
			return { writes, error: err.message };
		}
	}

	it("Should write nothing when one row has no SNUM column.", async function () {
		const result = await attempt([row("aaa"), row("bbb"), row("ccc", {}, ["SNUM"])]);

		expect(result.error, "should refuse the classlist").to.not.be.null;
		expect(result.error).to.contain("Required column missing");
		expect(result.writes, "no createPerson before validation finished").to.equal(0);
	});

	it("Should write nothing when one row has neither FIRST nor PREF.", async function () {
		const result = await attempt([row("aaa"), row("bbb", {}, ["FIRST"])]);

		expect(result.error).to.contain("Required column missing");
		expect(result.writes).to.equal(0);
	});

	it("Should accept an empty LAB, as the fixtures do, and write every row.", async function () {
		// an empty lab section is a real state (not yet assigned); presence is what is required
		const result = await attempt([row("aaa"), row("bbb", { LAB: "" }), row("ccc", { PREF: "pref" }, ["FIRST"])]);

		expect(result.error).to.be.null;
		expect(result.writes).to.equal(3);
	});
});
