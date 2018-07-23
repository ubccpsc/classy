import {expect} from "chai";
import "mocha";

import Config, {ConfigCourses, ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";

import {DatabaseController} from "../src/controllers/DatabaseController";

before(async () => {
    Log.info('GlobalSpec::before() - start');

    Config.getInstance();

    Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest); // force testing env

    // Test.ORGNAME = Config.getInstance().getProp(ConfigKey.testorg);
    // Log.info('GlobalSpec::before() - org: ' + Test.ORGNAME);

    let db = DatabaseController.getInstance();
    await db.clearData(); // nuke everything

    Log.info('GlobalSpec::before() - done');
});

after(() => {
    Log.info('GlobalSpec::after()');
    // process.exit();
});

export class Test {

//    public static ORGNAME = "NOTSETYET"; // TODO: fix this

    public static readonly TEAMNAME1 = 'TESTteam1';
    public static readonly TEAMNAME2 = 'TESTteam2';

    public static readonly USERNAMEADMIN = 'ubcbot'; // should be admin on any test org
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
