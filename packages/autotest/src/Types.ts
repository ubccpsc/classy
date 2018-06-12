//
// Types needed from the Container's POV
//
export interface IPushEvent {
    org: string; // orgName
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
    org: string | null; // was org
    personId: string; // was username
    delivId: string | null; // string if specified

    commitSHA: string;
    commitURL: string;

    botMentioned: boolean; // was the bot mentioned (e.g., can ignore comments that don't mention the bot)
    postbackURL: string; // where to send postback results
    timestamp: number; // timestamp of the latest comment update (safer than comment creation)
}

/**
 * Feedback key can be considered 'personId : org : delivId'
 */
export interface IFeedbackGiven {
    personId: string; // was username
    org: string; // was org
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
    org: string; // was courseId
    delivId: string;

    /*
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
    */
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

//
// These are not required by AutoTest
//

// not required
// export interface IUserInfo {
//     username: string;
//     csid: string;
//     snum: string;
//     profileUrl: string;
//     fname: string;
//     lname: string;
// }

// don't know what this is
// export interface IContainer {
//     branch: string;
//     suiteVersion: string;
//     image: string;
//     exitcode: number;
// }

// don't know what this is
// export interface IDeliverableInfo {
//     solutionsUrl: string;
//     deliverableCommit: string;
//     deliverableUrl: string;
//     deliverableToMark: string;
//     githubKey: string;
// }

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

