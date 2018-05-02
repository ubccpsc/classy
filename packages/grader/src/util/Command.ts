import {ChildProcess, spawn, SpawnOptions} from "child_process";
import {CommandResult} from "../Types";
import Log from "./Log";

export interface ICommand {
    executeCommand(args: string[], options?: SpawnOptions): Promise<CommandResult>;
}

export class Command implements ICommand {
    private cmdName: string;

    constructor(name: string) {
        this.cmdName = name;
    }

    public async executeCommand(args: string[], options: SpawnOptions = {}): Promise<CommandResult> {
        Log.trace(`Command::executeCommand(..) -> ${this.cmdName} ${args.join(" ")}`);
        return new Promise<CommandResult>((resolve, reject) => {
            let output: Buffer = Buffer.allocUnsafe(0);
            options["uid"] = 0;
            const cmd: ChildProcess = spawn(this.cmdName, args, options);
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
                    Log.warn(`Command::executeCommand(..) -> EXIT ${code}: ${this.cmdName} ${args.join(" ")}. ${out}`);
                    reject([code, out]);
                }
            });
        });
    }
}
