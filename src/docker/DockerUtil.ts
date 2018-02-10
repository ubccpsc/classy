import { ChildProcess, spawn, SpawnOptions } from "child_process";
import {IDockerCmdResult} from "./DockerTypes";

export default class DockerUtil {
    public static async execCmd(args: string[], options: SpawnOptions = {}): Promise<IDockerCmdResult> {
        return new Promise<IDockerCmdResult>((resolve, reject) => {
            let output: Buffer = Buffer.allocUnsafe(0);

            const cmd: ChildProcess = spawn(`docker`, args, options);
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
                    resolve({code, output: output.toString().trim()});
                } else {
                    reject({code, output: output.toString().trim()});
                }
            });
        });
    }
}
