import "mocha";

import Config, {ConfigCourses, ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {TestHarness} from "@common/test/TestHarness";

import {DatabaseController} from "@backend/controllers/DatabaseController";

import "@common/test/GlobalSpec"; // forward to common
// /**
//  *
//  * TODO: This should have a different name (or be merged with) @common/test/GlobalSpec
//  *
//  */
// if (typeof it === "function") {
//     // only if we're running in mocha
//     before(async () => {
//         Log.info("GlobalSpec::before() - start");
//         Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest); // force testing env
//
//         const db = DatabaseController.getInstance();
//         await db.clearData(); // nuke everything
//
//         Log.info("GlobalSpec::before() - done");
//     });
//
//     after(async () => {
//         Log.info("GlobalSpec::after() - start");
//         await TestHarness.prepareAll();
//         Log.info("GlobalSpec::after() - done");
//     });
//
//     beforeEach(function () {
//         TestHarness.testBefore(this);
//     });
//
//     afterEach(function () {
//         TestHarness.testAfter(this);
//     });
// }
