import { ChildProcess, SpawnOptions, spawn } from "child_process";
import Config from "../Config";
import Log from "../Log";

export type CommandResult = [number, any];

export interface ICommand {
	executeCommand(args: string[], options?: SpawnOptions): Promise<CommandResult>;
}

export class Command implements ICommand {
	// Assign spawn to a member variable so we can substitute a mock when testing
	private readonly spawn: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
	private readonly cmdName: string;

	public constructor(name: string) {
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
			cmd.on(`close`, (code, _signal) => {
				const out = output.toString().trim();
				if (code === 0) {
					resolve([code, out]);
				} else {
					Log.warn(Config.sanitize(`Command::executeCommand(..) -> EXIT ${code}: ${this.cmdName} ${args.join(" ")}. ${out}`));
					// An Error, not the [code, out] tuple this used to reject with: every catcher reads
					// err.message and was getting "undefined" (GradingJob::prepare logged "ERROR: undefined"
					// for every failed clone). The exit code and output stay reachable as properties. The
					// resolve path still returns the CommandResult tuple.
					const safeOut = Config.sanitize(out);
					const err: any = new Error(safeOut.length > 0 ? safeOut : this.cmdName + " exited with code " + code);
					err.code = code;
					err.output = safeOut;
					reject(err);
				}
			});
		});
	}
}
