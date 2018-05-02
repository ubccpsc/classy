import "mocha";

import {Config} from "../../common/Config";
import Log from "../../common/Log";
import {DatabaseController} from "../src/controllers/DatabaseController";


before(async () => {
    Log.info('GlobalSpec::before()');

    Config.getInstance();
    (<any>Config.getInstance()).config.org = 'secapstonetest'; // force testing in test environment
    (<any>Config.getInstance()).config.name = 'secapstonetest'; // force testing in test environment

    Test.ORGNAME = Config.getInstance().getProp('org');
    Log.info('GlobalSpec::before() - org: ' + Test.ORGNAME);
    let db = DatabaseController.getInstance();
    await db.clearData(); // nuke everything
});

after(() => {
    Log.info('GlobalSpec::after()');
    process.exit();
});

export class Test {

    public static ORGNAME = "NOTSETYET";

    public static readonly TEAMNAME1 = 'TESTteam1';
    public static readonly TEAMNAME2 = 'TESTteam2';

    public static readonly USERNAME1 = 'user1';
    public static readonly USERNAME2 = 'user2';
    public static readonly USERNAME3 = 'user3';

    public static readonly USERNAMEGITHUB1 = "cpscbot";
    public static readonly USERNAMEGITHUB2 = "rthse2";
    public static readonly USERNAMEGITHUB3 = "ubcbot";

    public static readonly DELIVID0 = 'd0';
    public static readonly DELIVID1 = 'd1';
    public static readonly DELIVID2 = 'd2';
    public static readonly DELIVID3 = 'd3';

    public static readonly REPONAME1 = 'TESTrepo1';
    public static readonly REPONAME2 = 'TESTrepo2';
}
