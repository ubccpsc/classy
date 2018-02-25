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
    [name: string]: string | string[];
}

export interface IDockerNetworkOptions {
    driver?: "bridge";
    subnet?: string;
    "ip-range"?: string;
    gateway?: string;
}

export type CommandResult = [number, any];

export interface IFirewallRule {
    chain: string;
    jump: string;
    destination?: string;
    source?: string;
    protocol?: "tcp" | "udp" | "all";
    sport?: number;
    dport?: number;
    module?: "state";
    state?: string;
}

// REST types

export interface IGradeReport {
    scoreOverall: number;
    scoreTest: number;
    scoreCover: number;
    passNames: string[];
    failNames: string[];
    errorNames: string[];
    skipNames: string[];
    custom: any[];
    feedback: string;
}

interface IAssignment {
    url: string;
    commit: string;
}

interface ISolution {
    url: string;
    branch: string;
}

interface IGradeContainer {
    image: string;
    timeout: number;
    logSize: number;
}

export interface IGradeTask {
    assnId: string;
    execId: string;
    assn: IAssignment;
    soln: ISolution;
    container: IGradeContainer;
}
