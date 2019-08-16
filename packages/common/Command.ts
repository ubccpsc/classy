import {ChildProcess, spawn, SpawnOptions} from "child_process";
import Log from "./Log";
import Util from './Util';

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
        // LIKELY CANNOT PUT BACK IN UNLESS WE FILTER OUT SENSITIVE INFORMATION or just show first couple args
        // Log.trace(`Command::executeCommand(..) -> ${this.cmdName} ${args.join(" ")}`);
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
                let out = output.toString().trim();
                if (code === 0) {
                    resolve([code, out]);
                } else {
                    const codeString = JSON.stringify([code, out]);
                    if (codeString.indexOf(`fatal: unable to access 'https://`)) {
                        Log.info('stop here to debug');
                    }
                    out = Log.sanitize(out);
                    Log.warn(Log.sanitize(`Command::executeCommand(..) -> EXIT ${code}: ${this.cmdName} ${args.join(" ")}. ${out}`));
                    reject([code, out]);
                }
            });
        });
    }
}
