import { CommandResult, IDockerNetworkOptions } from "../Types";
import {Command} from "../util/Command";

export interface IDockerNetwork {
    create(name: string, options?: IDockerNetworkOptions): Promise<CommandResult>;
    remove(): Promise<CommandResult>
}

export class DockerNetwork extends Command implements IDockerNetwork {
    private name: string;

    constructor() {
        super("docker");
    }

    public async create(name: string, options: IDockerNetworkOptions = {}): Promise<CommandResult> {
        const args: string[] = ["network", "create"];
        for (const [opt, val] of Object.entries(options)) {
            args.push(`--${opt}=${val}`);
        }
        return this.executeCommand(args);
    }

    public async remove(): Promise<CommandResult> {
        const args: string[] = ["network", "rm", this.name];
        return this.executeCommand(args);
    }
}
