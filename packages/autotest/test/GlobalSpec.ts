import "mocha";

import Config, {ConfigKey} from "../../common/Config";
import Log from "../../common/Log";

before(async () => {
    Log.info('GlobalSpec::before()');

    Config.getInstance().setProp(ConfigKey.org, 'test');
    Config.getInstance().setProp(ConfigKey.name, 'test');
});

after(() => {
    Log.info('GlobalSpec::after()');
    process.exit();
});
