import {exec} from "child_process";
import * as Docker from "dockerode";
import * as fs from "fs-extra";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import Util from "@common/Util";
import {GitRepository} from "@common/commands/GitRepository";
import {AutoTestResult} from "@common/types/AutoTestTypes";
import {ContainerInput, ContainerState} from "@common/types/ContainerTypes";

export class GradingJob {
    public readonly record: AutoTestResult;
    public readonly input: ContainerInput;
    public readonly path: string;
    public readonly id: string;

    constructor(containerInput: ContainerInput) {
        this.input = containerInput;
        this.id = this.input.target.commitSHA + "-" + this.input.target.delivId;
        this.path = Config.getInstance().getProp(ConfigKey.persistDir) + "/runs/" + this.id;

        // Populate record with default values in case the commit fails
        // spectacularly, or is timed out by Docker itself
        this.record = {
            delivId: this.input.target.delivId,
            repoId: this.input.target.repoId,
            commitURL: this.input.target.commitURL,
            commitSHA: this.input.target.commitSHA,
            input: this.input,
            output: {
                timestamp: Date.now(),
                report: {
                    scoreOverall: 0,
                    scoreCover: null,
                    scoreTest: null,
                    feedback: "Unable to grade commit; please make another commit and try again.",
                    passNames: [],
                    skipNames: [],
                    failNames: [],
                    errorNames: [],
                    result: ContainerState.FAIL,
                    attachments: [],
                    custom: {}
                },
                postbackOnComplete: true,
                custom: {},
                state: ContainerState.FAIL,
                graderTaskId: this.id
            }
        };
    }

    public async prepare(): Promise<void> {
        try {
            Log.trace("GradingJob::prepare() - start: " + this.id);

            await fs.emptyDir(this.path);
            await Promise.all([
                fs.mkdirp(this.path + "/staff"),
                fs.mkdirp(this.path + "/student"),
                fs.mkdirp(this.path + "/admin")
            ]);
            const repo = new GitRepository(this.path + "/assn");
            const token = Config.getInstance().getProp(ConfigKey.githubBotToken).replace("token ", "");
            const url = this.input.target.cloneURL.replace("://", `://${token}@`);
            await repo.clone(url);
            await repo.checkout(this.input.target.commitSHA);

            // Change the permissions so that the grading container can read the files.
            const user = Config.getInstance().getProp(ConfigKey.dockerUid);
            await new Promise<void>((resolve, reject) => {
                exec(`chown -R ${user} ${this.path}`, (error) => {
                    if (error) {
                        Log.error("GradingJob::prepare() - Failed to change owner. " + error);
                        reject(error);
                    }
                    resolve();
                });
            });
        } catch (err) {
            const msg = "GradingJob::prepare() - ERROR: " + err.message;
            Log.error(msg);
            throw Error(msg);
        }
        Log.trace("GradingJob::prepare() - done: " + this.id);
    }

