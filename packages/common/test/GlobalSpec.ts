import "mocha";

import Config, {ConfigKey} from "../Config";
import Log from "../Log";

import {Test} from "./TestHarness";

before(async () => {
    Log.info("GlobalSpec::before() - resetting Config.name and Config.org for test suite.");

    Config.getInstance().setProp(ConfigKey.name, Config.getInstance().getProp(ConfigKey.testname));
    Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
});

after(() => {
    Log.info("GlobalSpec::after() - done.");
    // process.exit();
});

beforeEach(function () {
    Test.testBefore(this);
});

afterEach(function () {
    Test.testAfter(this);
});
