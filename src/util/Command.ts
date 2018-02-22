import {ChildProcess, spawn, SpawnOptions} from "child_process";

export type CommandResult = [number, any];

export interface ICommand {
    executeCommand(args: string[], options?: SpawnOptions): Promise<CommandResult>;
}

export class Command implements ICommand {
    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    public async executeCommand(args: string[], options: SpawnOptions = {}): Promise<CommandResult> {
        return new Promise<CommandResult>((resolve, reject) => {
            let output: Buffer = Buffer.allocUnsafe(0);

            const cmd: ChildProcess = spawn(this.name, args, options);
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
                if (code === 0) {
                    resolve([code, output.toString().trim()]);
                } else {
                    reject([code, output.toString().trim()]);
                }
            });
        });
    }
}
