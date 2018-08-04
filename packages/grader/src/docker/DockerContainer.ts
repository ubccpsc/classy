import { CommandResult, IDockerContainerOptions } from "../Types";
import {Command} from "../util/Command";

/**
 * Simple wrapper for Docker's container management commands with some basic extensions.
 */
export interface IDockerContainer {
    id: string;
    shortId: string;
    /**
     * Creates a container from the image with the specified options.
     *
     * @param options The optional container configuration specified as an array of {name: value} pairs where name is
     * the option name for docker create (and should include leading dashes) and value is the corresponding option value.
     * @returns The container id.
     */
    create(options?: IDockerContainerOptions): Promise<CommandResult>;

    /**
     * Gets the container properties from Docker. Note: certain fields are only set while the container is running.
     *
     * @param format The optional format string to be passed to docker inspect.
     * @returns A JSON string of the container's properties.
     */
    inspect(format?: string): Promise<CommandResult>;

    /**
     * Gets the stdio from the container. If the container has run multiple times, output from all runs will be returned.
     *
     * @param tail Specifies the number of lines from the end of the log to read. By default, all lines are returned.
     * @returns The container's log.
     */
    logs(tail?: number): Promise<CommandResult>;

    /**
     * Pauses the execution of the container.
     *
     * @returns docker pause does not generate output.
     */
    pause(): Promise<CommandResult>;

    /**
     * Gets the formatted output of docker ps filtered to only include this container.
     *
     * @param format The optional format string passed to docker ps.
     * @returns The formatted output of the docker ps command.
     */
    ps(format?: string): Promise<CommandResult>;

    /**
     * Resumes execution of a paused container.
     *
     * @returns The id of the container.
     */
    unpause(): Promise<CommandResult>;

    /**
     * Removes the completed container from disk, freeing its resources.
     * This method *MUST* be called if create is called to free resources.
     *
     * @returns The id of the container.
     */
    remove(): Promise<CommandResult>;

    /**
     * Starts the created container as a background process and returns immediately. Use wait() to be notified when the
     * container completes.
     *
     * @returns The id of the container.
     */
    start(): Promise<CommandResult>;

    /**
     * Stops a running container by sending a SIGTERM. If the container continues to run, issues a SIGKILL after the
     * grace period.
     *
     * @param time The number of seconds to wait before sending SIGKILL after sending a SIGTERM. Defaults to 10s.
     * @returns The container's exit code in the output field as a string.
     */
    stop(time?: number): Promise<CommandResult>;

    /**
     * Waits for the container to finish executing.
     *
     * @returns The container's exit code in the output field as a string.
     */
    wait(): Promise<CommandResult>;
}

export class DockerContainer extends Command implements IDockerContainer {
    private readonly _image: string;
    private _id: string;

    /**
     * Assigns the image from which the container will be created. This does not create the Docker container. It is
     * recommended that a new instance of Container be create for each execution of the container.
     * @param image SHA or tag of Docker image from which to create container.
     */
    constructor(image: string) {
        super("docker");
        this._image = image;
    }

    public get id(): string {
        return this._id;
    }

    public get shortId(): string {
        if (this._id) {
            return this._id.substring(0,6);
        }
    }

    public async create(options: IDockerContainerOptions = {}): Promise<CommandResult> {
        let args: string[] = ["create"];
        args = args.concat(this.optionsToArgs(options));
        args.push(this._image);
        const [code, id] = await this.executeCommand(args);
        this._id = id;
        return [code, id];
    }

    public async inspect(format?: string): Promise<CommandResult> {
        const args: string[] = ["inspect"];
        if (typeof format !== "undefined") {
            args.push(`--format=${format}`);
        }
        args.push(this._id);
        return this.executeCommand(args);
    }

    public async logs(tail?: number): Promise<CommandResult> {
        const args: string[] = ["logs"];
        if (typeof tail !== "undefined") {
            args.push(`--tail=${tail}`);
        }
        args.push(this._id);
        return this.executeCommand(args);
    }

    public async pause(): Promise<CommandResult> {
        const args: string[] = ["pause", this._id];
        return this.executeCommand(args);
    }

    public async ps(format?: string): Promise<CommandResult> {
        const args: string[] = ["ps", "--all", "--filter", `id=${this._id}`];
        if (typeof format !== "undefined") {
            args.push("--format");
            args.push(format);
        }
        return this.executeCommand(args);
    }

    public async unpause(): Promise<CommandResult> {
        const args: string[] = ["unpause", this._id];
        return this.executeCommand(args);
    }

    public async remove(): Promise<CommandResult> {
        const args: string[] = ["rm", this._id];
        return this.executeCommand(args);
    }

    public async start(): Promise<CommandResult> {
        const args: string[] = ["start", this._id];
        return this.executeCommand(args);
    }

    public async stop(time?: number): Promise<CommandResult> {
        const args: string[] = ["stop"];
        if (typeof time !== "undefined") {
            args.push("--time");
            args.push(time.toString());
        }
        args.push(this._id);
        let code: number;
        let output: string;
        [code, output] = await this.executeCommand(args);
        output = await this.getExitCode();
        return [code, output];
    }

    public async wait(): Promise<CommandResult> {
        const args: string[] = ["wait", this._id];
        let code: number;
        let output: string;
        [code, output] = await this.executeCommand(args);
        output = await this.getExitCode();
        return [code, output];
    }

    private async getExitCode(): Promise<string> {
        const [, output]: CommandResult = await this.ps("{{.Status}}");
        const matches = output.match(/^Exited \((\d+)\)/);
        if (matches !== null && matches.length > 1) {
            return matches[1];
        } else {
            throw new Error("Could not get exit code.");
        }
    }

    private optionsToArgs(options: IDockerContainerOptions): string[] {
        const args: string[] = [];
        for (const [key, value] of Object.entries(options)) {
            if (Array.isArray(value)) {
                for (const element of value) {
                    args.push(key);
                    args.push(element);
                }
            } else {
                args.push(key);
                args.push(value);
            }
        }
        return args;
    }
}
