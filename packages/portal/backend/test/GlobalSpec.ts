import {expect} from "chai";
import "mocha";

import Config, {ConfigCourses, ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {Test} from "../../../common/TestHarness";

import {DatabaseController} from "../src/controllers/DatabaseController";

if (typeof it === 'function') {
    // only if we're running in mocha
    before(async () => {
        Log.info('GlobalSpec::before() - start');

        Config.getInstance();

        Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest); // force testing env

        const db = DatabaseController.getInstance();
        await db.clearData(); // nuke everything

        Log.info('GlobalSpec::before() - done');
    });

    after(async () => {
        Log.info('GlobalSpec::after() - start');
        await Test.prepareAll();
        Log.info('GlobalSpec::after() - done');
    });

    beforeEach(function() {
        Test.testBefore(this);
    });

    afterEach(function() {
        Test.testAfter(this);
    });
}
