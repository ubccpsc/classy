import {expect} from "chai";
import * as fs from "fs-extra";
import FSUtil from "../src/util/FSUtil";

describe("FSUtil", () => {
    it("Should create a tarball", (done) => {
        const writer = fs.createWriteStream("./data.tar");
        writer.on("error", (err) => {
            expect.fail();
        });
        writer.on("finish", () => done());
        FSUtil.tar("./data").pipe(writer);
    });
    it.only("Should create a zip from tarball", async () => {
        const zip = await FSUtil.zip("data.tar", FSUtil.tar("./data"));
        await fs.outputFile("./data.tar.zip", zip);
    });
    it("Should zip a file", async () => {
        const filename: string = "test/FSUtilSpec.ts";
        const zip: Uint8Array = await FSUtil.zipFile(filename);
        await fs.outputFile("./data/test.zip", zip);
    });
});
