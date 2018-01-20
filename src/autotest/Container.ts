import { ChildProcess, exec, spawn, SpawnOptions } from "child_process";
import { setTimeout } from "timers";
import Util from "../util/Util";

// A subset of the Docker container run options.
// https://docs.docker.com/engine/reference/commandline/create/#options
export interface IContainerOptions {
    env?: object;
    envFile?: string;
    volumes?: string[];  // Expands to multiple --volume <string> flags.
}

// A subset of the Docker inspect output for container objects.
// https://docs.docker.com/engine/reference/commandline/inspect/
type IContainerProperties = object[];

/**
 * Simple wrapper for Docker's container management commands with some basic extensions.
 */
export default class Container {
    public image: string;
    private _id: string;

    /**
     * Assigns the image from which the container will be created. This does not create the Docker container.
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
            const cmdArgs: string[] = [`create --cap-add=NET_ADMIN`];
            if (typeof options !== `undefined`) {
                this.dockerOptionsToArgs(options, cmdArgs);
            }
            const cmd: ChildProcess = spawn(`docker`, cmdArgs);

            cmd.stdout.on(`data`, (data) => this._id = data.toString());
            cmd.stderr.on(`data`, (data) => errMsg = data.toString());
            cmd.on(`error`, (err) => {
               reject(err);
            });
            cmd.on(`close`, (code, signal) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(errMsg);
                }
            });
        });
    }

    /**
     * Returns the stdio from the container.
     * @param tail Number of lines to show from end of log. Passed directly to docker logs.
     * @param size Number of bytes to keep from the log after tail has been applied.
     * @throws When the container does not exist.
     */
    public async getLog(tail: number = -1, size: number = 131072): Promise<string> {
        const { code , output } = await Util.bufferedSpawn(`docker`, [`logs --tail ${tail}`]);
        return output;
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
                    reject(`${error}. Details: ${stderr}`);
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
     * Removes the completed container from disk, freeing its resources. Once removed, getLogs and getProperties will fail.
     * This method *MUST* be called if create is called to free resources.
     * @throws When the container does not exist.
     */
    public async remove(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            exec(`docker rm ${this._id}`, (error, stdout, stderr) => {
                if (error) {
                    reject(`${error}. Details: ${stderr}`);
                }
                resolve();
            });
        });
    }

    /**
     * Starts the created container.
     *
     * NOTE in Docker 1.13 (API 1.25), docker can set the timeout using --stop-timeout. For now, use exec timeout.
     *
     * @param timeout The duration for which the container is allowed to execute, after which it is forcefully terminated.
     * @returns a promise that resolves to the exit code of the container.
     * @throws if the container has not been created, cannot start, or does not terminate before the timeout is reached.
     */
    public async start(timeout: number = 0): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            const cmdOpts: SpawnOptions = {
                stdio: `ignore`,
            };
            const cmd: ChildProcess = spawn(`docker`, [`start --attach`, this._id], cmdOpts);
            if (timeout > 0) {
                setTimeout(() => cmd.kill(`SIGKILL`), timeout);
            }
            cmd.on(`error`, (err) => {
                reject(err);
            });
            cmd.on(`close`, (code, signal) => {
                if (signal === `SIGKILL`) {  // timeout
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
                initArgs.push(` --env ${key.toUpperCase()}=${value}`);
            }
        }
        if (typeof options.volumes !== `undefined`) {
            for (const volume of options.volumes) {
                initArgs.push(` --volume ${volume}`);
            }
        }
        if (typeof options.envFile !== `undefined`) {
            initArgs.push(` --env-file ${options.envFile}`);
        }
    }
}
