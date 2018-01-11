// needed / extra from the Container's POV

// not required
export interface IUserInfo {
    username: string;
    csid: string;
    snum: string;
    profileUrl: string;
    fname: string;
    lname: string;
}

// all required
export interface IPushInfo { // TODO: refactor IPushEvent
    branch: string;
    repo: string;
    commit: string;
    commitUrl: string;
    projectUrl: string;
    timestamp: number;
}

export interface ICommentInfo { // TODO: refactor ICommentEvent
    branch: string;
    repo: string;
    commit: string;
    commitUrl: string;
    projectUrl: string;
    userName: string;
    courseId: string;
    delivId: string|null; // string if specified
    timestamp: number;
}

export interface IFeedbackGiven { // TODO: Refactor to IFeedbackGiven
    userName: string;
    courseId: string;
    delivId: string;
    timestamp: number;
    commitUrl: string; // for information only
}

// don't know what this is
export interface IContainer {
    branch: string;
    suiteVersion: string;
    image: string;
    exitcode: number;
}

// don't know what this is
export interface IDeliverableInfo {
    solutionsUrl: string;
    deliverableCommit: string;
    deliverableUrl: string;
    deliverableToMark: string;
    githubKey: string;
}

export interface ICommitInfo { // refactor ICommitRecord
    commitUrl: string;
    user: IUserInfo;
    input: IContainerInput;
    output: IContainerOutput;
}

export interface IContainerInput {
    // needed
    pushInfo: IPushInfo;
    courseId: string;
    delivId: string;

    // extra?
    deliverableInfo?: IDeliverableInfo;
    userInfo?: IUserInfo;
    container?: IContainer;
    dockerImage?: string;
    githubKeys?: {
        delivKey: string;
        solutionsKey: string;
        orgKey: string;
    };
    githubOrg?: string;
    custom?: {};
    teamId?: string;
    courseNum?: number;
    stdioRef?: string;
}

export interface IContainerOutput {
    // needed
    commitUrl: string; // key
    timestamp: number; // time when complete
    report: IGradeReport;
    feedback: string; // markdown
    postbackOnComplete: boolean;
    custom: {};
    attachments: IAttachment[];
    state: string; // enum: SUCCESS, FAIL, TIMEOUT, CONSOLEOVERFLOW

    // if we split the IContainerInput and IContainerOutput we don't need all of these
    // but having them in a single object on AutoTest is very useful
    team: string; // needed
    commit: string; // sha?
    committer: string; // needed
    projectUrl: string;
    courseNum: number;
    orgName: string;
    repo: string; // needed
    ref: string; // is this commitUrl?
    user: string;
    deliverable: string;

    // not needed
    container: {
        scriptVersion: string;
        suiteVersion: string;
        image: string;
        exitCode: number;
    };
    gradeRequested: boolean;
    gradeRequestedTimestamp: number;
    idStamp: string;
    stdioRef: string; // how will we deal with stdio?
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
}

export interface IAttachment {
    name: string;
    data: string;
    content_type: string;
}
