import * as fs from "fs-extra";
import * as path from "path";
import {IDockerContainer} from "../docker/DockerContainer";
import { IDockerContainerOptions } from "../docker/DockerTypes";
import { IGradeReport } from "../Types";
import FSUtil from "../util/FSUtil";
import Repository from "../util/Repository";

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
     * Returns the directory where the assignment should be put.
     */
    public get assignmentDir(): string {
        return this.assnDir;
    }

    /**
     * Returns the directory where the solution should be put.
     */
    public get solutionDir(): string {
        return this.solnDir;
    }

    /**
     * Creates an individual zip for each file in the root of keepDir and stores them at the destination. Directories
     * and nested files are ignored.
     * @param dest The location for the archive. If the destination does not exist, it will be created.
     * @returns A list of arrays representing the compressed zipped files.
     */
    public async archiveGradingArtifacts(dest: string): Promise<Uint8Array[]> {
        const keepFiles: string[] = await fs.readdir(this.keepDir);
        const filesToArchive: string[] = keepFiles.map((basename) => `${this.keepDir}/${basename}`);
        const zipCopyPromises: Array<Promise<Uint8Array>> = [];
        for (const file of filesToArchive) {
            zipCopyPromises.push(FSUtil.zipTo(file, dest));
        }
        return Promise.all(zipCopyPromises);
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
    public async grade(container: IDockerContainer, timeAlloted: number): Promise<IGradeReport> {
        await container.start(timeAlloted);
        await fs.writeFile(`${this.keepDir}/${this.transcriptFilename}`, await container.getLog());
        // TODO @nickbradley Validate the report before returning
        return fs.readJson(`${this.keepDir}/${this.reportFilename}`);
    }

    /**
     * Initializes the Grader's workspace, creating all necessary directories.
     * @param workspace The working directory for the grader. If it does not exist, it will be created.
     */
    public async initWorkspace(workspace: string): Promise<void[]> {
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

    /**
     * Checks if the container generated a grade report that conforms to the schema. Useful when debugging containers.
     * @param schema A JSON Schema describing the grade report emitted by the container.
     */
    protected isReportValid(schema: object): boolean {
        // TODO
        throw new Error(`Not Implemented`);
    }
}
