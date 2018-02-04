import {exec} from "child_process";
import {IDockerImageProperties} from "./DockerTypes";

/* Simple wrapper for managing Docker images. */
export default class DockerImage {
    private _id: string;

    constructor() {
        // Do nothing
    }

    /**
     * Builds a Docker image from the given context.
     * @param tagName A name for the image.
     * @param context A string representing the build context. It can be one of:
     * - a path to a directory containing a Dockerfile, or
     * - a URL to a git repository containing a Dockerfile, or
     * - the contents of a Dockerfile.
     * @returns A promise that resolves to the image id.
     * @throws If the docker build command fails.
     */
    public async build(tagName: string, context: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            exec(`docker build --tag ${tagName} --rm ${context}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                let imgId: string;
                const lines: string[] = stdout.split(`\n`);
                for (const line of lines) {
                    const matches = line.match(/^Successfully built (\w+)$/m);
                    if (matches !== null && matches.length > 1) {
                        imgId = matches[1];
                        break;
                    }
                }
                this._id = imgId;
                resolve(imgId);
            });
        });
    }

    /**
     * Gets the image properties once it has been created.
     * @returns A promise that resolves to the image properties or undefined if the image is not found.
     * @throws If the docker rmi command fails or its output is not valid JSON.
     */
    public async getProperties(): Promise<IDockerImageProperties[]> {
        return new Promise<IDockerImageProperties[]>((resolve, reject) => {
            const format: string = `'{
                "id": {{json .ID}},
                "repository": {{json .Repository}},
                "tag": {{json .Tag}},
                "digest": {{json .Digest}},
                "createdSince": {{json .CreatedAt}},
                "createdAt": {{json .CreatedSince}},
                "size": {{json .Size}}
            }'`.replace(/\s+(?!\.)/g, ``);

            exec(`docker images --format ${format}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                const images: string[] = stdout.trim().split(`\n`);
                const properties: IDockerImageProperties[] = [];
                for (const image of images) {
                    const obj = JSON.parse(image);
                    if (obj.id === this._id) {
                        properties.push(obj);
                    }
                }
                resolve(properties);
            });
        });
    }

    /**
     * Removes the image.
     * @returns A promise that resolves to the id of the image that was removed.
     * @throws If the docker rmi command fails or the image is not found.
     */
    public async remove(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            exec(`docker rmi --force ${this._id}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                const matches = stdout.match(/^Deleted: sha256:(\w+)$/m);
                if (matches !== null && matches.length > 1) {
                    resolve(matches[1]);
                } else {
                    reject(new Error(`Image not found.`));
                }
            });
        });
    }
}
