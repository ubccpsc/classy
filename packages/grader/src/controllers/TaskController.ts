import {ContainerInput, ContainerOutput} from "../../../common/types/ContainerTypes";
import {DockerContainer, IDockerContainer} from "../docker/DockerContainer";
import {Repository} from "../git/Repository";
import {GradeTask} from "../model/GradeTask";
import {Workspace} from "../storage/Workspace";

interface Tasks {
    [id: string]: {
        start: Date;
        result: Promise<ContainerOutput>;
        workspace: Workspace;
    };
}

export class TaskController {
    private readonly tasks: Tasks;

    constructor() {
        this.tasks = {};
    }

    public create(input: ContainerInput): string {
        const id: string = input.target.commitSHA + "-" + input.delivId;
        const uid: number = Number(process.env.UID);
        const token: string = process.env.GH_BOT_TOKEN.replace("token ", "");

        // Add parameters to create the grading container. We'll be lazy and use the custom field.
        input.containerConfig.custom = {
            "--env":      [
                `ASSIGNMENT=${input.delivId}`,
                `USER_UID=${uid}`
            ],
            "--volume":   [
                `${process.env.GRADER_HOST_DIR}/${id}/assn:/assn`,
                `${process.env.GRADER_HOST_DIR}/${id}/output:/output`
            ],
            "--network":  process.env.DOCKER_NET,
            "--add-host": process.env.HOSTS_ALLOW,
            "--user": uid
        };

        // Inject the GitHub token into the cloneURL so we can clone the repo.
        input.target.cloneURL = input.target.cloneURL.replace("://", `://${token}@`);

        const workspace: Workspace = new Workspace(process.env.GRADER_PERSIST_DIR + "/" + id, uid);
        const container: IDockerContainer = new DockerContainer(input.containerConfig.dockerImage);
        const repo: Repository = new Repository();
        const result = new GradeTask(id, input, workspace, container, repo).execute();

        this.tasks[id] = {
            start: new Date(),
            result: result,
            workspace
        };

        return id;
    }

    public getAttachmentBasePath(id: string): string {
        return this.tasks[id].workspace.rootDir;
    }

    public getResult(id: string): Promise<ContainerOutput> {
        if (!this.tasks.hasOwnProperty(id)) {
            throw new Error("id " + id + " not found.");
        }

        return this.tasks[id].result;
    }
}
