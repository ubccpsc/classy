import * as fs from "fs-extra";
import * as net from "net";
import * as path from "path";
import { URL } from "url";
import {Config} from "../Config";
import {DockerContainer, IDockerContainer} from "../docker/DockerContainer";
import {IAttachment, ICommitRecord, IContainerInput, IContainerOutput, IDockerContainerOptions, IGradeReport} from "../Types";
import FSUtil from "../util/FSUtil";
import Log from "../util/Log";
import Repository from "../util/Repository";
import Util from "../util/Util";
import { IContainerHostEnvironment } from "./ContainerHostEnvironment";

interface IRunContainerResult {
    didTimeout: boolean;
    log: string;
}

export interface IGrader {
    execute(input: IContainerInput): Promise<ICommitRecord>;
}

/**
 * Grades a student's project at a specified commit against a solution key for the assignment.
 */
export default class Grader implements IGrader {
    private readonly hostEnv: IContainerHostEnvironment;
    private readonly reportFilename: string;
    private readonly transcriptFilename: string;
    private readonly assnDir: string;
    private readonly solnDir: string;
    private readonly keepDir: string;

    /**
     * Creates a new grader instance which grades a single assignment. To grade an assignment:
     * - initialize the workspace by calling initWorkspace()
     * - put the assignment in the submissionDir and put the solution in the solutionDir
     * - call grade() to run the grading container and generate a grade report
     * - call archiveGradingArtifacts() to preserve the results by moving them to the specified location
     * - clearWorkspace() to remove all intermediate files (including the given assn and soln)
     * @param reportFilename The name of the grading report to generate.
     * @param transcriptFilename The name to give to the container log.
     */
    constructor(hostEnv: IContainerHostEnvironment, reportFilename: string = `report.json`, transcriptFilename: string = `stdio.txt`) {
        this.hostEnv = hostEnv;
        this.assnDir = hostEnv.tempDir + "/assignment";
        this.solnDir = hostEnv.tempDir + "/solution";
        this.keepDir = hostEnv.persistDir;
        this.reportFilename = reportFilename;
        this.transcriptFilename = transcriptFilename;
    }

    public async execute(input: IContainerInput): Promise<ICommitRecord> {
        Log.info("Grader::execute(..) - start; commit: " + input.pushInfo.commitSHA);

        enum State {SUCCESS, TIMEOUT, INVALID_REPORT, FAIL}

        const image: string = Config.getInstance().getProp("dockerId");
        const timeout: number = Config.getInstance().getProp("timeout");
        const assnToken: string = Config.getInstance().getProp("githubOrgToken");
        const solnToken: string = Config.getInstance().getProp("githubOracleToken");
        const solnUrl: string = Config.getInstance().getProp("oracleRepo").replace("://", `://${solnToken}@`);

        const solnBranch: string = input.delivId;
        const assnUrl: string = input.pushInfo.projectURL.replace("://", `://${assnToken}@`);
        const assnCommit: string = input.pushInfo.commitSHA;
        const delivId: string = input.delivId;

        let containerResult: IRunContainerResult;

        const out: IContainerOutput = {
            commitUrl:          input.pushInfo.commitURL,
            timestamp:          Date.now(),
            report:             null,
            feedback:           null,
            postbackOnComplete: true,
            custom:             {},
            attachments:        [],
            state:              "FAIL" // enum: SUCCESS, TIMEOUT, INVALID_REPORT, FAIL
        };

        try {
            await this.initWorkspace();
            const assnRepo: Promise<Repository> = this.fetchRepository(this.assnDir, assnUrl, assnCommit);
            const solnRepo: Promise<Repository> = this.fetchRepository(this.solnDir, solnUrl, solnBranch);
            await Promise.all([assnRepo, solnRepo]);
        } catch (err) {
            Log.error(err);
            out.feedback = "AutoTest encountered an unexpected error. Please make a new commit and try again.";
        }
        try {
            containerResult = await this.runContainer(image, delivId, timeout);
            await fs.writeFile(this.keepDir + "/" + this.transcriptFilename, containerResult.log);
            if (containerResult.didTimeout) {
                out.feedback = "Grading of this commit was forcibly terminated after exceeding alloted time.";
                out.state = State[State.TIMEOUT];
            }
        } catch (err) {
            out.state = State[State.FAIL];
        }

        try {
            const gradeReport: IGradeReport = await fs.readJson(this.keepDir + "/" + this.reportFilename);
            out.report = gradeReport;
            out.feedback = gradeReport.feedback;
            out.state = State[State.SUCCESS];
            out.postbackOnComplete = false;
        } catch (err) {
            out.state = State[State.INVALID_REPORT];
        }

        // try {
        //     out.attachments = await this.generateZipAttachments(this.keepDir);
        //     const writePromises: Array<Promise<void>> = [];
        //     for (const attachment of out.attachments) {
        //         const name = attachment.name;
        //         const data = attachment.data;
        //         const filename = `${persistDir}/${name}`;
        //         writePromises.push(fs.outputFile(filename, data));
        //     }
        //     await Promise.all(writePromises);
        // } catch (err) {
        //     // TODO
        // }

        try {
            await this.hostEnv.removeTempDir();
        } catch (err) {
            // TODO
        }

        const ret: ICommitRecord = {
            commitURL: input.pushInfo.commitURL,
            commitSHA: input.pushInfo.commitSHA,
            input:     input,
            output:    out
        };
        try {
            await fs.writeJson(`${this.keepDir}/commitRecord.json`, ret);
        } catch (err) {
            Log.error(`Grader::execute(..) - ERROR Writing commit record.`);
        }
        return ret;
    }

