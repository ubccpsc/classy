//
// Types needed from the Container's POV
//
export interface IPushEvent {
    repoId: string; // was repo

    branch: string; // really refs
    cloneURL: string;
    commitSHA: string; // SHA
    commitURL: string; // full url to commit

    projectURL: string; // full url to project
    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of push event
}

export interface ICommentEvent {
    personId: string; // was username
    delivId: string | null; // string if specified

    commitSHA: string;
    commitURL: string;

    botMentioned: boolean; // was the bot mentioned (e.g., can ignore comments that don't mention the bot)
    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of the latest comment update (safer than comment creation)
}

export interface IFeedbackGiven {
    personId: string;
    delivId: string;
    timestamp: number;
    commitURL: string; // for information only
}

export interface ICommitRecord {
    commitURL: string;
    commitSHA: string;
    input: IContainerInput;
    output: IContainerOutput;
}

export interface IContainerInput {
    pushInfo: IPushEvent;
    delivId: string;
}

export interface IContainerOutput {
    commitURL: string;
    timestamp: number; // time when complete
    report: IGradeReport;
    feedback: string; // markdown
    postbackOnComplete: boolean;
    custom: {};
    attachments: IAttachment[];
    state: string; // enum: SUCCESS, FAIL, TIMEOUT, INVALID_REPORT
}

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

export interface IAttachment {
    name: string;
    data: any;
    content_type: string;
}
