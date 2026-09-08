import { expect } from "chai";
import "mocha";

import "@common/GlobalSpec"; // load first

describe("DatabaseValidator (src-util)", function () {
	// The scripts in src-util mutate production data and had no tests, largely because this module
	// ran a validation pass on import and called process.exit() on the first error. It now runs
	// only when invoked directly, which is what makes it importable here at all.
	it("Should be importable without running a validation pass.", async function () {
		const mod = await import("../src-util/DatabaseValidator");

		expect(mod.DatabaseValidator, "class is exported").to.be.a("function");
		const dv = new mod.DatabaseValidator();
		expect((dv as any).DRY_RUN, "dry-run is the default").to.equal(true);
	});

	it("Should perform zero writes in dry-run mode.", async function () {
		// validate() reads the real (test) database and, in dry-run, is supposed to only report. It
		// is the mode people run first against production, so "reports only" has to be true.
		const mod = await import("../src-util/DatabaseValidator");
		const dv = new mod.DatabaseValidator();
		const dc: any = (dv as any).dc; // the DatabaseController singleton; stubs MUST be restored
		const WRITES = ["writeGrade", "writeRepository", "writeTeam", "writeDeliverable", "writePerson", "writeResult"];
		const originals: { [k: string]: any } = {};
		let writes = 0;
		for (const name of WRITES) {
			originals[name] = dc[name];
			dc[name] = async () => {
				writes++;
				return true;
			};
		}
		try {
			await dv.validate();
		} finally {
			for (const name of WRITES) {
				dc[name] = originals[name];
			}
		}

		expect(writes, "dry-run must not write").to.equal(0);
	}).timeout(30000);
});
