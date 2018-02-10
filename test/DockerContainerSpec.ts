/* tslint:disable:no-unused-expression */
import {expect} from "chai";
import {ChildProcess, spawn} from "child_process";
import DockerContainer from "../src/docker/DockerContainer";
import {IDockerContainerOptions} from "../src/docker/DockerTypes";
import Log from "../src/util/Log";

describe("DockerContainer", () => {
    let sha: string;
    let tag: string;
    let container: DockerContainer;

    function createImage(name: string, dockerfileDir: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let img: string;
            const cmd: ChildProcess = spawn(`docker`, [`build`, `--tag`, name, dockerfileDir]);
            cmd.stdout.on(`data`, (data) => {
                const stdout: string = data.toString();
                const matches = stdout.match(/^Successfully built (\w+)$/m);
                if (matches !== null && matches.length > 1) {
                    img = matches[1];
                }
            });
            cmd.stderr.on(`data`, (data) => Log.warn(data.toString()));
            cmd.on(`error`, (error) => {
                reject(error);
            });
            cmd.on(`close`, (code) => {
                if (code === 0) {
                    resolve(img);
                } else {
                    reject(new Error(`docker build failed with code ${code}.`));
                }
            });
        });
    }

    function removeImage(img: string) {
        return new Promise<void>((resolve, reject) => {
            const cmd: ChildProcess = spawn(`docker`, [`rmi`, `--force`, img]);
            cmd.stdout.on(`data`, (data) => Log.info(data.toString()));
            cmd.stderr.on(`data`, (data) => Log.warn(data.toString()));
            cmd.on(`error`, (error) => {
                reject(error);
            });
            cmd.on(`close`, (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`docker rmi failed with code ${code}.`));
                }
            });
        });
    }

    before(async () => {
        tag = `autotest-test-img`;
        sha = await createImage(tag, `${__dirname}/container`);
    });

    beforeEach(() => {
        container = new DockerContainer(sha);
    });

    afterEach(async () => {
        try {
            await container.remove();
        } catch (err) {
            // Do nothing
        }
    });

    after(async () => {
        await removeImage(sha);
    });

    describe("create", () => {
        it("Should create a new container from a valid image SHA with no options specified.", async () => {
            let result: any;
            try {
                result = await container.create();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.equal(0);
                expect(result.output).to.be.a("string").with.length(64);
            }
        });
        it("Should create a new container from a valid image tag with no options specified.", async () => {
            let result: any;
            try {
                const cnt: DockerContainer = new DockerContainer(tag);
                result = await cnt.create();
                await cnt.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.equal(0);
                expect(result.output).to.be.a("string").with.length(64);
            }
        });
        it("Should create a new container from a valid image with a single option.", async () => {
            const opts: IDockerContainerOptions[] = [{ name: "--env", value: "HELLO=WORLD" }];
            let result: any;
            try {
                result = await container.create(opts);
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.equal(0);
                expect(result.output).to.be.a("string").with.length(64);
            }
        });
        it("Should create a new container from a valid image with common options.", async () => {
            const opts: IDockerContainerOptions[] = [
                { name: "--env", value: "HELLO=WORLD" },
                { name: "-e", value: "FOO=BAR" },
                { name: "--env-file", value: `${__dirname}/container/test.env` },
                { name: "--volume", value: "/host/path:/container/path:ro" }
            ];
            let result: any;
            try {
                result = await container.create(opts);
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.equal(0);
                expect(result.output).to.be.a("string").with.length(64);
            }
        });
        it("Should fail to create a new container from an non-existent image.", async () => {
            let result: any;
            try {
                const invContainer = new DockerContainer("fake-image-123");
                result = await invContainer.create();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.be.greaterThan(0);
                expect(result.output).to.contain(`Error response from daemon: repository fake-image-123 not found: does not exist or no pull access`);
            }
        });
        it("Should fail create a new container from a valid image with an invalid option.", async () => {
            const opts: IDockerContainerOptions[] = [{ name: "--bad", value: "HELLO=WORLD" }];
            let result: any;
            try {
                result = await container.create(opts);
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.be.greaterThan(0);
                expect(result.output).to.be.a("string").and.contain("unknown flag");
            }
        });
    });

    describe("inspect", () => {
        it("Should return a JSON object for the container.", async () => {
            let result: any;
            try {
                await container.create();
                result = await container.inspect();
                result.output = JSON.parse(result.output)[0];
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.equal(0);
                expect(result.output).to.have.property("Id");
            }
        });
        it("Should return the container properties in the specified format.", async () => {
            const format: string = "{{.Id}}";
            let result: any;
            try {
                await container.create();
                result = await container.inspect(format);
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.equal(0);
                expect(result.output).to.be.a("string").with.length(64);
            }
        });
        it("Should fail if the container has not been created.", async () => {
            const errMsg: string = `Error: No such object: undefined`;
            let result: any;
            try {
                result = await container.inspect();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.not.be.instanceof(Error);
                expect(result.code).to.be.greaterThan(0);
                expect(result.output).to.equal(errMsg);
            }
        });
    });

    describe("getLog", function () {
        this.timeout(5000);
        let logSha: string;
        let logContainer: DockerContainer;

        before(async () => {
            logSha = await createImage(`logger`, `${__dirname}/container/logging`);
        });

        beforeEach(async () => {
            logContainer = new DockerContainer(logSha);
            await logContainer.create();
            await logContainer.start();
            await logContainer.wait();
        });

        afterEach(async () => {
            await logContainer.remove();
        });

        after(async () => {
            try {
                await removeImage(logSha);
            } catch (err) {
                // Do nothing
            }
        });

        it("Should return a full stdio transcript from a previously run container.", async () => {
            let result: any;
            try {
                result = await logContainer.logs();
            } catch (err) {
                result = err;
            } finally {
                expect(result.output).to.equal("line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10");
            }
        });
        it("Should only return the stdio from all runs of the container.", async () => {
            let result: any;
            try {
                await logContainer.start();
                await logContainer.wait();
                result = await logContainer.logs();
            } catch (err) {
                result = err;
            } finally {
                expect(result.output).to.equal("line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\n".repeat(2).trim());
            }
        });
        it("Should limit the output from the end when the tail option is specified.", async () => {
            let result: any;
            try {
                await logContainer.start();
                await logContainer.wait();
                result = await logContainer.logs(2);
            } catch (err) {
                result = err;
            } finally {
                expect(result.output).to.equal("line 9\nline 10");
            }
        });
        it("Should fail to return a log for a container that has not been created.", async () => {
            let result: any;
            try {
                result = await container.logs();
            } catch (err) {
                result = err;
            } finally {
                expect(result.code).to.be.greaterThan(0);
                expect(result.output).to.equal("Error response from daemon: No such container: undefined");
            }
        });
    });

    describe("pause", () => {
        it("Should pause a running container", async () => {
            let status: string;
            let result: any;
            try {
                await container.create();
                await container.start();
                result = await container.pause();
                status = (await container.ps("{{.Status}}")).output;
                await container.unpause();
                await container.wait();
            } catch (err) {
                result = err;
            } finally {
                expect(result.code).to.equal(0);
                expect(status).to.equal("Up Less than a second (Paused)");
            }
        });
    });

    describe("ps", () => {
        // TODO
    });

    describe("unpause", () => {
        // TODO
    });

    describe("remove", () => {
        it("Should remove a container that exists.", async () => {
            let result;
            try {
                await container.create();
                result = await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result.code).to.equal(0);
            }
        });
        it("Should fail to remove a container that has not been created.", async () => {
            let result;
            try {
                result = await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result.code).to.be.greaterThan(0);
                expect(result.output).to.equal(`Error response from daemon: No such container: undefined`);
            }
        });
    });

    describe("start", function () {
        this.timeout(6000);

        it("Should start a container that exists and isn't running.", async () => {
            let result: any;
            try {
                await container.create();
                result = await container.start();
                await container.wait();
            } catch (err) {
                result = err;
            } finally {
                expect(result.code).to.equal(0);
                expect(result.output).to.be.a(`string`).with.length(64);
            }
        });
        it("Should start a container that exists, has run before, but isn't currently running.", async () => {
            let result: any;
            try {
                await container.create();
                await container.start();
                await container.wait();
                result = await container.start();
                await container.wait();
            } catch (err) {
                result = err;
            } finally {
                expect(result.code).to.equal(0);
                expect(result.output).to.be.a(`string`).with.length(64);
            }
        });
        it("Should should ignore requests to start a container that is already running.", async () => {
            await container.create();
            const contId1 = await container.start();
            const contId2 = await container.start();
            await container.wait();
            expect(contId1.output).to.equal(contId2.output);
        });
        it("Should fail to start a container that has not been created.", async () => {
            let result: any;
            try {
                result = await container.start();
            } catch (err) {
                result = err;
            } finally {
                expect(result.code).to.be.greaterThan(0);
                expect(result.output).to.equal("Error response from daemon: No such container: undefined\nError: failed to start containers: undefined");
            }
        });
    });

    describe("stop", () => {
        it("Should return the container exit code after sending SIGTERM.", async () => {
            let trapSha;
            let result;
            try {
                trapSha = await createImage("traptest", `${__dirname}/container/sig-handling`);
                const cnt = new DockerContainer(trapSha);
                await cnt.create([{ name: "--env", value: "EXIT_ON_SIGTERM=true" }]);
                await cnt.start();
                await new Promise((resolve) => { setTimeout(resolve, 2000)});
                result = await cnt.stop();
            } catch (err) {
                result = err;
            } finally {
                try {
                    await removeImage(trapSha);
                } catch (err) {
                    // Do nothing
                }
                expect(result.output).to.equal("143");
            }
        });

        it("Should return the container exit code after sending SIGKILL.", async () => {
            let trapSha;
            let result;
            try {
                trapSha = await createImage("traptest", `${__dirname}/container/sig-handling`);
                const cnt = new DockerContainer(trapSha);
                await cnt.create([{ name: "--env", value: "EXIT_ON_SIGTERM=false" }]);
                await cnt.start();
                await new Promise((resolve) => { setTimeout(resolve, 2000)});
                result = await cnt.stop(1);
            } catch (err) {
                result = err;
            } finally {
                try {
                    await removeImage(trapSha);
                } catch (err) {
                    // Do nothing
                }
                expect(result.output).to.equal("137");
            }
        });
    });

    describe("wait", () => {
        it("Should wait for a running container to complete successfully", async () => {
            let result;
            try {
                await container.create();
                await container.start();
                result = await container.wait();
            } catch (err) {
                result = err;
            } finally {
                expect(result.output).to.equal("0");
            }
        });
        it("Should wait for a container that completes unsuccessfully");
        it("Should send SIGTERM to a container that exceeds the timeout.", async () => {
            let trapSha;
            let result;
            try {
                trapSha = await createImage("traptest", `${__dirname}/container/sig-handling`);
                const cnt = new DockerContainer(trapSha);
                await cnt.create([{ name: "--env", value: "EXIT_ON_SIGTERM=true" }]);
                await cnt.start();
                result = await cnt.wait(1);
            } catch (err) {
                result = err;
            } finally {
                try {
                    await removeImage(trapSha);
                } catch (err) {
                    // Do nothing
                }
                expect(result.output).to.equal("143");
            }
        }).timeout(20000);
        it(`Should send SIGKILL to a container that does not terminate after SIGTERM.`, async () => {
            let trapSha;
            let result;
            try {
                trapSha = await createImage("traptest2", `${__dirname}/container/sig-handling`);
                const cnt = new DockerContainer(trapSha);
                await cnt.create();
                await cnt.start();
                result = await cnt.wait(1);
            } catch (err) {
                result = err;
            } finally {
                try {
                    await removeImage(trapSha);
                } catch (err) {
                    // Do nothing
                }
                expect(result.output).to.equal("137");  // terminated (128) + sigkill (9)
            }
        }).timeout(20000);
    });
});
