import {expect} from "chai";
import "mocha";
import * as restify from "restify";
import * as request from "supertest";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {TestHarness} from "@common/TestHarness";
import AutoTestServer from "@autotest/server/AutoTestServer";
import {DatabaseController} from "@backend/controllers/DatabaseController";

describe("AutoTest AutoTestServer", function () {

    const TIMEOUT = 1000;
    let app: restify.Server = null;
    let server: AutoTestServer = null;

    before(async () => {
        Log.test("AutoTestServerSpec::before - start");

        await TestHarness.suiteBefore("AutoTestServerSpec");
        await TestHarness.prepareAll();

        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
        Config.getInstance().setProp(ConfigKey.name, Config.getInstance().getProp(ConfigKey.testname));

        DatabaseController.getInstance(); // invoke early
        // await db.clearData(); // nuke everything

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new AutoTestServer();

        try {
            await server.start();
            Log.test("AutoTestServerSpec::before - server started");
            // Log.test("orgName: " + Test.ORGNAME);
            app = server.getServer();
        } catch (err) {
            Log.test("AutoTestServerSpec::before - server might already be started: " + err);
        }
        expect(app).to.not.be.null; // this is a terrible assert but need some indication (other than log output) that this failed.
    });

    async function createImage(opts: any) {
        Log.test("createImage(); start");

        let output = "";
        const streamParser = function (streamRes: any, callback: any) {
            streamRes.data = "";
            streamRes.on("data", function (chunk: any) {
                chunk = chunk.toString();
                Log.test("createImage(); chunk received: " + chunk);
                output = output + chunk;

            });
            streamRes.on("end", function () {
                Log.test("createImage(); done - data:\n" + output);
                callback(null, output, "text");
            });
        };

        Log.test("createImage(); requesting image creation");
        const url = "/docker/image";
        const res = await request(app).post(url)
            .set("user", TestHarness.ADMIN1.github)
            .parse(streamParser)
            .send(opts);

        Log.test("createImage(); image creation requested");

        return {res: res, output: output};
    }

    it("Should be able to list docker images.", async function () {
        let res: any;
        try {
            Log.test("requesting docker listing");
            const url = "/docker/images";
            res = await request(app).get(url).set("user", TestHarness.ADMIN1.github);
            Log.test("docker listing returned");
        } catch (err) {
            res = err;
        } finally {
            const body = res.body;
            Log.test("Docker images: " + JSON.stringify(body));
            expect(res.status).to.equal(200);
            expect(body).to.be.an("Array");
        }
    });

    it("Should successfully create a docker image.", async function () {
        // this will be slow the first time (~5 minutes), but fast thereafter (~5 seconds)
        // once docker has cached the image

        // this test cannot pass on CircleCI, and is for localhost testing only
        if (TestHarness.isCI() === true) {
            this.skip();
        }

        // valid opts
        const opts = {
            remote: "https://github.com/minidocks/base.git",
            tag: "grader",
            file: "Dockerfile"
        };

        let res;
        let output;
        try {
            const retVal = await createImage(opts);
            res = retVal.res;
            output = retVal.output;
        } catch (err) {
            Log.error("Error encountered", err.message);
            res = err;
        } finally {
            Log.test("Stream data: " + output);
            expect(res.status).to.equal(200);
            expect(output).to.contain("Successfully built");
        }
    }).timeout(TIMEOUT * 60 * 10);

    it("Should fail to create a docker image for a bad remote.", async function () {
        // this test cannot pass on CircleCI, but works great locally
        if (TestHarness.isCI() === true) {
            this.skip();
        }

        // invalid repo
        const opts = {
            remote: "https://github.com/INVALID/base.git",
            tag: "tagname",
            file: "Dockerfile"
        };

        let res;
        let output;
        try {
            const retVal = await createImage(opts);
            res = retVal.res;
            output = retVal.output;
        } catch (err) {
            Log.error("Error encountered", err.message);
            res = err;
        } finally {
            Log.test("Stream data: " + output);
            expect(res.status).to.equal(200);
            expect(res).to.haveOwnProperty("status");
            expect(output).to.contain("error fetching");
        }
    }).timeout(TIMEOUT * 10);

    xit("Should be able to remove a docker image.", async function () {
        let res: any;
        try {
            // this test cannot pass on CircleCI (also not working locally though)
            if (TestHarness.isCI() === true) {
                this.skip();
            }

            Log.test("Requesting docker listing");
            const getUrl = "/docker/images?filters={\"reference\":[\"grader\"]}";
            res = await request(app).get(getUrl).set("user", TestHarness.ADMIN1.github);
            const dockerListing = res.body;
            Log.test("Docker listing returned: " + JSON.stringify(dockerListing));
            expect(dockerListing.length).to.be.greaterThan(0);

            const imgId = dockerListing[0].Id;
            let delUrl = "/docker/image/";
            delUrl = delUrl + imgId;

            const atSecret = Config.getInstance().getProp(ConfigKey.autotestSecret);

            // NOTE: right now this test always fails because the image we have created has "dependent child images"
            res = await request(app).del(delUrl).set("user", TestHarness.ADMIN1.github).set("token", atSecret);
            Log.test("Docker image removed");
        } catch (err) {
            res = err;
        } finally {
            const body = res.body;
            Log.test("Docker image removal body: " + JSON.stringify(body));
            expect(res.status).to.equal(200);
            expect(body).to.be.an("Array");
        }
    });

    xit("Should fail to remove a docker image for an invalid user.", async function () {
        let res: any;
        // this test cannot pass on CircleCI, but works great locally
        if (TestHarness.isCI() === true) {
            this.skip();
        }

        try {
            Log.test("Requesting docker listing");
            const getUrl = "/docker/images?filters={\"reference\":[\"grader\"]}";
            res = await request(app).get(getUrl).set("user", TestHarness.ADMIN1.github);
            const dockerListing = res.body;
            Log.test("Docker listing returned: " + JSON.stringify(dockerListing));
            expect(dockerListing.length).to.be.greaterThan(0);

            const imgId = dockerListing[0].Id;
            const delUrl = "/docker/image/" + imgId;
            res = await request(app).del(delUrl).set("user", TestHarness.USER1.github);
            Log.test("docker image should not removed (invalid user)");
        } catch (err) {
            res = err;
        } finally {
            const body = res.body;
            Log.test("Docker image removal body: " + JSON.stringify(body));
            expect(res.status).to.equal(403);
        }
    });

});
