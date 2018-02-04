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

    describe("Container::create", () => {
        it("Should create a new container from a valid image SHA with no options specified.", async () => {
            let result;
            try {
                result = await container.create();
            } catch (err) {
                result = err;
            } finally {
               expect(result).to.be.undefined;
            }
        });
        it(`Should create a new container from a valid image tag with no options specified.`, async () => {
            let result;
            try {
                const cnt: DockerContainer = new DockerContainer(tag);
                result = await cnt.create();
                await cnt.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.undefined;
            }
        });
        it("Should create a new container from a valid image with env option.", async () => {
            let result;
            try {
                result = await container.create({env: {HELLO: "WORLD"}});
                await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.undefined;
            }
        });
        it("Should create a new container from a valid image with envFile option.", async () => {
            let result;
            try {
                result = await container.create({envFile: `${__dirname}/container/test.env`});
                await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.undefined;
            }
        });
        it("Should create a new container from a valid image with volumes option.", async () => {
            let result;
            try {
                result = await container.create({volumes: [`/host/path:/container/path:ro`]});
                await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.undefined;
            }
        });
        it("Should create a new container from a valid image when extra options are specified.", async () => {
            let result;
            try {
                result = await container.create({other: `option`} as IDockerContainerOptions);
                await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.undefined;
            }
        });
        it("Should fail to create a new container from an non-existent image.", async () => {
            let result;
            try {
                const invContainer = new DockerContainer("fake-image-123");
                result = await invContainer.create();
                await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.instanceof(Error);
                expect(result.message).to.equal(`Error response from daemon: repository fake-image-123 not found: does not exist or no pull access\n`);
            }
        });
        it(`Should fail to create a new container if Docker isn't found on the path.`);
    });

    describe("Container::remove", () => {
        it("Should remove a container that exists.", async () => {
            let result;
            try {
                await container.create();
                result = await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.undefined;
            }
        });
        it("Should fail to remove a container that has not been created.", async () => {
            let result;
            try {
                result = await container.remove();
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.instanceof(Error);
                expect(result.message).to.equal(`Command failed: docker rm undefined\nError response from daemon: No such container: undefined\n`);
            }
        });
    });

    describe("Container::start", function () {
        this.timeout(6000);

        it("Should start a container that exists and isn't running.", async () => {
            let code: number;
            try {
                await container.create();
                code = await container.start();
            } catch (err) {
                code = err;
            } finally {
                expect(code).to.equal(0);
            }
        });
        it("Should start a container that exists, has run before, but isn't currently running.", async () => {
            let code: number;
            try {
                await container.create();
                await container.start();
                code = await container.start();
            } catch (err) {
                code = err;
            } finally {
                expect(code).to.equal(0);
            }
        });
        it("Should should ignore requests to start a container that is already running.", async () => {
            await container.create();
            const p = container.start().catch((err) => {
                expect.fail();
            });
            const result = await container.start();
            await p;
            expect(result).to.equal(0);
        });
        it("Should fail to start a container that has not been created.", async () => {
            let code: number;
            try {
                code = await container.start();
            } catch (err) {
                code = err;
            } finally {
                expect(code).to.equal(1);
            }
        });
        it("Should send SIGTERM to a container that exceeds the timeout.", async () => {
            let trapSha;
            let result;
            try {
                trapSha = await createImage("traptest", `${__dirname}/container/sig-handling`);
                const cnt = new DockerContainer(trapSha);
                await cnt.create({env: {EXIT_ON_SIGTERM: true}});
                result = await cnt.start(1000);
                // console.log(await cnt.getLog());
            } catch (err) {
                result = err;
            } finally {
                try {
                    await removeImage(trapSha);
                } catch (err) {
                    // Do nothing
                }
                expect(result).to.equal(143);
            }
        }).timeout(20000);
        it(`Should send SIGKILL to a container that does not terminate after SIGTERM.`, async () => {
            let trapSha;
            let result;
            try {
                trapSha = await createImage("traptest2", `${__dirname}/container/sig-handling`);
                const cnt = new DockerContainer(trapSha);
                await cnt.create();
                result = await cnt.start(1000);
            } catch (err) {
                result = err;
            } finally {
                try {
                    await removeImage(trapSha);
                } catch (err) {
                    // Do nothing
                }
                expect(result).to.equal(128 + 9);  // terminated (128) + sigkill (9)
            }
        }).timeout(20000);
    });

    describe("Container::getLog", function () {
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
            let log: any;
            try {
                log = await logContainer.getLog();
            } catch (err) {
                log = err;
            } finally {
                expect(log).to.equal(`line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\n`);
            }
        });
        it("Should only return the stdio from all runs of the container.", async () => {
            let log: any;
            try {
                await logContainer.start();
                log = await logContainer.getLog();
            } catch (err) {
                log = err;
            } finally {
                expect(log).to.equal(`line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\n`.repeat(2));
            }
        });
        it("Should limit the output from the end when the tail option is specified.", async () => {
            let log: any;
            try {
                await logContainer.start();
                log = await logContainer.getLog(2);
            } catch (err) {
                log = err;
            } finally {
                expect(log).to.equal(`line 9\nline 10\n`);
            }
        });
        it("Should limit the output from the beginning when the size option is specified.", async () => {
            let log: any;
            try {
                await logContainer.start();
                log = await logContainer.getLog(-1, 24);
            } catch (err) {
                log = err;
            } finally {
                expect(log).to.equal(`line 1\n--- Truncated ---`);
            }
        });
        it("Should limit the output when both the tail and size option are specified.", async () => {
            let log: any;
            try {
                await logContainer.start();
                log = await logContainer.getLog(9, 24);
            } catch (err) {
                log = err;
            } finally {
                expect(log).to.equal(`line 2\n--- Truncated ---`);
            }
        });
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

    describe(`Container::getStatus`, () => {
        it(`Should have status created when the container has been created but not run.`, async () => {
            let status: any;
            try {
                await container.create();
                status = await container.getStatus();
            } catch (err) {
                status = err;
            } finally {
                expect(status).to.equal(0);
            }
        });
        it(`Should have status running when the container is still executing.`, async () => {
            let status: any;
            try {
                await container.create();
                const p = container.start();
                status = await new Promise((resolve) => {
                  setTimeout(async () => {
                      resolve(await container.getStatus());
                  }, 500);
                });
                await p;
            } catch (err) {
                status = err;
            } finally {
                expect(status).to.equal(2);
            }
        });
        it(`Should have status status exited after the container has terminated.`, async () => {
            let status: any;
            try {
                await container.create();
                await container.start();
                status = await container.getStatus();
            } catch (err) {
                status = err;
            } finally {
                expect(status).to.equal(5);
            }
        });
        it(`Should fail if the container does not exist.`, async () => {
            let status: any;
            try {
                status = await container.getStatus();
            } catch (err) {
                status = err;
            } finally {
                expect(status).to.be.instanceof(Error);
                expect(status.message).to.equal(`Failed to get container status. `);
            }
        });
    });
});
