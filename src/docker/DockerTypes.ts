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
    name: string;
    value: string;
}

// A subset of the Docker inspect output for container objects.
// https://docs.docker.com/engine/reference/commandline/inspect/
export interface IDockerContainerProperties {
    [prop: string]: any;
}

export interface IDockerCmdResult {
    code: number;
    output: string;
}

export enum DockerContainerStatus {
    created,
    restarting,
    running,
    removing,
    paused,
    exited,
    dead
}
