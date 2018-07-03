import "mocha";

import Config, {ConfigKey} from "../../common/Config";
import Log from "../../common/Log";

before(async () => {
    Log.info('GlobalSpec::before() - resetting Config.name for test suite.');

    Config.getInstance().setProp(ConfigKey.name, 'test'); // TODO: migrate from 'test' to 'classytest'
});

after(() => {
    Log.info('GlobalSpec::after() - done.');
    process.exit();
});