    /**
     * Initializes the Grader's workspace, creating all necessary directories.
     * @param workspace The working directory for the grader. If it does not exist, it will be created.
     */
    public async initWorkspace(): Promise<void[]> {
        Log.trace("Grader::initWorkspace(..) - start");
        const mkdirPromises: Array<Promise<void>> = [];
        mkdirPromises.push(fs.mkdirp(this.assnDir));
        mkdirPromises.push(fs.mkdirp(this.solnDir));
        mkdirPromises.push(fs.mkdirp(this.keepDir));
        return Promise.all(mkdirPromises);
    }

    public async runContainer(image: string, delivId: string, timeout: number, logSize?: number): Promise<IRunContainerResult> {
        Log.info("Grader::runContainer(..) - start;");
        const start = Date.now();
        const macAddress: string = this.hostEnv.acquireMACAddress();
        const hostUID: number = await this.hostEnv.getAutoTestUID();
        const hostIP: string = await this.hostEnv.getAutoTestIP();
        const hostPort: number = this.hostEnv.socketPort;
        const inputDir: string = this.hostEnv.tempDir;
        const container: IDockerContainer = new DockerContainer(image);
        const containerOptions: IDockerContainerOptions = {
            "--env": [`ASSIGNMENT=${delivId}`, `USER_UID=${hostUID}`, `HOST_IP=${hostIP}`, `HOST_PORT=${hostPort}`],
            "--volume": [`${inputDir}:/input`, `${this.keepDir}:/archive`]
        };

        let socket: net.Socket;
        let didTimeout: boolean = false;
        let didFinish: boolean = false;
        let log: string;
        try {
            this.hostEnv.firewall.address = macAddress;
            // empty rule drops all traffic
            await this.hostEnv.firewall.addRule();
            await container.create(containerOptions);
            await container.start();
            const [, containerAddress] = await container.inspect("{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}");

            // Handle messages from the container if it ever sends a message but don't block waiting
            this.hostEnv.getClientSocket(containerAddress).then((sock) => {
                socket = sock;
                socket.on("data", async (data: string) => {
                    const response = await this.handleContainerMessage(data);
                    socket.write(response);
                });
            });

            // Set a timer to kill the container if it doesn't finish in the time alloted
            if (timeout > 0) {
                setTimeout(async () => {
                    if (!didFinish) {
                        didTimeout = true;
                        await container.stop();
                    }
                }, timeout);
            }

            await container.wait();
            didFinish = true;
            [, log] = await container.logs();
            if (typeof logSize !== "undefined") {
                log = log.substring(0, logSize);
            }
        } catch (err) {
            throw err;
        } finally {
            socket.end();
            container.remove();
            this.hostEnv.firewall.flush();  // also deletes the chain
            this.hostEnv.releaseMACAddress(macAddress);
            Log.info("Grader::runContainer(..) - done; took: " + Util.took(start));
        }

        return { didTimeout, log };
    }

    /**
     * Checks if the container generated a grade report that conforms to the schema. Useful when debugging containers.
     * @param schema A JSON Schema describing the grade report emitted by the container.
     */
    protected isReportValid(schema: object): boolean {
        // TODO
        throw new Error(`Not Implemented`);
    }

    protected async fetchRepository(rootDir: string, url: string, commit?: string): Promise<Repository> {
        Log.trace(`Grader::fetchRepository(..) - start; rootDir: ${rootDir}, url: ${url}, commit: ${commit}`);
        const repo: Repository = new Repository(rootDir);
        await repo.clone(url);
        if (typeof commit !== `undefined`) {
            await repo.checkout(commit);
        }
        return repo;
    }

    protected async handleContainerMessage(message: string): Promise<string> {
        if (message.toUpperCase().startsWith("NET ALLOW ")) {
            const rawUrl: string = message.substr(9);
            const url = new URL(rawUrl);
            await this.hostEnv.firewall.addRule(false, url.host, url.port);
            return "SUCCESS";
        } else {
            return "INVALID_MSG";
        }
    }
}
