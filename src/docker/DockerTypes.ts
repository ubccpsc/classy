export interface IDockerImageProperties {
    id: string;
    repository: string;
    tag: string;
    digest: string;
    createdSince: string;
    createdAt: string;
    size: string;
}

// A subset of the Docker container run options.
// https://docs.docker.com/engine/reference/commandline/create/#options
export interface IDockerContainerOptions {
    env?: object;
    envFile?: string;
    volumes?: string[];  // Expands to multiple --volume <string> flags.
}

// A subset of the Docker inspect output for container objects.
// https://docs.docker.com/engine/reference/commandline/inspect/
export type IDockerContainerProperties = object[];
