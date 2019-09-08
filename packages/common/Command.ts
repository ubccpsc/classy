import {ChildProcess, spawn, SpawnOptions} from "child_process";
import Config from "./Config";
import Log from "./Log";

export type CommandResult = [number, any];

export interface ICommand {
    executeCommand(args: string[], options?: SpawnOptions): Promise<CommandResult>;
}

export class Command implements ICommand {
    // Assign spawn to a member variable so we can substitute a mock when testing
    private readonly spawn: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
    private readonly cmdName: string;

    constructor(name: string) {
        this.cmdName = name;
        this.spawn = spawn;
    }

    public async executeCommand(args: string[], options: SpawnOptions = {}): Promise<CommandResult> {
        Log.trace(Config.sanitize(`Command::executeCommand(..) -> ${this.cmdName} ${args.join(" ")}`));
        return new Promise<CommandResult>((resolve, reject) => {
            let output: Buffer = Buffer.allocUnsafe(0);
            const cmd: ChildProcess = this.spawn(this.cmdName, args, options);
            cmd.on(`error`, (err) => {
                reject(err);
            });
            cmd.stdout.on(`data`, (data: Buffer) => {
                output = Buffer.concat([output, data], output.length + data.length);
            });
            cmd.stderr.on(`data`, (data: Buffer) => {
                output = Buffer.concat([output, data], output.length + data.length);
            });
            cmd.on(`close`, (code, signal) => {
                const out = output.toString().trim();
                if (code === 0) {
                    resolve([code, out]);
                } else {
                    Log.warn(Config.sanitize(`Command::executeCommand(..) -> EXIT ${code}: ${this.cmdName} ${args.join(" ")}. ${out}`));
                    reject([code, Config.sanitize(out)]);
                }
            });
        });
    }
}
