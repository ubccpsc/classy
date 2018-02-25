//
// Types needed from the Container's POV
//
export interface IPushEvent {
    branch: string; // really refs
    repo: string; // repo name
    commitSHA: string; // SHA
    commitURL: string; // full url to commit
    org: string; // orgName
    projectURL: string; // full url to project
    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of push event
}

export interface ICommentEvent {
    botMentioned: boolean; // was the bot mentioned (e.g., can ignore comments that don't mention the bot)
    // repo: string;
    commitSHA: string;
    commitURL: string;
    // projectUrl: string;
    userName: string;
    courseId: string | null; // string once known
    delivId: string | null; // string if specified
    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of the latest comment update (safer than comment creation)
}

/**
 * Feedback key can be considered 'userName : courseId : delivId'
 */
export interface IFeedbackGiven {
    userName: string;
    courseId: string;
    delivId: string;
    timestamp: number;
    commitURL: string; // for information only
}

export interface ICommitRecord { // refactor ICommitRecord
    commitURL: string;
    commitSHA: string;
    // user: IUserInfo;
    input: IContainerInput;
    output: IContainerOutput;
}

export interface IContainerInput {
    // needed
    pushInfo: IPushEvent;
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
    state: string; // enum: SUCCESS, FAIL, TIMEOUT, INVALID_REPORT

    // if we split the IContainerInput and IContainerOutput we don't need all of these
    // but having them in a single object on AutoTest is very useful
    team?: string; // needed
    commit?: string; // sha?
    committer?: string; // needed
    projectUrl?: string;
    courseNum?: number;
    orgName?: string;
    repo?: string; // needed
    ref?: string; // is this commitUrl?
    user?: string;
    deliverable?: string;

    // not needed
    container?: {
        scriptVersion: string;
        suiteVersion: string;
        image: string;
        exitCode: number;
    };
    gradeRequested?: boolean;
    gradeRequestedTimestamp?: number;
    idStamp?: string;
    stdioRef?: string; // how will we deal with stdio?
}

//
// These are not required by AutoTest
//

// not required
export interface IUserInfo {
    username: string;
    csid: string;
    snum: string;
    profileUrl: string;
    fname: string;
    lname: string;
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