    public async run(docker: Docker): Promise<AutoTestResult> {
        Log.info("GradingJob::run() - start; repo: " + this?.input?.target?.repoId + "; id: " + this.id);
        const hostDir = Config.getInstance().getProp(ConfigKey.hostDir) + "/runs/" + this.id;

        const container = await docker.createContainer({
            User: Config.getInstance().getProp(ConfigKey.dockerUid),
            Image: this.input.containerConfig.dockerImage,
            Env: [
                `ASSIGNMENT=${this.input.target.delivId}`,
                `EXEC_ID=${this.id}`,
                `INPUT=${JSON.stringify(this.input)}`
            ],
            HostConfig: {
                AutoRemove: true,
                Binds: [
                    `${hostDir}/assn:/assn`,
                    `${hostDir}:/output`
                ],
                ExtraHosts: [
                    Config.getInstance().getProp(ConfigKey.hostsAllow)
                ],
                NetworkMode: "grading_net"
            }
        });
        Log.trace("GradingJob::run() - created: " + this.id);
        const JOB_CORES = 1000000000; // 1 core
        await container.update({NanoCpus: JOB_CORES});  // restrict each job to JOB_CORES cores (for more reliable scaling)
        Log.trace("GradingJob::run() - updated: " + this.id);
        const maxExecTime = this.input.containerConfig.maxExecTime;

        Log.trace("GradingJob::run() - after container: " + this.id);

        const stdio = fs.createWriteStream(this.path + "/staff/stdio.txt");
        const stream = await container.attach({stream: true, stdout: true, stderr: true});
        container.modem.demuxStream(stream, stdio, stdio);

        const exitCode = await GradingJob.runContainer(container, maxExecTime);
        Log.trace("GradingJob::run() - after run: " + this.id + "; exit code: " + exitCode);

        // NOTE: at this point, out just contains default values
        const out = this.record.output;
        out.timestamp = Date.now(); // update TS to when job actually finished

        let reportRead = false;
        try {
            const REPORT_PATH = this.path + "/staff/report.json";
            const reportExists = await fs.pathExists(REPORT_PATH);
            if (reportExists === true) {
                out.report = await fs.readJson(REPORT_PATH);
                reportRead = true;
            }
        } catch (err) {
            Log.warn("GradingJob::run() - Problem reading report: " + err.message);
        }

        if (exitCode === -10) {
            const msg = "Container failed for `" + this.input.target.delivId + "`.";
            out.report.feedback = msg;
            out.report.result = ContainerState.FAIL;

            out.state = ContainerState.FAIL;
            out.postbackOnComplete = true; // always send fail feedback
        } else if (exitCode === -1) {
            let msg = "Container did not complete for **`#" + this.input.target.delivId + "`** in the allotted time. ";
            msg += "This likely means that _our_ tests exposed a slow or non-terminating path in _your_ implementation. ";
            msg += "You should augment your tests; a comprehensive local suite will uncover the problem.";

            out.report.feedback = msg;
            out.report.result = ContainerState.TIMEOUT;

            out.state = ContainerState.TIMEOUT;
            out.postbackOnComplete = true; // always send timeout feedback
        } else if (reportRead === false) {
            Log.warn("GradingJob::run() - No grading report for repo: " + this.input.target.repoId +
                "; delivId: " + this.input.target.delivId + "; SHA: " + Util.shaHuman(this.input.target.commitSHA));
            out.report.feedback = "Failed to read grade report. Make a new commit and try again.";
            out.report.result = ContainerState.NO_REPORT;
            out.state = ContainerState.NO_REPORT;
        } else {
            // handle SUCCESS cases last

            // Always postback feedback if the container does not
            // exit with a 0 code; makes it easy for a container
            // to provide 'free' feedback for many exit codes
            out.postbackOnComplete = exitCode !== 0;

            // NOTE: this just means the GradingJob exited successfully,
            // not that the execution within the container was a success
            out.state = ContainerState.SUCCESS;
        }

        try {
            // NOTE: this might not happen if docker was restarted while the job was running
            await fs.removeSync(this.path + "/assn");
        } catch (err) {
            // do not want to fail for this; report and continue
            Log.warn("GradingJob::run() - Problem removing /assn: " + err.message);
        }

        // report extra details about non-successful jobs
        if (out.state !== ContainerState.SUCCESS ||
            (reportRead === true && out.report.result !== ContainerState.SUCCESS)) {
            const msg = "GradingJob::run() - after; repo: " + this.input.target.repoId +
                "; delivId: " + this.input.target.delivId +
                "; sha: " + Util.shaHuman(this.input.target.commitSHA) +
                "; exitCode: " + exitCode + "; cState: " + out.state;
            if (reportRead === true) {
                // only makes sense if there was a report to read
                Log.info(msg + "; rState: " + out.report.result);
            } else {
                Log.info(msg + "; reportRead: " + reportRead);
            }
        }

        Log.info("GradingJob::run() - done: " + this.id + "; code: " + exitCode);
        return this.record;
    }

    public static async runContainer(container: Docker.Container, maxExecTime: number): Promise<number> {
        let result: any;
        let timer: any;
        let timedOut: boolean = false;

        await container.start();

        if (maxExecTime > 0) {
            // Set a timer to kill the container if it does not finish in the allotted time
            timer = setTimeout(async () => {
                timedOut = true;
                await container.stop();
            }, maxExecTime * 1000);
        }

        try {
            result = await container.wait();
        } catch (err) {
            throw err;
        } finally {
            clearTimeout(timer);
        }

        return timedOut ? -1 : result.StatusCode;
    }
}
