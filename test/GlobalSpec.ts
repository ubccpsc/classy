import "mocha";

import {Config} from "../src/Config";
import Log from "../src/util/Log";
import {DatabaseController} from "../src/controllers/DatabaseController";


before(async () => {
    Log.info('GlobalSpec::before()');
    const CONFIG = 'secapstonetest';
    Config.getInstance(CONFIG);
    Test.ORGNAME = Config.getInstance().getProp('org');
    let db = DatabaseController.getInstance();
    await db.clearData(); // nuke everything
});

after(() => {
    Log.info('GlobalSpec::after()');
    process.exit();
});

export class Test {

    public static ORGNAME = "NOTSETYET";

    public static readonly TEAMNAME1 = 'team1';
    public static readonly TEAMNAME2 = 'team2';

    public static readonly USERNAME1 = 'user1';
    public static readonly USERNAME2 = 'user2';
    public static readonly USERNAME3 = 'user3';

    public static readonly DELIVID0 = 'd0';
    public static readonly DELIVID1 = 'd1';
    public static readonly DELIVID2 = 'd2';

    public static readonly REPONAME1 = 'repo1';
    public static readonly REPONAME2 = 'repo2';

}