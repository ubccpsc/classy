import { ChildProcess, exec, spawn, SpawnOptions } from "child_process";
import { setTimeout } from "timers";
import { IContainerOptions, IContainerProperties } from "../Types";
import Util from "../util/Util";

enum ContainerStatus {
    created,
    restarting,
    running,
    removing,
    paused,
    exited,
    dead
}

/**
 * Simple wrapper for Docker's container management commands with some basic extensions.
 */
export default class Container {
    public image: string;
    private _id: string;
    private _timestamp: number;

    /**
     * Assigns the image from which the container will be created. This does not create the Docker container. It is
     * recommended that a new instance of Container be create for each execution of the container.
     * @param image SHA or tag of Docker image from which to create container.
     */
    constructor(image: string) {
        this.image = image;
    }

    /**
     * Creates a container from the image with the specified options.
     * @param options The optional container configuration.
     * @returns a promise that resolves to the id of the created container.
     * @throws if the container has already been created, or if container creation failed.
     */
    public async create(options?: IContainerOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let errMsg: string;
            const cmdArgs: string[] = [`create`, `--cap-add=NET_ADMIN`];
            if (typeof options !== `undefined`) {
                this.dockerOptionsToArgs(options, cmdArgs);
            }
            cmdArgs.push(this.image);
            const cmd: ChildProcess = spawn(`docker`, cmdArgs);

            cmd.stdout.on(`data`, (data) => this._id = data.toString().trim());
            cmd.stderr.on(`data`, (data) => errMsg = data.toString());
            cmd.on(`error`, (err) => {
               reject(err);
            });
            cmd.on(`close`, (code, signal) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(errMsg));
                }
            });
        });
    }

    /**
     * Returns the stdio from the container. If the container is run multiple times, output from all runs will be returned.
     * @param tail Number of lines to show from end of log. Passed directly to docker logs.
     * @param size Number of bytes to keep from the log after tail has been applied.
     * @throws When the container does not exist.
     */
    public async getLog(tail: number = -1, size: number = 131072): Promise<string> {
        let pageSize: number = 4096;
        if (size < 4096) {
            pageSize = size;
        }

        const cmdArgs = [`logs`, `--tail=${tail}`, this._id];
        try {
            const cmd = await Util.bufferedSpawn(`docker`, cmdArgs, {}, size, pageSize);
            return cmd.output;
        } catch (err) {
            throw new Error(err.output);
        }
    }

    /**
     * Gets the container properties from Docker. Certain fields are only set while the container is running.
     * @throws When the container does not exist.
     */
    public async getProperties(): Promise<IContainerProperties> {
        return new Promise<IContainerProperties>((resolve, reject) => {
            exec(`docker inspect ${this._id}`, (error, stdout, stderr) => {
                let parsedOutput: IContainerProperties;
                if (error) {
                    reject(error);
                }

                try {
                    parsedOutput = JSON.parse(stdout);
                    resolve(parsedOutput);
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    /**
     * Gets the status of the container.
     * @returns {Promise<ContainerStatus>}
     */
    public getStatus(): Promise<ContainerStatus> {
        return new Promise<ContainerStatus>((resolve, reject) => {
            exec(`docker ps --all --filter id=${this._id} --format "{{.Status}}"`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                let cliStatus: string = "";
                if (typeof stdout === `string`) {
                    cliStatus = stdout.trim();

                    if (cliStatus === "Up Less than a second") {
                        cliStatus = "running";
                    } else if (cliStatus.startsWith("Exited")) {
                        cliStatus = "exited";
                    }
                }
                const status: ContainerStatus | undefined = (ContainerStatus as any)[cliStatus.toLocaleLowerCase()];
                if (typeof status !== `undefined`) {
                    resolve(status);
                } else {
                    reject(new Error(`Failed to get container status. ${stderr}`));
                }
            });
        });
    }

    /**
     * Removes the completed container from disk, freeing its resources. Once removed, getLogs and getProperties will fail.
     * This method *MUST* be called if create is called to free resources.
     * @throws When the container does not exist.
     */
    public async remove(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            exec(`docker rm ${this._id}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                resolve();
            });
        });
    }

    /**
     * Starts the created container.
     * @param timeout The duration for which the container is allowed to execute, after which it is forcefully terminated.
     * @returns a promise that resolves to the exit code of the container.
     * @throws if the container has not been created, cannot start, or does not terminate before the timeout is reached.
     */
    public async start(timeout: number = 0): Promise<number> {
        this._timestamp = Date.now();
        return new Promise<number>((resolve, reject) => {
            let killed: boolean = false;
            const cmdOpts: SpawnOptions = {
               stdio: `ignore`,
            };

            const cmd: ChildProcess = spawn(`docker`, [`start`, `--attach`, this._id], cmdOpts);
            if (timeout > 0) {
                setTimeout(async () => {
                    killed = true;
                    await this.stop();
                }, timeout);
            }
            cmd.on(`error`, (err) => {
                reject(err);
            });
            cmd.on(`close`, (code) => {
                if (killed === true) {  // timeout
                    reject(code);
                } else {
                    resolve(code);
                }
            });
        });
    }

    /**
     * Converts the IContainerOptions object to an array of parameters suitable for spawn.
     * @param options Container options to flatten into an array of parameters.
     * @param initArgs The initial argument(s), usually the docker subcommand.
     */
    private dockerOptionsToArgs(options: IContainerOptions, initArgs: string[]): void {
        if (typeof options.env !== `undefined`) {
            for (const [key, value] of Object.entries(options.env)) {
                initArgs.push(`--env`);
                initArgs.push(`${key.toUpperCase()}=${value}`);
            }
        }
        if (typeof options.volumes !== `undefined`) {
            for (const volume of options.volumes) {
                initArgs.push(`--volume`);
                initArgs.push(volume);
            }
        }
        if (typeof options.envFile !== `undefined`) {
            initArgs.push(`--env-file`);
            initArgs.push(options.envFile);
        }
    }

    /**
     * Stops a running container by sending a SIGTERM. If the container continues to run, issues a SIGKILL after the
     * grace period.
     * @param {number} gracePeriod The number of seconds to wait before sending SIGKILL after sending a SIGTERM.
     * @returns {Promise<void>}
     */
    private stop(gracePeriod: number = 10): Promise<void> {
        return new Promise<void>((resolve, reject) => {
           exec(`docker stop --time ${gracePeriod} ${this._id}`, (error, stdout, stderr) => {
               if (error) {
                   reject(error);
               }
               resolve();
           });
        });
    }
}
