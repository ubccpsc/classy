// import { use as chaiUse } from 'chai';
import {use as chaiUse, expect} from "chai";
import * as chaiAsPromised from "chai-as-promised";
import "mocha";

import Log from "../../../common/Log";
import {Factory} from "../src/Factory";

import './GlobalSpec';
import Config, {ConfigKey} from "@common/Config";

chaiUse(chaiAsPromised);

describe('Factory', function () {

    /**
     * These are all terrible tests and just make sure that _some_ object is returned.
     */
    it('Can get the route handler for courses', async function () {
        let actual = Factory.getCustomRouteHandler('classytest');
        expect(actual).to.not.be.null;

        actual = Factory.getCustomRouteHandler('sdmm');
        expect(actual).to.not.be.null;

        actual = Factory.getCustomRouteHandler('cs310');
        expect(actual).to.not.be.null;

        actual = Factory.getCustomRouteHandler('cs340');
        expect(actual).to.not.be.null;

        actual = null;
        let ex = null;
        try {
            actual = Factory.getCustomRouteHandler('INVALIDcourseNAME');
        } catch (err) {
            ex = err;
        }
        expect(actual).to.not.be.null; // NoRouteHandler
        expect(ex).to.be.null;
    });

    it('Can get the course controller for courses', async function () {
        // should be able to get our test controller
        const actual = await Factory.getCourseController(null, 'classytest');
        Log.test("Controller should not be null: " + actual);
        expect(actual).to.not.be.null;
    });

    it('Invalid plugins should be handled gracefully', async function () {
        const pluginVal = Config.getInstance().getProp(ConfigKey.plugin);
        Config.getInstance().setProp(ConfigKey.plugin, "INVALIDPLUGIN");

        Log.test("1");
        await expect(Factory.getCustomRouteHandler('INVALID_PLUGIN')).to.eventually.throw;
        Log.test("2");
        await expect(Factory.getCourseController(null, 'INVALID_PLUGIN')).to.eventually.throw;
        Log.test("3");
        await expect(Factory.getCourseController(undefined, undefined)).to.eventually.throw;
        Log.test("4");

        Config.getInstance().setProp(ConfigKey.plugin, pluginVal);
    });

});
