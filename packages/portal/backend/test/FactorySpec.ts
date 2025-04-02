// import { use as chaiUse } from "chai";
import { expect, use as chaiUse } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import "mocha";

import Log from "@common/Log";
import Config, { ConfigKey } from "@common/Config";

import { Factory } from "@backend/Factory";

import "@common/GlobalSpec";

chaiUse(chaiAsPromised);

describe("Factory", function () {
	/**
	 * These are all terrible tests and just make sure that _some_ object is returned.
	 */
	it("Can get the route handler for courses", async function () {
		let actual = Factory.getCustomRouteHandler("classytest");
		expect(actual).to.not.be.null;

		actual = Factory.getCustomRouteHandler("sdmm");
		expect(actual).to.not.be.null;

		actual = Factory.getCustomRouteHandler("cs310");
		expect(actual).to.not.be.null;

		actual = Factory.getCustomRouteHandler("cs340");
		expect(actual).to.not.be.null;

		actual = null;
		let ex = null;
		try {
			actual = Factory.getCustomRouteHandler("INVALIDcourseNAME");
		} catch (err) {
			ex = err;
		}
		expect(actual).to.not.be.null; // NoRouteHandler
		expect(ex).to.be.null;
	});

	it("Can get the course controller for courses", async function () {
		// should be able to get our test controller
		const actual = await Factory.getCourseController(null, "classytest");
		Log.test("Controller should not be null: " + actual);
		expect(actual).to.not.be.null;
	});

	it("Invalid plugins should be handled gracefully", async function () {
		const pluginVal = Config.getInstance().getProp(ConfigKey.plugin);
		Config.getInstance().setProp(ConfigKey.plugin, "INVALIDPLUGIN");

		await expect(Factory.getCustomRouteHandler("INVALID_PLUGIN")).to.eventually.throw;
		await expect(Factory.getCourseController(null, "INVALID_PLUGIN")).to.eventually.throw;
		await expect(Factory.getCourseController(undefined, undefined)).to.eventually.throw;

		Config.getInstance().setProp(ConfigKey.plugin, pluginVal);
	});
});
