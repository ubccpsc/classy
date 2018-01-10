export interface IUserInfo {
    username: string;
    csid: string;
    snum: string;
    profileUrl: string;
    fname: string;
    lname: string;
}

export interface IPushInfo {
    branch: string;
    repo: string;
    commit: string;
    commitUrl: string;
    projectUrl: string;
    timestamp: number;
}

export interface IContainer {
    branch: string;
    suiteVersion: string;
    image: string;
    exitcode: number;
}

export interface IDeliverableInfo {
    solutionsUrl: string;
    deliverableCommit: string;
    deliverableUrl: string;
    deliverableToMark: string;
    githubKey: string;
}

export interface IRuntime {
    userInfo: IUserInfo;
    pushInfo: IPushInfo;
    container: IContainer;
    deliverableInfo: IDeliverableInfo;
    dockerImage: string;
    githubKeys: {
        delivKey: string;
        solutionsKey: string;
        orgKey: string;
    };
    githubOrg: string;
    custom: object;
    teamId: string;
    courseNum: number;
    stdioRef: string;
}

export interface IContainerRecord {
    team: string;
    commit: string;
    committer: string;
    commitUrl: string;
    timestamp: number;
    repo: string;
    ref: string;
    report: any; // grade report
    container: {
        scriptVersion: string;
        suiteVersion: string;
        image: string;
        exitCode: number;
    };
    postbackOnComplete: boolean;
    projectUrl: string;
    courseNum: number;
    orgName: string;
    custom: object;
    gradeRequested: boolean;
    gradeRequestedTimestamp: number;
    deliverable: string;
    user: string;
    githubFeedback: string;
    idStamp: string;
    attachments: IAttachment[];
    stdioRef: string;
    state: string;
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
