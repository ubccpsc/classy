import {spawn, SpawnOptions} from "child_process";
import Log from "./Log";

interface ISpawnResult {
    code: number;
    output: string;
    outputTruncated: boolean;
}

export default class Util {

    public static took(start: number): string {
        return Date.now() - start + " ms";
    }

    public static async yarn(name: string, options: SpawnOptions) {
        const yarnCmd = process.env.YARN_PATH;
        options["uid"] = 1000;
        Log.trace(`Util::yarn() - Running command ${yarnCmd} ${name} with options ${JSON.stringify(options)}.`);
        return await Util.bufferedSpawn(yarnCmd, [name], options);
    }

    public static async git(commandArgs: string[], options: SpawnOptions): Promise<ISpawnResult> {
        const gitCmd = process.env.GIT_PATH;
        options["uid"] = 1000;
        Log.trace(`Uitl::git() - Running command ${gitCmd} ${commandArgs.join(" ")} with options ${JSON.stringify(options)}`);
        return Util.bufferedSpawn(gitCmd, commandArgs, options);
    }

    // should set max size tp be 131072
    // Will grow the buffer up to maxBufferSize; any remaining output will be truncated
    public static async bufferedSpawn(command: string, commandArgs: string[], commandOpts = {}, maxBufferSize = 131072, pageSize = 4096): Promise<ISpawnResult> {
        // console.log("buffedSpawn", command, commandArgs, commandOpts);
        const maxPages = Math.floor(maxBufferSize / pageSize);
        let overflow = false;
        let offset = 0;
        let pages = 1;

        let buf = Buffer.allocUnsafe(pageSize);

        function writeBuffer(str: string) {
            const len = Buffer.byteLength(str, `utf8`);

            if (overflow) {
                // console.log(`Buffer is full and has already been expanded.`);
                return;
            }

            if (offset + len > pageSize) {
                let pagesToGrow = Math.ceil((len - (pages * pageSize - offset)) / pageSize);
                if (pages + pagesToGrow > maxPages) {
                    // console.log(`Buffer has been exceeded. Output will be truncated.`)
                    overflow = true;
                    pagesToGrow = maxPages - pages;
                }
                // console.log(`Growing buffer by ${pagesToGrow} pages.`);

                const oldBuf = buf;
                pages = pages + pagesToGrow;
                buf = Buffer.allocUnsafe(pages * pageSize);
                oldBuf.copy(buf, 0, 0, offset);

                // console.log("BEFORE:",{
                //     offset, len, pages, pagesToGrow
                // })
            }

            // If overflow = true then output was truncated but we wrote what we could
            offset += buf.write(str, offset, len);
        }

        return new Promise<ISpawnResult>((resolve, reject) => {
            const cmd = spawn(command, commandArgs, commandOpts);

            cmd.on(`error`, (err) => {
                // console.error(`bufferedSpawn() - ERROR executing command ${command} ${commandArgs.join(" ")}. ${err}`);
                reject(err);
            });

            cmd.stdout.on(`data`, (data) => {
                const stdout = data.toString();
                writeBuffer(stdout);
            });

            cmd.stderr.on(`data`, (data) => {
                const stderr = data.toString();
                writeBuffer(stderr);
            });

            cmd.on(`close`, (code) => {
                if (overflow) {
                    const truncatedMsg = `\n--- Truncated ---`;
                    const len = Buffer.byteLength(truncatedMsg);

                    if (buf.length - offset >= len) {
                        buf.write(truncatedMsg, buf.length - offset, len);
                    } else {
                        buf.write(truncatedMsg, buf.length - len, len);
                    }
                }

                const ret = {
                    code,
                    output:          buf.toString(`utf8`, 0, offset),
                    outputTruncated: overflow,
                };

                if (code === 0) {
                    resolve(ret);
                } else {
                    reject(ret);
                }
            });
        });
    }
}
