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
});
