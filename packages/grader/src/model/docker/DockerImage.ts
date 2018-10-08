import {exec} from "child_process";
import {CommandResult, IDockerImageProperties} from "../../Types";
import {Command} from "../../util/Command";

/* Simple wrapper for managing Docker images. */
export interface IDockerImage {
    /**
     * Builds a Docker image from the given context.
     * @param tagName A name for the image.
     * @param context A string representing the build context. It can be one of:
     * - a path to a directory containing a Dockerfile, or
     * - a URL to a git repository containing a Dockerfile, or
     * - the contents of a Dockerfile.
     */
    build(tagName: string, context: string): Promise<CommandResult>;

    /**
     * Gets the image properties once it has been created.
     * @returns A promise that resolves to the image properties or undefined if the image is not found.
     * @throws If the docker rmi command fails or its output is not valid JSON.
     */
    getProperties(): Promise<CommandResult>;

    /**
     * Removes the image.
     * @returns A promise that resolves to the id of the image that was removed.
     * @throws If the docker rmi command fails or the image is not found.
     */
    remove(): Promise<CommandResult>;
}

export class DockerImage extends Command implements IDockerImage {
    // tslint:disable-next-line
    private _id: string;

    constructor() {
        super("docker");
    }

    public async build(tagName: string, context: string): Promise<CommandResult> {
        const args: string[] = ["build", "--tag", tagName, "--rm", context];
        let code: number;
        let output: string;
        [code, output] = await this.executeCommand(args);
        let imgId: string;
        const lines: string[] = output.split(`\n`);
        for (const line of lines) {
            const matches = line.match(/^Successfully built (\w+)$/m);
            if (matches !== null && matches.length > 1) {
                imgId = matches[1];
                break;
            }
        }
        this._id = imgId;
        return [code, imgId];
    }

    public async getProperties(): Promise<[number, IDockerImageProperties[]]> {
        const format: string = `'{
            "id": {{json .ID}},
            "repository": {{json .Repository}},
            "tag": {{json .Tag}},
            "digest": {{json .Digest}},
            "createdSince": {{json .CreatedAt}},
            "createdAt": {{json .CreatedSince}},
            "size": {{json .Size}}
        }'`.replace(/\s+(?!\.)/g, ``);
        const args: string[] = ["images", "--format", format];
        let code: number;
        let output: string;
        [code, output] = await this.executeCommand(args);
        const images: string[] = output.trim().split(`\n`);
        const properties: IDockerImageProperties[] = [];
        for (const image of images) {
            const obj = JSON.parse(image);
            if (obj.id === this._id) {
                properties.push(obj);
            }
        }
        return [code, properties];
    }

    public async remove(): Promise<CommandResult> {
        const args: string[] = ["rmi", "--force", this._id];
        let code: number;
        let output: string;
        [code, output] = await this.executeCommand(args);
        const matches = output.match(/^Deleted: sha256:(\w+)$/m);
        if (matches !== null && matches.length > 1) {
            return [code, matches[1]];
        } else {
            throw new Error(`Image not found.`);
        }
    }
}
