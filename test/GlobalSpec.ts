import "mocha";

import {Config} from "../src/Config";
import Log from "../src/util/Log";
import {DatabaseController} from "../src/controllers/DatabaseController";

before(async () => {
    Log.info('GlobalSpec::before()');
    const CONFIG = 'secapstonetest';
    Config.getInstance(CONFIG);
    let db = DatabaseController.getInstance();
    await db.clearData(); // nuke everything
});

after(() => {
    Log.info('GlobalSpec::after()');
    process.exit();
});
