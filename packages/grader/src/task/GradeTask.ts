import Log from "../../../common/Log";
import {ContainerInput, ContainerOutput, ContainerState} from "../../../common/types/ContainerTypes";
import {IDockerContainer} from "../docker/DockerContainer";
import {Repository} from "../git/Repository";
import {Workspace} from "../storage/Workspace";

export class GradeTask {
    private readonly id: string;
    private readonly input: ContainerInput;
    private readonly workspace: Workspace;
    private readonly container: IDockerContainer;
    private readonly repo: Repository;
    private containerState: string;

    constructor(id: string, input: ContainerInput, workspace: Workspace, container: IDockerContainer, repo: Repository) {
        this.id = id;
        this.input = input;
        this.workspace = workspace;
        this.container = container;
        this.repo = repo;
    }

    public async execute(): Promise<ContainerOutput> {
        Log.info("GradeTask::execute() - start");
        const out: ContainerOutput = {
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
            executionId:        this.id
        };

        try {
            await this.workspace.mkdir("output");

            Log.trace("GradeTask::execute() - Clone repo " +
                this.input.target.cloneURL.match(/\/(.+)\.git/)[0] + " and checkout " +
                this.input.target.commitSHA.substring(0, 6) + "."
            );
            const sha = await this.prepareRepo(this.input.target.cloneURL,
                `${this.workspace.rootDir}/assn`,
                this.input.target.commitSHA);

            if (this.input.target.commitSHA !== sha) {
                Log.warn("GradeTask::execute() - Failed to checkout commit. Requested: " +
                    this.input.target.commitSHA + " Actual: " + sha + ". Continuing to grade but results will likely" +
                    "be wrong.");
            }

            // Change the permissions so that the grading container can read the files.
            await this.workspace.chown();

            Log.trace("GradeTask::execute() - Create grading container.");
            try {
                await this.container.create(this.input.containerConfig.custom);

                Log.trace("GradeTask::execute() - Start grading container " + this.container.shortId);
                const exitCode = await this.runContainer(this.container);
                Log.trace("GradeTask::execute() - Container " + this.container.shortId + " exited with code " +
                    exitCode + ".");

                Log.trace("GradeTask::execute() - Write log for container " + this.container.shortId + " to " +
                    this.workspace + "/" + "stdio.txt");
                const [, log] = await this.container.logs();
                await this.workspace.writeFile("stdio.txt", log);

                if (this.containerState === "TIMEOUT") {
                    out.report.feedback = "Container did not complete in the allotted time.";
                    out.state = ContainerState.TIMEOUT;
                } else {
                    try {
                        const shouldPostback: boolean = exitCode !== 0;
                        out.report = await this.workspace.readJson("output/report.json");
                        out.postbackOnComplete = shouldPostback;
                        out.state = ContainerState.SUCCESS;
                    } catch (err) {
                        Log.error('GradeWorker::execute() - ERROR Reading grade report file produced be grading container' +
                            `${this.container.shortId}. ${err}`);
                        out.report.feedback = "Failed to read grade report.";
                        out.state = ContainerState.NO_REPORT;
                    }
                }
            } catch (err) {
                Log.error(`GradeTask::execute() - ERROR Running grading container. ${err}`);
            } finally {
                try {
                    Log.trace("GradeTask::execute() - Remove container " + this.container.should);
                    await this.container.remove();
                } catch (err) {
                    Log.warn("GradeTask::execute() - Failed to remove container " + this.container.shortId + ". " + err);
                }
            }
        } catch (err) {
            Log.warn(`GradeTask::execute() - ERROR Processing ${this.input.target.commitSHA.substring(0, 6)}. ${err}`);
        } finally {
            try {
                Log.trace("GradeTask::execute() - Remove cloned repo.");
                await this.workspace.rmdir("assn");
            } catch (err) {
                Log.warn("GradeTask::execute() - Failed to remove cloned repo " + this.workspace.rootDir + "/assn. " + err);
            }
        }

        out.timestamp = Date.now();
        return out;
    }

    protected async prepareRepo(url: string, dir: string, ref?: string): Promise<string> {
        await this.repo.clone(url, dir);
        if (typeof ref !== "undefined") {
            await this.repo.checkout(ref);
        }
        return this.repo.getSha();
    }

    protected async runContainer(container: IDockerContainer): Promise<number> {
        await container.start();

        // Set a timer to kill the container if it doesn't finish in the allotted time
        let didFinish = false;
        if (this.input.containerConfig.maxExecTime > 0) {
            setTimeout(async () => {
                if (!didFinish) {
                    Log.trace("GradeTask::runContainer(..) - Container " + container.shortId +
                        " was stopped after exceeding maxExecTime.");
                    this.containerState = "TIMEOUT";
                    const [exitCode] = await container.stop();
                    return exitCode;
                }
            }, this.input.containerConfig.maxExecTime * 1000);
        }

        // cmdOut is the exit code from the container
        const [, cmdOut] = await container.wait();
        didFinish = true;
        return Number(cmdOut);
    }
}
