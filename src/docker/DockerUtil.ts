import { ChildProcess, spawn, SpawnOptions } from "child_process";
import {IDockerCmdResult} from "./DockerTypes";

export default class DockerUtil {
    public static async execCmd(args: string[], options: SpawnOptions = {}): Promise<IDockerCmdResult> {
        return new Promise<IDockerCmdResult>((resolve, reject) => {
            let stdout: Buffer = Buffer.alloc(0);
            let stderr: Buffer = Buffer.alloc(0);

            const cmd: ChildProcess = spawn(`docker`, args, options);
            cmd.on(`error`, (err) => {
                reject(err);
             });
            cmd.stdout.on(`data`, (data: Buffer) => {
                stdout = Buffer.concat([stdout, data], stdout.length + data.length);
            });
            cmd.stderr.on(`data`, (data: Buffer) => {
                stderr = Buffer.concat([stderr, data], stderr.length + data.length);
            });
            cmd.on(`close`, (code, signal) => {
                if (code === 0) {
                    resolve({code, output: stdout.toString().trim()});
                } else {
                    reject({code, output: stderr.toString().trim()});
                }
            });
        });
    }
}
