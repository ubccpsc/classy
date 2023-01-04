import {expect} from "chai";
import "mocha";
import * as restify from "restify";
import * as request from "supertest";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {TestHarness} from "@common/TestHarness";
import Server from "@autotest/server/Server";
import {DatabaseController} from "@backend/controllers/DatabaseController";

describe("AutoTest Server", function () {

    const TIMEOUT = 5000;
    let app: restify.Server = null;
    let server: Server = null;

    before(async () => {
        Log.test("AutoTestServerSpec::before - start");

        await TestHarness.suiteBefore("AutoTestServerSpec");
        await TestHarness.prepareAll();

        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
        Config.getInstance().setProp(ConfigKey.name, Config.getInstance().getProp(ConfigKey.testname));

        DatabaseController.getInstance(); // invoke early
        // await db.clearData(); // nuke everything

        // NOTE: need to start up server WITHOUT HTTPS for testing or strange errors crop up
        server = new Server();

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

    it("Should be able to list docker images", async function () {
        const url = "/docker/images";
        let res: any;
        try {
            Log.test("requesting docker listing");
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

    it("Should be able to create a docker image", async function () {
        const url = "/docker/image";
        const reqBody = {remote: "https://github.com/minidocks/base.git", tag: "", file: ""};

        let output = "";

        const streamParser = function (streamRes: any, callback: any) {
            streamRes.data = "";
            streamRes.on("data", function (chunk: any) {
                chunk = chunk.toString();
                Log.test("Chunk received: " + chunk);
                const chunkLines = chunk.split("\n");
                output += chunkLines.join("");

            });
            streamRes.on("end", function () {
                // callback(null, new Buffer(res.data, 'binary'));
                Log.test("DONE w/ stream; data:\n" + output);
                callback(null, output, "text");
            });
        };

        let res: any;
        try {
            Log.test("requesting image creation");
            res = await request(app).post(url)
                .set("user", TestHarness.ADMIN1.github)
                .parse(streamParser)
                .send(reqBody);
            Log.test("image creation requested");
        } catch (err) {
            Log.error("Error encountered", err.message);
            res = err;
        } finally {
            Log.test("Stream data: " + output);
            expect(res.status).to.equal(200);
            expect(output).to.contain("Successfully built");
        }
    }).timeout(TIMEOUT * 5);

    it("Should fail to create a docker image for a bad remote", async function () {
        const url = "/docker/image";
        const reqBody = {remote: "https://github.com/INVALID/base.git", tag: "", file: ""};

        let output = "";

        const streamParser = function (streamRes: any, callback: any) {
            streamRes.data = "";
            streamRes.on("data", function (chunk: any) {
                chunk = chunk.toString();
                Log.test("Chunk received: " + chunk);
                const chunkLines = chunk.split("\n");
                output += chunkLines.join("");
            });
            streamRes.on("end", function () {
                // callback(null, new Buffer(res.data, 'binary'));
                Log.test("DONE w/ stream; data:\n" + output);
                callback(null, output, "text");
            });
        };

        let res: any;
        try {
            Log.test("requesting image creation");
            res = await request(app).post(url)
                .set("user", TestHarness.ADMIN1.github)
                .parse(streamParser)
                .send(reqBody);
            Log.test("image creation requested");
        } catch (err) {
            Log.error("Error encountered", err.message);
            res = err;
        } finally {
            Log.test("Stream data: " + output);
            expect(res.status).to.equal(200);
            expect(res).to.haveOwnProperty("status");
            expect(output).to.contain("error fetching");
        }
    }).timeout(TIMEOUT * 5);

});
