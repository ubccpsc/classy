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
                    feedback: "Internal error: The grading service failed to handle the request.",
                    passNames: [],
                    skipNames: [],
                    failNames: [],
                    errorNames: [],
                    result: "FAIL",
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
            Log.info("GradingJob::prepare() - start: " + this.id);

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
        Log.info("GradingJob::prepare() - done: " + this.id);
    }

    public async run(docker: Docker): Promise<AutoTestResult> {
        Log.info("GradingJob::run() - start: " + this.id);
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

        const out = this.record.output;
        out.timestamp = Date.now(); // update TS to when job actually finished

        if (exitCode !== 0) { // what is 98? // 1?
            // start tracking what is coming out of the container better
            Log.warn("GradingJob::run() - exitCode: " + exitCode +
                "; repo: " + this.input.target.repoId + "; sha: " + Util.shaHuman(this.input.target.commitSHA) +
                "; state: " + out.state + "; result: " + out.report.result + "; feedback: " + out.report.feedback);
        }

        // handle FAIL before TIMEOUT
        if (exitCode === -10) {
            if (typeof out.report.feedback === "undefined" || out.report.feedback === null || out.report.feedback === "") {
                out.report.feedback = "Container failed for `" + this.input.target.delivId + "`.";
            } else {
                const msg = "Container failed for `" + this.input.target.delivId + ". " + out.report.feedback;
                out.report.feedback = msg;
            }
            out.state = ContainerState.FAIL;
            out.postbackOnComplete = true; // always send fail feedback
        } else if (exitCode === -1) {
            if (typeof out.report.feedback === "undefined" || out.report.feedback === null || out.report.feedback === "") {
                out.report.feedback = "Container did not complete for `" + this.input.target.delivId + "` in the allotted time.";
            } else {
                const msg = "Container did not complete for `" + this.input.target.delivId + "`. " + out.report.feedback;
                out.report.feedback = msg;
            }
            out.state = ContainerState.TIMEOUT;
            out.postbackOnComplete = true; // always send timeout feedback
        } else {
            try {
                const shouldPostback: boolean = exitCode !== 0;
                out.report = await fs.readJson(this.path + "/staff/report.json");
                out.postbackOnComplete = shouldPostback;
                out.state = ContainerState.SUCCESS;
            } catch (err) {
                Log.error("GradingJob::execute() - ERROR Reading grade report. " + err);
                out.report.feedback = "Failed to read grade report.";
                out.state = ContainerState.NO_REPORT;
            }
        }

        // NOTE: this might not happen if docker was restarted while the job was running
        await fs.remove(this.path + "/assn");

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
