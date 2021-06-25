import {exec} from "child_process";
import * as Docker from "dockerode";
import * as fs from "fs-extra";
import Config, {ConfigKey} from "../../../common/Config";
import {GitRepository} from "../../../common/GitRepository";
import Log from "../../../common/Log";
import {AutoTestResult} from "../../../common/types/AutoTestTypes";
import {ContainerInput, ContainerState} from "../../../common/types/ContainerTypes";
import {AutoTestConfigTransport} from "../../../common/types/PortalTypes";

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
            delivId:   this.input.delivId,
            repoId:    this.input.target.repoId,
            commitURL: this.input.target.commitURL,
            commitSHA: this.input.target.commitSHA,
            input:     this.input,
            output:    {
                timestamp:          Date.now(),
                report:             {
                    scoreOverall: 0,
                    scoreCover:   null,
                    scoreTest:    null,
                    feedback:     "Internal error: The grading service failed to handle the request.",
                    passNames:    [],
                    skipNames:    [],
                    failNames:    [],
                    errorNames:   [],
                    result:       "FAIL",
                    attachments:  [],
                    custom:       {}
                },
                postbackOnComplete: true,
                custom:             {},
                state:              ContainerState.FAIL,
                graderTaskId:       this.id
            }
        };
    }

    public async prepare(): Promise<void> {
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
                    Log.error("Execute::prepare() - Failed to change owner. " + error);
                    reject(error);
                }
                resolve();
            });
        });
    }

    public async run(docker: Docker): Promise<AutoTestResult> {
        const hostDir = Config.getInstance().getProp(ConfigKey.hostDir) + "/runs/" + this.id;

        const container = await docker.createContainer({
            User:       Config.getInstance().getProp(ConfigKey.dockerUid),
            Image:      this.input.containerConfig.dockerImage,
            Env:        [
                `ASSIGNMENT=${this.input.delivId}`,
                `EXEC_ID=${this.id}`,
                `INPUT=${JSON.stringify(this.input)}`
            ],
            HostConfig: {
                AutoRemove:  true,
                Binds:       [
                    `${hostDir}/assn:/assn`,
                    `${hostDir}:/output`
                ],
                ExtraHosts:  [
                    Config.getInstance().getProp(ConfigKey.hostsAllow)
                ],
                NetworkMode: "grading_net"
            }
        });
        const maxExecTime = this.input.containerConfig.maxExecTime;

        const stdio = fs.createWriteStream(this.path + "/staff/stdio.txt");
        const stream = await container.attach({stream: true, stdout: true, stderr: true});
        container.modem.demuxStream(stream, stdio, stdio);

        const exitCode = await GradingJob.runContainer(container, maxExecTime);

        const out = this.record.output;
        if (exitCode === -1) {
            out.report.feedback = "Container did not complete for `" + this.input.delivId + "` in the allotted time.";
            out.state = ContainerState.TIMEOUT;
        } else {
            try {
                const shouldPostback: boolean = exitCode !== 0;
                out.report = await fs.readJson(this.path + "/staff/report.json");
                out.postbackOnComplete = shouldPostback;
                out.state = ContainerState.SUCCESS;
            } catch (err) {
                Log.error("GradeWorker::execute() - ERROR Reading grade report. " + err);
                out.report.feedback = "Failed to read grade report.";
                out.state = ContainerState.NO_REPORT;
            }
        }

        // cleanup
        await fs.remove(this.path + "/assn");

        return this.record;
    }

    public static async runContainer(container: Docker.Container, maxExecTime: number): Promise<number> {
        let result: any;
        let timer: any;
        let timedOut: boolean = false;

        await container.start();

        if (maxExecTime > 0) {
            // Set a timer to kill the container if it doesn't finish in the allotted time
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
