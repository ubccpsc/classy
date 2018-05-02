import "mocha";

import {Config} from "../../common/Config";
import Log from "../../common/Log";



before(async () => {
    Log.info('GlobalSpec::before()');

    Config.getInstance();
    (<any>Config.getInstance()).config.org = 'test'; // force testing in test environment
    (<any>Config.getInstance()).config.name = 'test'; // force testing in test environment

    // let db = DatabaseController.getInstance();
    // await db.clearData(); // nuke everything
});

after(() => {
    Log.info('GlobalSpec::after()');
    // process.exit();
});
