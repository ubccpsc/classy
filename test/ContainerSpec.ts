import {expect} from "chai";
import Container from "../src/autotest/Container";
import {IContainerProperties} from "../src/Types";
import Log from "../src/util/Log";

describe("Container", () => {
    const images = {
        valid: "bb8d53afabff",
    };
    let container: Container;

    beforeEach(() => {
        container = new Container(images[`valid`]);
    });

    describe("Container::create", () => {
        it("Should create a new container from a valid image with no options specified.");
        it("Should create a new container from a valid image with env option.");
        it("Should create a new container from a valid image with envFile option.");
        it("Should create a new container from a valid image with volumes option.");
        it("Should create a new container from a valid image when extra options are specified.");
        it("Should fail to create a new container from an non-existent image.");
    });

    describe("Container::remove", () => {
        it("Should remove a container that exists.");
        it("Should fail to remove a container that has not been created.");
    });

    describe("Container::start", () => {
        it("Should start a container that exists and isn't running.");
        it("Should start a container that exists, has run before, but isn't currently running.");
        it("Should fail to start a container that has not been created.");
        it("Should fail to start a container that is currently running.");
        it("Should kill a container that exceeds the timeout.");
        it("Should run a container that previously timed out");
    });

    describe("Container::getLog", () => {
        it("Should return a full stdio transcript from a previously run container.");
        it("Should only return the stdio of the latest run of the container.");
        it("Should limit the output from the end when the tail option is specified.");
        it("Should limit the output from the beginning when the size option is specified.");
        it("Should limit the output when both the tail and size option are specified.");
        it(`Should fail to return a log for a container that has not been created.`, async () => {
            let result: any;
            try {
                result = await container.getLog();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.instanceof(Error);
                expect(result.message).to.equal(`Error response from daemon: No such container: undefined\n`);
            }
        });
    });

    describe("Container::getProperties", () => {
        it("Should return a JSON object for the container.", async () => {
            let result: any;
            try {
                await container.create();
                result = await container.getProperties();
            } catch (err) {
                Log.error(`Unexpected error ${err}`);
            } finally {
                expect(result).to.have.lengthOf(1);
                expect(result[0]).to.have.property(`Id`);
            }
        });
        it("Should fail if the container has not been created.", async () => {
            const errMsg: string = `Command failed: docker inspect undefined\nError: No such object: undefined\n`;
            let result: any;
            try {
                result = await container.getProperties();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.instanceof(Error);
                expect(result.message).to.equal(errMsg);
            }
        });
    });
});
