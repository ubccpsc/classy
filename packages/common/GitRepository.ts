import * as path from "path";
import {CommandResult} from "./Command";
import {Command} from "./Command";

interface Repository {
    /**
     * Wrapper for git checkout.
     * @param commit The commit SHA to checkout.
     * @throws When the commit cannot be checked-out.
     */
    checkout(commit: string): Promise<CommandResult>;

    /**
     * Wrapper for git clone. Credentials with read permission on the repository should be specified in the url.
     * @param url The location, including credentials, of the repository.
     * @param dir The path on the locally machine to clone the files.
     * @throws When the repository cannot be cloned.
     */
    clone(url: string, dir: string): Promise<CommandResult>;

    /**
     * Wrapper for git rev-parse HEAD.
     * @returns the full SHA for the most recent commit.
     */
    getSha(): Promise<string>;
}

/**
 * Wrapper for some git commands.
 */
export class GitRepository extends Command implements Repository {
    private readonly path: string;

    constructor(dir: string) {
        super("git");
        this.path = path.resolve(dir);
    }

    public async checkout(commit: string): Promise<CommandResult> {
        const args: string[] = ["checkout", commit];
        return await this.executeCommand(args, {cwd: this.path});
    }

    public async clone(url: string): Promise<CommandResult> {
        const args: string[] = ["clone", url, this.path];
        return await this.executeCommand(args, {env: {GIT_TERMINAL_PROMPT: 0}});
    }

    public async getSha(): Promise<string> {
        const args: string[] = ["rev-parse", "HEAD"];
        const commandResult = await this.executeCommand(args, {cwd: this.path});
        return commandResult[1];
    }
}
