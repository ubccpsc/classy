import "mocha";

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";

import { TestHarness } from "./TestHarness";

before(async () => {
	Log.info("GlobalSpec::before() - resetting Config.name and Config.org for test suite.");
	Config.getInstance().setProp(ConfigKey.name, Config.getInstance().getProp(ConfigKey.testname));
	Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
});

after(() => {
	Log.info("GlobalSpec::after() - done.");

	// Say what did NOT run. Mocha's epilogue reports a pending count but not a reason,
	// so a suite that has quietly stopped covering GitHub (or Docker) looks the same as
	// one that is fully green. Log.warn so this survives LOG_LEVEL=WARN on CI.
	const skipped = TestHarness.summarizeSkips();
	if (skipped !== null) {
		Log.warn("GlobalSpec::after() - " + skipped);
	}
	// process.exit();
});

beforeEach(function () {
	TestHarness.testBefore(this);
});

afterEach(function () {
	TestHarness.testAfter(this);
});
