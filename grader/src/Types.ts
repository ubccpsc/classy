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

export interface IAssignment {
    url: string;
    commit: string;
    token: string;
}

export interface IGradeContainer {
    image: string;
    timeout: number;
    logSize: number;
}

export interface IGradeTask {
    assnId: string;
    assn: IAssignment;
    container: IGradeContainer;
}

export interface IContainerOutput {
    // needed
    commitUrl: string; // key
    timestamp: number; // time when complete
    report: IGradeReport;
    feedback: string; // markdown
    postbackOnComplete: boolean;
    custom: {};
    attachments: any[];
    state: string; // enum: SUCCESS, FAIL, TIMEOUT, INVALID_REPORT
}

export interface IHostEnv {
    name: string;  // hostname or ip address
    port: number;  // (will be used for the socket server)
    uid: number;   // the id of the host user that will run containers. this ensures files are written with the consistent permissions on the host.
    net: string;   // the name of the (sub)net that the grading container should connect to
    mount: string; // the path to the mounted host directory
}
