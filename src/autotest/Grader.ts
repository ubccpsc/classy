import * as fs from "fs-extra";
import * as path from "path";
import {Config} from "../Config";
import DockerContainer, {IDockerContainer} from "../docker/DockerContainer";
import {IDockerContainerOptions} from "../docker/DockerTypes";
import {IAttachment, ICommitRecord, IContainerInput, IContainerOutput, IGradeReport} from "../Types";
import FSUtil from "../util/FSUtil";
import Log from "../util/Log";
import Repository from "../util/Repository";
import Util from "../util/Util";

/**
 * Grades a student's project at a specified commit against a solution key for the assignment.
 */
export default class Grader {
    private readonly reportFilename: string;
    private readonly transcriptFilename: string;
    private workspace: string;
    private assnDir: string;
    private solnDir: string;
    private keepDir: string;

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
    constructor(reportFilename: string = `report.json`, transcriptFilename: string = `stdio.txt`) {
        this.workspace = null;
        this.reportFilename = reportFilename;
        this.transcriptFilename = transcriptFilename;
    }

    /**
     * Deletes the workspace directory.
     */
    public async clearWorkspace(): Promise<void> {
        return fs.remove(this.workspace);
    }

    /**
     * Runs the container which performs that actual grading. Retrieves the container stdio and stores it in the keepDir.
     * @param container The docker container that will execute the grading logic. It should already be created.
     * @param timeAlloted The duration, in milliseconds, the container is allowed to run for.
     */
    public async grade(container: DockerContainer): Promise<IGradeReport> {
        // TODO @nickbradley logs should be truncated before being written to the file.
        const log: string = (await container.logs()).output;
        await fs.writeFile(`${this.keepDir}/${this.transcriptFilename}`, log);
        // TODO @nickbradley Validate the report before returning
        const report: IGradeReport = await fs.readJson(`${this.keepDir}/${this.reportFilename}`);
        return report;
    }

    public async execute(input: IContainerInput): Promise<ICommitRecord> {
        Log.trace("Grader::execute(..) - start; SHA: " + input.pushInfo.commitSHA);

        enum State {SUCCESS, TIMEOUT, INVALID_REPORT, FAIL}

        const containerMount: string = `/io`;

        const image: string = Config.getInstance().getProp("dockerId");
        const workspaceRoot: string = Config.getInstance().getProp("workspace");
        const timeout: number = Config.getInstance().getProp("timeout");
        const assnToken: string = Config.getInstance().getProp("githubOrgToken");
        const solnToken: string = Config.getInstance().getProp("githubOracleToken");
        const solnUrl: string = Config.getInstance().getProp("oracleRepo").replace("://", `://${solnToken}@`);

        const solnBranch: string = input.delivId;
        const assnUrl: string = input.pushInfo.projectURL.replace("://", `://${assnToken}@`);
        const assnCommit: string = input.pushInfo.commitSHA;
        const delivId: string = input.delivId;

        let code: number;
        let container: DockerContainer;

        const out: IContainerOutput = {
            commitUrl:          input.pushInfo.commitURL,
            timestamp:          Date.now(),
            report:             null,
            feedback:           null,
            postbackOnComplete: false,
            custom:             {},
            attachments:        [],
            state:              "SUCCESS" // enum: SUCCESS, TIMEOUT, INVALID_REPORT, FAIL
        };

        try {
            await this.initWorkspace(`${workspaceRoot}/${input.pushInfo.commitSHA}`);
            const assnRepo: Promise<Repository> = this.fetchRepository(this.assnDir, assnUrl, assnCommit);
            const solnRepo: Promise<Repository> = this.fetchRepository(this.solnDir, solnUrl, solnBranch);
            await Promise.all([assnRepo, solnRepo]);
        } catch (err) {
            out.feedback = "AutoTest encountered an unexpected error. Please make a new commit and try again.";
            out.postbackOnComplete = true;
        }
        try {
            [code, container] = await this.runContainer(image, delivId, containerMount, timeout);
        } catch (err) {
            if (typeof err === `number`) {
                out.feedback = "Grading of this commit was forcibly terminated after exceeding alloted time.";
                out.state = State[State.TIMEOUT];
            } else {
                out.state = State[State.FAIL];
            }
            out.postbackOnComplete = true;
        }

        try {
            const gradeReport: IGradeReport = await this.grade(container);
            out.report = gradeReport;
            out.feedback = gradeReport.feedback;
        } catch (err) {
            out.state = State[State.INVALID_REPORT];
            out.postbackOnComplete = true;
        }

        try {
            out.attachments = await this.generateZipAttachments(this.keepDir);
        } catch (err) {
            // TODO
        }

        try {
            await this.clearWorkspace();
            await container.remove();
        } catch (err) {
            // TODO
        }


        const ret: ICommitRecord = {
            commitURL: input.pushInfo.commitURL,
            commitSHA: input.pushInfo.commitSHA,
            input:     input,
            output:    out
        };
        return ret;
    }

    /**
     * Initializes the Grader's workspace, creating all necessary directories.
     * @param workspace The working directory for the grader. If it does not exist, it will be created.
     */
    public async initWorkspace(workspace: string): Promise<void[]> {
        Log.trace("Grader::initWorkspace(..) - start");
        this.workspace = workspace;
        this.assnDir = `${workspace}/assignment`;
        this.solnDir = `${workspace}/solution`;
        this.keepDir = `${workspace}/store`;
        const mkdirPromises: Array<Promise<void>> = [];
        mkdirPromises.push(fs.mkdirp(this.assnDir));
        mkdirPromises.push(fs.mkdirp(this.solnDir));
        mkdirPromises.push(fs.mkdirp(this.keepDir));
        return Promise.all(mkdirPromises);
    }

    public async runContainer(image: string, delivId: string, cntMntDir: string, timeout: number): Promise<[number, DockerContainer]> {
        Log.trace("Grader::runContainer(..) - start; workspace: " + this.workspace);
        const start = Date.now();
        const container: DockerContainer = new DockerContainer(image);
        const containerOptions: IDockerContainerOptions[] = [
            {name: "--env", value: `ASSIGNMENT=${delivId}`},
            {name: "--volume", value: `${this.workspace}:${cntMntDir}`}
        ];
        let containerId: string;
        let containerAddr: string;
        let code: number;
        try {
            await container.create(containerOptions);
            containerId = (await container.start()).output;
            await container.pause();
            //containerAddr = await container.getAddress();
            // Do IP tables stuff here
            await container.unpause();
            code = Number((await container.wait(timeout)).output);

            Log.trace("Grader::runContainer(..) - done; workspace: " + this.workspace + "; took: " + Util.took(start));
        } catch (err) {
            console.log(err);
            // Report error in Container Output record
        } finally {
            // TODO
        }

        return [code, container];
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
        const repo: Repository = new Repository(rootDir);
        await repo.clone(url);
        if (typeof commit !== `undefined`) {
            await repo.checkout(commit);
        }
        return repo;
    }

    protected async generateZipAttachments(dir: string): Promise<IAttachment[]> {
        const attachments: IAttachment[] = [];
        const filenames: string [] = await fs.readdir(dir);
        for (const filename of filenames) {
            const name: string = `${filename}.zip`;
            const data: Uint8Array = await FSUtil.zipFile(`${dir}/${filename}`);
            const attachment: IAttachment = {
                name,
                data:         data.toString(),
                content_type: "application/zip",
            };
            attachments.push(attachment);
        }
        return attachments;
    }
}
