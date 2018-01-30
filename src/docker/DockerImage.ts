/* Simple wrapper for managing Docker images. */
export default class DockerImage {
    public id: string;
    public repository: string;
    public tag: string;
    public digest: string;
    public createdSince: Date;
    public createdAt: Date;
    public size: string;

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
        // TODO
        throw new Error(`Not implemented`);
    }

    /**
     * Removes the image.
     * @returns A promise that resolves to the id of the image that was removed.
     * @throws If the docker rmi command fails.
     */
    public async remove(): Promise<string> {
        // TODO
        throw new Error(`Not implemented`);
    }
}
