import { IDockerCmdResult, IDockerContainerOptions } from "../docker/DockerTypes";
import DockerUtil from "./DockerUtil";

/**
 * Simple wrapper for Docker's container management commands with some basic extensions.
 */
export interface IDockerContainer {
    /**
     * Creates a container from the image with the specified options.
     *
     * @param options The optional container configuration specified as an array of {name: value} pairs where name is
     * the option name for docker create (and should include leading dashes) and value is the corresponding option value.
     * @returns The container id.
     */
    create(options?: IDockerContainerOptions[]): Promise<IDockerCmdResult>;

    /**
     * Gets the container properties from Docker. Note: certain fields are only set while the container is running.
     *
     * @param format The optional format string to be passed to docker inspect.
     * @returns A JSON string of the container's properties.
     */
    inspect(format?: string): Promise<IDockerCmdResult>;

    /**
     * Gets the stdio from the container. If the container has run multiple times, output from all runs will be returned.
     *
     * @param tail Specifies the number of lines from the end of the log to read. By default, all lines are returned.
     * @returns The container's log.
     */
    logs(tail?: number): Promise<IDockerCmdResult>;

    /**
     * Pauses the execution of the container.
     *
     * @returns docker pause does not generate output.
     */
    pause(): Promise<IDockerCmdResult>;

    /**
     * Gets the formatted output of docker ps filtered to only include this container.
     *
     * @param format The optional format string passed to docker ps.
     * @returns The formatted output of the docker ps command.
     */
    ps(format?: string): Promise<IDockerCmdResult>;

    /**
     * Resumes execution of a paused container.
     *
     * @returns The id of the container.
     */
    unpause(): Promise<IDockerCmdResult>;

    /**
     * Removes the completed container from disk, freeing its resources.
     * This method *MUST* be called if create is called to free resources.
     *
     * @returns The id of the container.
     */
    remove(): Promise<IDockerCmdResult>;

    /**
     * Starts the created container as a background process and returns immediately. Use wait() to be notified when the
     * container completes.
     *
     * @returns The id of the container.
     */
    start(): Promise<IDockerCmdResult>;

    /**
     * Stops a running container by sending a SIGTERM. If the container continues to run, issues a SIGKILL after the
     * grace period.
     *
     * @param time The number of seconds to wait before sending SIGKILL after sending a SIGTERM. Defaults to 10s.
     * @returns The container's exit code in the output field as a string.
     */
    stop(time?: number): Promise<IDockerCmdResult>;

    /**
     * Waits for the container to finish executing. If execution takes more time than alloted, forcefully terminates
     * the container.
     *
     * @param seconds The duration for which the container is allowed to execute, after which it is forcefully
     * terminated. The default value, 0, does not set a timeout.
     * @returns The container's exit code in the output field as a string.
     */
    wait(seconds?: number): Promise<IDockerCmdResult>;
}


export default class DockerContainer implements IDockerContainer {
    private readonly _image: string;
    private _id: string;

    /**
     * Assigns the image from which the container will be created. This does not create the Docker container. It is
     * recommended that a new instance of Container be create for each execution of the container.
     * @param image SHA or tag of Docker image from which to create container.
     */
    constructor(image: string) {
        this._image = image;
    }

    public async create(options: IDockerContainerOptions[] = []): Promise<IDockerCmdResult> {
        let ret: IDockerCmdResult;
        const args: string[] = ["create"];
        for (const option of options) {
            args.push(option.name);
            args.push(option.value);
        }
        args.push(this._image);
        ret = await DockerUtil.execCmd(args);
        this._id = ret.output;
        return ret;
    }

    public async inspect(format?: string): Promise<IDockerCmdResult> {
        const args: string[] = ["inspect"];
        if (typeof format !== "undefined") {
            args.push(`--format=${format}`);
        }
        args.push(this._id);
        return DockerUtil.execCmd(args);
    }

    public async logs(tail?: number): Promise<IDockerCmdResult> {
        const args: string[] = ["logs"];
        if (typeof tail !== "undefined") {
            args.push(`--tail=${tail}`);
        }
        args.push(this._id);
        return DockerUtil.execCmd(args);
    }

    public async pause(): Promise<IDockerCmdResult> {
        const args: string[] = ["pause", this._id];
        return DockerUtil.execCmd(args);
    }

    public async ps(format?: string): Promise<IDockerCmdResult> {
        const args: string[] = ["ps", "--all", "--filter", `id=${this._id}`];
        if (typeof format !== "undefined") {
            args.push("--format");
            args.push(format);
        }
        return DockerUtil.execCmd(args);
    }

    public async unpause(): Promise<IDockerCmdResult> {
        const args: string[] = ["unpause", this._id];
        return DockerUtil.execCmd(args);
    }

    public async remove(): Promise<IDockerCmdResult> {
        const args: string[] = ["rm", this._id];
        return DockerUtil.execCmd(args);
    }

    public async start(): Promise<IDockerCmdResult> {
        const args: string[] = ["start", this._id];
        return DockerUtil.execCmd(args);
    }

    public async stop(time?: number): Promise<IDockerCmdResult> {
        const args: string[] = ["stop"];
        if (typeof time !== "undefined") {
            args.push("--time");
            args.push(time.toString());
        }
        args.push(this._id);
        const ret = await DockerUtil.execCmd(args);
        ret.output = await this.getExitCode();
        return ret;
    }

    public async wait(seconds: number = 0): Promise<IDockerCmdResult> {
        let stopRet: IDockerCmdResult;
        let waitRet: IDockerCmdResult;
        const args: string[] = ["wait", this._id];
        if (seconds > 0) {
            setTimeout(async () => {
                stopRet = await this.stop();
            }, seconds * 1000);
        }
        waitRet = await DockerUtil.execCmd(args);
        if (typeof stopRet !== "undefined") {
            return stopRet;
        } else {
            waitRet.output = await this.getExitCode();
            return waitRet;
        }
    }

    private async getExitCode(): Promise<string> {
        const result: IDockerCmdResult = await this.ps("{{.Status}}");
        const matches = result.output.match(/^Exited \((\d+)\)/);
        if (matches !== null && matches.length > 1) {
            return matches[1];
        } else {
            throw new Error("Could not get exit code.");
        }
    }
}
